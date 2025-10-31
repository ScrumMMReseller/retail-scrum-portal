// netlify/functions/scrum.js

// --- REGION (.com because your CRM is crm.zoho.com) ---
const ZOHO_BASE_ACCOUNTS = "https://accounts.zoho.com";
const ZOHO_BASE_API      = "https://www.zohoapis.com";

// Get a fresh access token using your REFRESH TOKEN
async function getZohoAccessToken() {
  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  });

  const tokenResp = await fetch(`${ZOHO_BASE_ACCOUNTS}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const tokenJson = await tokenResp.json();

  // These console.logs go to Netlify function logs (not to the browser)
  console.log("Zoho tokenResp status:", tokenResp.status);
  console.log("Zoho tokenJson keys:", Object.keys(tokenJson));

  if (!tokenResp.ok || !tokenJson.access_token) {
    console.error("Zoho token error full:", tokenJson);
    throw new Error("Zoho auth failed");
  }

  return tokenJson.access_token;
}

exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle OPTIONS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    // get a valid access token for THIS request
    const accessToken = await getZohoAccessToken();

    // ----------------- GET -----------------
    if (event.httpMethod === "GET") {
      const zohoResp = await fetch(`${ZOHO_BASE_API}/crm/v2/Scrum_Updates`, {
        method: "GET",
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      const zohoJson = await zohoResp.json();
      console.log("Zoho GET status:", zohoResp.status);
      console.log("Zoho GET keys:", Object.keys(zohoJson));

      const mapped = (zohoJson.data || []).map((r) => ({
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

      return {
        statusCode: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ data: mapped }),
      };
    }

    // ----------------- POST -----------------
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");

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

      const zohoPostResp = await fetch(`${ZOHO_BASE_API}/crm/v2/Scrum_Updates`, {
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

      const postJson = await zohoPostResp.json();
      console.log("Zoho POST status:", zohoPostResp.status);
      console.log("Zoho POST keys:", Object.keys(postJson));

      return {
        statusCode: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, zoho: postJson }),
      };
    }

    // anything else
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  } catch (err) {
    console.error("Handler error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Server error",
        message: err.message || "Zoho auth failed",
      }),
    };
  }
};
