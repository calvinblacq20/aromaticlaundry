import { CalendarSync, CircleAlert, Printer, Send, Share2, Wallet } from "lucide-react";
import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Avatar, Badge, Skeleton } from "../../components/Bits";
import { Button } from "../../components/Button";
import { useNotify } from "../../components/Notify";
import { planSubject, ReceiptDoc, receiptShareText } from "../../components/ReceiptDoc";
import { Sheet } from "../../components/Sheet";
import { planById } from "../../data/catalog";
import { customerById, shop, useAppData } from "../../data/store";
import type { PaymentMethod, Subscription } from "../../data/types";
import { whatsappLink } from "../../lib/contact";
import { dayKey, fmtDate, money, parseLocal, plural } from "../../lib/format";
import { planStatus, type PlanStatus } from "../../lib/plans";
import { METHOD_LABEL, renewalMessage } from "../../lib/shop";
import type { BadgeTone } from "../../lib/orders";
import { CardHead } from "../controls";
import { useFirstLoad, useNow } from "../hooks";
import { AdminPage, EmptyState } from "../Shell";
import { ConfirmSheet } from "../sheets";

type Filter = "active" | "ending" | "all";

const METHODS: PaymentMethod[] = ["momo", "cash", "bank"];

/** Where a plan stands, in the owner's words. */
function standing(sub: Subscription, status: PlanStatus): { label: string; tone: BadgeTone } {
  if (sub.status === "cancelled") return { label: "Stopped", tone: "mist" };
  if (status.lapsed) return { label: "Lapsed · renewal due", tone: "sand" };
  if (sub.endsAtRenewal) return { label: `Ends in ${plural(status.renewsIn, "day")}`, tone: "lilac" };
  if (status.renewsIn <= 3) return { label: status.renewsIn === 0 ? "Renews today" : `Renews in ${plural(status.renewsIn, "day")}`, tone: "sand" };
  return { label: "Active", tone: "aqua" };
}

export function Plans() {
  const data = useAppData();
  const now = useNow();
  const notify = useNotify();
  const loading = useFirstLoad("plans");
  const [filter, setFilter] = useState<Filter>("active");
  const [paying, setPaying] = useState<Subscription | null>(null);
  const [stopping, setStopping] = useState<Subscription | null>(null);

  const rows = useMemo(
    () =>
      data.subscriptions
        .map((sub) => ({ sub, status: planStatus(sub, data.orders, now), customer: customerById(data, sub.customerId) }))
        .sort((a, b) => a.sub.renewsOn.localeCompare(b.sub.renewsOn)),
    [data, now],
  );
  const live = rows.filter((r) => r.sub.status === "active" && !r.status.lapsed);
  const shown = rows.filter((r) => (filter === "all" ? true : filter === "ending" ? r.sub.status === "active" && (r.sub.endsAtRenewal || r.status.lapsed || r.status.renewsIn <= 7) : r.sub.status === "active" && !r.status.lapsed));
  const monthly = live.filter((r) => !r.sub.endsAtRenewal).reduce((s, r) => s + (r.status.plan?.price ?? 0), 0);
  const used = live.reduce((s, r) => s + r.status.used, 0);
  const allowance = live.reduce((s, r) => s + (r.status.plan?.baskets ?? 0), 0);

  return (
    <AdminPage
      title="Plans"
      status={
        <>
          {plural(live.length, "member")} · {money(monthly)} a month in renewals
        </>
      }
      actions={
        <Link className="btn btn-outline" to="/admin/services">
          Edit plans
        </Link>
      }
    >
      <div className="adm-grid adm-grid-3" style={{ marginBottom: 16 }}>
        <section className="adm-card">
          <div className="adm-card-body" style={{ paddingTop: 18 }}>
            <p className="adm-meta">Members</p>
            <p className="adm-big" style={{ marginTop: 6, color: "var(--ink)" }}>
              {live.length}
            </p>
            <p className="muted">{data.plans.map((p) => `${live.filter((r) => r.sub.planId === p.id).length} ${p.name}`).join(" · ")}</p>
          </div>
        </section>
        <section className="adm-card">
          <div className="adm-card-body" style={{ paddingTop: 18 }}>
            <p className="adm-meta">Renewals a month</p>
            <p className="adm-big" style={{ marginTop: 6, color: "var(--ink)" }}>
              {money(monthly)}
            </p>
            <p className="muted">Paid up front, before a single basket is washed.</p>
          </div>
        </section>
        <section className="adm-card">
          <div className="adm-card-body" style={{ paddingTop: 18 }}>
            <p className="adm-meta">Basket washes used this month</p>
            <p className="adm-big" style={{ marginTop: 6, color: "var(--ink)" }}>
              {used} <span className="muted" style={{ fontSize: 20 }}>of {allowance}</span>
            </p>
            <div className="meter" aria-hidden="true" style={{ marginTop: 8 }}>
              <i style={{ width: `${allowance ? Math.min(100, (used / allowance) * 100) : 0}%` }} />
            </div>
          </div>
        </section>
      </div>

      <div className="chips" role="radiogroup" aria-label="Which plans" style={{ margin: "0 0 12px" }}>
        {(
          [
            ["active", "Active"],
            ["ending", "Renewing or ending soon"],
            ["all", "All, including stopped"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="radio" aria-checked={filter === id} className={`chip ${filter === id ? "is-active" : ""}`} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton h={360} r={8} />
      ) : shown.length === 0 ? (
        <div className="adm-card">
          <EmptyState icon={<CalendarSync size={22} />} title={rows.length ? "No plans here" : "No members yet"} body={rows.length ? "Try another filter." : "Clients join from Plans in the app. Their monthly payments and baskets show here."} />
        </div>
      ) : (
        <section className="adm-card" aria-label="Members">
          <div className="adm-rows" style={{ paddingBlock: 4 }}>
            {shown.map(({ sub, status, customer }) => {
              const badge = standing(sub, status);
              return (
                <div key={sub.id} className="adm-row" style={{ flexWrap: "wrap", rowGap: 10, paddingBlock: 12 }}>
                  <Avatar name={customer?.name ?? "?"} size={36} soft />
                  <span className="grow stack" style={{ minWidth: 180 }}>
                    <span style={{ fontWeight: 500 }}>{customer ? <Link to={`/admin/clients/${customer.id}?tab=care`}>{customer.name}</Link> : "Client"}</span>
                    <span className="t-cap muted">
                      {status.plan?.name} · {money(status.plan?.price ?? 0)} · since {fmtDate(new Date(sub.startedAt))}
                    </span>
                  </span>
                  <span className="stack" style={{ width: 170, gap: 4 }}>
                    <span className="t-cap muted">
                      {status.used} of {status.plan?.baskets ?? 0} baskets · {sub.endsAtRenewal ? "ends" : "renews"} {fmtDate(parseLocal(sub.renewsOn))}
                    </span>
                    <span className="meter" aria-hidden="true">
                      <i style={{ width: `${Math.min(100, (status.used / Math.max(1, status.plan?.baskets ?? 1)) * 100)}%` }} />
                    </span>
                  </span>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                  <span className="inline" style={{ gap: 6, marginLeft: "auto" }}>
                    {sub.status === "active" && customer && (
                      <a className="btn btn-soft btn-sm" href={whatsappLink(customer.phone, renewalMessage(sub, customer, now))} target="_blank" rel="noreferrer" aria-label={`Send ${customer.name} a renewal reminder`}>
                        <Send size={14} /> Remind
                      </a>
                    )}
                    {sub.status !== "cancelled" && (
                      <button className="btn btn-dark btn-sm" onClick={() => setPaying(sub)}>
                        <Wallet size={14} /> Record renewal
                      </button>
                    )}
                    {sub.status === "active" && (
                      <button className="btn btn-outline btn-sm" onClick={() => setStopping(sub)}>
                        Stop
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="adm-card-foot">
            <span className="adm-meta">A renewal paid early starts the next month when the current one ends. One paid late starts it today.</span>
          </div>
        </section>
      )}

      <section className="adm-card" style={{ marginTop: 16 }} aria-labelledby="plan-payments">
        <CardHead id="plan-payments" title="Plan payments" />
        <div className="adm-rows" style={{ paddingBlock: 4 }}>
          {rows
            .flatMap(({ sub, customer }) => sub.payments.map((p) => ({ sub, customer, p })))
            .sort((a, b) => b.p.at.localeCompare(a.p.at))
            .slice(0, 12)
            .map(({ sub, customer, p }) => (
              <Link key={p.id} to={`/admin/plans/${sub.id}/receipts/${p.id}`} className="adm-row">
                <span className="grow stack">
                  <span>
                    {customer?.name} · {planById(sub.planId)?.name} plan
                  </span>
                  <span className="t-cap muted">
                    <span className="t-mono">{p.receiptNo}</span> · {fmtDate(new Date(p.at))} · {METHOD_LABEL[p.method]}
                  </span>
                </span>
                <span className="tabular" style={{ fontWeight: 500 }}>
                  {money(p.amount)}
                </span>
              </Link>
            ))}
        </div>
      </section>

      <RenewalSheet subscription={paying} onClose={() => setPaying(null)} />
      <ConfirmSheet
        open={stopping !== null}
        onClose={() => setStopping(null)}
        danger
        title="Stop this plan now?"
        body={stopping ? `${customerById(data, stopping.customerId)?.name ?? "The client"}'s basket washes stop straight away, before ${fmtDate(parseLocal(stopping.renewsOn))}. Settle any refund with them directly. To let the month run out instead, leave it: it simply won't be renewed.` : ""}
        confirmLabel="Stop plan"
        onConfirm={() => {
          if (stopping) shop.setSubscriptionStatus(stopping.id, "cancelled");
          setStopping(null);
          notify("Plan stopped", "It no longer covers baskets. Its payments stay in your books.");
        }}
      />
    </AdminPage>
  );
}

function RenewalSheet({ subscription, onClose }: { subscription: Subscription | null; onClose: () => void }) {
  const data = useAppData();
  const notify = useNotify();
  const id = useId();
  const [method, setMethod] = useState<PaymentMethod>("momo");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const plan = subscription ? planById(subscription.planId) : undefined;
  const customer = subscription ? customerById(data, subscription.customerId) : undefined;
  useEffect(() => {
    if (!subscription) return;
    setMethod("momo");
    setReference("");
    setError(null);
  }, [subscription]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!subscription || !plan) return;
    const result = shop.recordPlanPayment(subscription.id, { amount: plan.price, method, reference: method === "cash" ? undefined : reference });
    if ("error" in result) return setError(result.error);
    onClose();
    notify("Renewal recorded", `${money(plan.price)} from ${customer?.name ?? "the client"}. Receipt ${result.payment.receiptNo}. The next month is on.`);
  };

  return (
    <Sheet open={subscription !== null} onClose={onClose} title="Record a renewal">
      {subscription && plan && (
        <form className="stack gap-16" onSubmit={submit} noValidate>
          <p className="muted" style={{ marginTop: -8 }}>
            {customer?.name} · {plan.name} plan · {subscription.renewsOn > dayKey(new Date()) ? `current month ends ${fmtDate(parseLocal(subscription.renewsOn))}` : "lapsed, the new month starts today"}
          </p>
          <div className="kv">
            <span className="muted">One month</span>
            <span style={{ fontWeight: 500 }}>{money(plan.price)}</span>
          </div>
          <div className="stack gap-8">
            <span className="t-cap muted" id={`${id}-method`}>
              Paid by
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby={`${id}-method`}>
              {METHODS.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "is-active" : ""} onClick={() => setMethod(m)}>
                  {METHOD_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          {method !== "cash" && (
            <div className="stack gap-8">
              <label htmlFor={`${id}-ref`} className="t-cap muted">
                {method === "momo" ? "MoMo transaction ID (optional)" : "Reference (optional)"}
              </label>
              <input id={`${id}-ref`} className="adm-input" value={reference} maxLength={40} onChange={(e) => setReference(e.target.value)} />
            </div>
          )}
          {error && (
            <p className="adm-form-error" role="alert">
              {error}
            </p>
          )}
          <Button variant="dark" block type="submit">
            Record {money(plan.price)}
          </Button>
        </form>
      )}
    </Sheet>
  );
}

/** A plan payment's official receipt, from the owner side. */
export function AdminPlanReceipt() {
  const { subscriptionId, paymentId } = useParams();
  const data = useAppData();
  const notify = useNotify();
  const sub = data.subscriptions.find((s) => s.id === subscriptionId);
  const payment = sub?.payments.find((p) => p.id === paymentId);
  if (!sub || !payment) {
    return (
      <AdminPage title="Receipt not found" back={{ to: "/admin/plans", label: "Plans" }}>
        <EmptyState icon={<CircleAlert size={22} />} title="We couldn't find that receipt" body="Open it from the plan payments list." />
      </AdminPage>
    );
  }
  const subject = planSubject(sub, payment, planById(sub.planId)?.name ?? "Monthly");
  const customer = customerById(data, sub.customerId);
  const share = async () => {
    const text = receiptShareText(subject, payment);
    try {
      if (navigator.share) await navigator.share({ title: `Receipt ${payment.receiptNo}`, text });
      else {
        await navigator.clipboard.writeText(text);
        notify("Receipt copied", "Paste it into WhatsApp for the client.");
      }
    } catch {
      /* share sheet closed */
    }
  };
  return (
    <AdminPage
      title="Receipt"
      barTitle={payment.receiptNo}
      back={{ to: "/admin/plans", label: "Plans" }}
      status={<span className="t-mono">{payment.receiptNo}</span>}
      actions={
        <span className="inline no-print" style={{ gap: 8 }}>
          <Button icon={<Share2 size={16} />} onClick={share}>
            Share
          </Button>
          <Button variant="dark" icon={<Printer size={16} />} onClick={() => window.print()}>
            Print
          </Button>
        </span>
      }
    >
      <div style={{ maxWidth: 640 }}>
        <ReceiptDoc subject={subject} payment={payment} customer={customer} />
      </div>
    </AdminPage>
  );
}
