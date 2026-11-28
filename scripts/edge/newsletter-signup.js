// Bunny Edge Script — bot-filtering proxy in front of Loops' newsletter
// Form endpoint for joelgoodman.co.
//
// Loops' Form endpoint (https://app.loops.so/api/newsletter-form/<id>) is a
// public, unauthenticated URL with no bot protection of its own — Loops
// expects the site embedding a form to add that layer. Posting to it
// directly from the browser (as this form briefly did) means anyone who
// finds that URL in the page source can POST straight to it, bypassing any
// client-side checks entirely. That's what happened here: a bot hammered
// the raw Loops endpoint at ~2/min with fake "Test User" signups, and the
// resulting bounces/spam complaints from Loops' own opt-in confirmation
// email (sent to each fake address) got sending shut down.
//
// This script sits between the public form and Loops: it validates the
// submission (honeypot, timing, disposable-domain, placeholder-name,
// optional Turnstile, rate limiting) and only forwards requests that pass
// to Loops' Form endpoint, server-to-server. It does not send any email or
// generate any link itself — Loops still owns the confirmation email from
// its own domain, so this doesn't reintroduce the phishing-flagged-link
// problem that the previous DIY token/email flow had.
//
// Env vars (set in Bunny → Compute → Edge Scripts → Environment):
//   LOOPS_FORM_ID           — the ID from Loops' Form endpoint URL
//                             (https://app.loops.so/api/newsletter-form/<id>
//                             — Loops → Forms → Settings → Form Endpoint).
//                             Required — if the previous ID leaked to a bot,
//                             get a fresh one from Loops support and use
//                             that here instead of reusing it.
//   SITE_URL                — comma-separated allowed origins, e.g.
//                             https://joelgoodman.co,http://localhost:8080
//   BUNNY_CDN_URL           — storage.bunnycdn.com
//   BUNNY_STORAGE_ZONE      — jggweb
//   BUNNY_API_KEY           — storage zone password (FTP & API Access)
//   TURNSTILE_SECRET_KEY    — optional. If set, a Cloudflare Turnstile
//                             token (field "cf-turnstile-response") is
//                             required and verified server-side. Pairs with
//                             site.newsletter.turnstileSiteKey in the
//                             front-end form. If unset, Turnstile checking
//                             is skipped entirely.

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

const LOOPS_FORM_ID = process.env.LOOPS_FORM_ID;
const LOOPS_FORM_URL = LOOPS_FORM_ID ? `https://app.loops.so/api/newsletter-form/${LOOPS_FORM_ID}` : null;
const ALLOWED_ORIGINS = (process.env.SITE_URL || "https://joelgoodman.co")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const PRIMARY_SITE_URL = ALLOWED_ORIGINS[0] || "https://joelgoodman.co";
const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL;
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

const IP_RATE_LIMIT_MAX = 5;
const IP_RATE_LIMIT_WINDOW = 60 * 60 * 1000;       // 1 hour per IP
const GLOBAL_RATE_LIMIT_MAX = 10;
const GLOBAL_RATE_LIMIT_WINDOW = 10 * 60 * 1000;   // 10 signups / 10 min site-wide

// Not exhaustive — covers common disposable/temp-mail providers. Extend as
// new ones show up in abuse traffic.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "temp-mail.org", "throwawaymail.com", "yopmail.com", "trashmail.com",
  "getnada.com", "fakeinbox.com", "sharklasers.com", "dispostable.com",
  "maildrop.cc", "mintemail.com", "spamgourmet.com", "moakt.com",
  "emailondeck.com", "mohmal.com", "discard.email", "mailnesia.com",
  "33mail.com", "guerrillamailblock.com", "tempinbox.com",
]);

// Exact firstName+lastName pairs seen from bot scripts (case-insensitive).
// Cheap, targeted block — not a substitute for the checks above, but free.
const PLACEHOLDER_NAMES = new Set([
  "test user", "john doe", "jane doe", "foo bar", "test test", "asdf asdf",
]);

// ── CORS ────────────────────────────────────────────────────────────────
function corsHeaders(req) {
  const origin = req.headers.get("origin") || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : PRIMARY_SITE_URL;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
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

// ── Bunny Object Storage helpers (rate-limit counters only) ─────────────
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

// ── Rate limits ─────────────────────────────────────────────────────────
async function checkAndUpdateWindow(path, max, windowMs) {
  if (!BUNNY_CDN_URL || !BUNNY_STORAGE_ZONE || !BUNNY_API_KEY) return true;
  let timestamps = (await storageGet(path)) || [];
  const now = Date.now();
  timestamps = timestamps.filter((ts) => now - ts < windowMs);
  if (timestamps.length >= max) return false;
  timestamps.push(now);
  await storagePut(path, timestamps);
  return true;
}

function checkAndUpdateIpRateLimit(ip) {
  return checkAndUpdateWindow(`newsletter-rate-limit/${ip}.json`, IP_RATE_LIMIT_MAX, IP_RATE_LIMIT_WINDOW);
}

function checkAndUpdateGlobalRateLimit() {
  return checkAndUpdateWindow("newsletter-rate-limit/_global.json", GLOBAL_RATE_LIMIT_MAX, GLOBAL_RATE_LIMIT_WINDOW);
}

// ── Bot signal checks ──────────────────────────────────────────────────
function isDisposableDomain(email) {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return !!domain && DISPOSABLE_DOMAINS.has(domain);
}

function isPlaceholderName(firstName, lastName) {
  const pair = `${firstName} ${lastName}`.toLowerCase().trim();
  return PLACEHOLDER_NAMES.has(pair);
}

async function verifyTurnstile(token, ip) {
  if (!TURNSTILE_SECRET_KEY) return true; // not configured — skip
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
  });
  if (!res.ok) return false;
  const data = await res.json().catch(() => null);
  return !!data?.success;
}

// ── Forward to Loops ───────────────────────────────────────────────────
const FORWARD_FIELDS = [
  "email", "firstName", "lastName", "mailingLists",
  "sourcePage", "utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm",
];

async function forwardToLoops(form) {
  const payload = new URLSearchParams();
  for (const key of FORWARD_FIELDS) {
    const val = form.get(key);
    if (val != null && val !== "") payload.set(key, val.toString());
  }
  const res = await fetch(LOOPS_FORM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
  });
  let body = {};
  try { body = await res.json(); } catch (_) { /* non-JSON error body */ }
  return { status: res.status, body };
}

// ── Handler ─────────────────────────────────────────────────────────────
async function handleSignup(req, form) {
  if (!LOOPS_FORM_URL) {
    return json(req, 500, { message: "Signup is temporarily unavailable. Please try again later." });
  }

  const email = (form.get("email") || "").toString().trim();
  const firstName = (form.get("firstName") || "").toString().trim();
  const lastName = (form.get("lastName") || "").toString().trim();
  const honeypot = (form.get("website") || "").toString();
  const timestamp = parseInt(form.get("formTimestamp") || "", 10);
  const turnstileToken = (form.get("cf-turnstile-response") || "").toString();
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(req, 400, { message: "A valid email is required." });
  }
  if (honeypot.trim() !== "") return json(req, 400, { message: "Spam detected." });
  // Fail closed: a genuine browser submission always includes formTimestamp
  // (jgg.js sets it on load), so treat a missing/omitted value as suspicious
  // rather than skipping the check — a request built by hand to POST here
  // directly wouldn't know to include it.
  if (!timestamp || Date.now() - timestamp < 2000) {
    return json(req, 400, { message: "Please wait a moment before submitting." });
  }
  if (isDisposableDomain(email)) {
    return json(req, 400, { message: "Please use a permanent email address." });
  }
  if (isPlaceholderName(firstName, lastName)) {
    return json(req, 400, { message: "Something went wrong. Please try again." });
  }
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return json(req, 400, { message: "Verification failed. Please try again." });
  }

  const ipAllowed = await checkAndUpdateIpRateLimit(ip);
  if (!ipAllowed) return json(req, 429, { message: "Too many signups from this IP. Please try again later." });

  const globalAllowed = await checkAndUpdateGlobalRateLimit();
  if (!globalAllowed) return json(req, 429, { message: "Too many signups right now. Please try again in a little while." });

  try {
    const { status, body } = await forwardToLoops(form);
    return json(req, status, body);
  } catch (err) {
    return json(req, 500, { message: "Subscription failed. Please try again later." });
  }
}

// ── Router ──────────────────────────────────────────────────────────────
BunnySDK.net.http.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method === "POST") {
    const form = await req.formData();
    return handleSignup(req, form);
  }
  return json(req, 405, { message: "Method not allowed" });
});
