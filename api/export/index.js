const { TableClient } = require("@azure/data-tables");

const TABLE_NAME = "registrations";

// RFC-4180 safe cell: quote anything containing comma, quote, or newline
function csvCell(v) {
  const s = (v === null || v === undefined) ? "" : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

module.exports = async function (context, req) {
  try {
    const conn = process.env.REG_STORAGE_CONNECTION;
    if (!conn) {
      context.res = { status: 500, body: "storage_not_configured" };
      return;
    }

    const client = TableClient.fromConnectionString(conn, TABLE_NAME);

    const cols = [
      "submitted_at", "first_name", "last_name", "company", "email", "phone",
      "role", "citizenship_status", "country_of_citizenship", "green_card", "plant_tour_eligible"
    ];
    const headers = [
      "Submitted (UTC)", "First name", "Last name", "Company", "Email", "Phone",
      "Role", "Citizenship status", "Country of citizenship", "Green card", "Plant tour eligible"
    ];

    const all = [];
    for await (const e of client.listEntities()) all.push(e);
    all.sort((a, b) => String(a.submitted_at || "").localeCompare(String(b.submitted_at || "")));

    const lines = [headers.map(csvCell).join(",")];
    for (const e of all) lines.push(cols.map(c => csvCell(e[c])).join(","));

    // Leading BOM so Excel reads UTF-8 (accents in names/countries) correctly
    const csv = "\uFEFF" + lines.join("\r\n");
    const stamp = new Date().toISOString().slice(0, 10);

    context.res = {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="techday2026-registrations-${stamp}.csv"`
      },
      body: csv
    };
  } catch (e) {
    context.log.error("export error:", e);
    context.res = { status: 500, body: "server_error" };
  }
};
