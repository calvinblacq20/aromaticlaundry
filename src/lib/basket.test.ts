import { describe, expect, it } from "vitest";
import { capacityMax, cleanPieces, comparePieces, overCapacity, pieceTotal, piecesSummary, PIECE_KINDS_MAX, PIECE_NAME_MAX, setPiece } from "./basket";

describe("basket contents", () => {
  it("cleans a list before it's saved: trims, merges repeats, drops blanks and zeros", () => {
    expect(
      cleanPieces([
        { name: " Shirt ", qty: 3 },
        { name: "shirt", qty: 2 },
        { name: "   ", qty: 4 },
        { name: "Towel", qty: 0 },
        { name: "Kaba  and   slit", qty: 1.8 },
      ]),
    ).toEqual([
      { name: "Shirt", qty: 5 },
      { name: "Kaba and slit", qty: 1 },
    ]);
  });

  it("keeps an empty or missing list off the order", () => {
    expect(cleanPieces(undefined)).toBeUndefined();
    expect(cleanPieces([])).toBeUndefined();
    expect(cleanPieces([{ name: "Shirt", qty: -2 }])).toBeUndefined();
  });

  it("refuses silly input: huge counts, long names, endless kinds, non-numbers", () => {
    const cleaned = cleanPieces([
      { name: "Shirt", qty: 5000 },
      { name: "x".repeat(200), qty: 1 },
      { name: "Sock", qty: Number.NaN },
    ]);
    expect(cleaned?.[0]?.qty).toBe(99);
    expect(cleaned?.[1]?.name.length).toBe(PIECE_NAME_MAX);
    expect(cleaned).toHaveLength(2);
    const many = Array.from({ length: 60 }, (_, i) => ({ name: `Thing ${i}`, qty: 1 }));
    expect(cleanPieces(many)).toHaveLength(PIECE_KINDS_MAX);
  });

  it("sets a garment's count: adds, changes, removes at zero", () => {
    let list = setPiece([], "Shirt", 2);
    list = setPiece(list, "Towel", 1);
    list = setPiece(list, "shirt", 4);
    expect(list).toEqual([
      { name: "Shirt", qty: 4 },
      { name: "Towel", qty: 1 },
    ]);
    expect(setPiece(list, "Shirt", 0)).toEqual([{ name: "Towel", qty: 1 }]);
    expect(setPiece(list, "Dress", 0)).toEqual(list);
  });

  it("totals and summarises a list", () => {
    const list = [
      { name: "Shirt", qty: 4 },
      { name: "Trousers", qty: 2 },
      { name: "Towel", qty: 3 },
      { name: "Bedsheet", qty: 1 },
    ];
    expect(pieceTotal(list)).toBe(10);
    expect(pieceTotal(undefined)).toBe(0);
    expect(piecesSummary(list)).toBe("Shirt × 4, Trousers × 2 + 2 more");
    expect(piecesSummary(list.slice(0, 2))).toBe("Shirt × 4, Trousers × 2");
  });

  it("warns when the list won't fit the baskets booked", () => {
    expect(capacityMax("About 10–15 clothes")).toBe(15);
    expect(capacityMax(undefined)).toBeNull();
    const twelve = [{ name: "Shirt", qty: 12 }];
    expect(overCapacity(twelve, [{ capacity: "About 6–8 clothes", qty: 1 }])).toBe(true);
    expect(overCapacity(twelve, [{ capacity: "About 6–8 clothes", qty: 2 }])).toBe(false);
    expect(overCapacity(twelve, [{ capacity: "About 10–15 clothes", qty: 1 }])).toBe(false);
    expect(overCapacity(twelve, [])).toBe(false);
  });

  it("lines the client's list up against the counter's count", () => {
    const listed = [
      { name: "Shirt", qty: 5 },
      { name: "Towel", qty: 2 },
    ];
    const counted = [
      { name: "shirt", qty: 4 },
      { name: "Dress", qty: 1 },
    ];
    expect(comparePieces(listed, counted)).toEqual([
      { name: "shirt", listed: 5, counted: 4 },
      { name: "Dress", listed: 0, counted: 1 },
      { name: "Towel", listed: 2, counted: 0 },
    ]);
  });
});
