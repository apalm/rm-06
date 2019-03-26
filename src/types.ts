export type Track = {
  id: string;
  name: string;
  sample_id: string;
  quantize: number;
  volume: number;
  pan: number;
  pitch: number;
  solo: boolean;
  mute: boolean;
};

export type Note = {
  start: number;
  velocity: number;
  track_id: string;
};

export type Sample = {
  id: string;
  kind: string;
  path: string;
  sample: AudioBuffer | null;
};
