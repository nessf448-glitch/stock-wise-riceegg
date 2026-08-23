import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { CategoryBadge, StockBadge } from "@/components/status-badges";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ProductThumb } from "@/components/product-image";
import {
  useProducts,
  useSuppliers,
  useBatches,
  useSettings,
  useProductImageUrls,
  stockStatus,
  expiryStatus,
  inventoryValue,
  peso,
  qty,
  type StockStatus,
} from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — CDP Enterprise" },
      {
        name: "description",
        content:
          "Search and filter current rice and egg inventory by category, supplier, stock status and egg expiration.",
      },
      { property: "og:title", content: "Inventory — CDP Enterprise" },
      {
        property: "og:description",
        content: "Available quantities, stock status and inventory value per product.",
      },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const { data: products = [], isLoading } = useProducts();
  const { data: suppliers = [] } = useSuppliers();
  const { data: batches = [] } = useBatches();
  const { data: settings } = useSettings();
  const nearDays = settings?.near_expiry_days ?? 7;

  const [tab, setTab] = useState<"all" | "rice" | "egg">("all");
  const [search, setSearch] = useState("");
  const [supplier, setSupplier] = useState("all");
  const [status, setStatus] = useState<"all" | StockStatus>("all");
  const [expiry, setExpiry] = useState<"all" | "valid" | "near" | "expired">("all");

  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));

  const eggExpiryByProduct = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const b of batches) {
      const set = map.get(b.product_id) ?? new Set<string>();
      set.add(expiryStatus(b.expiration_date, nearDays));
      map.set(b.product_id, set);
    }
    return map;
  }, [batches, nearDays]);

  const filtered = products.filter((p) => {
    if (tab !== "all" && p.category !== tab) return false;
    if (search && !p.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (supplier !== "all" && p.supplier_id !== supplier) return false;
    if (status !== "all" && stockStatus(p) !== status) return false;
    if (expiry !== "all") {
      if (p.category !== "egg") return false;
      if (!eggExpiryByProduct.get(p.id)?.has(expiry)) return false;
    }
    return true;
  });

  const totalValue = filtered.reduce((s, p) => s + inventoryValue(p), 0);
  const totalQty = filtered.reduce((s, p) => s + Number(p.stock_qty), 0);

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="All recorded rice and egg inventory with current available quantities."
      />

      <div className="surface-panel mb-4 p-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">All Inventory</TabsTrigger>
            <TabsTrigger value="rice">Rice</TabsTrigger>
            <TabsTrigger value="egg">Eggs</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search product name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={supplier} onValueChange={setSupplier}>
            <SelectTrigger>
              <SelectValue placeholder="Supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger>
              <SelectValue placeholder="Stock status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stock statuses</SelectItem>
              <SelectItem value="in_stock">In Stock</SelectItem>
              <SelectItem value="low_stock">Low Stock</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
          <Select value={expiry} onValueChange={(v) => setExpiry(v as typeof expiry)}>
            <SelectTrigger>
              <SelectValue placeholder="Egg expiration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any expiration</SelectItem>
              <SelectItem value="valid">Eggs: Valid batches</SelectItem>
              <SelectItem value="near">Eggs: Near expiration</SelectItem>
              <SelectItem value="expired">Eggs: Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="surface-panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Min level</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Loading inventory…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No products match the current search and filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <CategoryBadge category={p.category} />
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {qty(p.stock_qty)} <span className="text-xs text-muted-foreground">{p.unit}</span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {qty(p.min_stock)}
                  </TableCell>
                  <TableCell>
                    <StockBadge status={stockStatus(p)} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.supplier_id ? (supplierName.get(p.supplier_id) ?? "—") : "—"}
                  </TableCell>
                  <TableCell className="text-right">{peso(p.cost_price)}</TableCell>
                  <TableCell className="text-right font-medium">{peso(inventoryValue(p))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-6 text-sm">
        <p className="text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filtered.length}</span> product(s)
        </p>
        <p className="text-muted-foreground">
          Total quantity: <span className="font-semibold text-foreground">{qty(totalQty)}</span>
        </p>
        <p className="text-muted-foreground">
          Inventory value: <span className="font-semibold text-foreground">{peso(totalValue)}</span>
        </p>
      </div>
    </div>
  );
}
