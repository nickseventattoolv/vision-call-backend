const sgMail = require("@sendgrid/mail");
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  // 1. Allow the website to talk to this function (CORS)
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // 2. Parse the incoming data
  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  // 3. Get API Keys
  const apiKey = process.env.SENDGRID_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // --- DATABASE LOGIC (Wrapped in Safety Bubble) ---
  let dbStatus = "Skipped";
  let dbErrorLog = null;

  // Only try if keys exist
  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);

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
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: newClient, error: createError } = await supabase
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

        if (createError)
          throw new Error("Client Error: " + createError.message);
        clientId = newClient.id;
      }

      // C. Save to Leads Table
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
          notes: `VISION: ${data.vision}\n\nMEANING: ${data.meaning}`,
        },
      ]);

      if (leadError) throw new Error("Lead Error: " + leadError.message);

      dbStatus = "Success"; // It worked!
    } catch (err) {
      console.error("⚠️ DATABASE FAILED:", err.message);
      dbStatus = "Failed";
      dbErrorLog = err.message;
    }
  } else {
    console.error("⚠️ MISSING KEYS: Skipping Database.");
    dbStatus = "Missing Keys";
  }

  // --- EMAIL LOGIC (Runs even if Database fails) ---
  try {
    if (!apiKey || !apiKey.startsWith("SG.")) {
      throw new Error("Invalid SendGrid API Key");
    }
    sgMail.setApiKey(apiKey);

    const formTitle = data.formTitle || "NEW VISION CALL REQUEST";
    const isInquiry = formTitle.toUpperCase().includes("INQUIRY");
    const titleColor = isInquiry ? "#333333" : "#000000";

    // Debug Message for Email Footer
    const dbMessage =
      dbStatus === "Success"
        ? "Saved to CRM ✅"
        : `⚠️ CRM Failed: ${dbErrorLog || "Check Keys"}`;

    const htmlEmail = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px;">
          <div style="background: ${titleColor}; color: white; padding: 20px; text-align: center;">
            <h2 style="margin:0;">${formTitle}</h2>
          </div>
          <div style="padding: 20px;">
            <p><strong>Name:</strong> ${data.fullName}</p>
            <p><strong>Email:</strong> <a href="mailto:${data.email}">${
      data.email
    }</a></p>
            <p><strong>Phone:</strong> ${data.phone}</p>
            <p><strong>Artist:</strong> ${data.artist || "Any"}</p>
            <p><strong>Placement:</strong> ${data.placement}</p>
            <hr>
            <p><strong>Meaning:</strong><br>${data.meaning}</p>
            <p><strong>Vision:</strong><br>${data.vision}</p>
            <hr>
            <p style="font-size: 10px; color: #999; text-align: center;">System Status: ${dbMessage}</p>
          </div>
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
      body: JSON.stringify({ message: "Email Sent", dbStatus }),
    };
  } catch (error) {
    console.error("EMAIL FAILED:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
