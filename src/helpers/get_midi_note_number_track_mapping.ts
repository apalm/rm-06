import { Track, Sample } from "../types";

export function get_midi_note_number_mapping(
  midi_note_number_map,
  tracks: Array<Track>,
  samples: { [id: string]: Sample }
) {
  // If available, use the note number from General MIDI Level 2.
  // Otherwise:
  // 1) Start at the min note number used by General MIDI Level 2,
  // 26, subtract 1, and go down to 0.
  // 2) Start at the max note number used by General MIDI Level 2,
  // 88, add 1, and go up to 127.

  const mapping = {};

  function get_available_note_number() {
    // Start at min note number used by General MIDI Level 2.
    const min_used_note_number = Math.min(
      27,
      ...Object.keys(mapping).map(x => parseInt(x))
    );
    // Start at max note number used by General MIDI Level 2.
    const max_used_note_number = Math.max(
      87,
      ...Object.keys(mapping).map(x => parseInt(x))
    );

    if (min_used_note_number > 0) {
      return min_used_note_number - 1;
    }

    if (max_used_note_number < 127) {
      return max_used_note_number + 1;
    }

    throw new Error("No available MIDI note number");
  }

  // TODO - currently, has different results for different track orderings.
  for (let track of tracks) {
    const sample_id = track.sample_id;
    const sample_kind = samples[sample_id].kind;

    const note_numbers = midi_note_number_map[sample_kind];
    if (Array.isArray(note_numbers)) {
      const min_used_index = note_numbers.findIndex(i => !mapping[i]);
      if (min_used_index === -1) {
        const note_number = get_available_note_number();
        mapping[note_number] = track;
      } else {
        const note_number = note_numbers[min_used_index];
        mapping[note_number] = track;
      }
    } else {
      if (mapping[note_numbers]) {
        const note_number = get_available_note_number();
        mapping[note_number] = track;
      } else {
        mapping[note_numbers] = track;
      }
    }
  }

  return mapping;
}
