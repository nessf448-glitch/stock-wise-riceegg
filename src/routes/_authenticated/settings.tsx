import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  useSettings,
  uploadLoginBackground,
  useSaveLoginBackground,
  friendlyError,
} from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CDP Enterprise Inventory" },
      {
        name: "description",
        content:
          "Configure the CDP Enterprise inventory system, including the store photo shown on the sign-in page.",
      },
      { property: "og:title", content: "Settings — CDP Enterprise Inventory" },
      {
        property: "og:description",
        content: "Manage branding and system preferences for CDP Enterprise inventory.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: settings } = useSettings();
  const save = useSaveLoginBackground();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [cacheBust, setCacheBust] = useState(() => Date.now());
  const [broken, setBroken] = useState(false);

  const current = settings?.login_bg_path ?? null;

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const path = await uploadLoginBackground(file);
      await save.mutateAsync({ path, previous: current });
      setBroken(false);
      setCacheBust(Date.now());
      toast.success("Login background updated");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      await save.mutateAsync({ path: null, previous: current });
      setCacheBust(Date.now());
      toast.success("Login background removed");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Settings"
        description="Branding and appearance options for the inventory system."
      />

      <section className="surface-panel max-w-2xl p-6">
        <h2 className="font-display text-lg font-bold">Sign-in page background</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a photo of the store to display behind the sign-in page. Landscape images around
          1600×900 look best. Max 8 MB.
        </p>

        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-muted">
          {current && !broken ? (
            <img
              src={`/api/public/login-background?v=${cacheBust}`}
              alt="Current sign-in page background"
              className="aspect-video w-full object-cover"
              onError={() => setBroken(true)}
            />
          ) : (
            <div className="grid aspect-video w-full place-items-center text-sm text-muted-foreground">
              No background photo yet
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {current ? "Replace photo" : "Upload photo"}
          </Button>
          {current ? (
            <Button variant="outline" onClick={handleRemove} disabled={busy}>
              <Trash2 className="size-4" /> Remove
            </Button>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
