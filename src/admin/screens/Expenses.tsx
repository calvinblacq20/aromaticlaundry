import { Banknote, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "../../components/Bits";
import { Button } from "../../components/Button";
import { Dropdown } from "../../components/Dropdown";
import { useNotify } from "../../components/Notify";
import { EXPENSE_CATEGORIES, expenseCategoryLabel } from "../../data/expenses";
import { shop, useAppData } from "../../data/store";
import type { Expense, PaymentMethod } from "../../data/types";
import { dayKey, fmtDayShort, money, parseLocal, plural } from "../../lib/format";
import { compactMoney, delta, periodLabel, periodRange, previousRange } from "../../lib/metrics";
import { METHOD_LABEL } from "../../lib/shop";
import { expensesIn, profitIn, spendByCategory, spendByKind, totalSpend } from "../../lib/spend";
import { RankTable } from "../charts";
import { CardHead, CheckRow, DeltaPill, PeriodSelect } from "../controls";
import { useFirstLoad, useNow } from "../hooks";
import { AdminPage, EmptyState } from "../Shell";
import { ConfirmSheet } from "../sheets";
import { usePeriod } from "./Today";

const METHODS: PaymentMethod[] = ["momo", "cash", "bank"];
const toNumber = (v: string) => Number(v.replace(/[^\d.]/g, ""));

/** Money going out: what the washing costs and what the month costs, set against what came in. */
export function Expenses() {
  const data = useAppData();
  const now = useNow();
  const notify = useNotify();
  const [period, setPeriod] = usePeriod();
  const loading = useFirstLoad("expenses");
  const [removing, setRemoving] = useState<Expense | null>(null);
  const [limit, setLimit] = useState(20);

  const range = periodRange(period, now);
  const prev = previousRange(period, range);
  const inPeriod = useMemo(() => expensesIn(data.expenses, range).sort((a, b) => b.on.localeCompare(a.on) || b.createdAt.localeCompare(a.createdAt)), [data.expenses, period, now]);
  const spent = totalSpend(inPeriod);
  const spentBefore = totalSpend(expensesIn(data.expenses, prev));
  const byCategory = spendByCategory(inPeriod);
  const byKind = spendByKind(inPeriod);
  const profit = profitIn(data.orders, data.expenses, range, data.subscriptions);

  return (
    <AdminPage title="Expenses" status={<>{periodLabel(period)} · {plural(inPeriod.length, "expense")}</>} actions={<PeriodSelect value={period} onChange={setPeriod} />}>
      <div className="adm-grid adm-grid-3" style={{ marginBottom: 16 }}>
        <section className="adm-card" aria-labelledby="spent">
          <CardHead id="spent" title="Spent" action={<DeltaPill delta={delta(spent, spentBefore, "down")} />} />
          <div className="adm-card-body">
            <p className="adm-big" style={{ color: "var(--ink)" }}>
              {money(spent)}
            </p>
            <p className="muted">
              {compactMoney(byKind.direct)} on the washing · {compactMoney(byKind.overhead)} on the month
            </p>
          </div>
        </section>
        <section className="adm-card" aria-labelledby="received">
          <CardHead id="received" title="Received" action={<Link className="adm-link" to="/admin/payments">Payments</Link>} />
          <div className="adm-card-body">
            <p className="adm-big" style={{ color: "var(--ink)" }}>
              {money(profit.received)}
            </p>
            <p className="muted">Order payments and plan renewals.</p>
          </div>
        </section>
        <section className="adm-card" aria-labelledby="left">
          <CardHead id="left" title="Left over" />
          <div className="adm-card-body">
            <p className="adm-big" style={{ color: profit.profit < 0 ? "var(--danger)" : "var(--ink)" }}>
              {money(profit.profit)}
            </p>
            <p className="muted">{profit.margin === null ? "Nothing came in this period." : `${Math.round(profit.margin * 100)}% of what came in.`}</p>
          </div>
        </section>
      </div>

      <div className="adm-with-rail">
        <div className="adm-stack">
          <AddExpense />
          {loading ? (
            <Skeleton h={320} r={8} />
          ) : inPeriod.length === 0 ? (
            <div className="adm-card">
              <EmptyState icon={<Banknote size={22} />} title="No expenses in this period" body="Add what you spend on detergent, power, the rider and rent, and Reports shows what's really left." />
            </div>
          ) : (
            <section className="adm-card" aria-labelledby="list">
              <CardHead id="list" title="What went out" action={<span className="adm-meta">{money(spent)}</span>} />
              <div className="adm-rows" style={{ paddingBlock: 4 }}>
                {inPeriod.slice(0, limit).map((e) => (
                  <div key={e.id} className="adm-row">
                    <span className="adm-row-time">{fmtDayShort(parseLocal(e.on)).replace(/^\w+, /, "")}</span>
                    <span className="grow stack">
                      <span className="truncate" style={{ fontWeight: 500 }}>
                        {expenseCategoryLabel(e.categoryId)}
                      </span>
                      <span className="t-cap muted truncate">
                        {e.note ? `${e.note} · ` : ""}
                        {METHOD_LABEL[e.method]}
                      </span>
                    </span>
                    <span className="tabular" style={{ fontWeight: 500 }}>
                      {money(e.amount)}
                    </span>
                    <button className="icon-btn is-plain" style={{ width: 32, height: 32 }} onClick={() => setRemoving(e)} aria-label={`Remove ${expenseCategoryLabel(e.categoryId)} on ${e.on}`}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              {limit < inPeriod.length && (
                <div className="adm-card-foot">
                  <span className="adm-meta">
                    Showing {limit} of {inPeriod.length}
                  </span>
                  <button className="btn btn-outline btn-sm" onClick={() => setLimit((l) => l + 20)}>
                    Load more
                  </button>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="adm-rail" aria-label="Breakdown">
          <section className="adm-card" aria-labelledby="by-cat">
            <CardHead id="by-cat" title="Where it went" />
            <div className="adm-card-body">
              <RankTable nameLabel="Category" valueLabel="Spent" format={compactMoney} empty="Nothing spent in this period." rows={byCategory.map((c) => ({ key: c.id, name: c.label, value: c.amount, share: c.share }))} />
            </div>
          </section>
          <CategoriesCard />
        </aside>
      </div>

      <ConfirmSheet
        open={removing !== null}
        onClose={() => setRemoving(null)}
        danger
        title="Remove this expense?"
        body={removing ? `${expenseCategoryLabel(removing.categoryId)}, ${money(removing.amount)} on ${fmtDayShort(parseLocal(removing.on))}. Use this for a mistake; it comes off the totals.` : ""}
        confirmLabel="Remove"
        onConfirm={() => {
          if (removing) shop.removeExpense(removing.id);
          setRemoving(null);
          notify("Expense removed", "The totals are updated.");
        }}
      />
    </AdminPage>
  );
}

function AddExpense() {
  const notify = useNotify();
  const today = dayKey(new Date());
  const [on, setOn] = useState(today);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(EXPENSE_CATEGORIES[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("momo");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = shop.addExpense({ on, amount: toNumber(amount), categoryId, note, method });
    if ("error" in result) return setError(result.error);
    setError(null);
    setAmount("");
    setNote("");
    notify("Expense added", `${money(result.expense.amount)} on ${expenseCategoryLabel(result.expense.categoryId).toLowerCase()}.`);
  };

  return (
    <form className="adm-card" aria-labelledby="add" onSubmit={submit} noValidate>
      <CardHead id="add" title="Add an expense" />
      <div className="adm-card-body stack gap-16">
        <div className="adm-grid adm-grid-3" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="exp-amount">Amount (GH₵)</label>
            <input id="exp-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 320" />
          </div>
          <div className="field">
            <label htmlFor="exp-cat">What for</label>
            <Dropdown id="exp-cat" variant="field" value={categoryId} onChange={setCategoryId} options={EXPENSE_CATEGORIES.map((c) => ({ value: c.id, label: c.label, hint: c.kind === "direct" ? "Washing" : "Monthly" }))} />
          </div>
          <div className="field">
            <label htmlFor="exp-on">Day</label>
            <input id="exp-on" type="date" max={today} value={on} onChange={(e) => setOn(e.target.value)} />
          </div>
        </div>
        <div className="adm-grid" style={{ gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "end" }}>
          <div className="field">
            <label htmlFor="exp-note">Note (optional)</label>
            <input id="exp-note" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="Two gallons of softener, ECG prepaid" />
          </div>
          <div className="segmented" role="radiogroup" aria-label="Paid by" style={{ width: 220 }}>
            {METHODS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "is-active" : ""} onClick={() => setMethod(m)}>
                {METHOD_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p className="adm-form-error" role="alert">
            {error}
          </p>
        )}
        <Button variant="dark" type="submit" style={{ alignSelf: "flex-start" }}>
          Add expense
        </Button>
      </div>
    </form>
  );
}

/** The owner keeps only the categories she uses; switching one off keeps its past expenses. */
function CategoriesCard() {
  const data = useAppData();
  const activeCount = data.expenseCategories.filter((c) => c.active !== false).length;
  return (
    <section className="adm-card" aria-labelledby="cats">
      <CardHead id="cats" title="Categories you use" />
      <div className="adm-card-body">
        {data.expenseCategories.map((c) => (
          <CheckRow key={c.id} checked={c.active !== false} onChange={(on) => (on || activeCount > 1 ? shop.setExpenseCategoryActive(c.id, on) : undefined)} label={c.label} />
        ))}
        <p className="adm-meta" style={{ marginTop: 8 }}>
          Switched-off categories leave the form and the charts. What you already recorded stays.
        </p>
      </div>
    </section>
  );
}
