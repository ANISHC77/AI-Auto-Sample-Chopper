
export enum SampleType {
  MELODIC = 'melodic',
  DRUMS = 'drums',
}

export interface Chop {
  id: number;
  start: number;
  end: number;
}

export interface Sample {
  file: File;
  buffer: AudioBuffer;
  chops: Chop[];
}

export type PadId = `pad-${number}`;
