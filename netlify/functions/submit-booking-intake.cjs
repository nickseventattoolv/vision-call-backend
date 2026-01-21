const sgMail = require("@sendgrid/mail");

exports.handler = async (event) => {
  // 1. SETUP HEADERS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  console.log("--- STARTING FUNCTION ---");

  try {
    // 2. CHECK API KEY
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey)
      throw new Error(
        "CRITICAL: SENDGRID_API_KEY is missing in Netlify Settings!"
      );
    if (!apiKey.startsWith("SG."))
      throw new Error(
        "CRITICAL: API Key does not start with 'SG.' Check your settings."
      );

    console.log("API Key Check: Passed (Starts with SG)");
    sgMail.setApiKey(apiKey);

    // 3. CHECK DATA
    if (!event.body)
      throw new Error(
        "CRITICAL: No data received from website (Body is empty)."
      );
    console.log("Raw Body:", event.body); // This will show us exactly what the website sent

    const data = JSON.parse(event.body);
    const formTitle = data.formTitle || "DEBUG TEST";

    // 4. ATTEMPT SEND
    console.log(`Attempting to send email to bookings@seventattoolv.com...`);

    await sgMail.send({
      to: "bookings@seventattoolv.com",
      from: "bookings@seventattoolv.com", // MUST MATCH VERIFIED SENDER
      subject: `DEBUG: ${formTitle}`,
      text: `If you see this, the pipeline is fixed.\n\nData received:\n${JSON.stringify(
        data,
        null,
        2
      )}`,
    });

    console.log("--- EMAIL SENT SUCCESSFULLY ---");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Sent!" }),
    };
  } catch (error) {
    console.error("--- CRASH REPORT ---");
    console.error(error.message);
    console.error(error);

    // Send the error back to the website so you can see it in the browser too
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: `Backend Crash: ${error.message}` }),
    };
  }
};
