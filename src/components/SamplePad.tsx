
import React from 'react';

interface SamplePadProps {
  padId: string;
  onClick: () => void;
  isActive: boolean;
  color: string;
  glowColor: string;
}

const SamplePad: React.FC<SamplePadProps> = ({ padId, onClick, isActive, color, glowColor }) => {
  const activeClass = isActive ? 'pad-active' : '';
  
  return (
    <button
      id={padId}
      onClick={onClick}
      className={`aspect-square rounded-lg transition-all duration-100 focus:outline-none ${color} ${activeClass}`}
      style={{ '--pad-glow-color': glowColor } as React.CSSProperties}
      aria-pressed={isActive}
    />
  );
};

export default SamplePad;
