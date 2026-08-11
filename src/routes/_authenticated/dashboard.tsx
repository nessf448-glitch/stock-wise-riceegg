import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Wheat,
  Egg,
  Boxes,
  TriangleAlert,
  CalendarClock,
  Coins,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { CategoryBadge, StockBadge, TxnBadge, ExpiryBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import {
  useProducts,
  useBatches,
  useTransactions,
  useSettings,
  useProfiles,
  stockStatus,
  expiryStatus,
  inventoryValue,
  peso,
  qty,
  dateTime,
  dateOnly,
  isToday,
  daysUntil,
} from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CDP Enterprise Inventory" },
      {
        name: "description",
        content:
          "Current rice and egg inventory condition, low-stock count, egg expiration alerts and today's inventory activity.",
      },
      { property: "og:title", content: "Dashboard — CDP Enterprise Inventory" },
      {
        property: "og:description",
        content: "Live overview of rice and egg stock, alerts and daily activity.",
      },
    ],
  }),
  component: Dashboard,
});

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: typeof Wheat;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning" | "destructive" | "accent";
}) {
  const toneClass =
    tone === "warning"
      ? "bg-warning/20 text-warning-foreground"
      : tone === "destructive"
        ? "bg-destructive/12 text-destructive"
        : tone === "accent"
          ? "bg-accent/25 text-accent-foreground"
          : "bg-secondary text-primary";
  return (
    <div className="surface-panel p-5">
      <div className={`mb-3 grid size-9 place-items-center rounded-lg ${toneClass}`}>
        <Icon className="size-4.5" />
      </div>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="font-display mt-1 text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Dashboard() {
  const { data: products = [], isLoading } = useProducts();
  const { data: batches = [] } = useBatches();
  const { data: transactions = [] } = useTransactions(200);
  const { data: settings } = useSettings();
  const { data: profiles = [] } = useProfiles();

  const nearDays = settings?.near_expiry_days ?? 7;
  const productName = new Map(products.map((p) => [p.id, p]));
  const profileName = new Map(profiles.map((p) => [p.id, p.full_name || p.username || "Staff"]));

  const rice = products.filter((p) => p.category === "rice");
  const eggs = products.filter((p) => p.category === "egg");
  const lowStock = products.filter((p) => stockStatus(p) !== "in_stock");
  const nearExpired = batches.filter((b) => expiryStatus(b.expiration_date, nearDays) === "near");
  const expired = batches.filter((b) => expiryStatus(b.expiration_date, nearDays) === "expired");
  const totalValue = products.reduce((sum, p) => sum + inventoryValue(p), 0);
  const totalUnits = products.reduce((sum, p) => sum + Number(p.stock_qty), 0);

  const today = transactions.filter((t) => isToday(t.created_at));
  const addedToday = today
    .filter((t) => t.type === "stock_in" || (t.type === "adjustment" && t.quantity > 0))
    .reduce((s, t) => s + Math.abs(Number(t.quantity)), 0);
  const removedToday = today
    .filter((t) => t.type === "stock_out" || (t.type === "adjustment" && t.quantity < 0))
    .reduce((s, t) => s + Math.abs(Number(t.quantity)), 0);
  const adjustmentsToday = today.filter((t) => t.type === "adjustment").length;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Current inventory condition for CDP Enterprise rice and egg stock."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/monitoring">View alerts</Link>
            </Button>
            <Button asChild>
              <Link to="/transactions">Record transaction</Link>
            </Button>
          </>
        }
      />

      {(lowStock.length > 0 || nearExpired.length > 0 || expired.length > 0) && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/12 p-4">
          <TriangleAlert className="size-5 text-warning-foreground" />
          <p className="text-sm font-medium text-warning-foreground">
            {lowStock.length > 0 && `${lowStock.length} product(s) at or below minimum stock. `}
            {nearExpired.length > 0 && `${nearExpired.length} egg batch(es) near expiration. `}
            {expired.length > 0 && `${expired.length} expired egg batch(es). `}
            This is a reminder only — no orders are placed automatically.
          </p>
          <Button asChild size="sm" variant="outline" className="ml-auto">
            <Link to="/monitoring">
              Review <ArrowRight className="ml-1 size-3.5" />
            </Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Wheat} label="Rice products" value={String(rice.length)} hint="Active records" />
        <StatCard icon={Egg} label="Egg products" value={String(eggs.length)} hint="Active records" />
        <StatCard
          icon={Boxes}
          label="Total stock"
          value={qty(totalUnits)}
          hint="Combined recorded quantity"
        />
        <StatCard
          icon={TriangleAlert}
          label="Low stock"
          value={String(lowStock.length)}
          hint="At or below minimum"
          tone="warning"
        />
        <StatCard
          icon={CalendarClock}
          label="Near expiry"
          value={String(nearExpired.length)}
          hint={`Within ${nearDays} day(s)`}
          tone="destructive"
        />
        <StatCard
          icon={Coins}
          label="Inventory value"
          value={peso(totalValue)}
          hint="Quantity × cost price"
          tone="accent"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="surface-panel lg:col-span-2">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold">Recent inventory activity</h2>
            <Button asChild size="sm" variant="ghost">
              <Link to="/history">Full history</Link>
            </Button>
          </header>
          <div className="divide-y divide-border">
            {isLoading ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">Loading…</p>
            ) : transactions.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                No transactions recorded yet.
              </p>
            ) : (
              transactions.slice(0, 8).map((t) => {
                const p = productName.get(t.product_id);
                return (
                  <div key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <TxnBadge type={t.type} />
                    <span className="text-sm font-medium">{p?.name ?? "Deleted product"}</span>
                    <span className="text-sm text-muted-foreground">
                      {t.quantity > 0 ? "+" : "−"}
                      {qty(Math.abs(Number(t.quantity)))} {p?.unit ?? ""}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {dateTime(t.created_at)}
                      {t.user_id ? ` · ${profileName.get(t.user_id) ?? "Staff"}` : ""}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="surface-panel">
          <header className="border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold">Daily inventory summary</h2>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("en-PH", { dateStyle: "long" })}
            </p>
          </header>
          <dl className="divide-y divide-border text-sm">
            {[
              ["Stock added today", qty(addedToday)],
              ["Stock removed today", qty(removedToday)],
              ["Adjustments today", String(adjustmentsToday)],
              ["Transactions today", String(today.length)],
              ["Low-stock products", String(lowStock.length)],
              ["Expired egg batches", String(expired.length)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-5 py-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="surface-panel">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold">Needs replenishment</h2>
            <Button asChild size="sm" variant="ghost">
              <Link to="/monitoring">Low stock</Link>
            </Button>
          </header>
          <div className="divide-y divide-border">
            {lowStock.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                All products are above their minimum stock level.
              </p>
            ) : (
              lowStock.slice(0, 6).map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <CategoryBadge category={p.category} />
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {qty(p.stock_qty)} / min {qty(p.min_stock)} {p.unit}
                  </span>
                  <span className="ml-auto">
                    <StockBadge status={stockStatus(p)} />
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="surface-panel">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold">Egg batches to watch</h2>
            <Button asChild size="sm" variant="ghost">
              <Link to="/monitoring">Expiration</Link>
            </Button>
          </header>
          <div className="divide-y divide-border">
            {[...expired, ...nearExpired].length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                No egg batches are expired or near expiration.
              </p>
            ) : (
              [...expired, ...nearExpired].slice(0, 6).map((b) => {
                const p = productName.get(b.product_id);
                const d = daysUntil(b.expiration_date);
                return (
                  <div key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span className="text-sm font-medium">{p?.name ?? "Egg product"}</span>
                    <span className="text-xs text-muted-foreground">
                      Batch {b.batch_number} · {dateOnly(b.expiration_date)} ·{" "}
                      {d < 0 ? `${Math.abs(d)} day(s) ago` : `in ${d} day(s)`}
                    </span>
                    <span className="ml-auto">
                      <ExpiryBadge status={expiryStatus(b.expiration_date, nearDays)} />
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
