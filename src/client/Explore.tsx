import { Heart, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Photo, Skeleton, useSkeleton } from "../components/Bits";
import { Reveal } from "../components/Reveal";
import { actions, useAppData } from "../data/store";
import { CATEGORIES, SERVICES, categoryLabel } from "../data/catalog";
import type { CategoryId } from "../data/types";
import { serviceLine, servicePrice } from "../lib/items";
import { spring } from "../motion";

/** Baskets are priced by the load; everything else by the piece. */
type Kind = "baskets" | "items";

const isCategory = (value: string | null): value is CategoryId => CATEGORIES.some((c) => c.id === value);

export function Explore() {
  const loading = useSkeleton(500);
  const [params, setParams] = useSearchParams();
  const categoryParam = params.get("category");
  const category = isCategory(categoryParam) ? categoryParam : null;
  const kindParam = params.get("kind");
  const kind: Kind | null = kindParam === "baskets" || kindParam === "items" ? kindParam : null;
  const savedOnly = params.get("saved") === "1";
  const [query, setQuery] = useState("");
  const { savedServiceIds } = useAppData().device;
  const navigate = useNavigate();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SERVICES.filter((s) => {
      if (savedOnly && !savedServiceIds.includes(s.id)) return false;
      if (kind === "baskets" && s.category !== "baskets") return false;
      if (kind === "items" && s.category === "baskets") return false;
      if (category && s.category !== category) return false;
      if (!q) return true;
      return `${s.name} ${categoryLabel(s.category)} ${s.description}`.toLowerCase().includes(q);
    });
  }, [query, category, kind, savedOnly, savedServiceIds]);

  const setFilter = (next: { category?: CategoryId | null; saved?: boolean; kind?: Kind | null }) => {
    const p = new URLSearchParams();
    const c = next.category === undefined ? category : next.category;
    const s = next.saved === undefined ? savedOnly : next.saved;
    const k = next.kind === undefined ? kind : next.kind;
    if (c) p.set("category", c);
    if (k) p.set("kind", k);
    if (s) p.set("saved", "1");
    setParams(p, { replace: true });
  };

  return (
    <main className="screen">
      <header className="page-title" style={{ paddingTop: 20 }}>
        <h1 className="t-h1">Explore</h1>
        <p className="muted">{SERVICES.length} services · washed and pressed at West Hills Mall</p>
      </header>

      <div className="stack gap-12 explore-bar" style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--ground)", marginInline: "calc(var(--gutter) * -1)", padding: "8px var(--gutter) 10px" }}>
        <label className="search-box">
          <Search size={18} className="subtle" />
          <span className="sr-only">Search the price list</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search basket, suit, kente, duvet…" inputMode="search" />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search" className="subtle">
              <X size={18} />
            </button>
          )}
        </label>
        <div className="segmented line-switch" role="radiogroup" aria-label="How it's priced">
          <button role="radio" aria-checked={kind === null} className={kind === null ? "is-active" : ""} onClick={() => setFilter({ kind: null })}>
            Everything
          </button>
          <button role="radio" aria-checked={kind === "baskets"} className={kind === "baskets" ? "is-active" : ""} onClick={() => setFilter({ kind: kind === "baskets" ? null : "baskets", category: null })}>
            By the basket
          </button>
          <button role="radio" aria-checked={kind === "items"} className={kind === "items" ? "is-active" : ""} onClick={() => setFilter({ kind: kind === "items" ? null : "items" })}>
            By the piece
          </button>
        </div>
        <div className="chips">
          <button className={`chip ${!category && !savedOnly ? "is-active" : ""}`} onClick={() => setFilter({ category: null, saved: false })}>
            All
          </button>
          <button className={`chip ${savedOnly ? "is-active" : ""}`} onClick={() => setFilter({ saved: !savedOnly })}>
            <Heart size={14} /> Saved
            <span className="chip-count">{savedServiceIds.length}</span>
          </button>
          {CATEGORIES.filter((c) => (kind === "baskets" ? c.id === "baskets" : kind === "items" ? c.id !== "baskets" : true)).map((c) => (
            <button key={c.id} className={`chip ${category === c.id ? "is-active" : ""}`} onClick={() => setFilter({ category: category === c.id ? null : c.id })}>
              {c.short}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="style-grid" style={{ marginTop: 12 }} aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="stack gap-8">
              <Skeleton h={190} r={8} />
              <Skeleton w="70%" h={14} />
              <Skeleton w="40%" h={12} />
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">
            <Search size={24} />
          </span>
          <p className="t-title">{savedOnly ? "Nothing saved yet" : "Nothing matches"}</p>
          <p className="muted">{savedOnly ? "Tap the heart on anything to keep it here." : "Try another word or clear the filters."}</p>
          <button
            className="btn btn-outline"
            onClick={() => {
              setQuery("");
              setFilter({ category: null, saved: false, kind: null });
            }}
            style={{ marginTop: 8 }}
          >
            Show the whole price list
          </button>
        </div>
      ) : (
        <motion.div layout className="style-grid" style={{ marginTop: 12 }}>
          <AnimatePresence mode="popLayout">
            {results.map((service, i) => {
              const saved = savedServiceIds.includes(service.id);
              return (
                <motion.div key={service.id} layout="position" exit={{ opacity: 0, scale: 0.96 }} transition={spring.small} className="style-tile">
                  <Reveal y={32} delay={(i % 4) * 0.06}>
                    <button onClick={() => navigate(`/order/new?service=${service.id}`)} className="stack gap-8" style={{ textAlign: "left", width: "100%" }} aria-label={`Book ${service.name}, ${servicePrice(service)}`}>
                      <Photo tone={service.tone} src={service.photo} alt={service.name} sizes="(min-width: 1200px) 290px, (min-width: 810px) 33vw, 50vw" ratio="4 / 5" radius="var(--r-img)" markSize={44} />
                      <span className="stack">
                        <span className="t-title" style={{ fontSize: 15 }}>
                          {service.name}
                        </span>
                        <span className="subtle t-cap">{serviceLine(service)}</span>
                        <span className="tabular" style={{ fontWeight: 500 }}>
                          {servicePrice(service)}
                        </span>
                      </span>
                    </button>
                    <motion.button className={`icon-btn save ${saved ? "is-on" : ""}`} onClick={() => actions.toggleSaved(service.id)} aria-pressed={saved} aria-label={saved ? `Remove ${service.name} from saved` : `Save ${service.name}`} whileTap={{ scale: 0.8 }} transition={spring.press}>
                      <Heart size={16} strokeWidth={1.8} fill={saved ? "currentColor" : "none"} />
                    </motion.button>
                  </Reveal>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </main>
  );
}
