// Supabase Edge Function: Cakto -> liberação segura do Natal que Vende.
// Implementação preparada com base nos eventos oficiais; exige teste com payload
// real do produto antes de aceitar pagamentos em produção.
import { createClient } from "npm:@supabase/supabase-js@2";

const secret = Deno.env.get("CAKTO_WEBHOOK_SECRET") || "";
const allowedProductId = Deno.env.get("CAKTO_PRODUCT_ID") || "";
const portalUrl = Deno.env.get("PORTAL_URL") || "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const adminKey = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const enc = new TextEncoder();

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function signatureValid(body: string, timestamp: string, signature: string): Promise<boolean> {
  if (!timestamp || !/^\d{10}$/.test(timestamp) || !signature || !secret) return false;
  // Cakto documenta timestamp Unix em segundos e validade máxima de 5 minutos.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(timestamp + "." + body)));
  const hex = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
  return safeEquals(signature.toLowerCase(), "v1=" + hex);
}

function productId(data: Record<string, any>): string {
  const value = data.product_id ?? data.productId ?? data.product?.id ??
    data.product?.uuid ?? data.offer?.product_id ?? data.offer?.product?.id;
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (![secret, allowedProductId, portalUrl, supabaseUrl, adminKey].every(Boolean)) {
    return json({ error: "not_configured" }, 503);
  }
  // A requisição chega do servidor da Cakto, não do navegador.
  if (Number(req.headers.get("content-length") || 0) > 150000) {
    return json({ error: "payload_too_large" }, 413);
  }
  const raw = await req.text();
  if (raw.length > 150000) return json({ error: "payload_too_large" }, 413);
  const good = await signatureValid(
    raw, req.headers.get("X-Cakto-Timestamp") || "", req.headers.get("X-Cakto-Signature") || ""
  );
  if (!good) return json({ error: "invalid_signature" }, 401);

  let payload: any;
  try { payload = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
  const event = String(payload.event || "");
  if (!["purchase_approved", "refund", "chargeback"].includes(event)) {
    return json({ status: "ignored" });
  }
  const data = payload.data;
  if (!data || typeof data !== "object") return json({ error: "missing_order" }, 422);

  const orderId = String(data.id || "");
  if (!orderId || orderId.length > 160) return json({ error: "missing_order_id" }, 422);
  const admin = createClient(supabaseUrl, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });

  // Para refunds, a Cakto pode resumir o payload; recupere dados do pedido
  // previamente registrado, sem permitir produto de fora.
  const { data: previous } = await admin.from("access_orders")
    .select("email,product_id,invite_sent_at,status").eq("order_id", orderId).maybeSingle();
  const incomingProduct = productId(data);
  const currentProduct = incomingProduct || (event !== "purchase_approved" ? previous?.product_id : "");
  if (!currentProduct || currentProduct !== allowedProductId) {
    return json({ error: "unrecognized_product" }, 422);
  }
  const email = String(data.customer?.email || previous?.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) {
    return json({ error: "invalid_customer_email" }, 422);
  }
  if (event === "purchase_approved" && !["paid", "approved", "completed"].includes(String(data.status || "").toLowerCase())) {
    // Apenas a ocorrência do evento + um estado aprovado podem liberar acesso.
    return json({ error: "unconfirmed_payment" }, 422);
  }

  const newStatus = event === "purchase_approved" ? "paid" :
    event === "refund" ? "refunded" : "chargeback";
  const { error: storeError } = await admin.rpc("ingest_cakto_order", {
    p_order_id: orderId, p_email: email, p_product_id: allowedProductId, p_status: newStatus
  });
  if (storeError) return json({ error: "database_error" }, 503);
  if (newStatus !== "paid") return json({ status: "access_revoked" });

  // Uma compra reembolsada não pode ser reativada por evento antigo reentregue.
  const { data: order, error: orderError } = await admin.from("access_orders")
    .select("status,invite_sent_at").eq("order_id", orderId).single();
  if (orderError || !order) return json({ error: "database_error" }, 503);
  if (order.status !== "paid") return json({ status: "already_revoked" });
  if (order.invite_sent_at) return json({ status: "already_processed" });

  // Convite via Supabase Auth: a compradora define sua própria senha;
  // NUNCA se manda senha em texto puro por e-mail.
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: portalUrl,
    data: { origin: "cakto", product: "natal-que-vende" }
  });
  if (inviteError) {
    // Conta já existente pode usar login/recuperação de senha.
    const alreadyExists = /already|registered|exists|cadastrad|existente/i.test(inviteError.message || "");
    if (!alreadyExists) return json({ error: "invite_retry_required" }, 503);
  }
  const { error: stampError } = await admin.from("access_orders")
    .update({ invite_sent_at: new Date().toISOString() }).eq("order_id", orderId);
  if (stampError) return json({ error: "invite_state_retry_required" }, 503);
  return json({ status: "access_granted" });
});
