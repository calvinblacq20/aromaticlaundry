import { ArrowUpRight, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import type { Policies, Rules, ShopDetails } from "../../data/business";
import { actions, shop, useAppData } from "../../data/store";
import type { Zone } from "../../data/types";
import type { Hours } from "../../lib/schedule";
import { CardHead } from "../controls";
import { AdminPage } from "../Shell";
import { ConfirmSheet } from "../sheets";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DEFAULT_SPAN: [string, string] = ["07:00", "21:00"];

export function Settings() {
  const notify = useNotify();
  const data = useAppData();
  const [resetOpen, setResetOpen] = useState(false);
  const [defaultsOpen, setDefaultsOpen] = useState(false);

  return (
    <AdminPage title="Settings" status={<>Shop details, hours, fees, rider areas and policies. Changes show on the client app too.</>}>
      <div className="adm-grid adm-grid-2" style={{ maxWidth: 1040 }}>
        <ShopCard details={data.settings.shop} />
        <HoursCard hours={data.settings.hours} />
        <RulesCard rules={data.settings.rules} />
        <ZonesCard zones={data.settings.zones} />
        <PoliciesCard policies={data.settings.policies} />
        <section className="adm-card" aria-labelledby="demo">
          <CardHead id="demo" title="Demo" />
          <div className="adm-card-body stack gap-12">
            <p className="muted">All data is sample data kept in this browser. Resetting brings back the original orders, clients and payments on both the client and owner sides.</p>
            <div className="adm-actions">
              <Button icon={<RotateCcw size={16} />} onClick={() => setResetOpen(true)}>
                Reset demo data
              </Button>
              <Button icon={<RotateCcw size={16} />} onClick={() => setDefaultsOpen(true)}>
                Reset these settings
              </Button>
              <a className="btn btn-soft" href="#/">
                <ArrowUpRight size={16} /> Open client app
              </a>
            </div>
          </div>
        </section>
      </div>

      <ConfirmSheet
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        danger
        title="Reset the demo?"
        body="Every change made in this browser is replaced with the original sample data. This can't be undone."
        confirmLabel="Reset"
        onConfirm={() => {
          actions.resetDemo();
          setResetOpen(false);
          notify("Demo reset", "Sample orders, clients and payments are back.");
        }}
      />
      <ConfirmSheet
        open={defaultsOpen}
        onClose={() => setDefaultsOpen(false)}
        title="Put settings back?"
        body="The shop details, opening hours, fees, rider areas and policies go back to the ones the app shipped with. Orders and clients aren't touched."
        confirmLabel="Reset settings"
        onConfirm={() => {
          shop.resetSettings();
          setDefaultsOpen(false);
          notify("Settings reset", "Shop details, hours, fees, rider areas and policies are back to the defaults.");
        }}
      />
    </AdminPage>
  );
}

/** A card whose fields are saved together; the button wakes up once something changes. */
function EditCard({ id, title, dirty, onSave, onReset, error, children }: { id: string; title: string; dirty: boolean; onSave: (e: FormEvent) => void; onReset: () => void; error: string | null; children: ReactNode }) {
  return (
    <form className="adm-card" aria-labelledby={id} onSubmit={onSave} noValidate>
      <CardHead id={id} title={title} action={dirty ? <span className="pill-tag">Unsaved</span> : undefined} />
      <div className="adm-card-body stack gap-16">{children}</div>
      {error && (
        <p className="adm-form-error" role="alert" style={{ padding: "0 20px 8px" }}>
          {error}
        </p>
      )}
      <div className="adm-card-foot">
        <button type="button" className="adm-link" onClick={onReset} style={{ visibility: dirty ? "visible" : "hidden" }}>
          Undo changes
        </button>
        <Button variant="dark" size="sm" type="submit" disabled={!dirty}>
          Save
        </Button>
      </div>
    </form>
  );
}

function ShopCard({ details }: { details: ShopDetails }) {
  const notify = useNotify();
  const [form, setForm] = useState(details);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setForm(details), [details]);
  const dirty = (Object.keys(form) as (keyof ShopDetails)[]).some((k) => form[k] !== details[k]);
  const field = (key: keyof ShopDetails, label: string, hint?: string, type: "text" | "textarea" = "text") => (
    <div className="field">
      <label htmlFor={`shop-${key}`}>{label}</label>
      {type === "textarea" ? (
        <textarea id={`shop-${key}`} rows={4} value={String(form[key])} maxLength={800} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      ) : (
        <input id={`shop-${key}`} value={String(form[key])} maxLength={200} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      )}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );

  return (
    <EditCard
      id="shop"
      title="Shop"
      dirty={dirty}
      error={error}
      onReset={() => {
        setForm(details);
        setError(null);
      }}
      onSave={(e) => {
        e.preventDefault();
        const result = shop.saveSettings({ shop: form });
        if ("error" in result) return setError(result.error);
        setError(null);
        notify("Shop details saved", "Receipts, WhatsApp messages and the client app now use them.");
      }}
    >
      {field("name", "Shop name")}
      {field("tagline", "Tagline", "On the sign-in screen, receipts and the sign-off of every WhatsApp message.")}
      {field("phone", "Phone, WhatsApp and MoMo number", "WhatsApp messages tell clients to send MoMo to this number.")}
      {field("email", "Email", "Leave empty to hide it.")}
      {field("area", "Area shown to clients", "e.g. West Hills Mall, Weija")}
      {field("address", "Full address on receipts")}
      {field("directions", "How to find the shop", "Shown with the map on the client app.")}
      {field("mapsQuery", "What to search for in Maps")}
      {field("whatsappBusiness", "WhatsApp business link")}
      {field("tiktok", "TikTok link")}
      {field("about", "About the shop", undefined, "textarea")}
    </EditCard>
  );
}

function HoursCard({ hours }: { hours: Hours }) {
  const notify = useNotify();
  const [form, setForm] = useState<Hours>(hours);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setForm(hours), [hours]);
  const dirty = WEEK.some((d) => (form[d]?.[0] ?? "") !== (hours[d]?.[0] ?? "") || (form[d]?.[1] ?? "") !== (hours[d]?.[1] ?? ""));
  const setDay = (day: number, span: readonly [string, string] | null) => setForm({ ...form, [day]: span });

  return (
    <EditCard
      id="hours"
      title="Opening hours"
      dirty={dirty}
      error={error}
      onReset={() => {
        setForm(hours);
        setError(null);
      }}
      onSave={(e) => {
        e.preventDefault();
        const result = shop.saveSettings({ hours: form });
        if ("error" in result) return setError(result.error);
        setError(null);
        notify("Hours saved", "Drop-off times, rider windows, ready times and the open/closed status follow the new hours.");
      }}
    >
      {WEEK.map((day) => {
        const span = form[day];
        return (
          <div key={day} className="between" style={{ gap: 12, flexWrap: "wrap" }}>
            <label className="check-row" style={{ minWidth: 150 }}>
              <input type="checkbox" className="cbx" checked={Boolean(span)} onChange={(e) => setDay(day, e.target.checked ? DEFAULT_SPAN : null)} />
              <span>{DAY_NAMES[day]}</span>
            </label>
            {span ? (
              <span className="inline" style={{ gap: 8 }}>
                <input className="adm-input" style={{ width: 142, height: 40 }} type="time" value={span[0]} aria-label={`${DAY_NAMES[day]} opens`} onChange={(e) => setDay(day, [e.target.value, span[1]])} />
                <span className="muted">to</span>
                <input className="adm-input" style={{ width: 142, height: 40 }} type="time" value={span[1]} aria-label={`${DAY_NAMES[day]} closes`} onChange={(e) => setDay(day, [span[0], e.target.value])} />
              </span>
            ) : (
              <span className="muted">Closed</span>
            )}
          </div>
        );
      })}
    </EditCard>
  );
}

function RulesCard({ rules }: { rules: Rules }) {
  const notify = useNotify();
  const initial = { expressFee: String(rules.expressFee), expressHours: String(rules.expressHours) };
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setForm({ expressFee: String(rules.expressFee), expressHours: String(rules.expressHours) }), [rules]);
  const dirty = form.expressFee !== initial.expressFee || form.expressHours !== initial.expressHours;
  const toNumber = (v: string) => Number(v.replace(/[^\d.]/g, ""));
  return (
    <EditCard
      id="rules"
      title="Express service"
      dirty={dirty}
      error={error}
      onReset={() => {
        setForm(initial);
        setError(null);
      }}
      onSave={(e) => {
        e.preventDefault();
        const result = shop.saveSettings({ rules: { expressFee: toNumber(form.expressFee), expressHours: Math.round(toNumber(form.expressHours)) } });
        if ("error" in result) return setError(result.error);
        setError(null);
        notify("Express saved", "New orders use it straight away. Past orders keep their price and their promised time.");
      }}
    >
      <div className="field">
        <label htmlFor="rule-express">Express fee (GH₵)</label>
        <input id="rule-express" inputMode="decimal" value={form.expressFee} onChange={(e) => setForm({ ...form, expressFee: e.target.value })} />
        <span className="hint">Added once per order, whatever its size. The price list says +GH₵ 50.</span>
      </div>
      <div className="field">
        <label htmlFor="rule-express-hours">Express takes (hours)</label>
        <input id="rule-express-hours" inputMode="numeric" value={form.expressHours} onChange={(e) => setForm({ ...form, expressHours: e.target.value })} />
        <span className="hint">Counted inside opening hours from check-in. The price list says 3 hours.</span>
      </div>
    </EditCard>
  );
}

/** The rider's areas and what a trip costs in each. A plan member's trips are free whatever the area. */
function ZonesCard({ zones }: { zones: Zone[] }) {
  const notify = useNotify();
  const [form, setForm] = useState(() => zones.map((z) => ({ ...z, fee: String(z.fee) })));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setForm(zones.map((z) => ({ ...z, fee: String(z.fee) }))), [zones]);
  const dirty = form.length !== zones.length || form.some((z, i) => z.name !== zones[i]?.name || z.areas !== zones[i]?.areas || z.fee !== String(zones[i]?.fee));
  const set = (i: number, patch: Partial<(typeof form)[number]>) => setForm(form.map((z, j) => (j === i ? { ...z, ...patch } : z)));
  return (
    <EditCard
      id="zones"
      title="Rider areas and fees"
      dirty={dirty}
      error={error}
      onReset={() => {
        setForm(zones.map((z) => ({ ...z, fee: String(z.fee) })));
        setError(null);
      }}
      onSave={(e) => {
        e.preventDefault();
        const result = shop.saveSettings({ zones: form.map((z) => ({ id: z.id, name: z.name, areas: z.areas, fee: Number(z.fee.replace(/[^\d.]/g, "")) })) });
        if ("error" in result) return setError(result.error);
        setError(null);
        notify("Rider areas saved", "New bookings use the new fees. Past orders keep theirs.");
      }}
    >
      {form.map((z, i) => (
        <fieldset key={z.id} className="stack gap-8" style={{ border: 0, padding: i ? "12px 0 0" : 0, margin: 0, borderTop: i ? "1px solid var(--ink-06)" : undefined }}>
          <legend className="sr-only">Area {i + 1}</legend>
          <div className="adm-grid" style={{ gridTemplateColumns: "minmax(0, 1fr) 110px auto", gap: 8, alignItems: "end" }}>
            <div className="field">
              <label htmlFor={`zone-name-${z.id}`}>Area</label>
              <input id={`zone-name-${z.id}`} value={z.name} maxLength={40} onChange={(e) => set(i, { name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`zone-fee-${z.id}`}>Per trip (GH₵)</label>
              <input id={`zone-fee-${z.id}`} inputMode="decimal" value={z.fee} onChange={(e) => set(i, { fee: e.target.value })} />
            </div>
            <button type="button" className="icon-btn is-plain" aria-label={`Remove ${z.name || "this area"}`} disabled={form.length <= 1} onClick={() => setForm(form.filter((_, j) => j !== i))}>
              <Trash2 size={16} />
            </button>
          </div>
          <div className="field">
            <label htmlFor={`zone-areas-${z.id}`}>Places it covers</label>
            <input id={`zone-areas-${z.id}`} value={z.areas} maxLength={120} onChange={(e) => set(i, { areas: e.target.value })} />
          </div>
        </fieldset>
      ))}
      <Button type="button" size="sm" icon={<Plus size={15} />} style={{ alignSelf: "flex-start" }} onClick={() => setForm([...form, { id: `z-${Date.now().toString(36)}`, name: "", areas: "", fee: "30" }])}>
        Add an area
      </Button>
    </EditCard>
  );
}

function PoliciesCard({ policies }: { policies: Policies }) {
  const notify = useNotify();
  const [form, setForm] = useState(policies);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setForm(policies), [policies]);
  const keys: [keyof Policies, string, string][] = [
    ["payment", "Payment", "On checkout, receipts and the order page."],
    ["cancellation", "Cancellation", "Shown before a client cancels."],
    ["handover", "Drop-off, pickup and delivery", "On receipts and the order page."],
    ["important", "Counting and care", "Shown at checkout and on the order page."],
  ];
  const dirty = keys.some(([k]) => form[k] !== policies[k]);

  return (
    <EditCard
      id="policies"
      title="Policies on receipts and orders"
      dirty={dirty}
      error={error}
      onReset={() => {
        setForm(policies);
        setError(null);
      }}
      onSave={(e) => {
        e.preventDefault();
        const result = shop.saveSettings({ policies: form });
        if ("error" in result) return setError(result.error);
        setError(null);
        notify("Policies saved", "Clients see the new wording on orders and receipts.");
      }}
    >
      {keys.map(([key, label, hint]) => (
        <div key={key} className="field">
          <label htmlFor={`policy-${key}`}>{label}</label>
          <textarea id={`policy-${key}`} rows={3} value={form[key]} maxLength={400} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          <span className="hint">{hint}</span>
        </div>
      ))}
    </EditCard>
  );
}
