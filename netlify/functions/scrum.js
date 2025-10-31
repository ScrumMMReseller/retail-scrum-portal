// netlify/functions/scrum.js

export async function handler(event, context) {
  const ZOHO_ACCESS_TOKEN = process.env.ZOHO_ACCESS_TOKEN;

  if (!ZOHO_ACCESS_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing Zoho access token (ZOHO_ACCESS_TOKEN)" }),
    };
  }

  try {
    // Fetch records from Zoho CRM module "Scrum_Updates"
    const zohoResp = await fetch("https://www.zohoapis.com/crm/v2/Scrum_Updates", {
      method: "GET",
      headers: {
        Authorization: `Zoho-oauthtoken ${ZOHO_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    const data = await zohoResp.json();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to fetch from Zoho",
        details: err.message
      })
    };
  }
}
