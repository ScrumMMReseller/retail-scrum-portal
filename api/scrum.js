export default async function handler(req, res) {
  // Allow browser to call this route from your domain
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight (CORS OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const ZOHO_ACCESS_TOKEN = process.env.ZOHO_ACCESS_TOKEN;
  if (!ZOHO_ACCESS_TOKEN) {
    return res.status(500).json({ error: "Missing Zoho token on server" });
  }

  // GET: fetch records from Zoho
  if (req.method === "GET") {
    try {
      const zohoResp = await fetch("https://www.zohoapis.com/crm/v2/Scrum_Updates", {
        method: "GET",
        headers: {
          Authorization: `Zoho-oauthtoken ${ZOHO_ACCESS_TOKEN}`
        }
      });

      const text = await zohoResp.text();
      if (!zohoResp.ok) {
        return res.status(zohoResp.status).send(text);
      }

      // Pass Zoho JSON straight back
      res.setHeader("Content-Type", "application/json");
      return res.status(200).send(text);
    } catch (err) {
      console.error("GET /api/scrum error:", err);
      return res.status(500).json({ error: "Server error talking to Zoho (GET)" });
    }
  }

  // POST: create new record in Zoho
  if (req.method === "POST") {
    try {
      // Vercel gives us body parsing differently than Express.
      // We need to read the request body manually if it's not parsed.
      // We'll handle both cases.
      let bodyData;
      if (typeof req.body === "string") {
        bodyData = JSON.parse(req.body);
      } else {
        bodyData = req.body;
      }

      // bodyData is the row we sent from the browser
      const row = bodyData;

      const isBlocked = row.blockers && row.blockers.trim() !== "";
      const blockerStatus = isBlocked ? "Open" : "Cleared";

      const payload = {
        data: [
          {
            Name: row.id,
            Date_Of_Standup: row.date,
            Team_Member_Name: row.team_member,
            Department: row.department,
            Daily_Tasks: row.yesterday_work,
            Today_s_Plan: row.today_plan,
            Issues_Encountered: row.blockers,
            Blocker_Status: blockerStatus,
            Resolution_Note: row.remarks || "",
            Remarks_Notes: row.remarks || "",
            Created_At: row.created_at,
            Resolved_At: null
          }
        ],
        trigger: []
      };

      const zohoResp = await fetch("https://www.zohoapis.com/crm/v2/Scrum_Updates", {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${ZOHO_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const text = await zohoResp.text();
      if (!zohoResp.ok) {
        return res.status(zohoResp.status).send(text);
      }

      // Return Zoho response to browser
      res.setHeader("Content-Type", "application/json");
      return res.status(200).send(text);

    } catch (err) {
      console.error("POST /api/scrum error:", err);
      return res.status(500).json({ error: "Server error talking to Zoho (POST)" });
    }
  }

  // Anything else
  return res.status(405).json({ error: "Method Not Allowed" });
}
