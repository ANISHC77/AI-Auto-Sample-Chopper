
import React from 'react';
import SamplePad from './SamplePad';
import { PadId } from '../types';

interface PadGridProps {
  onPadClick: (padIndex: number) => void;
  activePads: Set<PadId>;
}

const PadGrid: React.FC<PadGridProps> = ({ onPadClick, activePads }) => {
  const drumColor = 'bg-blue-800 hover:bg-blue-700';
  const drumGlow = '#2563eb'; // blue-600
  const melodicColor = 'bg-purple-800 hover:bg-purple-700';
  const melodicGlow = '#7e22ce'; // purple-700

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-4 p-4 bg-gray-900/50 rounded-lg w-full max-w-md aspect-square mx-auto">
      {Array.from({ length: 16 }).map((_, i) => {
        const padId: PadId = `pad-${i}`;
        const isDrumPad = i < 8;
        return (
          <SamplePad
            key={i}
            padId={padId}
            onClick={() => onPadClick(i)}
            isActive={activePads.has(padId)}
            color={isDrumPad ? drumColor : melodicColor}
            glowColor={isDrumPad ? drumGlow : melodicGlow}
          />
        );
      })}
    </div>
  );
};

export default PadGrid;
