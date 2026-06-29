import type { ProjectileKind, RunState } from "../core/types";

/**
 * Procedural combat audio. Mirrors {@link Fx.ingest}: it drains the same
 * per-frame combat events and turns each into a short synthesized blip via the
 * WebAudio API. There are no audio assets — every sound is generated from
 * oscillators and noise, so it stays tiny and matches the retro pixel vibe.
 *
 * Call {@link ingest} BEFORE Fx.ingest each frame; Fx owns clearing run.events.
 */
export class Sfx {
  muted = false;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Cap voices per frame so a 4× speed wipe doesn't blast a wall of sound. */
  private static readonly MAX_PER_FRAME = 5;

  /** Lazily build the audio graph; resume it if the browser suspended it.
   *  Safe to call every frame. Returns null when audio is unavailable/muted. */
  private ensure(): AudioContext | null {
    if (this.muted) return null;
    const Ctor =
      typeof window !== "undefined"
        ? window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        : undefined;
    if (!Ctor) return null;
    if (!this.ctx) {
      this.ctx = new Ctor();
      const master = this.ctx.createGain();
      master.gain.value = 0.22;
      // Soft limiter so stacked blips don't clip into harsh distortion.
      const comp = this.ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(this.ctx.destination);
      this.master = master;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Translate this frame's combat events into sound. Does not clear events. */
  ingest(run: RunState): void {
    if (this.muted || run.events.length === 0) return;
    if (!this.ensure()) return;
    let budget = Sfx.MAX_PER_FRAME;
    for (const ev of run.events) {
      if (budget <= 0) break;
      if (ev.t === "attack") {
        if (ev.lethal) this.death();
        else if (ev.ranged) this.shoot(ev.projectile);
        else this.meleeHit();
        budget--;
      } else if (ev.t === "cast") {
        if (ev.ability === "taunt") this.taunt();
        else if (ev.ability === "bigheal") this.bigheal();
        else this.shoot(ev.projectile);
        budget--;
      } else if (ev.t === "heal") {
        this.heal();
        budget--;
      }
      // "dot" ticks are intentionally silent — they fire too often to sound good.
    }
  }

  // --- synthesis primitives -------------------------------------------------

  /** A single enveloped oscillator tone, optionally sweeping in pitch. */
  private tone(
    type: OscillatorType,
    f0: number,
    f1: number | null,
    dur: number,
    gain: number,
    attack = 0.004,
  ): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** A decaying band-passed noise burst (impacts, swooshes). */
  private noise(dur: number, gain: number, hz: number, sweepTo?: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.setValueAtTime(hz, t);
    if (sweepTo) filt.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // --- per-event voices -----------------------------------------------------

  private meleeHit(): void {
    this.noise(0.07, 0.5, 1300);
    this.tone("square", 170, 80, 0.07, 0.22);
  }

  private shoot(kind: ProjectileKind): void {
    if (kind === "arrow") {
      this.noise(0.13, 0.32, 1900, 600); // whoosh
      return;
    }
    // Magical bolts: a quick rising zap, tinted a touch by element.
    const f0 = kind === "shadow" ? 520 : kind === "fire" ? 360 : 700;
    this.tone("triangle", f0, f0 * 2.2, 0.12, 0.2);
  }

  private death(): void {
    this.tone("square", 300, 60, 0.28, 0.28);
    this.noise(0.18, 0.3, 700, 200);
  }

  private heal(): void {
    this.tone("sine", 520, 780, 0.24, 0.16);
  }

  private taunt(): void {
    this.tone("square", 130, 90, 0.3, 0.3); // low metallic clang
    this.tone("square", 260, 230, 0.16, 0.12);
  }

  private bigheal(): void {
    // Bright ascending shimmer (a little major-chord arpeggio).
    this.tone("sine", 523, null, 0.5, 0.12);
    this.tone("sine", 659, null, 0.45, 0.1);
    this.tone("sine", 784, null, 0.4, 0.09);
  }
}
