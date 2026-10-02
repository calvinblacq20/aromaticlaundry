import { CircleAlert, Printer, Share2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Skeleton, useSkeleton } from "../components/Bits";
import { Button } from "../components/Button";
import { TopBar } from "../components/Chrome";
import { useNotify } from "../components/Notify";
import { orderSubject, planSubject, ReceiptDoc, receiptShareText, type ReceiptSubject } from "../components/ReceiptDoc";
import { planById } from "../data/catalog";
import { accessOf, customerById, useAppData } from "../data/store";
import type { Payment } from "../data/types";
import { canViewOrder } from "../lib/checkout";

export function ReceiptPage() {
  const { orderId, subscriptionId, paymentId } = useParams();
  const data = useAppData();
  const notify = useNotify();
  const loading = useSkeleton(500);
  // Receipts are only shown on the phone or account the order belongs to; plan receipts only to the plan's owner.
  let subject: ReceiptSubject | undefined;
  let payment: Payment | undefined;
  let customerId: string | undefined;
  if (subscriptionId) {
    const sub = data.subscriptions.find((s) => s.id === subscriptionId && s.customerId === data.session.customerId);
    payment = sub?.payments.find((p) => p.id === paymentId);
    if (sub && payment) {
      subject = planSubject(sub, payment, planById(sub.planId)?.name ?? "Monthly");
      customerId = sub.customerId;
    }
  } else {
    const found = data.orders.find((o) => o.id === orderId);
    const order = found && canViewOrder(found, accessOf(data)) ? found : undefined;
    payment = order?.payments.find((p) => p.id === paymentId);
    if (order && payment) {
      subject = orderSubject(order);
      customerId = order.customerId;
    }
  }
  const customer = customerId ? customerById(data, customerId) : undefined;
  const backLabel = subscriptionId ? "Back to plans" : "Back to order";

  if (loading) {
    return (
      <main className="screen is-doc" aria-busy="true">
        <TopBar back backRow={backLabel} title="Receipt" alwaysSolid />
        <Skeleton h={640} r={10} style={{ marginTop: 8 }} />
      </main>
    );
  }

  if (!subject || !payment) {
    return (
      <main className="screen is-doc">
        <TopBar back backRow="Back" title="Receipt" alwaysSolid />
        <div className="empty" style={{ marginTop: "12vh" }}>
          <span className="empty-icon">
            <CircleAlert size={24} />
          </span>
          <p className="t-title">Receipt not found</p>
          <p className="muted">Open it from your order or your plan. If you booked on another phone, find the order first.</p>
          <Link to="/orders?tab=receipts" className="btn btn-outline" style={{ marginTop: 8 }}>
            All receipts
          </Link>
        </div>
      </main>
    );
  }


  const share = async () => {
    const text = receiptShareText(subject, payment);
    try {
      if (navigator.share) await navigator.share({ title: `Receipt ${payment.receiptNo}`, text });
      else {
        await navigator.clipboard.writeText(text);
        notify("Receipt copied", "Paste it into WhatsApp or anywhere you need it.");
      }
    } catch {
      /* share sheet closed */
    }
  };

  return (
    <main className="screen is-doc">
      <TopBar
        back
        backRow={backLabel}
        title={payment.receiptNo}
        alwaysSolid
        right={
          <button className="icon-btn is-plain no-print" onClick={share} aria-label="Share receipt">
            <Share2 size={20} strokeWidth={1.8} />
          </button>
        }
      />

      <ReceiptDoc subject={subject} payment={payment} customer={customer} />

      <div className="stack gap-12 no-print receipt-actions" style={{ marginTop: 16 }}>
        <Button variant="dark" block icon={<Printer size={18} />} onClick={() => window.print()}>
          Print or save as PDF
        </Button>
        <Button block icon={<Share2 size={18} />} onClick={share}>
          Share receipt
        </Button>
      </div>
    </main>
  );
}
