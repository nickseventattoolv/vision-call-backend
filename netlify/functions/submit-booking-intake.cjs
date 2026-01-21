const sgMail = require("@sendgrid/mail");

// Make sure you have your SENDGRID_API_KEY set in Netlify Environment Variables
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async (event) => {
  // CORS Headers (Allows your Shopify site to talk to this backend)
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body);

    // 1. Detect Type of Email
    const isGeneralInquiry = data.placement === "GENERAL CONTACT INQUIRY";
    const emailTitle = isGeneralInquiry
      ? "GENERAL CONTACT INQUIRY"
      : "NEW VISION CALL REQUEST";
    const titleColor = isGeneralInquiry ? "#333333" : "#000000"; // Dark Grey for Contact, Black for Vision

    // 2. Build the HTML Email
    // This uses a table structure which is the safest way to ensure emails look good in Outlook/Gmail/Apple Mail.
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
          <div class="header">
            <h2>${emailTitle}</h2>
          </div>

          <div class="content">
            
            <div class="info-grid">
              <div class="info-row">
                <span class="info-cell label">Client Name</span>
                <span class="info-cell value">${data.fullName}</span>
              </div>
              <div class="info-row">
                <span class="info-cell label">Email</span>
                <span class="info-cell value"><a href="mailto:${
                  data.email
                }" style="color: #007bff; text-decoration: none;">${
      data.email
    }</a></span>
              </div>
              <div class="info-row">
                <span class="info-cell label">Phone</span>
                <span class="info-cell value"><a href="tel:${
                  data.phone
                }" style="color: #333; text-decoration: none;">${
      data.phone
    }</a></span>
              </div>
              <div class="info-row">
                <span class="info-cell label">Requested Artist</span>
                <span class="info-cell value">${
                  data.artist || "Not Specified"
                }</span>
              </div>
              <div class="info-row">
                <span class="info-cell label">Placement</span>
                <span class="info-cell value">${data.placement}</span>
              </div>
               <div class="info-row">
                <span class="info-cell label">Scale</span>
                <span class="info-cell value">${data.scale}</span>
              </div>
            </div>

            <div class="section-title">Context / Meaning</div>
            <div class="text-block">${data.meaning}</div>

            <div class="section-title">Vision / Message</div>
            <div class="text-block">${data.vision}</div>

            <div style="margin-top: 30px; font-size: 12px; color: #aaa;">
              Source: ${data.source_link}
            </div>

          </div>

          <div class="footer">
            Sent via Seven Tattoo Web System<br>
            ${new Date().toLocaleString("en-US", {
              timeZone: "America/Los_Angeles",
            })} (PST)
          </div>
        </div>
      </body>
      </html>
    `;

    // 3. Send Email via SendGrid
    const msg = {
      to: "bookings@seventattoolv.com", // Your Booking Email
      from: "no-reply@seventattoolv.com", // Your Verified Sender
      subject: `${emailTitle}: ${data.fullName}`,
      html: htmlEmail, // <--- This sends the Pretty HTML version
    };

    await sgMail.send(msg);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Email sent successfully" }),
    };
  } catch (error) {
    console.error("Error sending email:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to send email" }),
    };
  }
};
