import { Camera, Copy, MessageCircle, X } from "lucide-react";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "../components/Button";
import { useNotify } from "../components/Notify";
import { Sheet } from "../components/Sheet";
import { shop } from "../data/store";
import { careSummary, serviceById } from "../data/catalog";
import type { Customer, Order, OrderStatus, PaymentMethod } from "../data/types";
import { whatsappLink } from "../lib/contact";
import { money } from "../lib/format";
import { balanceDue, paidTotal, stageLabel, stagesFor } from "../lib/orders";
import { OWNER_STAGE_LABEL, orderTitle, updateMessage } from "../lib/shop";

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "momo", label: "MoMo" },
  { id: "cash", label: "Cash" },
  { id: "bank", label: "Bank" },
  { id: "card", label: "Card" },
];

const parseAmount = (value: string) => Number(value.replace(/[^\d.]/g, ""));

function OrderLine({ order, customer }: { order: Order; customer?: Customer }) {
  return (
    <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
      {order.number} · {orderTitle(order)}
      {customer ? ` · ${customer.name}` : ""}
    </p>
  );
}

export function RecordPaymentSheet({ order, customer, open, onClose, onRecorded }: { order: Order; customer?: Customer; open: boolean; onClose: () => void; onRecorded?: (receiptNo: string) => void }) {
  const notify = useNotify();
  const id = useId();
  const balance = balanceDue(order);
  const suggested = balance;
  const half = Math.round(balance / 20) * 10;
  const [amount, setAmount] = useState(String(suggested));
  const [method, setMethod] = useState<PaymentMethod>("momo");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount(String(suggested));
    setMethod("momo");
    setReference("");
    setError(null);
  }, [open, suggested]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = shop.recordPayment(order.id, { amount: parseAmount(amount), method, reference: method === "cash" ? undefined : reference });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onClose();
    notify("Payment recorded", `${money(result.payment.amount)} from ${customer?.name ?? order.number}. Receipt ${result.payment.receiptNo}.`);
    onRecorded?.(result.payment.receiptNo);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Record payment">
      <OrderLine order={order} customer={customer} />
      <form className="stack gap-16" onSubmit={submit} noValidate>
        <div className="kv">
          <span className="muted">Order total</span>
          <span>{money(order.total)}</span>
        </div>
        <div className="kv" style={{ marginTop: -8 }}>
          <span className="muted">Balance</span>
          <span style={{ fontWeight: 500 }}>{money(balance)}</span>
        </div>
        <div className="stack gap-8">
          <label htmlFor={`${id}-amount`} className="t-cap muted">
            Amount received (GH₵)
          </label>
          <input id={`${id}-amount`} className="adm-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
          <div className="inline" style={{ gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => setAmount(String(balance))}>
              {paidTotal(order) === 0 ? "Full amount" : "Full balance"} {money(balance)}
            </button>
            {half > 0 && half < balance && (
              <button type="button" className="btn btn-soft btn-sm" onClick={() => setAmount(String(half))}>
                Half {money(half)}
              </button>
            )}
          </div>
        </div>
        <div className="stack gap-8">
          <span className="t-cap muted" id={`${id}-method`}>
            Paid by
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby={`${id}-method`}>
            {METHODS.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={method === m.id} className={method === m.id ? "is-active" : ""} onClick={() => setMethod(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        {method !== "cash" && (
          <div className="stack gap-8">
            <label htmlFor={`${id}-ref`} className="t-cap muted">
              {method === "momo" ? "MoMo transaction ID (optional)" : "Reference (optional)"}
            </label>
            <input id={`${id}-ref`} className="adm-input" value={reference} maxLength={40} onChange={(e) => setReference(e.target.value)} placeholder={method === "momo" ? "e.g. 58830211" : ""} />
          </div>
        )}
        {error && (
          <p id={`${id}-error`} className="adm-form-error" role="alert">
            {error}
          </p>
        )}
        <Button variant="dark" block type="submit" disabled={balance <= 0}>
          Record {parseAmount(amount) > 0 ? money(parseAmount(amount)) : "payment"}
        </Button>
        <p className="t-cap muted" style={{ textAlign: "center", marginTop: -6 }}>
          A numbered official receipt is created straight away.
        </p>
      </form>
    </Sheet>
  );
}

/** Shrinks a photo taken at the counter to a small JPEG, so a few of them fit in the demo's local storage. */
export function downscalePhoto(file: File, maxSide = 480, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("No canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Not an image"));
    };
    img.src = url;
  });
}

const MAX_PHOTOS = 4;

/** Opening the bag at the counter: count, what was noticed, photos, and the final price. */
export function CheckInSheet({ order, customer, open, onClose, onDone }: { order: Order; customer?: Customer; open: boolean; onClose: () => void; onDone: () => void }) {
  const notify = useNotify();
  const id = useId();
  const baskets = order.items.reduce((n, i) => (serviceById(i.serviceId)?.category === "baskets" ? n + i.qty : n), 0);
  const pieces = order.items.reduce((n, i) => (serviceById(i.serviceId)?.category === "baskets" ? n : n + i.qty), 0);
  const [count, setCount] = useState("");
  const [notes, setNotes] = useState("");
  const [total, setTotal] = useState(String(order.total));
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const quoted = order.items.filter((i) => serviceById(i.serviceId)?.kind === "quote" && i.unitPrice === 0);

  useEffect(() => {
    if (!open) return;
    setCount("");
    setNotes("");
    setTotal(String(order.total));
    setPhotos([]);
    setError(null);
  }, [open, order.total]);

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, room);
    try {
      const shrunk = await Promise.all(picked.map((f) => downscalePhoto(f)));
      setPhotos((prev) => [...prev, ...shrunk].slice(0, MAX_PHOTOS));
    } catch (err) {
      console.warn("Could not read a photo", err);
      setError("One of those photos couldn't be read. Try taking it again.");
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = shop.checkIn(order.id, { count: Math.floor(Number(count)), notes, photos, total: parseAmount(total) });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onClose();
    notify("Checked in", `${order.number}: ${result.order.checkIn?.count} pieces counted. The ready time starts now.`);
    onDone();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Check in at the counter">
      <OrderLine order={order} customer={customer} />
      <form className="stack gap-16" onSubmit={submit} noValidate>
        <p className="t-cap muted">
          Booked: {[baskets ? `${baskets} ${baskets === 1 ? "basket" : "baskets"}` : "", pieces ? `${pieces} ${pieces === 1 ? "piece" : "pieces"}` : ""].filter(Boolean).join(" and ")}. {careSummary(order.care)}
          {order.care.notes ? `. ${order.care.notes}` : ""}
        </p>
        <div className="stack gap-8">
          <label htmlFor={`${id}-count`} className="t-cap muted">
            Garments counted
          </label>
          <input id={`${id}-count`} className="adm-input" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="e.g. 18" autoFocus aria-invalid={Boolean(error)} />
        </div>
        <div className="stack gap-8">
          <label htmlFor={`${id}-notes`} className="t-cap muted">
            Noticed when the bag was opened (optional)
          </label>
          <textarea id={`${id}-notes`} className="adm-textarea" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Palm oil on a white blouse, a loose button on the blue shirt, coins in a pocket" />
          <div className="inline" style={{ gap: 6, flexWrap: "wrap" }}>
            {["Stain noted, pre-treating", "Button loose", "Things left in pockets", "Already torn"].map((chip) => (
              <button key={chip} type="button" className="btn btn-soft btn-sm" onClick={() => setNotes((n) => (n ? `${n}; ${chip.toLowerCase()}` : chip))}>
                {chip}
              </button>
            ))}
          </div>
        </div>
        <div className="stack gap-8">
          <span className="t-cap muted">Photos of anything noted (optional, up to {MAX_PHOTOS})</span>
          <div className="inline" style={{ gap: 8, flexWrap: "wrap" }}>
            {photos.map((src, i) => (
              <span key={i} className="checkin-photo">
                <img src={src} alt={`Check-in photo ${i + 1}`} />
                <button type="button" className="icon-btn" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}>
                  <X size={14} />
                </button>
              </span>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="checkin-photo is-add">
                <Camera size={20} strokeWidth={1.7} />
                <span className="t-cap">Add</span>
                <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
              </label>
            )}
          </div>
        </div>
        <div className="stack gap-8">
          <label htmlFor={`${id}-total`} className="t-cap muted">
            Order total (GH₵)
          </label>
          <input id={`${id}-total`} className="adm-input" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />
          <p className="t-cap muted">
            {quoted.length ? `Price the ${quoted.map((i) => serviceById(i.serviceId)?.name.toLowerCase()).join(", ")} here. ` : ""}
            Basket bigger than booked? Change the total before the wash starts; {paidTotal(order) > 0 ? `${money(paidTotal(order))} is already paid.` : "nothing is paid yet."}
          </p>
        </div>
        {error && (
          <p className="adm-form-error" role="alert">
            {error}
          </p>
        )}
        <Button variant="dark" block type="submit">
          Check in and start the clock
        </Button>
      </form>
    </Sheet>
  );
}

export function UpdateSheet({ order, customer, open, onClose, title = "Send WhatsApp update" }: { order: Order; customer?: Customer; open: boolean; onClose: () => void; title?: string }) {
  const notify = useNotify();
  const id = useId();
  const [text, setText] = useState("");
  useEffect(() => {
    if (open) setText(updateMessage(order, customer, new Date()));
  }, [open, order, customer]);

  const sent = () => {
    shop.markUpdateSent(order.id);
    onClose();
    notify("WhatsApp opened", `Update for ${order.number} is ready to send to ${customer?.name ?? "the client"}.`);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      notify("Message copied", "Paste it into WhatsApp.");
    } catch (error) {
      console.warn("Clipboard not available", error);
      notify("Couldn't copy", "Select the message and copy it by hand.");
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <OrderLine order={order} customer={customer} />
      <div className="stack gap-12">
        <label htmlFor={`${id}-msg`} className="t-cap muted">
          Message to {customer?.name ?? "client"} · you can edit it
        </label>
        <textarea id={`${id}-msg`} className="adm-textarea msg-preview" style={{ minHeight: 180 }} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8 }}>
          <Button type="button" onClick={copy} icon={<Copy size={16} />}>
            Copy
          </Button>
          {customer ? (
            <a className="btn btn-dark" href={whatsappLink(customer.phone, text)} target="_blank" rel="noreferrer" onClick={sent}>
              <MessageCircle size={17} /> Open in WhatsApp
            </a>
          ) : (
            <Button variant="dark" disabled>
              No phone number on file
            </Button>
          )}
        </div>
        <p className="t-cap muted">WhatsApp opens with this message filled in. Nothing is sent until you press send there.</p>
      </div>
    </Sheet>
  );
}

export function StageSheet({ order, open, onClose, onMoved }: { order: Order; open: boolean; onClose: () => void; onMoved: (status: OrderStatus) => void }) {
  const [choice, setChoice] = useState<OrderStatus>(order.status);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setChoice(order.status);
      setError(null);
    }
  }, [open, order.status]);
  const owes = balanceDue(order) > 0;

  const stages = stagesFor(order).filter((s) => s !== "booked");

  const save = () => {
    if (choice === order.status || choice === "cancelled" || choice === "booked") return onClose();
    const result = shop.moveTo(order.id, choice, new Date(), { allowOwing: true });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onClose();
    onMoved(choice);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Change stage">
      {order.status === "booked" ? (
        <p className="banner is-sand">Check it in at the counter first: the count and the ready time start there.</p>
      ) : (
        <div className="stack">
          {stages.map((stage) => (
            <label key={stage} className="check-row" style={{ minHeight: 44 }}>
              <input type="radio" className="rdo" name={`stage-${order.id}`} checked={choice === stage} onChange={() => setChoice(stage)} />
              <span>{stage === "done" ? stageLabel(stage, order) : OWNER_STAGE_LABEL[stage]}</span>
              {stage === order.status && <span className="count">Now</span>}
            </label>
          ))}
        </div>
      )}
      {choice === "done" && owes && (
        <p className="banner is-sand" style={{ marginTop: 12 }}>
          This order still owes {money(balanceDue(order))}. Record the payment first if the client has paid.
        </p>
      )}
      {error && (
        <p className="adm-form-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
      <Button variant="dark" block onClick={save} style={{ marginTop: 16 }}>
        {choice === order.status ? "Keep as it is" : `Move to ${choice === "done" ? stageLabel(choice, order) : OWNER_STAGE_LABEL[choice]}`}
      </Button>
    </Sheet>
  );
}

export function ConfirmSheet({ open, onClose, title, body, confirmLabel, onConfirm, danger, children }: { open: boolean; onClose: () => void; title: string; body: string; confirmLabel: string; onConfirm: () => void; danger?: boolean; children?: ReactNode }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="muted">{body}</p>
      {children}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }}>
        <Button block onClick={onClose}>
          Go back
        </Button>
        <Button variant={danger ? "danger" : "dark"} block onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
