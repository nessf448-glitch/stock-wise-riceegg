import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { TxnBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProducts,
  useTransactions,
  useRecordTransaction,
  ADJUSTMENT_REASONS,
  friendlyError,
  dateTime,
  qty,
  type TxnType,
} from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "Record Stock Movement — CDP Enterprise" },
      {
        name: "description",
        content:
          "Record stock-in deliveries, stock-out sales and inventory adjustments with automatic stock level updates.",
      },
      { property: "og:title", content: "Record Stock Movement — CDP Enterprise" },
      {
        property: "og:description",
        content: "Stock-in, stock-out and adjustment entry forms for rice and egg inventory.",
      },
    ],
  }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const [tab, setTab] = useState<TxnType>("stock_in");

  return (
    <div>
      <PageHeader
        title="Record Stock Movement"
        description="Every entry updates the product's available quantity immediately and is saved to the movement history."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TxnType)}>
        <TabsList>
          <TabsTrigger value="stock_in">
            <ArrowDownToLine className="size-4" /> Stock-In
          </TabsTrigger>
          <TabsTrigger value="stock_out">
            <ArrowUpFromLine className="size-4" /> Stock-Out
          </TabsTrigger>
          <TabsTrigger value="adjustment">
            <SlidersHorizontal className="size-4" /> Adjustment
          </TabsTrigger>
        </TabsList>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <TabsContent value="stock_in">
              <MovementForm
                type="stock_in"
                heading="Stock-In (delivery received)"
                blurb="Use this when new rice or egg stock arrives from a supplier."
              />
            </TabsContent>
            <TabsContent value="stock_out">
              <MovementForm
                type="stock_out"
                heading="Stock-Out (sale or release)"
                blurb="Quantities greater than the available stock are rejected by the system."
              />
            </TabsContent>
            <TabsContent value="adjustment">
              <MovementForm
                type="adjustment"
                heading="Stock Adjustment"
                blurb="Corrects the recorded quantity for damaged, spoiled, missing or miscounted stock."
              />
            </TabsContent>
          </div>
          <RecentEntries />
        </div>
      </Tabs>
    </div>
  );
}

function MovementForm({
  type,
  heading,
  blurb,
}: {
  type: TxnType;
  heading: string;
  blurb: string;
}) {
  const { data: products = [] } = useProducts();
  const record = useRecordTransaction();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState(ADJUSTMENT_REASONS[0]!);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const product = products.find((p) => p.id === productId);
  const amount = Number(quantity);
  const projected =
    product && !Number.isNaN(amount)
      ? type === "stock_in"
        ? Number(product.stock_qty) + amount
        : Number(product.stock_qty) - amount
      : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!productId) return setError("Please select a product.");
    if (!quantity || Number.isNaN(amount) || amount <= 0)
      return setError("Please enter a quantity greater than zero.");
    if (type !== "stock_in" && product && amount > Number(product.stock_qty))
      return setError(
        `Only ${qty(product.stock_qty)} ${product.unit} available for ${product.name}.`,
      );
    if (note.length > 300) return setError("Notes must be 300 characters or less.");

    try {
      await record.mutateAsync({
        product_id: productId,
        type,
        quantity: amount,
        reason: type === "adjustment" ? reason : null,
        note: note.trim() ? note.trim() : null,
      });
      toast.success("Stock movement recorded", {
        description: `${product?.name} · ${qty(amount)} ${product?.unit ?? ""}`,
      });
      setQuantity("");
      setNote("");
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  return (
    <form onSubmit={submit} className="surface-panel space-y-4 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold">{heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
      </div>

      <div className="space-y-1.5">
        <Label>Product</Label>
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a rice or egg product" />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} — {qty(p.stock_qty)} {p.unit} on hand
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="quantity">Quantity {product ? `(${product.unit})` : ""}</Label>
          <Input
            id="quantity"
            type="number"
            min="0"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
        {type === "adjustment" ? (
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">Notes (optional)</Label>
        <Textarea
          id="note"
          maxLength={300}
          placeholder="Reference number, buyer, delivery details…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {product && projected !== null && !Number.isNaN(projected) ? (
        <p className="rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
          Stock after this entry:{" "}
          <span className="font-semibold">
            {qty(Math.max(projected, 0))} {product.unit}
          </span>{" "}
          <span className="text-muted-foreground">
            (currently {qty(product.stock_qty)} {product.unit})
          </span>
        </p>
      ) : null}

      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

      <Button type="submit" disabled={record.isPending} className="w-full sm:w-auto">
        Record entry
      </Button>
    </form>
  );
}

function RecentEntries() {
  const { data: products = [] } = useProducts();
  const { data: txns = [] } = useTransactions(8);
  const productName = new Map(products.map((p) => [p.id, p]));

  return (
    <aside className="surface-panel p-5">
      <h2 className="font-display text-base font-semibold">Latest entries</h2>
      <ul className="mt-4 space-y-3">
        {txns.length === 0 ? (
          <li className="text-sm text-muted-foreground">No stock movements recorded yet.</li>
        ) : (
          txns.slice(0, 8).map((t) => {
            const p = productName.get(t.product_id);
            return (
              <li key={t.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{p?.name ?? "Deleted product"}</span>
                  <TxnBadge type={t.type} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {qty(t.quantity)} {p?.unit ?? ""} · {dateTime(t.created_at)}
                </p>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}
