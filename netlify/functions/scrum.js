// netlify/functions/scrum.js

// Helper: get a fresh Zoho access token using refresh token
async function getZohoAccessToken() {
  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  });

  // NOTE: if you're not on "zohoapis.com" region (like .eu or .in),
  // change this URL accordingly.
  const resp = await fetch("https://accounts.zoho.com/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const json = await resp.json();

  if (!resp.ok || !json.access_token) {
    console.error("Failed to refresh Zoho token:", resp.status, json);
    throw new Error("Zoho auth failed");
  }

  return json.access_token;
}

async function fetchScrumUpdatesFromZoho(accessToken) {
  const resp = await fetch("https://www.zohoapis.com/crm/v2/Scrum_Updates", {
    method: "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const raw = await resp.json();

  return {
    status: resp.status,
    raw,
  };
}

async function createScrumUpdateInZoho(accessToken, body) {
  const recordToInsert = {
    Name: body.id,
    Date_Of_Standup: body.date,
    Team_Member_Name: body.team_member,
    Department: body.department,
    Daily_Tasks: body.yesterday_work,
    Today_s_Plan: body.today_plan,
    Issues_Encountered: body.blockers,
    Remarks_Notes: body.remarks,
    Blocker_Status: body.status === "active" ? "Open" : "Closed",
    Created_At: body.created_at,
  };

  const resp = await fetch("https://www.zohoapis.com/crm/v2/Scrum_Updates", {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: [recordToInsert],
      trigger: [],
    }),
  });

  const raw = await resp.json();

  return {
    status: resp.status,
    raw,
  };
}

exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    // 1. always get a fresh valid access token before doing anything
    const accessToken = await getZohoAccessToken();

    if (event.httpMethod === "GET") {
      const { status, raw } = await fetchScrumUpdatesFromZoho(accessToken);

      const mapped = Array.isArray(raw.data)
        ? raw.data.map((r) => ({
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
          }))
        : [];

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: mapped,
          _debug: {
            zoho_status: status,
            count: mapped.length,
          },
        }),
      };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { status, raw } = await createScrumUpdateInZoho(accessToken, body);

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ok: true,
          zoho_status: status,
          zoho_raw: raw,
        }),
      };
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  } catch (err) {
    console.error("Function error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Server error",
        message: err.message || String(err),
      }),
    };
  }
};
