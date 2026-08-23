import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Plus, Pencil, Trash2, Search, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { ProductThumb } from "@/components/product-image";
import { PageHeader } from "@/components/app-shell";
import { CategoryBadge, StockBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  useSuppliers,
  useSaveProduct,
  useDeleteProduct,
  useProductImageUrls,
  uploadProductImage,
  removeProductImage,
  stockStatus,
  friendlyError,
  peso,
  qty,
  type Product,
  type Category,
} from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Products — CDP Enterprise Inventory" },
      {
        name: "description",
        content:
          "Add, edit and remove rice and egg product records including units, prices, minimum stock levels and suppliers.",
      },
      { property: "og:title", content: "Products — CDP Enterprise Inventory" },
      {
        property: "og:description",
        content: "Centralized rice and egg product master records.",
      },
    ],
  }),
  component: ProductsPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Product name is required").max(120),
  category: z.enum(["rice", "egg"]),
  unit: z.string().trim().min(1, "Unit of measure is required").max(20),
  selling_price: z.number().min(0, "Selling price cannot be negative"),
  cost_price: z.number().min(0, "Cost price cannot be negative"),
  stock_qty: z.number().min(0, "Quantity cannot be negative"),
  min_stock: z.number().min(0, "Minimum stock level cannot be negative"),
  supplier_id: z.string().nullable(),
});

const EMPTY = {
  name: "",
  category: "rice" as Category,
  unit: "sack",
  selling_price: "",
  cost_price: "",
  stock_qty: "0",
  min_stock: "0",
  supplier_id: "none",
};

function ProductsPage() {
  const { data: products = [], isLoading } = useProducts();
  const { data: suppliers = [] } = useSuppliers();
  const { data: imageUrls = {} } = useProductImageUrls(products.map((p) => p.image_path));
  const save = useSaveProduct();
  const remove = useDeleteProduct();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [photo, setPhoto] = useState<{ path: string | null; file: File | null; preview: string | null }>({
    path: null,
    file: null,
    preview: null,
  });
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | Category>("all");
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));

  const filtered = products.filter(
    (p) =>
      (category === "all" || p.category === category) &&
      p.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  function resetPhoto(path: string | null) {
    setPhoto((prev) => {
      if (prev.preview) URL.revokeObjectURL(prev.preview);
      return { path, file: null, preview: null };
    });
    if (fileInput.current) fileInput.current.value = "";
  }

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (JPG, PNG or WebP).");
      return;
    }
    setError(null);
    setPhoto((prev) => {
      if (prev.preview) URL.revokeObjectURL(prev.preview);
      return { path: prev.path, file, preview: URL.createObjectURL(file) };
    });
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY });
    resetPhoto(null);
    setError(null);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category,
      unit: p.unit,
      selling_price: String(p.selling_price),
      cost_price: String(p.cost_price),
      stock_qty: String(p.stock_qty),
      min_stock: String(p.min_stock),
      supplier_id: p.supplier_id ?? "none",
    });
    resetPhoto(p.image_path);
    setError(null);
    setOpen(true);
  }

  const photoPreview = photo.preview ?? (photo.path ? imageUrls[photo.path] : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({
      name: form.name,
      category: form.category,
      unit: form.unit,
      selling_price: Number(form.selling_price),
      cost_price: Number(form.cost_price),
      stock_qty: Number(form.stock_qty),
      min_stock: Number(form.min_stock),
      supplier_id: form.supplier_id === "none" ? null : form.supplier_id,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please complete the required fields.");
      return;
    }
    if (
      [form.selling_price, form.cost_price, form.stock_qty, form.min_stock].some(
        (v) => v === "" || Number.isNaN(Number(v)),
      )
    ) {
      setError("Please enter valid numeric values for prices and quantities.");
      return;
    }
    try {
      let imagePath = photo.path;
      if (photo.file) {
        setUploading(true);
        imagePath = await uploadProductImage(photo.file);
      }
      await save.mutateAsync(
        editing
          ? { id: editing.id, values: { ...parsed.data, image_path: imagePath } }
          : { values: { ...parsed.data, image_path: imagePath } },
      );
      const oldPath = editing?.image_path ?? null;
      if (oldPath && oldPath !== imagePath) await removeProductImage(oldPath);
      toast.success(editing ? "Product updated" : "Product added");
      resetPhoto(null);
      setOpen(false);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description="Rice and egg product records used across the whole inventory system."
        actions={
          <Button onClick={openAdd}>
            <Plus className="size-4" /> Add product
          </Button>
        }
      />

      <div className="surface-panel mb-4 grid gap-3 p-4 sm:grid-cols-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search product name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="rice">Rice</SelectItem>
            <SelectItem value="egg">Egg</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="surface-panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Selling</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Min</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                  Loading products…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                  No products yet. Use “Add product” to create the first record.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <ProductThumb
                        url={p.image_path ? imageUrls[p.image_path] : null}
                        name={p.name}
                      />
                      <span>{p.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <CategoryBadge category={p.category} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.unit}</TableCell>
                  <TableCell className="text-right">{peso(p.cost_price)}</TableCell>
                  <TableCell className="text-right">{peso(p.selling_price)}</TableCell>
                  <TableCell className="text-right font-semibold">{qty(p.stock_qty)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {qty(p.min_stock)}
                  </TableCell>
                  <TableCell>
                    <StockBadge status={stockStatus(p)} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.supplier_id ? (supplierName.get(p.supplier_id) ?? "—") : "—"}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(p)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete"
                      className="text-destructive"
                      onClick={() => setToDelete(p)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
            <DialogDescription>
              Only rice and egg products are within the system scope.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Product name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as Category })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rice">Rice</SelectItem>
                    <SelectItem value="egg">Egg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unit">Unit of measure</Label>
                <Input
                  id="unit"
                  placeholder="sack, tray, kg, pcs"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cost">Cost price (₱)</Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost_price}
                  onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="selling">Selling price (₱)</Label>
                <Input
                  id="selling"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.selling_price}
                  onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock">
                  {editing ? "Current stock quantity" : "Opening stock quantity"}
                </Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.stock_qty}
                  onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="min">Minimum stock level</Label>
                <Input
                  id="min"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.min_stock}
                  onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Select
                value={form.supplier_id}
                onValueChange={(v) => setForm({ ...form, supplier_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No supplier</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.category === "egg" ? (
              <p className="rounded-lg bg-secondary p-3 text-xs text-secondary-foreground">
                Batch numbers and expiration dates for egg products are recorded under Monitoring →
                Egg Expiration.
              </p>
            ) : null}
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {editing ? "Save changes" : "Save product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the product record along with its egg batches and movement history. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!toDelete) return;
                try {
                  await remove.mutateAsync(toDelete.id);
                  toast.success("Product deleted");
                } catch (err) {
                  toast.error(friendlyError(err));
                }
                setToDelete(null);
              }}
            >
              Delete product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
