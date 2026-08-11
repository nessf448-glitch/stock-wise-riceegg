import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { TxnBadge, CategoryBadge } from "@/components/status-badges";
import { Input } from "@/components/ui/input";
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
  useTransactions,
  useProfiles,
  dateTime,
  qty,
  type TxnType,
} from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Movement History — CDP Enterprise Inventory" },
      {
        name: "description",
        content:
          "Searchable log of every stock-in, stock-out and adjustment entry with product, quantity, reason, staff and timestamp.",
      },
      { property: "og:title", content: "Movement History — CDP Enterprise Inventory" },
      {
        property: "og:description",
        content: "Complete audit trail of rice and egg stock movements.",
      },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { data: products = [] } = useProducts();
  const { data: txns = [], isLoading } = useTransactions(1000);
  const { data: profiles = [] } = useProfiles();

  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | TxnType>("all");
  const [productId, setProductId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const productMap = new Map(products.map((p) => [p.id, p]));
  const staffMap = new Map(profiles.map((p) => [p.id, p.full_name || p.username || "Staff"]));

  const filtered = txns.filter((t) => {
    const p = productMap.get(t.product_id);
    if (type !== "all" && t.type !== type) return false;
    if (productId !== "all" && t.product_id !== productId) return false;
    const term = search.trim().toLowerCase();
    if (
      term &&
      !`${p?.name ?? ""} ${t.reason ?? ""} ${t.note ?? ""}`.toLowerCase().includes(term)
    )
      return false;
    const day = t.created_at.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Movement History"
        description="Full audit trail of stock movements for tracing discrepancies and verifying records."
      />

      <div className="surface-panel mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search product, reason or note…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger>
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="stock_in">Stock-In</SelectItem>
            <SelectItem value="stock_out">Stock-Out</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
          </SelectContent>
        </Select>
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger>
            <SelectValue placeholder="Product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            aria-label="From date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            type="date"
            aria-label="To date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      <div className="surface-panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date &amp; time</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Resulting stock</TableHead>
              <TableHead>Reason / note</TableHead>
              <TableHead>Recorded by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Loading history…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No movements match the current search and filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => {
                const p = productMap.get(t.product_id);
                return (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {dateTime(t.created_at)}
                    </TableCell>
                    <TableCell className="font-medium">{p?.name ?? "Deleted product"}</TableCell>
                    <TableCell>{p ? <CategoryBadge category={p.category} /> : "—"}</TableCell>
                    <TableCell>
                      <TxnBadge type={t.type} />
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {qty(t.quantity)} <span className="text-xs font-normal">{p?.unit ?? ""}</span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {t.resulting_stock === null ? "—" : qty(t.resulting_stock)}
                    </TableCell>
                    <TableCell className="max-w-[240px] text-sm text-muted-foreground">
                      {[t.reason, t.note].filter(Boolean).join(" — ") || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.user_id ? (staffMap.get(t.user_id) ?? "Staff") : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="mt-4 text-right text-sm text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
        {txns.length} recorded movement(s)
      </p>
    </div>
  );
}
