import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Category = "rice" | "egg";
export type TxnType = "stock_in" | "stock_out" | "adjustment";

export type Supplier = {
  id: string;
  name: string;
  contact_number: string | null;
  address: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  category: Category;
  unit: string;
  selling_price: number;
  cost_price: number;
  stock_qty: number;
  min_stock: number;
  supplier_id: string | null;
  image_path: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type EggBatch = {
  id: string;
  product_id: string;
  batch_number: string;
  quantity: number;
  expiration_date: string;
  created_at: string;
};

export type Transaction = {
  id: string;
  product_id: string;
  type: TxnType;
  quantity: number;
  reason: string | null;
  note: string | null;
  resulting_stock: number | null;
  user_id: string | null;
  created_at: string;
};

export type StockStatus = "out_of_stock" | "low_stock" | "in_stock";
export type ExpiryStatus = "expired" | "near" | "valid";

export const CATEGORY_LABEL: Record<Category, string> = { rice: "Rice", egg: "Egg" };
export const TXN_LABEL: Record<TxnType, string> = {
  stock_in: "Stock-In",
  stock_out: "Stock-Out",
  adjustment: "Adjustment",
};

export const ADJUSTMENT_REASONS = [
  "Damaged products",
  "Spoiled products",
  "Missing products",
  "Returned products",
  "Counting error",
  "Inventory correction",
  "Expired products",
];

export function stockStatus(p: Pick<Product, "stock_qty" | "min_stock">): StockStatus {
  if (Number(p.stock_qty) <= 0) return "out_of_stock";
  if (Number(p.stock_qty) <= Number(p.min_stock)) return "low_stock";
  return "in_stock";
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  out_of_stock: "Out of Stock",
  low_stock: "Low Stock",
  in_stock: "In Stock",
};

export function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function expiryStatus(dateStr: string, nearDays: number): ExpiryStatus {
  const d = daysUntil(dateStr);
  if (d < 0) return "expired";
  if (d <= nearDays) return "near";
  return "valid";
}

export const EXPIRY_LABEL: Record<ExpiryStatus, string> = {
  expired: "Expired",
  near: "Near Expiration",
  valid: "Valid",
};

export const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(n) || 0);

export const qty = (n: number) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export const dateOnly = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

export function inventoryValue(p: Pick<Product, "stock_qty" | "cost_price">) {
  return Number(p.stock_qty) * Number(p.cost_price);
}

export function friendlyError(error: unknown): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  if (/duplicate key|products_unique_name_category/i.test(message))
    return "A product with this name already exists in that category.";
  if (/Insufficient available stock/i.test(message)) return message.replace(/^.*?:/, "Insufficient stock:");
  if (/negative stock/i.test(message)) return message;
  if (/violates check constraint/i.test(message)) return "Please enter valid, non-negative numbers.";
  if (/violates foreign key/i.test(message)) return "The selected record no longer exists.";
  if (/Invalid login credentials/i.test(message)) return "Incorrect email or password.";
  return message || "Something went wrong. Please try again.";
}

/* ---------------- queries ---------------- */

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async (): Promise<Supplier[]> => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Supplier[];
    },
  });
}

export function useBatches() {
  return useQuery({
    queryKey: ["egg_batches"],
    queryFn: async (): Promise<EggBatch[]> => {
      const { data, error } = await supabase
        .from("egg_batches")
        .select("*")
        .order("expiration_date");
      if (error) throw error;
      return (data ?? []) as unknown as EggBatch[];
    },
  });
}

export function useTransactions(limit = 500) {
  return useQuery({
    queryKey: ["transactions", limit],
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from("inventory_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as Transaction[];
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, username");
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string; username: string | null }[];
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("near_expiry_days")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return { near_expiry_days: Number(data?.near_expiry_days ?? 7) };
    },
  });
}

/* ---------------- mutations ---------------- */

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["egg_batches"] });
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    qc.invalidateQueries({ queryKey: ["app_settings"] });
  };
}

export type ProductInput = {
  name: string;
  category: Category;
  unit: string;
  selling_price: number;
  cost_price: number;
  stock_qty: number;
  min_stock: number;
  supplier_id: string | null;
  image_path?: string | null;
};

export const PRODUCT_IMAGE_BUCKET = "product-images";

export async function uploadProductImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be 5 MB or smaller.");
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return path;
}

export async function removeProductImage(path: string) {
  await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
}

/** Signed URLs for product photos (bucket is private). */
export function useProductImageUrls(paths: (string | null)[]) {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p))).sort();
  return useQuery({
    queryKey: ["product-image-urls", unique],
    enabled: unique.length > 0,
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .createSignedUrls(unique, 60 * 60);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const item of data ?? []) {
        if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
      }
      return map;
    },
  });
}

export function useSaveProduct() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ProductInput }) => {
      if (id) {
        const { error } = await supabase.from("products").update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useRecordTransaction() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: {
      product_id: string;
      type: TxnType;
      quantity: number;
      reason?: string | null;
      note?: string | null;
    }) => {
      const { error } = await supabase.from("inventory_transactions").insert({
        product_id: input.product_id,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason ?? null,
        note: input.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSaveSupplier() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id?: string;
      values: {
        name: string;
        contact_number: string | null;
        address: string | null;
        email: string | null;
        is_active: boolean;
      };
    }) => {
      if (id) {
        const { error } = await supabase.from("suppliers").update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeleteSupplier() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSaveBatch() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id?: string;
      values: {
        product_id: string;
        batch_number: string;
        quantity: number;
        expiration_date: string;
      };
    }) => {
      if (id) {
        const { error } = await supabase.from("egg_batches").update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("egg_batches").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeleteBatch() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("egg_batches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSaveNearExpiryDays() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (days: number) => {
      const { error } = await supabase
        .from("app_settings")
        .update({ near_expiry_days: days, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
