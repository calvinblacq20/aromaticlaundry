import { CalendarSync, Check, ChevronRight, Lock, ReceiptText, ShoppingBasket } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Skeleton, useSkeleton } from "../components/Bits";
import { Button, Cta } from "../components/Button";
import { TopBar } from "../components/Chrome";
import { useNotify } from "../components/Notify";
import { SuccessScreen } from "../components/Overlays";
import { PaystackSheet } from "../components/Paystack";
import { Reveal } from "../components/Reveal";
import { Sheet } from "../components/Sheet";
import { SHOP } from "../data/business";
import { PLANS, planById } from "../data/catalog";
import { accountOf, accountPlanOf, actions, useAppData, type OnlinePayment } from "../data/store";
import type { Plan } from "../data/types";
import { whatsappLink } from "../lib/contact";
import { fmtDate, fmtDayLong, money, parseLocal, plural } from "../lib/format";
import { planStatus } from "../lib/plans";
import { spring } from "../motion";

const FAQ = [
  { q: "What counts as a basket?", a: "Any of the three baskets on the price list: small, medium or big. Each pickup uses one basket wash, whatever its size, so fill it up." },
  { q: "Can the whole family share it?", a: "Yes. The plan belongs to your account, not to one person's clothes. The Family plan is built for a whole house: uniforms, bedding and baby things included." },
  { q: "What if I don't use all my baskets?", a: "Unused basket washes don't carry over to the next month, so book your pickups through the month. Renewing early starts a fresh month straight away." },
  { q: "What isn't covered?", a: "Suits, kente, duvets, ironing-only items and express are charged as usual from the price list. Rider trips are free on every plan order." },
];

/** Monthly plans: what they cost, what they cover, and the signed-in client's own plan. */
export function Plans() {
  const loading = useSkeleton(500);
  const data = useAppData();
  const notify = useNotify();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const account = accountOf(data);
  const now = new Date();
  const subscription = accountPlanOf(data, now);
  const status = subscription ? planStatus(subscription, data.orders, now) : null;
  const [joining, setJoining] = useState<Plan | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [joinedShow, setJoinedShow] = useState(false);

  // ?join=plan-solo opens the payment straight away for a signed-in client without a plan.
  useEffect(() => {
    const id = params.get("join");
    if (!id || loading) return;
    const plan = planById(id);
    if (plan && account && !subscription) setJoining(plan);
    setParams({}, { replace: true });
  }, [params, loading, account, subscription, setParams]);

  const join = useCallback(
    (payment: OnlinePayment): string | null => {
      if (!joining) return "Choose a plan first.";
      const result = actions.joinPlan(joining.id, payment);
      if ("error" in result) return result.error;
      setJoining(null);
      setJoinedShow(true);
      return null;
    },
    [joining],
  );

  const renew = useCallback(
    (payment: OnlinePayment): string | null => {
      if (!subscription) return "We couldn't find your plan.";
      const result = actions.renewPlan(subscription.id, payment);
      if ("error" in result) return result.error;
      setRenewOpen(false);
      window.setTimeout(() => notify("Plan renewed", `Receipt ${result.payment.receiptNo} is ready. Your new month has started.`), 400);
      return null;
    },
    [subscription, notify],
  );

  const choose = (plan: Plan) => {
    if (!account) {
      navigate(`/login?next=${encodeURIComponent(`/plans?join=${plan.id}`)}`);
      return;
    }
    setJoining(plan);
  };

  const myPayments = subscription ? [...subscription.payments].sort((a, b) => b.at.localeCompare(a.at)) : [];

  return (
    <main className="screen is-narrow">
      <TopBar back backRow="Back" title="Monthly plans" />
      <header className="page-title">
        <h1 className="t-h1">Monthly plans</h1>
        <p className="muted">Your laundry, taken off your list for the month. Pay once, book your pickups, and the rider comes and goes for free.</p>
      </header>

      {loading ? (
        <div className="stack gap-16" aria-busy="true">
          <Skeleton h={180} r={8} />
          <Skeleton h={260} r={8} />
        </div>
      ) : (
        <div className="stack gap-16">
          {subscription && status?.plan && (
            <Reveal as="section" className="card card-pad stack gap-16">
              <div className="between" style={{ alignItems: "flex-start", gap: 12 }}>
                <div className="stack gap-4">
                  <span className="badge is-aqua" style={{ paddingRight: 10, alignSelf: "flex-start" }}>
                    <span className="badge-well" aria-hidden="true">
                      <CalendarSync size={13} />
                    </span>
                    Your plan
                  </span>
                  <p className="t-h3">{status.plan.name}</p>
                  <p className="subtle t-cap">
                    {money(status.plan.price)} a month · {subscription.endsAtRenewal ? "ends" : "renews"} {fmtDayLong(parseLocal(subscription.renewsOn))}
                  </p>
                </div>
              </div>
              <div className="stack gap-8">
                <div className="between t-body">
                  <span>
                    {plural(status.used, "basket wash", "basket washes")} used
                  </span>
                  <strong style={{ fontWeight: 500 }}>{status.left} left</strong>
                </div>
                <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={status.plan.baskets} aria-valuenow={status.used} aria-label="Basket washes used this month">
                  <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(1, status.used / Math.max(1, status.plan.baskets)) }} transition={spring.settle} style={{ transformOrigin: "left", right: 0 }} />
                </div>
                <p className="subtle t-cap">
                  {status.left > 0 ? `${plural(status.left, "basket wash", "basket washes")} to use before ${fmtDayLong(parseLocal(subscription.renewsOn))}.` : "This month's basket washes are used. Renew early to start a new month now."}
                </p>
              </div>
              <div className="inline" style={{ gap: 8, flexWrap: "wrap" }}>
                {status.left > 0 ? (
                  <Cta onClick={() => navigate("/order/new?service=big-basket")}>Book a pickup</Cta>
                ) : (
                  <Cta onClick={() => setRenewOpen(true)}>Renew for {money(status.plan.price)}</Cta>
                )}
                {status.left > 0 && (
                  <Button size="sm" onClick={() => setRenewOpen(true)}>
                    Renew early
                  </Button>
                )}
              </div>
              {myPayments.length > 0 && (
                <div className="list-card" style={{ marginInline: -16, marginBottom: -8 }}>
                  {myPayments.map((p) => (
                    <Link key={p.id} className="row" to={`/plans/${subscription.id}/receipts/${p.id}`}>
                      <span className="row-icon">
                        <ReceiptText size={18} strokeWidth={1.7} />
                      </span>
                      <span className="grow stack">
                        <span>Plan receipt</span>
                        <span className="t-cap subtle">
                          <span className="t-mono">{p.receiptNo}</span> · {fmtDate(new Date(p.at))}
                        </span>
                      </span>
                      <span className="tabular">{money(p.amount)}</span>
                      <ChevronRight size={18} className="row-chevron" />
                    </Link>
                  ))}
                </div>
              )}
              {subscription.endsAtRenewal ? (
                <p className="info-line t-cap muted">
                  <CalendarSync size={14} />
                  <span>
                    Cancelled: it won't renew.{" "}
                    <button
                      className="link"
                      onClick={() => {
                        actions.keepPlan(subscription.id);
                        notify("Plan kept", "It renews as usual.");
                      }}
                    >
                      Keep my plan
                    </button>
                  </span>
                </p>
              ) : (
                <button className="link t-cap" style={{ alignSelf: "flex-start" }} onClick={() => setCancelOpen(true)}>
                  Cancel plan
                </button>
              )}
            </Reveal>
          )}

          <section className="stack gap-12">
            {subscription && <h2 className="t-h3">All plans</h2>}
            <div className="plan-grid">
              {PLANS.map((plan, i) => {
                const mine = subscription?.planId === plan.id;
                return (
                  <Reveal key={plan.id} className={`plan-card ${plan.featured ? "is-featured" : ""}`} y={24} delay={0.08 * i}>
                    <div className="stack gap-4">
                      <div className="between">
                        <p className="t-title">{plan.name}</p>
                        {mine ? <span className="badge is-aqua">Your plan</span> : plan.featured ? <span className="badge is-aqua">Most popular</span> : null}
                      </div>
                      <p className="subtle t-cap">{plan.blurb}</p>
                    </div>
                    <p className="plan-price">
                      <span className="tabular">{money(plan.price)}</span>
                      <span className="subtle t-cap"> / month</span>
                    </p>
                    <ul className="plan-perks">
                      {plan.perks.map((perk) => (
                        <li key={perk}>
                          <Check size={15} strokeWidth={2} />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                    {mine ? (
                      <Button block disabled>
                        You're on {plan.name}
                      </Button>
                    ) : subscription ? (
                      <a className="btn btn-outline btn-block" href={whatsappLink(SHOP.phone, `Hi ${SHOP.name}, I'd like to switch my plan to ${plan.name} when it renews.`)} target="_blank" rel="noreferrer">
                        Switch at renewal
                      </a>
                    ) : plan.featured ? (
                      <Cta className="btn-block" onClick={() => choose(plan)}>
                        {account ? `Join ${plan.name}` : `Log in to join`}
                      </Cta>
                    ) : (
                      <Button variant="outline" className="btn-block" onClick={() => choose(plan)}>
                        {account ? `Join ${plan.name}` : `Log in to join`}
                      </Button>
                    )}
                  </Reveal>
                );
              })}
            </div>
            {!account && (
              <p className="info-line muted t-cap">
                <Lock size={14} />
                <span>Plans live on your account, so log in or create one with your WhatsApp number to join.</span>
              </p>
            )}
          </section>

          <section className="section">
            <h2 className="t-h3">How plans work</h2>
            <div className="card list-card">
              {[
                { icon: <CalendarSync size={18} strokeWidth={1.7} />, title: "Pay for the month", body: "Mobile Money or card. Your month starts the day you join." },
                { icon: <ShoppingBasket size={18} strokeWidth={1.7} />, title: "Book a basket whenever you like", body: "Choose “Use my plan” at checkout. The rider collects and brings it back for free." },
                { icon: <Check size={18} strokeWidth={1.7} />, title: "Renew, or stop", body: "We remind you on WhatsApp before it renews. Cancel any time; the month you paid for still runs." },
              ].map((step) => (
                <div key={step.title} className="row">
                  <span className="row-icon is-aqua">{step.icon}</span>
                  <span className="grow stack">
                    <span>{step.title}</span>
                    <span className="subtle t-cap">{step.body}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <h2 className="t-h3">Questions</h2>
            <div className="stack gap-8">
              {FAQ.map((item) => (
                <details key={item.q} className="card card-pad faq">
                  <summary className="t-title">{item.q}</summary>
                  <p className="muted" style={{ marginTop: 8 }}>
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </div>
      )}

      <PaystackSheet open={Boolean(joining)} onClose={() => setJoining(null)} amount={joining?.price ?? 0} label={`${joining?.name ?? ""} plan, first month`} email={account?.email ?? ""} phone={account?.phone ?? ""} onPaid={join} />
      <PaystackSheet open={renewOpen} onClose={() => setRenewOpen(false)} amount={status?.plan?.price ?? 0} label={`${status?.plan?.name ?? ""} plan, next month`} email={account?.email ?? ""} phone={account?.phone ?? ""} onPaid={renew} />

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel your plan?">
        <div className="stack gap-16">
          <p className="muted">
            Your {status?.plan?.name} plan won't renew. {subscription ? `It keeps working until ${fmtDayLong(parseLocal(subscription.renewsOn))}` : ""}
            {status && status.left > 0 ? `, so book your ${plural(status.left, "basket wash", "basket washes")} before then.` : "."}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Button block onClick={() => setCancelOpen(false)}>
              Keep my plan
            </Button>
            <Button
              variant="danger"
              block
              onClick={() => {
                if (subscription) actions.cancelPlan(subscription.id);
                setCancelOpen(false);
                notify("Plan cancelled", "It won't renew. Your basket washes still work until the month runs out.");
              }}
            >
              Yes, cancel
            </Button>
          </div>
        </div>
      </Sheet>

      <SuccessScreen
        open={joinedShow}
        title="Welcome to your plan"
        onDone={() => {
          setJoinedShow(false);
          window.setTimeout(() => notify("Plan started", "Your basket washes are ready to book. Choose “Use my plan” at checkout."), 400);
        }}
      />
    </main>
  );
}
