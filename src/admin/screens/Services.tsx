import { Eye, EyeOff, Pencil, RotateCcw, Zap } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Photo } from "../../components/Bits";
import { Button } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import { Sheet } from "../../components/Sheet";
import { RULES } from "../../data/business";
import { CATEGORIES, categoryShort } from "../../data/catalog";
import { shop, useAppData } from "../../data/store";
import type { CategoryId, Plan, Service } from "../../data/types";
import { money, plural } from "../../lib/format";
import { periodRange } from "../../lib/metrics";
import { CardHead } from "../controls";
import { useNow } from "../hooks";
import { AdminPage } from "../Shell";
import { ConfirmSheet } from "../sheets";

const toNumber = (v: string) => Number(v.replace(/[^\d.]/g, ""));

/** What the price column says for each service. */
const priceText = (s: Service) => (s.kind === "quote" ? "At the counter" : `${money(s.price)} / ${s.unit}`);

/** "24 hours", "2 days". */
const turnaroundText = (hours: number) => (hours < 48 ? plural(hours, "hour") : plural(Math.round(hours / 24), "day"));

export function Services() {
  const data = useAppData();
  const now = useNow();
  const notify = useNotify();
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [editing, setEditing] = useState<Service | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const recent = useMemo(() => {
    const range = periodRange("90d", now);
    const counts = new Map<string, number>();
    for (const o of data.orders) {
      const t = new Date(o.createdAt);
      if (t < range.start || o.status === "cancelled") continue;
      for (const item of o.items) counts.set(item.serviceId, (counts.get(item.serviceId) ?? 0) + 1);
    }
    return counts;
  }, [data.orders, now]);

  const services = data.services.filter((s) => category === "all" || s.category === category);
  const hidden = data.services.filter((s) => s.active === false).length;

  const toggle = (service: Service) => {
    const result = shop.saveService(service.id, { active: service.active === false });
    if ("error" in result) return notify("Couldn't save", result.error);
    notify(service.active === false ? "Back on the price list" : "Hidden from the price list", service.active === false ? `${service.name} is back in the client app.` : `${service.name} is hidden from clients. Orders already placed are not affected.`);
  };

  return (
    <AdminPage
      title="Services & prices"
      status={
        <>
          {plural(data.services.length, "service")} · {hidden ? `${hidden} hidden · ` : ""}baskets and ironing from your own price list
        </>
      }
    >
      <PlansCard plans={data.plans} />

      <div className="chips" role="radiogroup" aria-label="Category" style={{ margin: "20px 0 16px" }}>
        {[{ id: "all" as const, short: "All" }, ...CATEGORIES].map((c) => (
          <button key={c.id} role="radio" aria-checked={category === c.id} className={`chip ${category === c.id ? "is-active" : ""}`} onClick={() => setCategory(c.id)}>
            {c.short}
          </button>
        ))}
      </div>
      <section className="adm-card" aria-label="Price list">
        <div className="adm-table-wrap desktop-only">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">Category</th>
                <th scope="col" className="num">
                  Price
                </th>
                <th scope="col" className="num">
                  Turnaround
                </th>
                <th scope="col" className="num">
                  Express
                </th>
                <th scope="col" className="num">
                  Orders, 90 days
                </th>
                <th scope="col" className="num">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} style={{ cursor: "default", opacity: s.active === false ? 0.55 : 1 }}>
                  <td>
                    <span className="inline" style={{ gap: 12 }}>
                      <Photo tone={s.tone} src={s.photo} sizes="36px" height={36} radius={6} markSize={14} className="style-mini" />
                      <span className="stack">
                        <span style={{ fontWeight: 500 }}>{s.name}</span>
                        {s.capacity && <span className="t-cap muted">{s.capacity}</span>}
                      </span>
                      {s.active === false && <span className="pill-tag">Hidden</span>}
                      {s.featured && <span className="pill-tag">Popular</span>}
                    </span>
                  </td>
                  <td>{categoryShort(s.category)}</td>
                  <td className="num">{priceText(s)}</td>
                  <td className="num">{turnaroundText(s.hours)}</td>
                  <td className="num">{s.express ? "Yes" : "–"}</td>
                  <td className="num">{recent.get(s.id) ?? 0}</td>
                  <td className="num">
                    <span className="inline" style={{ gap: 4, justifyContent: "flex-end" }}>
                      <button className="icon-btn is-plain" style={{ width: 34, height: 34 }} onClick={() => toggle(s)} aria-label={s.active === false ? `Show ${s.name} to clients` : `Hide ${s.name} from clients`}>
                        {s.active === false ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                      <button className="icon-btn is-plain" style={{ width: 34, height: 34 }} onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}>
                        <Pencil size={16} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="adm-rows mobile-only" style={{ paddingBlock: 4 }}>
          {services.map((s) => (
            <button key={s.id} className="adm-row" onClick={() => setEditing(s)} style={{ opacity: s.active === false ? 0.55 : 1 }}>
              <Photo tone={s.tone} src={s.photo} sizes="40px" height={40} radius={8} markSize={14} className="style-mini" />
              <span className="grow stack">
                <span style={{ fontWeight: 500 }}>
                  {s.name} {s.active === false && <span className="pill-tag">Hidden</span>}
                </span>
                <span className="t-cap muted">
                  {turnaroundText(s.hours)}
                  {s.express ? " · express" : ""} · {recent.get(s.id) ?? 0} orders in 90 days
                </span>
              </span>
              <span className="tabular t-cap">{priceText(s)}</span>
              <Pencil size={15} className="row-chevron" />
            </button>
          ))}
        </div>
        <div className="adm-card-foot">
          <span className="adm-meta inline" style={{ gap: 6 }}>
            <Zap size={13} /> Express adds {money(RULES.expressFee)} per order and takes {plural(RULES.expressHours, "hour")}. Change it in Settings.
          </span>
          <button className="adm-link" onClick={() => setResetOpen(true)}>
            <RotateCcw size={14} /> Reset the price list
          </button>
        </div>
      </section>

      <ServiceSheet service={editing} onClose={() => setEditing(null)} />
      <ConfirmSheet
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset the price list?"
        body="Every service goes back to its starting name, price and turnaround, and hidden services come back. Plans are reset separately. Orders already placed keep their price."
        confirmLabel="Reset price list"
        onConfirm={() => {
          shop.resetServices();
          setResetOpen(false);
          notify("Price list reset", "Services are back to their starting prices.");
        }}
      />
    </AdminPage>
  );
}

/** The monthly plans: price, basket washes and what's listed with them. Running plans keep their month; new prices apply at renewal. */
function PlansCard({ plans }: { plans: Plan[] }) {
  const notify = useNotify();
  const toForm = (list: Plan[]) => list.map((p) => ({ id: p.id, name: p.name, blurb: p.blurb, price: String(p.price), baskets: String(p.baskets), perks: p.perks.join("\n"), active: p.active !== false, featured: Boolean(p.featured) }));
  const [form, setForm] = useState(() => toForm(plans));
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  useEffect(() => setForm(toForm(plans)), [plans]);
  const original = useMemo(() => toForm(plans), [plans]);
  const dirty = JSON.stringify(form) !== JSON.stringify(original);
  const set = (i: number, patch: Partial<(typeof form)[number]>) => setForm(form.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const save = (e: FormEvent) => {
    e.preventDefault();
    for (const p of form) {
      const result = shop.savePlan(p.id, { name: p.name, blurb: p.blurb.trim(), price: toNumber(p.price), baskets: Math.round(toNumber(p.baskets)), perks: p.perks.split("\n"), active: p.active, featured: p.featured });
      if ("error" in result) return setError(`${p.name || "A plan"}: ${result.error}`);
    }
    setError(null);
    notify("Plans saved", "The client app shows the new plans. Members keep their month; new prices apply when they renew.");
  };

  return (
    <form className="adm-card" aria-labelledby="plans-card" onSubmit={save} noValidate>
      <CardHead id="plans-card" title="Monthly plans" action={dirty ? <span className="pill-tag">Unsaved</span> : <span className="adm-meta">Rider trips are free on plan orders</span>} />
      <div className="adm-card-body adm-grid adm-grid-2" style={{ gap: 20 }}>
        {form.map((p, i) => (
          <fieldset key={p.id} className="stack gap-12" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <legend className="sr-only">{p.name} plan</legend>
            <div className="adm-grid" style={{ gridTemplateColumns: "minmax(0, 1fr) 110px 100px", gap: 8 }}>
              <div className="field">
                <label htmlFor={`plan-name-${p.id}`}>Plan</label>
                <input id={`plan-name-${p.id}`} value={p.name} maxLength={30} onChange={(e) => set(i, { name: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`plan-price-${p.id}`}>GH₵ / month</label>
                <input id={`plan-price-${p.id}`} inputMode="decimal" value={p.price} onChange={(e) => set(i, { price: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`plan-baskets-${p.id}`}>Baskets</label>
                <input id={`plan-baskets-${p.id}`} inputMode="numeric" value={p.baskets} onChange={(e) => set(i, { baskets: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label htmlFor={`plan-blurb-${p.id}`}>Who it's for</label>
              <input id={`plan-blurb-${p.id}`} value={p.blurb} maxLength={120} onChange={(e) => set(i, { blurb: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`plan-perks-${p.id}`}>What's listed with it (one per line)</label>
              <textarea id={`plan-perks-${p.id}`} className="adm-textarea" rows={3} value={p.perks} maxLength={400} onChange={(e) => set(i, { perks: e.target.value })} />
            </div>
            <div className="inline" style={{ gap: 16, flexWrap: "wrap" }}>
              <label className="check-row">
                <input type="checkbox" className="cbx" checked={p.active} onChange={(e) => set(i, { active: e.target.checked })} />
                <span>Offer it in the app</span>
              </label>
              <label className="check-row">
                <input type="checkbox" className="cbx" checked={p.featured} onChange={(e) => set(i, { featured: e.target.checked })} />
                <span>Mark as most popular</span>
              </label>
            </div>
            <p className="t-cap muted">
              {toNumber(p.baskets) > 0 && toNumber(p.price) > 0 ? `Works out at ${money(Math.round(toNumber(p.price) / toNumber(p.baskets)))} a basket, with free rider trips.` : ""}
            </p>
          </fieldset>
        ))}
      </div>
      {error && (
        <p className="adm-form-error" role="alert" style={{ padding: "0 20px 8px" }}>
          {error}
        </p>
      )}
      <div className="adm-card-foot">
        <span className="inline" style={{ gap: 12 }}>
          <button type="button" className="adm-link" onClick={() => setForm(original)} style={{ visibility: dirty ? "visible" : "hidden" }}>
            Undo changes
          </button>
          <button type="button" className="adm-link" onClick={() => setResetOpen(true)}>
            <RotateCcw size={14} /> Original plans
          </button>
        </span>
        <Button variant="dark" size="sm" type="submit" disabled={!dirty}>
          Save plans
        </Button>
      </div>
      <ConfirmSheet
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Go back to the original plans?"
        body="Both plans go back to their starting price, baskets and wording. Members keep the month they paid for."
        confirmLabel="Reset plans"
        onConfirm={() => {
          shop.resetPlans();
          setResetOpen(false);
          notify("Plans reset", "Plans are back to the original Solo and Family.");
        }}
      />
    </form>
  );
}

function ServiceSheet({ service, onClose }: { service: Service | null; onClose: () => void }) {
  const notify = useNotify();
  const [form, setForm] = useState({ name: "", description: "", price: "", hours: "", express: true, featured: false, active: true });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!service) return;
    setForm({
      name: service.name,
      description: service.description,
      price: String(service.price),
      hours: String(service.hours),
      express: service.express,
      featured: Boolean(service.featured),
      active: service.active !== false,
    });
    setError(null);
  }, [service]);

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!service) return;
    const result = shop.saveService(service.id, {
      name: form.name,
      description: form.description,
      price: service.kind === "quote" ? 0 : toNumber(form.price),
      hours: Math.round(toNumber(form.hours)),
      express: form.express,
      featured: form.featured,
      active: form.active,
    });
    if ("error" in result) return setError(result.error);
    onClose();
    notify("Service saved", `${result.service.name} is updated on the price list.`);
  };

  return (
    <Sheet open={service !== null} onClose={onClose} title={service ? `Edit ${service.name}` : "Edit service"}>
      {service && (
        <form className="stack gap-16" onSubmit={save} noValidate>
          <div className="field">
            <label htmlFor="service-name">Name</label>
            <input id="service-name" value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="service-desc">Description shown to clients</label>
            <textarea id="service-desc" rows={3} value={form.description} maxLength={300} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="adm-grid adm-grid-2" style={{ gap: 16 }}>
            {service.kind === "quote" ? (
              <p className="banner" style={{ margin: 0 }}>
                <span className="muted">Priced at the counter when it's checked in, so there's no list price.</span>
              </p>
            ) : (
              <div className="field">
                <label htmlFor="service-price">Price per {service.unit} (GH₵)</label>
                <input id="service-price" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
            )}
            <div className="field">
              <label htmlFor="service-hours">Standard turnaround (hours)</label>
              <input id="service-hours" inputMode="numeric" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
              <span className="hint">24 means ready the same time the next day.</span>
            </div>
          </div>
          <div className="stack">
            <label className="check-row">
              <input type="checkbox" className="cbx" checked={form.express} onChange={(e) => setForm({ ...form, express: e.target.checked })} />
              <span>Can go express ({plural(RULES.expressHours, "hour")})</span>
            </label>
            <label className="check-row">
              <input type="checkbox" className="cbx" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              <span>Show in the client app</span>
            </label>
            <label className="check-row">
              <input type="checkbox" className="cbx" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
              <span>Show under Popular on the home page</span>
            </label>
          </div>
          {error && (
            <p className="adm-form-error" role="alert">
              {error}
            </p>
          )}
          <p className="t-cap muted">New prices apply to new orders only. Orders already placed keep their price.</p>
          <Button variant="dark" block type="submit">
            Save service
          </Button>
        </form>
      )}
    </Sheet>
  );
}
