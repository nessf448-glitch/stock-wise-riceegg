import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductThumb({
  url,
  name,
  className,
}: {
  url?: string | null;
  name: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-secondary",
        className,
      )}
    >
      {url ? (
        <img src={url} alt={`Photo of ${name}`} loading="lazy" className="size-full object-cover" />
      ) : (
        <ImageIcon className="size-4 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );
}
