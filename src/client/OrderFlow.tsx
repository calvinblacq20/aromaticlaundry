import { ArrowUp, Bike, CalendarSync, Check, Clock, Droplet, Lock, Mail, MapPin, Minus, Phone, Plus, Send, Shirt, Sparkles, Store, Trash2, Truck, UserRound, Wallet, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AccountSheet } from "../components/AccountSheet";
import { AppIcon } from "../components/Brand";
import { Photo, Skeleton, Stars, useSkeleton } from "../components/Bits";
import { Button, Cta, Dots } from "../components/Button";
import { TopBar } from "../components/Chrome";
import { useNotify } from "../components/Notify";
import { SuccessScreen } from "../components/Overlays";
import { PaystackSheet } from "../components/Paystack";
import { useScrollTo } from "../components/Scroll";
import { DateStrip } from "../components/Pickers";
import { Sheet } from "../components/Sheet";
import { HOURS, POLICIES, RULES, SHOP, ZONES, zoneById } from "../data/business";
import { CATEGORIES, DEFAULT_CARE, FINISH_OPTIONS, SCENT_OPTIONS, SERVICES, STARCH_OPTIONS, careSummary, serviceById } from "../data/catalog";
import { accountOf, accountPlanOf, actions, useAppData, type OnlinePayment } from "../data/store";
import type { CarePrefs, ContactDetails, Handback, Intake, OrderStatus, PayChoice, Service, Speed } from "../data/types";
import { cleanContact, contactFromCustomer, EMPTY_CONTACT, validateContact, type ContactErrors } from "../lib/checkout";
import { dayKey, fmtDayLong, fmtDayShort, fmtTime, localIso, money, parseLocal, plural } from "../lib/format";
import { itemSummary, serviceLine, servicePrice } from "../lib/items";
import { readyPhrase } from "../lib/orders";
import { planStatus } from "../lib/plans";
import { canExpress, defaultQty, estimate, isQuoted, riderTrips, turnaroundHours, unitPrice, type ItemChoice } from "../lib/pricing";
import { dateStrip, readyTime, riderWindows, slotsFor, windowLabel } from "../lib/schedule";
import { spring } from "../motion";

type Draft = ItemChoice;
type PricedLine = Draft & { service?: Service; unitPrice: number };

const STEP_TITLES = ["Choose what you need", "Care and speed", "Pickup and return", "Your details", "Review and pay"] as const;
const CRUMBS = ["Services", "Care", "Pickup & return", "Details", "Pay"] as const;
const DETAILS_STEP = 3;
const REVIEW_STEP = 4;
const FIELD_ORDER: (keyof ContactDetails)[] = ["name", "phone", "email", "town", "address", "digitalAddress"];
const NOTE_MAX = 80;

const newLine = (service: Service): Draft => ({ serviceId: service.id, qty: defaultQty(service) });

export function OrderFlow() {
  const navigate = useNavigate();
  const notify = useNotify();
  const [params] = useSearchParams();
  const data = useAppData();
  const now = useMemo(() => new Date(), []);

  const [step, setStep] = useState(0);
  const [lines, setLines] = useState<Draft[]>(() => {
    const service = serviceById(params.get("service") ?? "");
    return service && service.active !== false ? [newLine(service)] : [];
  });
  const account = accountOf(data);
  const subscription = accountPlanOf(data, now);
  const plan = subscription ? planStatus(subscription, data.orders, now) : null;

  const [speed, setSpeed] = useState<Speed>("standard");
  const [care, setCare] = useState<CarePrefs>(() => ({ ...(account?.care ?? DEFAULT_CARE) }));
  const [saveCare, setSaveCare] = useState(true);
  const [intake, setIntake] = useState<Intake>(() => (plan && plan.left > 0 ? "pickup" : "dropoff"));
  const [handback, setHandback] = useState<Handback>(() => (plan && plan.left > 0 ? "delivery" : "collect"));
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [inAt, setInAt] = useState<string | null>(null);
  const [deliveryStart, setDeliveryStart] = useState<string | null>(null);
  const [comments, setComments] = useState("");
  const [usePoints, setUsePoints] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ id: string; number: string; status: OrderStatus; intake: Intake; inAt: string; receiptNo?: string; email: string } | null>(null);

  // Signed-in customers start from their account; guests from what this phone remembers, if anything.
  const [contact, setContact] = useState<ContactDetails>(() => (account ? contactFromCustomer(account) : data.device.contact ?? EMPTY_CONTACT));
  const [remember, setRemember] = useState(true);
  const [showErrors, setShowErrors] = useState(false);
  const [payChoice, setPayChoice] = useState<PayChoice | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const scrollTo = useScrollTo();
  useEffect(() => {
    scrollTo(0, { immediate: true });
  }, [step, scrollTo]);

  const priced: PricedLine[] = lines.map((l) => {
    const service = serviceById(l.serviceId);
    return { ...l, service, unitPrice: service ? unitPrice(service) : 0 };
  });
  const expressOk = canExpress(lines);
  const effectiveSpeed: Speed = expressOk ? speed : "standard";
  const hasBaskets = priced.some((l) => l.service?.category === "baskets");
  const planUsable = Boolean(plan && plan.left > 0 && hasBaskets);
  const pay: PayChoice = payChoice === "plan" && !planUsable ? "later" : payChoice ?? (planUsable ? "plan" : "later");
  const trips = riderTrips(intake, handback);
  const zone = zoneById(zoneId ?? undefined);
  const est = estimate(priced, { speed: effectiveSpeed, trips, zoneFee: zone?.fee ?? 0, planBasketsLeft: pay === "plan" ? plan?.left : undefined });
  const points = account?.points ?? 0;
  const discount = usePoints && account ? Math.min(Math.floor(points / 10), Math.floor(est.total * 0.1)) : 0;
  const total = Math.max(0, est.total - discount);
  const hasQuoted = priced.some((l) => l.service && isQuoted(l.service));
  const readyAt = inAt ? readyTime(parseLocal(inAt), turnaroundHours(lines), effectiveSpeed === "express", RULES.expressHours, HOURS) : null;
  const needsAddress = trips > 0;
  const contactErrors = validateContact(contact, needsAddress);
  const firstContactError = FIELD_ORDER.find((key) => contactErrors[key]);

  // A guest who logs in part-way through gets their account details and preferences.
  useEffect(() => {
    if (!account) return;
    setContact(contactFromCustomer(account));
    if (account.care) setCare({ ...account.care });
  }, [account]);
  // A delivery window that now falls before the laundry is ready is no longer valid.
  useEffect(() => {
    if (deliveryStart && readyAt && parseLocal(deliveryStart) < readyAt) setDeliveryStart(null);
  }, [deliveryStart, readyAt]);

  const missing = (() => {
    if (step === 0 && lines.length === 0) return "Choose at least one service";
    if (step === 2) {
      if (trips > 0 && !zone) return "Choose your area";
      if (!inAt) return intake === "pickup" ? "Pick a pickup window" : "Pick a drop-off time";
      if (handback === "delivery" && !deliveryStart) return "Pick a delivery window";
    }
    if (step === DETAILS_STEP && showErrors && firstContactError) return contactErrors[firstContactError] ?? null;
    return null;
  })();

  const toggleLine = (service: Service) => setLines((prev) => (prev.some((l) => l.serviceId === service.id) ? prev.filter((l) => l.serviceId !== service.id) : [...prev, newLine(service)]));
  const updateLine = (serviceId: string, patch: Partial<Draft>) => setLines((prev) => prev.map((l) => (l.serviceId === serviceId ? { ...l, ...patch } : l)));

  const back = () => (step > 0 ? setStep(step - 1) : navigate(-1));

  /** Creates the order in one step: customer record, order, rider windows and (when paid now) the receipt. Returns an error to show, or null. */
  const placeOrder = (payment?: OnlinePayment): string | null => {
    if (!inAt || !readyAt) return "Pick when we get your laundry.";
    const clean = cleanContact(contact, needsAddress);
    const result = actions.placeOrder({
      items: priced.map(({ serviceId, qty, note, unitPrice: u }) => ({ serviceId, qty, note: note?.trim() || undefined, unitPrice: u })),
      speed: effectiveSpeed,
      care,
      intake,
      handback,
      zoneId: zone?.id,
      inAt,
      readyAt: localIso(readyAt),
      deliveryStart: handback === "delivery" ? deliveryStart ?? undefined : undefined,
      comments: comments.trim() || undefined,
      saveCare: account ? saveCare : true,
      contact: clean,
      remember: account ? false : remember,
      payChoice: pay,
      total,
      riderFee: est.riderFee,
      expressFee: est.expressFee,
      planCover: est.planCover,
      discount,
      payment,
    });
    if ("error" in result) return result.error;
    setPayOpen(false);
    setCreated({ id: result.order.id, number: result.order.number, status: result.order.status, intake, inAt, receiptNo: result.payment?.receiptNo, email: clean.email });
    return null;
  };

  const sendBooking = async () => {
    setSubmitting(true);
    await new Promise((r) => window.setTimeout(r, 1000));
    const error = placeOrder();
    setSubmitting(false);
    if (error) notify("Couldn't book that", error);
  };

  const continueFromDetails = () => {
    setShowErrors(true);
    if (firstContactError) {
      document.getElementById(`contact-${firstContactError}`)?.focus();
      return;
    }
    setContact(cleanContact(contact, needsAddress));
    setStep(REVIEW_STEP);
  };

  const onSuccessDone = useCallback(() => {
    if (!created) return;
    navigate(`/orders/${created.id}`, { replace: true });
    const when = parseLocal(created.inAt);
    window.setTimeout(() => {
      const what = created.intake === "pickup" ? `Our rider collects ${fmtDayShort(when)} from ${fmtTime(when)}.` : `Bring it to the counter ${fmtDayShort(when)} around ${fmtTime(when)}.`;
      if (created.receiptNo) notify("Booked and paid", `${created.number}: ${what} Receipt ${created.receiptNo} is on its way to ${created.email}.`);
      else notify("Booked", `${created.number}: ${what} Updates come on WhatsApp.`);
    }, 700);
  }, [created, navigate, notify]);

  const cta =
    step < DETAILS_STEP ? (
      <Cta onClick={() => setStep(step + 1)} disabled={Boolean(missing)}>
        Continue
      </Cta>
    ) : step === DETAILS_STEP ? (
      <Cta onClick={continueFromDetails}>Continue</Cta>
    ) : pay === "now" && total > 0 ? (
      <Cta onClick={() => setPayOpen(true)}>Pay {money(total)}</Cta>
    ) : (
      <Cta onClick={sendBooking} loading={submitting}>
        {intake === "pickup" ? "Book pickup" : "Book drop-off"}
      </Cta>
    );

  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
  const turnaround = lines.length ? (effectiveSpeed === "express" ? `${RULES.expressHours} hours` : turnaroundHours(lines) > 24 ? `${turnaroundHours(lines) / 24} days` : "24 hours") : "";
  const totalLabel = hasQuoted ? "So far" : "Total";

  return (
    <main className="screen flow-screen">
      <TopBar
        back={back}
        close={() => navigate("/")}
        title={STEP_TITLES[step]}
        right={
          <nav className="flow-crumbs desktop-only" aria-label="Booking steps">
            {CRUMBS.map((label, i) => (
              <span key={label} className="inline" style={{ gap: 6 }}>
                {i > 0 && (
                  <span className="flow-crumb-sep" aria-hidden="true">
                    ›
                  </span>
                )}
                <button className={`flow-crumb ${i === step ? "is-current" : i < step ? "is-done" : ""}`} disabled={i >= step} onClick={() => setStep(i)} aria-current={i === step ? "step" : undefined}>
                  {label}
                </button>
              </span>
            ))}
          </nav>
        }
      />
      <div className="flow-progress mobile-only" aria-hidden="true">
        {STEP_TITLES.map((t, i) => (
          <span key={t}>
            <motion.i initial={false} animate={{ scaleX: i <= step ? 1 : 0 }} transition={spring.press} />
          </span>
        ))}
      </div>

      <div className="flow-layout">
        <div className="flow-main stack" style={{ minWidth: 0 }}>
          <h1 className="t-h2" style={{ padding: "8px 0 16px" }}>
            {STEP_TITLES[step]}
          </h1>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} transition={spring.small} className="stack" style={{ flex: 1 }}>
              {step === 0 && <ChooseItems lines={lines} onToggle={toggleLine} onQty={(id, qty) => updateLine(id, { qty })} planLeft={plan?.left} />}
              {step === 1 && (
                <CareAndSpeed
                  lines={priced}
                  onUpdate={updateLine}
                  speed={effectiveSpeed}
                  setSpeed={setSpeed}
                  expressOk={expressOk}
                  care={care}
                  setCare={setCare}
                  signedIn={Boolean(account)}
                  saveCare={saveCare}
                  setSaveCare={setSaveCare}
                />
              )}
              {step === 2 && (
                <PickupAndReturn
                  now={now}
                  intake={intake}
                  setIntake={(v) => {
                    setIntake(v);
                    setInAt(null);
                  }}
                  handback={handback}
                  setHandback={(v) => {
                    setHandback(v);
                    setDeliveryStart(null);
                  }}
                  zoneId={zoneId}
                  setZoneId={setZoneId}
                  onPlan={pay === "plan"}
                  inAt={inAt}
                  setInAt={setInAt}
                  readyAt={readyAt}
                  deliveryStart={deliveryStart}
                  setDeliveryStart={setDeliveryStart}
                  booked={data.appointments.filter((a) => a.status !== "cancelled" && a.status !== "done").map((a) => a.start)}
                />
              )}
              {step === DETAILS_STEP && (
                <YourDetails
                  contact={contact}
                  setContact={setContact}
                  errors={showErrors ? contactErrors : {}}
                  needsAddress={needsAddress}
                  accountName={account?.name}
                  remember={remember}
                  setRemember={setRemember}
                  onLogIn={() => setLoginOpen(true)}
                />
              )}
              {step === REVIEW_STEP && (
                <Review
                  lines={priced}
                  expressFee={est.expressFee}
                  riderFee={est.riderFee}
                  trips={trips}
                  planCover={est.planCover}
                  planBaskets={est.planBaskets}
                  discount={discount}
                  total={total}
                  totalLabel={totalLabel}
                  intake={intake}
                  handback={handback}
                  inAt={inAt}
                  readyAt={readyAt}
                  deliveryStart={deliveryStart}
                  care={care}
                  speed={effectiveSpeed}
                  comments={comments}
                  setComments={setComments}
                  points={points}
                  signedIn={Boolean(account)}
                  usePoints={usePoints}
                  setUsePoints={setUsePoints}
                  contact={contact}
                  onEditDetails={() => setStep(DETAILS_STEP)}
                  payChoice={pay}
                  setPayChoice={setPayChoice}
                  planUsable={planUsable}
                  planName={plan?.plan?.name}
                  planLeft={plan?.left ?? 0}
                  hasQuoted={hasQuoted}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Desktop: sticky booking summary with the step button */}
        <aside className="flow-aside desk" aria-label="Booking summary">
          <div className="card aside-card stack gap-12">
            <div className="inline" style={{ gap: 12 }}>
              <AppIcon size={44} />
              <div className="stack">
                <p className="t-title">{SHOP.name}</p>
                <span className="subtle t-cap">{SHOP.area}</span>
              </div>
            </div>
            <div className="divider" style={{ margin: 0 }} />
            {priced.length === 0 ? (
              <p className="muted">Nothing chosen yet. Pick a basket or a service to see your price.</p>
            ) : (
              priced.map((line) => (
                <div key={line.serviceId} className="kv">
                  <span className="stack">
                    <span>
                      {line.service?.name} {line.qty > 1 ? `× ${line.qty}` : ""}
                    </span>
                    <span className="subtle t-cap">{itemSummary(line, line.service)}</span>
                  </span>
                  <span>{line.service && isQuoted(line.service) ? "At the counter" : money(line.unitPrice * line.qty)}</span>
                </div>
              ))
            )}
            {inAt && (
              <p className="info-line t-cap muted">
                {intake === "pickup" ? <Bike size={14} /> : <Store size={14} />}
                <span>{intake === "pickup" ? `Pickup ${fmtDayShort(parseLocal(inAt))}, ${windowLabel(inAt, 120)}` : `Drop-off ${fmtDayShort(parseLocal(inAt))}, ${fmtTime(parseLocal(inAt))}`}</span>
              </p>
            )}
            {readyAt && (
              <p className="info-line t-cap muted">
                <Clock size={14} />
                <span>Ready {readyPhrase(localIso(readyAt), now)}</span>
              </p>
            )}
            {deliveryStart && handback === "delivery" && (
              <p className="info-line t-cap muted">
                <Truck size={14} />
                <span>
                  Delivery {fmtDayShort(parseLocal(deliveryStart))}, {windowLabel(deliveryStart, 120)}
                </span>
              </p>
            )}
            {est.expressFee > 0 && (
              <div className="kv muted">
                <span>Express</span>
                <span>{money(est.expressFee)}</span>
              </div>
            )}
            {est.riderFee > 0 && (
              <div className="kv muted">
                <span>Rider ({plural(trips, "trip")})</span>
                <span>{money(est.riderFee)}</span>
              </div>
            )}
            {est.planCover > 0 && (
              <div className="kv muted">
                <span>{plan?.plan?.name} plan</span>
                <span>-{money(est.planCover)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="kv muted">
                <span>Loyalty points</span>
                <span>-{money(discount)}</span>
              </div>
            )}
            <div className="divider" style={{ margin: 0 }} />
            <div className="kv kv-total">
              <span>{totalLabel}</span>
              <span>{money(total)}</span>
            </div>
            {hasQuoted && (
              <p className="info-line t-cap muted">
                <Sparkles size={14} />
                <span>Gowns and heavy beading are priced at the counter, so they aren't in this number yet.</span>
              </p>
            )}
            {step === REVIEW_STEP && (
              <p className="info-line t-cap muted">
                {pay === "now" ? <Lock size={14} /> : <Send size={14} />}
                <span>{pay === "now" ? "Mobile Money or card through Paystack" : pay === "plan" ? "Baskets covered by your plan" : "Pay at the counter or to the rider"}</span>
              </p>
            )}
            {missing && (
              <p className="t-cap" style={{ color: "var(--warning-ink)" }}>
                {missing}
              </p>
            )}
            <div className="stack" style={{ marginTop: 4 }}>
              {cta}
            </div>
          </div>
          <p className="t-cap subtle" style={{ textAlign: "center" }}>
            We count every garment at the counter and send you the tally on WhatsApp.
          </p>
        </aside>
      </div>

      <div className="sticky-bar lt-desk">
        <div className="sticky-bar-meta">
          {step === REVIEW_STEP ? (
            <>
              <span className="subtle t-cap">{hasQuoted ? "So far" : pay === "now" ? "Pay today" : pay === "plan" ? "On your plan" : "Pay when it's done"}</span>
              <strong className="tabular">{money(total)}</strong>
            </>
          ) : step === DETAILS_STEP ? (
            <>
              <strong className="tabular">{money(total)}</strong>
              <span className="t-cap" style={missing ? { color: "var(--warning-ink)" } : undefined}>
                {missing ?? "No account needed"}
              </span>
            </>
          ) : (
            <>
              <strong className="tabular">{money(total)}</strong>
              <span className={`t-cap ${missing && step > 0 ? "" : "subtle"}`} style={missing && step > 0 ? { color: "var(--warning-ink)" } : undefined}>
                {missing && step > 0 ? missing : lines.length ? `${plural(itemCount, "item")} · ready in ${turnaround}` : "Nothing chosen yet"}
              </span>
            </>
          )}
        </div>
        {cta}
      </div>

      <PaystackSheet open={payOpen} onClose={() => setPayOpen(false)} amount={total} label="Payment for your laundry" email={contact.email} phone={contact.phone} onPaid={placeOrder} />
      <AccountSheet open={loginOpen} onClose={() => setLoginOpen(false)} mode="login" defaultPhone={contact.phone} />
      <SuccessScreen open={Boolean(created)} title={created?.intake === "pickup" ? "Pickup booked" : "Drop-off booked"} onDone={onSuccessDone} />
    </main>
  );
}

/* ---------------- Step 1: services ---------------- */

function ChooseItems({ lines, onToggle, onQty, planLeft }: { lines: Draft[]; onToggle: (service: Service) => void; onQty: (id: string, qty: number) => void; planLeft?: number }) {
  const loading = useSkeleton(450);
  const [showPill, setShowPill] = useState(false);
  const scrollTo = useScrollTo();

  useEffect(() => {
    const onScroll = () => setShowPill(window.scrollY > 260);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (loading) return <ListSkeleton />;

  const selectedIds = new Set(lines.map((l) => l.serviceId));
  const firstSelectedId = SERVICES.find((s) => selectedIds.has(s.id))?.id;

  return (
    <>
      {planLeft !== undefined && (
        <div className="banner">
          <p className="info-line">
            <CalendarSync size={16} />
            <span>{planLeft > 0 ? `Your plan has ${plural(planLeft, "basket wash", "basket washes")} left this month. Baskets you add here can go on it.` : "This month's plan baskets are used up. You can still book and pay as usual."}</span>
          </p>
        </div>
      )}
      <div className="chips" style={{ position: "sticky", top: 60, zIndex: 9, background: "var(--ground)", paddingBlock: 8 }}>
        {CATEGORIES.map((c) => (
          <button key={c.id} className="chip" onClick={() => scrollTo(document.getElementById(`cat-${c.id}`), { offset: -120 })}>
            {c.short}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {showPill && lines.length > 0 && (
          <motion.button
            className="selected-pill"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={spring.small}
            onClick={() => scrollTo(firstSelectedId ? document.getElementById(`svc-${firstSelectedId}`) : null, { offset: -window.innerHeight / 3 })}
          >
            {lines.length} selected <ArrowUp size={14} />
          </motion.button>
        )}
      </AnimatePresence>

      {CATEGORIES.map((c) => {
        const items = SERVICES.filter((s) => s.category === c.id);
        if (!items.length) return null;
        return (
          <section key={c.id} id={`cat-${c.id}`} className="section" style={{ scrollMarginTop: 120 }}>
            <div className="stack gap-4">
              <h2 className="t-h3">{c.label}</h2>
              <p className="subtle t-cap">{c.blurb}</p>
            </div>
            <div className="stack gap-12 flow-cards">
              {items.map((service) => {
                const line = lines.find((l) => l.serviceId === service.id);
                const selected = selectedIds.has(service.id);
                const min = service.minQty ?? 1;
                return (
                  <div
                    key={service.id}
                    id={`svc-${service.id}`}
                    role="checkbox"
                    aria-checked={selected}
                    tabIndex={0}
                    className={`select-card ${selected ? "is-selected" : ""}`}
                    onClick={() => onToggle(service)}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === " " || e.key === "Enter")) {
                        e.preventDefault();
                        onToggle(service);
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <Photo tone={service.tone} src={service.photo} alt="" sizes="72px" height={72} radius="var(--r-img)" markSize={26} className="select-thumb" />
                    <div className="grow stack gap-4">
                      <p className="t-title">{service.name}</p>
                      <p className="subtle t-cap">
                        {serviceLine(service)}
                        {service.minQty ? ` · min. ${service.minQty}` : ""}
                      </p>
                      <p className="muted t-body">{service.description}</p>
                      <div className="between" style={{ marginTop: 6, minHeight: 36 }}>
                        <span className="tabular" style={{ fontWeight: 500 }}>
                          {servicePrice(service)}
                        </span>
                        {line && (
                          <span className="qty" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => (line.qty > min ? onQty(service.id, line.qty - 1) : onToggle(service))} aria-label={`One fewer ${service.name}`}>
                              {line.qty > min ? <Minus size={14} /> : <Trash2 size={14} />}
                            </button>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={min}
                              max={100}
                              value={line.qty}
                              onChange={(e) => onQty(service.id, Math.max(min, Math.min(100, Math.floor(Number(e.target.value) || min))))}
                              aria-label={`Quantity of ${service.name}`}
                            />
                            <button onClick={() => onQty(service.id, Math.min(100, line.qty + 1))} aria-label={`One more ${service.name}`}>
                              <Plus size={14} />
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                    <motion.span key={String(selected)} className={`check ${selected ? "is-on" : "is-add"}`} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={spring.small} aria-hidden="true">
                      {selected ? <Check size={16} strokeWidth={2.4} /> : <Plus size={16} />}
                    </motion.span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      <p className="t-cap subtle" style={{ textAlign: "center", marginTop: 20 }}>
        Basket prices from our price list. Not sure which basket? Pick the closest: we confirm the size at the counter before anything is charged.
      </p>
    </>
  );
}

/* ---------------- Step 2: care and speed ---------------- */

function CareAndSpeed({
  lines,
  onUpdate,
  speed,
  setSpeed,
  expressOk,
  care,
  setCare,
  signedIn,
  saveCare,
  setSaveCare,
}: {
  lines: PricedLine[];
  onUpdate: (id: string, patch: Partial<Draft>) => void;
  speed: Speed;
  setSpeed: (s: Speed) => void;
  expressOk: boolean;
  care: CarePrefs;
  setCare: (c: CarePrefs) => void;
  signedIn: boolean;
  saveCare: boolean;
  setSaveCare: (v: boolean) => void;
}) {
  const loading = useSkeleton(450);
  if (loading) return <ListSkeleton />;
  const slow = lines.filter((l) => l.service && !l.service.express).map((l) => l.service?.name);

  return (
    <div className="stack gap-16">
      <section className="stack gap-12">
        <h2 className="t-h3">How fast?</h2>
        <div className="stack gap-12" role="radiogroup" aria-label="Turnaround">
          <ChoiceCard selected={speed === "standard"} onSelect={() => setSpeed("standard")} icon={<Clock size={20} />} title="Standard · 24 hours" body="Ready the same time tomorrow. Suits, kente and duvets take a little longer." />
          <ChoiceCard
            selected={speed === "express"}
            onSelect={() => setSpeed("express")}
            disabled={!expressOk}
            icon={<Zap size={20} />}
            title={`Express · ${RULES.expressHours} hours · +${money(RULES.expressFee)}`}
            body={expressOk ? `Ready ${RULES.expressHours} working hours after it reaches the counter. One fee for the whole order.` : `Not for ${slow.join(", ")}: they need their full time to be done properly.`}
          />
        </div>
      </section>

      <section className="section" style={{ marginTop: 12 }}>
        <h2 className="t-h3">How you like it</h2>
        <div className="card card-pad stack gap-16">
          <OptionGroup label="Finish">
            <div className="option-grid" role="radiogroup" aria-label="Finish">
              {FINISH_OPTIONS.map((o) => (
                <button key={o.id} role="radio" aria-checked={care.finish === o.id} className={`option ${care.finish === o.id ? "is-selected" : ""}`} onClick={() => setCare({ ...care, finish: o.id })}>
                  <span>{o.label}</span>
                  <small>{o.hint}</small>
                </button>
              ))}
            </div>
          </OptionGroup>
          <OptionGroup label="Starch">
            <div className="segmented" role="radiogroup" aria-label="Starch">
              {STARCH_OPTIONS.map((o) => (
                <button key={o.id} role="radio" aria-checked={care.starch === o.id} className={care.starch === o.id ? "is-active" : ""} onClick={() => setCare({ ...care, starch: o.id })}>
                  {o.label}
                </button>
              ))}
            </div>
          </OptionGroup>
          <OptionGroup label="Scent">
            <div className="option-grid" role="radiogroup" aria-label="Scent">
              {SCENT_OPTIONS.map((o) => (
                <button key={o.id} role="radio" aria-checked={care.scent === o.id} className={`option ${care.scent === o.id ? "is-selected" : ""}`} onClick={() => setCare({ ...care, scent: o.id })}>
                  <span>{o.label}</span>
                  <small>{o.hint}</small>
                </button>
              ))}
            </div>
          </OptionGroup>
          <div className="field">
            <label htmlFor="care-notes">Anything we should know? (optional)</label>
            <input id="care-notes" value={care.notes ?? ""} maxLength={300} onChange={(e) => setCare({ ...care, notes: e.target.value })} placeholder="Wash the whites separately, no bleach on the blue shirts" aria-describedby="care-notes-hint" />
            <span id="care-notes-hint" className="hint">
              Printed on your ticket at the counter.
            </span>
          </div>
        </div>
        {signedIn && (
          <label className="check-row">
            <input type="checkbox" checked={saveCare} onChange={(e) => setSaveCare(e.target.checked)} />
            <span className="stack">
              <span>Save as my laundry preferences</span>
              <span className="subtle t-cap">Filled in for you next time, and the counter sees them on every order.</span>
            </span>
          </label>
        )}
      </section>

      {lines.some((l) => l.service && l.service.category !== "baskets") && (
        <section className="section" style={{ marginTop: 12 }}>
          <h2 className="t-h3">Notes on items (optional)</h2>
          <div className="card card-pad stack gap-16">
            {lines
              .filter((l) => l.service && l.service.category !== "baskets")
              .map((line) => (
                <div key={line.serviceId} className="field">
                  <label htmlFor={`note-${line.serviceId}`}>
                    {line.service?.name}
                    {line.qty > 1 ? ` × ${line.qty}` : ""}
                  </label>
                  <input id={`note-${line.serviceId}`} value={line.note ?? ""} maxLength={NOTE_MAX} onChange={(e) => onUpdate(line.serviceId, { note: e.target.value })} placeholder={line.service?.id === "stain" ? "Palm oil on the white blouse" : "Navy suit, missing button on the cuff"} />
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function OptionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="stack gap-8">
      <p className="t-cap muted">{label}</p>
      {children}
    </div>
  );
}

/* ---------------- Step 3: pickup and return ---------------- */

interface HandoverProps {
  now: Date;
  intake: Intake;
  setIntake: (v: Intake) => void;
  handback: Handback;
  setHandback: (v: Handback) => void;
  zoneId: string | null;
  setZoneId: (id: string) => void;
  onPlan: boolean;
  inAt: string | null;
  setInAt: (s: string | null) => void;
  readyAt: Date | null;
  deliveryStart: string | null;
  setDeliveryStart: (s: string | null) => void;
  booked: string[];
}

function PickupAndReturn(p: HandoverProps) {
  const loading = useSkeleton(450);
  const [inDay, setInDay] = useState<string | null>(p.inAt?.slice(0, 10) ?? null);
  const [outDay, setOutDay] = useState<string | null>(p.deliveryStart?.slice(0, 10) ?? null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const readyKey = p.readyAt ? dayKey(p.readyAt) : null;

  useEffect(() => {
    if (!inDay && !outDay) return;
    setSlotsLoading(true);
    const t = window.setTimeout(() => setSlotsLoading(false), 400);
    return () => window.clearTimeout(t);
  }, [inDay, outDay, p.intake]);
  // A new ready time moves the delivery day on if the chosen one is now too early.
  useEffect(() => {
    if (outDay && readyKey && outDay < readyKey) setOutDay(readyKey);
  }, [outDay, readyKey]);

  if (loading) return <ListSkeleton />;

  const inDays = dateStrip(p.now, 14);
  const dropSlots = inDay ? slotsFor(parseLocal(inDay), HOURS, [], p.now, 60, 30, 20) : [];
  const pickupWindows = inDay ? riderWindows(parseLocal(inDay), HOURS, p.booked, p.now) : [];
  const outDays = p.readyAt ? dateStrip(p.readyAt, 10) : [];
  const deliveryWindows = outDay && p.readyAt ? riderWindows(parseLocal(outDay), HOURS, p.booked, p.now, { notBefore: p.readyAt }) : [];
  const riderUsed = p.intake === "pickup" || p.handback === "delivery";

  return (
    <div className="stack gap-8">
      <section className="stack gap-12">
        <h2 className="t-h3">How does it get to us?</h2>
        <div className="stack gap-12" role="radiogroup" aria-label="How it gets to us">
          <ChoiceCard selected={p.intake === "dropoff"} onSelect={() => p.setIntake("dropoff")} icon={<Store size={20} />} title="I'll drop it off" body={`At the counter inside West Hills Mall, any day from ${HOURS[p.now.getDay()]?.[0] ?? "07:00"}. Do it while you shop.`} />
          <ChoiceCard selected={p.intake === "pickup"} onSelect={() => p.setIntake("pickup")} icon={<Bike size={20} />} title="Pick it up from me" body={p.onPlan ? "Free on your plan. Our rider collects in a two-hour window." : "Our rider collects from your door in a two-hour window. Priced by area."} />
        </div>
      </section>

      {riderUsed && (
        <motion.section className="section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring.small}>
          <h2 className="t-h3">Your area</h2>
          <div className="stack gap-8" role="radiogroup" aria-label="Your area">
            {ZONES.map((z) => (
              <button key={z.id} role="radio" aria-checked={p.zoneId === z.id} className={`select-card ${p.zoneId === z.id ? "is-selected" : ""}`} onClick={() => p.setZoneId(z.id)} style={{ alignItems: "center" }}>
                <span className="grow stack">
                  <span className="t-title">{z.name}</span>
                  <span className="subtle t-cap">{z.areas}</span>
                </span>
                <span className="tabular" style={{ fontWeight: 500 }}>
                  {p.onPlan ? "Free" : `${money(z.fee)} a trip`}
                </span>
              </button>
            ))}
          </div>
        </motion.section>
      )}

      <section className="section">
        <h2 className="t-h3">{p.intake === "pickup" ? "When should we come?" : "When will you bring it?"}</h2>
        <DateStrip
          label={p.intake === "pickup" ? "Pickup day" : "Drop-off day"}
          days={inDays}
          selected={inDay ?? undefined}
          onSelect={(key) => {
            setInDay(key);
            p.setInAt(null);
          }}
          stateFor={(day) => {
            const options = p.intake === "pickup" ? riderWindows(day, HOURS, p.booked, p.now) : slotsFor(day, HOURS, [], p.now, 60, 30, 20);
            return { disabled: options.every((o) => !o.available), flag: dayKey(day) === dayKey(p.now) ? "Today" : undefined };
          }}
        />
        {inDay &&
          (slotsLoading ? (
            <div className="slot" style={{ justifyContent: "center", color: "var(--ink-50)" }} aria-label="Loading times">
              <Dots />
            </div>
          ) : (
            <div className="slot-grid" style={{ display: "grid", gridTemplateColumns: p.intake === "pickup" ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 8 }} role="radiogroup" aria-label={p.intake === "pickup" ? "Pickup window" : "Drop-off time"}>
              {(p.intake === "pickup" ? pickupWindows.map((w) => ({ start: w.start, label: w.label, available: w.available, note: w.available && w.left === 1 ? "1 left" : undefined })) : dropSlots.map((s) => ({ start: s.start, label: s.time, available: s.available, note: undefined }))).map((s, i) => (
                <motion.button
                  key={s.start}
                  role="radio"
                  aria-checked={p.inAt === s.start}
                  className={`slot ${p.inAt === s.start ? "is-selected" : ""}`}
                  style={{ justifyContent: "center", paddingInline: 0, flexDirection: "column", gap: 0 }}
                  disabled={!s.available}
                  onClick={() => p.setInAt(s.start)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring.small, delay: i * 0.015 }}
                >
                  <span>{s.label}</span>
                  {s.note && <small className="t-cap">{s.note}</small>}
                </motion.button>
              ))}
            </div>
          ))}
        {p.readyAt && (
          <p className="info-line muted">
            <Clock size={16} />
            <span>Ready {readyPhrase(localIso(p.readyAt), p.now)}, counted from when it reaches the counter.</span>
          </p>
        )}
      </section>

      <section className="section">
        <h2 className="t-h3">How does it come back?</h2>
        <div className="segmented" role="radiogroup" aria-label="How it comes back">
          <button role="radio" aria-checked={p.handback === "collect"} className={p.handback === "collect" ? "is-active" : ""} onClick={() => p.setHandback("collect")}>
            I'll collect it
          </button>
          <button role="radio" aria-checked={p.handback === "delivery"} className={p.handback === "delivery" ? "is-active" : ""} onClick={() => p.setHandback("delivery")}>
            Deliver it
          </button>
        </div>
        {p.handback === "collect" ? (
          <p className="t-cap subtle">Collect from the counter any time after it's ready, until 9pm. Show your order number.</p>
        ) : !p.readyAt ? (
          <p className="t-cap subtle">Pick when we get it first, so we know when it's ready to come back.</p>
        ) : (
          <motion.div className="stack gap-12" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring.small}>
            <DateStrip
              label="Delivery day"
              days={outDays}
              selected={outDay ?? undefined}
              onSelect={(key) => {
                setOutDay(key);
                p.setDeliveryStart(null);
              }}
              stateFor={(day) => ({ disabled: riderWindows(day, HOURS, p.booked, p.now, { notBefore: p.readyAt ?? undefined }).every((w) => !w.available) })}
            />
            {outDay && !slotsLoading && (
              <div className="slot-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }} role="radiogroup" aria-label="Delivery window">
                {deliveryWindows.map((w) => (
                  <button key={w.start} role="radio" aria-checked={p.deliveryStart === w.start} className={`slot ${p.deliveryStart === w.start ? "is-selected" : ""}`} style={{ justifyContent: "center", paddingInline: 0 }} disabled={!w.available} onClick={() => p.setDeliveryStart(w.start)}>
                    {w.label}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </section>
    </div>
  );
}

function ChoiceCard({ selected, onSelect, icon, title, body, disabled }: { selected: boolean; onSelect: () => void; icon: ReactNode; title: string; body: string; disabled?: boolean }) {
  return (
    <button role="radio" aria-checked={selected} className={`select-card ${selected ? "is-selected" : ""}`} onClick={onSelect} disabled={disabled} style={{ alignItems: "center" }}>
      <span className="row-icon" style={{ width: 44, height: 44, borderRadius: 999, background: selected ? "var(--aqua)" : undefined }}>
        {icon}
      </span>
      <span className="grow stack">
        <span className="t-title">{title}</span>
        <span className="subtle t-cap">{body}</span>
      </span>
      <span className={`check ${selected ? "is-on" : "is-add"}`} aria-hidden="true">
        {selected && <Check size={16} strokeWidth={2.4} />}
      </span>
    </button>
  );
}

/* ---------------- Step 4: your details ---------------- */

function YourDetails({ contact, setContact, errors, needsAddress, accountName, remember, setRemember, onLogIn }: {
  contact: ContactDetails;
  setContact: (c: ContactDetails) => void;
  errors: ContactErrors;
  needsAddress: boolean;
  accountName?: string;
  remember: boolean;
  setRemember: (v: boolean) => void;
  onLogIn: () => void;
}) {
  const set = (key: keyof ContactDetails) => (e: { target: { value: string } }) => setContact({ ...contact, [key]: e.target.value });
  const field = (key: keyof ContactDetails, label: string, props: InputHTMLAttributes<HTMLInputElement>, hint?: string) => (
    <div className="field">
      <label htmlFor={`contact-${key}`}>{label}</label>
      <input id={`contact-${key}`} value={contact[key]} onChange={set(key)} aria-invalid={Boolean(errors[key])} aria-describedby={`contact-${key}-hint`} {...props} />
      {(errors[key] || hint) && (
        <span id={`contact-${key}-hint`} className={errors[key] ? "error" : "hint"}>
          {errors[key] ?? hint}
        </span>
      )}
    </div>
  );

  return (
    <div className="stack gap-16">
      {accountName ? (
        <p className="info-line muted">
          <UserRound size={16} />
          <span>Logged in as {accountName}. Changes here update your account.</span>
        </p>
      ) : (
        <div className="card card-pad between" style={{ gap: 12 }}>
          <span className="stack">
            <span className="t-title">No account needed</span>
            <span className="muted t-cap">Used the shop before with an account? Log in to fill this in.</span>
          </span>
          <Button size="sm" onClick={onLogIn}>
            Log in
          </Button>
        </div>
      )}

      <section className="card card-pad stack gap-16">
        {field("name", "Full name", { autoComplete: "name", placeholder: "Ama Mensah" })}
        {field("phone", "WhatsApp number", { inputMode: "tel", autoComplete: "tel-national", placeholder: "024 123 4567", readOnly: Boolean(accountName) }, accountName ? "Your account number. Message the shop to change it." : "Your garment count, updates and receipts come here.")}
        {field("email", "Email", { type: "email", inputMode: "email", autoComplete: "email", placeholder: "ama@gmail.com" }, "Paystack sends your payment receipt here.")}
        {field("town", "Town or area", { autoComplete: "address-level2", placeholder: "Weija" })}
      </section>

      {needsAddress && (
        <motion.section className="section" style={{ marginTop: 0 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring.small}>
          <h2 className="t-h3">Where the rider comes</h2>
          <div className="card card-pad stack gap-16">
            {field("address", "Street or landmark", { autoComplete: "street-address", placeholder: "Gbawe Zero, blue gate opposite the Total station" })}
            {field("digitalAddress", "GhanaPost digital address (optional)", { autoCapitalize: "characters", placeholder: "GS-0123-4567", style: { fontFamily: "var(--mono)" } }, "Find it in the GhanaPostGPS app. Helps the rider find you.")}
          </div>
        </motion.section>
      )}

      {!accountName && (
        <label className="check-row">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span className="stack">
            <span>Remember me on this phone</span>
            <span className="subtle t-cap">Fills this in next time. Don't tick it on a shared phone.</span>
          </span>
        </label>
      )}
    </div>
  );
}

/* ---------------- Step 5: review ---------------- */

interface ReviewProps {
  lines: PricedLine[];
  expressFee: number;
  riderFee: number;
  trips: number;
  planCover: number;
  planBaskets: number;
  discount: number;
  total: number;
  totalLabel: string;
  intake: Intake;
  handback: Handback;
  inAt: string | null;
  readyAt: Date | null;
  deliveryStart: string | null;
  care: CarePrefs;
  speed: Speed;
  comments: string;
  setComments: (c: string) => void;
  points: number;
  signedIn: boolean;
  usePoints: boolean;
  setUsePoints: (v: boolean) => void;
  contact: ContactDetails;
  onEditDetails: () => void;
  payChoice: PayChoice;
  setPayChoice: (c: PayChoice) => void;
  planUsable: boolean;
  planName?: string;
  planLeft: number;
  hasQuoted: boolean;
}

function Review(r: ReviewProps) {
  const loading = useSkeleton(550);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [draft, setDraft] = useState(r.comments);

  if (loading) return <ListSkeleton />;

  const inAt = r.inAt ? parseLocal(r.inAt) : null;
  const delivery = r.deliveryStart ? parseLocal(r.deliveryStart) : null;

  return (
    <div className="stack gap-8">
      <section className="card card-pad stack gap-12">
        <div className="inline" style={{ gap: 12 }}>
          <AppIcon size={52} />
          <div className="stack">
            <p className="t-title">{SHOP.name}</p>
            <span className="inline t-cap" style={{ gap: 6 }}>
              <strong style={{ fontWeight: 500 }}>{SHOP.rating}</strong> <Stars value={SHOP.rating} size={12} /> <span className="subtle">({SHOP.reviewCount})</span>
            </span>
            <span className="subtle t-cap">{SHOP.area}</span>
          </div>
        </div>
        <div className="divider" style={{ margin: 0 }} />
        {inAt && (
          <p className="info-line">
            {r.intake === "pickup" ? <Bike size={16} /> : <Store size={16} />}
            <span>{r.intake === "pickup" ? `Rider collects ${fmtDayLong(inAt)}, ${windowLabel(r.inAt!, 120)}` : `You drop it off ${fmtDayLong(inAt)} around ${fmtTime(inAt)}`}</span>
          </p>
        )}
        {r.readyAt && (
          <p className="info-line">
            <Clock size={16} />
            <span>
              Ready {fmtDayShort(r.readyAt)} at {fmtTime(r.readyAt)}
              {r.speed === "express" ? " · express" : ""}
            </span>
          </p>
        )}
        <p className="info-line">
          <Truck size={16} />
          <span>{r.handback === "delivery" && delivery ? `Delivered ${fmtDayShort(delivery)}, ${windowLabel(r.deliveryStart!, 120)}, to ${r.contact.address}` : `Collect at the counter, ${SHOP.area}`}</span>
        </p>
        <p className="info-line">
          <Droplet size={16} />
          <span>{careSummary(r.care)}</span>
        </p>
        <div className="divider" style={{ margin: 0 }} />
        {r.lines.map((line) => (
          <div key={line.serviceId} className="kv">
            <span className="stack">
              <span>
                {line.service?.name} {line.qty > 1 ? `× ${line.qty}` : ""}
              </span>
              <span className="subtle t-cap">{itemSummary(line, line.service)}</span>
            </span>
            <span>{line.service && isQuoted(line.service) ? "At the counter" : money(line.unitPrice * line.qty)}</span>
          </div>
        ))}
        {r.expressFee > 0 && (
          <div className="kv">
            <span>Express</span>
            <span>{money(r.expressFee)}</span>
          </div>
        )}
        {r.riderFee > 0 && (
          <div className="kv">
            <span>Rider ({plural(r.trips, "trip")})</span>
            <span>{money(r.riderFee)}</span>
          </div>
        )}
        {r.planCover > 0 && (
          <div className="kv">
            <span>
              {r.planName} plan ({plural(r.planBaskets, "basket")})
            </span>
            <span>-{money(r.planCover)}</span>
          </div>
        )}
        {r.discount > 0 && (
          <div className="kv">
            <span>Loyalty points</span>
            <span>-{money(r.discount)}</span>
          </div>
        )}
        <div className="divider" style={{ margin: 0 }} />
        <div className="kv kv-total">
          <span>{r.totalLabel}</span>
          <span>{money(r.total)}</span>
        </div>
        {r.signedIn && (
          <>
            <div className="divider" style={{ margin: 0 }} />
            <div className="between">
              <span>Discounts and benefits</span>
              <Button size="sm" onClick={() => setDiscountOpen(true)}>
                {r.usePoints ? "Change" : "Add"}
              </Button>
            </div>
          </>
        )}
      </section>

      <section className="section">
        <h2 className="t-h3">How do you want to pay?</h2>
        <div className="stack gap-12" role="radiogroup" aria-label="How to pay">
          {r.planUsable && (
            <ChoiceCard
              selected={r.payChoice === "plan"}
              onSelect={() => r.setPayChoice("plan")}
              icon={<CalendarSync size={20} />}
              title={`Use my ${r.planName} plan`}
              body={`${plural(r.planLeft, "basket wash", "basket washes")} left this month, rider trips free.${r.total > 0 ? ` Anything else (${money(r.total)}) is paid at the counter or to the rider.` : ""}`}
            />
          )}
          <ChoiceCard
            selected={r.payChoice === "now"}
            onSelect={() => r.setPayChoice("now")}
            icon={<Wallet size={20} />}
            title={`Pay ${money(r.total)} now`}
            body={r.hasQuoted ? "Mobile Money or card through Paystack. The gown is priced at the counter and added then." : "Mobile Money or card through Paystack. If the counter finds a bigger basket, we settle the difference."}
          />
          <ChoiceCard selected={r.payChoice === "later"} onSelect={() => r.setPayChoice("later")} icon={<Shirt size={20} />} title="Pay when it's done" body={r.handback === "delivery" ? "By MoMo or cash to the rider, or in the app before it leaves." : "By MoMo, card or cash at the counter when you collect."} />
        </div>
      </section>

      <section className="section">
        <h2 className="t-h3">Good to know</h2>
        <div className="card card-pad stack gap-4">
          <p className="t-title">Counting and care</p>
          <p className="muted">{POLICIES.important}</p>
        </div>
        <div className="card card-pad stack gap-4">
          <p className="t-title">Payment</p>
          <p className="muted">{POLICIES.payment}</p>
        </div>
        <div className="card card-pad stack gap-4">
          <p className="t-title">Cancellation</p>
          <p className="muted">{POLICIES.cancellation}</p>
        </div>
      </section>

      <section className="section">
        <h2 className="t-h3">Anything else?</h2>
        <div className="card card-pad between">
          <span className={r.comments ? "" : "muted"} style={{ whiteSpace: "pre-wrap" }}>
            {r.comments || "Gate code, who to call, which bag is which?"}
          </span>
          <Button
            size="sm"
            onClick={() => {
              setDraft(r.comments);
              setCommentsOpen(true);
            }}
          >
            {r.comments ? "Edit" : "Add"}
          </Button>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="t-h3">Your details</h2>
          <Button size="sm" onClick={r.onEditDetails}>
            Edit
          </Button>
        </div>
        <div className="card card-pad stack gap-8">
          <p className="t-title">{r.contact.name}</p>
          <p className="info-line muted">
            <Phone size={16} />
            <span>WhatsApp {r.contact.phone}</span>
          </p>
          <p className="info-line muted">
            <Mail size={16} />
            <span>{r.contact.email}</span>
          </p>
          <p className="info-line muted">
            <MapPin size={16} />
            <span>{r.trips > 0 ? [r.contact.address, r.contact.town, r.contact.digitalAddress].filter(Boolean).join(" · ") : r.contact.town}</span>
          </p>
        </div>
        <p className="t-cap subtle">Prices come straight off our price list. The counter confirms the basket size before anything is charged.</p>
      </section>

      <Sheet open={commentsOpen} onClose={() => setCommentsOpen(false)} title="Anything else?">
        <div className="stack gap-16">
          <div className="field">
            <label htmlFor="comments">Your note to the shop</label>
            <textarea id="comments" value={draft} maxLength={600} onChange={(e) => setDraft(e.target.value)} placeholder="Call when you're at the gate; the white bag is the school uniforms…" />
            <span className="hint">{draft.length}/600</span>
          </div>
          <Button
            variant="dark"
            block
            onClick={() => {
              r.setComments(draft.trim());
              setCommentsOpen(false);
            }}
          >
            Save note
          </Button>
        </div>
      </Sheet>

      <Sheet open={discountOpen} onClose={() => setDiscountOpen(false)} title="Discounts and benefits">
        <div className="stack gap-16">
          <button className={`select-card ${r.usePoints ? "is-selected" : ""}`} onClick={() => r.setUsePoints(!r.usePoints)} role="switch" aria-checked={r.usePoints} style={{ alignItems: "center" }}>
            <span className="row-icon is-aqua">
              <Sparkles size={18} />
            </span>
            <span className="grow stack">
              <span className="t-title">Use your loyalty points</span>
              <span className="subtle t-cap">You have {r.points}. Every 10 points take GH₵ 1 off, up to 10% of the order, and only the points used are spent.</span>
            </span>
            <span className={`check ${r.usePoints ? "is-on" : "is-add"}`} aria-hidden="true">
              {r.usePoints && <Check size={16} strokeWidth={2.4} />}
            </span>
          </button>
          <Button variant="dark" block onClick={() => setDiscountOpen(false)}>
            Done
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="stack gap-12" aria-busy="true" aria-label="Loading">
      <div className="inline" style={{ gap: 8 }}>
        {[80, 70, 90].map((w) => (
          <Skeleton key={w} w={w} h={36} r={500} />
        ))}
      </div>
      <Skeleton w="30%" h={20} style={{ marginTop: 12 }} />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card card-pad stack gap-8">
          <Skeleton w="55%" h={16} />
          <Skeleton w="30%" h={12} />
          <div className="between">
            <Skeleton w="25%" h={14} />
            <Skeleton w={28} h={28} r={999} />
          </div>
        </div>
      ))}
    </div>
  );
}
