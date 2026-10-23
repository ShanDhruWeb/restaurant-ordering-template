"use client";

// Kitchen alerts without audio files: a short two-tone beep made with the Web Audio
// API, repeated until staff tap the new order. Browsers only allow sound after a
// tap, so the board shows an "Enable sound alerts" button first.

let ctx: AudioContext | null = null;

/** Must be called from a tap/click handler. Returns true if sound is now allowed. */
export async function unlockAudio(): Promise<boolean> {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    beepOnce(0.05); // quiet confirmation beep
    return ctx.state === "running";
  } catch {
    return false;
  }
}

export function audioReady(): boolean {
  return ctx?.state === "running";
}

function beepOnce(volume = 0.4): void {
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  for (const [i, freq] of [880, 1320].entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    const start = now + i * 0.18;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.17);
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Start (or keep) the repeating alert. Safe to call on every poll. */
export function startAlert(): void {
  if (timer) return;
  beepOnce();
  timer = setInterval(beepOnce, 2000);
  if ("vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
}

export function stopAlert(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Keep a tablet screen on while the board is open (where supported). */
export async function keepScreenOn(): Promise<{ release: () => void } | null> {
  try {
    if (!("wakeLock" in navigator)) return null;
    const lock = await navigator.wakeLock.request("screen");
    return { release: () => void lock.release().catch(() => undefined) };
  } catch {
    return null;
  }
}
