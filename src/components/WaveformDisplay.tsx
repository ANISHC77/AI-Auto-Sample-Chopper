
import React, { useRef, useEffect } from 'react';
import { Sample, Chop } from '../types';

interface WaveformDisplayProps {
  sample: Sample | null;
  playheadPosition: number; // in seconds
  className?: string;
  title: string;
  onClick: () => void;
  isSelected: boolean;
}

const drawWaveform = (
  ctx: CanvasRenderingContext2D,
  buffer: AudioBuffer,
  chops: Chop[],
  width: number,
  height: number,
  playheadPosition: number
) => {
  ctx.clearRect(0, 0, width, height);
  
  const data = buffer.getChannelData(0);
  const step = Math.ceil(data.length / width);
  const amp = height / 2;

  // Draw waveform
  ctx.strokeStyle = '#60a5fa'; // blue-400
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, amp);
  for (let i = 0; i < width; i++) {
    let min = 1.0;
    let max = -1.0;
    for (let j = 0; j < step; j++) {
      const datum = data[i * step + j];
      if (datum < min) min = datum;
      if (datum > max) max = datum;
    }
    ctx.moveTo(i, (1 + min) * amp);
    ctx.lineTo(i, (1 + max) * amp);
  }
  ctx.stroke();

  // Draw chop markers
  ctx.strokeStyle = '#f87171'; // red-400
  ctx.lineWidth = 1;
  chops.forEach(chop => {
    const x = (chop.start / buffer.duration) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  });

  // Draw playhead
  if (playheadPosition >= 0) {
    const playheadX = (playheadPosition / buffer.duration) * width;
    ctx.strokeStyle = '#f59e0b'; // amber-500
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
  }
};

const WaveformDisplay: React.FC<WaveformDisplayProps> = ({ sample, playheadPosition, className, title, onClick, isSelected }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas?.getContext('2d');
    
    const resizeCanvas = () => {
        if (canvas && container && ctx) {
            const dpr = window.devicePixelRatio || 1;
            const rect = container.getBoundingClientRect();
            const displayHeight = rect.height - 30; // Adjust for title height
            
            canvas.width = rect.width * dpr;
            canvas.height = displayHeight * dpr;
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${displayHeight}px`;
            ctx.scale(dpr, dpr);

            if (sample) {
                drawWaveform(ctx, sample.buffer, sample.chops, rect.width, displayHeight, playheadPosition);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    resizeCanvas();
    
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);

  }, [sample, playheadPosition, isSelected]);

  const borderClass = isSelected ? 'border-2 border-amber-500' : 'border-2 border-gray-700';

  return (
    <div ref={containerRef} className={`bg-gray-800 rounded-lg p-2 transition-all ${className} ${borderClass}`} onClick={onClick}>
      <div className="flex justify-between items-center mb-1 h-[22px] overflow-hidden">
          <h3 className="text-sm font-bold text-gray-400">{title}</h3>
          {sample && <span className="text-xs text-gray-500 truncate">{sample.file.name}</span>}
      </div>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default WaveformDisplay;
