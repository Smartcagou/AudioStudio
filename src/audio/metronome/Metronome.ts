import { AudioEngine } from '../engine/AudioEngine';

// Métronome à planification anticipée. Le fil JS ne fait que programmer les clics
// quelques dizaines de millisecondes à l'avance ; le déclenchement réel est calé
// à l'échantillon près sur l'horloge audio. Aucun traitement lourd sur le fil JS.
//
// Le tempo est lu sur le moteur (horloge partagée), jamais sur une horloge propre :
// le looper et les pistes synchronisées s'aligneront sur la même grille.

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;
const CLICK_DURATION_S = 0.05;

export class Metronome {
  private readonly engine: AudioEngine;
  private beatsPerBar = 4;
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private beatInBar = 0;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  setBeatsPerBar(beats: number): void {
    this.beatsPerBar = Math.max(1, Math.round(beats));
  }

  isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    if (this.running) return;
    await this.engine.start();

    const context = this.engine.getContext();
    this.beatInBar = 0;
    this.nextNoteTime = context.currentTime + 0.1;
    this.running = true;
    this.timer = setInterval(() => this.scheduler(), LOOKAHEAD_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
  }

  private scheduler(): void {
    const context = this.engine.getContext();
    const secondsPerBeat = 60 / this.engine.getTempo();

    while (this.nextNoteTime < context.currentTime + SCHEDULE_AHEAD_S) {
      this.scheduleClick(this.nextNoteTime, this.beatInBar === 0);
      this.nextNoteTime += secondsPerBeat;
      this.beatInBar = (this.beatInBar + 1) % this.beatsPerBar;
    }
  }

  // Clic court : oscillateur + enveloppe de gain programmés à l'instant exact.
  // Le temps fort (premier de la mesure) est plus aigu et plus fort.
  private scheduleClick(time: number, accent: boolean): void {
    const context = this.engine.getContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'square';
    oscillator.frequency.value = accent ? 1500 : 1000;

    const peak = accent ? 0.6 : 0.35;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + CLICK_DURATION_S);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(time);
    oscillator.stop(time + CLICK_DURATION_S + 0.01);
  }
}
