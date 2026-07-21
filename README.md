# DreamRise — Automated Exam Ranking & Result Portal

**A production-grade, Google Apps Script–powered exam management system that turns a single Google Form/Sheet into a self-syncing ranking engine, printable PDF report generator, and public result portal — with zero external server, zero database, and zero hosting cost.**

DreamRise was built to solve a very real problem for coaching centers and admission-test organizers in Bangladesh: hundreds (sometimes thousands) of students submitting a Google Form, and the need to instantly, accurately, and beautifully turn those raw responses into a ranked result — searchable by phone number, printable as an official PDF, and resilient enough to never lose data or leave a student staring at a blank "Loading..." screen.

---

## ✨ What it does

- **Turns any Google Form response sheet into a live ranking engine.** Configure positive/negative marking, an answer-key row, and either a single question range or fully subject-wise scoring (each subject with its own pass mark) — all from a guided Setup Wizard, no code required.
- **Public, branded result portal.** A responsive, dark-mode-aware web app where students search their result by phone number and get an animated, confetti-worthy reveal (top-3 badges, a crown for rank #1) or a warm, motivational message on a fail — never just a flat "no."
- **Self-healing data pipeline.** Ranking data lives in fast in-memory cache *and* a permanent hidden backup sheet, so results survive cache expiry, script restarts, and hours of downtime without ever silently failing.
- **Race-condition-safe auto-sync.** `LockService` ensures that if dozens of students hit the portal at the same second, only one sync runs — everyone else reads consistent data instantly, with no errors and no waiting.
- **Non-blocking, targeted computation.** If a student searches before the full re-rank has run, the system computes *just that student's* score on the spot, merges it into the live leaderboard, and schedules a full background sync — so no one is ever blocked behind a heavy recalculation.
- **One-click professional outputs.** Auto-generated Ranking Page and PDF Report sheets (color-coded top performers, zebra striping, exam summary bar, clickable developer credits) plus instant PDF export and a live Statistics Dashboard with Chart.js-powered score distributions and subject breakdowns.
- **Print-perfected.** Custom export parameters strip gridlines, notes, and titles so exports come out clean, multi-page-correct, and camera-ready.

## 🧠 Why it's interesting

This isn't a toy script — it's an evolution of a real system through 70+ versions, with a visible engineering paper trail: a multi-answer parsing bug fixed by matching Google Sheets' own formula semantics exactly, a blocking-search bug solved by splitting "find the student" from "recompute everyone," and a cache-expiry data-loss bug solved with a permanent, chunked backup sheet that respects Apps Script's per-cell character limits. Every fix is documented inline, in context, as it was diagnosed.

## 🏗️ Architecture

| Layer | Technology |
|---|---|
| Backend logic & orchestration | Google Apps Script (V8 runtime) |
| Data storage | Google Sheets (source of truth) + `CacheService` (speed) + hidden backup sheet (durability) |
| Concurrency control | `LockService` |
| Automation | Time-based & `onFormSubmit`/`onEdit` installable triggers with smart debouncing |
| Public-facing UI | Vanilla HTML/CSS/JS web app (`doGet`), Font Awesome, Anek Bangla typography, canvas-confetti |
| Configuration UI | Modal dialog (Setup Wizard) built with HTML Service |
| Reporting & analytics | Dynamically generated Sheets + Chart.js-powered statistics dialog |
| Export | Native Sheets `/export?format=pdf` pipeline with tuned print parameters |

## 🎯 Ideal for

Admission test panels, coaching centers, scholarship/aptitude exam organizers, and any team running competitive MCQ exams via Google Forms who need trustworthy, tamper-resistant, professional-looking results — without paying for or maintaining a separate backend.

---

## 🚀 How to Use

### 1. Prerequisites
- A Google Form collecting MCQ answers, linked to a Google Sheet (the **first sheet/tab** must be the raw response data).
- One row in that sheet reserved for the **Answer Key** (submit the correct answers once, as if it were a normal response, so its row lands in the sheet).

### 2. Install the script
1. Open your response **Google Sheet** → `Extensions` → `Apps Script`.
2. Delete any boilerplate code and paste in `Code.gs` (the main script).
3. Add two HTML files via `File → New → HTML file`: name them exactly **`SetupUI`** and **`webapp`**, and paste in their respective contents.
4. Click **Save** (💾).

### 3. Run the Setup Wizard
1. Go back to your **Google Sheet** and refresh the page.
2. A new menu, **🚀 DreamRise System**, will appear.
3. Click **⚙️ Full System Setup** and grant the requested permissions (first run only).
4. Fill in the wizard:
   - **Exam Name**
   - **Positive / Negative marks** per question
   - **Answer Key Row #** (the row number where you placed the correct answers)
   - **Pass %** (overall passing threshold)
   - **Subject-wise or single range** — and the corresponding column range(s), e.g. `G:DB`
5. Click **সেভ এবং অটো-র‍্যাঙ্ক** (Save & Auto-Rank). The script will calculate ranks and build the **Ranking Page** and **PDF Report** sheets automatically.

### 4. Publish the public result portal
1. In Apps Script, click **Deploy → New deployment**.
2. Select type **Web app**.
3. Set **Execute as:** *Me*, **Who has access:** *Anyone*.
4. Click **Deploy** and copy the generated web app URL — this is the link students will use to search their results by phone number.

### 5. Daily use
- New form submissions **auto-rank instantly** — no manual action needed.
- Manual edits to the sheet trigger a smart **30-second debounced** re-rank (so bulk edits don't spam recalculations).
- Use **🔄 Manual Sync Ranking** anytime to force an immediate refresh.
- Use **🖨️ Instant Print (Ranking Page)** or **📄 Instant PDF Report** to download official documents.
- Use **📊 Show Statistics** for a live analytics dashboard (score distribution, pass/fail bands, subject performance).
- If you ever need to start over, **🔁 Reset System Settings** wipes the configuration and backup data.

### 6. Branding (optional)
Replace the `DR_LOGO_LIGHT_URL` / `DR_LOGO_DARK_URL` constants at the top of `Code.gs`, and the matching constants inside `webapp.html`, with your own hosted logo image URLs.

---

**Developed by Muhammad Ibrahim** · DreamRise — *Your path to smart admission* 🚀
