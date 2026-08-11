import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { CategoryBadge, ExpiryBadge, StockBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useProducts,
  useBatches,
  useTransactions,
  useSettings,
  stockStatus,
  expiryStatus,
  inventoryValue,
  dateOnly,
  dateTime,
  peso,
  qty,
  TXN_LABEL,
} from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Inventory Reports — CDP Enterprise" },
      {
        name: "description",
        content:
          "Generate printable stock summary, inventory value, movement and egg expiration reports for any date range.",
      },
      { property: "og:title", content: "Inventory Reports — CDP Enterprise" },
      {
        property: "og:description",
        content: "Printable rice and egg inventory and stock movement reports.",
      },
    ],
  }),
  component: ReportsPage,
});

const today = () => new Date().toISOString().slice(0, 10);
const weekAgo = () => new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);

function ReportsPage() {
  const { data: products = [] } = useProducts();
  const { data: batches = [] } = useBatches();
  const { data: txns = [] } = useTransactions(1000);
  const { data: settings } = useSettings();
  const nearDays = settings?.near_expiry_days ?? 7;

  const [from, setFrom] = useState(weekAgo());
  const [to, setTo] = useState(today());

  const productMap = new Map(products.map((p) => [p.id, p]));

  const rangeTxns = useMemo(
    () =>
      txns.filter((t) => {
        const day = t.created_at.slice(0, 10);
        return day >= from && day <= to;
      }),
    [txns, from, to],
  );

  const totalValue = products.reduce((s, p) => s + inventoryValue(p), 0);
  const riceValue = products
    .filter((p) => p.category === "rice")
    .reduce((s, p) => s + inventoryValue(p), 0);
  const eggValue = products
    .filter((p) => p.category === "egg")
    .reduce((s, p) => s + inventoryValue(p), 0);

  const movementTotals = {
    stock_in: rangeTxns.filter((t) => t.type === "stock_in").reduce((s, t) => s + Number(t.quantity), 0),
    stock_out: rangeTxns
      .filter((t) => t.type === "stock_out")
      .reduce((s, t) => s + Number(t.quantity), 0),
    adjustment: rangeTxns
      .filter((t) => t.type === "adjustment")
      .reduce((s, t) => s + Number(t.quantity), 0),
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Summarized inventory records that can be printed or saved as PDF for review."
        actions={
          <Button onClick={() => window.print()} variant="outline">
            <Printer className="size-4" /> Print / Save as PDF
          </Button>
        }
      />

      <div className="surface-panel mb-5 flex flex-wrap items-end gap-4 p-4 print:hidden">
        <div className="space-y-1.5">
          <Label htmlFor="from">From date</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To date</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <p className="text-sm text-muted-foreground">
          Date range applies to the stock movement report.
        </p>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <ValueCard label="Total inventory value" value={peso(totalValue)} />
        <ValueCard label="Rice inventory value" value={peso(riceValue)} />
        <ValueCard label="Egg inventory value" value={peso(eggValue)} />
      </div>

      <Tabs defaultValue="stock">
        <TabsList className="print:hidden">
          <TabsTrigger value="stock">Stock summary</TabsTrigger>
          <TabsTrigger value="movement">Stock movement</TabsTrigger>
          <TabsTrigger value="expiry">Egg expiration</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-5">
          <ReportShell
            title="Stock Summary Report"
            subtitle={`Generated ${dateTime(new Date().toISOString())}`}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Minimum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <CategoryBadge category={p.category} />
                    </TableCell>
                    <TableCell className="text-right">
                      {qty(p.stock_qty)} {p.unit}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {qty(p.min_stock)}
                    </TableCell>
                    <TableCell>
                      <StockBadge status={stockStatus(p)} />
                    </TableCell>
                    <TableCell className="text-right">{peso(p.cost_price)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {peso(inventoryValue(p))}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={6} className="text-right font-semibold">
                    Total inventory value
                  </TableCell>
                  <TableCell className="text-right font-bold">{peso(totalValue)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ReportShell>
        </TabsContent>

        <TabsContent value="movement" className="mt-5">
          <ReportShell
            title="Stock Movement Report"
            subtitle={`${dateOnly(from)} to ${dateOnly(to)} · ${rangeTxns.length} entry(ies)`}
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              {(["stock_in", "stock_out", "adjustment"] as const).map((k) => (
                <div key={k} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{TXN_LABEL[k]} total quantity</p>
                  <p className="font-display text-xl font-bold">{qty(movementTotals[k])}</p>
                </div>
              ))}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date &amp; time</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Reason / note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rangeTxns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No stock movements within the selected date range.
                    </TableCell>
                  </TableRow>
                ) : (
                  rangeTxns.map((t) => {
                    const p = productMap.get(t.product_id);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {dateTime(t.created_at)}
                        </TableCell>
                        <TableCell className="font-medium">{p?.name ?? "Deleted product"}</TableCell>
                        <TableCell>{TXN_LABEL[t.type]}</TableCell>
                        <TableCell className="text-right">
                          {qty(t.quantity)} {p?.unit ?? ""}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {[t.reason, t.note].filter(Boolean).join(" — ") || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ReportShell>
        </TabsContent>

        <TabsContent value="expiry" className="mt-5">
          <ReportShell
            title="Egg Expiration Report"
            subtitle={`Near-expiration window: ${nearDays} day(s)`}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch number</TableHead>
                  <TableHead>Egg product</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Expiration date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No egg batches recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  [...batches]
                    .sort((a, b) => a.expiration_date.localeCompare(b.expiration_date))
                    .map((b) => {
                      const p = productMap.get(b.product_id);
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{b.batch_number}</TableCell>
                          <TableCell>{p?.name ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            {qty(b.quantity)} {p?.unit ?? ""}
                          </TableCell>
                          <TableCell>{dateOnly(b.expiration_date)}</TableCell>
                          <TableCell>
                            <ExpiryBadge status={expiryStatus(b.expiration_date, nearDays)} />
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </ReportShell>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ValueCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-panel p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function ReportShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-panel overflow-hidden">
      <header className="border-b border-border p-5">
        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          CDP Enterprise
        </p>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
