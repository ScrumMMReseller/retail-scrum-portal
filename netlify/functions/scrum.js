// netlify/functions/scrum.js
// Serverless function to READ (GET) and CREATE (POST) daily scrum updates
// in Zoho CRM and expose them to the frontend dashboard.

exports.handler = async (event, context) => {
  // --- CORS headers so the browser can call this directly ---
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  // Helper: uniform JSON response
  function send(statusCode, bodyObj) {
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify(bodyObj),
    };
  }

  // Safety check: token present
  const token = process.env.ZOHO_ACCESS_TOKEN;
  if (!token) {
    return send(500, {
      error: "ZOHO_ACCESS_TOKEN is not set on Netlify env vars.",
    });
  }

  // Helper to call Zoho CRM API
  async function zohoRequest(path, opts = {}) {
    // IMPORTANT:
    // If your Zoho account is not US region, change this base below:
    //   - EU:   https://www.zohoapis.eu/crm/v2/...
    //   - IN:   https://www.zohoapis.in/crm/v2/...
    //   - AU:   https://www.zohoapis.com.au/crm/v2/...
    //   - ME/SA (Saudi): https://www.zohoapis.sa/crm/v2/...
    //
    // For now we keep .com, but if we see auth errors from the console later,
    // we will switch to your correct region.
    const baseUrl = "https://www.zohoapis.com/crm/v2";

    const res = await fetch(`${baseUrl}${path}`, {
      method: opts.method || "GET",
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        "Content-Type": "application/json",
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    const text = await res.text();
    // Try parsing JSON, but keep raw for debugging
    let json;
    try {
      json = JSON.parse(text);
    } catch (_) {
      json = { parse_error: true, raw: text };
    }

    return { status: res.status, json };
  }

  // ---- GET: read all scrum updates ----
  if (event.httpMethod === "GET") {
    // We'll ask Zoho for all records in module "Scrum_Updates"
    // If this is the wrong module name we will see it in .json below.
    const { status, json } = await zohoRequest("/Scrum_Updates");

    // Zoho usually returns { data: [ {...}, {...} ], info: {...} }
    const rows = Array.isArray(json.data) ? json.data : [];

    // Map Zoho -> frontend shape
    const mapped = rows.map((r) => ({
      Name: r.Name,
      Date_Of_Standup: r.Date_Of_Standup,
      Team_Member_Name: r.Team_Member_Name,
      Department: r.Department,
      Daily_Tasks: r.Daily_Tasks,
      Today_s_Plan: r.Today_s_Plan,
      Issues_Encountered: r.Issues_Encountered,
      Blocker_Status: r.Blocker_Status,
      Resolution_Note: r.Resolution_Note,
      Created_At: r.Created_At,
      Resolved_At: r.Resolved_At,
      Remarks_Notes: r.Remarks_Notes,
    }));

    // We return both the mapped and a debug block from Zoho so you can see what's happening
    // in the browser console. Frontend will still only use .data.
    return send(200, {
      data: mapped,
      _debug: {
        httpStatusFromZoho: status,
        zohoRaw: json,
        recordCount: mapped.length,
      },
    });
  }

  // ---- POST: create new scrum update ----
  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (e) {
      return send(400, { error: "Invalid JSON body" });
    }

    // Frontend sends:
    // id, date, team_member, department, yesterday_work, today_plan, blockers, remarks, status, created_at
    // We'll map that to Zoho fields.
    const recordToInsert = {
      Name: body.id || "", // you can replace this with something nicer
      Date_Of_Standup: body.date || "",
      Team_Member_Name: body.team_member || "",
      Department: body.department || "",
      Daily_Tasks: body.yesterday_work || "",
      Today_s_Plan: body.today_plan || "",
      Issues_Encountered: body.blockers || "",
      Remarks_Notes: body.remarks || "",
      Blocker_Status: body.status === "active" ? "Open" : "Closed",
      Created_At: body.created_at || new Date().toISOString(),
    };

    // Push record into Zoho
    const { status, json } = await zohoRequest("/Scrum_Updates", {
      method: "POST",
      body: {
        data: [recordToInsert],
        trigger: [], // e.g. ["workflow"] if you have workflows in Zoho you want to fire
      },
    });

    // Send back what Zoho said so we can debug in console
    return send(200, {
      ok: status >= 200 && status < 300,
      sent: recordToInsert,
      zohoReply: json,
    });
  }

  // ---- anything else ----
  return send(405, { error: "Method Not Allowed" });
};
