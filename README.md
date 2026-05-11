# DotSpy — Email Open Tracking System

## Overview

DotSpy is a web-based email open tracking system built as a personal experiment to understand how pixel tracking technology works in email communication. The project started with a personal curiosity about the invisible tracking methods used by marketing platforms and threat actors alike, and evolved into a practical, production-grade business tool for measuring email engagement.

---

## The Experiment

The core research question was simple: **can a sender know whether a recipient opened an email, without the recipient knowing?**

The answer is yes — through a technique called **pixel tracking** (also known as a web beacon or tracking pixel). A 1×1 transparent GIF image is embedded invisibly inside an HTML email. When the email is opened and the client renders the HTML, it fetches the image from a remote server. That HTTP request carries metadata — IP address, user agent, timestamp, language — which the server records before returning the image.

### What We Observed

| Data Point | Collected | Notes |
|---|---|---|
| Open timestamp | Yes | Millisecond precision |
| IP address | Yes | Approximated to city/region level |
| Approximate location | Yes | Via IP geolocation (ipapi.co) |
| OS and device type | Yes | Parsed from User-Agent header |
| Email client | Yes | Detected from User-Agent patterns |
| Preferred language | Yes | From Accept-Language header |
| MAC address | No | Not exposed beyond local network |
| Exact identity | No | Only email address known from send |

These data points were mapped against a reference table to personally validate what is and is not technically feasible from a single pixel fetch.

---

## Evolution of the Project

### Phase 1 — Proof of Concept (Attack Mode)

The first version was experimental and adversarial in framing. The goal was to personally verify that a pixel fetch actually captures real metadata.

- A single serverless function served a 1×1 GIF and logged all incoming headers to an in-memory array.
- A second endpoint returned those logs as JSON.
- A basic HTML page displayed the raw collected data in a table.
- Emails were crafted manually with the pixel URL embedded.

**Findings:** Every email client behaved differently. Gmail routes all image fetches through Google's own proxy (`GoogleImageProxy`), masking the recipient's real IP. Thunderbird and Outlook Desktop fetch images directly, exposing the real IP and OS. Apple Mail's privacy protection caches images through Apple's servers. This variation was a key personal discovery — the effectiveness of pixel tracking is entirely dependent on the recipient's email client configuration.

### Phase 2 — Infrastructure Challenges

The in-memory approach hit a fundamental serverless architecture constraint: Vercel deploys each API file as an isolated Lambda function, meaning two different files cannot share memory. The pixel-recording function and the data-reading function lived in separate processes — so data written by one was invisible to the other.

**Solution:** Both handlers were merged into a single file (`api/tracker.js`) and both URL paths were routed to it via `vercel.json` rewrites. This ensured both requests landed in the same process, sharing the same `globalThis` array.

This was an important lesson in how serverless platforms differ fundamentally from traditional long-running servers.

### Phase 3 — Spam Filter Analysis

Early test emails were consistently delivered to the spam folder. Investigation identified the cause: sending an email with only an `html:` body and no `text:` plain-text alternative is a strong spam signal. Modern spam filters (Gmail, Outlook) apply significant penalties to HTML-only emails.

**Fix:** Every outgoing email was given a matching plain-text `text:` alternative, a proper display-name `From:` header, and a `Reply-To:` field. Spam delivery dropped to zero in subsequent tests.

### Phase 4 — From Attack Tool to Productive Business Application

The pivot from personal experiment to practical tool required rethinking the data model entirely.

The raw tracking data (IP, OS, email client, language) was interesting to explore but had no business value for a company tracking client engagement. What a business needs is simpler: **did this specific person, at this specific company, open the email I sent them?**

This reframing drove the final architecture:

- All raw tracking metadata was removed from storage.
- A PostgreSQL database replaced the in-memory array — persistent, queryable, deployable to Supabase.
- The data model became a single `emails` table: company, recipient, subject, body, status (`PENDING` / `OPENED`), timestamps.
- The UI became a proper business dashboard: stat cards, a Chart.js time-series chart (week/month/year), and a paginated email log.

The tracking pixel still fires on open, but now it does only one thing: flip a row in the database from `PENDING` to `OPENED`.

### Phase 5 — Production Hardening

Several real-world deployment issues were encountered and resolved:

- **Vercel environment variables** do not take effect until a new deployment is triggered. Changing a variable in the dashboard does not redeploy.
- **Supabase direct connection** (`db.[ref].supabase.co:5432`) cannot be reached from Vercel serverless functions. The **Transaction Pooler** URL (`*.pooler.supabase.com:6543`) must be used instead, as it is designed for short-lived connections.
- **`PIXEL_BASE_URL`** must be explicitly set to the canonical production URL. Relying on `VERCEL_URL` (which changes per deployment) causes pixel URLs baked into already-sent emails to break on the next deploy.
- **`pg.Pool` reuse** across warm Lambda invocations was implemented via `globalThis._pgPool` to avoid exhausting the database connection limit.

---

## Approaches Taken

| Approach | Decision | Reason |
|---|---|---|
| Serverless (Vercel) | Adopted | Zero infrastructure management, free tier sufficient |
| In-memory state | Abandoned | Cannot survive across serverless function instances |
| Single combined handler | Adopted | Shared process = shared memory for in-memory phase |
| PostgreSQL via Supabase | Adopted | Persistent, scalable, free tier, native SQL |
| Transaction Pooler (port 6543) | Required | Serverless functions need pooled, not persistent, connections |
| `pg` client (no ORM) | Adopted | Minimal overhead, full SQL control, small bundle |
| Chart.js via CDN | Adopted | No build step needed, zero install, sufficient for dashboard |
| Vanilla HTML/CSS/JS | Adopted | No framework overhead for a single-page dashboard |
| Plain-text email alternative | Required | Prevents spam classification by mail filters |

---

## Key Gains

**Technical:**
- Deep understanding of how HTTP metadata leaks identity information through image requests.
- Serverless architecture constraints and how shared state must be handled differently from monolithic servers.
- Email delivery mechanics: MIME multipart structure, spam filter heuristics, SMTP authentication.
- PostgreSQL connection management in a serverless context (pooling, SSL, connection reuse).
- CI/CD with GitHub → Vercel for zero-downtime deployments.

**Personal Discoveries:**

- Hands-on confirmation that email client choice determines what a tracker can actually learn.
- Gmail's proxy completely shields recipient IP and OS, making its user base the hardest to profile.
- Email tracking operates in a legal and ethical grey area — many jurisdictions now require consent (GDPR, CAN-SPAM).
- The same technique used for surveillance is the backbone of every major email marketing platform (Mailchimp, HubSpot, SendGrid all use tracking pixels).

---

## From Attack to Product

The evolution of DotSpy mirrors a broader pattern in security research: understanding an attack vector deeply enough to build defenses against it — or, in this case, to repurpose it into a legitimate business tool.

| Dimension | Attack Mode (Phase 1–2) | Product Mode (Phase 4–5) |
|---|---|---|
| Purpose | Covert recipient surveillance | Transparent business engagement tracking |
| Data collected | IP, OS, device, language, location | Open status (boolean) + timestamp only |
| Storage | Volatile in-memory array | Persistent PostgreSQL database |
| UI | Raw data dump table | Business dashboard with charts |
| Email context | Anonymous test emails | Branded company emails with recipient name |
| Longevity | Session-only | Permanent record per email |

The attack mode reveals what is *possible*. The product mode reveals what is *useful*. The gap between the two defines the design decisions that turn a proof-of-concept into something deployable.

---

## Technologies

| Technology | Role |
|---|---|
| **Node.js** (ES Modules) | Server-side runtime for all API handlers |
| **Vercel** | Serverless deployment platform, CI/CD via GitHub integration |
| **PostgreSQL** | Relational database for persistent email records |
| **Supabase** | Managed PostgreSQL hosting with connection pooler |
| **`pg` (node-postgres)** | PostgreSQL client library |
| **Nodemailer** | SMTP email sending via Gmail App Passwords |
| **Chart.js** | Time-series chart for the dashboard (CDN, no build step) |
| **Vanilla HTML / CSS / JS** | Single-page dashboard UI, no framework |
| **ipapi.co** | Free IP geolocation API (used in research phase) |
| **Gmail SMTP + App Passwords** | Email delivery without OAuth complexity |
