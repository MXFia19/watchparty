/**
 * SyncEngine — port JS du moteur Rust/WASM de Movix.
 * Reproduit la logique de WatchPartySyncEngine (lib.rs).
 *
 * Modes :
 *   classic — seek brutal si drift > seuil (notre ancien système)
 *   pro     — ajuste le playbackRate progressivement + probe d'horloge
 */

const SOFT_THRESHOLD = 0.15;  // secondes
const HARD_THRESHOLD = 1.0;   // secondes
const MAX_RATE_DELTA = 0.05;  // ±5% max

export type SyncStatus = 'classic' | 'calibrating' | 'adjusting' | 'perfect' | 'unstable';

export interface MasterState {
  isPlaying: boolean;
  position: number;
  updatedAt: number; // timestamp ms
}

export interface LocalSnapshot {
  now: number;       // Date.now()
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
}

export interface ProbeResult {
  probeId: string;
  clientSentAt: number;
  serverReceivedAt: number;
  serverSentAt: number;
  clientReceivedAt: number;
}

export type SyncCommand =
  | { action: 'play' }
  | { action: 'pause' }
  | { action: 'seek'; value: number }
  | { action: 'setPlaybackRate'; value: number }
  | { action: 'resetPlaybackRate' }
  | { action: 'status'; value: SyncStatus };

export class SyncEngine {
  private mode: 'classic' | 'pro' = 'classic';
  private masterState: MasterState | null = null;
  private clockOffsetMs = 0;
  private offsetSamples: number[] = [];
  private lastRateSent = 1.0;
  private lastHardSyncAt = 0;
  private lastPlayPauseAt = 0;
  private lastStatus: SyncStatus = 'classic';

  setMode(mode: 'classic' | 'pro'): SyncCommand[] {
    this.mode = mode;
    this.lastRateSent = 1.0;

    if (mode === 'classic') {
      this.lastStatus = 'classic';
      return [{ action: 'status', value: 'classic' }, { action: 'resetPlaybackRate' }];
    }

    const status = this.offsetSamples.length >= 3 ? 'adjusting' : 'calibrating';
    this.lastStatus = status;
    return [{ action: 'status', value: status }];
  }

  reset() {
    this.masterState = null;
    this.clockOffsetMs = 0;
    this.offsetSamples = [];
    this.lastRateSent = 1.0;
    this.lastHardSyncAt = 0;
    this.lastPlayPauseAt = 0;
    this.lastStatus = 'classic';
  }

  ingestMasterState(state: MasterState) {
    this.masterState = state;
  }

  ingestSchedule(event: { action: string; position: number; scheduledAt: number; updatedBy?: string }) {
    const isPlaying = event.action === 'seek'
      ? (this.masterState?.isPlaying ?? false)
      : event.action !== 'pause';

    this.masterState = {
      isPlaying,
      position: event.position,
      updatedAt: event.scheduledAt,
    };
  }

  updateClockOffset(probe: ProbeResult): SyncCommand[] {
    const rtt = probe.clientReceivedAt - probe.clientSentAt;
    const estimatedOffset = probe.serverSentAt - (probe.clientSentAt + rtt / 2);

    this.offsetSamples.push(estimatedOffset);
    if (this.offsetSamples.length > 5) this.offsetSamples.shift();

    this.clockOffsetMs = this.offsetSamples.reduce((a, b) => a + b, 0) / this.offsetSamples.length;

    const status: SyncStatus = this.offsetSamples.length >= 3 ? 'perfect' : 'calibrating';
    this.lastStatus = status;
    return [{ action: 'status', value: status }];
  }

  tick(local: LocalSnapshot): SyncCommand[] {
    if (this.mode !== 'pro') {
      this.lastStatus = 'classic';
      return [{ action: 'status', value: 'classic' }];
    }

    if (!this.masterState) {
      const status: SyncStatus = this.offsetSamples.length >= 3 ? 'adjusting' : 'calibrating';
      this.lastStatus = status;
      return [{ action: 'status', value: status }];
    }

    const master = this.masterState;

    // Position attendue en tenant compte du temps écoulé + offset d'horloge
    const expectedPosition = master.isPlaying
      ? master.position + Math.max(0, (local.now + this.clockOffsetMs - master.updatedAt) / 1000)
      : master.position;

    const drift = expectedPosition - local.currentTime;
    const absDrift = Math.abs(drift);
    const outputs: SyncCommand[] = [];

    // Play / Pause si désynchronisés
    if (master.isPlaying && !local.isPlaying && local.now - this.lastPlayPauseAt > 600) {
      this.lastPlayPauseAt = local.now;
      outputs.push({ action: 'play' });
    } else if (!master.isPlaying && local.isPlaying && local.now - this.lastPlayPauseAt > 600) {
      this.lastPlayPauseAt = local.now;
      outputs.push({ action: 'pause' });
    }

    // Seek dur si drift > 1s
    if (absDrift >= HARD_THRESHOLD && local.now - this.lastHardSyncAt > 1200) {
      this.lastHardSyncAt = local.now;
      this.lastRateSent = 1.0;
      this.lastStatus = 'unstable';
      outputs.push({ action: 'status', value: 'unstable' });
      outputs.push({ action: 'seek', value: expectedPosition });
      outputs.push({ action: 'resetPlaybackRate' });
      return outputs;
    }

    // Si en pause — juste reset le rate
    if (!master.isPlaying || !local.isPlaying) {
      if (Math.abs(this.lastRateSent - 1.0) >= 0.001) {
        this.lastRateSent = 1.0;
        outputs.push({ action: 'resetPlaybackRate' });
      }
      const status: SyncStatus = absDrift < SOFT_THRESHOLD ? 'perfect' : 'adjusting';
      this.lastStatus = status;
      outputs.push({ action: 'status', value: status });
      return outputs;
    }

    // Drift < 80ms — parfait
    if (absDrift < 0.08) {
      if (Math.abs(this.lastRateSent - 1.0) >= 0.001) {
        this.lastRateSent = 1.0;
        outputs.push({ action: 'resetPlaybackRate' });
      }
      this.lastStatus = 'perfect';
      outputs.push({ action: 'status', value: 'perfect' });
      return outputs;
    }

    // Ajustement progressif du playbackRate
    const targetRate = clamp(1.0 + drift * 0.08, 1.0 - MAX_RATE_DELTA, 1.0 + MAX_RATE_DELTA);
    if (Math.abs(targetRate - this.lastRateSent) >= 0.005) {
      this.lastRateSent = targetRate;
      outputs.push({ action: 'setPlaybackRate', value: targetRate });
    }

    const status: SyncStatus = absDrift < 0.6 ? 'adjusting' : 'unstable';
    this.lastStatus = status;
    outputs.push({ action: 'status', value: status });

    return outputs;
  }

  getStatus(): SyncStatus {
    return this.lastStatus;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
