import { Link } from "react-router-dom";
import { useMemo } from "react";
import { customerById, useAppData } from "../../data/store";
import { money, plural } from "../../lib/format";
import { bucketsFor, categoryShares, compactMoney, expressShare, handoverShares, kpi, leadSources, metricSeries, paymentsByMethod, periodLabel, periodRange, topClients, topServices, zoneShares, type MetricId } from "../../lib/metrics";
import { profitIn } from "../../lib/spend";
import { LegendLine, LineChart, RankTable, SegmentedBar, Sparkline } from "../charts";
import { CardHead, DeltaPill, PeriodSelect, formatMetric } from "../controls";
import { useFirstVisit, useNow } from "../hooks";
import { AdminPage } from "../Shell";
import { METHOD_COLOR } from "./Payments";
import { INK, TrendCard, usePeriod } from "./Today";

const REPORT_METRICS: MetricId[] = ["newOrders", "collected", "avgOrder", "onTime"];
const SPARK_METRICS: MetricId[] = ["cash", "owed", "newOrders", "onTime"];
const SLATE = "#58718a";

export function Reports() {
  const data = useAppData();
  const now = useNow();
  const [period, setPeriod] = usePeriod();
  const first = useFirstVisit("reports");
  const range = periodRange(period, now);
  const buckets = bucketsFor(period, range);
  const planPayments = useMemo(() => data.subscriptions.flatMap((s) => s.payments), [data.subscriptions]);
  const sparks = useMemo(() => SPARK_METRICS.map((m) => kpi(m, data.orders, period, now, planPayments)), [data.orders, period, now, planPayments]);
  const taken = useMemo(() => metricSeries("newOrders", data.orders, buckets, now), [data.orders, period, now]);
  const collected = useMemo(() => metricSeries("collected", data.orders, buckets, now), [data.orders, period, now]);
  const methods = paymentsByMethod(data.orders, range, planPayments);
  const clients = topClients(data.orders, data.customers, range).slice(0, 6);
  const categories = categoryShares(data.orders, range);
  const zones = zoneShares(data.orders, range);
  const handover = handoverShares(data.orders, range);
  const express = expressShare(data.orders, range);
  const sources = leadSources(data.orders, data.customers, range);
  const services = topServices(data.orders, range).slice(0, 8);
  const profit = profitIn(data.orders, data.expenses, range, data.subscriptions);

  return (
    <AdminPage title="Reports" status={<>{periodLabel(period)} compared with the period before</>} actions={<PeriodSelect value={period} onChange={setPeriod} />}>
      <div className="adm-stack">
        <TrendCard ids={REPORT_METRICS} period={period} id="reports" />

        <div className="adm-grid adm-report">
          <section className="adm-card" aria-label="Key numbers">
            {sparks.map((k, i) => (
              <div key={k.def.id} className="between" style={{ padding: "16px 20px", borderTop: i ? "1px solid var(--ink-06)" : undefined, alignItems: "flex-end" }}>
                <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <span className="adm-meta">{k.def.label}</span>
                  <span style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{formatMetric(k.value, k.def.format, true)}</span>
                  <DeltaPill delta={k.delta} />
                </span>
                <Sparkline values={k.series} label={`${k.def.label} trend`} width={84} height={34} />
              </div>
            ))}
          </section>

          <div className="adm-stack">
            <section className="adm-card" aria-labelledby="flow">
              <CardHead id="flow" title="Orders taken and handed over" action={<LegendLine items={[{ label: "Taken", color: INK }, { label: "Handed over", color: SLATE }]} />} />
              <div className="adm-card-body">
                <LineChart
                  animate={first}
                  dataKey={period}
                  height={220}
                  labels={buckets.map((b) => b.label)}
                  format={(n) => plural(n, "order")}
                  axisFormat={String}
                  ariaLabel={`Orders taken and handed over, ${periodLabel(period).toLowerCase()}: ${taken.reduce<number>((s, v) => s + (v ?? 0), 0)} taken, ${collected.reduce<number>((s, v) => s + (v ?? 0), 0)} handed over.`}
                  emptyText="No orders in this period"
                  series={[
                    { label: "Taken", values: taken, color: INK },
                    { label: "Handed over", values: collected, color: SLATE },
                  ]}
                />
              </div>
            </section>
            <section className="adm-card" aria-labelledby="methods">
              <CardHead id="methods" title="Payments by method" action={<Link className="adm-link" to={`/admin/payments${period === "30d" ? "" : `?period=${period}`}`}>All payments</Link>} />
              <div className="adm-card-body">
                <SegmentedBar animate={first} format={money} ariaLabel={`Payments by method: ${methods.map((m) => `${m.label} ${Math.round(m.share * 100)}%`).join(", ")}`} parts={methods.map((m) => ({ key: m.key, label: m.label, value: m.value, share: m.share, color: METHOD_COLOR[m.key] }))} />
              </div>
            </section>
          </div>

          <div className="adm-stack adm-report-side">
            <section className="adm-card" aria-labelledby="clients">
              <CardHead id="clients" title="Top clients" />
              {clients.length ? (
                <div className="adm-rows" style={{ paddingBlock: "4px 8px" }}>
                  {clients.map((c) => (
                    <Link key={c.customer.id} to={`/admin/clients/${c.customer.id}`} className="adm-row" style={{ minHeight: 52 }}>
                      <span className="grow stack">
                        <span className="truncate">{customerById(data, c.customer.id)?.name}</span>
                        <span className="t-cap muted">{plural(c.orders, "order")}</span>
                      </span>
                      <span className="tabular" style={{ fontWeight: 500 }}>
                        {compactMoney(c.amount)}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="adm-card-body muted">No payments in this period.</p>
              )}
            </section>
            <section className="adm-card" aria-labelledby="takings">
              <CardHead id="takings" title="Takings by service" />
              <div className="adm-card-body">
                <RankTable nameLabel="Part of the list" valueLabel="Sold" format={compactMoney} empty="No orders in this period." rows={categories.map((c) => ({ key: c.key, name: c.label, value: c.value, share: c.share }))} />
              </div>
            </section>
          </div>
        </div>

        <div className="adm-grid adm-grid-2">
          <section className="adm-card" aria-labelledby="money-in-out">
            <CardHead id="money-in-out" title="Money in and out" action={<Link className="adm-link" to="/admin/expenses">Expenses</Link>} />
            <div className="adm-card-body">
              <dl className="adm-kv-grid">
                <div>
                  <dt>Received</dt>
                  <dd className="big">{compactMoney(profit.received)}</dd>
                </div>
                <div>
                  <dt>Spent</dt>
                  <dd className="big">{compactMoney(profit.spent)}</dd>
                </div>
                <div>
                  <dt>Left over</dt>
                  <dd className="big" style={profit.profit < 0 ? { color: "var(--danger)" } : undefined}>
                    {compactMoney(profit.profit)}
                  </dd>
                </div>
              </dl>
              <p className="adm-meta" style={{ marginTop: 12 }}>
                {profit.margin === null ? "Nothing came in this period." : `${Math.round(profit.margin * 100)}% of what came in is left after expenses. Cash in minus cash out, plans included.`}
              </p>
            </div>
          </section>
          <section className="adm-card" aria-labelledby="top-services">
            <CardHead id="top-services" title="Most asked for" action={express !== null ? <span className="adm-meta">{Math.round(express * 100)}% express</span> : undefined} />
            <div className="adm-card-body">
              <RankTable nameLabel="Service" valueLabel="Orders" empty="No orders in this period." rows={services.map((s) => ({ key: s.key, name: s.label, value: s.value, share: s.share }))} />
            </div>
          </section>
          <section className="adm-card" aria-labelledby="zones">
            <CardHead id="zones" title="Where the rider goes" action={<span className="adm-meta">{handover.find((h) => h.key === "rider") ? `${Math.round((handover.find((h) => h.key === "rider")?.share ?? 0) * 100)}% of orders use the rider` : ""}</span>} />
            <div className="adm-card-body">
              <RankTable nameLabel="Area" valueLabel="Orders" empty="No rider orders in this period." rows={zones.map((z) => ({ key: z.key, name: z.label, value: z.value, share: z.share }))} />
            </div>
          </section>
          <section className="adm-card" aria-labelledby="lead">
            <CardHead id="lead" title="How clients found the shop" />
            <div className="adm-card-body">
              <RankTable nameLabel="Source" valueLabel="Orders" empty="No orders in this period." rows={sources.map((s) => ({ key: s.key, name: s.label, value: s.value, share: s.share }))} />
            </div>
          </section>
        </div>
      </div>
    </AdminPage>
  );
}
