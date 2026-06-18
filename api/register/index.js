const { TableClient } = require("@azure/data-tables");

const TABLE_NAME = "registrations";
const REQUIRED = ["first_name", "last_name", "company", "email", "phone", "role", "citizenship_status"];

module.exports = async function (context, req) {
  try {
    const b = req.body || {};

    // --- basic server-side validation (don't trust the client alone) ---
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
      citizenship_status: String(b.citizenship_status).trim(),
      country_of_citizenship: b.country_of_citizenship ? String(b.country_of_citizenship).trim() : "",
      green_card: b.green_card ? String(b.green_card).trim() : "",
      plant_tour_eligible: b.plant_tour_eligible ? String(b.plant_tour_eligible).trim() : "",
      submitted_at: b.submitted_at || now.toISOString()
    };

    await client.createEntity(entity);
    context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: { ok: true } };
  } catch (e) {
    context.log.error("register error:", e);
    context.res = { status: 500, headers: { "Content-Type": "application/json" }, body: { error: "server_error" } };
  }
};
