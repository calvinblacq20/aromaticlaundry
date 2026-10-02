import { CircleAlert } from "lucide-react";
import { Link, Route, Routes } from "react-router-dom";
import "../styles/admin.css";
import { AdminLayout, AdminPage, EmptyState } from "./Shell";
import { Appointments } from "./screens/Appointments";
import { ClientProfile } from "./screens/ClientProfile";
import { Clients } from "./screens/Clients";
import { NewOrder } from "./screens/NewOrder";
import { AdminReceipt, OrderDetail } from "./screens/OrderDetail";
import { Orders } from "./screens/Orders";
import { Expenses } from "./screens/Expenses";
import { Payments } from "./screens/Payments";
import { AdminPlanReceipt, Plans } from "./screens/Plans";
import { Reports } from "./screens/Reports";
import { Reviews } from "./screens/Reviews";
import { Services } from "./screens/Services";
import { Settings } from "./screens/Settings";
import { Today } from "./screens/Today";

function AdminNotFound() {
  return (
    <AdminPage title="Page not found">
      <EmptyState
        icon={<CircleAlert size={22} />}
        title="This link doesn't lead anywhere"
        body="It may point to an order or client that was removed when the demo was reset."
        action={
          <Link to="/admin" className="btn btn-dark">
            Go to Today
          </Link>
        }
      />
    </AdminPage>
  );
}

/** Owner side routes, under /admin. */
export function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Today />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/new" element={<NewOrder />} />
        <Route path="orders/:orderId" element={<OrderDetail />} />
        <Route path="orders/:orderId/receipts/:paymentId" element={<AdminReceipt />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:clientId" element={<ClientProfile />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="plans" element={<Plans />} />
        <Route path="plans/:subscriptionId/receipts/:paymentId" element={<AdminPlanReceipt />} />
        <Route path="payments" element={<Payments />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="services" element={<Services />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<AdminNotFound />} />
      </Route>
    </Routes>
  );
}
