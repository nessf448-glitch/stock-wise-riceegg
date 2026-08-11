import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Wheat,
  Egg,
  BellRing,
  CalendarClock,
  History,
  FileBarChart,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CDP Enterprise Inventory — Rice & Egg Stock Monitoring" },
      {
        name: "description",
        content:
          "Smart Inventory Management System with automated stock monitoring for CDP Enterprise's rice and egg inventory in Catalunan Grande, Davao City.",
      },
      { property: "og:title", content: "CDP Enterprise Inventory — Rice & Egg Stock Monitoring" },
      {
        property: "og:description",
        content:
          "Smart Inventory Management System with automated stock monitoring for CDP Enterprise's rice and egg inventory in Catalunan Grande, Davao City.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Wheat,
    title: "Rice & egg records",
    body: "One centralized product list with units, prices, suppliers and minimum stock levels.",
  },
  {
    icon: BellRing,
    title: "Automatic stock updates",
    body: "Stock-in, stock-out and adjustments instantly recalculate available quantities.",
  },
  {
    icon: CalendarClock,
    title: "Egg batch expiration",
    body: "Track batch numbers and expiry dates, with near-expired and expired batches flagged.",
  },
  {
    icon: History,
    title: "Movement history",
    body: "Every transaction is kept with date, time, quantity change and the responsible user.",
  },
  {
    icon: FileBarChart,
    title: "Printable reports",
    body: "Current inventory, movements, low stock, near-expired eggs, value and daily summary.",
  },
  {
    icon: ShieldCheck,
    title: "Authorized access only",
    body: "Inventory pages stay locked until authorized personnel sign in.",
  },
];

function Landing() {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen">
      <header className="bg-harvest text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Wheat className="size-5" />
            </div>
            <div>
              <p className="font-display text-sm font-bold">CDP Enterprise</p>
              <p className="text-[11px] opacity-75">Catalunan Grande, Davao City</p>
            </div>
          </div>
          <Button asChild variant="secondary">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>

        <div className="mx-auto max-w-6xl px-6 pb-20 pt-10 sm:pb-28">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-foreground/12 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            <Egg className="size-3.5" /> Rice & egg inventory
          </p>
          <h1 className="max-w-3xl font-display text-4xl leading-[1.05] font-extrabold sm:text-6xl">
            Smart Inventory Management with Automated Stock Monitoring
          </h1>
          <p className="mt-5 max-w-2xl text-base opacity-85 sm:text-lg">
            Replace the paper inventory record with one accurate, always-current view of what rice
            and eggs are on hand — plus automatic low-stock and expiration alerts.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/auth">
                Open the system <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">What the system handles</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Built around the daily inventory work at CDP Enterprise — recording deliveries and sales,
          correcting counts, and knowing what needs replenishment.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="surface-panel p-5">
              <div className="mb-3 grid size-10 place-items-center rounded-lg bg-secondary text-primary">
                <f.icon className="size-5" />
              </div>
              <h3 className="font-display text-base font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        CDP Enterprise · Smart Inventory Management System with Automated Stock Monitoring
      </footer>
    </div>
  );
}
