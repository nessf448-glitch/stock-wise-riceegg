import { Badge } from "@/components/ui/badge";
import {
  type StockStatus,
  type ExpiryStatus,
  STOCK_STATUS_LABEL,
  EXPIRY_LABEL,
  type Category,
  CATEGORY_LABEL,
  type TxnType,
  TXN_LABEL,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";

export function StockBadge({ status }: { status: StockStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "in_stock" && "bg-success/12 text-success",
        status === "low_stock" && "bg-warning/20 text-warning-foreground",
        status === "out_of_stock" && "bg-destructive/12 text-destructive",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "in_stock" && "bg-success",
          status === "low_stock" && "bg-warning",
          status === "out_of_stock" && "bg-destructive",
        )}
      />
      {STOCK_STATUS_LABEL[status]}
    </span>
  );
}

export function ExpiryBadge({ status }: { status: ExpiryStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "valid" && "bg-success/12 text-success",
        status === "near" && "bg-warning/20 text-warning-foreground",
        status === "expired" && "bg-destructive/12 text-destructive",
      )}
    >
      {EXPIRY_LABEL[status]}
    </span>
  );
}

export function CategoryBadge({ category }: { category: Category }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        category === "rice" ? "border-rice/50 text-rice" : "border-egg/50 text-egg",
      )}
    >
      {CATEGORY_LABEL[category]}
    </Badge>
  );
}

export function TxnBadge({ type }: { type: TxnType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        type === "stock_in" && "bg-success/12 text-success",
        type === "stock_out" && "bg-info/12 text-info",
        type === "adjustment" && "bg-accent/25 text-accent-foreground",
      )}
    >
      {TXN_LABEL[type]}
    </span>
  );
}
