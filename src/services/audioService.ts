
import { Chop } from '../types';

/**
 * Detects transients in an audio buffer and returns start times for chops.
 * This uses a simple onset detection algorithm based on energy increase.
 * @param buffer The AudioBuffer to analyze.
 * @param numChops The desired number of chops.
 * @returns An array of start times (in seconds) for each chop.
 */
export const detectAndChopSample = (buffer: AudioBuffer, numChops: number): number[] => {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  // High-pass filter to emphasize transients
  const filteredData = new Float32Array(data.length);
  if (data.length > 0) {
    filteredData[0] = data[0];
    for (let i = 1; i < data.length; i++) {
      // Simple high-pass filter
      filteredData[i] = data[i] - 0.97 * data[i - 1];
    }
  }

  // Rectify (absolute value)
  for (let i = 0; i < filteredData.length; i++) {
    filteredData[i] = Math.abs(filteredData[i]);
  }

  // Find peaks (potential onsets)
  const peakThreshold = 0.05; // A sensible default threshold
  const minPeakDistance = Math.floor(sampleRate * 0.05); // 50ms minimum distance between peaks
  
  // Offset to place the chop marker slightly before the transient peak.
  // A 20ms pre-roll gives a nice attack without cutting off the transient.
  const preRollMs = 20;
  const preRollSamples = Math.floor(sampleRate * (preRollMs / 1000));
  
  let peaks: { index: number; value: number }[] = [];
  let i = 0;
  while (i < filteredData.length) {
    if (filteredData[i] > peakThreshold) {
      let maxVal = filteredData[i];
      let maxIndex = i;
      const windowEnd = Math.min(i + minPeakDistance, filteredData.length);
      for (let j = i + 1; j < windowEnd; j++) {
        if (filteredData[j] > maxVal) {
          maxVal = filteredData[j];
          maxIndex = j;
        }
      }
      // Apply the pre-roll offset, ensuring it doesn't go below zero.
      const chopIndex = Math.max(0, maxIndex - preRollSamples);
      peaks.push({ index: chopIndex, value: maxVal });
      i = windowEnd;
    } else {
      i++;
    }
  }

  // Prune or pad peaks to get the desired number of chops
  let chopIndices: number[] = [0];

  if (peaks.length > numChops - 1) {
    // Too many peaks, take the strongest ones
    peaks.sort((a, b) => b.value - a.value);
    const strongestPeaks = peaks.slice(0, numChops - 1);
    chopIndices.push(...strongestPeaks.map(p => p.index));
  } else {
    // Not enough peaks, use all of them
    chopIndices.push(...peaks.map(p => p.index));
  }

  // Sort by index and remove duplicates
  chopIndices.sort((a, b) => a - b);
  chopIndices = [...new Set(chopIndices)];

  // If still not enough chops, fill in the largest gaps with linear chops
  while (chopIndices.length < numChops) {
    let maxGap = 0;
    let maxGapIndex = -1;
    for (let k = 0; k < chopIndices.length - 1; k++) {
      const gap = chopIndices[k + 1] - chopIndices[k];
      if (gap > maxGap) {
        maxGap = gap;
        maxGapIndex = k;
      }
    }
    
    const lastGap = data.length - chopIndices[chopIndices.length - 1];
    if (lastGap > maxGap) {
        const newChopIndex = chopIndices[chopIndices.length - 1] + Math.floor(lastGap / 2);
        if(newChopIndex < data.length) {
            chopIndices.push(newChopIndex);
        } else { // fallback if calculation goes wrong
             break;
        }
    } else if (maxGapIndex !== -1) {
        chopIndices.splice(maxGapIndex + 1, 0, chopIndices[maxGapIndex] + Math.floor(maxGap / 2));
    } else { // No gaps to fill, break to prevent infinite loop
        break;
    }
  }
  
  // Convert indices to time in seconds and ensure correct length
  const chopTimes = chopIndices.slice(0, numChops).map(index => index / sampleRate);
  
  // Final check to ensure we have the right number of chops
  while (chopTimes.length < numChops) {
      const lastTime = chopTimes.length > 0 ? chopTimes[chopTimes.length - 1] : 0;
      const step = (buffer.duration - lastTime) / (numChops - chopTimes.length + 1);
      chopTimes.push(lastTime + step);
  }

  return chopTimes.slice(0, numChops);
};
