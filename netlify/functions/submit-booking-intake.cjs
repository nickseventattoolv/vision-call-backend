const nodemailer = require("nodemailer");

exports.handler = async (event, context) => {
  // --- CORS HEADERS (The Secret Handshake) ---
  const headers = {
    "Access-Control-Allow-Origin": "*", // Allow Shopify to talk to us
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // 1. Handle the "Pre-flight" check
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "OK" };
  }

  // 2. Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method Not Allowed" };
  }

  // 3. Parse the incoming data
  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: "Invalid JSON" };
  }

  // 4. Configure the Transporter
  const transporter = nodemailer.createTransport({
    host: "smtp.sendgrid.net",
    port: 587,
    secure: false,
    auth: {
      user: "apikey",
      pass: process.env.SENDGRID_API_KEY,
    },
  });

  // 5. Prepare the Email content
  const mailOptions = {
    from: '"Seven Tattoo" <bookings@seventattoolv.com>',
    to: "bookings@seventattoolv.com",
    subject: `Vision Call App: ${data.fullName}`,
    text: `
      NEW VISION CALL REQUEST
      -----------------------
      Name: ${data.fullName}
      Email: ${data.email}
      Phone: ${data.phone}
      Instagram/Artist: ${data.artist || "Not specified"}
      
      MEANING:
      ${data.meaning}
      
      VISION:
      ${data.vision}
      
      DETAILS:
      Placement: ${data.placement}
      Scale: ${data.scale}
      Source: ${data.source_link}
    `,
    replyTo: data.email,
  };

  // 6. Send the email
  try {
    await transporter.sendMail(mailOptions);
    return {
      statusCode: 200,
      headers, // <--- IMPORTANT: Send headers back with success
      body: JSON.stringify({ message: "Email sent successfully!" }),
    };
  } catch (error) {
    console.error("Email Error:", error);
    return {
      statusCode: 500,
      headers, // <--- IMPORTANT: Send headers back with error
      body: JSON.stringify({ error: "Failed to send email." }),
    };
  }
};
