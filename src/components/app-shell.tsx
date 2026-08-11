import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Boxes,
  ArrowLeftRight,
  BellRing,
  History,
  Package,
  Truck,
  FileBarChart,
  LogOut,
  Wheat,
  Menu,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useProducts, useBatches, useSettings, expiryStatus, stockStatus } from "@/lib/inventory";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/monitoring", label: "Monitoring", icon: BellRing, alerts: true },
  { to: "/history", label: "Movement History", icon: History },
  { to: "/products", label: "Products", icon: Package },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
  { to: "/reports", label: "Reports", icon: FileBarChart },
] as const;

function NavList({ alertCount, onNavigate }: { alertCount: number; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"
          activeProps={{ className: "font-semibold" }}
        >
          <item.icon className="size-4.5 shrink-0" />
          <span className="flex-1">{item.label}</span>
          {"alerts" in item && item.alerts && alertCount > 0 ? (
            <span className="rounded-full bg-sidebar-primary px-1.5 py-0.5 text-[11px] font-bold text-sidebar-primary-foreground">
              {alertCount}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const { data: products = [] } = useProducts();
  const { data: batches = [] } = useBatches();
  const { data: settings } = useSettings();

  const nearDays = settings?.near_expiry_days ?? 7;
  const lowCount = products.filter((p) => stockStatus(p) !== "in_stock").length;
  const expiringCount = batches.filter((b) => expiryStatus(b.expiration_date, nearDays) !== "valid")
    .length;
  const alertCount = lowCount + expiringCount;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const brand = (
    <div className="flex items-center gap-3 px-3 py-1">
      <div className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
        <Wheat className="size-5" />
      </div>
      <div>
        <p className="font-display text-sm font-bold tracking-tight text-sidebar-foreground">
          CDP Enterprise
        </p>
        <p className="text-[11px] text-sidebar-foreground/60">Smart Inventory System</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between bg-sidebar p-4 lg:flex">
        <div className="space-y-6">
          {brand}
          <NavList alertCount={alertCount} />
        </div>
        <div className="space-y-3 border-t border-sidebar-border pt-4">
          <div className="px-3">
            <p className="truncate text-xs font-medium text-sidebar-foreground">{user?.email}</p>
            <p className="text-[11px] text-sidebar-foreground/60">Authorized personnel</p>
          </div>
          <Button
            variant="ghost"
            onClick={signOut}
            className="w-full justify-start gap-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" /> Log out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open navigation">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-4">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="mt-4 space-y-6">
                {brand}
                <NavList alertCount={alertCount} onNavigate={() => setOpen(false)} />
                <Button
                  variant="ghost"
                  onClick={signOut}
                  className="w-full justify-start gap-2 text-sidebar-foreground/80 hover:bg-sidebar-accent"
                >
                  <LogOut className="size-4" /> Log out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-display font-semibold">CDP Inventory</span>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4")}>
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="no-print flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
