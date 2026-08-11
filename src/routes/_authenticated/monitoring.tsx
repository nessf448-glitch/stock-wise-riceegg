import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, CalendarClock, Plus, Trash2, Pencil, PackageX } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/app-shell";
import { ExpiryBadge, StockBadge, CategoryBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  useSettings,
  useSaveBatch,
  useDeleteBatch,
  useSaveNearExpiryDays,
  stockStatus,
  expiryStatus,
  daysUntil,
  dateOnly,
  friendlyError,
  qty,
  type EggBatch,
} from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/monitoring")({
  head: () => ({
    meta: [
      { title: "Stock Monitoring & Alerts — CDP Enterprise" },
      {
        name: "description",
        content:
          "Automated low stock and out-of-stock alerts plus egg batch expiration monitoring with a configurable near-expiration window.",
      },
      { property: "og:title", content: "Stock Monitoring & Alerts — CDP Enterprise" },
      {
        property: "og:description",
        content: "Low stock, out-of-stock and egg expiration alerts in one place.",
      },
    ],
  }),
  component: MonitoringPage,
});

const batchSchema = z.object({
  product_id: z.string().uuid("Please select an egg product"),
  batch_number: z.string().trim().min(1, "Batch number is required").max(60),
  quantity: z.number().min(0, "Quantity cannot be negative"),
  expiration_date: z.string().min(10, "Expiration date is required"),
});

function MonitoringPage() {
  const { data: products = [] } = useProducts();
  const { data: batches = [] } = useBatches();
  const { data: settings } = useSettings();
  const nearDays = settings?.near_expiry_days ?? 7;

  const lowStock = products.filter((p) => stockStatus(p) === "low_stock");
  const outOfStock = products.filter((p) => stockStatus(p) === "out_of_stock");
  const nearExpiry = batches.filter((b) => expiryStatus(b.expiration_date, nearDays) === "near");
  const expired = batches.filter((b) => expiryStatus(b.expiration_date, nearDays) === "expired");

  return (
    <div>
      <PageHeader
        title="Stock Monitoring"
        description="The system checks stock levels and egg expiration dates automatically and raises the alerts below."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AlertCount
          label="Low stock"
          value={lowStock.length}
          icon={<AlertTriangle className="size-4" />}
        />
        <AlertCount
          label="Out of stock"
          value={outOfStock.length}
          icon={<PackageX className="size-4" />}
        />
        <AlertCount
          label={`Near expiration (${nearDays}d)`}
          value={nearExpiry.length}
          icon={<CalendarClock className="size-4" />}
        />
        <AlertCount
          label="Expired batches"
          value={expired.length}
          icon={<CalendarClock className="size-4" />}
        />
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stock alerts</TabsTrigger>
          <TabsTrigger value="expiry">Egg expiration</TabsTrigger>
          <TabsTrigger value="settings">Alert settings</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-5">
          <div className="surface-panel overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Minimum</TableHead>
                  <TableHead className="text-right">Shortfall</TableHead>
                  <TableHead>Alert</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...outOfStock, ...lowStock].length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      All products are above their minimum stock level.
                    </TableCell>
                  </TableRow>
                ) : (
                  [...outOfStock, ...lowStock].map((p) => (
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
                      <TableCell className="text-right font-semibold">
                        {qty(Math.max(Number(p.min_stock) - Number(p.stock_qty), 0))}
                      </TableCell>
                      <TableCell>
                        <StockBadge status={stockStatus(p)} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="expiry" className="mt-5">
          <EggBatches nearDays={nearDays} />
        </TabsContent>

        <TabsContent value="settings" className="mt-5">
          <NearExpirySetting current={nearDays} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AlertCount({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="surface-panel p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="font-display mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function EggBatches({ nearDays }: { nearDays: number }) {
  const { data: products = [] } = useProducts();
  const { data: batches = [] } = useBatches();
  const save = useSaveBatch();
  const remove = useDeleteBatch();
  const eggs = products.filter((p) => p.category === "egg");
  const productName = new Map(products.map((p) => [p.id, p]));

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EggBatch | null>(null);
  const [form, setForm] = useState({
    product_id: "",
    batch_number: "",
    quantity: "",
    expiration_date: "",
  });
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setForm({ product_id: eggs[0]?.id ?? "", batch_number: "", quantity: "", expiration_date: "" });
    setError(null);
    setOpen(true);
  }

  function openEdit(b: EggBatch) {
    setEditing(b);
    setForm({
      product_id: b.product_id,
      batch_number: b.batch_number,
      quantity: String(b.quantity),
      expiration_date: b.expiration_date,
    });
    setError(null);
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = batchSchema.safeParse({
      product_id: form.product_id,
      batch_number: form.batch_number,
      quantity: Number(form.quantity),
      expiration_date: form.expiration_date,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please complete the required fields.");
      return;
    }
    try {
      await save.mutateAsync(
        editing ? { id: editing.id, values: parsed.data } : { values: parsed.data },
      );
      toast.success(editing ? "Batch updated" : "Batch recorded");
      setOpen(false);
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  const sorted = [...batches].sort((a, b) =>
    a.expiration_date.localeCompare(b.expiration_date),
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Batches expiring within {nearDays} day(s) are flagged as “Near Expiration”.
        </p>
        <Button onClick={openAdd} disabled={eggs.length === 0}>
          <Plus className="size-4" /> Add egg batch
        </Button>
      </div>

      {eggs.length === 0 ? (
        <p className="surface-panel p-5 text-sm text-muted-foreground">
          Add an egg product first before recording batches.
        </p>
      ) : (
        <div className="surface-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch number</TableHead>
                <TableHead>Egg product</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Expiration date</TableHead>
                <TableHead className="text-right">Days left</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No egg batches recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((b) => {
                  const p = productName.get(b.product_id);
                  const left = daysUntil(b.expiration_date);
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.batch_number}</TableCell>
                      <TableCell>{p?.name ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {qty(b.quantity)} {p?.unit ?? ""}
                      </TableCell>
                      <TableCell>{dateOnly(b.expiration_date)}</TableCell>
                      <TableCell className="text-right">
                        {left < 0 ? `${Math.abs(left)} overdue` : left}
                      </TableCell>
                      <TableCell>
                        <ExpiryBadge status={expiryStatus(b.expiration_date, nearDays)} />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit batch"
                          onClick={() => openEdit(b)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete batch"
                          className="text-destructive"
                          onClick={async () => {
                            try {
                              await remove.mutateAsync(b.id);
                              toast.success("Batch deleted");
                            } catch (err) {
                              toast.error(friendlyError(err));
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit egg batch" : "Add egg batch"}</DialogTitle>
            <DialogDescription>
              Batch numbers and expiration dates drive the automated expiration alerts.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Egg product</Label>
              <Select
                value={form.product_id}
                onValueChange={(v) => setForm({ ...form, product_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select egg product" />
                </SelectTrigger>
                <SelectContent>
                  {eggs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-number">Batch number</Label>
              <Input
                id="b-number"
                value={form.batch_number}
                onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="b-qty">Quantity</Label>
                <Input
                  id="b-qty"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-exp">Expiration date</Label>
                <Input
                  id="b-exp"
                  type="date"
                  value={form.expiration_date}
                  onChange={(e) => setForm({ ...form, expiration_date: e.target.value })}
                  required
                />
              </div>
            </div>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {editing ? "Save changes" : "Save batch"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NearExpirySetting({ current }: { current: number }) {
  const saveDays = useSaveNearExpiryDays();
  const [days, setDays] = useState(String(current));
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > 365) {
      setError("Enter a whole number of days between 1 and 365.");
      return;
    }
    try {
      await saveDays.mutateAsync(n);
      toast.success(`Near-expiration window set to ${n} day(s)`);
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  return (
    <form onSubmit={submit} className="surface-panel max-w-md space-y-4 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold">Near-expiration window</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Egg batches expiring within this number of days are flagged for immediate selling or
          disposal.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="days">Days before expiration</Label>
        <Input
          id="days"
          type="number"
          min="1"
          max="365"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          required
        />
      </div>
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
      <Button type="submit" disabled={saveDays.isPending}>
        Save setting
      </Button>
    </form>
  );
}
