const nodemailer = require("nodemailer");

exports.handler = async (event, context) => {
  // 1. Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // 2. Parse the incoming data
  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  // 3. Configure the Transporter (Using your SendGrid Key)
  const transporter = nodemailer.createTransport({
    host: "smtp.sendgrid.net",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: "apikey", // This is literally the string "apikey"
      pass: process.env.SENDGRID_API_KEY, // This pulls your SG... key from Netlify
    },
  });

  // 4. Prepare the Email content
  const mailOptions = {
    from: '"Seven Tattoo" <bookings@seventattoolv.com>', // MUST match your verified Sender
    to: "bookings@seventattoolv.com", // Where you want to receive the leads
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
    replyTo: data.email, // Allows you to hit "Reply" and email the client directly
  };

  // 5. Send the email
  try {
    await transporter.sendMail(mailOptions);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Email sent successfully!" }),
    };
  } catch (error) {
    console.error("Email Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to send email." }),
    };
  }
};
