import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wheat, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { friendlyError } from "@/lib/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CDP Enterprise Inventory" },
      {
        name: "description",
        content:
          "Authorized personnel sign-in for the CDP Enterprise Smart Inventory Management System.",
      },
      { property: "og:title", content: "Sign in — CDP Enterprise Inventory" },
      {
        property: "og:description",
        content: "Restricted access for CDP Enterprise inventory personnel.",
      },
    ],
  }),
  component: AuthPage,
});

const credentials = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [busy, setBusy] = useState(false);
  const [bgOk, setBgOk] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const parsed = credentials.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details.");
      return;
    }
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (signInError) {
      setError(friendlyError(signInError));
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const fullName = String(form.get("full_name") ?? "").trim();
    const parsed = credentials.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!fullName) {
      setError("Full name is required.");
      return;
    }
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details.");
      return;
    }
    setBusy(true);
    const { error: signUpError } = await supabase.auth.signUp({
      ...parsed.data,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (signUpError) {
      setError(friendlyError(signUpError));
      return;
    }
    toast.success("Account created");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="bg-harvest relative hidden flex-col justify-between overflow-hidden p-10 text-primary-foreground lg:flex">
        {bgOk ? (
          <>
            <img
              src="/api/public/login-background"
              alt="CDP Enterprise store"
              className="absolute inset-0 size-full object-cover"
              onError={() => setBgOk(false)}
            />
            <div className="absolute inset-0 bg-[linear-gradient(150deg,oklch(0.28_0.05_158/0.9),oklch(0.42_0.09_156/0.7))]" />
          </>
        ) : null}
        <Link to="/" className="relative flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Wheat className="size-5" />
          </div>
          <div>
            <p className="font-display text-sm font-bold">CDP Enterprise</p>
            <p className="text-[11px] opacity-75">Catalunan Grande, Davao City</p>
          </div>
        </Link>
        <div className="relative">
          <h2 className="font-display text-4xl leading-tight font-extrabold">
            Smart Inventory Management with Automated Stock Monitoring
          </h2>
          <p className="mt-4 max-w-md text-sm opacity-80">
            Rice and egg stock levels, low-stock alerts, egg batch expiration and full movement
            history — for authorized personnel only.
          </p>
        </div>
        <p className="relative text-xs opacity-60">Version 1.0 · Inventory monitoring use only</p>
      </div>


      <div className="flex items-center justify-center px-6 py-14">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-bold">Inventory access</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            Sign in with your authorized account to continue.
          </p>

          <Tabs defaultValue="signin" onValueChange={() => setError(null)}>
            <TabsList className="w-full">
              <TabsTrigger value="signin" className="flex-1">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">
                Create account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input id="signin-email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>
                {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name">Full name</Label>
                  <Input id="signup-name" name="full_name" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                  />
                  <p className="text-xs text-muted-foreground">At least 6 characters.</p>
                </div>
                {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
