import { CalendarSync, Check, Minus, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Avatar } from "../../components/Bits";
import { Button, Cta } from "../../components/Button";
import { SuccessScreen } from "../../components/Overlays";
import { HOURS, RULES, ZONES, zoneById } from "../../data/business";
import { CATEGORIES, DEFAULT_CARE, FINISH_OPTIONS, SCENT_OPTIONS, STARCH_OPTIONS, careSummary, serviceById } from "../../data/catalog";
import { shop, useAppData, type WalkInOrder } from "../../data/store";
import type { CarePrefs, Handback, LeadSource, PaymentMethod, Service, Speed } from "../../data/types";
import { formatGhPhone, normalizeGhPhone } from "../../lib/contact";
import { dayKey, fmtDayShort, fmtTime, money, parseLocal, plural } from "../../lib/format";
import { itemSummary, servicePrice } from "../../lib/items";
import { activeSubscription, planStatus } from "../../lib/plans";
import { canExpress, defaultQty, estimate, riderTrips, turnaroundHours, unitPrice } from "../../lib/pricing";
import { dateStrip, readyTime, riderWindows } from "../../lib/schedule";
import { SOURCE_LABEL } from "../../lib/shop";
import { CardHead } from "../controls";
import { Dropdown, type DropdownOption } from "../../components/Dropdown";
import { useNow } from "../hooks";
import { AdminPage } from "../Shell";

type Draft = { key: number; serviceId: string; qty: number; note?: string };

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "momo", label: "MoMo" },
  { id: "cash", label: "Cash" },
  { id: "bank", label: "Bank" },
];

const toNumber = (v: string) => Number(v.replace(/[^\d.]/g, ""));
const emptyLine = (key: number): Draft => ({ key, serviceId: "", qty: 1 });

/** The price list as it stands now: the owner's prices, without the services they've hidden. */
const serviceOptions = (services: Service[]): DropdownOption<string>[] =>
  CATEGORIES.flatMap((c) =>
    services
      .filter((s) => s.category === c.id && s.active !== false)
      .map((s) => ({ value: s.id, label: s.name, hint: servicePrice(s), group: c.short })),
  );

export function NewOrder() {
  const data = useAppData();
  const now = useNow();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preset = data.customers.find((c) => c.id === params.get("client"));

  const [mode, setMode] = useState<"existing" | "new">(preset ? "existing" : "new");
  const [clientId, setClientId] = useState<string | undefined>(preset?.id);
  const [search, setSearch] = useState("");
  const [client, setClient] = useState({ name: "", phone: "", town: "Weija", source: "walkin" as LeadSource });
  const [lines, setLines] = useState<Draft[]>([emptyLine(1)]);
  const [speed, setSpeed] = useState<Speed>("standard");
  const [care, setCare] = useState<CarePrefs>({ ...DEFAULT_CARE });
  const [count, setCount] = useState("");
  const [checkNotes, setCheckNotes] = useState("");
  const [handback, setHandback] = useState<Handback>("collect");
  const [zoneId, setZoneId] = useState<string>("");
  const [outDay, setOutDay] = useState<string | null>(null);
  const [deliveryStart, setDeliveryStart] = useState<string | null>(null);
  const [usePlan, setUsePlan] = useState(true);
  const [price, setPrice] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [takePayment, setTakePayment] = useState(false);
  const [paid, setPaid] = useState("");
  const [paidTouched, setPaidTouched] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("momo");
  const [reference, setReference] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const services = useMemo(() => serviceOptions(data.services), [data.services]);
  const chosen = data.customers.find((c) => c.id === clientId);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, "").replace(/^0/, "");
    return data.customers.filter((c) => !q || c.name.toLowerCase().includes(q) || (digits.length >= 3 && (normalizeGhPhone(c.phone) ?? "").includes(digits))).slice(0, 6);
  }, [data.customers, search]);

  // A known client brings their own care preferences, area and plan with them.
  useEffect(() => {
    if (!chosen) return;
    setCare({ ...(chosen.care ?? DEFAULT_CARE) });
  }, [chosen]);
  const subscription = chosen ? activeSubscription(data.subscriptions, chosen.id, now) : undefined;
  const plan = subscription ? planStatus(subscription, data.orders, now) : null;

  const priced = lines.flatMap((l) => {
    const service = serviceById(l.serviceId);
    return service ? [{ ...l, service, unitPrice: unitPrice(service) }] : [];
  });
  const expressOk = canExpress(priced);
  const effectiveSpeed: Speed = expressOk ? speed : "standard";
  const hasBaskets = priced.some((p) => p.service.category === "baskets");
  const onPlan = Boolean(usePlan && plan && plan.left > 0 && hasBaskets);
  const zone = zoneById(zoneId || undefined);
  const est = estimate(priced, { speed: effectiveSpeed, trips: riderTrips("dropoff", handback), zoneFee: zone?.fee ?? 0, planBasketsLeft: onPlan ? plan?.left : undefined });
  const total = priceTouched ? toNumber(price) : est.total;
  const paidValue = paidTouched ? toNumber(paid) : total;
  const readyAt = priced.length ? readyTime(now, turnaroundHours(priced), effectiveSpeed === "express", RULES.expressHours, HOURS) : null;
  const booked = data.appointments.filter((a) => a.status !== "cancelled" && a.status !== "done").map((a) => a.start);
  const outDays = readyAt ? dateStrip(readyAt, 7) : [];
  const windows = outDay && readyAt ? riderWindows(parseLocal(outDay), HOURS, booked, now, { notBefore: readyAt }) : [];

  const openSaved = useCallback(() => {
    if (saved) navigate(`/admin/orders/${saved}`, { replace: true });
  }, [saved, navigate]);

  const update = (key: number, change: Partial<Draft>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...change } : l)));
  const chooseService = (key: number, serviceId: string) => {
    const service = serviceById(serviceId);
    if (!service) return;
    setLines((ls) => ls.map((l) => (l.key === key ? { key, serviceId, qty: defaultQty(service), note: l.note } : l)));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "existing" && !chosen) return setError("Choose the client, or switch to a new client.");
    if (!priced.length) return setError("Choose at least one service.");
    const counted = Math.floor(toNumber(count));
    if (!counted) return setError("Count the garments before checking in.");
    if (handback === "delivery" && !zone) return setError("Choose the delivery area.");
    if (handback === "delivery" && !deliveryStart) return setError("Choose the delivery window.");
    if (takePayment && paidValue > total) return setError("The payment can't be more than the price.");
    const draft: WalkInOrder = {
      customerId: mode === "existing" ? chosen?.id : undefined,
      newClient: mode === "new" ? client : undefined,
      items: priced.map((p) => ({ serviceId: p.serviceId, qty: p.qty, note: p.note?.trim() || undefined, unitPrice: p.unitPrice })),
      speed: effectiveSpeed,
      care,
      handback,
      zoneId: handback === "delivery" ? zone?.id : undefined,
      deliveryStart: handback === "delivery" ? deliveryStart ?? undefined : undefined,
      checkIn: { count: counted, notes: checkNotes },
      total,
      riderFee: est.riderFee,
      expressFee: est.expressFee,
      planCover: est.planCover,
      usePlan: onPlan,
      comments,
      payment: takePayment && paidValue > 0 ? { amount: paidValue, method, reference } : undefined,
    };
    const result = shop.createOrder(draft);
    if ("error" in result) return setError(result.error);
    setError(null);
    setSaved(result.order.id);
  };

  const summary = (
    <section className="adm-card" aria-labelledby="summary">
      <CardHead id="summary" title="Ticket" />
      <div className="adm-card-body stack gap-12">
        <div className="kv">
          <span className="muted">Client</span>
          <span className="truncate" style={{ maxWidth: "60%" }}>
            {mode === "existing" ? (chosen?.name ?? "Not chosen") : client.name || "New client"}
          </span>
        </div>
        {priced.map((p) => (
          <div key={p.key} className="kv">
            <span className="stack">
              <span>
                {p.service.name}
                {p.qty > 1 ? ` × ${p.qty}` : ""}
              </span>
              <span className="t-cap muted">{itemSummary(p, p.service)}</span>
            </span>
            <span>{p.service.kind === "quote" ? "Price below" : money(p.unitPrice * p.qty)}</span>
          </div>
        ))}
        {est.expressFee > 0 && (
          <div className="kv">
            <span>Express</span>
            <span>{money(est.expressFee)}</span>
          </div>
        )}
        {est.riderFee > 0 && (
          <div className="kv">
            <span>Delivery · {zone?.name}</span>
            <span>{money(est.riderFee)}</span>
          </div>
        )}
        {est.planCover > 0 && (
          <div className="kv">
            <span>{plan?.plan?.name} plan</span>
            <span>-{money(est.planCover)}</span>
          </div>
        )}
        <div className="divider" style={{ margin: 0 }} />
        <div className="kv kv-total">
          <span>Agreed price</span>
          <span>{money(total)}</span>
        </div>
        {takePayment && paidValue > 0 && (
          <>
            <div className="kv muted">
              <span>Paid now</span>
              <span>{money(paidValue)}</span>
            </div>
            <div className="kv" style={{ fontWeight: 500 }}>
              <span>Balance</span>
              <span>{money(Math.max(0, total - paidValue))}</span>
            </div>
          </>
        )}
        {readyAt && (
          <div className="kv muted">
            <span>Ready</span>
            <span>
              {fmtDayShort(readyAt)}, {fmtTime(readyAt)}
            </span>
          </div>
        )}
        {count && (
          <div className="kv muted">
            <span>Counted</span>
            <span>{plural(Math.floor(toNumber(count)), "piece")}</span>
          </div>
        )}
        {error && (
          <p className="adm-form-error" role="alert">
            {error}
          </p>
        )}
        <Cta type="submit" className="desktop-only">
          Check in and print ticket
        </Cta>
      </div>
    </section>
  );

  return (
    <AdminPage title="New drop-off" back={{ to: "/admin/orders", label: "Orders" }} status={<>For bags handed over at the counter and orders agreed on WhatsApp</>}>
      <form className="adm-detail" onSubmit={submit} noValidate>
        <div className="adm-stack">
          <section className="adm-card" aria-labelledby="who">
            <CardHead
              id="who"
              title="Client"
              action={
                <div className="segmented" role="radiogroup" aria-label="Client type" style={{ width: 220 }}>
                  <button type="button" role="radio" aria-checked={mode === "existing"} className={mode === "existing" ? "is-active" : ""} onClick={() => setMode("existing")}>
                    Existing
                  </button>
                  <button type="button" role="radio" aria-checked={mode === "new"} className={mode === "new" ? "is-active" : ""} onClick={() => setMode("new")}>
                    New client
                  </button>
                </div>
              }
            />
            <div className="adm-card-body stack gap-12">
              {mode === "existing" ? (
                chosen ? (
                  <div className="select-card is-selected" style={{ alignItems: "center", boxShadow: "none" }}>
                    <Avatar name={chosen.name} size={40} />
                    <span className="grow stack">
                      <span style={{ fontWeight: 500 }}>{chosen.name}</span>
                      <span className="t-cap muted">
                        {formatGhPhone(chosen.phone)} · {chosen.town}
                        {chosen.care ? ` · ${careSummary(chosen.care)}` : ""}
                      </span>
                      {plan?.plan && (
                        <span className="t-cap inline" style={{ gap: 4, color: "var(--label-aqua)" }}>
                          <CalendarSync size={12} /> {plan.plan.name} plan · {plan.left} of {plan.plan.baskets} baskets left
                        </span>
                      )}
                    </span>
                    <Button type="button" size="sm" onClick={() => setClientId(undefined)}>
                      Change
                    </Button>
                  </div>
                ) : (
                  <>
                    <input className="adm-input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone" aria-label="Search clients" autoFocus />
                    <div className="stack gap-8" role="listbox" aria-label="Matching clients">
                      {matches.map((c) => (
                        <button key={c.id} type="button" role="option" aria-selected={false} className="select-card" style={{ alignItems: "center", background: "var(--ground)", boxShadow: "none", padding: 12 }} onClick={() => setClientId(c.id)}>
                          <Avatar name={c.name} size={34} soft />
                          <span className="grow stack">
                            <span>{c.name}</span>
                            <span className="t-cap muted">
                              {formatGhPhone(c.phone)} · {c.town}
                            </span>
                          </span>
                        </button>
                      ))}
                      {matches.length === 0 && <p className="muted">No client with that name or number. Switch to New client.</p>}
                    </div>
                  </>
                )
              ) : (
                <div className="adm-grid adm-grid-2" style={{ gap: 16 }}>
                  <div className="field">
                    <label htmlFor="nc-name">Full name</label>
                    <input id="nc-name" value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} autoComplete="off" />
                  </div>
                  <div className="field">
                    <label htmlFor="nc-phone">WhatsApp number</label>
                    <input id="nc-phone" inputMode="tel" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} placeholder="024 123 4567" autoComplete="off" />
                  </div>
                  <div className="field">
                    <label htmlFor="nc-town">Town or area</label>
                    <input id="nc-town" value={client.town} onChange={(e) => setClient({ ...client, town: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor="nc-source">Found the shop through</label>
                    <Dropdown<LeadSource> id="nc-source" variant="field" value={client.source} onChange={(source) => setClient({ ...client, source })} options={(["walkin", "tiktok", "whatsapp", "referral"] as const).map((s) => ({ value: s, label: SOURCE_LABEL[s] }))} />
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="adm-card" aria-labelledby="items-h">
            <CardHead id="items-h" title="What's in the bag" />
            <div className="adm-card-body stack gap-16">
              {lines.map((line, i) => (
                <LineFields key={line.key} line={line} index={i} services={services} canRemove={lines.length > 1} onService={(id) => chooseService(line.key, id)} onChange={(change) => update(line.key, change)} onRemove={() => setLines((ls) => ls.filter((l) => l.key !== line.key))} />
              ))}
              <Button type="button" icon={<Plus size={16} />} onClick={() => setLines((ls) => [...ls, emptyLine(Math.max(...ls.map((l) => l.key)) + 1)])} style={{ alignSelf: "flex-start" }}>
                Add another service
              </Button>
            </div>
          </section>

          <section className="adm-card" aria-labelledby="count-h">
            <CardHead id="count-h" title="Count at the counter" />
            <div className="adm-card-body stack gap-16">
              <div className="adm-grid" style={{ gridTemplateColumns: "140px minmax(0, 1fr)", gap: 16 }}>
                <div className="field">
                  <label htmlFor="count">Garments</label>
                  <input id="count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="e.g. 18" />
                </div>
                <div className="field">
                  <label htmlFor="check-notes">Noticed when the bag was opened (optional)</label>
                  <input id="check-notes" value={checkNotes} maxLength={500} onChange={(e) => setCheckNotes(e.target.value)} placeholder="Palm oil on a white blouse, coins in a pocket" />
                </div>
              </div>
              <p className="t-cap muted">The count goes on the client's ticket and the WhatsApp message, so there's no argument at collection.</p>
            </div>
          </section>

          <section className="adm-card" aria-labelledby="care-h">
            <CardHead id="care-h" title="Speed and care" action={chosen?.care ? <span className="adm-meta">From {chosen.name.split(" ")[0]}'s preferences</span> : undefined} />
            <div className="adm-card-body stack gap-16">
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="filter-group-label">Speed</legend>
                <div className="inline" style={{ gap: 20, flexWrap: "wrap" }}>
                  <label className="check-row">
                    <input type="radio" className="rdo" name="speed" checked={effectiveSpeed === "standard"} onChange={() => setSpeed("standard")} />
                    <span>Standard · 24 hours</span>
                  </label>
                  <label className="check-row" style={!expressOk ? { opacity: 0.5 } : undefined}>
                    <input type="radio" className="rdo" name="speed" disabled={!expressOk} checked={effectiveSpeed === "express"} onChange={() => setSpeed("express")} />
                    <span>
                      Express · {RULES.expressHours} hours · +{money(RULES.expressFee)}
                    </span>
                  </label>
                </div>
                {!expressOk && priced.length > 0 && <p className="t-cap muted" style={{ marginTop: 6 }}>Suits, kente, duvets and stain rescue need their full time.</p>}
              </fieldset>
              <div className="adm-grid adm-grid-3" style={{ gap: 12 }}>
                <div className="field">
                  <label htmlFor="finish">Finish</label>
                  <Dropdown id="finish" variant="field" value={care.finish} onChange={(finish) => setCare({ ...care, finish })} options={FINISH_OPTIONS.map((o) => ({ value: o.id, label: o.label }))} />
                </div>
                <div className="field">
                  <label htmlFor="starch">Starch</label>
                  <Dropdown id="starch" variant="field" value={care.starch} onChange={(starch) => setCare({ ...care, starch })} options={STARCH_OPTIONS.map((o) => ({ value: o.id, label: o.label }))} />
                </div>
                <div className="field">
                  <label htmlFor="scent">Scent</label>
                  <Dropdown id="scent" variant="field" value={care.scent} onChange={(scent) => setCare({ ...care, scent })} options={SCENT_OPTIONS.map((o) => ({ value: o.id, label: o.label }))} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="care-notes">Care notes (optional)</label>
                <input id="care-notes" value={care.notes ?? ""} maxLength={300} onChange={(e) => setCare({ ...care, notes: e.target.value })} placeholder="Whites separately, no bleach on the blue shirts" />
              </div>
            </div>
          </section>

          <section className="adm-card" aria-labelledby="back-h">
            <CardHead id="back-h" title="How it goes back" action={readyAt ? <span className="adm-meta">Ready {fmtDayShort(readyAt)}, {fmtTime(readyAt)}</span> : undefined} />
            <div className="adm-card-body stack gap-16">
              <div className="inline" style={{ gap: 20, flexWrap: "wrap" }}>
                <label className="check-row">
                  <input type="radio" className="rdo" name="handback" checked={handback === "collect"} onChange={() => setHandback("collect")} />
                  <span>Collects at the counter</span>
                </label>
                <label className="check-row">
                  <input type="radio" className="rdo" name="handback" checked={handback === "delivery"} onChange={() => setHandback("delivery")} />
                  <span>Rider delivers</span>
                </label>
              </div>
              {handback === "delivery" && (
                <>
                  <div className="field">
                    <label htmlFor="zone">Area</label>
                    <Dropdown
                      id="zone"
                      variant="field"
                      placeholder="Choose the area"
                      value={zoneId}
                      onChange={setZoneId}
                      options={ZONES.map((z) => ({ value: z.id, label: z.name, hint: onPlan ? "Free on plan" : `${money(z.fee)} a trip` }))}
                    />
                  </div>
                  {readyAt ? (
                    <div className="stack gap-8">
                      <span className="filter-group-label">Delivery window</span>
                      <div className="chips" style={{ flexWrap: "wrap", marginInline: 0, paddingInline: 0 }}>
                        {outDays.map((d) => {
                          const key = dayKey(d);
                          return (
                            <button
                              key={key}
                              type="button"
                              className={`chip ${outDay === key ? "is-active" : ""}`}
                              onClick={() => {
                                setOutDay(key);
                                setDeliveryStart(null);
                              }}
                            >
                              {fmtDayShort(d)}
                            </button>
                          );
                        })}
                      </div>
                      {outDay && (
                        <div className="chips" style={{ flexWrap: "wrap", marginInline: 0, paddingInline: 0 }} role="radiogroup" aria-label="Delivery window">
                          {windows.map((w) => (
                            <button key={w.start} type="button" role="radio" aria-checked={deliveryStart === w.start} className={`chip ${deliveryStart === w.start ? "is-active" : ""}`} disabled={!w.available} onClick={() => setDeliveryStart(w.start)}>
                              {w.label}
                            </button>
                          ))}
                          {windows.every((w) => !w.available) && <span className="t-cap muted">No windows left that day.</span>}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="t-cap muted">Choose a service first, so we know when it's ready.</p>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="adm-card" aria-labelledby="money-h">
            <CardHead id="money-h" title="Price and payment" />
            <div className="adm-card-body stack gap-16">
              {plan?.plan && hasBaskets && (
                <label className="check-row">
                  <input type="checkbox" className="cbx" checked={usePlan} disabled={plan.left <= 0} onChange={(e) => setUsePlan(e.target.checked)} />
                  <span>
                    Take the baskets off {chosen?.name.split(" ")[0]}'s {plan.plan.name} plan ({plural(plan.left, "basket")} left)
                  </span>
                </label>
              )}
              <div className="adm-grid adm-grid-2" style={{ gap: 16 }}>
                <div className="field">
                  <label htmlFor="price">Agreed price (GH₵)</label>
                  <input
                    id="price"
                    inputMode="decimal"
                    value={priceTouched ? price : String(est.total)}
                    onChange={(e) => {
                      setPriceTouched(true);
                      setPrice(e.target.value);
                    }}
                    placeholder="Choose a service first"
                  />
                  <span className="hint">
                    From the price list {money(est.total)}
                    {priceTouched && (
                      <>
                        {" · "}
                        <button type="button" className="link" onClick={() => setPriceTouched(false)}>
                          use price list
                        </button>
                      </>
                    )}
                  </span>
                </div>
                <div className="field">
                  <label htmlFor="notes-order">Note for the order (optional)</label>
                  <input id="notes-order" value={comments} maxLength={300} onChange={(e) => setComments(e.target.value)} placeholder="Call when ready, husband collects" />
                </div>
              </div>
              <label className="check-row">
                <input type="checkbox" className="cbx" checked={takePayment} onChange={(e) => setTakePayment(e.target.checked)} />
                <span>Paid at the counter now</span>
              </label>
              {takePayment && (
                <div className="adm-grid adm-grid-3" style={{ gap: 16, alignItems: "end" }}>
                  <div className="field">
                    <label htmlFor="paid">Amount (GH₵)</label>
                    <input
                      id="paid"
                      inputMode="decimal"
                      value={paidTouched ? paid : String(paidValue || "")}
                      onChange={(e) => {
                        setPaidTouched(true);
                        setPaid(e.target.value);
                      }}
                    />
                  </div>
                  <div className="segmented" role="radiogroup" aria-label="Paid by">
                    {METHODS.map((m) => (
                      <button key={m.id} type="button" role="radio" aria-checked={method === m.id} className={method === m.id ? "is-active" : ""} onClick={() => setMethod(m.id)}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {method !== "cash" ? (
                    <div className="field">
                      <label htmlFor="ref">{method === "momo" ? "MoMo transaction ID" : "Reference"} (optional)</label>
                      <input id="ref" value={reference} maxLength={40} onChange={(e) => setReference(e.target.value)} />
                    </div>
                  ) : (
                    <span />
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="adm-detail-aside">{summary}</aside>

        <div className="sticky-bar mobile-only" style={{ bottom: "calc(84px + var(--safe-bottom))", borderRadius: 16, margin: "0 0 8px" }}>
          <span className="sticky-bar-meta">
            <strong>{money(total)}</strong>
            <span className="t-cap muted">{readyAt ? `Ready ${fmtDayShort(readyAt)}, ${fmtTime(readyAt)}` : "Choose a service"}</span>
          </span>
          <Button variant="dark" type="submit" icon={<Check size={16} />}>
            Check in
          </Button>
        </div>
      </form>
      <SuccessScreen open={saved !== null} title="Checked in" onDone={openSaved} />
    </AdminPage>
  );
}

function LineFields({ line, index, services, canRemove, onService, onChange, onRemove }: { line: Draft; index: number; services: DropdownOption<string>[]; canRemove: boolean; onService: (id: string) => void; onChange: (change: Partial<Draft>) => void; onRemove: () => void }) {
  const service = serviceById(line.serviceId);
  const min = service?.minQty ?? 1;
  return (
    <fieldset className="stack gap-12" style={{ border: 0, padding: index ? "16px 0 0" : 0, margin: 0, borderTop: index ? "1px solid var(--ink-06)" : undefined }}>
      <legend className="sr-only">Service {index + 1}</legend>
      <div className="adm-grid" style={{ gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "end" }}>
        <div className="field">
          <label htmlFor={`service-${line.key}`}>Service</label>
          <Dropdown id={`service-${line.key}`} variant="field" placeholder="Choose from the price list" value={line.serviceId} onChange={onService} options={services} />
        </div>
        <div className="inline" style={{ gap: 6 }} aria-label="Quantity">
          <button type="button" className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => onChange({ qty: Math.max(min, line.qty - 1) })} aria-label="One fewer">
            <Minus size={16} />
          </button>
          <input className="adm-input" style={{ width: 56, height: 40, textAlign: "center", padding: 0 }} inputMode="numeric" value={line.qty} onChange={(e) => onChange({ qty: Math.max(min, Math.min(100, Math.round(toNumber(e.target.value)) || min)) })} aria-label="Quantity" />
          <button type="button" className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => onChange({ qty: Math.min(100, line.qty + 1) })} aria-label="One more">
            <Plus size={16} />
          </button>
        </div>
      </div>
      {service && service.category !== "baskets" && (
        <div className="field">
          <label htmlFor={`note-${line.key}`}>Note on this item (optional)</label>
          <input id={`note-${line.key}`} value={line.note ?? ""} maxLength={80} onChange={(e) => onChange({ note: e.target.value })} placeholder={service.id === "stain" ? "Palm oil on the white blouse" : "Navy suit, button loose on the cuff"} />
        </div>
      )}
      {service && <p className="t-cap muted">{itemSummary(line, service)}</p>}
      {canRemove && (
        <button type="button" className="adm-link" style={{ alignSelf: "flex-start", color: "var(--ink-75)" }} onClick={onRemove}>
          <Trash2 size={14} /> Remove this service
        </button>
      )}
    </fieldset>
  );
}

