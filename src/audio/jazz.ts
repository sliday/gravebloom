// Web Audio SoundFont & Chiptune Jazz MIDI Synthesizer Engine
// Powered by General MIDI SoundFonts (sampled electric piano, acoustic bass, tenor sax) with procedural fallback.

import { Soundfont } from 'smplr';

interface JazzTrack {
  id: string;
  title: string;
  bpm: number;
  timeSignature: number;
  bars: {
    chords: number[][];
    bass: number[];
    melody?: (number | null)[];
  }[];
}

function freqToMidi(freq: number): number {
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

// Note frequencies (Hz)
const N = {
  // Octave 2
  C2: 65.41, Db2: 69.3, D2: 73.42, Eb2: 77.78, E2: 82.41, F2: 87.31, Fs2: 92.5, G2: 98.0, Ab2: 103.83, A2: 110.0, Bb2: 116.54, B2: 123.47,
  // Octave 3
  C3: 130.81, Db3: 138.59, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, Fs3: 185.0, G3: 196.0, Ab3: 207.65, A3: 220.0, Bb3: 233.08, B3: 246.94,
  // Octave 4
  C4: 261.63, Db4: 277.18, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.0, Ab4: 415.3, A4: 440.0, Bb4: 466.16, B4: 493.88,
  // Octave 5
  C5: 523.25, Db5: 554.37, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, G5: 783.99, Ab5: 830.61, A5: 880.0, Bb5: 932.33, B5: 987.77,
  C6: 1046.5
};

const JAZZ_TRACKS: JazzTrack[] = [
  // Track 1: Autumn Leaves (Medium Swing, ii-V-I progressions)
  {
    id: 'autumn-leaves',
    title: 'Autumn Leaves',
    bpm: 126,
    timeSignature: 4,
    bars: [
      {
        chords: [[N.C3, N.Eb3, N.G3, N.Bb3]], // Cm7
        bass: [N.C2, N.Eb2, N.G2, N.Ab2],
        melody: [N.G4, null, N.A4, null, N.Bb4, null, N.C5, null]
      },
      {
        chords: [[N.F2, N.A2, N.C3, N.Eb3]], // F7
        bass: [N.F2, N.A2, N.C3, N.D3],
        melody: [N.D5, null, null, null, null, null, null, null]
      },
      {
        chords: [[N.Bb2, N.D3, N.F3, N.A3]], // Bbmaj7
        bass: [N.Bb2, N.D3, N.F3, N.G3],
        melody: [N.F4, null, N.G4, null, N.A4, null, N.Bb4, null]
      },
      {
        chords: [[N.Eb3, N.G3, N.Bb3, N.D4]], // Ebmaj7
        bass: [N.Eb2, N.G2, N.Bb2, N.C3],
        melody: [N.C5, null, null, null, null, null, null, null]
      },
      {
        chords: [[N.A2, N.C3, N.Eb3, N.G3]], // Am7b5
        bass: [N.A2, N.C3, N.Eb3, N.F3],
        melody: [N.Eb4, null, N.F4, null, N.G4, null, N.A4, null]
      },
      {
        chords: [[N.D3, N.Fs3, N.A3, N.C4]], // D7
        bass: [N.D2, N.Fs2, N.A2, N.Bb2],
        melody: [N.Bb4, null, null, null, null, null, null, null]
      },
      {
        chords: [[N.G2, N.Bb2, N.D3, N.F3]], // Gm7
        bass: [N.G2, N.Bb2, N.D3, N.F3],
        melody: [N.G4, null, null, null, N.A4, null, N.Bb4, null]
      },
      {
        chords: [[N.G2, N.Bb2, N.D3, N.F3]], // Gm7 (turnaround)
        bass: [N.G2, N.D3, N.Db3, N.C3],
        melody: [N.G4, null, null, null, null, null, null, null]
      }
    ]
  },

  // Track 2: Take Five (Iconic 5/4 Cool Jazz Groove)
  {
    id: 'take-five',
    title: 'Take Five',
    bpm: 148,
    timeSignature: 5,
    bars: [
      {
        chords: [[N.Eb3, N.Fs3, N.Bb3, N.Db4]], // Ebm7
        bass: [N.Eb2, N.Bb2, N.Eb3, N.Bb2, N.C3],
        melody: [N.Bb4, null, N.Ab4, N.Fs4, N.Eb4, null, N.F4, null, N.Fs4, null]
      },
      {
        chords: [[N.Bb2, N.D3, N.F3, N.Ab3]], // Bbm7
        bass: [N.Bb2, N.F3, N.Ab2, N.F2, N.D2],
        melody: [N.F4, null, N.Eb4, null, N.Db4, null, null, null, null, null]
      },
      {
        chords: [[N.Eb3, N.Fs3, N.Bb3, N.Db4]], // Ebm7
        bass: [N.Eb2, N.Bb2, N.Eb3, N.Bb2, N.C3],
        melody: [N.Bb4, null, N.C5, null, N.Bb4, null, N.Ab4, null, N.Fs4, null]
      },
      {
        chords: [[N.Bb2, N.D3, N.F3, N.Ab3]], // Bbm7
        bass: [N.Bb2, N.F3, N.Ab2, N.F2, N.D2],
        melody: [N.Ab4, null, N.Fs4, null, N.F4, null, N.Eb4, null, null, null]
      }
    ]
  },

  // Track 3: Blue Bossa (Latin Bossa Nova Jazz)
  {
    id: 'blue-bossa',
    title: 'Blue Bossa',
    bpm: 132,
    timeSignature: 4,
    bars: [
      {
        chords: [[N.C3, N.Eb3, N.G3, N.Bb3]], // Cm7
        bass: [N.C2, N.G2, N.C3, N.Eb2],
        melody: [N.G4, null, N.C5, null, N.Bb4, null, N.Ab4, null]
      },
      {
        chords: [[N.C3, N.Eb3, N.G3, N.Bb3]], // Cm7
        bass: [N.C2, N.G2, N.C3, N.D3],
        melody: [N.G4, null, null, null, N.F4, null, N.Eb4, null]
      },
      {
        chords: [[N.F2, N.Ab2, N.C3, N.Eb3]], // Fm7
        bass: [N.F2, N.C3, N.F3, N.Ab2],
        melody: [N.F4, null, N.Bb4, null, N.Ab4, null, N.G4, null]
      },
      {
        chords: [[N.F2, N.Ab2, N.C3, N.Eb3]], // Fm7
        bass: [N.F2, N.C3, N.F2, N.G2],
        melody: [N.F4, null, null, null, N.Eb4, null, N.D4, null]
      },
      {
        chords: [[N.D3, N.F3, N.Ab3, N.C4]], // Dm7b5
        bass: [N.D2, N.Ab2, N.D3, N.F2],
        melody: [N.Eb4, null, N.Ab4, null, N.G4, null, N.F4, null]
      },
      {
        chords: [[N.G2, N.B2, N.D3, N.F3]], // G7
        bass: [N.G2, N.D3, N.B2, N.G2],
        melody: [N.D4, null, null, null, N.C4, null, N.B3, null]
      },
      {
        chords: [[N.C3, N.Eb3, N.G3, N.Bb3]], // Cm7
        bass: [N.C2, N.G2, N.C3, N.Eb3],
        melody: [N.C4, null, null, null, null, null, null, null]
      },
      {
        chords: [[N.C3, N.Eb3, N.G3, N.Bb3]], // Cm7
        bass: [N.C2, N.G2, N.D3, N.B2],
        melody: [N.C5, null, N.Bb4, null, N.Ab4, null, N.G4, null]
      }
    ]
  },

  // Track 4: Fly Me to the Moon (Medium Swing)
  {
    id: 'fly-me-to-the-moon',
    title: 'Fly Me to the Moon',
    bpm: 128,
    timeSignature: 4,
    bars: [
      {
        chords: [[N.A2, N.C3, N.E3, N.G3]], // Am7
        bass: [N.A2, N.C3, N.E3, N.G3],
        melody: [N.C5, null, N.B4, null, N.A4, null, N.G4, null]
      },
      {
        chords: [[N.D3, N.F3, N.A3, N.C4]], // Dm7
        bass: [N.D2, N.F2, N.A2, N.C3],
        melody: [N.F4, null, null, null, N.G4, null, N.A4, null]
      },
      {
        chords: [[N.G2, N.B2, N.D3, N.F3]], // G7
        bass: [N.G2, N.B2, N.D3, N.F3],
        melody: [N.C5, null, null, null, N.B4, null, N.A4, null]
      },
      {
        chords: [[N.C3, N.E3, N.G3, N.B3]], // Cmaj7
        bass: [N.C2, N.E2, N.G2, N.B2],
        melody: [N.G4, null, null, null, null, null, null, null]
      },
      {
        chords: [[N.F2, N.A2, N.C3, N.E3]], // Fmaj7
        bass: [N.F2, N.A2, N.C3, N.E3],
        melody: [N.A4, null, null, null, N.G4, null, N.F4, null]
      },
      {
        chords: [[N.B2, N.D3, N.F3, N.A3]], // Bm7b5
        bass: [N.B2, N.D3, N.F3, N.Ab2],
        melody: [N.E4, null, null, null, null, null, null, null]
      },
      {
        chords: [[N.E2, N.Ab2, N.B2, N.D3]], // E7
        bass: [N.E2, N.Ab2, N.B2, N.D3],
        melody: [N.F4, null, null, null, N.E4, null, N.D4, null]
      },
      {
        chords: [[N.A2, N.C3, N.E3, N.G3]], // Am7
        bass: [N.A2, N.E3, N.C3, N.Ab2],
        melody: [N.C4, null, null, null, null, null, null, null]
      }
    ]
  },

  // Track 5: Cantaloupe Island (Herbie Hancock - Modal Funk Jazz)
  {
    id: 'cantaloupe-island',
    title: 'Cantaloupe Island',
    bpm: 112,
    timeSignature: 4,
    bars: [
      {
        chords: [[N.F2, N.Ab2, N.C3, N.Eb3]], // Fm11
        bass: [N.F2, N.F2, N.Ab2, N.Bb2],
        melody: [N.C4, null, N.Eb4, null, N.F4, null, N.Ab4, null]
      },
      {
        chords: [[N.F2, N.Ab2, N.C3, N.Eb3]], // Fm11
        bass: [N.F2, N.C3, N.Eb2, N.F2],
        melody: [N.G4, null, N.F4, null, null, null, null, null]
      },
      {
        chords: [[N.Db3, N.F3, N.Ab3, N.B3]], // Db7
        bass: [N.Db2, N.Ab2, N.Db3, N.C3],
        melody: [N.F4, null, N.Ab4, null, N.Bb4, null, N.B4, null]
      },
      {
        chords: [[N.D3, N.F3, N.A3, N.C4]], // Dm11
        bass: [N.D2, N.A2, N.D3, N.Eb2],
        melody: [N.C5, null, N.A4, null, null, null, null, null]
      }
    ]
  },

  // Track 6: So What (Miles Davis - Cool Modal Jazz)
  {
    id: 'so-what',
    title: 'So What',
    bpm: 136,
    timeSignature: 4,
    bars: [
      {
        chords: [[N.D3, N.G3, N.C4, N.F4, N.A4]], // D Dorian
        bass: [N.D2, N.A2, N.D3, N.C3],
        melody: [null, null, null, null, N.E4, N.G4, N.A4, null]
      },
      {
        chords: [[N.E3, N.A3, N.D4, N.G4, N.B4]], // D Dorian modal chord
        bass: [N.D2, N.F2, N.G2, N.A2],
        melody: [null, null, N.B4, null, N.D5, null, null, null]
      },
      {
        chords: [[N.D3, N.G3, N.C4, N.F4, N.A4]], // D Dorian
        bass: [N.D2, N.A2, N.D3, N.C3],
        melody: [null, null, null, null, N.D4, N.F4, N.G4, null]
      },
      {
        chords: [[N.E3, N.A3, N.D4, N.G4, N.B4]],
        bass: [N.D2, N.G2, N.A2, N.C3],
        melody: [null, null, N.A4, null, N.C5, null, null, null]
      }
    ]
  },

  // Track 7: Moanin' (Art Blakey - Soul Jazz Blues)
  {
    id: 'moanin',
    title: "Moanin'",
    bpm: 124,
    timeSignature: 4,
    bars: [
      {
        chords: [[N.F2, N.Ab2, N.C3, N.Eb3]], // Fm7
        bass: [N.F2, N.C3, N.Eb2, N.F2],
        melody: [N.C4, null, N.Eb4, null, N.F4, null, null, null]
      },
      {
        chords: [[N.Bb2, N.D3, N.F3, N.Ab3]], // Bb7
        bass: [N.Bb2, N.F2, N.Ab2, N.Bb2],
        melody: [N.Ab4, null, N.F4, null, N.Eb4, null, N.C4, null]
      },
      {
        chords: [[N.F2, N.Ab2, N.C3, N.Eb3]], // Fm7
        bass: [N.F2, N.Ab2, N.Bb2, N.C3],
        melody: [N.F4, null, null, null, N.Ab4, null, N.Bb4, null]
      },
      {
        chords: [[N.C3, N.E3, N.G3, N.Bb3]], // C7
        bass: [N.C2, N.G2, N.Bb2, N.C3],
        melody: [N.C5, null, null, null, null, null, null, null]
      }
    ]
  },

  // Track 8: The Girl from Ipanema (Jobim - Classic Bossa)
  {
    id: 'girl-from-ipanema',
    title: 'The Girl from Ipanema',
    bpm: 124,
    timeSignature: 4,
    bars: [
      {
        chords: [[N.F2, N.A2, N.C3, N.E3]], // Fmaj7
        bass: [N.F2, N.C3, N.F2, N.C3],
        melody: [N.G4, null, N.E4, null, N.E4, null, N.D4, null]
      },
      {
        chords: [[N.F2, N.A2, N.C3, N.E3]], // Fmaj7
        bass: [N.F2, N.C3, N.F2, N.A2],
        melody: [N.G4, null, null, null, N.E4, null, N.D4, null]
      },
      {
        chords: [[N.G2, N.B2, N.D3, N.F3]], // G7
        bass: [N.G2, N.D3, N.G2, N.D3],
        melody: [N.A4, null, N.F4, null, N.F4, null, N.E4, null]
      },
      {
        chords: [[N.G2, N.B2, N.D3, N.F3]], // G7
        bass: [N.G2, N.D3, N.G2, N.B2],
        melody: [N.A4, null, null, null, N.F4, null, N.E4, null]
      }
    ]
  },

  // Track 9: Spain (Chick Corea - Latin Fusion Jazz)
  {
    id: 'spain',
    title: 'Spain',
    bpm: 142,
    timeSignature: 4,
    bars: [
      {
        chords: [[N.G2, N.B2, N.D3, N.Fs3]], // Gmaj7
        bass: [N.G2, N.D3, N.Fs2, N.G2],
        melody: [N.Fs4, null, N.G4, null, N.A4, null, N.B4, null]
      },
      {
        chords: [[N.Fs2, N.A2, N.C3, N.E3]], // F#7
        bass: [N.Fs2, N.Db3, N.E2, N.Fs2],
        melody: [N.Db5, null, N.B4, null, N.A4, null, N.G4, null]
      },
      {
        chords: [[N.E2, N.G2, N.B2, N.D3]], // Em7
        bass: [N.E2, N.B2, N.D2, N.E2],
        melody: [N.Fs4, null, N.E4, null, null, null, null, null]
      },
      {
        chords: [[N.A2, N.Db3, N.E3, N.G3]], // A7
        bass: [N.A2, N.E3, N.G2, N.A2],
        melody: [N.E4, null, N.Fs4, null, N.G4, null, N.A4, null]
      }
    ]
  }
];

class JazzMidiEngine {
  private ctx: AudioContext | null = null;
  private currentTrackIndex = Math.floor(Math.random() * JAZZ_TRACKS.length);
  public isPlaying = false;
  public isMuted = false;
  private volume = 0.25;

  private mainGain: GainNode | null = null;
  private schedulerTimer: number | null = null;
  private nextBarTime = 0;
  private currentBarIndex = 0;

  // SoundFont instruments
  private sfPiano: any = null;
  private sfBass: any = null;
  private sfLead: any = null;
  private soundfontsReady = false;

  public onTrackChange?: (trackTitle: string) => void;

  private initAudio(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.mainGain = this.ctx.createGain();
        this.mainGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
        this.mainGain.connect(this.ctx.destination);
        this.initSoundfonts();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private initSoundfonts(): void {
    if (!this.ctx || this.sfPiano) return;

    try {
      this.sfPiano = Soundfont(this.ctx, {
        instrument: 'electric_piano_1',
        destination: this.mainGain || this.ctx.destination,
        volume: 75
      });
      this.sfBass = Soundfont(this.ctx, {
        instrument: 'acoustic_bass',
        destination: this.mainGain || this.ctx.destination,
        volume: 85
      });
      this.sfLead = Soundfont(this.ctx, {
        instrument: 'tenor_sax',
        destination: this.mainGain || this.ctx.destination,
        volume: 80
      });

      Promise.all([this.sfPiano?.ready, this.sfBass?.ready, this.sfLead?.ready]).then(() => {
        this.soundfontsReady = true;
      }).catch(() => {
        // Fallback to procedural synth seamlessly
      });
    } catch {
      // Procedural synth acts as reliable fallback
    }
  }

  public getTrackTitle(): string {
    return JAZZ_TRACKS[this.currentTrackIndex]?.title || 'Jazz Standard';
  }

  public getTrackList(): { id: string; title: string }[] {
    return JAZZ_TRACKS.map((t) => ({ id: t.id, title: t.title }));
  }

  public togglePlay(): boolean {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
    return this.isPlaying;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.mainGain && this.ctx) {
      const targetGain = this.isMuted ? 0 : this.volume;
      this.mainGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  public play(): void {
    const ctx = this.initAudio();
    if (!ctx) return;

    if (this.isPlaying) return;
    this.isPlaying = true;

    this.nextBarTime = ctx.currentTime + 0.05;
    this.currentBarIndex = 0;

    if (this.onTrackChange) {
      this.onTrackChange(this.getTrackTitle());
    }

    this.startScheduler();
  }

  public pause(): void {
    this.isPlaying = false;
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  public nextTrack(): string {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % JAZZ_TRACKS.length;
    this.currentBarIndex = 0;
    const title = this.getTrackTitle();
    if (this.onTrackChange) this.onTrackChange(title);
    if (!this.isPlaying) this.play();
    return title;
  }

  public pickRandomTrack(): string {
    const prev = this.currentTrackIndex;
    let next = Math.floor(Math.random() * JAZZ_TRACKS.length);
    if (JAZZ_TRACKS.length > 1 && next === prev) {
      next = (next + 1) % JAZZ_TRACKS.length;
    }
    this.currentTrackIndex = next;
    this.currentBarIndex = 0;
    const title = this.getTrackTitle();
    if (this.onTrackChange) this.onTrackChange(title);
    return title;
  }

  public prevTrack(): string {
    this.currentTrackIndex = (this.currentTrackIndex - 1 + JAZZ_TRACKS.length) % JAZZ_TRACKS.length;
    this.currentBarIndex = 0;
    const title = this.getTrackTitle();
    if (this.onTrackChange) this.onTrackChange(title);
    if (!this.isPlaying) this.play();
    return title;
  }

  private startScheduler(): void {
    if (this.schedulerTimer !== null) clearInterval(this.schedulerTimer);

    this.schedulerTimer = window.setInterval(() => {
      if (!this.ctx || !this.isPlaying) return;

      while (this.nextBarTime < this.ctx.currentTime + 0.3) {
        this.scheduleBar(this.nextBarTime);
        const track = JAZZ_TRACKS[this.currentTrackIndex];
        const barDuration = (60 / track.bpm) * track.timeSignature;
        this.nextBarTime += barDuration;
        this.currentBarIndex = (this.currentBarIndex + 1) % track.bars.length;
      }
    }, 50);
  }

  private scheduleBar(startTime: number): void {
    if (!this.ctx || !this.mainGain) return;

    const track = JAZZ_TRACKS[this.currentTrackIndex];
    const bar = track.bars[this.currentBarIndex];
    if (!bar) return;

    const beatDuration = 60 / track.bpm;
    const subStepDuration = beatDuration / 2;

    // 1. Chords (SoundFont Electric Piano / Sampled Keys)
    if (bar.chords && bar.chords.length > 0) {
      const chord = bar.chords[0];
      const chordDuration = beatDuration * (track.timeSignature >= 5 ? 2.5 : 2.0);

      chord.forEach((freq) => {
        const midi = freqToMidi(freq);
        if (this.sfPiano && this.soundfontsReady) {
          try {
            this.sfPiano.start({ note: midi, time: startTime, duration: chordDuration, velocity: 75 });
            if (track.timeSignature === 4) {
              this.sfPiano.start({ note: midi, time: startTime + beatDuration * 2.5, duration: beatDuration * 1.2, velocity: 68 });
            }
          } catch {
            this.playJazzTone(freq, startTime, chordDuration, 'triangle', 0.045);
          }
        } else {
          this.playJazzTone(freq, startTime, chordDuration, 'triangle', 0.045);
          if (track.timeSignature === 4) {
            this.playJazzTone(freq, startTime + beatDuration * 2.5, beatDuration * 1.2, 'triangle', 0.038);
          }
        }
      });
    }

    // 2. Walking Bass (SoundFont Upright Acoustic Bass)
    if (bar.bass && bar.bass.length > 0) {
      bar.bass.forEach((freq, beatIndex) => {
        if (beatIndex < track.timeSignature) {
          const bassTime = startTime + beatIndex * beatDuration;
          const midi = freqToMidi(freq);

          if (this.sfBass && this.soundfontsReady) {
            try {
              this.sfBass.start({ note: midi, time: bassTime, duration: beatDuration * 0.88, velocity: 85 });
            } catch {
              this.playWalkingBass(freq, bassTime, beatDuration * 0.88);
            }
          } else {
            this.playWalkingBass(freq, bassTime, beatDuration * 0.88);
          }
        }
      });
    }

    // 3. Lead Melody (SoundFont Tenor Saxophone / Flute)
    if (bar.melody && bar.melody.length > 0) {
      bar.melody.forEach((freq, stepIndex) => {
        if (freq !== null) {
          const isOffbeat = stepIndex % 2 === 1;
          const swingDelay = isOffbeat ? subStepDuration * 0.18 : 0;
          const noteTime = startTime + stepIndex * subStepDuration + swingDelay;
          const noteDuration = subStepDuration * 1.5;
          const midi = freqToMidi(freq);

          if (this.sfLead && this.soundfontsReady) {
            try {
              this.sfLead.start({ note: midi, time: noteTime, duration: noteDuration, velocity: 82 });
            } catch {
              this.playLeadNote(freq, noteTime, noteDuration);
            }
          } else {
            this.playLeadNote(freq, noteTime, noteDuration);
          }
        }
      });
    }

    // 4. Brushed Jazz Drums & Swing Ride Cymbal
    for (let b = 0; b < track.timeSignature; b++) {
      const beatTime = startTime + b * beatDuration;
      this.playRideCymbal(beatTime);
      if (b === 1 || b === 3) {
        this.playBrushSnare(beatTime);
        this.playRideCymbal(beatTime + subStepDuration * 1.15);
      }
    }
  }

  private playWalkingBass(freq: number, time: number, duration: number): void {
    if (!this.ctx || !this.mainGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, time);
    filter.frequency.exponentialRampToValueAtTime(140, time + duration);

    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.mainGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  private playJazzTone(freq: number, time: number, duration: number, type: OscillatorType, level: number): void {
    if (!this.ctx || !this.mainGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.mainGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  private playLeadNote(freq: number, time: number, duration: number): void {
    if (!this.ctx || !this.mainGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    const vibrato = this.ctx.createOscillator();
    const vibGain = this.ctx.createGain();
    vibrato.frequency.setValueAtTime(5.5, time);
    vibGain.gain.setValueAtTime(3.5, time);
    vibrato.connect(osc.frequency);
    vibrato.start(time + 0.1);
    vibrato.stop(time + duration);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.12, time + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.mainGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  private playRideCymbal(time: number): void {
    if (!this.ctx || !this.mainGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(4200, time);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6000, time);

    gain.gain.setValueAtTime(0.02, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.mainGain);

    osc.start(time);
    osc.stop(time + 0.06);
  }

  private playBrushSnare(time: number): void {
    if (!this.ctx || !this.mainGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, time);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, time);
    filter.Q.setValueAtTime(1.5, time);

    gain.gain.setValueAtTime(0.045, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.mainGain);

    osc.start(time);
    osc.stop(time + 0.1);
  }
}

export const jazz = new JazzMidiEngine();
