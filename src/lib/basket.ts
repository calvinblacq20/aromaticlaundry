import type { BasketPiece } from "../data/types";

/** The garments people put in a basket most, in the order the picker shows them. Anything else can be added by name. */
export const GARMENTS = [
  "Shirt",
  "T-shirt",
  "Blouse",
  "Trousers",
  "Jeans",
  "Shorts",
  "Skirt",
  "Dress",
  "Kaba and slit",
  "School uniform",
  "Underwear",
  "Pair of socks",
  "Towel",
  "Bedsheet",
  "Pillowcase",
  "Baby clothes",
] as const;

export const PIECE_NAME_MAX = 40;
export const PIECE_QTY_MAX = 99;
/** Enough for any basket; stops a pasted list from bloating the order. */
export const PIECE_KINDS_MAX = 40;

const key = (name: string) => name.trim().toLowerCase();

/**
 * Tidies a list before it's saved: trims and shortens names, drops blanks and zero counts, merges
 * repeats ("shirt" and "Shirt "), keeps whole counts between 1 and 99, and caps how many kinds there
 * are. Returns undefined for an empty list, so orders without one stay as they were.
 */
export function cleanPieces(pieces: readonly BasketPiece[] | undefined): BasketPiece[] | undefined {
  if (!pieces?.length) return undefined;
  const merged = new Map<string, BasketPiece>();
  for (const piece of pieces) {
    const name = piece.name.trim().replace(/\s+/g, " ").slice(0, PIECE_NAME_MAX);
    const qty = Math.floor(Number(piece.qty));
    if (!name || !Number.isFinite(qty) || qty < 1) continue;
    const existing = merged.get(key(name));
    if (existing) existing.qty = Math.min(PIECE_QTY_MAX, existing.qty + qty);
    else if (merged.size < PIECE_KINDS_MAX) merged.set(key(name), { name, qty: Math.min(PIECE_QTY_MAX, qty) });
  }
  return merged.size ? [...merged.values()] : undefined;
}

/** How many of `name` the list has; 0 when it isn't there. */
export const qtyOf = (pieces: readonly BasketPiece[], name: string) => pieces.find((p) => key(p.name) === key(name))?.qty ?? 0;

/** Sets one garment's count, adding it at the end or removing it at 0. */
export function setPiece(pieces: readonly BasketPiece[], name: string, qty: number): BasketPiece[] {
  const n = Math.max(0, Math.min(PIECE_QTY_MAX, Math.floor(qty)));
  const at = pieces.findIndex((p) => key(p.name) === key(name));
  if (at === -1) return n > 0 ? [...pieces, { name: name.trim(), qty: n }] : [...pieces];
  if (n === 0) return pieces.filter((_, i) => i !== at);
  return pieces.map((p, i) => (i === at ? { ...p, qty: n } : p));
}

export const pieceTotal = (pieces: readonly BasketPiece[] | undefined) => (pieces ?? []).reduce((sum, p) => sum + p.qty, 0);

/** "Shirt × 4, Trousers × 2 + 3 more": the first few kinds, for a one-line summary. */
export function piecesSummary(pieces: readonly BasketPiece[] | undefined, show = 2): string {
  const list = pieces ?? [];
  const head = list.slice(0, show).map((p) => `${p.name} × ${p.qty}`).join(", ");
  return list.length > show ? `${head} + ${list.length - show} more` : head;
}

/** The top of a basket's capacity line: "About 10–15 clothes" holds 15. */
export function capacityMax(capacity: string | undefined): number | null {
  const match = capacity?.match(/(\d+)\D*$/);
  return match ? Number(match[1]) : null;
}

/** True when the list holds more than the booked baskets usually take, so the client can size up now. */
export function overCapacity(pieces: readonly BasketPiece[] | undefined, baskets: { capacity?: string; qty: number }[]): boolean {
  let room = 0;
  for (const basket of baskets) {
    const max = capacityMax(basket.capacity);
    if (max === null) return false;
    room += max * basket.qty;
  }
  return room > 0 && pieceTotal(pieces) > room;
}

export interface PieceCheck {
  name: string;
  listed: number;
  counted: number;
}

/**
 * The client's list against the counter's count, garment by garment, in the order they were
 * written: the counter's list first, then anything the client listed that wasn't counted.
 */
export function comparePieces(listed: readonly BasketPiece[] | undefined, counted: readonly BasketPiece[] | undefined): PieceCheck[] {
  const rows = (counted ?? []).map((p) => ({ name: p.name, listed: qtyOf(listed ?? [], p.name), counted: p.qty }));
  for (const p of listed ?? []) if (!rows.some((r) => key(r.name) === key(p.name))) rows.push({ name: p.name, listed: p.qty, counted: 0 });
  return rows;
}
