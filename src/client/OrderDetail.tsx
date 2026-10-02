import { ArrowLeft, Ban, Bike, CalendarPlus, Check, ChevronRight, CircleAlert, ClipboardCheck, Droplet, Lock, MessageCircle, Navigation, Phone, ReceiptText, RefreshCw, ShoppingBag, Store, Truck } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { FindOrderSheet } from "../components/AccountSheets";
import { CalendarSheet } from "../components/ActionSheets";
import { Badge, Photo, Skeleton, useSkeleton } from "../components/Bits";
import { Button } from "../components/Button";
import { TopBar } from "../components/Chrome";
import { MapCard } from "../components/MapCard";
import { useNotify } from "../components/Notify";
import { SuccessScreen } from "../components/Overlays";
import { PaystackSheet } from "../components/Paystack";
import { Sheet } from "../components/Sheet";
import { POLICIES, SHOP, zoneById } from "../data/business";
import { careSummary, serviceById } from "../data/catalog";
import { prefillAuthDraft } from "../data/authDraft";
import { accessOf, accountOf, actions, customerById, useAppData, type OnlinePayment } from "../data/store";
import type { Appointment, Order } from "../data/types";
import { splitName } from "../lib/auth";
import { amountDue, canViewOrder } from "../lib/checkout";
import { formatGhPhone, mapsLinks, telLink, whatsappLink } from "../lib/contact";
import { fmtDate, fmtDay, fmtDayShort, fmtTime, money, parseLocal, plural } from "../lib/format";
import { itemSummary } from "../lib/items";
import { adjustmentLabel, badgeFor, balanceDue, canCancel, counterAdjustment, isActive, nextAction, paidTotal, stageIndex, stageLabel, stagesFor, titleFor } from "../lib/orders";
import { windowLabel } from "../lib/schedule";
import { enter, spring } from "../motion";

export function OrderDetail() {
  const { orderId } = useParams();
  const data = useAppData();
  const loading = useSkeleton(600);
  const order = data.orders.find((o) => o.id === orderId);

  if (loading) return <DetailSkeleton />;
  // Orders open only on the phone they were placed or found on, or for the account they belong to.
  if (order && !canViewOrder(order, accessOf(data))) return <NotOnThisPhone />;
  if (!order) {
    return (
      <main className="screen">
        <TopBar back alwaysSolid />
        <div className="empty" style={{ marginTop: "12vh" }}>
          <span className="empty-icon">
            <CircleAlert size={24} />
          </span>
          <p className="t-title">We couldn't find that order</p>
          <p className="muted">It may have been removed when the demo was reset.</p>
          <Link to="/orders" className="btn btn-outline" style={{ marginTop: 8 }}>
            See my orders
          </Link>
        </div>
      </main>
    );
  }
  return <OrderView order={order} />;
}

function NotOnThisPhone() {
  const [findOpen, setFindOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <main className="screen">
      <TopBar back alwaysSolid />
      <div className="empty" style={{ marginTop: "12vh" }}>
        <span className="empty-icon">
          <Lock size={24} />
        </span>
        <p className="t-title">This order isn't on this phone</p>
        <p className="muted" style={{ maxWidth: "38ch" }}>
          To keep orders private, open it with the order number and the WhatsApp number you ordered with, or log in to your account.
        </p>
        <div className="inline" style={{ gap: 8, marginTop: 8 }}>
          <Button variant="dark" onClick={() => setFindOpen(true)}>
            Find my order
          </Button>
          <Button onClick={() => navigate(`/login?next=${encodeURIComponent(pathname)}`)}>Log in</Button>
        </div>
      </div>
      <FindOrderSheet open={findOpen} onClose={() => setFindOpen(false)} />
    </main>
  );
}

function DetailSkeleton() {
  return (
    <main className="screen" aria-busy="true">
      <Skeleton w="calc(100% + 32px)" h={240} r={0} style={{ marginInline: -16 }} />
      <div className="stack gap-12" style={{ marginTop: 20 }}>
        <Skeleton w={110} h={28} r={500} />
        <Skeleton w="70%" h={30} />
        <Skeleton w="35%" h={14} />
        <Skeleton h={150} r={8} style={{ marginTop: 12 }} />
        <Skeleton h={180} r={8} />
      </div>
    </main>
  );
}

const PURPOSE_LABEL: Record<Appointment["purpose"], string> = {
  pickup: "Rider pickup",
  delivery: "Delivery",
};

/** "Tue, 15 Sept, 14:30" */
const dayTime = (d: Date) => `${fmtDayShort(d)}, ${fmtTime(d)}`;

function OrderView({ order }: { order: Order }) {
  const data = useAppData();
  const navigate = useNavigate();
  const notify = useNotify();
  const now = new Date();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelledShow, setCancelledShow] = useState(false);
  const customer = customerById(data, order.customerId);
  const account = accountOf(data);

  const first = order.items[0];
  const style = first ? serviceById(first.serviceId) : undefined;
  const title = style ? `${style.name}${order.items.length > 1 ? ` + ${order.items.length - 1} more` : ""}` : "Laundry";
  const itemCount = order.items.reduce((n, i) => n + i.qty, 0);
  const appointments = data.appointments.filter((a) => a.orderId === order.id).sort((a, b) => a.start.localeCompare(b.start));
  const nextVisit = appointments.find((a) => parseLocal(a.start) > now && a.status !== "cancelled");
  const delivery = appointments.find((a) => a.purpose === "delivery" && a.status !== "cancelled");
  const action = nextAction(order, now, delivery?.start);
  const badge = badgeFor(order, now);
  const zone = zoneById(order.zoneId);
  const adjustment = counterAdjustment(order);
  const hasQuoted = order.items.some((i) => serviceById(i.serviceId)?.kind === "quote" && i.unitPrice === 0);
  const balance = balanceDue(order);
  const paid = paidTotal(order);
  const due = amountDue(order);
  const live = isActive(order);
  const maps = mapsLinks(SHOP.mapsQuery);
  const waText = `Hi ${SHOP.name}, it's ${customer?.name ?? "a customer"} about order ${order.number} (${title}).`;
  const payLabel = due.label === "total" ? `Pay ${money(due.amount)}` : `Pay ${money(due.amount)} balance`;

  const pay = useCallback(
    (payment: OnlinePayment): string | null => {
      const result = actions.payOrder(order.id, payment);
      if ("error" in result) return result.error;
      setPayOpen(false);
      window.setTimeout(() => notify("Payment received", `Receipt ${result.payment.receiptNo} is ready${customer?.email ? ` and on its way to ${customer.email}` : ""}.`), 400);
      return null;
    },
    [order.id, notify, customer?.email],
  );
  const calendarEvent = nextVisit
    ? {
        title: `${PURPOSE_LABEL[nextVisit.purpose]} at ${SHOP.name}`,
        start: parseLocal(nextVisit.start),
        minutes: nextVisit.minutes,
        location: SHOP.address,
        details: `Order ${order.number}. ${nextVisit.purpose === "pickup" ? "Have the bag ready by the door; the rider calls when close." : "The rider calls when close."}`,
      }
    : null;

  const runAction = () => {
    switch (action?.cta?.kind) {
      case "whatsapp":
        window.open(whatsappLink(SHOP.phone, waText), "_blank", "noopener");
        break;
      case "pay":
        setPayOpen(true);
        break;
      case "calendar":
        setCalendarOpen(true);
        break;
      case "directions":
        setDirectionsOpen(true);
        break;
    }
  };

  const confirmCancel = async () => {
    setCancelling(true);
    await new Promise((r) => window.setTimeout(r, 900));
    actions.cancelOrder(order.id);
    setCancelling(false);
    setCancelOpen(false);
    setCancelledShow(true);
  };

  const onCancelledDone = useCallback(() => {
    setCancelledShow(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => notify("Order cancelled", `${order.number} has been cancelled. Message us if you change your mind.`), 500);
  }, [notify, order.number]);

  const statusTimes = new Map(order.history.map((h) => [h.status, h.at]));
  const stages = stagesFor(order);
  const current = stageIndex(order.status, order);

  // Rendered under the banner on phones and tablets, and in the side column on desktop.
  const actionsNav = (className: string) => (
    <nav className={`card list-card ${className}`} style={{ marginTop: 12 }} aria-label="Order actions">
      {live ? (
        <>
          {calendarEvent && (
            <button className="row" onClick={() => setCalendarOpen(true)}>
              <span className="row-icon is-aqua">
                <CalendarPlus size={18} strokeWidth={1.7} />
              </span>
              <span className="grow stack">
                <span>Add {nextVisit ? PURPOSE_LABEL[nextVisit.purpose].toLowerCase() : "pickup"} to calendar</span>
                <span className="subtle t-cap">{`${fmtDayShort(calendarEvent.start)} at ${fmtTime(calendarEvent.start)}`}</span>
              </span>
              <ChevronRight size={18} className="row-chevron" />
            </button>
          )}
          <button className="row" onClick={() => setDirectionsOpen(true)}>
            <span className="row-icon">
              <Navigation size={18} strokeWidth={1.7} />
            </span>
            <span className="grow">Get directions</span>
            <ChevronRight size={18} className="row-chevron" />
          </button>
        </>
      ) : (
        <Link className="row" to={`/order/new?service=${first?.serviceId ?? ""}`}>
          <span className="row-icon is-aqua">
            <ShoppingBag size={18} strokeWidth={1.7} />
          </span>
          <span className="grow">Book again</span>
          <ChevronRight size={18} className="row-chevron" />
        </Link>
      )}
      <a className="row" href={whatsappLink(SHOP.phone, waText)} target="_blank" rel="noreferrer">
        <span className="row-icon">
          <MessageCircle size={18} strokeWidth={1.7} />
        </span>
        <span className="grow">Message on WhatsApp</span>
        <ChevronRight size={18} className="row-chevron" />
      </a>
      <Link className="row" to="/">
        <span className="row-icon">
          <Store size={18} strokeWidth={1.7} />
        </span>
        <span className="grow">Shop details</span>
        <ChevronRight size={18} className="row-chevron" />
      </Link>
    </nav>
  );

  return (
    <main className="screen">
      <TopBar back title={title} solidAfter={190} backRow="Back" />

      <div className="detail-hero">
        <Photo tone={style?.tone ?? "mist"} src={style?.photo} alt={title} sizes="(min-width: 1024px) 1200px, 100vw" height={250} radius={0} markSize={110} />
        <div className="scrim" />
        <button className="icon-btn mobile-only" style={{ left: 16 }} onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={20} strokeWidth={1.8} />
        </button>
        <h1>{title}</h1>
      </div>

      <motion.div className="detail-body" {...enter(24)}>
        <div>
          <Badge tone={badge.tone} icon={order.status === "cancelled" ? <Ban size={14} /> : badge.tone === "sand" ? <CircleAlert size={14} /> : <Check size={14} />}>
            {badge.label}
          </Badge>
        </div>
        <h2 className="t-h2">{titleFor(order, now)}</h2>
        <p className="muted">
          {order.number} · {plural(itemCount, "item")}
          {order.speed === "express" ? " · Express" : ""}
          {order.payChoice === "plan" ? " · On your plan" : ""}
        </p>

        {action && (
          <motion.div className={`banner ${(order.status === "ready" || order.status === "out") && balance > 0 ? "is-sand" : ""}`} style={{ marginTop: 12 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.small, delay: 0.1 }}>
            <p className="t-title">{action.title}</p>
            <p className="muted">{action.body}</p>
            {action.cta && (
              <button className="banner-cta" onClick={runAction}>
                {action.cta.label} <ChevronRight size={16} />
              </button>
            )}
          </motion.div>
        )}

        {!account && customer && !customer.hasAccount && (
          <motion.section className="account-card" style={{ marginTop: 12 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.small, delay: 0.15 }}>
            <p className="t-title">Keep this order on any phone</p>
            <p className="muted">Optional. Save an account with {formatGhPhone(customer.phone)} and your orders, laundry preferences and receipts go wherever you log in.</p>
            <div className="account-card-actions">
              <Button
                variant="aqua"
                size="sm"
                onClick={() => {
                  // Start the form off with what the shop already has for this order.
                  prefillAuthDraft({ ...splitName(customer.name), email: customer.email, phone: formatGhPhone(customer.phone) });
                  navigate(`/signup?next=${encodeURIComponent(`/orders/${order.id}`)}`);
                }}
              >
                Create account
              </Button>
            </div>
          </motion.section>
        )}

        {actionsNav("lt-desk")}

        <div className="detail-layout">
        <div className="detail-main" style={{ minWidth: 0 }}>
        {order.status !== "cancelled" && (
          <section className="section">
            <h2 className="t-h3">Progress</h2>
            <div className="card card-pad timeline">
              {stages.map((stage, i) => {
                const done = i < current || order.status === "done";
                const isCurrent = i === current && order.status !== "done";
                const at = statusTimes.get(stage);
                return (
                  <motion.div key={stage} className={`tl-step ${done ? "is-done" : ""} ${isCurrent ? "is-current" : ""}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring.small, delay: 0.05 * i }}>
                    <span className="tl-dot" aria-hidden="true">
                      {done && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className="tl-label">
                      {stageLabel(stage, order)}
                      {isCurrent && <span className="sr-only"> (current step)</span>}
                    </span>
                    <span className="subtle t-cap" style={{ lineHeight: "24px" }}>
                      {at ? dayTime(new Date(at)) : stage === "ready" ? `Due ${dayTime(parseLocal(order.readyAt))}` : ""}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        <section className="section">
          <h2 className="t-h3">Overview</h2>
          <div className="card card-pad stack gap-12">
            {order.items.map((item) => {
              const s = serviceById(item.serviceId);
              return (
                <div key={item.id} className="kv">
                  <span className="stack">
                    <span>
                      {s?.name ?? "Laundry"} {item.qty > 1 ? `× ${item.qty}` : ""}
                    </span>
                    <span className="subtle t-cap">{itemSummary(item, s)}</span>
                  </span>
                  <span>{s?.kind === "quote" && item.unitPrice === 0 ? "At the counter" : money(item.unitPrice * item.qty)}</span>
                </div>
              );
            })}
            {order.expressFee > 0 && (
              <div className="kv muted">
                <span>Express</span>
                <span>{money(order.expressFee)}</span>
              </div>
            )}
            {order.riderFee > 0 && (
              <div className="kv muted">
                <span>Rider{zone ? ` · ${zone.name}` : ""}</span>
                <span>{money(order.riderFee)}</span>
              </div>
            )}
            {order.planCover > 0 && (
              <div className="kv muted">
                <span>Covered by your plan</span>
                <span>-{money(order.planCover)}</span>
              </div>
            )}
            {order.discount > 0 && (
              <div className="kv muted">
                <span>Loyalty points</span>
                <span>-{money(order.discount)}</span>
              </div>
            )}
            {adjustment !== 0 && (
              <div className="kv muted">
                <span>{adjustmentLabel(adjustment)}</span>
                <span>{money(adjustment)}</span>
              </div>
            )}
            <div className="divider" style={{ margin: 0 }} />
            <div className="kv kv-total">
              <span>{hasQuoted && order.status === "booked" ? "So far" : "Total"}</span>
              <span>{money(order.total)}</span>
            </div>
            <div className="kv muted">
              <span>Paid</span>
              <span>{money(paidTotal(order))}</span>
            </div>
            {order.status !== "cancelled" && (
              <div className="kv" style={{ fontWeight: 500 }}>
                <span>Balance</span>
                <span>{money(balance)}</span>
              </div>
            )}
            {live && due.amount > 0 && (
              <>
                <Button variant="dark" block onClick={() => setPayOpen(true)} style={{ marginTop: 4 }}>
                  {payLabel}
                </Button>
                <p className="inline t-cap subtle" style={{ justifyContent: "center", gap: 6 }}>
                  <Lock size={13} /> Mobile Money or card through Paystack
                </p>
              </>
            )}
          </div>
        </section>

        <section className="section">
          <h2 className="t-h3">Receipts</h2>
          {order.payments.length ? (
            <div className="card list-card">
              {order.payments.map((p) => (
                <Link key={p.id} className="row" to={`/orders/${order.id}/receipts/${p.id}`}>
                  <span className="row-icon">
                    <ReceiptText size={18} strokeWidth={1.7} />
                  </span>
                  <span className="grow stack">
                    <span>{p.kind === "full" ? "Payment receipt" : p.kind === "final" ? "Final payment receipt" : "Part payment receipt"}</span>
                    <span className="t-cap" style={{ color: "var(--warning-ink)" }}>
                      <span className="t-mono">{p.receiptNo}</span> · {fmtDate(new Date(p.at))}
                    </span>
                  </span>
                  <span className="tabular">{money(p.amount)}</span>
                  <ChevronRight size={18} className="row-chevron" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="card card-pad muted">Your official receipt appears here after each payment.</p>
          )}
        </section>

        <section className="section">
          <h2 className="t-h3">Care and handover</h2>
          <div className="card list-card">
            <div className="row">
              <span className="row-icon">
                <Droplet size={18} strokeWidth={1.7} />
              </span>
              <span className="grow stack">
                <span>{careSummary(order.care)}</span>
                {order.care.notes && <span className="subtle t-cap">{order.care.notes}</span>}
              </span>
            </div>
            {order.checkIn && (
              <div className="row">
                <span className="row-icon is-aqua">
                  <ClipboardCheck size={18} strokeWidth={1.7} />
                </span>
                <span className="grow stack">
                  <span>Counted at the counter: {plural(order.checkIn.count, "piece")}</span>
                  <span className="subtle t-cap">{order.checkIn.notes ?? `Checked in ${dayTime(new Date(order.checkIn.at))}. Nothing to note.`}</span>
                </span>
              </div>
            )}
            {order.intake === "dropoff" && (
              <div className="row">
                <span className="row-icon">
                  <Store size={18} strokeWidth={1.7} />
                </span>
                <span className="grow stack">
                  <span>Drop-off at the counter</span>
                  <span className="subtle t-cap">{fmtDay(parseLocal(order.inAt))} around {fmtTime(parseLocal(order.inAt))}</span>
                </span>
              </div>
            )}
            {appointments.map((a) => {
              const start = parseLocal(a.start);
              return (
                <div key={a.id} className="row">
                  <span className="row-icon">{a.purpose === "pickup" ? <Bike size={18} strokeWidth={1.7} /> : <Truck size={18} strokeWidth={1.7} />}</span>
                  <span className="grow stack">
                    <span>{PURPOSE_LABEL[a.purpose]}</span>
                    <span className="subtle t-cap">
                      {fmtDay(start)}, {windowLabel(a.start, a.minutes)} · {a.status === "done" ? "Done" : a.status === "cancelled" ? "Cancelled" : a.status === "requested" ? "Awaiting confirmation" : "Confirmed"}
                    </span>
                  </span>
                </div>
              );
            })}
            {order.handback === "collect" && order.status !== "cancelled" && (
              <div className="row">
                <span className="row-icon">
                  <ShoppingBag size={18} strokeWidth={1.7} />
                </span>
                <span className="grow stack">
                  <span>{order.status === "done" ? "Collected from the counter" : "Collect from the counter"}</span>
                  <span className="subtle t-cap">Any day until 9pm once it's ready. Show your order number.</span>
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="section">
          <h2 className="t-h3">More details</h2>
          <div className="card">
            <div className="card-pad stack gap-4">
              <p className="t-title">Cancellation</p>
              <p className="muted">{POLICIES.cancellation}</p>
            </div>
            {live && (
              <div className="list-card" style={{ paddingTop: 0 }}>
                {nextVisit && (
                  <a className="row" href={whatsappLink(SHOP.phone, `${waText} I'd like to change the time on ${fmtDayShort(parseLocal(nextVisit.start))}.`)} target="_blank" rel="noreferrer">
                    <RefreshCw size={18} strokeWidth={1.7} />
                    <span className="grow">Change the time</span>
                    <ChevronRight size={18} className="row-chevron" />
                  </a>
                )}
                {canCancel(order) ? (
                  <button className="row" onClick={() => setCancelOpen(true)}>
                    <Ban size={18} strokeWidth={1.7} />
                    <span className="grow">Cancel order</span>
                    <ChevronRight size={18} className="row-chevron" />
                  </button>
                ) : (
                  <p className="row muted t-body">Your laundry is already at the counter, so this order can't be cancelled in the app. Message the shop if anything changes.</p>
                )}
              </div>
            )}
          </div>
          <div className="card card-pad stack gap-4">
            <p className="t-title">Important info</p>
            <p className="muted">{POLICIES.important}</p>
            <p className="muted">{POLICIES.handover}</p>
          </div>
          {order.comments && (
            <div className="card card-pad stack gap-4">
              <p className="t-title">Your note</p>
              <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
                {order.comments}
              </p>
            </div>
          )}
        </section>

        <section className="section lt-desk">
          <h2 className="t-h3">Getting there</h2>
          <MapCard />
        </section>

        <p className="t-cap subtle" style={{ textAlign: "center", padding: "24px 0 8px" }}>
          Order ref: <span className="t-mono">{order.number}</span>
        </p>
        </div>

        <aside className="detail-aside desk" aria-label="Order actions and location">
          {actionsNav("")}
          <MapCard />
        </aside>
        </div>
      </motion.div>

      <CalendarSheet open={calendarOpen} onClose={() => setCalendarOpen(false)} event={calendarEvent} uid={`${order.number}-${nextVisit?.id ?? "visit"}`} />
      <PaystackSheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        amount={due.amount}
        label={`${due.label === "total" ? "Payment" : "Balance"} for ${order.number}`}
        email={customer?.email ?? ""}
        phone={customer?.phone ?? ""}
        onPaid={pay}
      />

      <Sheet open={directionsOpen} onClose={() => setDirectionsOpen(false)} title="Get directions">
        <div className="stack gap-12">
          <a className="btn btn-outline btn-block" href={maps.google} target="_blank" rel="noreferrer" onClick={() => setDirectionsOpen(false)}>
            Open in Google Maps
          </a>
          <a className="btn btn-outline btn-block" href={maps.apple} target="_blank" rel="noreferrer" onClick={() => setDirectionsOpen(false)}>
            Open in Apple Maps
          </a>
        </div>
      </Sheet>

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Are you sure you want to cancel?">
        <div className="stack gap-16">
          <div className="card" style={{ display: "flex", overflow: "hidden", background: "var(--ground)", boxShadow: "none" }}>
            <Photo tone={style?.tone ?? "mist"} src={style?.photo} sizes="80px" height={96} radius={0} markSize={30} className="order-thumb" />
            <div className="card-pad stack" style={{ padding: 12 }}>
              <p className="t-title">{title}</p>
              <p className="muted t-cap">{titleFor(order, now)}</p>
              <p className="muted t-cap">
                {money(order.total)} · {order.number}
              </p>
            </div>
          </div>
          {paid > 0 && (
            <p className="info-line">
              <ReceiptText size={16} />
              <span>Your {money(paid)} payment is refunded through Paystack to the Mobile Money number or card you paid with.</span>
            </p>
          )}
          <p className="muted">Not sure? Talk to {SHOP.name} first.</p>
          <div className="inline" style={{ gap: 8 }}>
            <a className="btn btn-outline btn-sm" href={telLink(SHOP.phone)}>
              <Phone size={15} /> Call
            </a>
            <a className="btn btn-outline btn-sm" href={whatsappLink(SHOP.phone, waText)} target="_blank" rel="noreferrer">
              <MessageCircle size={15} /> WhatsApp
            </a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
            <Button block onClick={() => setCancelOpen(false)}>
              Go back
            </Button>
            <Button variant="danger" block loading={cancelling} onClick={confirmCancel}>
              Yes, cancel
            </Button>
          </div>
        </div>
      </Sheet>

      <SuccessScreen open={cancelledShow} title="Order cancelled" tone="cancel" onDone={onCancelledDone} />
    </main>
  );
}
