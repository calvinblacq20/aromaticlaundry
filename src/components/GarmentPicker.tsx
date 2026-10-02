import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";
import type { BasketPiece } from "../data/types";
import { GARMENTS, PIECE_NAME_MAX, PIECE_QTY_MAX, pieceTotal, qtyOf, setPiece } from "../lib/basket";
import { plural } from "../lib/format";

const isPreset = (name: string) => GARMENTS.some((g) => g.toLowerCase() === name.trim().toLowerCase());

/**
 * What's in the basket: the common garments with a count each, and anything else added by name.
 * The client fills it in when booking; the counter uses the same list at check-in. No nested form,
 * so it can sit inside the check-in form.
 */
export function GarmentPicker({ value, onChange, tally = "listed" }: { value: BasketPiece[]; onChange: (next: BasketPiece[]) => void; tally?: "listed" | "counted" }) {
  const id = useId();
  const [extra, setExtra] = useState("");
  const total = pieceTotal(value);
  const names = [...GARMENTS, ...value.filter((p) => !isPreset(p.name)).map((p) => p.name)];

  const addExtra = () => {
    const name = extra.trim().replace(/\s+/g, " ").slice(0, PIECE_NAME_MAX);
    if (!name) return;
    onChange(setPiece(value, name, qtyOf(value, name) + 1));
    setExtra("");
  };

  return (
    <div className="garments">
      <ul className="garment-list">
        {names.map((name) => {
          const qty = qtyOf(value, name);
          return (
            <li key={name} className={`garment ${qty ? "is-on" : ""}`}>
              <span className="grow">{name}</span>
              <span className="qty">
                <button type="button" onClick={() => onChange(setPiece(value, name, qty - 1))} disabled={qty === 0} aria-label={`One fewer ${name}`}>
                  <Minus size={14} />
                </button>
                <output className="garment-count tabular" aria-label={`${name}: ${qty}`}>
                  {qty}
                </output>
                <button type="button" onClick={() => onChange(setPiece(value, name, qty + 1))} disabled={qty >= PIECE_QTY_MAX} aria-label={`One more ${name}`}>
                  <Plus size={14} />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="garment-add">
        <label htmlFor={`${id}-extra`} className="sr-only">
          Something else in the basket
        </label>
        <input
          id={`${id}-extra`}
          value={extra}
          maxLength={PIECE_NAME_MAX}
          onChange={(e) => setExtra(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            addExtra();
          }}
          placeholder="Something else? e.g. Curtain, Agbada"
        />
        <button type="button" className="btn btn-soft btn-sm" onClick={addExtra} disabled={!extra.trim()}>
          <Plus size={14} /> Add
        </button>
      </div>
      <p className="garments-total" aria-live="polite">
        {total ? `${plural(total, "piece")} ${tally}` : `Nothing ${tally} yet`}
      </p>
    </div>
  );
}
