const { TableClient } = require("@azure/data-tables");

const TABLE_NAME = "registrations";
// citizenship data is intentionally NOT collected here — only the derived eligibility flag.
const REQUIRED = ["first_name", "last_name", "company", "email", "phone", "role", "plant_tour_eligible"];
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

async function verifyCaptcha(token, remoteip, context) {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) {
    context.log.error("TURNSTILE_SECRET app setting is missing.");
    return false;
  }
  if (!token) return false;
  try {
    const body = { secret, response: token };
    if (remoteip) body.remoteip = remoteip;
    const r = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!data.success) context.log.warn("Turnstile rejected:", data["error-codes"]);
    return data.success === true;
  } catch (e) {
    context.log.error("Turnstile verify error:", e);
    return false;
  }
}

module.exports = async function (context, req) {
  try {
    const b = req.body || {};

    // --- bot protection: verify the CAPTCHA token before doing anything else ---
    const remoteip = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || "";
    const human = await verifyCaptcha(b.captcha_token, remoteip, context);
    if (!human) {
      context.res = { status: 400, headers: { "Content-Type": "application/json" }, body: { error: "captcha_failed" } };
      return;
    }

    // --- field validation ---
    for (const f of REQUIRED) {
      if (!b[f] || !String(b[f]).trim()) {
        context.res = { status: 400, headers: { "Content-Type": "application/json" }, body: { error: "missing_field", field: f } };
        return;
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email).trim())) {
      context.res = { status: 400, headers: { "Content-Type": "application/json" }, body: { error: "invalid_email" } };
      return;
    }
    const elig = String(b.plant_tour_eligible).trim();
    if (elig !== "Yes" && elig !== "No") {
      context.res = { status: 400, headers: { "Content-Type": "application/json" }, body: { error: "invalid_eligibility" } };
      return;
    }

    const conn = process.env.REG_STORAGE_CONNECTION;
    if (!conn) {
      context.log.error("REG_STORAGE_CONNECTION app setting is missing.");
      context.res = { status: 500, body: { error: "storage_not_configured" } };
      return;
    }

    const client = TableClient.fromConnectionString(conn, TABLE_NAME);
    await client.createTable().catch(() => {}); // no-op if it already exists

    const now = new Date();
    const entity = {
      partitionKey: "techday2026",
      rowKey: now.toISOString().replace(/[:.]/g, "-") + "-" + Math.random().toString(36).slice(2, 8),
      first_name: String(b.first_name).trim(),
      last_name: String(b.last_name).trim(),
      company: String(b.company).trim(),
      email: String(b.email).trim(),
      phone: String(b.phone).trim(),
      role: String(b.role).trim(),
      // Only the eligibility flag is persisted — no citizenship, country, or green-card data.
      plant_tour_eligible: elig,
      submitted_at: b.submitted_at || now.toISOString()
    };

    await client.createEntity(entity);
    context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: { ok: true } };
  } catch (e) {
    context.log.error("register error:", e);
    context.res = { status: 500, headers: { "Content-Type": "application/json" }, body: { error: "server_error" } };
  }
};
