// BOOMiiS: automatic WhatsApp order updates (OPTIONAL, off until configured).
//
// The database (supabase/whatsapp-auto.sql) calls this function when an order is placed
// and every time its status changes. It sends the customer an approved WhatsApp template
// message through the Meta WhatsApp Cloud API.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   HOOK_SECRET   long random text; must match the vault secret "whatsapp_fn_key"
//   WA_TOKEN      Meta permanent access token (System User token)
//   WA_PHONE_ID   WhatsApp "Phone number ID" from Meta → WhatsApp → API Setup
//   WA_TEMPLATE   approved template name, default "order_update"
//   WA_LANG       template language code, default "en"
//
// The template must have 3 body variables, for example:
//   "Hello {{1}}, here's an update on your BOOMiiS order #{{2}}: {{3}}
//    Track it at boomiisgh.com/track"
//
// Deploy with verify_jwt off (the shared HOOK_SECRET protects it):
//   supabase functions deploy order-whatsapp --no-verify-jwt

const env = (k: string, d = "") => Deno.env.get(k) ?? d;

const UPDATE: Record<string, (mode: string) => string> = {
  new: () => "we've received it and we're confirming your MoMo payment. Your order is being processed.",
  preparing: () => "your payment is confirmed and our kitchen is preparing your food.",
  ready: (m) => m === "Delivery" ? "it's packed and the rider will leave shortly." : "it's ready for pickup at 47 Adjiringano Road, East Legon.",
  out: () => "it's on the way. Please have the delivery fee ready for the rider.",
  completed: () => "it's complete. Thank you for ordering from BOOMiiS!",
  cancelled: () => "we couldn't confirm the payment, so it has been cancelled. Reply here if you have paid.",
};

// 024 123 4567 / +233 24 123 4567 -> 233241234567
const intl = (p: string) => {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "233" + d.slice(1);
  return d;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = env("HOOK_SECRET");
  if (!secret || req.headers.get("x-boomiis-key") !== secret) return new Response("Unauthorized", { status: 401 });

  let o: { ref?: string; name?: string; phone?: string; status?: string; mode?: string };
  try { o = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  const line = UPDATE[o.status ?? ""];
  const to = intl(o.phone ?? "");
  if (!line || !o.ref || to.length < 11) return new Response("Nothing to send", { status: 200 });

  const first = String(o.name || "").trim().split(/\s+/)[0] || "there";
  const res = await fetch(`https://graph.facebook.com/v21.0/${env("WA_PHONE_ID")}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("WA_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: env("WA_TEMPLATE", "order_update"),
        language: { code: env("WA_LANG", "en") },
        components: [{
          type: "body",
          parameters: [first, o.ref, line(o.mode ?? "")].map((text) => ({ type: "text", text })),
        }],
      },
    }),
  });
  const out = await res.text();
  if (!res.ok) console.error("WhatsApp send failed", res.status, out);
  return new Response(out, { status: res.ok ? 200 : 502, headers: { "Content-Type": "application/json" } });
});
