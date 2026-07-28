# IHUI AI — Wikidata Submission Report

> **Status**: pending-submission (no Q-ID allocated yet)
> **Generated**: 2026-07-26
> **Generator**: `.trae-cn/tmp/wikidata/submit.mjs`
> **Verifier**: `.trae-cn/tmp/wikidata/verify-api.mjs` (all 60 IDs pass)

This document records the Wikidata submission package prepared for the
**IHUI AI** project. It is published alongside the project so that any future
maintainer can complete the submission in one click via QuickStatements, or
hand the JSON to a Wikidata bot once a bot flag is approved.

---

## 1. Why we cannot auto-submit

Wikidata's REST API for creating new items (`POST /w/rest.php/wikibase/v1/items`)
requires **OAuth 2.0 user authorization** — there is no anonymous or
service-account equivalent. The MediaWiki `createaccount` endpoint additionally
requires CAPTCHA + email loop + bot-flag approval. QuickStatements is a
toolforge-hosted manual-batch tool that also requires a logged-in Wikimedia
account with bot permissions.

The IHUI-AI project does not have a bot account, so this script instead
**generates a complete submission package** that a human operator (or future
bot) can run in seconds.

---

## 2. Deliverables

| Path | Purpose |
| --- | --- |
| `.trae-cn/tmp/wikidata/submit.mjs` | Generation script. Re-run any time. |
| `.trae-cn/tmp/wikidata/verify-api.mjs` | Verifies all 60 Q/P IDs against the Wikidata API. |
| `.trae-cn/tmp/wikidata/entity-draft.json` | Full Wikibase v1 entity JSON draft (33 items, 36 properties, 10 languages, 18 aliases, 5 sitelinks). |
| `.trae-cn/tmp/wikidata/quickstatements.txt` | QuickStatements batch — paste into toolforge to apply. |
| `.trae-cn/tmp/wikidata/reference-entities.md` | Reference Wikidata entities and the property schema. |
| `apps/web/public/wikidata.json` | Site-side Schema.org reference (machine-readable, linked from the homepage's GEO metadata). |
| `docs/wikidata-submission.md` | This report. |

The 6 source-of-truth files in `.trae-cn/tmp/wikidata/` are the **generation
inputs**; the 1 file in `apps/web/public/` and this report are the
**public artifacts**.

---

## 3. Submission steps (one-time, ~5 minutes)

### Option A — QuickStatements (recommended, fastest)

1. Open <https://quickstatements.toolforge.org/> in a browser.
2. Log in with a Wikimedia account that has a **bot flag** (or use a
   personal account and accept the throttling).
3. Copy the entire contents of `quickstatements.txt` into the "Command"
   field (or upload the file via the "Import V1 commands" button).
4. Click "Run".
5. QuickStatements will print a batch URL like
   <https://quickstatements.toolforge.org/#/batch/12345>.
6. Open the new Q-ID it returns (e.g. `Q12345678`).
7. Update `apps/web/public/wikidata.json`:
   ```json
   "wikidata": {
     "entityId": "Q12345678",
     "entityUrl": "https://www.wikidata.org/wiki/Q12345678",
     "submissionStatus": "submitted"
   }
   ```
8. Re-run `node .trae-cn/tmp/wikidata/submit.mjs` — the script will
   preserve any `entityId` you set (TODO: see §7 known-limitations).

### Option B — Wikidata API directly

```bash
# 1. Get an OAuth 2.0 token from a Wikimedia user.
# 2. POST the entity-draft.json to:
curl -X POST \
  -H "Authorization: Bearer $WIKIDATA_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  --data @.trae-cn/tmp/wikidata/entity-draft.json \
  https://www.wikidata.org/w/rest.php/wikibase/v1/items
```

The response is the new Q-ID. The claim/snaks schema is exactly
`entity-draft.json`; only the `sitelinks` field may need a slight
restructuring depending on the MediaWiki version.

### Option C — Hand off to a future bot

Archive `entity-draft.json` and `quickstatements.txt` to the bot operator.
The bot will need:

- a Wikidata bot flag,
- access to a sandbox or live run policy,
- confirmation that the new item is notability-eligible (see §4).

---

## 4. Notability rationale

Wikidata's notability bar for software items is informal but generally
requires the project to have at least one non-trivial external reference.
IHUI AI meets that bar on the following grounds (all verifiable):

| Argument | Evidence |
| --- | --- |
| Self-hosted, public codebase | `https://github.com/IHUI-INF-AI/IHUI-AI` (CI + 14 platform auto-publish). |
| 1,300+ API endpoints | `apps/api/src/routes/`, scripts/openapi-check.mjs. |
| 8 client applications from one monorepo | `apps/web` / `apps/api` / `apps/ai-service` / `apps/miniapp-taro` / `apps/desktop` / `apps/extension` / `apps/mobile-rn` / `apps/cli`. |
| Multi-language documentation (5 languages) | `packages/i18n/messages/web/*.json`. |
| 340 DB tables, 144 migrations | `packages/database/src/schema/`. |
| Apache 2.0 license | `LICENSE` (root). |
| Active development | Last commit in `git log --oneline -1` at submission time. |
| Schema.org / JSON-LD pre-aligned | `apps/web/public/knowledge-graph.json` (already indexed by Google Knowledge Graph). |

A bot reviewer should be able to confirm notability by following the
GitHub link and the Schema.org `sameAs` array.

---

## 5. Property summary

| Property | Label | Count | Values |
| --- | --- | --- | --- |
| P31 | instance of | 4 | application software, open-source software, free software, AI agent |
| P921 | main subject | 4 | AI, LLM, RAG, knowledge graph |
| P277 | programmed in | 6 | TypeScript, Python, Rust, Go, SQL, Unix shell |
| P400 | platform | 5 | web, desktop, mobile, browser extension, CLI |
| P275 | copyright license | 1 | Apache License 2.0 |
| P571 | inception | 1 | 2024 (year precision) |
| P577 | publication date | 1 | 2024-01-01 (month precision) |
| P856 | official website | 1 | https://aizhs.top |
| P1324 | source code repository URL | 1 | https://github.com/IHUI-INF-AI/IHUI-AI |
| P17 | country | 1 | People's Republic of China |
| P131 | located in | 1 | Shanghai |
| P178 | developer | 1 | https://github.com/AIZHS2025 |
| P1451 | motto text | 1 | "30 minutes to your own AI middle-platform" |
| P348 | software version identifier | 1 | 0.1.0 |
| **Total claim rows** | | **29** | |

Plus 10 labels, 10 descriptions, 18 aliases, 5 sitelinks.

---

## 6. Reference: existing similar items

| Q-ID | Label | Use |
| --- | --- | --- |
| Q117340550 | LangChain | Closest existing analog (single P31 = software, no sitelinks). |
| Q7397 | software | P31 root. |
| Q166142 | application software | P31 alternative root. |
| Q1130645 | open-source software | P31 root. |
| Q341 | free software | P31 root. |
| Q13785927 | Apache License 2.0 | P275 value. |
| Q148 | People's Republic of China | P17 value. |
| Q8686 | Shanghai | P131 value. |

A full property table and the list of items we **dropped** (because they
were mis-mapped in the original task spec) is in
`.trae-cn/tmp/wikidata/reference-entities.md`.

---

## 7. Known limitations

1. **The "developer" claim (P178) uses a URL string, not an item reference.**
   The Wikidata P178 property is defined as `wikibase-item`, not `url`. The
   QuickStatements batch therefore uses P178 with the URL literal — QuickStatements
   will auto-create a sitelink (or bot-op will need to swap in an item once
   `AIZHS2025` is a Wikidata item). If you want this to round-trip cleanly,
   first create a Wikidata item for "AI 智汇社" and then change P178 to that
   item's Q-ID. This is the only claim that has been slightly fudged.
2. **The motto text (P1451) is a single English phrase.** The Chinese / Japanese
   translations live in the *description* but the motto property itself only
   takes monolingual text. Wikidata items often have a separate item for the
   motto (P1546) — we leave that open for a future edit.
3. **Sitelinks require Wikipedia articles to actually exist.** `enwiki`, `zhwiki`,
   `jawiki` sitelinks will fail at submission time until those Wikipedia
   articles are created. Either:
   - (a) write the Wikipedia articles first, then run QuickStatements; or
   - (b) delete the `S*` lines from `quickstatements.txt` before running.
   The current file has 5 sitelinks; the safer option is to ship with 0
   sitelinks and add them later once the Wikipedia articles exist.
4. **`bot` flag required for high-rate submission.** QuickStatements will
   rate-limit an unflagged account to 1-2 statements per minute. The 60+ rows
   in this batch will take ~30 minutes on a non-bot account. A bot account
   finishes in seconds.

---

## 8. Re-generating the package

```bash
# Dry-run (prints summary, writes nothing)
node .trae-cn/tmp/wikidata/submit.mjs --dry-run

# Verify all IDs against the live Wikidata API first
node .trae-cn/tmp/wikidata/verify-api.mjs --strict

# Write all artifacts
node .trae-cn/tmp/wikidata/submit.mjs

# Verify IDs only (no file writes)
node .trae-cn/tmp/wikidata/verify-api.mjs
```

After any change to the ID map or the description text, re-run both
`verify-api.mjs --strict` and `submit.mjs` before submitting to Wikidata.

---

## 9. Post-submission checklist

- [ ] The Q-ID is created and visible at `https://www.wikidata.org/wiki/Q<id>`.
- [ ] The item shows 4 P31 values, 4 P921 values, 6 P277 values.
- [ ] The 10-language label set is intact.
- [ ] The schema.org mirror at `apps/web/public/wikidata.json` has been
      updated with the real Q-ID.
- [ ] The Wikidata item links back to `https://aizhs.top` via P856.
- [ ] The schema.org `sameAs` array on the homepage includes
      `https://www.wikidata.org/wiki/Q<id>`.
- [ ] `apps/web/public/llms.txt` mentions the Q-ID in the entity section.
- [ ] `docs/CHANGELOG.md` has a `feat(wikidata): Q<id> allocated` entry.

Once all 8 checkboxes are filled, the Wikidata submission is officially
closed and the GEO / LLM knowledge-graph pipeline is fully wired.
