const sgMail = require("@sendgrid/mail");
const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey || !apiKey.startsWith("SG.")) {
      throw new Error("Invalid SendGrid API Key");
    }
    sgMail.setApiKey(apiKey);

    const data = JSON.parse(event.body);

    // --- 1. SUPABASE INTEGRATION ---

    // A. Parse Name
    const fullName = data.fullName || "Unknown Client";
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || "";

    // B. Find or Create Client
    let clientId;

    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("email", data.email)
      .single();

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert([
          {
            first_name: firstName,
            last_name: lastName,
            email: data.email,
            phone: data.phone,
            lead_source: data.hear || "Website Form",
          },
        ])
        .select()
        .single();

      if (clientError)
        throw new Error("Error creating client: " + clientError.message);
      clientId = newClient.id;
    }

    // C. SAVE TO LEADS TABLE (This is the critical fix)
    // We are now saving to 'leads', NOT 'opportunities'
    const { error: leadError } = await supabase.from("leads").insert([
      {
        client_id: clientId,
        placement: data.placement,
        scale: data.scale,
        vision: data.vision,
        meaning: data.meaning,
        artist_preference: data.artist || "None",
        source_link: data.source_link,
        status: "new",
        notes: `VISION: ${data.vision}\n\nMEANING: ${data.meaning}`, // Backup summary
      },
    ]);

    if (leadError) throw new Error("Error creating lead: " + leadError.message);

    // --- 2. EMAIL LOGIC ---
    const formTitle = data.formTitle || "NEW VISION CALL REQUEST";
    const isInquiry =
      formTitle.toUpperCase().includes("INQUIRY") ||
      formTitle.toUpperCase().includes("CONTACT");
    const titleColor = isInquiry ? "#333333" : "#000000";
    const section1Label = isInquiry
      ? "Referral / Company Info"
      : "Context / Meaning";
    const section2Label = isInquiry
      ? "Vision / Message"
      : "Vision / Placement Details";

    const htmlEmail = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
          .header { background-color: ${titleColor}; color: #ffffff; padding: 20px; text-align: center; letter-spacing: 2px; }
          .header h2 { margin: 0; font-size: 20px; text-transform: uppercase; }
          .content { padding: 30px 20px; background-color: #ffffff; }
          .info-grid { display: table; width: 100%; margin-bottom: 20px; }
          .info-row { display: table-row; }
          .info-cell { display: table-cell; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
          .label { font-weight: bold; color: #888; width: 140px; text-transform: uppercase; font-size: 11px; vertical-align: top; }
          .value { font-weight: 500; color: #000; font-size: 14px; }
          .section-title { margin-top: 30px; margin-bottom: 10px; font-size: 12px; font-weight: bold; color: #888; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #000; display: inline-block; padding-bottom: 4px; }
          .text-block { background-color: #f9f9f9; padding: 15px; border-radius: 4px; font-size: 14px; white-space: pre-wrap; border-left: 4px solid #000; }
          .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 11px; color: #999; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h2>${formTitle}</h2></div>
          <div class="content">
            <div class="info-grid">
              <div class="info-row"><span class="info-cell label">Client Name</span><span class="info-cell value">${
                data.fullName
              }</span></div>
              <div class="info-row"><span class="info-cell label">Email</span><span class="info-cell value"><a href="mailto:${
                data.email
              }">${data.email}</a></span></div>
              <div class="info-row"><span class="info-cell label">Phone</span><span class="info-cell value"><a href="tel:${
                data.phone
              }">${data.phone}</a></span></div>
              <div class="info-row"><span class="info-cell label">Requested Artist</span><span class="info-cell value">${
                data.artist || "Not Specified"
              }</span></div>
              <div class="info-row"><span class="info-cell label">Placement</span><span class="info-cell value">${
                data.placement
              }</span></div>
              <div class="info-row"><span class="info-cell label">Scale</span><span class="info-cell value">${
                data.scale || "N/A"
              }</span></div>
            </div>
            <div class="section-title">${section1Label}</div>
            <div class="text-block">${data.meaning}</div>
            <div class="section-title">${section2Label}</div>
            <div class="text-block">${data.vision}</div>
            <div style="margin-top: 30px; font-size: 12px; color: #aaa;">Source: ${
              data.source_link
            }</div>
          </div>
          <div class="footer">Sent via Seven Tattoo Web System<br>${new Date().toLocaleString(
            "en-US",
            { timeZone: "America/Los_Angeles" }
          )} (PST)</div>
        </div>
      </body>
      </html>
    `;

    await sgMail.send({
      to: "bookings@seventattoolv.com",
      from: "bookings@seventattoolv.com",
      subject: `${formTitle}: ${data.fullName}`,
      html: htmlEmail,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Lead saved and email sent successfully",
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
