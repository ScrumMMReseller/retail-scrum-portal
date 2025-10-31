// netlify/functions/scrum.js

// small helper: fetch polyfill not needed on Netlify runtime (Node 18+ has fetch)

exports.handler = async (event, context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  // ---- helper: get fresh Zoho access token using refresh token ----
  async function getZohoAccessToken() {
    const params = new URLSearchParams();
    params.append("refresh_token", process.env.ZREFRESH_TOKEN);
    params.append("client_id", process.env.ZCLIENT_ID);
    params.append("client_secret", process.env.ZCLIENT_SECRET);
    params.append("grant_type", "refresh_token");

    // NOTE: we are using zoho.com (global DC). If your org is in .com we're good.
    // If your Zoho domain is .eu or .in, we must change this base URL.
    const tokenResp = await fetch("https://accounts.zoho.com/oauth/v2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });

    if (!tokenResp.ok) {
      const text = await tokenResp.text();
      console.error("Failed to refresh Zoho token:", tokenResp.status, text);
      throw new Error("Zoho auth refresh failed");
    }

    const tokenJson = await tokenResp.json();
    // tokenJson.access_token is what we use next
    return tokenJson.access_token;
  }

  // ---- helper: map Zoho CRM record -> frontend row ----
  function mapZohoRecord(r) {
    return {
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
    };
  }

  // ---- GET = fetch updates ----
  if (event.httpMethod === "GET") {
    try {
      const accessToken = await getZohoAccessToken();

      const zohoResp = await fetch(
        "https://www.zohoapis.com/crm/v2/Scrum_Updates",
        {
          method: "GET",
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!zohoResp.ok) {
        const errText = await zohoResp.text();
        console.error("Zoho GET failed:", zohoResp.status, errText);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            error: "Zoho GET failed",
            status: zohoResp.status,
            raw: errText,
          }),
        };
      }

      const data = await zohoResp.json();
      const mapped = Array.isArray(data.data)
        ? data.data.map(mapZohoRecord)
        : [];

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: mapped,
          count: mapped.length,
        }),
      };
    } catch (err) {
      console.error("GET handler error:", err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Server error in GET",
          message: err.message,
        }),
      };
    }
  }

  // ---- POST = create new update in Zoho ----
  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body || "{}");

      const recordToInsert = {
        Name: body.id, // you can change this to something nicer later
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

      const accessToken = await getZohoAccessToken();

      const zohoPostResp = await fetch(
        "https://www.zohoapis.com/crm/v2/Scrum_Updates",
        {
          method: "POST",
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: [recordToInsert],
            trigger: [],
          }),
        }
      );

      const postResult = await zohoPostResp.json();

      if (!zohoPostResp.ok) {
        console.error(
          "Zoho POST failed:",
          zohoPostResp.status,
          JSON.stringify(postResult)
        );
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            error: "Zoho POST failed",
            status: zohoPostResp.status,
            zoho: postResult,
          }),
        };
      }

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ok: true,
          zoho: postResult,
        }),
      };
    } catch (err) {
      console.error("POST handler error:", err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Server error in POST",
          message: err.message,
        }),
      };
    }
  }

  // ---- wrong method ----
  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ error: "Method Not Allowed" }),
  };
};
