import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/login-background")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settings } = await supabaseAdmin
          .from("app_settings")
          .select("login_bg_path")
          .eq("id", 1)
          .maybeSingle();
        const path = settings?.login_bg_path;
        if (!path) return new Response("No background set", { status: 404 });

        const { data, error } = await supabaseAdmin.storage.from("product-images").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });

        return new Response(await data.arrayBuffer(), {
          headers: {
            "content-type": data.type || "image/jpeg",
            "cache-control": "public, max-age=60",
          },
        });
      },
    },
  },
});
