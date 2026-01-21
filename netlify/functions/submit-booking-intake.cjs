const sgMail = require("@sendgrid/mail");

exports.handler = async (event) => {
  // 1. HEADERS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // LOGGING: This helps us see if the function actually starts
  console.log("--- STARTING EMAIL FUNCTION ---");

  try {
    // 2. SETUP SENDGRID
    // Ensure 'SENDGRID_API_KEY' is set in Netlify Environment Variables
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey || !apiKey.startsWith("SG.")) {
      throw new Error("Invalid or Missing API Key");
    }
    sgMail.setApiKey(apiKey);

    // 3. PARSE DATA
    const data = JSON.parse(event.body);
    console.log("Received Data for:", data.fullName); // Log who is booking

    // 4. UNIVERSAL LOGIC
    const formTitle = data.formTitle || "NEW VISION CALL REQUEST";
    const isInquiry =
      formTitle.toUpperCase().includes("INQUIRY") ||
      formTitle.toUpperCase().includes("CONTACT");
    const titleColor = isInquiry ? "#333333" : "#000000";

    // 5. BUILD EMAIL
    const htmlEmail = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; border: 1px solid #ddd; }
          .header { background-color: ${titleColor}; color: #fff; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .info-row { border-bottom: 1px solid #eee; padding: 8px 0; }
          .label { font-weight: bold; color: #777; width: 150px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h2>${formTitle}</h2></div>
          <div class="content">
            <div class="info-row"><span class="label">Name:</span> ${
              data.fullName
            }</div>
            <div class="info-row"><span class="label">Email:</span> <a href="mailto:${
              data.email
            }">${data.email}</a></div>
            <div class="info-row"><span class="label">Phone:</span> ${
              data.phone
            }</div>
            <div class="info-row"><span class="label">Artist:</span> ${
              data.artist || "N/A"
            }</div>
            <div class="info-row"><span class="label">Placement:</span> ${
              data.placement
            }</div>
            <div class="info-row"><span class="label">Scale:</span> ${
              data.scale || "N/A"
            }</div>
            
            <br><h3>Context / Meaning</h3>
            <p style="background:#f9f9f9; padding:10px;">${data.meaning}</p>
            
            <h3>Vision / Message</h3>
            <p style="background:#f9f9f9; padding:10px;">${data.vision}</p>
            
            <p style="font-size:12px; color:#aaa; margin-top:20px;">Source: ${
              data.source_link
            }</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // 6. SEND EMAIL
    // IMPORTANT: Both "to" and "from" are bookings@seventattoolv.com to guarantee delivery
    await sgMail.send({
      to: "bookings@seventattoolv.com",
      from: "bookings@seventattoolv.com",
      subject: `${formTitle}: ${data.fullName}`,
      html: htmlEmail,
    });

    console.log("--- EMAIL SENT SUCCESSFULLY ---");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Email sent successfully" }),
    };
  } catch (error) {
    console.error("CRASH ERROR:", error); // This prints the exact error to Netlify logs
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: `Server Error: ${error.message}` }),
    };
  }
};
