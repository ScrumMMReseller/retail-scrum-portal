// retail-scrum-portal/netlify/functions/scrum.js

exports.handler = async (event, context) => {
  // Allow browser calls
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle preflight OPTIONS request (browser CORS)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  // ---- 1. READ UPDATES (GET) ----
  if (event.httpMethod === "GET") {
    try {
      // Example: fetch records from Zoho CRM
      const zohoResp = await fetch(
        "https://www.zohoapis.com/crm/v2/Scrum_Updates",
        {
          method: "GET",
          headers: {
            Authorization: `Zoho-oauthtoken ${process.env.ZOHO_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await zohoResp.json();

      // Map Zoho fields to frontend shape
      const mapped = (data.data || []).map((r) => ({
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
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: mapped }),
      };
    } catch (err) {
      console.error("Zoho GET error:", err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Failed to fetch from Zoho" }),
      };
    }
  }

  // ---- 2. CREATE NEW UPDATE (POST) ----
  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body || "{}");

      // Convert our frontend field names -> Zoho CRM field API names
      const recordToInsert = {
        Name: body.id, // you can change this to something better later
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

      const zohoPostResp = await fetch(
        "https://www.zohoapis.com/crm/v2/Scrum_Updates",
        {
          method: "POST",
          headers: {
            Authorization: `Zoho-oauthtoken ${process.env.ZOHO_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: [recordToInsert],
            trigger: [], // you can put workflows like "approval", "workflow" if you want Zoho automations
          }),
        }
      );

      const postResult = await zohoPostResp.json();
      // We don't block UI if Zoho returns warning, just send it back
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ok: true, zoho: postResult }),
      };
    } catch (err) {
      console.error("Zoho POST error:", err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Failed to save to Zoho" }),
      };
    }
  }

  // Anything else (PUT, DELETE…)
  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ error: "Method Not Allowed" }),
  };
};
