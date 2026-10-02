import { addDays, dayKey, fmtTime, localIso, parseLocal, startOfDay, weekdayLong } from "./format";

/** Opening hours by weekday (0 = Sunday). null = closed. */
export type Hours = Record<number, readonly [open: string, close: string] | null>;

function at(day: Date, hhmm: string): Date {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

export function isOpenDay(day: Date, hours: Hours): boolean {
  return Boolean(hours[day.getDay()]);
}

export function isOpenAt(time: Date, hours: Hours): boolean {
  const span = hours[time.getDay()];
  return Boolean(span && time >= at(time, span[0]) && time < at(time, span[1]));
}

export interface OpenStatus {
  open: boolean;
  label: string;
}

export function openStatus(now: Date, hours: Hours): OpenStatus {
  const today = hours[now.getDay()];
  if (today && now >= at(now, today[0]) && now < at(now, today[1])) {
    return { open: true, label: `Open · closes at ${today[1]}` };
  }
  for (let offset = 0; offset < 8; offset++) {
    const day = addDays(startOfDay(now), offset);
    const span = hours[day.getDay()];
    if (!span) continue;
    const opens = at(day, span[0]);
    if (opens <= now) continue;
    const when = offset === 0 ? "today" : offset === 1 ? "tomorrow" : `on ${weekdayLong(day)}`;
    return { open: false, label: `Closed · opens ${when} at ${span[0]}` };
  }
  return { open: false, label: "Closed" };
}

export function dateStrip(from: Date, count: number): Date[] {
  const first = startOfDay(from);
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}

/** The next moment the counter is open: `time` itself when it's open, otherwise the next opening. */
export function nextOpenTime(time: Date, hours: Hours): Date {
  if (isOpenAt(time, hours)) return time;
  for (let offset = 0; offset < 8; offset++) {
    const day = addDays(startOfDay(time), offset);
    const span = hours[day.getDay()];
    if (!span) continue;
    const opens = at(day, span[0]);
    if (opens >= time) return opens;
  }
  return time;
}

/** Adds hours counted only while the counter is open: three express hours from 20:00 finish at 09:00 the next day. */
export function addOpenHours(from: Date, hoursToAdd: number, hours: Hours): Date {
  let left = hoursToAdd * 60;
  let cursor = nextOpenTime(from, hours);
  for (let guard = 0; guard < 60 && left > 0; guard++) {
    const span = hours[cursor.getDay()];
    if (!span) {
      cursor = nextOpenTime(addDays(startOfDay(cursor), 1), hours);
      continue;
    }
    const close = at(cursor, span[1]);
    const available = Math.max(0, (close.getTime() - cursor.getTime()) / 60_000);
    if (left <= available) return new Date(cursor.getTime() + left * 60_000);
    left -= available;
    cursor = nextOpenTime(addDays(startOfDay(cursor), 1), hours);
  }
  return cursor;
}

/**
 * When an order will be ready. Express counts its hours inside opening hours. A standard wash is
 * ready the same time the next day (or after the longest item's turnaround), moved to the next
 * opening if that lands after closing.
 */
export function readyTime(inAt: Date, turnaroundHours: number, express: boolean, expressHours: number, hours: Hours): Date {
  const start = nextOpenTime(inAt, hours);
  if (express) return addOpenHours(start, expressHours, hours);
  return nextOpenTime(new Date(start.getTime() + turnaroundHours * 3_600_000), hours);
}

export interface Slot {
  time: string;
  start: string;
  available: boolean;
}

/**
 * Drop-off times for a day: every half hour the counter is open. Past times (and anything in the
 * next half hour) are marked unavailable; closed days return [].
 */
export function slotsFor(day: Date, hours: Hours, taken: string[], now: Date, stepMinutes = 30, durationMinutes = 30, leadMinutes = 60): Slot[] {
  const span = hours[day.getDay()];
  if (!span) return [];
  const open = at(day, span[0]);
  const close = at(day, span[1]);
  const cutoff = new Date(now.getTime() + leadMinutes * 60_000);
  const takenSet = new Set(taken);
  const slots: Slot[] = [];
  for (let t = open; t.getTime() + durationMinutes * 60_000 <= close.getTime(); t = new Date(t.getTime() + stepMinutes * 60_000)) {
    const start = localIso(t);
    slots.push({ time: fmtTime(t), start, available: t >= cutoff && !takenSet.has(start) });
  }
  return slots;
}

/** Runs the rider can take in one window, and how much notice a window needs. */
export const RIDER_CAPACITY = 3;
export const RIDER_NOTICE_MS = 2 * 3_600_000;

export interface RiderWindow {
  /** "09:00 – 11:00" */
  label: string;
  start: string;
  minutes: number;
  available: boolean;
  /** How many more runs the rider can take in this window. */
  left: number;
}

/**
 * The rider's two-hour windows for a day. A window closes once it's under two hours away, once
 * the rider is full, or when it starts before `notBefore` (a delivery can't leave before the
 * laundry is ready).
 */
export function riderWindows(day: Date, hours: Hours, booked: string[], now: Date, opts: { capacity?: number; notBefore?: Date; minutes?: number } = {}): RiderWindow[] {
  const span = hours[day.getDay()];
  if (!span) return [];
  const minutes = opts.minutes ?? 120;
  const capacity = opts.capacity ?? RIDER_CAPACITY;
  const open = at(day, span[0]);
  const close = at(day, span[1]);
  const cutoff = new Date(now.getTime() + RIDER_NOTICE_MS);
  const counts = new Map<string, number>();
  for (const start of booked) counts.set(start, (counts.get(start) ?? 0) + 1);
  const windows: RiderWindow[] = [];
  for (let t = open; t.getTime() + minutes * 60_000 <= close.getTime(); t = new Date(t.getTime() + minutes * 60_000)) {
    const start = localIso(t);
    const end = new Date(t.getTime() + minutes * 60_000);
    const left = Math.max(0, capacity - (counts.get(start) ?? 0));
    const tooSoon = t < cutoff || (opts.notBefore ? t < opts.notBefore : false);
    windows.push({ label: `${fmtTime(t)} – ${fmtTime(end)}`, start, minutes, available: !tooSoon && left > 0, left });
  }
  return windows;
}

/** "Between 09:00 and 11:00" for a window that starts at `start`. */
export function windowLabel(start: string, minutes: number): string {
  const from = parseLocal(start);
  const to = new Date(from.getTime() + minutes * 60_000);
  return `${fmtTime(from)} – ${fmtTime(to)}`;
}

export function sameDay(a: string | Date, b: string | Date): boolean {
  const toKey = (v: string | Date) => (typeof v === "string" ? dayKey(parseLocal(v)) : dayKey(v));
  return toKey(a) === toKey(b);
}
