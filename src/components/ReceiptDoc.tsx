import { motion } from "motion/react";
import { POLICIES, SHOP } from "../data/business";
import { serviceById } from "../data/catalog";
import type { Customer, Order, Payment, PaymentMethod, Subscription } from "../data/types";
import { formatGhPhone } from "../lib/contact";
import { fmtDate, fmtTime, money } from "../lib/format";
import { itemSummary } from "../lib/items";
import { adjustmentLabel, counterAdjustment } from "../lib/orders";
import { amountInWords, verifyCode } from "../lib/receipts";
import { enter } from "../motion";
import { AppIcon, LogoMark } from "./Brand";

const METHOD_LABEL: Record<PaymentMethod, string> = { momo: "Mobile Money", card: "Card", cash: "Cash", bank: "Bank transfer" };
export const KIND_LABEL = { full: "Payment in full", part: "Part payment", final: "Final payment" } as const;

/** What a receipt is for: an order, or one month of a plan. Both print the same way. */
export interface ReceiptSubject {
  /** AL-1042, or the plan's reference. */
  ref: string;
  refLabel: string;
  total: number;
  payments: Payment[];
  rows: { label: string; note?: string; qty?: number; amount: number }[];
}

export function orderSubject(order: Order): ReceiptSubject {
  const rows: ReceiptSubject["rows"] = order.items.map((item) => {
    const service = serviceById(item.serviceId);
    return { label: service?.name ?? "Laundry", note: itemSummary(item, service), qty: item.qty, amount: item.unitPrice * item.qty };
  });
  if (order.expressFee) rows.push({ label: "Express service", amount: order.expressFee });
  if (order.riderFee) rows.push({ label: "Rider pickup and delivery", amount: order.riderFee });
  if (order.planCover) rows.push({ label: "Covered by monthly plan", amount: -order.planCover });
  if (order.discount) rows.push({ label: "Loyalty points", amount: -order.discount });
  const adjustment = counterAdjustment(order);
  if (adjustment) rows.push({ label: adjustmentLabel(adjustment), amount: adjustment });
  return { ref: order.number, refLabel: "Order no.", total: order.total, payments: order.payments, rows };
}

/** Each plan payment is its own month, so its receipt stands alone. */
export function planSubject(subscription: Subscription, payment: Payment, planName: string): ReceiptSubject {
  return {
    ref: `PLAN-${subscription.id.replace(/^s-/, "").toUpperCase()}`,
    refLabel: "Plan ref.",
    total: payment.amount,
    payments: [payment],
    rows: [{ label: `${planName} plan`, note: "One month of basket washes, with rider pickup and delivery", qty: 1, amount: payment.amount }],
  };
}

/** The running totals printed on a receipt, as they stood when this payment came in. */
export function receiptFigures(subject: ReceiptSubject, payment: Payment) {
  const ordered = [...subject.payments].sort((a, b) => a.at.localeCompare(b.at));
  const index = ordered.findIndex((p) => p.id === payment.id);
  const before = ordered.slice(0, Math.max(0, index)).reduce((s, p) => s + p.amount, 0);
  const paidToDate = before + payment.amount;
  return {
    paid: new Date(payment.at),
    before,
    paidToDate,
    remaining: Math.max(0, subject.total - paidToDate),
    code: verifyCode(payment.receiptNo, payment.amount),
  };
}

export function receiptShareText(subject: ReceiptSubject, payment: Payment): string {
  const { paid, remaining, code } = receiptFigures(subject, payment);
  return `${SHOP.name} official receipt ${payment.receiptNo}\n${KIND_LABEL[payment.kind]}: ${money(payment.amount)}\n${subject.refLabel.replace(".", "")} ${subject.ref} · ${fmtDate(paid)}\nBalance remaining: ${money(remaining)}\nVerification: ${code}`;
}

/** The official receipt document, shared by the client's receipt page and the owner side. */
export function ReceiptDoc({ subject, payment, customer }: { subject: ReceiptSubject; payment: Payment; customer?: Customer }) {
  const { paid, before, paidToDate, remaining, code } = receiptFigures(subject, payment);
  return (
  <motion.article className="receipt" aria-label={`Official receipt ${payment.receiptNo}`} {...enter(24)}>
      <header className="receipt-head">
        <AppIcon size={48} />
        <div className="grow stack">
          <p className="t-title">{SHOP.name}</p>
          <p className="subtle t-cap">{SHOP.tagline}</p>
          <p className="subtle t-cap">{SHOP.address}</p>
          <p className="subtle t-cap">Tel / WhatsApp {SHOP.phone}</p>
        </div>
      </header>

      <div className="receipt-amount" style={{ marginTop: 20 }}>
        <div className="stack gap-4">
          <p className="receipt-label">Official receipt</p>
          <p className="t-num">{money(payment.amount)}</p>
          <p className="muted">
            {KIND_LABEL[payment.kind]} · received with thanks
          </p>
        </div>
        <div className="stamp" aria-hidden="true">
          <span>
            <b>PAID</b>
            {fmtDate(paid)}
          </span>
        </div>
      </div>

      <dl className="receipt-grid" style={{ marginTop: 20 }}>
        <div>
          <dt>Receipt no.</dt>
          <dd className="t-mono">{payment.receiptNo}</dd>
        </div>
        <div>
          <dt>Date and time</dt>
          <dd>
            {fmtDate(paid)}, {fmtTime(paid)}
          </dd>
        </div>
        <div>
          <dt>{subject.refLabel}</dt>
          <dd className="t-mono">{subject.ref}</dd>
        </div>
        <div>
          <dt>Payment method</dt>
          <dd>
            {METHOD_LABEL[payment.method]}
            {payment.payer && payment.method === "momo" && (
              <span className="subtle t-cap" style={{ display: "block", fontWeight: 400 }}>
                {payment.payer}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Transaction ref.</dt>
          <dd className="t-mono">{payment.reference}</dd>
        </div>
        <div>
          <dt>Received by</dt>
          <dd>{payment.receivedBy}</dd>
        </div>
      </dl>

      <div className="divider" style={{ marginBlock: 18 }} />

      <div className="stack gap-4">
        <p className="receipt-label">Received from</p>
        <p className="t-title">{customer?.name ?? "Customer"}</p>
        {customer && (
          <p className="muted t-cap">
            {[formatGhPhone(customer.phone), customer.email, customer.town].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      <table className="receipt-table" style={{ marginTop: 18 }}>
        <thead>
          <tr>
            <th scope="col">Description</th>
            <th scope="col" className="num">
              Qty
            </th>
            <th scope="col" className="num">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {subject.rows.map((row, i) => (
            <tr key={`${row.label}-${i}`}>
              <td>
                {row.label}
                {row.note && (
                  <span className="subtle t-cap" style={{ display: "block" }}>
                    {row.note}
                  </span>
                )}
              </td>
              <td className="num">{row.qty ?? ""}</td>
              <td className="num">{money(row.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="stack" style={{ marginTop: 14, gap: 8, fontVariantNumeric: "tabular-nums" }}>
        <div className="kv">
          <span>{subject.refLabel === "Plan ref." ? "Plan total" : "Order total"}</span>
          <span>{money(subject.total)}</span>
        </div>
        <div className="kv muted">
          <span>Paid before this receipt</span>
          <span>{money(before)}</span>
        </div>
        <div className="kv receipt-highlight" style={{ fontWeight: 600 }}>
          <span>This payment</span>
          <span>{money(payment.amount)}</span>
        </div>
        <div className="kv">
          <span>Total paid to date</span>
          <span>{money(paidToDate)}</span>
        </div>
        <div className="kv kv-total">
          <span>Balance remaining</span>
          <span>{money(remaining)}</span>
        </div>
      </div>

      <p className="muted t-cap" style={{ marginTop: 14 }}>
        <span className="subtle">Amount in words: </span>
        {amountInWords(payment.amount)}
      </p>

      <div className="perforation" aria-hidden="true" />

      <footer className="stack gap-12">
        <div className="between" style={{ alignItems: "flex-end" }}>
          <div className="stack gap-4">
            <span className="subtle t-cap">Verification code</span>
            <span className="t-mono" style={{ fontSize: 18, letterSpacing: "0.12em" }}>
              {code}
            </span>
          </div>
          <div className="stack" style={{ alignItems: "center", gap: 2 }}>
            <LogoMark size={34} />
            <span style={{ width: 120, height: 1, background: "var(--ink-25)" }} />
            <span className="subtle t-cap">Authorised signature</span>
          </div>
        </div>
        <p className="subtle t-cap">
          {POLICIES.payment} {POLICIES.handover}
        </p>
        <p className="t-cap" style={{ textAlign: "center" }}>
          Thank you for choosing {SHOP.name}. {SHOP.tagline}
        </p>
      </footer>
    </motion.article>
  );
}
