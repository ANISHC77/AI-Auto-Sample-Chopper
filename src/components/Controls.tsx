
import React, { useRef } from 'react';
import { SampleType } from '../types';
import { PlayIcon, StopIcon, ResetIcon, UploadIcon, LoadingSpinner } from './icons';

interface ControlsProps {
  onFileUpload: (file: File, type: SampleType) => void;
  onPlay: () => void;
  onStop: () => void;
  onReset: () => void;
  isPlaying: boolean;
  isLoading: { [key in SampleType]: boolean };
  bpm: number;
  setBpm: (bpm: number) => void;
  isQuantized: boolean;
  setQuantized: (quantized: boolean) => void;
  hasSamples: boolean;
  drumVolume: number;
  setDrumVolume: (volume: number) => void;
  melodicVolume: number;
  setMelodicVolume: (volume: number) => void;
  drumSemitones: number;
  setDrumSemitones: (semitones: number) => void;
  melodicSemitones: number;
  setMelodicSemitones: (semitones: number) => void;
  drumLoopMode: 'full' | 'chop';
  setDrumLoopMode: (mode: 'full' | 'chop') => void;
  melodyLoopMode: 'full' | 'chop';
  setMelodyLoopMode: (mode: 'full' | 'chop') => void;
  drumLoopSequence: string;
  setDrumLoopSequence: (sequence: string) => void;
  melodyLoopSequence: string;
  setMelodyLoopSequence: (sequence: string) => void;
  drumSampleLoaded: boolean;
  melodicSampleLoaded: boolean;
}

const FileInput: React.FC<{
  type: SampleType;
  onFileUpload: (file: File, type: SampleType) => void;
  isLoading: boolean;
  label: string;
}> = ({ type, onFileUpload, isLoading, label }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onFileUpload(event.target.files[0], type);
    }
  };

  return (
    <div className="flex-1">
      <input
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        ref={inputRef}
        className="hidden"
        id={`file-upload-${type}`}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-600 rounded-md text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? <LoadingSpinner className="w-5 h-5" /> : <UploadIcon className="w-5 h-5" />}
        <span>{isLoading ? 'Analyzing...' : label}</span>
      </button>
    </div>
  );
};

const VolumeControl: React.FC<{
    label: string;
    volume: number;
    setVolume: (volume: number) => void;
}> = ({ label, volume, setVolume }) => (
    <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-400 w-16">{label}</label>
        <input
            type="range"
            min="0"
            max="120"
            value={volume}
            onChange={(e) => setVolume(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
        />
        <span className="text-sm text-gray-300 w-10 text-center">{volume}%</span>
    </div>
);

const PitchControl: React.FC<{
    label: string;
    semitones: number;
    setSemitones: (semitones: number) => void;
}> = ({ label, semitones, setSemitones }) => (
    <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-400 w-16">{label}</label>
        <input
            type="range"
            min="-12"
            max="12"
            step="1"
            value={semitones}
            onChange={(e) => setSemitones(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
        />
        <span className="text-sm text-gray-300 w-10 text-center">{semitones > 0 ? '+' : ''}{semitones}</span>
    </div>
);

const SampleLoopControls: React.FC<{
    sampleLoaded: boolean;
    loopMode: 'full' | 'chop';
    setLoopMode: (mode: 'full' | 'chop') => void;
    loopSequence: string;
    setLoopSequence: (sequence: string) => void;
}> = ({ sampleLoaded, loopMode, setLoopMode, loopSequence, setLoopSequence }) => {
    return (
        <div className="space-y-2 p-2 border border-gray-700 rounded-lg">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-300">Loop Mode</h4>
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${loopMode === 'full' ? 'text-white' : 'text-gray-500'}`}>Full</span>
                    <button
                        onClick={() => setLoopMode(loopMode === 'full' ? 'chop' : 'full')}
                        disabled={!sampleLoaded}
                        className={`relative inline-flex items-center h-5 w-9 transition-colors rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:opacity-50 ${loopMode === 'chop' ? 'bg-blue-600' : 'bg-gray-600'}`}
                    >
                        <span className={`inline-block w-3 h-3 transform bg-white rounded-full transition-transform ${loopMode === 'chop' ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                    <span className={`text-xs font-medium ${loopMode === 'chop' ? 'text-white' : 'text-gray-500'}`}>Chop</span>
                </div>
            </div>
            <div className={`flex items-center gap-2 transition-opacity ${loopMode === 'full' || !sampleLoaded ? 'opacity-50' : 'opacity-100'}`}>
                <label className="text-sm font-medium text-gray-400">Sequence:</label>
                <input
                    type="text"
                    value={loopSequence}
                    onChange={(e) => {
                        const sanitized = e.target.value.replace(/[^1-8, ]/g, '');
                        setLoopSequence(sanitized);
                    }}
                    disabled={loopMode === 'full' || !sampleLoaded}
                    placeholder="e.g. 1, 4, 5"
                    className="w-full bg-gray-700 border border-gray-600 rounded-md text-sm text-white focus:ring-blue-500 focus:border-blue-500 p-1"
                />
            </div>
        </div>
    );
};


const Controls: React.FC<ControlsProps> = (props) => {
  const {
    onFileUpload, onPlay, onStop, onReset, isPlaying, isLoading, bpm, setBpm, isQuantized, setQuantized, hasSamples,
    drumVolume, setDrumVolume, melodicVolume, setMelodicVolume,
    drumSemitones, setDrumSemitones, melodicSemitones, setMelodicSemitones,
    drumLoopMode, setDrumLoopMode, melodyLoopMode, setMelodyLoopMode,
    drumLoopSequence, setDrumLoopSequence, melodyLoopSequence, setMelodyLoopSequence,
    drumSampleLoaded, melodicSampleLoaded
  } = props;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <FileInput type={SampleType.DRUMS} onFileUpload={onFileUpload} isLoading={isLoading.drums} label="Load Drums" />
        <FileInput type={SampleType.MELODIC} onFileUpload={onFileUpload} isLoading={isLoading.melodic} label="Load Melody" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
          <h3 className="text-center font-bold text-blue-400">DRUM CONTROLS</h3>
          <VolumeControl label="Volume" volume={drumVolume} setVolume={setDrumVolume} />
          <PitchControl label="Pitch" semitones={drumSemitones} setSemitones={setDrumSemitones} />
          <SampleLoopControls
            sampleLoaded={drumSampleLoaded}
            loopMode={drumLoopMode}
            setLoopMode={setDrumLoopMode}
            loopSequence={drumLoopSequence}
            setLoopSequence={setDrumLoopSequence}
          />
        </div>
        <div className="space-y-2 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
          <h3 className="text-center font-bold text-purple-400">MELODY CONTROLS</h3>
          <VolumeControl label="Volume" volume={melodicVolume} setVolume={setMelodicVolume} />
          <PitchControl label="Pitch" semitones={melodicSemitones} setSemitones={setMelodicSemitones} />
          <SampleLoopControls
            sampleLoaded={melodicSampleLoaded}
            loopMode={melodyLoopMode}
            setLoopMode={setMelodyLoopMode}
            loopSequence={melodyLoopSequence}
            setLoopSequence={setMelodyLoopSequence}
          />
        </div>
      </div>

      <div className="p-4 bg-gray-800/50 rounded-lg space-y-4 border border-gray-700">
        <div className="flex gap-2 sm:gap-4">
            <button onClick={onPlay} disabled={!hasSamples || isPlaying} className="control-btn flex-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed p-2 rounded-md flex justify-center items-center"><PlayIcon /></button>
            <button onClick={onStop} disabled={!isPlaying} className="control-btn flex-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed p-2 rounded-md flex justify-center items-center"><StopIcon /></button>
            <button onClick={onReset} disabled={!hasSamples} className="control-btn flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed p-2 rounded-md flex justify-center items-center"><ResetIcon /></button>
        </div>
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
                <label htmlFor="bpm" className="text-sm font-medium text-gray-400">BPM</label>
                <input
                    type="number"
                    id="bpm"
                    value={bpm}
                    onChange={(e) => setBpm(Math.max(40, Math.min(300, parseInt(e.target.value, 10) || 120)))}
                    className="w-20 bg-gray-700 border border-gray-600 rounded-md text-center text-white focus:ring-blue-500 focus:border-blue-500"
                />
            </div>
            <div className="flex items-center gap-2">
                <label htmlFor="quantize" className="text-sm font-medium text-gray-400">Quantize</label>
                <button
                    onClick={() => setQuantized(!isQuantized)}
                    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 ${isQuantized ? 'bg-blue-600' : 'bg-gray-600'}`}
                >
                    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isQuantized ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Controls;
