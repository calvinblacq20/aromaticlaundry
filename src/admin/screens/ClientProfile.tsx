import { CalendarSync, ChevronRight, CircleAlert, Droplet, Inbox, MessageCircle, NotebookPen, Phone, ReceiptText, Send } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Avatar } from "../../components/Bits";
import { Button, Cta } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import { SHOP } from "../../data/business";
import { DEFAULT_CARE, FINISH_OPTIONS, SCENT_OPTIONS, STARCH_OPTIONS, planById } from "../../data/catalog";
import { shop, useAppData } from "../../data/store";
import type { CarePrefs, Customer } from "../../data/types";
import { formatGhPhone, telLink, whatsappLink } from "../../lib/contact";
import { fmtDate, fmtTime, money, parseLocal, plural } from "../../lib/format";
import { clientRows } from "../../lib/filters";
import { activeSubscription, planStatus } from "../../lib/plans";
import { METHOD_LABEL, SOURCE_LABEL, renewalMessage } from "../../lib/shop";
import { Dropdown } from "../../components/Dropdown";
import { enter } from "../../motion";
import { useFirstVisit, useNow } from "../hooks";
import { OrderCard, useOrderActions } from "../orderActions";
import { AdminPage, EmptyState } from "../Shell";

type Tab = "orders" | "care" | "notebook" | "payments";
const TABS: { id: Tab; label: string }[] = [
  { id: "orders", label: "Orders" },
  { id: "care", label: "Care & plan" },
  { id: "notebook", label: "Notebook" },
  { id: "payments", label: "Payments" },
];

export function ClientProfile() {
  const { clientId } = useParams();
  const data = useAppData();
  const customer = data.customers.find((c) => c.id === clientId);
  if (!customer) {
    return (
      <AdminPage title="Client not found" back={{ to: "/admin/clients", label: "Clients" }}>
        <EmptyState icon={<CircleAlert size={22} />} title="We couldn't find that client" body="They may have been removed when the demo was reset." action={<Link to="/admin/clients" className="btn btn-dark">All clients</Link>} />
      </AdminPage>
    );
  }
  return <ProfileView customer={customer} />;
}

function ProfileView({ customer }: { customer: Customer }) {
  const data = useAppData();
  const now = useNow();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "orders") as Tab;
  const first = useFirstVisit(`client:${customer.id}`);
  const actions = useOrderActions();
  const row = useMemo(() => clientRows([customer], data.orders)[0]!, [customer, data.orders]);
  const orders = data.orders.filter((o) => o.customerId === customer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const subscription = activeSubscription(data.subscriptions, customer.id, now);
  const status = subscription ? planStatus(subscription, data.orders, now) : null;
  // Order receipts and plan receipts together; plan receipts open from the plans page.
  const payments = [
    ...orders.flatMap((o) => o.payments.map((p) => ({ payment: p, ref: o.number, to: `/admin/orders/${o.id}/receipts/${p.id}` }))),
    ...data.subscriptions.filter((s) => s.customerId === customer.id).flatMap((s) => s.payments.map((p) => ({ payment: p, ref: `${planById(s.planId)?.name ?? "Monthly"} plan`, to: `/admin/plans/${s.id}/receipts/${p.id}` }))),
  ].sort((a, b) => b.payment.at.localeCompare(a.payment.at));
  const firstName = customer.name.split(" ")[0];

  return (
    <AdminPage
      title={customer.name}
      back={{ to: "/admin/clients", label: "Clients" }}
      status={
        <>
          <span className="tabular">{formatGhPhone(customer.phone)}</span> · {customer.town || "Town not given"} · {SOURCE_LABEL[customer.source ?? "app"]}
        </>
      }
      actions={
        <>
          <a className="btn btn-outline" href={whatsappLink(customer.phone, `Hi ${firstName}, it's ${SHOP.name}.`)} target="_blank" rel="noreferrer">
            <MessageCircle size={16} /> WhatsApp
          </a>
          <a className="btn btn-outline" href={telLink(customer.phone)}>
            <Phone size={16} /> Call
          </a>
          <Cta onClick={() => navigate(`/admin/orders/new?client=${customer.id}`)}>New drop-off</Cta>
        </>
      }
    >
      <motion.section className="adm-card" style={{ marginBottom: 16 }} {...(first ? enter(16) : {})} aria-label="Summary">
        <div className="adm-card-body" style={{ paddingTop: 20, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <Avatar name={customer.name} size={56} />
          <dl className="adm-kv-grid is-4" style={{ flex: 1, minWidth: 260 }}>
            <div>
              <dt>Paid to date</dt>
              <dd className="big">{money(row.spend)}</dd>
            </div>
            <div>
              <dt>Orders</dt>
              <dd className="big">{row.orders}</dd>
            </div>
            <div>
              <dt>Unpaid</dt>
              <dd className="big" style={row.owed > 0 ? { color: "var(--warning-ink)" } : undefined}>
                {money(row.owed)}
              </dd>
            </div>
            <div>
              <dt>With us since</dt>
              <dd className="big">{fmtDate(new Date(customer.memberSince)).replace(/^\d+ /, "")}</dd>
            </div>
          </dl>
        </div>
      </motion.section>

      <div className="segmented" role="tablist" aria-label="Client details" style={{ maxWidth: 520, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-active" : ""} onClick={() => setParams(t.id === "orders" ? {} : { tab: t.id }, { replace: true })}>
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
        {tab === "orders" &&
          (orders.length ? (
            <div className="res-list" style={{ maxWidth: 860 }}>
              {orders.map((o) => (
                <OrderCard key={o.id} order={o} customer={customer} now={now} onStep={actions.run} onMenu={(x) => actions.open(x.id, "menu")} showClient={false} />
              ))}
            </div>
          ) : (
            <div className="adm-card">
              <EmptyState icon={<Inbox size={22} />} title="No orders yet" action={<Link className="btn btn-dark" to={`/admin/orders/new?client=${customer.id}`}>Check in a drop-off</Link>} />
            </div>
          ))}

        {tab === "care" && (
          <div className="adm-grid adm-grid-2" style={{ maxWidth: 980, alignItems: "start" }}>
            <CareCard customer={customer} />
            <section className="adm-card" aria-labelledby="plan-h">
              <div className="adm-card-head">
                <h2 id="plan-h" className="inline" style={{ gap: 8 }}>
                  <CalendarSync size={17} /> Monthly plan
                </h2>
                <Link to="/admin/plans" className="adm-link">
                  All plans
                </Link>
              </div>
              {subscription && status?.plan ? (
                <div className="adm-card-body stack gap-12">
                  <div className="kv">
                    <span style={{ fontWeight: 500 }}>{status.plan.name}</span>
                    <span>{money(status.plan.price)} a month</span>
                  </div>
                  <div className="meter" aria-hidden="true">
                    <i style={{ width: `${Math.min(100, (status.used / Math.max(1, status.plan.baskets)) * 100)}%` }} />
                  </div>
                  <p className="t-cap muted">
                    {status.used} of {status.plan.baskets} basket washes used · {subscription.endsAtRenewal ? "ends" : "renews"} {fmtDate(parseLocal(subscription.renewsOn))}
                  </p>
                  {!subscription.endsAtRenewal && status.renewsIn <= 7 && (
                    <a className="btn btn-soft btn-sm" style={{ alignSelf: "flex-start" }} href={whatsappLink(customer.phone, renewalMessage(subscription, customer, now))} target="_blank" rel="noreferrer">
                      <Send size={14} /> Send renewal reminder
                    </a>
                  )}
                </div>
              ) : (
                <EmptyState icon={<CalendarSync size={22} />} title="Not on a plan" body={`${firstName} pays per order. Clients join plans in the app, under Plans.`} />
              )}
            </section>
          </div>
        )}

        {tab === "notebook" && <Notebook customer={customer} />}

        {tab === "payments" &&
          (payments.length ? (
            <section className="adm-card" style={{ maxWidth: 860 }}>
              <div className="adm-rows" style={{ paddingBlock: 4 }}>
                {payments.map(({ payment, ref, to }) => (
                  <Link key={payment.id} to={to} className="adm-row">
                    <span className="row-icon">
                      <ReceiptText size={18} strokeWidth={1.7} />
                    </span>
                    <span className="grow stack">
                      <span>
                        {ref} · {METHOD_LABEL[payment.method]}
                      </span>
                      <span className="t-cap muted">
                        <span className="t-mono">{payment.receiptNo}</span> · {fmtDate(new Date(payment.at))}, {fmtTime(new Date(payment.at))}
                      </span>
                    </span>
                    <span className="tabular" style={{ fontWeight: 500 }}>
                      {money(payment.amount)}
                    </span>
                    <ChevronRight size={18} className="row-chevron" />
                  </Link>
                ))}
              </div>
            </section>
          ) : (
            <div className="adm-card">
              <EmptyState icon={<ReceiptText size={22} />} title="No payments yet" />
            </div>
          ))}
      </div>
      {actions.sheets}
    </AdminPage>
  );
}

function Notebook({ customer }: { customer: Customer }) {
  const notify = useNotify();
  const [text, setText] = useState(customer.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setText(customer.notes ?? ""), [customer.id, customer.notes]);
  const dirty = text.trim() !== (customer.notes ?? "");
  const save = () => {
    const result = shop.saveNotes(customer.id, text);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    notify("Notebook saved", `Notes for ${customer.name} are up to date.`);
  };
  return (
    <section className="adm-card" style={{ maxWidth: 760 }} aria-labelledby="notebook">
      <div className="adm-card-head">
        <h2 id="notebook" className="inline" style={{ gap: 8 }}>
          <NotebookPen size={17} /> Your notebook
        </h2>
        <span className="adm-meta">Only you see this</span>
      </div>
      <div className="adm-card-body stack gap-12">
        <label htmlFor="notes" className="sr-only">
          Notes about {customer.name}
        </label>
        <textarea id="notes" className="adm-textarea" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder={`Notes about ${customer.name.split(" ")[0]}: gate codes, who to call when the rider arrives, what never gets starch, how they like to pay…`} />
        <div className="between">
          <span className="t-cap muted">{plural(text.length, "character")} of 4,000</span>
          <Button variant="dark" disabled={!dirty} onClick={save}>
            Save notes
          </Button>
        </div>
        {error && (
          <p className="adm-form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

/** How the client likes it done. The counter can update it after a call, and the client sees the same thing in the app. */
function CareCard({ customer }: { customer: Customer }) {
  const notify = useNotify();
  const [care, setCare] = useState<CarePrefs>(customer.care ?? DEFAULT_CARE);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setCare(customer.care ?? DEFAULT_CARE), [customer.id, customer.care]);
  const save = () => {
    const result = shop.saveCare(customer.id, care);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    notify("Care saved", `${customer.name.split(" ")[0]}'s preferences go on every new ticket.`);
  };
  return (
    <section className="adm-card" aria-labelledby="care-h">
      <div className="adm-card-head">
        <h2 id="care-h" className="inline" style={{ gap: 8 }}>
          <Droplet size={17} /> Care preferences
        </h2>
        <span className="adm-meta">{customer.care ? "Set by the client or the counter" : "Not set yet"}</span>
      </div>
      <div className="adm-card-body stack gap-12">
        <div className="adm-grid adm-grid-3" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="cp-finish">Finish</label>
            <Dropdown id="cp-finish" variant="field" value={care.finish} onChange={(finish) => setCare({ ...care, finish })} options={FINISH_OPTIONS.map((o) => ({ value: o.id, label: o.label }))} />
          </div>
          <div className="field">
            <label htmlFor="cp-starch">Starch</label>
            <Dropdown id="cp-starch" variant="field" value={care.starch} onChange={(starch) => setCare({ ...care, starch })} options={STARCH_OPTIONS.map((o) => ({ value: o.id, label: o.label }))} />
          </div>
          <div className="field">
            <label htmlFor="cp-scent">Scent</label>
            <Dropdown id="cp-scent" variant="field" value={care.scent} onChange={(scent) => setCare({ ...care, scent })} options={SCENT_OPTIONS.map((o) => ({ value: o.id, label: o.label }))} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="cp-notes">Care notes</label>
          <input id="cp-notes" value={care.notes ?? ""} maxLength={300} onChange={(e) => setCare({ ...care, notes: e.target.value })} placeholder="Whites separately, unscented for the baby's things" />
        </div>
        {error && (
          <p className="adm-form-error" role="alert">
            {error}
          </p>
        )}
        <Button variant="dark" onClick={save} style={{ alignSelf: "flex-start" }}>
          Save care
        </Button>
      </div>
    </section>
  );
}
