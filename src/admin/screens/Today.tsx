import { ArrowRight, Bike, CalendarSync, Check, ChevronRight, ClipboardCheck, Send, Table2, Truck, WashingMachine, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Badge, Skeleton } from "../../components/Bits";
import { Cta } from "../../components/Button";
import { CountUp } from "../../components/Scroll";
import { HOURS } from "../../data/business";
import { customerById, shop, useAppData } from "../../data/store";
import type { Appointment, Order } from "../../data/types";
import { whatsappLink } from "../../lib/contact";
import { dayKey, fmtDayLong, fmtTime, parseLocal, plural } from "../../lib/format";
import { balanceDue, IN_SHOP } from "../../lib/orders";
import { bucketsFor, compactMoney, dueByHour, floorNow, isPeriodId, kpi, leadSources, METRICS, periodLabel, periodRange, topServices, type MetricId, type PeriodId } from "../../lib/metrics";
import { planStatus, renewalDue } from "../../lib/plans";
import { openStatus, windowLabel } from "../../lib/schedule";
import { OWNER_STAGE_LABEL, dueQueue, floorLoad, orderTitle, ownerBadge, ownerDateLine, renewalMessage } from "../../lib/shop";
import { enter } from "../../motion";
import { BarChart, LegendLine, LineChart, RankTable } from "../charts";
import { ActionBanner, ActionCard, CardHead, KpiTabs, PeriodSelect, formatMetric } from "../controls";
import { useFirstLoad, useFirstVisit, useNow } from "../hooks";
import { MoneyTag } from "../orderActions";
import { AdminPage, EmptyState } from "../Shell";

const TODAY_METRICS: MetricId[] = ["cash", "newOrders", "owed", "collected"];
export const INK = "#242426";
export const PREVIOUS = "rgba(36, 36, 38,0.5)";

export const PURPOSE_LABEL: Record<Appointment["purpose"], string> = { pickup: "Rider pickup", delivery: "Delivery" };

export function usePeriod(fallback: PeriodId = "30d"): [PeriodId, (p: PeriodId) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("period");
  const period = isPeriodId(raw) ? raw : fallback;
  const set = (p: PeriodId) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (p === fallback) next.delete("period");
        else next.set("period", p);
        return next;
      },
      { replace: true },
    );
  return [period, set];
}

/** A trend card: KPI tabs on top drive one line chart against the previous period (pattern A). */
export function TrendCard({ ids, period, id, reportLink }: { ids: MetricId[]; period: PeriodId; id: string; reportLink?: boolean }) {
  const data = useAppData();
  const now = useNow();
  const first = useFirstVisit(`trend:${id}`);
  const [metric, setMetric] = useState<MetricId>(ids[0]!);
  const [asTable, setAsTable] = useState(false);
  const planPayments = useMemo(() => data.subscriptions.flatMap((s) => s.payments), [data.subscriptions]);
  const kpis = useMemo(() => ids.map((m) => kpi(m, data.orders, period, now, planPayments)), [ids, data.orders, period, now, planPayments]);
  const active = kpis.find((k) => k.def.id === metric) ?? kpis[0]!;
  const range = periodRange(period, now);
  const buckets = bucketsFor(period, range);
  const fmt = (n: number) => formatMetric(n, active.def.format);
  const axis = (n: number) => (active.def.format === "money" ? compactMoney(n) : active.def.format === "percent" ? `${n}%` : String(n));
  const tipLabel = (i: number) => {
    const b = buckets[i];
    if (!b) return "";
    return period === "90d" ? `Week of ${b.label}` : period === "year" ? `${b.label} ${b.start.getFullYear()}` : b.label;
  };
  const summary = `${active.def.label}, ${periodLabel(period).toLowerCase()}: ${formatMetric(active.value, active.def.format)}${active.delta.change !== null ? `, ${active.delta.direction} ${Math.round(Math.abs(active.delta.change) * 100)}% on the previous period` : ""}.`;

  return (
    <section className="adm-card kpi-card" aria-label="Trends">
      <KpiTabs kpis={kpis} active={active.def.id} onSelect={(m) => setMetric(m as MetricId)} animate={first} id={id} />
      <div id={`${id}-panel`} role="tabpanel" style={{ padding: "16px 20px 8px" }}>
        {asTable ? (
          <div className="adm-table-wrap" style={{ maxHeight: 280 }}>
            <table className="adm-table">
              <thead>
                <tr>
                  <th scope="col">{period === "year" ? "Month" : period === "90d" ? "Week of" : "Day"}</th>
                  <th scope="col" className="num">
                    {periodLabel(period)}
                  </th>
                  <th scope="col" className="num">
                    Previous period
                  </th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b, i) => (
                  <tr key={b.label + i} style={{ cursor: "default" }}>
                    <td>{tipLabel(i)}</td>
                    <td className="num">{formatMetric(active.series[i] ?? null, active.def.format)}</td>
                    <td className="num">{formatMetric(active.previousSeries[i] ?? null, active.def.format)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <LineChart
            dataKey={active.def.id + period}
            animate={first}
            ariaLabel={summary}
            labels={buckets.map((b) => b.label)}
            tipLabel={tipLabel}
            format={fmt}
            axisFormat={axis}
            height={230}
            emptyText={`No ${active.def.label.toLowerCase()} in this period`}
            series={[
              { label: periodLabel(period), values: active.series, color: INK, area: true },
              { label: "Previous period", values: active.previousSeries, color: PREVIOUS, dashed: true },
            ]}
          />
        )}
        <div style={{ marginTop: 10 }}>
          <LegendLine items={[{ label: periodLabel(period), color: INK }, { label: "Previous period", color: PREVIOUS, dashed: true }]} />
        </div>
      </div>
      <div className="adm-card-foot">
        <span className="adm-meta">{METRICS[active.def.id].hint}</span>
        <span className="inline" style={{ gap: 12 }}>
          <button className="adm-link" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable}>
            <Table2 size={15} /> {asTable ? "Chart" : "Table"}
          </button>
          {reportLink && (
            <Link to={`/admin/reports${period === "30d" ? "" : `?period=${period}`}`} className="adm-link">
              Reports <ArrowRight size={14} />
            </Link>
          )}
        </span>
      </div>
    </section>
  );
}

export function Today() {
  const data = useAppData();
  const now = useNow();
  const navigate = useNavigate();
  const [period, setPeriod] = usePeriod();
  const loading = useFirstLoad("today");
  const first = useFirstVisit("today");
  const floor = useMemo(() => floorNow(data.orders, now), [data.orders, now]);
  const hours = useMemo(() => dueByHour(data.orders, now), [data.orders, now]);
  const services = useMemo(() => topServices(data.orders, periodRange(period, now)).slice(0, 5), [data.orders, period, now]);
  const sources = useMemo(() => leadSources(data.orders, data.customers, periodRange(period, now)), [data.orders, data.customers, period, now]);
  const todayKey = dayKey(now);
  const runs = data.appointments.filter((a) => a.start.startsWith(todayKey) && a.status !== "cancelled").sort((a, b) => a.start.localeCompare(b.start));
  const ready = data.orders.filter((o) => o.status === "ready" || o.status === "out").sort((a, b) => balanceDue(b) - balanceDue(a));
  const arriving = data.orders.filter((o) => o.status === "booked" && o.inAt.slice(0, 10) <= todayKey).sort((a, b) => a.inAt.localeCompare(b.inAt));
  const overdueIn = arriving.filter((o) => parseLocal(o.inAt) < now).length;
  const open = openStatus(now, HOURS);

  const urgent =
    floor.late > 0
      ? { title: `${plural(floor.late, "load")} past ${floor.late === 1 ? "its" : "their"} promised time`, body: "Finish these first and message the clients with a new time.", cta: "See late loads", to: "/admin/orders?due=late&sort=due" }
      : overdueIn > 0
        ? { title: `${plural(overdueIn, "booking")} should be at the counter`, body: "The drop-off time or the rider's window has passed. Check them in, or call the client.", cta: "Check in", to: "/admin/orders?stage=booked&sort=due" }
        : floor.express > 0
          ? { title: `${plural(floor.express, "express order")} in the shop`, body: "Express orders are promised within hours. Keep them at the front of the queue.", cta: "See express", to: "/admin/orders?stage=shop&tag=express&sort=due" }
          : null;

  return (
    <AdminPage
      title="Today"
      status={
        <>
          <span className={`adm-dot ${open.open ? "is-open" : ""}`} aria-hidden="true" />
          {fmtDayLong(now)} · {open.label} · {floor.inShop} in the shop
        </>
      }
      actions={
        <>
          <PeriodSelect value={period} onChange={setPeriod} />
          <Cta onClick={() => navigate("/admin/orders/new")}>New drop-off</Cta>
        </>
      }
    >
      {loading ? (
        <TodaySkeleton />
      ) : (
        <div className="adm-with-rail">
          <div className="adm-stack">
            {urgent && (
              <div className="narrow-only">
                <ActionBanner title={urgent.title} body={urgent.body} cta={urgent.cta} onClick={() => navigate(urgent.to)} />
              </div>
            )}
            <motion.div {...(first ? enter(16) : {})}>
              <CounterQueue orders={data.orders} now={now} />
            </motion.div>

            <motion.div {...(first ? enter(16, 0.04) : {})}>
              <TrendCard ids={TODAY_METRICS} period={period} id="today" reportLink />
            </motion.div>

            <motion.div className="adm-grid adm-grid-b" {...(first ? enter(16, 0.08) : {})}>
              <section className="adm-card adm-dark" aria-labelledby="shop-now">
                <div className="adm-card-body" style={{ paddingTop: 18 }}>
                  <p id="shop-now" className="adm-meta">
                    In the shop now
                  </p>
                  <p className="adm-big" style={{ marginTop: 6 }}>
                    {first ? <CountUp to={floor.inShop} /> : floor.inShop}
                  </p>
                  <p className="muted">{floor.inShop === 1 ? "order checked in and not yet ready" : "orders checked in and not yet ready"}</p>
                  <div className="stage-strip" style={{ marginTop: 20 }}>
                    {floor.stages.map((s) => {
                      const max = Math.max(1, ...floor.stages.map((x) => x.count));
                      return (
                        <Link key={s.status} to="/admin/orders?stage=shop" className="stage-col" aria-label={`${s.count} ${OWNER_STAGE_LABEL[s.status]}`}>
                          <span className="adm-meta truncate">{OWNER_STAGE_LABEL[s.status]}</span>
                          <span className="num">{s.count}</span>
                          <span className="stage-track" aria-hidden="true">
                            <motion.i initial={first ? { scaleX: 0 } : false} animate={{ scaleX: 1 }} transition={{ type: "spring", bounce: 0.2, duration: 1, delay: 0.2 }} style={{ width: `${(s.count / max) * 100}%` }} />
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                  <div className="divider" style={{ marginBlock: 18 }} />
                  <Link to="/admin/orders?due=today&sort=due" className="kv">
                    <span>Due back today</span>
                    <b>{floor.dueToday}</b>
                  </Link>
                  <Link to="/admin/orders?due=late&sort=due" className="kv">
                    <span>Late</span>
                    <b style={floor.late ? { color: "var(--sand)" } : undefined}>{floor.late}</b>
                  </Link>
                  <Link to="/admin/orders?stage=shop&tag=express" className="kv">
                    <span>Express in progress</span>
                    <b>{floor.express}</b>
                  </Link>
                  <Link to="/admin/orders?stage=ready" className="kv">
                    <span>Ready, not handed over</span>
                    <b>{floor.ready}</b>
                  </Link>
                </div>
              </section>

              <section className="adm-card" aria-labelledby="hours">
                <CardHead id="hours" title="Due back today, by hour" action={<span className="adm-meta">{plural(floor.dueToday, "order")}</span>} />
                <div className="adm-card-body">
                  <BarChart
                    animate={first}
                    height={190}
                    ariaLabel={`Orders due back each hour today: ${hours.map((h) => `${h.label} ${h.count}`).join(", ")}`}
                    bars={hours.map((h) => ({
                      label: String(h.hour),
                      value: h.count,
                      emphasis: h.hour === now.getHours(),
                      closed: false,
                      title: `${h.label}: ${plural(h.count, "order")} due`,
                    }))}
                  />
                  <p className="adm-meta" style={{ marginTop: 8 }}>
                    Orders in the shop by the hour they're promised. The current hour is darker.
                  </p>
                </div>
              </section>
            </motion.div>

            <motion.div className="adm-grid adm-grid-2" {...(first ? enter(16, 0.14) : {})}>
              <section className="adm-card" aria-labelledby="runs">
                <CardHead
                  id="runs"
                  title="Today's rider runs"
                  action={
                    <Link to="/admin/appointments" className="adm-link">
                      All runs <ChevronRight size={14} />
                    </Link>
                  }
                />
                {runs.length ? (
                  <div className="adm-rows" style={{ padding: "6px 0 8px" }}>
                    {runs.map((a) => (
                      <RunRow key={a.id} appointment={a} now={now} />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={<Bike size={22} />} title="No rider runs today" body="Pickups and deliveries booked for today show here, by window." />
                )}
              </section>

              <section className="adm-card" aria-labelledby="sources">
                <CardHead id="sources" title="Where orders came from" action={<span className="adm-meta">{periodLabel(period)}</span>} />
                <div className="adm-card-body">
                  <RankTable nameLabel="Source" valueLabel="Orders" empty="No orders in this period." rows={sources.map((s) => ({ key: s.key, name: s.label, value: s.value, share: s.share }))} />
                </div>
              </section>
            </motion.div>

            <motion.section className="adm-card" aria-labelledby="services" {...(first ? enter(16, 0.2) : {})}>
              <CardHead id="services" title="Most asked for" action={<span className="adm-meta">{periodLabel(period)}</span>} />
              <div className="adm-card-body">
                <RankTable nameLabel="Service" valueLabel="Orders" empty="No orders in this period." rows={services.map((s) => ({ key: s.key, name: s.label, value: s.value, share: s.share }))} />
              </div>
            </motion.section>
          </div>

          <aside className="adm-rail" aria-label="Needs attention">
            {urgent && (
              <div className="wide-only">
                <ActionCard title={urgent.title} body={urgent.body} cta={urgent.cta} onClick={() => navigate(urgent.to)} />
              </div>
            )}
            <section className="adm-card" aria-labelledby="arriving">
              <CardHead id="arriving" title="Coming in today" action={<span className="chip-count">{arriving.length}</span>} />
              {arriving.length ? (
                <div className="adm-rows" style={{ padding: "6px 0 8px" }}>
                  {arriving.slice(0, 6).map((o) => (
                    <Link key={o.id} to={`/admin/orders/${o.id}`} className="adm-row">
                      <span className={`adm-row-time ${parseLocal(o.inAt) < now ? "is-past" : ""}`}>{fmtTime(parseLocal(o.inAt))}</span>
                      <span className="grow stack">
                        <span className="truncate" style={{ fontWeight: 500 }}>
                          {customerById(data, o.customerId)?.name ?? o.number}
                        </span>
                        <span className="t-cap muted truncate">
                          {o.intake === "pickup" ? "Rider pickup" : "Drop-off"} · {orderTitle(o)}
                        </span>
                      </span>
                      <ClipboardCheck size={18} className="row-chevron" />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="adm-card-body muted">No more bookings due at the counter today.</p>
              )}
            </section>
            <section className="adm-card" aria-labelledby="ready">
              <CardHead id="ready" title="Ready to hand over" action={<span className="chip-count">{ready.length}</span>} />
              {ready.length ? (
                <div className="adm-rows" style={{ padding: "6px 0 8px" }}>
                  {ready.slice(0, 5).map((o) => (
                    <Link key={o.id} to={`/admin/orders/${o.id}`} className="adm-row">
                      <span className="grow stack">
                        <span className="truncate" style={{ fontWeight: 500 }}>
                          {customerById(data, o.customerId)?.name ?? o.number}
                        </span>
                        <span className="t-cap muted truncate">
                          {o.status === "out" ? "With the rider" : o.handback === "delivery" ? "To go out" : "On the shelf"} · {orderTitle(o)}
                        </span>
                      </span>
                      <MoneyTag order={o} />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="adm-card-body muted">Nothing waiting on the shelf.</p>
              )}
              {ready.length > 5 && (
                <div className="adm-card-foot">
                  <Link to="/admin/orders?stage=ready" className="adm-link">
                    See all {ready.length} <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </section>
            <RenewalsCard now={now} />
          </aside>
        </div>
      )}
    </AdminPage>
  );
}

/** The counter's working order: what's in the shop, soonest promise first, or the whole load by service. */
function CounterQueue({ orders, now }: { orders: Order[]; now: Date }) {
  const data = useAppData();
  const [view, setView] = useState<"queue" | "load">("queue");
  const queue = useMemo(() => dueQueue(orders), [orders]);
  const load = useMemo(() => floorLoad(orders), [orders]);
  const pieces = queue.reduce((n, o) => n + (o.checkIn?.count ?? 0), 0);
  return (
    <section className="adm-card" aria-labelledby="counter">
      <CardHead
        id="counter"
        title="On the counter now"
        action={
          <span className="inline" style={{ gap: 6 }} role="radiogroup" aria-label="How to show it">
            <button role="radio" aria-checked={view === "queue"} className={`chip ${view === "queue" ? "is-active" : ""}`} onClick={() => setView("queue")}>
              Due next
            </button>
            <button role="radio" aria-checked={view === "load"} className={`chip ${view === "load" ? "is-active" : ""}`} onClick={() => setView("load")}>
              The load
            </button>
          </span>
        }
      />
      {queue.length === 0 ? (
        <EmptyState icon={<WashingMachine size={22} />} title="Nothing in the shop" body="Orders show here from the moment they're checked in until they're ready." />
      ) : view === "queue" ? (
        <div className="adm-rows" style={{ padding: "6px 0 8px" }}>
          {queue.slice(0, 8).map((o) => {
            const line = ownerDateLine(o, now);
            const badge = ownerBadge(o, now);
            return (
              <Link key={o.id} to={`/admin/orders/${o.id}`} className="adm-row">
                <span className={`adm-row-time ${line.late ? "is-past" : ""}`}>{fmtTime(parseLocal(o.readyAt))}</span>
                <span className="grow stack">
                  <span className="truncate" style={{ fontWeight: 500 }}>
                    {customerById(data, o.customerId)?.name ?? o.number}
                    {o.speed === "express" && (
                      <span className="inline t-cap" style={{ gap: 2, marginLeft: 8, color: "var(--label-sand)" }}>
                        <Zap size={12} /> Express
                      </span>
                    )}
                  </span>
                  <span className="t-cap muted truncate">
                    <span className="t-mono">{o.number}</span> · {orderTitle(o)} · {line.text}
                  </span>
                </span>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="adm-rows" style={{ padding: "6px 0 8px" }}>
          {load.map((line) => (
            <div key={line.serviceId} className="adm-row">
              <span className="adm-row-time">{line.qty}×</span>
              <span className="grow stack">
                <span className="truncate" style={{ fontWeight: 500 }}>
                  {line.name}
                </span>
                <span className="t-cap muted truncate">{plural(line.orders.length, "order")}</span>
              </span>
              <span className="t-cap muted t-mono truncate" style={{ maxWidth: "40%" }}>
                {line.orders.join(", ")}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="adm-card-foot">
        <span className="adm-meta">
          {queue.length ? `${plural(queue.length, "order")}, ${plural(pieces, "piece")} counted. ` : ""}
          {IN_SHOP.map((s) => OWNER_STAGE_LABEL[s]).join(", ")}.
        </span>
        {queue.length > 8 && view === "queue" && (
          <Link to="/admin/orders?stage=shop&sort=due" className="adm-link">
            All {queue.length} <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </section>
  );
}

/** Plans running out in the next three days: one tap opens the renewal reminder in WhatsApp. */
function RenewalsCard({ now }: { now: Date }) {
  const data = useAppData();
  const due = data.subscriptions
    .filter((s) => renewalDue(s, now))
    .map((s) => ({ s, status: planStatus(s, data.orders, now), customer: customerById(data, s.customerId) }))
    .sort((a, b) => a.s.renewsOn.localeCompare(b.s.renewsOn));
  const active = data.subscriptions.filter((s) => s.status === "active" && s.renewsOn > dayKey(now)).length;
  return (
    <section id="renewals" className="adm-card" aria-labelledby="renewals-title">
      <CardHead
        id="renewals-title"
        title="Plan renewals"
        action={
          <Link to="/admin/plans" className="adm-link">
            {plural(active, "member")} <ChevronRight size={14} />
          </Link>
        }
      />
      {due.length ? (
        <div className="adm-rows" style={{ padding: "6px 0 8px" }}>
          {due.map(({ s, status, customer }) => (
            <div key={s.id} className="adm-row">
              <span className="grow stack">
                <span className="truncate" style={{ fontWeight: 500 }}>
                  {customer ? <Link to={`/admin/clients/${customer.id}`}>{customer.name}</Link> : "Client"}
                </span>
                <span className="t-cap muted truncate">
                  {status.plan?.name} · {status.renewsIn === 0 ? "renews today" : status.renewsIn === 1 ? "renews tomorrow" : `renews in ${status.renewsIn} days`}
                </span>
              </span>
              <a className="btn btn-dark btn-sm" href={whatsappLink(customer?.phone ?? "", renewalMessage(s, customer, now))} target="_blank" rel="noreferrer" aria-label={`Send ${customer?.name ?? "the client"} a renewal reminder on WhatsApp`}>
                <Send size={14} /> Remind
              </a>
            </div>
          ))}
        </div>
      ) : (
        <p className="adm-card-body muted inline" style={{ gap: 8 }}>
          <CalendarSync size={16} /> No plans renew in the next 3 days.
        </p>
      )}
    </section>
  );
}

function RunRow({ appointment: a, now }: { appointment: Appointment; now: Date }) {
  const data = useAppData();
  const start = parseLocal(a.start);
  const past = new Date(start.getTime() + a.minutes * 60_000) < now;
  const customer = customerById(data, a.customerId);
  const order = a.orderId ? data.orders.find((o) => o.id === a.orderId) : undefined;
  return (
    <div className="adm-row">
      <span className={`adm-row-time ${past ? "is-past" : ""}`}>{fmtTime(start)}</span>
      <span className="grow stack">
        <span className="truncate" style={{ fontWeight: 500 }}>
          {customer ? <Link to={`/admin/clients/${customer.id}`}>{customer.name}</Link> : "Client"}
        </span>
        <span className="t-cap muted truncate inline" style={{ gap: 4 }}>
          {a.purpose === "pickup" ? <Bike size={12} /> : <Truck size={12} />}
          {PURPOSE_LABEL[a.purpose]} · {windowLabel(a.start, a.minutes)}
          {customer?.town ? ` · ${customer.town}` : ""}
          {order ? (
            <>
              {" · "}
              <Link to={`/admin/orders/${order.id}`} className="t-mono">
                {order.number}
              </Link>
            </>
          ) : null}
        </span>
      </span>
      {a.status === "requested" ? (
        <button className="btn btn-dark btn-sm" onClick={() => shop.setAppointmentStatus(a.id, "confirmed")}>
          Confirm
        </button>
      ) : a.status === "done" ? (
        <Badge tone="mist" icon={<Check size={13} />}>
          Done
        </Badge>
      ) : past ? (
        <button className="btn btn-soft btn-sm" onClick={() => shop.setAppointmentStatus(a.id, "done")}>
          Mark done
        </button>
      ) : (
        <Badge tone="wash">Booked</Badge>
      )}
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="adm-with-rail" aria-busy="true">
      <div className="adm-stack">
        <Skeleton h={360} r={8} />
        <div className="adm-grid adm-grid-b">
          <Skeleton h={320} r={8} />
          <Skeleton h={320} r={8} />
        </div>
      </div>
      <div className="adm-rail">
        <Skeleton h={160} r={8} />
        <Skeleton h={260} r={8} />
      </div>
    </div>
  );
}
