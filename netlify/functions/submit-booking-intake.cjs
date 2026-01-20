// netlify/functions/submit-booking-intake.cjs
// Seven Tattoo — Vision Call / Booking Intake
// Receives JSON from Shopify, emails careers@seventattoolv.com via SendGrid SMTP (nodemailer)

const nodemailer = require("nodemailer");

// --- CORS ---
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

const ok = (b) => ({
  statusCode: 200,
  headers: corsHeaders,
  body: JSON.stringify(b),
});
const bad = (m, extra = {}) => ({
  statusCode: 400,
  headers: corsHeaders,
  body: JSON.stringify({ ok: false, error: m, ...extra }),
});
const oops = (m, extra = {}) => ({
  statusCode: 500,
  headers: corsHeaders,
  body: JSON.stringify({ ok: false, error: m, ...extra }),
});

function readJson(event) {
  try {
    if (!event.body) return {};
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const v = (x) => (typeof x === "string" ? x.trim() : x);

function mapFields(input) {
  // Accept multiple keys (for backwards compatibility)
  const meaning = v(input.meaning) || v(input.story) || v(input.message);

  const fullName = v(input.fullName) || v(input.name) || v(input.full_name);
  const email = v(input.email) || v(input.applicant_email);
  const phone = v(input.phone) || v(input.phone_number) || v(input.tel);

  const placement = v(input.placement);
  const scale = v(input.scale) || v(input.size);
  const hear = v(input.hear) || v(input.referral) || v(input.how_hear);

  const consentRaw = input.consent ?? input.agree ?? input.review_consent;
  const consent = ["true", "on", "yes", "1"].includes(
    String(consentRaw).toLowerCase()
  );

  const artist = v(input.artist) || v(input.artist_name);
  const sourceLink =
    v(input.source_link) || v(input.sourceLink) || v(input.source);

  // Honeypot (must be blank)
  const website =
    v(input.website) || v(input.hp_website) || v(input.hp_extra_info);

  // Optional notify override from frontend
  const notifyEmail = v(input.notify_email) || v(input.notifyEmail);

  return {
    meaning,
    fullName,
    email,
    phone,
    placement,
    scale,
    hear,
    consent,
    artist,
    sourceLink,
    website,
    notifyEmail,
    raw: input,
  };
}

function validate(m) {
  const missing = [];
  if (!m.meaning) missing.push("meaning");
  if (!m.fullName) missing.push("fullName");
  if (!m.email) missing.push("email");
  if (!m.phone) missing.push("phone");
  if (!m.placement) missing.push("placement");
  if (!m.scale) missing.push("scale");
  if (!m.hear) missing.push("hear");
  if (!m.consent) missing.push("consent");
  return missing;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "ok" };
  }
  if (event.httpMethod !== "POST") return bad("Use POST");

  const body = readJson(event);
  if (body === null) return bad("Invalid JSON");

  const mapped = mapFields(body);

  // Honeypot: quietly succeed (bot), no email
  if (mapped.website && String(mapped.website).trim()) {
    return ok({ ok: true, skipped: true });
  }

  const missing = validate(mapped);
  if (missing.length) {
    console.error("Booking intake missing:", missing, {
      gotKeys: Object.keys(body || {}),
    });
    return bad(`Missing required field(s): ${missing.join(", ")}`, { missing });
  }

  const toCareers =
    mapped.notifyEmail ||
    process.env.BOOKING_RECEIVER ||
    process.env.TO_EMAIL ||
    "careers@seventattoolv.com";

  const fromEmail =
    process.env.SEND_FROM ||
    process.env.FROM_EMAIL ||
    "careers@seventattoolv.com";

  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (!sendgridKey) return oops("SENDGRID_API_KEY not configured");

  const transporter = nodemailer.createTransport({
    host: "smtp.sendgrid.net",
    port: 465,
    secure: true,
    auth: { user: "apikey", pass: sendgridKey },
  });

  const lines = [
    "Seven Tattoo — Vision Call / Booking Intake",
    `Submitted: ${new Date().toLocaleString()}`,
    "",
    `Full Name: ${mapped.fullName}`,
    `Email: ${mapped.email}`,
    `Phone: ${mapped.phone}`,
    mapped.artist ? `Requested Artist: ${mapped.artist}` : null,
    mapped.sourceLink ? `Source Link: ${mapped.sourceLink}` : null,
    "",
    "Meaning / Story:",
    mapped.meaning,
    "",
    `Placement: ${mapped.placement}`,
    `Scale: ${mapped.scale}`,
    `How did you hear about us?: ${mapped.hear}`,
    `Consent to review: ${mapped.consent ? "YES" : "NO"}`,
  ].filter(Boolean);

  const text = lines.join("\n");
  const subject = `New VISION CALL intake — ${mapped.fullName}`;

  try {
    // Send to Seven
    await transporter.sendMail({
      from: fromEmail,
      to: toCareers,
      subject,
      text,
      replyTo: mapped.email || undefined,
    });

    // Confirmation to applicant
    await transporter.sendMail({
      from: fromEmail,
      to: mapped.email,
      subject: "Seven Tattoo — We received your Vision Call request",
      text: `Hi ${mapped.fullName},

Thanks — we received your Vision Call request.

If it’s a fit, our team will reach out with next steps.

— Seven Tattoo`,
    });

    return ok({
      ok: true,
      deliveredTo: toCareers,
      usedFrom: fromEmail,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Booking intake mail error:", err?.response?.body || err);
    return oops("Email send failed");
  }
};
