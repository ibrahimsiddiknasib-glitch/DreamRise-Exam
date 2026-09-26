# DreamRise — Admission Assessment & Result Portal

DreamRise is a Google Apps Script + Google Sheets system for running competitive
admission exams: it scores MCQ answer sheets (with optional per-subject rules and
negative marking), optionally adds written/homework marks, builds a ranking
sheet and a printable PDF report, and publishes a phone-number-searchable
result portal as a public web app.

**Live logo/branding assets:** hosted in this repo (`Logo_For_Light.png`,
`Logo_For_Dark.png`) and referenced directly by URL from the script, so the
same logo updates everywhere (Setup Wizard, Ranking Page, PDF Report,
Statistics dialog, and the result portal) the moment the files here are
replaced.

## Features

- **MCQ scoring** — standard single-range mode or subject-wise mode, each
  subject with its own pass mark. Positive/negative marking, exact-text
  answer matching (case-insensitive, trimmed).
- **Additional Mark (লিখিত/হোমওয়ার্ক)** — optional written/homework marks
  layered on top of MCQ score, either as one "Overall" mark or broken down
  per subject. Both modes now support their own pass threshold, so a weak
  written score can fail a student even if their MCQ score alone would pass.
- **Ranking Page & PDF Report** — auto-generated, branded sheets with logo,
  exam summary, color-coded pass/fail rows, and a hidden phone-number column
  used to preserve manually-entered Additional Marks across re-syncs.
- **Result Portal (web app)** — students search by phone number and get an
  animated, theme-aware (light/dark) result card: rank, score, per-subject
  breakdown, per-subject **and** per-Additional-Mark pass/fail badges (so a
  specific weak subject is impossible to miss), confetti for top ranks, a
  motivational banner for fails, and a print/PDF button.
- **Fail/Weak Report** — a WhatsApp-ready outreach list, split into students
  who failed overall and students who passed but are weak in a specific
  subject, each with a pre-written (editable) message naming the weak
  subject(s).
- **Statistics dialog** — score distribution histogram, rank-band breakdown,
  and subject overview chart (Chart.js), printable to PDF.
- **Race-safe syncing** — `LockService`-guarded recalculation, debounced
  form-submit and manual-edit triggers, and a permanent backup sheet
  (`DR_Backup`) so cached data survives Apps Script cache expiry.

## File structure

| File | Purpose |
|---|---|
| `Code.gs` | All server-side logic: scoring engine, ranking/report rendering, web app endpoints, triggers, statistics, fail report. |
| `SetupUI.html` | Modal dialog (Setup Wizard) for configuring an exam: marks, answer key row, subjects, Additional Mark. |
| `webapp.html` | The public-facing result portal (`doGet`), including the pass/fail badge UI and print/PDF styling. |
| `Logo_For_Light.png` / `Logo_For_Dark.png` | Brand logos referenced by URL from the script — replacing these files updates the logo everywhere. |

## Setup (new spreadsheet)

1. Open a Google Sheet with your exam response data as the **first sheet**
   (must include a name column, a WhatsApp/phone column, an answer-key row,
   and the MCQ answer columns).
2. **Extensions → Apps Script**, and create three files matching the names
   above (`Code.gs`, `SetupUI.html`, `webapp.html`), pasting in the contents
   from this repo.
3. Reload the spreadsheet — a **🚀 DreamRise System** menu appears.
4. **⚙️ Full System Setup** — configure exam name, marks, answer key row,
   subject-wise pass marks (if any), and Additional Mark (if any). Saving
   triggers the first sync automatically.
5. **Deploy → New deployment → Web app** (execute as you, access: anyone) to
   publish the result portal. Share the resulting URL with students.

## Updating an existing deployment

1. Edit the file(s) in the Apps Script editor (or paste in the updated
   content from this repo).
2. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.

Saving a file alone does **not** update the live web app URL — a new
deployment version is required for portal-facing changes (`webapp.html`) to
go live. Server-side-only changes (`Code.gs`, `SetupUI.html`) that don't
touch `doGet()` output take effect immediately for menu actions, but a new
deployment is still the safest way to make sure everything is in sync.

## Notes

- All UI/PDF text is in Bengali (Anek Bangla / Hind Siliguri fonts); the menu
  and inline code comments are bilingual.
- Phone numbers are normalized to the last 10 digits everywhere (dedupe,
  search, Additional Mark matching) via a single `normalizePhone()` function,
  so the same student is never split into duplicate entries regardless of
  how they typed their number.
- `calculateAndRank()` and the single-student search path
  (`computeSingleStudentAndMerge`) are both `LockService`-guarded to avoid
  race conditions during burst form submissions.

## Credits

Developed by **Muhammad Ibrahim** for DreamRise.
Facebook: [DreamRise](https://www.facebook.com/dreamriseadmission) ·
[Muhammad Ibrahim](https://www.facebook.com/muhammadibrahimsiddiknasib)
