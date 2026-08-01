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

## Auto-deploy (Windows) — Optional

This repository includes a simple helper script (`Auto-Deploy.bat`) that
automates linking a local copy of the project to an existing Google Apps
Script project and pushing the files using `clasp`. Use this if you prefer
editing files locally (or from this repo clone) and want one-command deploys
from Windows.

Prerequisites

- Windows 10/11 (PowerShell/CMD) with internet access.
- Git (optional, for cloning the repo).
- An existing Google Apps Script project (or create one in the Apps Script
  editor) — you will need its *Script ID* (Apps Script editor → Project
  Settings → Script ID).

How to use Auto-Deploy.bat

1. Clone or download this repository to your Windows machine and open the
   folder in File Explorer.
2. Double-click `Auto-Deploy.bat` (or run it from a CMD/PowerShell window).
3. Follow the prompts:
   - If you press ENTER for Project Path the script uses the current folder.
   - Enter the Apps Script *Script ID* when prompted. (Get it from the
     Apps Script editor: Project Settings → Script ID.)
   - The script will create a small `dreamrise_config.txt` file to remember
     the project path and Script ID for subsequent runs.
4. When asked, allow the script to run `clasp login` to authenticate with
   your Google account (this opens a browser window to sign in).
5. The script writes a `.clasp.json` file with the provided Script ID and
   runs `clasp push --force` to deploy the current local files into the
   linked Apps Script project.

Notes & Troubleshooting

- The batch file attempts to install Node.js via `winget` if Node is missing
  and installs `@google/clasp` globally if `clasp` is not present. You may
  prefer to install Node.js and clasp manually (Node.js installer from
  nodejs.org; `npm install -g @google/clasp`).
- If `winget` is not available on your Windows machine, install Node.js
  manually and rerun the batch file.
- If `clasp push` fails with authorization errors, run `clasp login` from a
  terminal, follow the browser login steps, and then re-run the batch file.
- The script writes `.clasp.json` in the project path. If you already have
  a `.clasp.json`, the script will overwrite it with the provided Script ID;
  be cautious if that file contained other settings.
- After clasp pushes files to Apps Script, remember to create a new
  deployment version in the Apps Script editor (Deploy → Manage deployments)
  if you want the web app URL/version updated for public users.

Alternative: manual clasp workflow

If you prefer to deploy manually without the batch script, here are the
commands (run from the project folder):

```bash
# Install clasp (if not already installed)
npm install -g @google/clasp

# Authenticate (one-time)
clasp login

# Create or link to an existing project (linking example)
# Create .clasp.json with the scriptId or run:
# echo {"scriptId":"<YOUR_SCRIPT_ID>"} > .clasp.json

# Push files to the linked Apps Script project
clasp push --force
```

Replace `<YOUR_SCRIPT_ID>` with your Apps Script project's Script ID.

## How to Use

### 1. Prepare the response sheet

The **first sheet** of the spreadsheet is the source of truth. It needs:

- A **header row** (within the first 5 rows) containing a name column
  (matches "নাম" / "name" / "student"), a phone column (matches "whatsapp" /
  "phone" / "মোবাইল" / "contact"), and optionally a district/college column
  (matches "জেলা" / "district" / "college" / "বিভাগ").
- An **Answer Key row** — one row where the name column contains something
  like "Answer Key" and the question columns contain the correct answers.
  Any row works as long as you tell the Setup Wizard its row number.
- One row per student with their answers in the same question columns.

This is normally just a Google Form response sheet, with one extra manual
row added for the answer key.

### 2. Run the Setup Wizard (🚀 DreamRise System → ⚙️ Full System Setup)

| Field | What it does |
|---|---|
| পরীক্ষার নাম (Exam name) | Shown on the Ranking Page, PDF Report, and portal. |
| সঠিক মার্ক (+) / ভুল (নেগেটিভ) | Marks awarded per correct answer / deducted per wrong answer. |
| অ্যানসার কী রো নম্বর | The spreadsheet row number (1-based) containing the answer key. |
| সামগ্রিক পাস মার্ক (Total Pass %) | The percentage of the (grand) full marks a student needs to pass overall. |
| সাবজেক্ট ভিত্তিক কন্ডিশন আছে? | **না** — score the whole question range as one block. **হ্যাঁ** — split into named subjects, each [...]
| প্রশ্নের কলাম রেঞ্জ | (Standard mode only) Spreadsheet column range holding the questions, e.g. `G:DB`. |
| সাবজেক্ট সংখ্যা + rows | (Subject-wise mode) Name, column range, and pass mark per subject. |
| অতিরিক্ত মার্ক (লিখিত/হোমওয়ার্ক) | Optional. Toggle on to add a written/homework mark on top of the MCQ score. Choose **Overall** (one c[...]

Saving triggers the first sync automatically and sets up the automation
triggers described below.

### 3. Enter marks after the exam

- **MCQ**: happens automatically as students submit the Google Form (see
  Automation below).
- **Additional Mark (written/homework)**: after the first sync, open the
  **Ranking Page** sheet and manually type marks into the Additional Mark
  column(s) for each student, then run **🔄 Manual Sync Ranking** again from
  the menu. The script reads what you typed before rebuilding the sheet, so
  nothing is lost — it folds your entries into the new Grand Total and
  re-checks pass/fail (including the Additional Mark's own pass mark, if
  set).

### 4. Automation (happens without you doing anything)

- **New form submission** → recalculates automatically a few seconds after
  the last submission in a burst (so many students submitting at once
  doesn't trigger dozens of overlapping recalculations).
- **Editing the Answer Key row** → recalculates immediately.
- **Editing a student's answers** → recalculates ~30 seconds later (bulk
  edits don't each trigger a separate run).
- **A student searching the portal** → if the cached data is more than a
  minute old, a background sync is scheduled automatically; if their exact
  row isn't found in the sync yet, the portal computes their result
  directly from the source sheet as a fallback, so they never see a stale
  "not found."

### 5. Menu reference (🚀 DreamRise System)

| Menu item | What it does |
|---|---|
| ⚙️ Full System Setup | Opens the Setup Wizard (see above). |
| 🔄 Manual Sync Ranking | Re-scores everyone from scratch right now — use after entering Additional Marks, or any time you want an immediate refresh. |
| 🖨️ Instant Print (Ranking Page) | Generates a landscape PDF of the Ranking Page and opens a download link. |
| 📄 Instant PDF Report (Download) | Generates a portrait PDF of the detailed per-student report (includes subject breakdowns) and opens a download link. |
| 📊 Show Statistics | Score distribution, rank-band breakdown, and subject overview charts in a printable dialog. |
| ❌ Fail/Weak Report (WhatsApp) | Two lists — students who failed overall, and students who passed but are weak in a specific subject — each row has a ready-to-send (editable) WhatsApp mess[...]
| 🔁 Reset System Settings | Wipes all saved configuration, cache, and the backup sheet. Use only if you want to reconfigure an exam from a blank slate — you'll need to run Setup again afterw[...]

### 6. The student-facing portal

Once deployed as a web app (see Setup step 5 above), students visit the URL
and:

1. Type their phone number (Bengali or English digits both work) and tap
   খুঁজুন.
2. See their rank, score, percentile, and a full breakdown — including a
   **pass/fail badge on every individual subject and on the Additional
   Mark**, so a specific weak area is visible immediately rather than
   requiring them to read raw numbers.
3. Can tap ডাউনলোড / প্রিন্ট for a clean PDF-style printout, or রেজাল্ট
   কপি করুন to copy a shareable text summary.
4. Top-3 and rank-1 finishers get a confetti animation; failing students see
   a motivational message instead of just a bare "FAIL."


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
