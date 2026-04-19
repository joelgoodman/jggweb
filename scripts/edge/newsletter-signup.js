// Bunny Edge Script — newsletter signup + verification for joelgoodman.co
//
// Handles both halves of a DIY double opt-in flow on a single endpoint:
//
//   POST /   signup: generate token, store it in Bunny Object Storage,
//            send the confirmation email via Loops /transactional. No
//            contact is created yet.
//   GET  /   verify: read ?token=…&email=…, look up the token, call
//            Loops /contacts/create with the stored data, delete the
//            token, return an HTML confirmation page.
//
// We roll our own flow because Loops' API-level double opt-in is not yet
// available (only their Form endpoints support it). The transactional
// email template is expected to reference {{optInUrl}} and {{companyName}}.
//
// Env vars (set in Bunny → Compute → Edge Scripts → Environment):
//   LOOPS_API_KEY           — from Loops › Settings › API
//   LOOPS_TRANSACTIONAL_ID  — confirmation email template ID
//   LOOPS_MAILING_LIST      — mailing list ID to add the contact to
//   COMPANY_NAME            — brand name passed to the email template
//   SITE_URL                — comma-separated allowed origins, e.g.
//                             https://joelgoodman.co,http://localhost:8080
//   BUNNY_CDN_URL           — storage.bunnycdn.com
//   BUNNY_STORAGE_ZONE      — jggweb
//   BUNNY_API_KEY           — storage zone password (FTP & API Access)

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

const LOOPS_API_KEY = process.env.LOOPS_API_KEY;
const LOOPS_TRANSACTIONAL_ID = process.env.LOOPS_TRANSACTIONAL_ID;
const LOOPS_MAILING_LIST = process.env.LOOPS_MAILING_LIST;
const COMPANY_NAME = process.env.COMPANY_NAME || "joelgoodman.co";
const ALLOWED_ORIGINS = (process.env.SITE_URL || "https://joelgoodman.co")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const PRIMARY_SITE_URL = ALLOWED_ORIGINS[0] || "https://joelgoodman.co";
const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL;
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;   // 1 hour
const TOKEN_TTL = 24 * 60 * 60 * 1000;      // 24 hours

// ── CORS ────────────────────────────────────────────────────────────────
function corsHeaders(req) {
  const origin = req.headers.get("origin") || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : PRIMARY_SITE_URL;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(req, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// ── Bunny Object Storage helpers ────────────────────────────────────────
function storageUrl(path) {
  return `https://${BUNNY_CDN_URL}/${BUNNY_STORAGE_ZONE}/${path}`;
}

async function storagePut(path, data) {
  const res = await fetch(storageUrl(path), {
    method: "PUT",
    headers: { AccessKey: BUNNY_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Storage PUT ${res.status}`);
}

async function storageGet(path) {
  const res = await fetch(storageUrl(path), {
    headers: { AccessKey: BUNNY_API_KEY },
  });
  if (!res.ok) return null;
  return res.json();
}

async function storageDelete(path) {
  await fetch(storageUrl(path), {
    method: "DELETE",
    headers: { AccessKey: BUNNY_API_KEY },
  });
}

// ── Rate limit ──────────────────────────────────────────────────────────
async function checkAndUpdateRateLimit(ip) {
  if (!BUNNY_CDN_URL || !BUNNY_STORAGE_ZONE || !BUNNY_API_KEY) return true;
  const path = `newsletter-rate-limit/${ip}.json`;
  let timestamps = (await storageGet(path)) || [];
  const now = Date.now();
  timestamps = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW);
  if (timestamps.length >= RATE_LIMIT_MAX) return false;
  timestamps.push(now);
  await storagePut(path, timestamps);
  return true;
}

// ── Token ───────────────────────────────────────────────────────────────
function generateToken(length = 32) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < length; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
  return token;
}

// ── Loops calls ─────────────────────────────────────────────────────────
async function sendConfirmationEmail({ email, optInUrl }) {
  const res = await fetch("https://app.loops.so/api/v1/transactional", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOOPS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transactionalId: LOOPS_TRANSACTIONAL_ID,
      email,
      dataVariables: { optInUrl, companyName: COMPANY_NAME },
    }),
  });
  if (!res.ok) {
    let detail = "";
    try { detail = JSON.stringify(await res.json()); } catch (_) {}
    throw new Error(`Loops transactional ${res.status}: ${detail}`);
  }
}

async function createContact({ email, firstName, lastName, referrer }) {
  const payload = {
    email: email.toLowerCase().trim(),
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    source: "jggweb-newsletter",
    referrer: referrer || "direct",
    subscribed: true,
    mailingLists: LOOPS_MAILING_LIST ? { [LOOPS_MAILING_LIST]: true } : undefined,
  };
  const res = await fetch("https://app.loops.so/api/v1/contacts/create", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOOPS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  // 409 = already exists; treat as success.
  if (res.status === 409) return;
  if (!res.ok) {
    let detail = "";
    try { detail = JSON.stringify(await res.json()); } catch (_) {}
    throw new Error(`Loops contacts/create ${res.status}: ${detail}`);
  }
}

// ── Confirmation HTML (rendered for the GET verify flow) ───────────────
function htmlPage({ title, heading, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root {
    --bg: #faf8f4; --fg: #1b1b3a; --muted: #4a4b49;
    --accent: #966012; --accent-hover: #e09840;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #1c1e26; --fg: #f0ead8; --muted: #c8c0b0; --accent: #d4a04a; --accent-hover: #e8a84a; }
  }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg); color: var(--fg);
    font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    min-height: 100vh; display: grid; place-items: center; padding: 2rem;
    line-height: 1.55;
  }
  main { max-width: 32rem; text-align: center; }
  h1 {
    font-family: 'Instrument', Georgia, serif; font-weight: 400;
    font-size: clamp(1.8rem, 1.4rem + 1.6vw, 2.4rem); margin: 0 0 0.75rem;
  }
  p { color: var(--muted); margin: 0 0 1.5rem; }
  a.button {
    display: inline-block; padding: 0.75rem 1.5rem;
    font-size: 0.8rem; font-weight: 700; letter-spacing: 0.14em;
    text-transform: uppercase; text-decoration: none;
    color: var(--bg); background: var(--accent); border-radius: 4px;
    transition: background 0.15s ease;
  }
  a.button:hover { background: var(--accent-hover); }
</style>
</head>
<body>
<main>
  <h1>${heading}</h1>
  ${body}
  <p><a class="button" href="${PRIMARY_SITE_URL}">Back to ${COMPANY_NAME}</a></p>
</main>
</body>
</html>`;
}

function htmlResponse(status, { title, heading, body }) {
  return new Response(htmlPage({ title, heading, body }), {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// ── Handlers ────────────────────────────────────────────────────────────
async function handleSignup(req) {
  const form = await req.formData();
  const email = (form.get("email") || "").toString().trim();
  const firstName = (form.get("firstName") || "").toString().trim();
  const lastName = (form.get("lastName") || "").toString().trim();
  const honeypot = (form.get("website") || "").toString();
  const timestamp = parseInt(form.get("formTimestamp") || "0", 10);
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";
  const referrer = req.headers.get("referer") || "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(req, 400, { error: "A valid email is required." });
  }
  if (honeypot.trim() !== "") return json(req, 400, { error: "Spam detected." });
  if (timestamp && Date.now() - timestamp < 2000) {
    return json(req, 400, { error: "Form submitted too quickly." });
  }

  const allowed = await checkAndUpdateRateLimit(ip);
  if (!allowed) return json(req, 429, { error: "Too many signups from this IP. Please try again later." });

  try {
    const token = generateToken();
    const expiresAt = Date.now() + TOKEN_TTL;
    await storagePut(`newsletter-tokens/${token}.json`, {
      email, firstName, lastName, referrer, expiresAt, ip,
    });

    // The opt-in URL points back at this same endpoint with GET.
    const reqUrl = new URL(req.url);
    const base = `${reqUrl.protocol}//${reqUrl.host}${reqUrl.pathname}`;
    const optInUrl = `${base}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    await sendConfirmationEmail({ email, optInUrl });
    return json(req, 200, { success: true });
  } catch (err) {
    return json(req, 500, { error: "Subscription failed. Please try again later." });
  }
}

async function handleVerify(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const email = url.searchParams.get("email");

  if (!token || !email) {
    return htmlResponse(400, {
      title: "Invalid link",
      heading: "That link isn't valid",
      body: "<p>The confirmation link is missing required data. Try subscribing again.</p>",
    });
  }

  const path = `newsletter-tokens/${token}.json`;
  const data = await storageGet(path);

  if (!data || data.email !== email) {
    return htmlResponse(400, {
      title: "Link expired",
      heading: "This link is no longer valid",
      body: "<p>The confirmation link has already been used or doesn't match. Try subscribing again.</p>",
    });
  }
  if (Date.now() > data.expiresAt) {
    await storageDelete(path);
    return htmlResponse(400, {
      title: "Link expired",
      heading: "This link has expired",
      body: "<p>Confirmation links are valid for 24 hours. Please subscribe again to get a fresh link.</p>",
    });
  }

  try {
    await createContact({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      referrer: data.referrer,
    });
    await storageDelete(path);
    return htmlResponse(200, {
      title: "You're subscribed",
      heading: "You're in.",
      body: `<p>Thanks for confirming${data.firstName ? `, ${data.firstName}` : ""}. New letters will land in your inbox when I publish them.</p>`,
    });
  } catch (err) {
    return htmlResponse(500, {
      title: "Something went wrong",
      heading: "We couldn't finish your subscription",
      body: "<p>Please try subscribing again. If the problem persists, get in touch.</p>",
    });
  }
}

// ── Router ──────────────────────────────────────────────────────────────
BunnySDK.net.http.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method === "POST") return handleSignup(req);
  if (req.method === "GET")  return handleVerify(req);
  return json(req, 405, { error: "Method not allowed" });
});
