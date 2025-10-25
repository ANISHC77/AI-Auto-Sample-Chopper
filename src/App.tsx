
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sample, SampleType, Chop, PadId } from './types';
import { PAD_KEY_MAP } from './constants';
import { detectAndChopSample } from './services/audioService';
import { getMelodicChopPoints } from './services/geminiService';
import WaveformDisplay from './components/WaveformDisplay';
import PadGrid from './components/PadGrid';
import Controls from './components/Controls';

const App: React.FC = () => {
  const [drumSample, setDrumSample] = useState<Sample | null>(null);
  const [melodicSample, setMelodicSample] = useState<Sample | null>(null);
  const [isLoading, setIsLoading] = useState({ [SampleType.DRUMS]: false, [SampleType.MELODIC]: false });
  const [activePads, setActivePads] = useState<Set<PadId>>(new Set());
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [padPlayheadPosition, setPadPlayheadPosition] = useState(-1);
  const [padPlayheadSampleType, setPadPlayheadSampleType] = useState<SampleType | null>(null);
  const [drumLoopPlayhead, setDrumLoopPlayhead] = useState(-1);
  const [melodyLoopPlayhead, setMelodyLoopPlayhead] = useState(-1);

  const [bpm, setBpm] = useState(120);
  const [isQuantized, setQuantized] = useState(false);
  const [drumVolume, setDrumVolume] = useState(100);
  const [melodicVolume, setMelodicVolume] = useState(100);
  const [drumSemitones, setDrumSemitones] = useState(0);
  const [melodicSemitones, setMelodicSemitones] = useState(0);
  
  const [drumLoopMode, setDrumLoopMode] = useState<'full' | 'chop'>('full');
  const [melodyLoopMode, setMelodyLoopMode] = useState<'full' | 'chop'>('full');
  const [drumLoopSequence, setDrumLoopSequence] = useState('1');
  const [melodyLoopSequence, setMelodyLoopSequence] = useState('1');

  const audioContextRef = useRef<AudioContext | null>(null);
  const playingSourcesRef = useRef<Map<PadId, AudioBufferSourceNode>>(new Map());
  
  const isPlayingRef = useRef(false);
  const drumLoopIndexRef = useRef(0);
  const melodyLoopIndexRef = useRef(0);
  const drumCurrentLoopSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const melodyCurrentLoopSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const drumLoopStartTimeRef = useRef(0);
  const melodyLoopStartTimeRef = useRef(0);
  const currentDrumLoopChopRef = useRef<Chop | null>(null);
  const currentMelodyLoopChopRef = useRef<Chop | null>(null);

  const mainAnimationRef = useRef<number>(0);
  const padAnimationRef = useRef<number>(0);
  const transportStartTimeRef = useRef<number>(0);
  const drumStitchSequenceEndTime = useRef<number>(0);
  const padPlaybackQueueRef = useRef<Array<{
    padId: PadId;
    sampleType: SampleType;
    chop: Chop;
    scheduledStartTime: number;
  }>>([]);

  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        audioContextRef.current = new Ctx();
      } else {
        alert("Web Audio API is not supported in this browser.");
      }
    }
  }, []);

  const handleFileUpload = async (file: File, type: SampleType) => {
    initializeAudioContext();
    if (!audioContextRef.current) return;

    setIsLoading(prev => ({ ...prev, [type]: true }));
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      
      let chopStartTimes: number[];
      if (type === SampleType.DRUMS) {
        chopStartTimes = detectAndChopSample(audioBuffer, 8);
      } else {
        chopStartTimes = await getMelodicChopPoints(audioBuffer.duration);
      }
      
      const chops: Chop[] = chopStartTimes.map((start, i) => ({
        id: i,
        start,
        end: i < chopStartTimes.length - 1 ? chopStartTimes[i + 1] : audioBuffer.duration,
      }));

      const newSample = { file, buffer: audioBuffer, chops };
      if (type === SampleType.DRUMS) {
        setDrumSample(newSample);
      } else {
        setMelodicSample(newSample);
      }
    } catch (error) {
      console.error(`Error processing ${type} sample:`, error);
      alert(`Failed to load or process the ${type} sample. Please try a different file.`);
    } finally {
      setIsLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const stopPadAnimations = useCallback(() => {
    if (padAnimationRef.current !== 0) {
        cancelAnimationFrame(padAnimationRef.current);
        padAnimationRef.current = 0;
    }
    padPlaybackQueueRef.current = [];
    setPadPlayheadPosition(-1);
    setPadPlayheadSampleType(null);
  }, []);

  const padAnimate = useCallback(() => {
    if (!audioContextRef.current) {
        padAnimationRef.current = 0;
        return;
    }
    const now = audioContextRef.current.currentTime;

    padPlaybackQueueRef.current = padPlaybackQueueRef.current.filter(item => {
        const itemEndTime = item.scheduledStartTime + (item.chop.end - item.chop.start);
        return now < itemEndTime;
    });

    let currentlyPlaying = null;
    for (let i = padPlaybackQueueRef.current.length - 1; i >= 0; i--) {
        const item = padPlaybackQueueRef.current[i];
        if (now >= item.scheduledStartTime) {
            currentlyPlaying = item;
            break;
        }
    }

    if (currentlyPlaying) {
        const elapsed = now - currentlyPlaying.scheduledStartTime;
        setPadPlayheadPosition(currentlyPlaying.chop.start + elapsed);
        setPadPlayheadSampleType(currentlyPlaying.sampleType);
    } else {
        setPadPlayheadPosition(-1);
        setPadPlayheadSampleType(null);
    }

    if (padPlaybackQueueRef.current.length > 0) {
        padAnimationRef.current = requestAnimationFrame(padAnimate);
    } else {
        padAnimationRef.current = 0;
        setPadPlayheadPosition(-1);
        setPadPlayheadSampleType(null);
    }
  }, []);

  const playNextInDrumSequence = useCallback(() => {
    if (!isPlayingRef.current || !drumSample || !audioContextRef.current) return;
    
    const audioCtx = audioContextRef.current;
    let chopToPlay: Chop | null = null;
    let sequence: number[] = [];

    if (drumLoopMode === 'chop') {
        sequence = drumLoopSequence.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(n => !isNaN(n) && n >= 0 && n < 8);
        if (sequence.length === 0) return;
        const chopIndex = sequence[drumLoopIndexRef.current];
        chopToPlay = drumSample.chops[chopIndex];
    } else { // 'full' mode
        chopToPlay = { id: -1, start: 0, end: drumSample.buffer.duration };
    }

    if (!chopToPlay) return;

    const source = audioCtx.createBufferSource();
    source.buffer = drumSample.buffer;
    source.detune.value = drumSemitones * 100;

    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(drumVolume / 100, audioCtx.currentTime);
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    drumCurrentLoopSourceRef.current = source;
    drumLoopStartTimeRef.current = audioCtx.currentTime;
    currentDrumLoopChopRef.current = chopToPlay;

    source.onended = () => {
        if (isPlayingRef.current && drumCurrentLoopSourceRef.current === source) {
            playNextInDrumSequence();
        }
    };

    source.start(audioCtx.currentTime, chopToPlay.start, chopToPlay.end - chopToPlay.start);
    
    if (drumLoopMode === 'chop' && sequence.length > 0) {
        drumLoopIndexRef.current = (drumLoopIndexRef.current + 1) % sequence.length;
    }
  }, [drumSample, drumLoopMode, drumLoopSequence, drumSemitones, drumVolume]);

  const playNextInMelodySequence = useCallback(() => {
    if (!isPlayingRef.current || !melodicSample || !audioContextRef.current) return;
    
    const audioCtx = audioContextRef.current;
    let chopToPlay: Chop | null = null;
    let sequence: number[] = [];

    if (melodyLoopMode === 'chop') {
        sequence = melodyLoopSequence.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(n => !isNaN(n) && n >= 0 && n < 8);
        if (sequence.length === 0) return;
        const chopIndex = sequence[melodyLoopIndexRef.current];
        chopToPlay = melodicSample.chops[chopIndex];
    } else { // 'full' mode
        chopToPlay = { id: -1, start: 0, end: melodicSample.buffer.duration };
    }

    if (!chopToPlay) return;

    const source = audioCtx.createBufferSource();
    source.buffer = melodicSample.buffer;
    source.detune.value = melodicSemitones * 100;

    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(melodicVolume / 100, audioCtx.currentTime);
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    melodyCurrentLoopSourceRef.current = source;
    melodyLoopStartTimeRef.current = audioCtx.currentTime;
    currentMelodyLoopChopRef.current = chopToPlay;

    source.onended = () => {
        if (isPlayingRef.current && melodyCurrentLoopSourceRef.current === source) {
            playNextInMelodySequence();
        }
    };

    source.start(audioCtx.currentTime, chopToPlay.start, chopToPlay.end - chopToPlay.start);
    
    if (melodyLoopMode === 'chop' && sequence.length > 0) {
        melodyLoopIndexRef.current = (melodyLoopIndexRef.current + 1) % sequence.length;
    }
  }, [melodicSample, melodyLoopMode, melodyLoopSequence, melodicSemitones, melodicVolume]);

  const mainAnimate = useCallback(() => {
    if (!isPlayingRef.current || !audioContextRef.current) return;
    const now = audioContextRef.current.currentTime;

    if (drumCurrentLoopSourceRef.current && currentDrumLoopChopRef.current) {
        const chop = currentDrumLoopChopRef.current;
        const duration = chop.end - chop.start;
        const elapsed = (now - drumLoopStartTimeRef.current);
        if (elapsed < duration) {
            setDrumLoopPlayhead(chop.start + elapsed);
        }
    } else {
        setDrumLoopPlayhead(-1);
    }

    if (melodyCurrentLoopSourceRef.current && currentMelodyLoopChopRef.current) {
        const chop = currentMelodyLoopChopRef.current;
        const duration = chop.end - chop.start;
        const elapsed = (now - melodyLoopStartTimeRef.current);
        if (elapsed < duration) {
            setMelodyLoopPlayhead(chop.start + elapsed);
        }
    } else {
        setMelodyLoopPlayhead(-1);
    }
    
    mainAnimationRef.current = requestAnimationFrame(mainAnimate);
  }, []);

  const handleStop = useCallback(() => {
    if (!isPlayingRef.current) return;
    
    isPlayingRef.current = false;
    setIsPlaying(false);

    if (drumCurrentLoopSourceRef.current) {
        drumCurrentLoopSourceRef.current.onended = null;
        try { drumCurrentLoopSourceRef.current.stop(); } catch(e) {}
        drumCurrentLoopSourceRef.current = null;
    }
    if (melodyCurrentLoopSourceRef.current) {
        melodyCurrentLoopSourceRef.current.onended = null;
        try { melodyCurrentLoopSourceRef.current.stop(); } catch(e) {}
        melodyCurrentLoopSourceRef.current = null;
    }
    
    if (mainAnimationRef.current !== 0) {
        cancelAnimationFrame(mainAnimationRef.current);
        mainAnimationRef.current = 0;
    }
    
    stopPadAnimations();
    setDrumLoopPlayhead(-1);
    setMelodyLoopPlayhead(-1);
  }, [stopPadAnimations]);

  const handlePlay = useCallback(() => {
    if (isPlayingRef.current) return;
    if (!drumSample && !melodicSample) return;

    initializeAudioContext();
    stopPadAnimations();
    
    isPlayingRef.current = true;
    setIsPlaying(true);

    drumLoopIndexRef.current = 0;
    melodyLoopIndexRef.current = 0;

    playNextInDrumSequence();
    playNextInMelodySequence();
    mainAnimationRef.current = requestAnimationFrame(mainAnimate);
  }, [drumSample, melodicSample, stopPadAnimations, playNextInDrumSequence, playNextInMelodySequence, mainAnimate, initializeAudioContext]);

  const triggerPad = useCallback((padIndex: number) => {
    if (!audioContextRef.current) initializeAudioContext();
    const audioCtx = audioContextRef.current;
    if (!audioCtx) return;

    if (isPlayingRef.current) handleStop();

    const isDrumPad = padIndex < 8;
    const sample = isDrumPad ? drumSample : melodicSample;
    const chopIndex = isDrumPad ? padIndex : padIndex - 8;

    if (!sample || !sample.chops[chopIndex]) return;

    const chop = sample.chops[chopIndex];
    const padId: PadId = `pad-${padIndex}`;

    const source = audioCtx.createBufferSource();
    source.buffer = sample.buffer;
    
    const semitones = isDrumPad ? drumSemitones : melodicSemitones;
    source.detune.value = semitones * 100;

    const gainNode = audioCtx.createGain();
    const volume = isDrumPad ? drumVolume : melodicVolume;
    gainNode.gain.setValueAtTime(volume / 100, audioCtx.currentTime);
    
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const getQuantizedStartTime = () => {
        if (!isQuantized || transportStartTimeRef.current === 0) return audioCtx.currentTime;
        const sixteenthNoteDuration = 60 / bpm / 4;
        const currentTimeInBeat = (audioCtx.currentTime - transportStartTimeRef.current) / sixteenthNoteDuration;
        const nextQuantizedStep = Math.ceil(currentTimeInBeat);
        return transportStartTimeRef.current + nextQuantizedStep * sixteenthNoteDuration;
    };

    if (isDrumPad) {
        const chopDuration = chop.end - chop.start;
        let startTime: number;
        const isStitchActive = drumStitchSequenceEndTime.current > audioCtx.currentTime;

        if (isStitchActive) {
            startTime = drumStitchSequenceEndTime.current;
            drumStitchSequenceEndTime.current += chopDuration;
        } else {
            playingSourcesRef.current.forEach((s, pId) => { if (parseInt(pId.split('-')[1], 10) < 8) try { s.stop(); } catch(e) {} });
            padPlaybackQueueRef.current = [];
            startTime = getQuantizedStartTime();
            drumStitchSequenceEndTime.current = startTime + chopDuration;
        }
        
        padPlaybackQueueRef.current.push({ padId, sampleType: SampleType.DRUMS, chop, scheduledStartTime: startTime });
        source.start(startTime, chop.start, chopDuration);
    } else {
        playingSourcesRef.current.forEach((s, pId) => { if (parseInt(pId.split('-')[1], 10) >= 8) try { s.stop(); } catch(e) {} });
        padPlaybackQueueRef.current = padPlaybackQueueRef.current.filter(item => item.sampleType !== SampleType.MELODIC);
        const startTime = getQuantizedStartTime();
        padPlaybackQueueRef.current.push({ padId, sampleType: SampleType.MELODIC, chop, scheduledStartTime: startTime });
        source.start(startTime, chop.start, chop.end - chop.start);
    }

    if (padAnimationRef.current === 0) {
        padAnimate();
    }

    playingSourcesRef.current.set(padId, source);
    setActivePads(prev => new Set(prev).add(padId));
    source.onended = () => {
      setActivePads(prev => {
        const newSet = new Set(prev);
        newSet.delete(padId);
        return newSet;
      });
      if (playingSourcesRef.current.get(padId) === source) {
          playingSourcesRef.current.delete(padId);
      }
    };
  }, [drumSample, melodicSample, isQuantized, bpm, initializeAudioContext, drumVolume, melodicVolume, drumSemitones, melodicSemitones, padAnimate, handleStop]);

  const handleReset = () => {
    handleStop();
    playingSourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    playingSourcesRef.current.clear();
    setActivePads(new Set());
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) {
        return;
      }
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (PAD_KEY_MAP[key]) {
        event.preventDefault();
        const padId = PAD_KEY_MAP[key];
        const padIndex = parseInt(padId.split('-')[1], 10);
        triggerPad(padIndex);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerPad]);

  useEffect(() => {
    initializeAudioContext();
    if (audioContextRef.current) {
        transportStartTimeRef.current = audioContextRef.current.currentTime;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drumPlayhead = isPlaying ? drumLoopPlayhead : (padPlayheadSampleType === SampleType.DRUMS ? padPlayheadPosition : -1);
  const melodyPlayhead = isPlaying ? melodyLoopPlayhead : (padPlayheadSampleType === SampleType.MELODIC ? padPlayheadPosition : -1);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center justify-center p-2 sm:p-4 font-sans">
      <main className="w-full max-w-4xl mx-auto flex flex-col gap-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
          Auto Sample Chopper
        </h1>
        
        <div className="flex flex-col gap-2">
            <WaveformDisplay 
              title="Drums"
              sample={drumSample} 
              playheadPosition={drumPlayhead}
              className="h-28"
              onClick={() => {}}
              isSelected={true}
            />
            <WaveformDisplay 
              title="Melody"
              sample={melodicSample} 
              playheadPosition={melodyPlayhead}
              className="h-28"
              onClick={() => {}}
              isSelected={true}
            />
        </div>

        <Controls
          onFileUpload={handleFileUpload}
          onPlay={handlePlay}
          onStop={handleStop}
          onReset={handleReset}
          isPlaying={isPlaying}
          isLoading={isLoading}
          bpm={bpm}
          setBpm={setBpm}
          isQuantized={isQuantized}
          setQuantized={setQuantized}
          hasSamples={!!drumSample || !!melodicSample}
          drumVolume={drumVolume}
          setDrumVolume={setDrumVolume}
          melodicVolume={melodicVolume}
          setMelodicVolume={setMelodicVolume}
          drumSemitones={drumSemitones}
          setDrumSemitones={setDrumSemitones}
          melodicSemitones={melodicSemitones}
          setMelodicSemitones={setMelodicSemitones}
          drumLoopMode={drumLoopMode}
          setDrumLoopMode={setDrumLoopMode}
          melodyLoopMode={melodyLoopMode}
          setMelodyLoopMode={setMelodyLoopMode}
          drumLoopSequence={drumLoopSequence}
          setDrumLoopSequence={setDrumLoopSequence}
          melodyLoopSequence={melodyLoopSequence}
          setMelodyLoopSequence={setMelodyLoopSequence}
          drumSampleLoaded={!!drumSample}
          melodicSampleLoaded={!!melodicSample}
        />

        <PadGrid onPadClick={triggerPad} activePads={activePads} />
        
        <footer className="text-center text-xs text-gray-500 mt-4">
          <p>Load a drum break and a melodic sample. The top 8 pads are for drums, bottom 8 for melody.</p>
          <p>Use keys 1-4, Q-R, A-F, Z-V to trigger pads.</p>
        </footer>
      </main>
    </div>
  );
};

export default App;
