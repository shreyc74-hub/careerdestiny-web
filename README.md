# Career Destiny

**AI career advisor that reads your Vedic birth chart and tells you whether you're built for a job or a business — and when your breakthrough comes.**

🔗 Live: **[careerdestiny.in](https://careerdestiny.in)** · English + हिन्दी

---

## The problem

Career astrology is a huge, trusted category in India: millions of people consult an astrologer before switching jobs, starting a business or choosing a field. But the experience is broken:

- **Expensive and slow.** A personal consultation costs real money and often takes days to book.
- **Inconsistent.** Two astrologers reading the same chart often give different answers, and there's no way to check the reasoning.
- **Generic AI doesn't work either.** Ask a general chatbot about your chart and it will happily invent planetary positions, dasha dates and yogas that aren't in your chart.

Career Destiny gives a structured, consistent career reading in about a minute, shows *why* the chart points where it does, and lets you keep asking follow-up questions — grounded in your actual chart, not made-up astrology.

---

## How it works

```
 Birth details (date, time, place)
            │
            ▼
 ┌─────────────────────┐      ┌──────────────────────────────┐
 │ Geocoding           │─────▶│ Prokerala Astrology API      │
 │ Photon / Nominatim  │      │ D1 planets, dashas, D9, D10, │
 └─────────────────────┘      │ transits, yogas, chart SVGs  │
                              └──────────────┬───────────────┘
                                             ▼
                         ┌────────────────────────────────────────┐
                         │ Deterministic rule engine (JavaScript) │
                         │ • 7 "Sapta Sutri" job-vs-business tests│
                         │ • 14 career rules, planet dignity,     │
                         │   yogas, Amatyakaraka, career-field map│
                         │ • Final verdict computed here, not by  │
                         │   the LLM                              │
                         └──────────────────┬─────────────────────┘
                                            ▼  structured [CHART DATA] block
                    ┌───────────────────────────────────────────────────┐
                    │ Claude (via /api/analyze serverless function)     │
                    │ CALL 1  Sonnet  → Verdict, Sections 1–3           │
                    │ CALL 2  Haiku   → Sections 4–7 (yogas, fields)    │
                    │ CALL 3  Haiku   → Sections 8–11 (timing, transits)│
                    │ CALL 4  Sonnet  → Follow-up chat                  │
                    └──────────────────┬────────────────────────────────┘
                                       ▼
      Results screen (instant JS verdict) → 11-section report fills in → chat
      → optional PDF report by email · saved profiles & chats for signed-in users
```

1. **Input.** The user enters date, time and place of birth. The place is geocoded (`api/geocode.js`).
2. **Astronomy.** `api/chart.js` calls the Prokerala API (OAuth client-credentials token, cached and de-duplicated across concurrent requests) for planet positions, dasha periods, the D9 and D10 divisional charts, current transits and yogas.
3. **Rule engine.** `preCompute()` in `public/index.html` turns raw positions into facts: the seven job-vs-business tests, 14 career rules, planet dignity, detected yogas, the 2-6-10-11 wealth-house connections and a career-field map. **The verdict and score (e.g. `BUSINESS — 6/7`) are computed here in code.**
4. **Instant result.** The results screen renders immediately from the rule engine's output, while the LLM report generates in the background.
5. **LLM report.** Three Claude calls write the 11-section report. Each receives the same pre-computed `[CHART DATA]` block.
6. **Chat.** The user can ask follow-up questions; answers are grounded in the chart data plus the generated report.
7. **Delivery.** The report can be rendered to PDF (headless Chromium) and emailed via Resend. Signed-in users get saved birth profiles, saved chats and cached analyses (Supabase).

---

## Where AI is used

All LLM traffic goes through one serverless function, [`api/analyze.js`](api/analyze.js), which calls the Anthropic Messages API directly (no SDK). The API key lives only in Vercel environment variables.

### Design principle: the LLM explains, code decides

The core reliability problem with astrology + LLMs is hallucination: models invent positions and dates. So the split is deliberate:

| Done in code (deterministic) | Done by Claude (language) |
|---|---|
| Planet positions, dashas, divisional charts (Prokerala) | Explaining what the chart means in plain English/Hindi |
| Job-vs-business scoring and the final verdict | Turning rule outputs into a readable, personal narrative |
| Yoga detection, planet dignity, career-field mapping | Prioritising what matters for *this* person |
| Which dasha period is current (marked `[CURRENT]`) | Answering open-ended follow-up questions |

The prompt tells the model the pre-computed values are authoritative: *"Use JS VERDICT as your verdict. Do not recount or override."*

### The LLM calls

| Call | Model | Max tokens | Output |
|---|---|---|---|
| **CALL 1** | `claude-sonnet-4-6` | 1,500 | Verdict + Sections 1–3 (who you are, wealth picture, job vs business) |
| **CALL 2** | `claude-haiku-4-5` | 1,800 | Sections 4–7 (yogas, how you earn, career fields, strengths) |
| **CALL 3** | `claude-haiku-4-5` | 1,200 | Sections 8–11 (dasha periods, timing windows, current transits, next step) |
| **CALL 4 – chat** | `claude-sonnet-4-6` | 800 | Follow-up answers |
| **translate** | `claude-haiku-4-5` | 1,200 | Re-renders already-shown text when the user switches English ↔ Hindi |

All calls run at `temperature: 0`, so the same chart gives the same reading. Sonnet handles the calls where accuracy is most visible (the verdict and free-form chat); Haiku handles the more templated sections, which keeps cost and latency down.

**Why split the report into three calls?** One long call was slow and would get cut off at the token limit. Splitting by section lets the first part appear quickly, keeps each prompt focused, and lets the chat answer a question as soon as the relevant section exists.

### Prompting

- **Shared base prompt** (`BASE`): persona, house-number rules, how planets map to traditional vs modern fields, a "minimum 5 of 14 rules must support a career suggestion" threshold, tone rules, and a strict `--- SECTION N — TITLE ---` output format that the frontend parses into report cards.
- **Per-call prompts** (`CALL1`, `CALL2`, `CALL3`): exact output templates for each section.
- **Chat prompt** (`CHAT_SYSTEM`) with explicit guardrails, each added after a real failure seen in production:
  - Never invent a position, house, degree or date — if it's not in the chart data, say so.
  - Don't borrow a planet's meaning from the wrong house (e.g. reading Venus-in-7th as a career signal).
  - Don't tell users to "scroll up" to report text they haven't actually seen in the chat.
- **Language** is appended per request: Hindi responses use respectful *aap* forms and a senior-advisor tone; Hinglish input is detected and answered in Hindi.

### Grounding / retrieval

There is no vector database. Retrieval is **structured context injection**: every call receives a `[CHART DATA] … [END CHART DATA]` block built by the rule engine, containing chart positions, the pre-computed scores and rules, the current dasha periods, and (for chat) the generated report. This keeps answers tied to a single, verifiable source of truth per user.

### Chat orchestration

Not an autonomous agent, but a small routing layer in `sendChat()`:

1. **Intent detection** (`detectIntent`) classifies the question: timing → needs CALL 3, career/field → needs CALL 2, identity/verdict → CALL 1, general.
2. If the needed report section is still generating, the chat tells the user and **waits for that call to finish** before answering, rather than answering without the data.
3. Context sent to the model: chart data + generated report + the **last 8 chat turns** (older history is trimmed to control tokens).

### Cost and latency controls

- Model tiering (Sonnet for verdict and chat, Haiku for templated sections and translation).
- Per-call token caps.
- **Analysis cache:** for signed-in users, a repeat lookup of the same birth details skips Prokerala and all three Claude calls and loads the saved analysis from Supabase.
- Prokerala requests are batched with short pauses to stay inside rate limits.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Single-page app in vanilla HTML/CSS/JavaScript (`public/index.html`), no framework or build step |
| Backend | Vercel serverless functions (Node.js) in `api/` |
| LLM | Anthropic Claude — Sonnet 4.6 and Haiku 4.5 via the Messages API |
| Astrology data | Prokerala Astrology API v2 |
| Geocoding | Photon (Komoot) and OpenStreetMap Nominatim |
| Auth & database | Supabase (Auth + Postgres via REST, row-level security) — tables `profiles`, `chart_analyses`, `chat_sessions`, `leads`, `lead_messages` |
| PDF generation | Puppeteer Core + `@sparticuz/chromium-min` (headless Chromium on serverless) |
| Email | Resend |
| Analytics | Google Analytics 4 (custom events across the funnel) + Google Sheets via Apps Script for lead logging |
| Admin | Internal dashboard (`public/admin.html`, `api/admin.js`) for leads, chat sessions and users; server-side admin verification, service-role key never sent to the browser |
| Hosting | Vercel |

### Repository layout

```
api/
  analyze.js      All Claude calls: prompts, model routing, translation
  chart.js        Prokerala proxy: planets, dashas, D9/D10, transits, chart SVGs
  divisional.js   Divisional chart helpers
  panchang.js     Daily panchang
  geocode.js      Place search
  email.js        Render report to PDF and email it (Resend)
  pdf.js          PDF rendering endpoint
  admin.js        Admin API (service-role Supabase access)
  _adminAuth.js   Verifies the caller is the admin account
public/
  index.html      The app: UI, rule engine, chat, auth, analytics
  admin.html      Admin dashboard
vercel.json       Function memory/timeout configuration
```

### Running locally

```bash
npm install
npm i -g vercel
vercel dev
```

Required environment variables (set in Vercel → Settings → Environment Variables; never commit them):

| Variable | Used by |
|---|---|
| `ANTHROPIC_API_KEY` | `api/analyze.js` |
| `PROKERALA_CLIENT_ID`, `PROKERALA_CLIENT_SECRET` | `api/chart.js`, `api/divisional.js`, `api/panchang.js` |
| `RESEND_API_KEY` | `api/email.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | `api/admin.js` |

---

## Traction

Live with real users since mid-2026. From Google Analytics:

- **~47 new visitors** in a recent 28-day window.
- **22 users** have used the follow-up chat, sending **208 messages** — about **9–10 questions per user**, a sign people keep exploring after the report.
- Every reading is logged as a lead (Supabase + Google Sheets), and the full funnel — form start → analysis → results → chat → email report — is instrumented with GA4 events.

---

## How I built it

I built and shipped Career Destiny as a solo builder using **AI coding tools — primarily Claude and Claude Code** — as my engineering team.

- **From idea to production:** the first commit was on 28 May 2026; the app has since gone through 140+ commits covering the rule engine, multi-call report pipeline, bilingual chat, accounts and saved data, PDF/email delivery, analytics and an admin panel.
- **How I worked with AI:** I owned the product, the astrology methodology and the decisions; Claude did much of the implementation. Later work ran through Claude Code against this GitHub repo, with changes landing as reviewed pull requests (e.g. fixing chat messages dropped by an auth routing mismatch, a race condition in anonymous lead saving, and session validation on page load).
- **Prompt engineering in a loop:** the chat guardrails in `CHAT_SYSTEM` came from reading real conversations, finding failure modes (invented dates, a planet's meaning taken from the wrong house, references to text the user hadn't seen) and writing a specific rule for each.
- **Shipping discipline:** debugging production issues from analytics and logs, keeping secrets out of the codebase, and splitting work so that what must be correct is computed in code and what must be readable is written by the model.

---

*Career Destiny is an astrology product for guidance and reflection; it is not financial or career advice.*
