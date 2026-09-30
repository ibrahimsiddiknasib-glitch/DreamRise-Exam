/**
 * ═══════════════════════════════════════════════════════════
 *   DreamRise Web App — v90.3
 *   Developer: Muhammad Ibrahim
 * ═══════════════════════════════════════════════════════════
 * Changelog (latest first):
 *  - v90.3 Section print polish: a typed range ("35-40") is now applied
 *    automatically when you press Apply (or Enter) — no separate range
 *    click needed. New "print selected sections" button (apply + print in
 *    one click). After applying, a summary shows sections / questions /
 *    pages. Numbers still come from position, so "33.10" and "33.100"
 *    always keep their trailing zeros.
 *  - Answer Key PDF: section-wise printing. Pick any sections (range like
 *    "35-40" or checkboxes); choose page numbers "from 1" or "normal book
 *    numbers", and section/question numbers "original" or "renumber from 1".
 *  - Question numbers are rebuilt from position (section.index), so
 *    "33.100" can never turn into "33.1". Q.No cells are now imported as text.
 *  - Answer Key PDF: two number buttons — "section number" (hides the part
 *    before the point) and "question number" (hides the auto number on cards).
 *  - Book style: answer table text 16px with normal glyphs (no stylistic
 *    set); the correct option in "show answers" uses the ss04 label
 *    instead of a tick (DR_BOOK_ANSWER_MARK = "font").
 *  - Book style: 13px text, plain black-and-white answer table, compact
 *    one/two-line header with a small logo. Header separator is now a
 *    thin 1px line. The number-hide button now hides only the part of the
 *    number before the point (section part), on questions and answer strip.
 *  - Answer Key PDF: book style is now a two-column, borderless layout
 *    like a printed book. Uses the optional GitHub font, Bengali digits
 *    for question numbers, and font stylistic sets (ss03 labels,
 *    ss04 answers). Normal layout is unchanged.
 *  - Fixed: the custom book font was never applied (a global
 *    "* { font-family }" rule overrode it).
 *  - Font loader validates the file signature and uses an MD5 cache key.
 *  - Answer Key import: one Form per server call, with live progress,
 *    a timer and a resume button.
 *  - Answer Key PDF: each page is a fixed A4 box (own header, border,
 *    page number), so blank pages cannot occur.
 *  - Answer Key PDF: full / practice / blank modes, question-number
 *    toggle, clickable credit footer.
 *  - Multi-form question bank: one Form = one section.
 *  - normalizePhone() converts Bengali/Devanagari/Arabic-Indic digits.
 *  - "Overall" Additional Mark supports its own pass mark.
 * ═══════════════════════════════════════════════════════════
 */

// ===================== BRANDING =====================
// Logos: change here once, updates everywhere.
// Light-background logo (web app light mode)
const DR_LOGO_LIGHT_URL = "https://github.com/ibrahimsiddiknasib-glitch/DreamRise/blob/main/Logo_For_light.png?raw=true";
// Dark-background logo (web app dark mode, Ranking/PDF headers)
const DR_LOGO_DARK_URL  = "https://github.com/ibrahimsiddiknasib-glitch/DreamRise/blob/main/Logo_For_Dark.png?raw=true";
// Backward-compat alias (dark background)
const DR_LOGO_URL = DR_LOGO_DARK_URL;

// ── Answer Key "book style" settings ──
// Custom font file on GitHub (.woff2/.woff/.ttf/.otf). A "blob" link is
// fine (?raw=true is added automatically). Empty = use Anek Bangla.
const DR_BOOK_FONT_URL = "https://github.com/ibrahimsiddiknasib-glitch/DreamRise/blob/main/july.woff2?raw=true";
// OpenType stylistic set for the option labels (Bengali ka/kha/ga/gha). "" = off.
const DR_BOOK_LABEL_FEATURE  = "ss03";
// Stylistic set used on the correct option's label (when ANSWER_MARK = "font").
const DR_BOOK_ANSWER_FEATURE = "ss04";
// How the correct option is shown in book style:
//   "tick" = small ✓ after the option, "font" = label uses ANSWER_FEATURE
const DR_BOOK_ANSWER_MARK = "font";
// If any option of a question is longer than this (chars), that
// question's options flow inline instead of a 2-column grid.
const DR_BOOK_OPT_WRAP_CHARS = 22;

const DR_WATERMARK_TEXT = "DreamRise";

// Hidden backup sheet (data survives cache expiry)
const DR_BACKUP_SHEET = "DR_Backup";

// Portal search triggers a background sync if data is older than this (ms)
const DR_AUTO_SYNC_MAX_AGE_MS = 60 * 1000;

// Max wait (ms) for the script lock before continuing with existing data
const DR_LOCK_WAIT_MS = 8000;

// Form-submit burst debounce: one full recalculation after the last submit
const DR_FORM_SUBMIT_DEBOUNCE_MS = 8 * 1000;

// Header (name/phone columns) is searched only in the first N rows
const DR_HEADER_SEARCH_ROWS = 5;

// ===================== MENU & SETUP =====================
function onOpen(e) {
  // getUi() is unavailable in some trigger contexts — skip silently
  try {
    SpreadsheetApp.getUi()
      .createMenu('🚀 DreamRise System')
      .addItem('⚙️ Full System Setup',            'showSetupWizard')
      .addItem('🔄 Manual Sync Ranking',           'calculateAndRank')
      .addSeparator()
      .addItem('🖨️ Instant Print (Ranking Page)',  'instantPrintRanking')
      .addItem('📄 Instant PDF Report (Download)', 'instantPrintReport')
      .addSeparator()
      .addItem('📊 Show Statistics',               'showStatisticsDialog')
      .addItem('❌ Fail/Weak Report (WhatsApp)',  'showFailReportDialog')
      .addItem('🔁 Reset System Settings',         'resetSettings')
      .addSeparator()
      .addItem('📘 ফর্ম থেকে প্রশ্ন আনুন (Answer Key)', 'fetchQuestionsFromForm')
      .addItem('📝 Answer Key সেটিংস (নাম/মার্ক)',       'setAnswerKeySettings')
      .addItem('🧮 Answer Key Row অটো বসাও (সোর্স শীটে)', 'autoGenerateAnswerKeyRow')
      .addItem('📄 Answer Key (দেখুন ও PDF নিন)',        'showAnswerKeyPdfDialog')
      .addToUi();
  } catch(x) {
    console.log('onOpen: UI not available in this context.');
  }
}

function showSetupWizard() {
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutputFromFile('SetupUI')
      .setWidth(650).setHeight(720).setTitle('DreamRise System Configuration'),
    'Competitive Exam Setup'
  );
}

// ===================== CONFIGURATION =====================
function saveConfiguration(config) {
  try {
    PropertiesService.getScriptProperties().setProperties({
      'examName':      config.examName,
      'posMark':       config.posMark,
      'negMark':       config.negMark,
      'globalPass':    config.globalPass,
      'ansKeyRow':     config.ansKeyRow,
      'isSubjectWise': config.isSubjectWise.toString(),
      'subjectData':   JSON.stringify(config.subjects),
      'standardRange': config.standardRange || "",
      // Additional Mark (written/homework) config
      'hasAdditionalMark':  (!!config.hasAdditionalMark).toString(),
      'additionalMode':     config.additionalMode || "",
      'additionalOverall':  JSON.stringify(config.additionalOverall || {}),
      'additionalSubjects': JSON.stringify(config.additionalSubjects || [])
    });
    // Clear the old answer-key-name marker so the new row isn't flagged as changed
    PropertiesService.getScriptProperties().deleteProperty('savedAnsKeyName');
    setupAutomationTriggers();
    calculateAndRank();
    return "Success!";
  } catch (e) {
    return "Error: " + e.message;
  }
}

/** Returns the saved config so the Setup Wizard can pre-fill. */
function getSavedConfig() {
  try {
    const props = PropertiesService.getScriptProperties().getProperties();
    if (!props.examName) return null; // nothing saved yet
    return {
      examName:      props.examName,
      posMark:       parseFloat(props.posMark),
      negMark:       parseFloat(props.negMark),
      globalPass:    parseFloat(props.globalPass),
      ansKeyRow:     props.ansKeyRow,
      isSubjectWise: props.isSubjectWise === "true",
      standardRange: props.standardRange || "",
      subjects:      JSON.parse(props.subjectData || "[]"),
      hasAdditionalMark:  props.hasAdditionalMark === "true",
      additionalMode:     props.additionalMode || "",
      additionalOverall:  JSON.parse(props.additionalOverall || "{}"),
      additionalSubjects: JSON.parse(props.additionalSubjects || "[]")
    };
  } catch (e) {
    console.error("getSavedConfig failed:", e);
    return null;
  }
}

function resetSettings() {
  PropertiesService.getScriptProperties().deleteAllProperties();
  CacheService.getScriptCache().remove('rankDataMin');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const backupSheet = ss.getSheetByName(DR_BACKUP_SHEET);
  if (backupSheet) ss.deleteSheet(backupSheet);
  SpreadsheetApp.getUi().alert('✅ Settings reset! Please run Setup again.');
}

// ===================== TRIGGERS =====================
function setupAutomationTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Remove old DreamRise triggers. 'onOpen' must never be an installable
  // trigger (getUi() fails in time-based context).
  ScriptApp.getProjectTriggers().forEach(t => {
    if (['calculateAndRank','onEditThrottled','runDebouncedRank','onOpen','onFormSubmitThrottled'].includes(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  });
  // Form submit goes through a short debounce (avoids parallel heavy runs)
  ScriptApp.newTrigger('onFormSubmitThrottled').forSpreadsheet(ss).onFormSubmit().create();
  // Manual edit → debounce
  ScriptApp.newTrigger('onEditThrottled').forSpreadsheet(ss).onEdit().create();
}

/**
 * Form-submit handler: resets a short timer instead of running the heavy
 * calculateAndRank() per submission. A burst of submissions results in
 * one recalculation shortly after the last one. A student searching right
 * after submitting is served by computeSingleStudentAndMerge().
 */
function onFormSubmitThrottled(e) {
  try {
    ScriptApp.getProjectTriggers().forEach(t => {
      if (t.getHandlerFunction() === 'runDebouncedRank') ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger('runDebouncedRank').timeBased().after(DR_FORM_SUBMIT_DEBOUNCE_MS).create();
  } catch(err) { console.error("onFormSubmitThrottled:", err); }
}

/**
 * Smart auto-rank (debounce):
 * - Answer key row edit → recalculate immediately
 * - Student data edit   → 30s debounce
 * - Ranking Page / PDF Report / backup sheet edits → ignored
 */
function onEditThrottled(e) {
  try {
    const props = PropertiesService.getScriptProperties().getProperties();
    if (!props.examName) return;

    const ss          = SpreadsheetApp.getActiveSpreadsheet();
    const editedSheet = e.range.getSheet();

    // Ignore output sheets
    if (["Ranking Page","PDF Report",DR_BACKUP_SHEET].includes(editedSheet.getName())) return;

    // Only the source (first) sheet matters
    if (editedSheet.getSheetId() !== ss.getSheets()[0].getSheetId()) return;

    const ansKeyRow  = parseInt(props.ansKeyRow) || 2;
    const editedRow  = e.range.getRow();

    // Answer key edit → rank now
    if (editedRow === ansKeyRow) { calculateAndRank(); return; }

    // Student edit → reset the 30s timer
    ScriptApp.getProjectTriggers().forEach(t => {
      if (t.getHandlerFunction() === 'runDebouncedRank') ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger('runDebouncedRank').timeBased().after(30 * 1000).create();
    try { ss.toast('✏️ পরিবর্তন সনাক্ত — ৩০ সেকেন্ড পর Rank আপডেট হবে...', '🔄 DreamRise', 5); } catch(x){}
  } catch(err) { console.error("onEditThrottled:", err); }
}

function runDebouncedRank() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runDebouncedRank') ScriptApp.deleteTrigger(t);
  });
  calculateAndRank();
}

// ===================== HELPERS =====================

/** Column letter(s) → 0-based index.  "A"→0, "B"→1, "AA"→26 */
function colLetterToIndex(col) {
  let num = 0;
  const s = String(col).toUpperCase().replace(/[^A-Z]/g, '');
  for (let i = 0; i < s.length; i++) num = num * 26 + (s.charCodeAt(i) - 64);
  return num - 1;
}

/** 1-based column count → letter.  1→"A", 26→"Z", 27→"AA" */
function colIndexToLetter(n) {
  let letter = '';
  while (n > 0) { n--; letter = String.fromCharCode(65 + (n % 26)) + letter; n = Math.floor(n / 26); }
  return letter || 'A';
}

/** Converts Bengali / Devanagari / Arabic-Indic digits to 0-9. */
function _drDigitsToEnglish(str) {
  return String(str || "").replace(/[০-৯०-९٠-٩۰-۹]/g, function(ch) {
    const code = ch.charCodeAt(0);
    if (code >= 0x09E6 && code <= 0x09EF) return String(code - 0x09E6); // Bengali
    if (code >= 0x0966 && code <= 0x096F) return String(code - 0x0966); // Devanagari
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660); // Arabic-Indic
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0); // Extended Arabic-Indic
    return ch;
  });
}

/**
 * Single place where phone numbers are normalized: any-script digits →
 * 0-9, digits only, last 10. Used by dedupe and every search path.
 */
function normalizePhone(raw) {
  return _drDigitsToEnglish(raw).trim().replace(/\D/g, '').slice(-10);
}

/** Exact text comparison (trim + case-insensitive), matches the sheet formula. */
function isCorrect(studentAns, keyAns) {
  const k = String(keyAns).trim().toUpperCase();
  const s = String(studentAns).trim().toUpperCase();
  if (!k || !s) return false;
  return k === s;
}

/** Exam summary line used on the Ranking Page, PDF Report and web app. */
function buildSummaryText(meta) {
  return `Total Q: ${meta.totalQ} | Full Marks: ${meta.fullMarks} | Pass Mark: ${meta.passPercent}% (${meta.passThreshold}) | ` +
         `Examinees: ${meta.examinees} | Passed: ${meta.passCount} | Avg: ${meta.avg} | Highest: ${meta.highScore}`;
}

/** Finds the header row (name column) within the first few rows only. */
function findHeaderRowIdx(rawData) {
  const limit = Math.min(DR_HEADER_SEARCH_ROWS, rawData.length);
  for (let i = 0; i < limit; i++) {
    if (/name|full|নাম/i.test(rawData[i].join(" "))) return i;
  }
  return -1;
}

// ===================== MAIN RANKING ENGINE =====================
function calculateAndRank() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Serialized with a script lock; a run that can't get the lock skips
  // (the debounce schedules another one).
  const lock = LockService.getScriptLock();
  let gotLock = false;
  try {
    gotLock = lock.tryLock(DR_LOCK_WAIT_MS);
    if (!gotLock) {
      console.log("calculateAndRank: another sync is running — skipped.");
      return;
    }

    try { ss.toast('⏳ সিঙ্ক হচ্ছে...', '🚀 DreamRise', 3); } catch(x){}

    const props = PropertiesService.getScriptProperties().getProperties();
    if (!props.examName) {
      try { SpreadsheetApp.getUi().alert("আগে Setup Wizard থেকে কনফিগারেশন সেভ করুন।"); } catch(x){}
      return;
    }

    const sourceSheet  = ss.getSheets()[0];
    const rawData      = sourceSheet.getDataRange().getValues();

    const isSubWise    = props.isSubjectWise === "true";
    const subjects     = JSON.parse(props.subjectData || "[]");
    const posMark      = parseFloat(props.posMark)  || 1;
    const negMark      = parseFloat(props.negMark)  || 0;
    const globalPassPct= parseFloat(props.globalPass)|| 0;
    const ansKeyRowIdx = parseInt(props.ansKeyRow) - 1;

    // Additional Mark config
    const hasAddl    = props.hasAdditionalMark === "true";
    const addlMode   = props.additionalMode || "";               // 'overall' | 'subjectwise'
    const addlOverall= JSON.parse(props.additionalOverall  || "{}"); // {name, max, pass}
    const addlSubjects = JSON.parse(props.additionalSubjects || "[]"); // [{name, max, pass}]
    const addlMaxTotal = !hasAddl ? 0 :
      (addlMode === 'overall'
        ? (parseFloat(addlOverall.max) || 0)
        : addlSubjects.reduce((sum, as) => sum + (parseFloat(as.max) || 0), 0));

    // Read manually entered Additional Marks before the sheet is rebuilt
    const prevAddl = hasAddl ? readPreviousAdditionalMarks(ss, isSubWise, subjects, addlMode, addlSubjects, addlOverall) : {};

    // Question columns
    let qCols = new Set();
    if (isSubWise) {
      subjects.forEach(sub => {
        const [s, e2] = sub.range.split(':').map(colLetterToIndex);
        for (let j = s; j <= e2; j++) qCols.add(j);
      });
    } else {
      const [s, e2] = (props.standardRange || "A:A").split(':').map(colLetterToIndex);
      for (let j = s; j <= e2; j++) qCols.add(j);
    }

    // Header row is searched only near the top (avoids matching student answers)
    const titleRowIdx = findHeaderRowIdx(rawData);
    if (titleRowIdx === -1) { console.error("Header row not found!"); return; }
    const titleRow = rawData[titleRowIdx];

    let nCol = -1, dCol = -1, wCol = -1;
    titleRow.forEach((h, j) => {
      if (qCols.has(j)) return;
      const head = String(h).toLowerCase();
      if      (/নাম|name|student/i.test(head))             nCol = j;
      else if (/জেলা|district|college|বিভাগ/i.test(head)) dCol = j;
      else if (/whatsapp|phone|মোবাইল|contact/i.test(head))wCol = j;
    });

    if (nCol === -1 || wCol === -1) {
      try { SpreadsheetApp.getUi().alert("নাম বা WhatsApp কলাম খুঁজে পাওয়া যায়নি।"); } catch(x){}
      return;
    }

    const ansKeyRow   = rawData[ansKeyRowIdx];
    const ansKeyName  = String(ansKeyRow[nCol] || "").trim();
    const totalQCount = qCols.size;

    // Warn if the answer key row changed (e.g. the sheet was sorted)
    const savedAnsKeyName = props.savedAnsKeyName;
    if (savedAnsKeyName && savedAnsKeyName !== ansKeyName) {
      console.error(`⚠️ Answer Key row (row ${ansKeyRowIdx+1}) এর নাম বদলে গেছে! আগে: "${savedAnsKeyName}", এখন: "${ansKeyName}". শীট সর্ট/এডিট হয়ে থাকতে পারে — Setup Wizard-এ Answer Key Row নম্বর যাচাই করুন!`);
      try { ss.toast('⚠️ সতর্কতা: Answer Key row বদলে গেছে বলে মনে হচ্ছে! Row নম্বর যাচাই করুন, নয়তো স্কোরিং ভুল হতে পারে।', '⚠️ DreamRise', 10); } catch(x){}
    } else if (!savedAnsKeyName) {
      try { PropertiesService.getScriptProperties().setProperty('savedAnsKeyName', ansKeyName); } catch(x){}
    }

    let students = [], seen = new Set();
    let passCount = 0, highScore = -Infinity, totalScoreSum = 0;

    for (let i = 0; i < rawData.length; i++) {
      if (i === titleRowIdx || i === ansKeyRowIdx) continue;
      const row  = rawData[i];
      const name = String(row[nCol] || "").trim();
      // Convert digits first so Bengali-script numbers aren't dropped
      const rawDigits = _drDigitsToEnglish(row[wCol]).trim().replace(/\D/g, '');
      if (!name || rawDigits.length < 7) continue;
      const phone = normalizePhone(rawDigits);
      if (name === ansKeyName) continue;      // skip answer key row
      if (seen.has(phone)) continue;           // skip duplicates
      seen.add(phone);

      let totalC = 0, totalW = 0, totalScore = 0, subFail = false, subDataForTable = [];
      let weakSubjects = []; // subjects below pass mark (for the Fail Report)

      if (isSubWise) {
        subjects.forEach(sub => {
          const [s, e2] = sub.range.split(':').map(colLetterToIndex);
          let c = 0, w = 0;
          for (let j = s; j <= e2; j++) {
            const kA = ansKeyRow[j], sA = row[j];
            if (String(kA).trim() !== "") {
              if (String(sA).trim() !== "") {
                if (isCorrect(sA, kA)) c++; else w++;
              }
            }
          }
          const score      = (c * posMark) - (w * negMark);
          const subPassMark= parseFloat(sub.pass) || 0;
          if (score < subPassMark) { subFail = true; weakSubjects.push(sub.name); }
          totalC += c; totalW += w; totalScore += score;
          subDataForTable.push(c, w, score.toFixed(2));
        });
      } else {
        const [s, e2] = (props.standardRange || "A:A").split(':').map(colLetterToIndex);
        for (let j = s; j <= e2; j++) {
          const kA = ansKeyRow[j], sA = row[j];
          if (String(kA).trim() !== "" && String(sA).trim() !== "") {
            if (isCorrect(sA, kA)) totalC++; else totalW++;
          }
        }
        totalScore = (totalC * posMark) - (totalW * negMark);
      }

      const fullMarksPossible = totalQCount * posMark;

      // Add Additional Mark (from previously entered values)
      let addlScore = 0, addlSubFail = false, addlOverallVal = "", addlSubVals = null;
      let weakAddlSubjects = []; // Additional subjects below pass mark
      if (hasAddl) {
        const prev = prevAddl[phone];
        if (addlMode === 'overall') {
          if (prev && typeof prev.overall === 'number') {
            addlOverallVal = prev.overall;
            addlScore = prev.overall;
            // Overall mode has its own pass mark too
            const overallPassMark = parseFloat(addlOverall.pass) || 0;
            if (prev.overall < overallPassMark) {
              addlSubFail = true;
              weakAddlSubjects.push(addlOverall.name || 'Additional');
            }
          }
        } else if (addlMode === 'subjectwise') {
          addlSubVals = addlSubjects.map((as, i) => {
            const v = (prev && prev.subs && typeof prev.subs[i] === 'number') ? prev.subs[i] : "";
            if (typeof v === 'number') {
              addlScore += v;
              const asPass = parseFloat(as.pass) || 0;
              if (v < asPass) { addlSubFail = true; weakAddlSubjects.push(as.name); }
            }
            return v;
          });
        }
      }

      const grandTotal   = totalScore + addlScore;
      const grandFullMax = fullMarksPossible + addlMaxTotal;
      const isPassed = !subFail && !addlSubFail &&
        grandTotal >= (grandFullMax * globalPassPct / 100);

      if (isPassed) passCount++;
      const scoreForStats = hasAddl ? grandTotal : totalScore;
      if (scoreForStats > highScore) highScore = scoreForStats;
      totalScoreSum += scoreForStats;

      const phoneDisplay = phone.length >= 3 ? "********" + phone.slice(-3) : phone;
      students.push({
        name, phone,
        district:     dCol !== -1 ? String(row[dCol] || "N/A").trim() : "N/A",
        phoneDisplay,
        subData:      subDataForTable,
        totalC, totalW,
        score:        totalScore,
        addlOverallVal, addlSubVals, addlScore,
        grandTotal,
        weakSubjects, weakAddlSubjects,
        passed:       isPassed
      });
    }

    if (students.length === 0) {
      try { ss.toast('⚠️ কোনো valid student পাওয়া যায়নি!', 'DreamRise', 5); } catch(x){}
      return;
    }
    if (highScore === -Infinity) highScore = 0;

    // Sort: pass first, then score desc, then fewer wrong answers
    students.sort((a, b) => {
      if (a.passed !== b.passed) return a.passed ? -1 : 1;
      const aScore = hasAddl ? a.grandTotal : a.score;
      const bScore = hasAddl ? b.grandTotal : b.score;
      if (bScore !== aScore) return bScore - aScore;
      return a.totalW - b.totalW;
    });

    const fullMarks     = (totalQCount * posMark + addlMaxTotal).toFixed(2);
    const passThreshold = ((totalQCount * posMark + addlMaxTotal) * globalPassPct / 100).toFixed(2);
    const meta = {
      examName:      props.examName,
      totalQ:        totalQCount,
      fullMarks,
      passPercent:   globalPassPct,
      passThreshold,
      examinees:     students.length,
      passCount,
      failCount:     students.length - passCount,
      avg:           students.length > 0 ? (totalScoreSum / students.length).toFixed(2) : "0",
      highScore:     highScore.toFixed(2),
      negMark, posMark,
      isSubjectWise: isSubWise,
      subjects,
      // Additional Mark meta (used by Ranking Page / PDF Report / portal)
      hasAdditionalMark: hasAddl,
      addlMode, addlOverall, addlSubjects
    };

    renderRankingPage(students, props, subjects, meta);
    renderPdfReport(students, props, subjects, meta);

    // Meta → ScriptProperties (permanent fallback)
    try {
      PropertiesService.getScriptProperties().setProperty('lastMeta', JSON.stringify(meta));
      PropertiesService.getScriptProperties().setProperty('lastSyncTime', Date.now().toString());
    } catch(x){}

    // ── Persist data ──
    try {
      // Minified rows: index 8 = grand total, index 9 = raw additional-mark data
      const cacheStudents = students.map(s => {
        let addlData = null;
        if (hasAddl) {
          addlData = (addlMode === 'overall')
            ? { overall: s.addlOverallVal }
            : { subs: s.addlSubVals || [] };
        }
        return [
          s.name, s.district, s.phone, s.totalC, s.totalW, s.score, s.passed ? 1 : 0, s.subData,
          s.grandTotal, addlData
        ];
      });
      const payload = { s: cacheStudents, m: meta, t: Date.now() };
      const payloadJson = JSON.stringify(payload);

      // 1) Fast cache (best-effort, 6 hours)
      try { CacheService.getScriptCache().put('rankDataMin', payloadJson, 21600); } catch(x){}

      // 2) Permanent backup sheet (main source)
      saveBackupSheet(payloadJson);

    } catch(x) { console.error("Data persist failed:", x); }

    // Lists for the Fail/Weak Report (refreshed on every sync):
    //  failList     — overall failures (with weak subjects)
    //  weakPassList — passed overall but below pass mark in some subject
    try {
      const toEntry = s => ({
        name:  s.name,
        phone: s.phone,
        score: (hasAddl ? s.grandTotal : s.score).toFixed(2),
        weakSubjects:     s.weakSubjects     || [],
        weakAddlSubjects: s.weakAddlSubjects || []
      });
      const failList     = students.filter(s => !s.passed).map(toEntry);
      const weakPassList = students.filter(s =>
        s.passed && ((s.weakSubjects && s.weakSubjects.length) || (s.weakAddlSubjects && s.weakAddlSubjects.length))
      ).map(toEntry);

      CacheService.getScriptCache().put('failedListMin', JSON.stringify({
        failList, weakPassList, examName: props.examName, fullMarks: meta.fullMarks, t: Date.now()
      }), 21600);
    } catch(x) { console.error("Fail list cache failed:", x); }

    try { ss.toast(`✅ সম্পন্ন! ${students.length} জন | পাস: ${passCount}`, 'DreamRise System', 5); } catch(x){}

  } finally {
    if (gotLock) { try { lock.releaseLock(); } catch(x){} }
  }
}

/**
 * Saves the backup JSON to a hidden sheet, split into chunks
 * (a cell holds at most 50,000 characters).
 */
function saveBackupSheet(payloadJson) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DR_BACKUP_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(DR_BACKUP_SHEET);
  } else {
    sheet.clear();
  }
  try { sheet.hideSheet(); } catch(x){}

  const CHUNK_SIZE = 40000; // safety margin under the 50k limit
  const chunks = [];
  for (let i = 0; i < payloadJson.length; i += CHUNK_SIZE) {
    chunks.push(payloadJson.slice(i, i + CHUNK_SIZE));
  }
  // One chunk per row, column A
  const rows = chunks.map(c => [c]);
  if (rows.length > 0) {
    sheet.getRange(1, 1, rows.length, 1).setValues(rows);
  }
}

/** Reads and parses the backup payload, or returns null. */
function loadBackupSheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(DR_BACKUP_SHEET);
    if (!sheet) return null;
    const lastRow = sheet.getLastRow();
    if (lastRow < 1) return null;
    const values = sheet.getRange(1, 1, lastRow, 1).getValues();
    const json = values.map(r => r[0]).join('');
    if (!json) return null;
    return JSON.parse(json);
  } catch(e) {
    console.error("loadBackupSheet failed:", e);
    return null;
  }
}

/** Cache first, then backup sheet. */
function getStudentDataPayload() {
  try {
    const cached = CacheService.getScriptCache().get('rankDataMin');
    if (cached) return JSON.parse(cached);
  } catch(x){}
  return loadBackupSheet();
}

// ===================== AUTO-SYNC ON PORTAL SEARCH =====================
function ensureFreshDataForPortal() {
  try {
    const lastSync = parseInt(PropertiesService.getScriptProperties().getProperty('lastSyncTime')) || 0;
    const isStale  = (Date.now() - lastSync) > DR_AUTO_SYNC_MAX_AGE_MS;
    if (isStale) scheduleBackgroundSync();
  } catch(x) {
    console.error("ensureFreshDataForPortal failed:", x);
  }
}

function scheduleBackgroundSync() {
  try {
    const already = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'runDebouncedRank');
    if (already) return;
    ScriptApp.newTrigger('runDebouncedRank').timeBased().after(5 * 1000).create();
  } catch(x) {
    console.error("scheduleBackgroundSync failed:", x);
  }
}

// ===================== RENDER RANKING PAGE =====================
/**
 * Builds the Ranking Page header list. Shared by renderRankingPage() and
 * readPreviousAdditionalMarks() so column positions always match.
 */
function buildRankingHeaders(isSubWise, subjects, hasAddl, addlMode, addlOverall, addlSubjects) {
  let headers = ["Rank", "Student Name", "District", "WhatsApp"];
  if (isSubWise) {
    subjects.forEach(sub => headers.push(sub.name+"(C)", sub.name+"(W)", sub.name+"(S)"));
  }
  if (hasAddl && addlMode === 'subjectwise') {
    addlSubjects.forEach(as => headers.push(as.name + " (Addl)"));
  }
  headers.push("Total C", "Total W", hasAddl ? "MCQ Score" : "Score");
  if (hasAddl) {
    if (addlMode === 'overall') headers.push(addlOverall.name);
    headers.push("Grand Total");
  }
  headers.push("Result");
  if (hasAddl) headers.push("_FullPhone_");
  return headers;
}

/**
 * Reads manually entered Additional Marks from the Ranking Page before
 * it is cleared, so they are kept on re-run. Column positions come from
 * buildRankingHeaders(), not header text.
 */
function readPreviousAdditionalMarks(ss, isSubWise, subjects, addlMode, addlSubjects, addlOverall) {
  const map = {};
  try {
    const sheet = ss.getSheetByName("Ranking Page");
    if (!sheet) return map;
    const lastRow = sheet.getLastRow(), lastCol = sheet.getLastColumn();
    if (lastRow < 5 || lastCol < 1) return map;

    const expectedHeaders = buildRankingHeaders(isSubWise, subjects, true, addlMode, addlOverall, addlSubjects);
    const phoneColIdx = expectedHeaders.indexOf("_FullPhone_");
    if (phoneColIdx === -1 || phoneColIdx >= lastCol) return map;

    // Sanity check: the old sheet must have "_FullPhone_" at the same
    // position, otherwise its structure differs and is not trusted.
    const actualHeaderRow = sheet.getRange(4, 1, 1, lastCol).getValues()[0];
    if (String(actualHeaderRow[phoneColIdx]).trim() !== "_FullPhone_") return map;

    const data = sheet.getRange(5, 1, lastRow - 4, lastCol).getValues();

    if (addlMode === 'overall') {
      const colIdx = expectedHeaders.indexOf(addlOverall.name);
      data.forEach(row => {
        const phone = String(row[phoneColIdx] || "").trim();
        if (!phone) return;
        const v = parseFloat(row[colIdx]);
        if (!isNaN(v)) map[phone] = { overall: v };
      });
    } else if (addlMode === 'subjectwise') {
      const colIdxs = addlSubjects.map(as => expectedHeaders.indexOf(as.name + " (Addl)"));
      data.forEach(row => {
        const phone = String(row[phoneColIdx] || "").trim();
        if (!phone) return;
        const subs = colIdxs.map(ci => {
          if (ci === -1) return "";
          const v = parseFloat(row[ci]);
          return isNaN(v) ? "" : v;
        });
        map[phone] = { subs };
      });
    }
  } catch (x) {
    console.error("readPreviousAdditionalMarks failed:", x);
  }
  return map;
}

function renderRankingPage(students, props, subjects, meta) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName("Ranking Page") || ss.insertSheet("Ranking Page");
  sheet.clear();
  sheet.clearNotes();

  let headers = buildRankingHeaders(
    props.isSubjectWise === "true", subjects,
    meta.hasAdditionalMark, meta.addlMode, meta.addlOverall, meta.addlSubjects
  );
  const COL = headers.length;
  const resultColIdx = headers.indexOf("Result"); // 0-based, used for row colors

  // Row 1: logo only
  sheet.setRowHeight(1, 72);
  sheet.getRange(1,1,1,COL).merge()
    .setBackground("#0f1f3d")
    .setValue("")
    .setHorizontalAlignment("center").setVerticalAlignment("middle");
  try {
    sheet.insertImage(DR_LOGO_DARK_URL, 1, 1, 10, 10).setWidth(190).setHeight(52);
  } catch(x) {
    sheet.getRange(1,1,1,COL)
      .setValue("DreamRise")
      .setFontColor("white").setFontSize(22).setFontWeight("Bold").setFontFamily("Anek Bangla");
    console.error("Logo insert failed (Ranking Page):", x);
  }

  // Row 2: exam name
  sheet.getRange(2,1,1,COL).merge()
    .setValue("- " + meta.examName.toUpperCase() + " RESULT -")
    .setBackground("#2563eb").setFontColor("white").setFontSize(14)
    .setFontWeight("Bold").setHorizontalAlignment("center").setFontFamily("Anek Bangla");

  // Row 3: summary
  const summary = buildSummaryText(meta);
  sheet.getRange(3,1,1,COL).merge()
    .setValue(summary)
    .setBackground("#f1f5f9").setFontWeight("Regular").setFontSize(10)
    .setHorizontalAlignment("center")
    .setBorder(true,true,true,true,true,true,"#cbd5e1",SpreadsheetApp.BorderStyle.SOLID)
    .setFontFamily("Anek Bangla");

  // Row 4: headers
  sheet.getRange(4,1,1,COL).setValues([headers])
    .setBackground("#0f172a").setFontColor("white").setFontWeight("Bold")
    .setHorizontalAlignment("center").setFontFamily("Anek Bangla").setFontSize(11);

  // Rows 5+: students
  if (students.length > 0) {
    const tableData = students.map((s, idx) => {
      let row = [idx+1, s.name, s.district, s.phoneDisplay];
      if (s.subData.length > 0) row.push(...s.subData);
      if (meta.hasAdditionalMark && meta.addlMode === 'subjectwise' && s.addlSubVals) {
        row.push(...s.addlSubVals);
      }
      row.push(s.totalC, s.totalW, s.score.toFixed(2));
      if (meta.hasAdditionalMark) {
        if (meta.addlMode === 'overall') row.push(s.addlOverallVal);
        row.push(s.grandTotal.toFixed(2));
      }
      row.push(s.passed ? "PASS" : "FAIL");
      if (meta.hasAdditionalMark) row.push(s.phone);
      return row;
    });

    const range = sheet.getRange(5, 1, tableData.length, COL);
    range.setValues(tableData)
      .setHorizontalAlignment("center").setVerticalAlignment("middle").setFontFamily("Anek Bangla");

    let bgColors = [], txtColors = [];
    let passIdx = 0;
    tableData.forEach((row, i) => {
      const isFail = row[resultColIdx] === "FAIL";
      if (isFail) {
        bgColors.push(Array(COL).fill("#fee2e2"));
        txtColors.push(Array(COL).fill("#991b1b"));
      } else {
        if (passIdx < 3) {
          bgColors.push(Array(COL).fill("#dcfce7"));
          txtColors.push(Array(COL).fill("#166534"));
        } else {
          bgColors.push(Array(COL).fill(passIdx % 2 === 0 ? "#ffffff" : "#f8fafc"));
          txtColors.push(Array(COL).fill("#1e293b"));
        }
        passIdx++;
      }
    });
    range.setBackgrounds(bgColors).setFontColors(txtColors);

    sheet.getRange(5,1,tableData.length,1).setFontWeight("bold");
    sheet.getRange(5,2,tableData.length,1).setHorizontalAlignment("left");
  }

  // "_FullPhone_" is only for matching Additional Marks on re-run — hide it
  if (meta.hasAdditionalMark) {
    try { sheet.hideColumns(headers.indexOf("_FullPhone_") + 1); } catch(x) {}
  }

  const lastDataRow = 4 + students.length;
  const timeStr = Utilities.formatDate(new Date(), "GMT+6", "EEEE, dd MMMM yyyy 'at' hh:mm a");

  sheet.getRange(lastDataRow+2,1,1,COL).merge()
    .setValue("Result Published: " + timeStr)
    .setFontSize(11).setFontWeight("bold").setFontColor("#1e293b")
    .setHorizontalAlignment("center").setBackground("#f1f5f9")
    .setBorder(true,true,true,true,false,false,"#cbd5e1",SpreadsheetApp.BorderStyle.SOLID)
    .setFontFamily("Anek Bangla");

  const footerText = "Developed By DreamRise & Ibrahim";
  const footerRich = SpreadsheetApp.newRichTextValue()
    .setText(footerText)
    .setLinkUrl(13,22,"https://www.facebook.com/dreamriseadmission")
    .setLinkUrl(25,32,"https://www.facebook.com/muhammadibrahimsiddiknasib")
    .build();
  sheet.getRange(lastDataRow+3,1,1,COL).merge()
    .setRichTextValue(footerRich)
    .setFontSize(10).setFontStyle("italic").setFontColor("#64748b")
    .setHorizontalAlignment("center").setBackground("#fafafa")
    .setBorder(true,true,true,true,false,false,"#e2e8f0",SpreadsheetApp.BorderStyle.SOLID)
    .setFontFamily("Hind Siliguri");

  sheet.setFrozenRows(4);
  [45,210,100,105].forEach((w,i) => sheet.setColumnWidth(i+1, w));

  const lastColLetter = colIndexToLetter(COL);
  const totalRows     = lastDataRow + 3;
  try {
    const existNR = ss.getNamedRanges().find(nr => nr.getName() === 'Print_Area_Ranking');
    if (existNR) existNR.remove();
    ss.setNamedRange('Print_Area_Ranking', sheet.getRange(1, 1, totalRows, COL));
  } catch(x) {}
}

// ===================== RENDER PDF REPORT =====================
function renderPdfReport(students, props, subjects, meta) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("PDF Report") || ss.insertSheet("PDF Report");
  sheet.clear();
  sheet.clearNotes();
  const COL = meta.hasAdditionalMark ? 9 : 8; // extra Grand Total column with Additional Mark

  sheet.setRowHeight(1, 72);
  sheet.getRange(1,1,1,COL).merge()
    .setBackground("#0f1f3d")
    .setValue("")
    .setHorizontalAlignment("center").setVerticalAlignment("middle");
  try {
    sheet.insertImage(DR_LOGO_DARK_URL, 1, 1, 10, 10).setWidth(190).setHeight(52);
  } catch(x) {
    sheet.getRange(1,1,1,COL)
      .setValue("DreamRise")
      .setFontColor("white").setFontSize(22).setFontWeight("Bold").setFontFamily("Anek Bangla");
    console.error("Logo insert failed (PDF Report):", x);
  }

  sheet.getRange(2,1,1,COL).merge()
    .setValue("- " + meta.examName.toUpperCase() + " RESULT -")
    .setBackground("#2563eb").setFontColor("white").setFontSize(14)
    .setFontWeight("Bold").setHorizontalAlignment("center").setFontFamily("Anek Bangla");

  const summary = buildSummaryText(meta);
  sheet.getRange(3,1,1,COL).merge()
    .setValue(summary)
    .setBackground("#f1f5f9").setFontWeight("Regular").setFontSize(10)
    .setHorizontalAlignment("center")
    .setBorder(true,true,true,true,true,true,"#cbd5e1",SpreadsheetApp.BorderStyle.SOLID)
    .setFontFamily("Anek Bangla");

  const pdfHeaders = ["Rank","Student Name","District","WhatsApp","Total C","Total W",
    meta.hasAdditionalMark ? "MCQ Score" : "Score"];
  if (meta.hasAdditionalMark) pdfHeaders.push("Grand Total");
  pdfHeaders.push("Result");
  sheet.getRange(4,1,1,COL)
    .setValues([pdfHeaders])
    .setBackground("#0f172a").setFontColor("white").setFontWeight("Bold")
    .setHorizontalAlignment("center").setFontFamily("Anek Bangla");

  let values=[], backgrounds=[], fontColors=[], mergeRows=[];
  let rowPtr = 5, passIdx = 0;

  students.forEach((s, idx) => {
    const isFail = !s.passed;
    let bgHex, txtAll, txtResult;
    if (isFail) {
      bgHex = "#fee2e2"; txtAll = "#991b1b"; txtResult = "#991b1b";
    } else if (passIdx < 3) {
      bgHex = "#dcfce7"; txtAll = "#166534"; txtResult = "#166534";
    } else {
      bgHex = passIdx % 2 === 0 ? "#ffffff" : "#f8fafc";
      txtAll = "#1e293b"; txtResult = "#1e293b";
    }
    if (!isFail) passIdx++;

    let row = [idx+1, s.name, s.district, s.phoneDisplay, s.totalC, s.totalW, s.score.toFixed(2)];
    let rowColors = ["#000000","#000000","#000000","#64748b","#000000","#000000","#000000"];
    if (meta.hasAdditionalMark) {
      row.push(typeof s.grandTotal === 'number' ? s.grandTotal.toFixed(2) : s.grandTotal);
      rowColors.push("#000000");
    }
    row.push(s.passed ? "PASS" : "FAIL");
    rowColors.push(txtResult);

    values.push(row);
    backgrounds.push(Array(COL).fill(bgHex));
    fontColors.push(rowColors);
    rowPtr++;

    // Detail line: per-subject MCQ breakdown + Additional Mark
    let detailParts = [];
    if (props.isSubjectWise === "true" && s.subData.length > 0) {
      subjects.forEach((sub, sIdx) => {
        const c  = s.subData[sIdx*3], w = s.subData[sIdx*3+1], sc = s.subData[sIdx*3+2];
        detailParts.push(`${sub.name}: ✔${c} ✘${w} [${sc}] পাস:${parseFloat(sub.pass).toFixed(2)}`);
      });
    }
    if (meta.hasAdditionalMark) {
      if (meta.addlMode === 'overall') {
        const v = s.addlOverallVal === "" ? "—" : s.addlOverallVal;
        const op = parseFloat(meta.addlOverall.pass || 0).toFixed(2);
        detailParts.push(`${meta.addlOverall.name}: ${v} (সর্বোচ্চ ${meta.addlOverall.max}, পাস:${op})`);
      } else if (meta.addlMode === 'subjectwise' && s.addlSubVals) {
        meta.addlSubjects.forEach((as, i) => {
          const v = s.addlSubVals[i] === "" ? "—" : s.addlSubVals[i];
          detailParts.push(`${as.name} (Addl): ${v}/${as.max} পাস:${as.pass}`);
        });
      }
    }
    if (detailParts.length > 0) {
      let detailRow = Array(COL).fill("");
      detailRow[1] = "  ↳ " + detailParts.join(" | ");
      values.push(detailRow);
      backgrounds.push(Array(COL).fill(bgHex));
      fontColors.push(Array(COL).fill("#475569"));
      mergeRows.push(rowPtr);
      rowPtr++;
    }
  });

  if (values.length > 0) {
    const range = sheet.getRange(5,1,values.length,COL);
    range.setValues(values).setBackgrounds(backgrounds).setFontColors(fontColors)
      .setFontFamily("Anek Bangla").setVerticalAlignment("middle").setHorizontalAlignment("center");
    sheet.getRange(5,2,values.length,1).setHorizontalAlignment("left");
    mergeRows.forEach(r => {
      sheet.getRange(r,2,1,COL-1).merge().setFontSize(9).setHorizontalAlignment("left");
    });
    sheet.getRange(5,1,values.length,1).setFontWeight("bold");
  }

  const lastDataRow = 4 + values.length;
  const timeStr = Utilities.formatDate(new Date(), "GMT+6", "EEEE, dd MMMM yyyy 'at' hh:mm a");

  sheet.getRange(lastDataRow+2,1,1,COL).merge()
    .setValue("Result Published: " + timeStr)
    .setFontSize(11).setFontWeight("bold").setFontColor("#1e293b")
    .setHorizontalAlignment("center").setBackground("#f1f5f9")
    .setBorder(true,true,true,true,false,false,"#cbd5e1",SpreadsheetApp.BorderStyle.SOLID)
    .setFontFamily("Anek Bangla");

  const footerRich = SpreadsheetApp.newRichTextValue()
    .setText("Developed By DreamRise & Ibrahim")
    .setLinkUrl(13,22,"https://www.facebook.com/dreamriseadmission")
    .setLinkUrl(25,32,"https://www.facebook.com/muhammadibrahimsiddiknasib")
    .build();
  sheet.getRange(lastDataRow+3,1,1,COL).merge()
    .setRichTextValue(footerRich)
    .setFontSize(10).setFontStyle("italic").setFontColor("#64748b")
    .setHorizontalAlignment("center").setBackground("#fafafa")
    .setBorder(true,true,true,true,false,false,"#e2e8f0",SpreadsheetApp.BorderStyle.SOLID)
    .setFontFamily("Hind Siliguri");

  sheet.setFrozenRows(4);
  const pdfColWidths = meta.hasAdditionalMark
    ? [45,180,100,100,55,55,60,70,60]
    : [45,180,100,100,55,55,60,60];
  pdfColWidths.forEach((w,i) => sheet.setColumnWidth(i+1, w));
}

// ===================== WEB APP: GET EXAM INFO =====================
function getExamInfo() {
  ensureFreshDataForPortal();
  try {
    const lastMeta = PropertiesService.getScriptProperties().getProperty('lastMeta');
    if (lastMeta) {
      const meta = JSON.parse(lastMeta);
      meta.summaryText = buildSummaryText(meta);
      meta.logoUrl      = DR_LOGO_DARK_URL;
      meta.logoLightUrl = DR_LOGO_LIGHT_URL;
      return meta;
    }
    const cached = CacheService.getScriptCache().get('rankDataMin');
    if (cached) {
      const meta = Object.assign({}, JSON.parse(cached).m);
      meta.summaryText  = buildSummaryText(meta);
      meta.logoUrl      = DR_LOGO_DARK_URL;
      meta.logoLightUrl = DR_LOGO_LIGHT_URL;
      return meta;
    }
    return { examName: SpreadsheetApp.getActiveSpreadsheet().getName(), logoUrl: DR_LOGO_DARK_URL, logoLightUrl: DR_LOGO_LIGHT_URL };
  } catch(e) {
    return { examName: SpreadsheetApp.getActiveSpreadsheet().getName(), logoUrl: DR_LOGO_DARK_URL, logoLightUrl: DR_LOGO_LIGHT_URL };
  }
}

// ===================== WEB APP: SEARCH STUDENT =====================
function searchStudent(phone) {
  try {
    const searchPhone = normalizePhone(phone);
    if (searchPhone.length < 7) return { error: "সঠিক ফোন নম্বর দিন!" };

    ensureFreshDataForPortal();

    let payload = getStudentDataPayload();

    if (payload) {
      const result = findStudentInMinifiedCache(payload, searchPhone);
      if (result) {
        result.meta.summaryText  = buildSummaryText(result.meta);
        result.meta.logoUrl      = DR_LOGO_DARK_URL;
        result.meta.logoLightUrl = DR_LOGO_LIGHT_URL;
        return result;
      }
    }

    const singleResult = computeSingleStudentAndMerge(searchPhone, payload);
    if (singleResult) {
      singleResult.meta.summaryText  = buildSummaryText(singleResult.meta);
      singleResult.meta.logoUrl      = DR_LOGO_DARK_URL;
      singleResult.meta.logoLightUrl = DR_LOGO_LIGHT_URL;
      return singleResult;
    }

    if (!payload) return { error: "⚠️ 'Manual Sync Ranking' চালু করুন!" };
    return { error: "❌ আপনার নম্বর পাওয়া যায়নি!" };
  } catch(e) {
    return { error: "⚠️ সার্ভার ত্রুটি: " + e.toString() };
  }
}

/**
 * Computes one student straight from the source sheet and merges them
 * into the stored payload. After taking the lock the payload is re-read,
 * so two simultaneous searches don't overwrite each other.
 */
function computeSingleStudentAndMerge(searchPhone, payloadHint) {
  const lock = LockService.getScriptLock();
  let gotLock = false;
  try {
    const props = PropertiesService.getScriptProperties().getProperties();
    if (!props.examName) return null;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getSheets()[0];
    const rawData = sourceSheet.getDataRange().getValues();

    const isSubWise     = props.isSubjectWise === "true";
    const subjects       = JSON.parse(props.subjectData || "[]");
    const posMark        = parseFloat(props.posMark)  || 1;
    const negMark         = parseFloat(props.negMark)  || 0;
    const globalPassPct  = parseFloat(props.globalPass)|| 0;
    const ansKeyRowIdx   = parseInt(props.ansKeyRow) - 1;

    // Additional Mark config (same as calculateAndRank)
    const hasAddl      = props.hasAdditionalMark === "true";
    const addlMode     = props.additionalMode || "";
    const addlOverall  = JSON.parse(props.additionalOverall  || "{}");
    const addlSubjects = JSON.parse(props.additionalSubjects || "[]");
    const addlMaxTotal = !hasAddl ? 0 :
      (addlMode === 'overall'
        ? (parseFloat(addlOverall.max) || 0)
        : addlSubjects.reduce((sum, as) => sum + (parseFloat(as.max) || 0), 0));
    const prevAddl = hasAddl ? readPreviousAdditionalMarks(ss, isSubWise, subjects, addlMode, addlSubjects, addlOverall) : {};

    let qCols = new Set();
    if (isSubWise) {
      subjects.forEach(sub => {
        const [s, e2] = sub.range.split(':').map(colLetterToIndex);
        for (let j = s; j <= e2; j++) qCols.add(j);
      });
    } else {
      const [s, e2] = (props.standardRange || "A:A").split(':').map(colLetterToIndex);
      for (let j = s; j <= e2; j++) qCols.add(j);
    }

    const titleRowIdx = findHeaderRowIdx(rawData);
    if (titleRowIdx === -1) return null;
    const titleRow = rawData[titleRowIdx];

    let nCol = -1, dCol = -1, wCol = -1;
    titleRow.forEach((h, j) => {
      if (qCols.has(j)) return;
      const head = String(h).toLowerCase();
      if      (/নাম|name|student/i.test(head))             nCol = j;
      else if (/জেলা|district|college|বিভাগ/i.test(head)) dCol = j;
      else if (/whatsapp|phone|মোবাইল|contact/i.test(head))wCol = j;
    });
    if (nCol === -1 || wCol === -1) return null;

    const ansKeyRow  = rawData[ansKeyRowIdx];
    const ansKeyName = String(ansKeyRow[nCol] || "").trim();

    // Find this phone's row (skip header and answer key)
    let matchRow = null;
    for (let i = 0; i < rawData.length; i++) {
      if (i === titleRowIdx || i === ansKeyRowIdx) continue;
      const row  = rawData[i];
      const name = String(row[nCol] || "").trim();
      const phoneDigits = normalizePhone(row[wCol]);
      if (!name || phoneDigits.length < 7) continue;
      if (name === ansKeyName) continue;
      if (phoneDigits === searchPhone) { matchRow = row; break; }
    }
    if (!matchRow) return null; // not in the source sheet either

    let totalC = 0, totalW = 0, totalScore = 0, subFail = false, subDataForTable = [];
    if (isSubWise) {
      subjects.forEach(sub => {
        const [s, e2] = sub.range.split(':').map(colLetterToIndex);
        let c = 0, w = 0;
        for (let j = s; j <= e2; j++) {
          const kA = ansKeyRow[j], sA = matchRow[j];
          if (String(kA).trim() !== "") {
            if (String(sA).trim() !== "") { if (isCorrect(sA, kA)) c++; else w++; }
          }
        }
        const score = (c * posMark) - (w * negMark);
        const subPassMark = parseFloat(sub.pass) || 0;
        if (score < subPassMark) subFail = true;
        totalC += c; totalW += w; totalScore += score;
        subDataForTable.push(c, w, score.toFixed(2));
      });
    } else {
      const [s, e2] = (props.standardRange || "A:A").split(':').map(colLetterToIndex);
      for (let j = s; j <= e2; j++) {
        const kA = ansKeyRow[j], sA = matchRow[j];
        if (String(kA).trim() !== "" && String(sA).trim() !== "") {
          if (isCorrect(sA, kA)) totalC++; else totalW++;
        }
      }
      totalScore = (totalC * posMark) - (totalW * negMark);
    }

    const totalQCount       = qCols.size;
    const fullMarksPossible = totalQCount * posMark;
    const name    = String(matchRow[nCol]).trim();
    const phone   = normalizePhone(matchRow[wCol]);
    const district = dCol !== -1 ? String(matchRow[dCol] || "N/A").trim() : "N/A";

    // Additional Mark, same rules as the bulk sync
    let addlScore = 0, addlSubFail = false, addlOverallVal = "", addlSubVals = null;
    if (hasAddl) {
      const prev = prevAddl[phone];
      if (addlMode === 'overall') {
        if (prev && typeof prev.overall === 'number') {
          addlOverallVal = prev.overall;
          addlScore = prev.overall;
          if (prev.overall < (parseFloat(addlOverall.pass) || 0)) addlSubFail = true;
        }
      } else if (addlMode === 'subjectwise') {
        addlSubVals = addlSubjects.map((as, i) => {
          const v = (prev && prev.subs && typeof prev.subs[i] === 'number') ? prev.subs[i] : "";
          if (typeof v === 'number') {
            addlScore += v;
            if (v < (parseFloat(as.pass) || 0)) addlSubFail = true;
          }
          return v;
        });
      }
    }
    const grandTotal   = totalScore + addlScore;
    const grandFullMax = fullMarksPossible + addlMaxTotal;
    const isPassed = !subFail && !addlSubFail && grandTotal >= (grandFullMax * globalPassPct / 100);
    const addlData = hasAddl
      ? (addlMode === 'overall' ? { overall: addlOverallVal } : { subs: addlSubVals || [] })
      : null;

    // Take the lock, then re-read the payload, merge and save
    gotLock = lock.tryLock(DR_LOCK_WAIT_MS);
    const freshPayload = gotLock ? (getStudentDataPayload() || payloadHint) : payloadHint;

    let students = freshPayload ? freshPayload.s.slice() : [];
    students = students.filter(s => normalizePhone(s[2]) !== phone); // safety dedupe
    students.push([name, district, phone, totalC, totalW, totalScore, isPassed ? 1 : 0, subDataForTable,
                   grandTotal, addlData]);

    const rankScore = s => (hasAddl && typeof s[8] === 'number') ? s[8] : s[5];
    students.sort((a, b) => {
      const aPass = a[6] === 1, bPass = b[6] === 1;
      if (aPass !== bPass) return aPass ? -1 : 1;
      const bs = rankScore(b), as_ = rankScore(a);
      if (bs !== as_) return bs - as_;
      return a[4] - b[4];
    });

    let passCount = 0, highScore = -Infinity, sum = 0;
    students.forEach(s => {
      if (s[6] === 1) passCount++;
      const sc = rankScore(s);
      if (sc > highScore) highScore = sc;
      sum += sc;
    });

    const baseMeta = freshPayload ? Object.assign({}, freshPayload.m) : {
      examName:      props.examName,
      totalQ:        totalQCount,
      fullMarks:     (fullMarksPossible + addlMaxTotal).toFixed(2),
      passPercent:   globalPassPct,
      passThreshold: (grandFullMax * globalPassPct / 100).toFixed(2),
      negMark, posMark,
      isSubjectWise: isSubWise,
      subjects,
      hasAdditionalMark: hasAddl,
      addlMode, addlOverall, addlSubjects
    };
    baseMeta.examinees = students.length;
    baseMeta.passCount = passCount;
    baseMeta.failCount = students.length - passCount;
    baseMeta.avg       = students.length > 0 ? (sum / students.length).toFixed(2) : "0";
    baseMeta.highScore = (highScore === -Infinity ? 0 : highScore).toFixed(2);

    const newPayload = { s: students, m: baseMeta, t: Date.now() };

    if (gotLock) {
      try {
        const json = JSON.stringify(newPayload);
        CacheService.getScriptCache().put('rankDataMin', json, 21600);
        saveBackupSheet(json);
        PropertiesService.getScriptProperties().setProperty('lastMeta', JSON.stringify(baseMeta));
      } catch(x) { console.error("computeSingleStudentAndMerge persist failed:", x); }
    }

    scheduleBackgroundSync();

    return findStudentInMinifiedCache(newPayload, searchPhone);

  } catch(err) {
    console.error("computeSingleStudentAndMerge failed:", err);
    return null;
  } finally {
    if (gotLock) { try { lock.releaseLock(); } catch(x) {} }
  }
}

function findStudentInMinifiedCache(cacheObj, searchPhone) {
  const students = cacheObj.s, meta = cacheObj.m;
  const examinees = students.length;
  for (let i = 0; i < students.length; i++) {
    const s = students[i]; // [name,district,phone,totalC,totalW,mcqScore,passFlag,subData,grandTotal,addlData]
    if (normalizePhone(s[2]) !== searchPhone) continue;
    const rank = i+1;
    let subjects = [];
    if (s[7] && s[7].length > 0) {
      (meta.subjects||[]).forEach((sub,j) => {
        subjects.push({
          name:    sub.name,
          correct: parseInt(s[7][j*3])   || 0,
          wrong:   parseInt(s[7][j*3+1]) || 0,
          score:   parseFloat(s[7][j*3+2]||0).toFixed(2),
          pass:    sub.pass
        });
      });
    }

    // Additional Mark breakdown for the portal
    let additional = null;
    const hasAddl  = meta.hasAdditionalMark;
    if (hasAddl) {
      const ad = s[9] || {};
      if (meta.addlMode === 'overall') {
        const val = (ad.overall !== undefined && ad.overall !== "" && ad.overall !== null) ? ad.overall : null;
        additional = {
          mode: 'overall',
          name: meta.addlOverall ? meta.addlOverall.name : 'Additional',
          max:  meta.addlOverall ? meta.addlOverall.max  : 0,
          pass: meta.addlOverall ? (meta.addlOverall.pass || 0) : 0,
          value: val
        };
      } else if (meta.addlMode === 'subjectwise') {
        additional = {
          mode: 'subjectwise',
          subs: (meta.addlSubjects||[]).map((as,j) => ({
            name: as.name, max: as.max, pass: as.pass,
            value: (ad.subs && ad.subs[j] !== undefined && ad.subs[j] !== "" && ad.subs[j] !== null) ? ad.subs[j] : null
          }))
        };
      }
    }
    const grandTotal = (typeof s[8] === 'number') ? s[8] : parseFloat(s[5]);

    return {
      success:true, rank, name:s[0], district:s[1],
      score:parseFloat(s[5]).toFixed(2), result:s[6]===1?"PASS":"FAIL",
      totalCorrect:s[3], totalWrong:s[4],
      percentile:(((examinees-rank+1)/examinees)*100).toFixed(2),
      subjects, meta,
      hasAdditionalMark: !!hasAddl,
      additional,
      grandTotal: grandTotal.toFixed(2)
    };
  }
  return null;
}

/**
 * Shows failed / weak students with a WhatsApp button that opens a
 * pre-filled (editable) message. Data comes from the cached lists saved
 * by the last calculateAndRank().
 */
function showFailReportDialog() {
  const ui = SpreadsheetApp.getUi();
  const cached = CacheService.getScriptCache().get('failedListMin');
  if (!cached) {
    ui.alert('⚠️ কোনো ডেটা পাওয়া যায়নি। আগে "🔄 Manual Sync Ranking" চালিয়ে নিন, তারপর আবার চেষ্টা করুন।');
    return;
  }

  const payload      = JSON.parse(cached);
  const failList     = payload.failList     || payload.list || []; // old cache format fallback
  const weakPassList = payload.weakPassList || [];

  if (failList.length === 0 && weakPassList.length === 0) {
    ui.alert('🎉 সবাই ভালো করেছে — কোনো ফেইল বা দুর্বল সাবজেক্ট পাওয়া যায়নি!');
    return;
  }

  /** Short Bengali phrase naming a student's weak subjects */
  function weakSubjectPhrase(s) {
    const names = [...(s.weakSubjects || []), ...(s.weakAddlSubjects || [])];
    if (names.length === 0) return '';
    if (names.length === 1) return `বিশেষ করে "${names[0]}" বিষয়ে`;
    return `বিশেষ করে "${names.join('", "')}" — এই বিষয়গুলোতে`;
  }

  function buildRow(s, i, isFail) {
    const waNumber = "880" + s.phone; // BD country code + normalized 10 digits
    const weakPhrase = weakSubjectPhrase(s);

    let message;
    if (isFail) {
      message = weakPhrase
        ? `আসসালামু আলাইকুম ${s.name}, আমরা "${payload.examName}" পরীক্ষার রেজাল্ট নিয়ে তোমার সাথে কথা বলতে চাই। তোমার নম্বর (${s.score}/${payload.fullMarks}) প্রত্যাশিত অনুযায়ী হয়নি, ${weakPhrase} দুর্বলতা দেখা যাচ্ছে — কোথায় সমস্যা হচ্ছে জানাও, আমরা একসাথে বসে ঠিক করে নেব কীভাবে ভালো করা যায়।`
        : `আসসালামু আলাইকুম ${s.name}, আমরা "${payload.examName}" পরীক্ষার রেজাল্ট নিয়ে তোমার সাথে কথা বলতে চাই। তোমার নম্বর (${s.score}/${payload.fullMarks}) প্রত্যাশিত অনুযায়ী হয়নি — কোথায় সমস্যা হচ্ছে জানাও, আমরা একসাথে বসে ঠিক করে নেব কীভাবে ভালো করা যায়।`;
    } else {
      message = `আসসালামু আলাইকুম ${s.name}, তুমি "${payload.examName}" পরীক্ষায় সার্বিকভাবে ভালো করেছ (${s.score}/${payload.fullMarks}) — অভিনন্দন! তবে ${weakPhrase} একটু পিছিয়ে আছ বলে মনে হচ্ছে। এই বিষয়ে(গুলোতে) আলাদা মনোযোগ দিলে সার্বিক ফলাফল আরও ভালো হবে — কথা বলে জেনে নিতে চাই কোথায় আটকাচ্ছ।`;
    }

    const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
    return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${i+1}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${s.name}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${s.score}/${payload.fullMarks}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${weakPhrase ? weakPhrase.replace(/^বিশেষ করে /,'') : '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${s.phone}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">
          <a href="${waLink}" target="_blank"
             style="background:#25D366;color:white;padding:6px 12px;border-radius:6px;text-decoration:none;font-weight:600;">
             WhatsApp
          </a>
        </td>
      </tr>`;
  }

  function buildTable(list, isFail) {
    if (list.length === 0) return '<p style="color:#64748b;">কেউ নেই।</p>';
    const rows = list.map((s, i) => buildRow(s, i, isFail)).join('');
    return `
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#0f172a;color:white;">
            <th style="padding:8px;">#</th><th style="padding:8px;">নাম</th>
            <th style="padding:8px;">মার্ক</th><th style="padding:8px;">দুর্বল বিষয়</th>
            <th style="padding:8px;">নম্বর</th><th style="padding:8px;">যোগাযোগ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  const html = `
    <div style="font-family:'Anek Bangla',sans-serif;padding:10px;">
      <p style="margin-bottom:10px;">নিচের WhatsApp বাটনে ক্লিক করলে সরাসরি চ্যাট খুলে যাবে, নির্দিষ্ট দুর্বল
      বিষয় উল্লেখ করেই মেসেজ আগে থেকে লেখা থাকবে (চাইলে পাঠানোর আগে এডিট করতে পারবেন)।</p>

      <h3 style="margin:15px 0 8px;color:#991b1b;">❌ Overall Fail করেছে (${failList.length} জন)</h3>
      ${buildTable(failList, true)}

      <h3 style="margin:20px 0 8px;color:#b45309;">⚠️ Pass করেছে কিন্তু নির্দিষ্ট বিষয়ে দুর্বল (${weakPassList.length} জন)</h3>
      ${buildTable(weakPassList, false)}
    </div>`;

  ui.showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(750).setHeight(550),
    `📋 Fail / Weak Subject Report — ${payload.examName}`
  );
}

function showStatisticsDialog() {
  try {
    const payload = getStudentDataPayload();
    if (!payload) { SpreadsheetApp.getUi().alert("আগে Sync করুন।"); return; }

    const { s: students, m: meta } = payload;
    const fullM      = parseFloat(meta.fullMarks) || 400;
    const passRate   = meta.examinees > 0 ? ((meta.passCount / meta.examinees) * 100).toFixed(1) : "0";
    const failRate   = (100 - parseFloat(passRate)).toFixed(1);

    const buckets = Array(10).fill(0);
    let lowestScore = Infinity;
    students.forEach(s => {
      const score = parseFloat(s[5]);
      if (score < lowestScore) lowestScore = score;
      const pct    = (score / fullM) * 100;
      const bucket = Math.min(9, Math.max(0, Math.floor(pct / 10)));
      buckets[bucket]++;
    });
    if (lowestScore === Infinity) lowestScore = 0;

    const passThreshPct = parseFloat(meta.passPercent) || 45;
    const passBucketIdx = Math.floor(passThreshPct / 10);

    const bandDefs = [
      { label: '90–100%',   rangeStr: '(90+ নিশ্চিত ভালো করবে! ইনশাআল্লাহ।)',    bg:'#1d9e75', tc:'#04342c', buckets:[9]     },
      { label: '80–90%',    rangeStr: '(80+ ভালো করবে! ইনশাআল্লাহ।)', bg:'#5dcaa5', tc:'#085041', buckets:[8]     },
      { label: '70–80%',    rangeStr: '(70+ ভালো)', bg:'#97c459', tc:'#173404', buckets:[7]     },
      { label: '60–70%',    rangeStr: '(60+ ভালো, তবে আরো ভালো করতে হবে।)', bg:'#ba7517', tc:'#412402', buckets:[6]     },
      { label: '50–60%',    rangeStr: '(50+ আশঙ্কাজনক)', bg:'#EF9F27', tc:'#412402', buckets:[5]     },
      { label: 'Below 50%', rangeStr: '(<50 হতাশাজনক)',     bg:'#e24b4a', tc:'#501313', buckets:[0,1,2,3,4] }
    ];
    const bandCounts = bandDefs.map(b => b.buckets.reduce((a, i) => a + buckets[i], 0));
    const totalEx    = meta.examinees || 48;

    const barColorsArr = buckets.map((_, i) =>
      i < passBucketIdx ? '#f09595' : i === passBucketIdx ? '#EF9F27' : '#5DCAA5'
    );

    const subjects   = meta.subjects || [];
    const colToNum   = c => { let n=0; c=String(c).toUpperCase().replace(/[^A-Z]/g,''); for(let i=0;i<c.length;i++) n=n*26+(c.charCodeAt(i)-64); return n; };
    const subNames   = subjects.map(s => s.name);
    const subPass    = subjects.map(s => parseFloat(s.pass) || 0);
    const subTotalQ  = subjects.map(s => {
      if (!s.range || !s.range.includes(':')) return 0;
      const parts = s.range.split(':');
      return colToNum(parts[1]) - colToNum(parts[0]) + 1;
    });

    let bandRowsHtml = '';
    bandDefs.forEach((b, i) => {
      const count = bandCounts[i];
      const pct   = totalEx > 0 ? Math.round((count / totalEx) * 100) : 0;
      const barW  = Math.max(pct, count > 0 ? 6 : 0);
      bandRowsHtml += `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <div style="font-size:11px;color:#475569;min-width:115px;text-align:right;flex-shrink:0;">
            ${b.label} <span style="color:#94a3b8;">${b.rangeStr}</span>
          </div>
          <div style="flex:1;height:24px;background:#f1f5f9;border-radius:6px;overflow:hidden;">
            <div style="width:${barW}%;height:100%;background:${b.bg};border-radius:6px;"></div>
          </div>
          <div style="font-size:11px;font-weight:600;color:${b.bg};min-width:28px;text-align:center;">${count}</div>
          <div style="font-size:11px;color:#94a3b8;min-width:34px;">${pct}%</div>
        </div>`;
    });

    const bucketsJson  = JSON.stringify(buckets);
    const barColorsJson= JSON.stringify(barColorsArr);
    const subNamesJson = JSON.stringify(subNames);
    const subPassJson  = JSON.stringify(subPass);
    const subTotalJson = JSON.stringify(subTotalQ);
    const summaryText  = buildSummaryText(meta);

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Anek+Bangla:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *, body { box-sizing:border-box; margin:0; padding:0; font-family:'Anek Bangla','Segoe UI',Arial,sans-serif; }
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;color:#1e293b;font-size:13px;padding:0}
  .topbar{background:#1e3a8a;padding:13px 18px;display:flex;align-items:center;gap:10px}
  .topbar img.logo{height:30px;width:auto;flex-shrink:0;border-radius:4px}
  .exam-name{font-size:14px;font-weight:600;color:#fff;flex:1}
  .exam-sub{font-size:10px;color:#93c5fd;margin-top:2px}
  .summary-bar{background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:8px 14px;font-size:11px;color:#3730a3;text-align:center;font-weight:600;margin-bottom:12px}
  .pdf-btn{display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);padding:7px 14px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;flex-shrink:0;white-space:nowrap}
  .pdf-btn:hover{background:rgba(255,255,255,.25)}
  .body{padding:14px 16px}
  .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
  .mc{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 13px}
  .ml{font-size:10px;color:#64748b;letter-spacing:.04em;margin-bottom:4px}
  .mv{font-size:20px;font-weight:700;line-height:1}
  .ms{font-size:10px;margin-top:3px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:13px 15px;margin-bottom:10px}
  .section-label{font-size:10px;font-weight:700;color:#64748b;letter-spacing:.06em;text-transform:uppercase;margin-bottom:9px}
  .legend-row{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px}
  .leg{display:flex;align-items:center;gap:5px;font-size:11px;color:#475569}
  .leg-dot{width:10px;height:10px;border-radius:2px;flex-shrink:0}
  .row2{display:grid;grid-template-columns:1.5fr 1fr;gap:10px;margin-bottom:10px}
  .stat-rows{display:flex;flex-direction:column}
  .sr{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:12px}
  .sr:last-child{border:none}
  .sk{color:#64748b}
  .sv{font-weight:700;color:#1e293b}
  .footer-row{display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid #f1f5f9}
  .footer-note{font-size:10px;color:#94a3b8}
  @media print{
    body{background:#fff}
    .topbar{background:#1e3a8a!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .pdf-btn{display:none!important}
    .mc,.card{break-inside:avoid;border:1px solid #e2e8f0!important}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
</style>
</head>
<body>

<div class="topbar">
  <img class="logo" src="${DR_LOGO_URL}" alt="DreamRise">
  <div style="flex:1">
    <div class="exam-name">${meta.examName} — Statistics</div>
    <div class="exam-sub">${meta.examinees} examinees &nbsp;·&nbsp; ${subjects.length} subjects &nbsp;·&nbsp; Full marks ${meta.fullMarks}</div>
  </div>
  <button class="pdf-btn" onclick="window.print()">
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="3" y="1" width="10" height="9" rx="1" stroke="white" stroke-width="1.5"/><rect x="1" y="7" width="14" height="7" rx="1" stroke="white" stroke-width="1.5"/><rect x="4" y="11" width="8" height="1.5" rx=".75" fill="white"/></svg>
    Print / PDF
  </button>
</div>

<div class="body">

  <div class="summary-bar">${summaryText}</div>

  <div class="metrics">
    <div class="mc">
      <div class="ml">EXAMINEES</div>
      <div class="mv" style="color:#1e293b">${meta.examinees}</div>
      <div class="ms" style="color:#64748b">total registered</div>
    </div>
    <div class="mc">
      <div class="ml">PASSED</div>
      <div class="mv" style="color:#15803d">${meta.passCount}</div>
      <div class="ms" style="color:#15803d">${passRate}% pass rate</div>
    </div>
    <div class="mc">
      <div class="ml">FAILED</div>
      <div class="mv" style="color:#b91c1c">${meta.failCount}</div>
      <div class="ms" style="color:#b91c1c">${failRate}% fail rate</div>
    </div>
    <div class="mc">
      <div class="ml">AVG SCORE</div>
      <div class="mv" style="color:#1d4ed8">${parseFloat(meta.avg).toFixed(1)}</div>
      <div class="ms" style="color:#64748b">highest: ${meta.highScore}</div>
    </div>
  </div>

  <div class="row2">
    <div class="card">
      <div class="section-label">Score distribution</div>
      <div class="legend-row">
        <span class="leg"><span class="leg-dot" style="background:#e24b4a"></span>Fail zone</span>
        <span class="leg"><span class="leg-dot" style="background:#EF9F27"></span>Borderline</span>
        <span class="leg"><span class="leg-dot" style="background:#5DCAA5"></span>Pass zone</span>
      </div>
      <div style="position:relative;width:100%;height:165px"><canvas id="dc"></canvas></div>
    </div>
    <div class="card">
      <div class="section-label">Key metrics</div>
      <div class="stat-rows">
        <div class="sr"><span class="sk">Highest</span><span class="sv" style="color:#15803d">${meta.highScore}</span></div>
        <div class="sr"><span class="sk">Lowest</span><span class="sv" style="color:#b91c1c">${lowestScore.toFixed(2)}</span></div>
        <div class="sr"><span class="sk">Pass mark</span><span class="sv">${meta.passThreshold}</span></div>
        <div class="sr"><span class="sk">Pass %</span><span class="sv">${meta.passPercent}%</span></div>
        <div class="sr"><span class="sk">Full marks</span><span class="sv">${meta.fullMarks}</span></div>
        <div class="sr"><span class="sk">Total Q</span><span class="sv">${meta.totalQ}</span></div>
        <div class="sr"><span class="sk">+ve mark</span><span class="sv" style="color:#15803d">+${meta.posMark}</span></div>
        <div class="sr"><span class="sk">-ve mark</span><span class="sv" style="color:#b91c1c">−${meta.negMark}</span></div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="section-label">Rank-band breakdown</div>
    <div class="legend-row" style="margin-bottom:14px">
      <span class="leg"><span class="leg-dot" style="background:#1d9e75"></span>Excellent (80–100%)</span>
      <span class="leg"><span class="leg-dot" style="background:#97c459"></span>Good (60–80%)</span>
      <span class="leg"><span class="leg-dot" style="background:#EF9F27"></span>Borderline (50–60%)</span>
      <span class="leg"><span class="leg-dot" style="background:#e24b4a"></span>Fail (&lt;50%)</span>
    </div>
    ${bandRowsHtml}
  </div>

  ${subjects.length > 0 ? `
  <div class="card">
    <div class="section-label">Subject overview</div>
    <div class="legend-row" style="margin-bottom:10px">
      <span class="leg"><span class="leg-dot" style="background:#378add"></span>Pass mark (minimum required)</span>
      <span class="leg"><span class="leg-dot" style="background:#b5d4f4"></span>Total questions in subject</span>
    </div>
    <div style="position:relative;width:100%;height:${Math.max(120, subjects.length * 44 + 30)}px">
      <canvas id="sc"></canvas>
    </div>
  </div>` : ''}

  <div class="footer-row">
    <span class="footer-note">Developed by DreamRise &amp; Muhammad Ibrahim &nbsp;·&nbsp; Generated ${new Date().toLocaleString('bn-BD')}</span>
    <button class="pdf-btn" style="background:#1e3a8a;border-color:#1e3a8a" onclick="window.print()">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="3" y="1" width="10" height="9" rx="1" stroke="white" stroke-width="1.5"/><rect x="1" y="7" width="14" height="7" rx="1" stroke="white" stroke-width="1.5"/><rect x="4" y="11" width="8" height="1.5" rx=".75" fill="white"/></svg>
      Download PDF
    </button>
  </div>

</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<script>
  Chart.defaults.font.family = "'Anek Bangla', sans-serif";
  const buckets    = ${bucketsJson};
  const barColors  = ${barColorsJson};
  const distLabels = ['0–10%','10–20%','20–30%','30–40%','40–50%','50–60%','60–70%','70–80%','80–90%','90–100%'];

  new Chart(document.getElementById('dc'), {
    type: 'bar',
    data: {
      labels: distLabels,
      datasets: [{
        data: buckets,
        backgroundColor: barColors,
        borderRadius: 5,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ' ' + c.raw + ' students' } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 40, autoSkip: false } },
        y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { stepSize: 2, font: { size: 9 } }, beginAtZero: true }
      }
    }
  });

  const subNames  = ${subNamesJson};
  const subPass   = ${subPassJson};
  const subTotalQ = ${subTotalJson};

  if (subNames.length > 0 && document.getElementById('sc')) {
    new Chart(document.getElementById('sc'), {
      type: 'bar',
      data: {
        labels: subNames,
        datasets: [
          { label: 'Pass mark', data: subPass,   backgroundColor: '#378add', borderRadius: 4, borderSkipped: false, barThickness: 16 },
          { label: 'Total Q',   data: subTotalQ, backgroundColor: '#b5d4f4', borderRadius: 4, borderSkipped: false, barThickness: 16 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + c.raw } }
        },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10 } }, beginAtZero: true },
          y: { grid: { display: false }, ticks: { font: { size: 12 } } }
        }
      }
    });
  }
</script>
</body>
</html>`;

    SpreadsheetApp.getUi().showModalDialog(
      HtmlService.createHtmlOutput(html).setWidth(640).setHeight(640),
      meta.examName + ' — Statistics'
    );
  } catch(e) {
    SpreadsheetApp.getUi().alert("Statistics দেখাতে সমস্যা: " + e.message);
  }
}

// ============================================================
// 📘 Answer Key & Explanation Publisher
// ------------------------------------------------------------
// Pulls questions/options from Google Forms into the "Answer Setup"
// sheet; you fill in the correct answer and explanation, then print a
// PDF. Uses its own "ak" properties, separate from the ranking system.
// Several Forms can be combined into one "book" PDF (one Form = one
// section). Three answer modes: full / practice / blank.
// ============================================================

const AK_SHEET_NAME = 'Answer Setup';

/** Extracts the Form ID from a Form edit link. */
function extractFormId(url) {
  url = String(url).trim();
  if (/\/forms\/d\/e\//.test(url)) {
    throw new Error('এটা পাবলিক শেয়ার লিংক (viewform) মনে হচ্ছে। ফর্মটা Edit মোডে খুলে ঠিকানার বার থেকে লিংক দাও (…/forms/d/FORM_ID/edit)।');
  }
  const m = url.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) return url; // raw ID pasted directly
  throw new Error('লিংক থেকে Form ID খুঁজে পাওয়া যায়নি। Edit মোডের লিংক (…/edit) দাও।');
}

/**
 * Dialog to paste one or more Form edit links (one per line).
 * Each link is imported with its own google.script.run call
 * (importOneAnswerKeyForm): only that section is rewritten, progress and
 * a timer are live, and a failed batch can be resumed.
 */
function fetchQuestionsFromForm() {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { box-sizing:border-box; }
  body{ font-family:'Segoe UI',Arial,sans-serif; margin:0; padding:16px; color:#0f172a; background:#f8fafc; }
  p{ font-size:12.5px; color:#475569; line-height:1.6; margin:0 0 10px; }
  textarea{
    width:100%; height:130px; font-family:monospace; font-size:12.5px; padding:10px;
    border:1px solid #cbd5e1; border-radius:8px; resize:vertical;
  }
  .row{ display:flex; justify-content:flex-end; gap:8px; margin-top:12px; }
  button{
    font-family:inherit; font-size:13px; font-weight:600; padding:8px 16px;
    border-radius:8px; cursor:pointer;
  }
  #go{ background:#0f172a; color:#fff; border:1px solid #0f172a; }
  #go:disabled{ opacity:.6; cursor:default; }
  #close{ background:#fff; color:#0f172a; border:1px solid #cbd5e1; }
  #retry{ background:#b45309; color:#fff; border:1px solid #b45309; display:none; }
  #progress{
    display:none; margin-top:14px; padding:10px 12px; background:#eff6ff;
    border:1px solid #bfdbfe; border-radius:8px; font-size:12.5px;
  }
  #progress .stats{ display:flex; justify-content:space-between; font-weight:700; color:#1d4ed8; margin-bottom:6px; }
  #log{ font-size:12px; white-space:pre-wrap; line-height:1.7; max-height:170px; overflow-y:auto; }
</style></head>
<body>
  <p>একটা বা একাধিক Google Form-এর <b>Edit লিংক</b> দাও (…/forms/d/FORM_ID/edit) — একাধিক হলে <b>এক লাইনে একটা</b> করে। প্রতিটা ফর্মের নিজের টাইটেলই তার পরীক্ষার নাম হিসেবে বসবে। আগে থেকে আনা কোনো ফর্মের লিংক আবার দিলে শুধু সেই ফর্মেরটাই আপডেট হবে, বাকিগুলো অক্ষত থাকবে — তাই পরেও এসে নতুন ফর্মের লিংক যোগ করা যাবে। প্রতিটা ফর্ম একে একে আনা হয়, তাই নিচে সাথে সাথে লাইভ অগ্রগতি দেখা যাবে।</p>
  <textarea id="links" placeholder="https://docs.google.com/forms/d/FORM_ID_1/edit
https://docs.google.com/forms/d/FORM_ID_2/edit"></textarea>
  <div class="row">
    <button id="close" onclick="google.script.host.close()">বন্ধ করো</button>
    <button id="retry" onclick="retryRemaining()">বাকিগুলো আনার চেষ্টা করো</button>
    <button id="go" onclick="run()">আনুন</button>
  </div>
  <div id="progress">
    <div class="stats">
      <span id="counter">০ / ০ সম্পন্ন</span>
      <span id="timer">⏱ ০:০০</span>
    </div>
    <div id="log"></div>
  </div>
  <script>
    var queue = [], idx = 0, okCount = 0, failCount = 0, startTime = 0, timerHandle = null;

    function fmtTime(ms){
      var s = Math.floor(ms / 1000);
      var m = Math.floor(s / 60);
      s = s % 60;
      return m + ':' + (s < 10 ? '0' : '') + s;
    }
    function tickTimer(){
      document.getElementById('timer').textContent = '⏱ ' + fmtTime(Date.now() - startTime);
    }
    function updateCounter(){
      document.getElementById('counter').textContent = (okCount + failCount) + ' / ' + queue.length + ' সম্পন্ন';
    }
    function appendLog(line){
      var log = document.getElementById('log');
      log.textContent += (log.textContent ? '\\n' : '') + line;
      log.scrollTop = log.scrollHeight;
    }

    function run(){
      var text = document.getElementById('links').value.trim();
      if (!text) return;
      queue = text.split('\\n').map(function(s){ return s.trim(); }).filter(Boolean);
      idx = 0; okCount = 0; failCount = 0;
      document.getElementById('log').textContent = '';
      document.getElementById('progress').style.display = 'block';
      document.getElementById('retry').style.display = 'none';
      document.getElementById('go').disabled = true;
      startTime = Date.now();
      clearInterval(timerHandle);
      timerHandle = setInterval(tickTimer, 500);
      updateCounter();
      processNext();
    }

    function retryRemaining(){
      document.getElementById('retry').style.display = 'none';
      document.getElementById('go').disabled = true;
      clearInterval(timerHandle);
      startTime = Date.now();
      timerHandle = setInterval(tickTimer, 500);
      processNext();
    }

    function processNext(){
      if (idx >= queue.length) {
        clearInterval(timerHandle);
        tickTimer();
        document.getElementById('go').disabled = false;
        appendLog('✅ সম্পন্ন! মোট সময় লেগেছে ' + fmtTime(Date.now() - startTime) + '।');
        return;
      }
      var link = queue[idx];
      google.script.run
        .withSuccessHandler(function(res){
          idx++;
          if (res.ok) { okCount++; appendLog('✅ ' + res.title + ' — ' + res.message); }
          else { failCount++; appendLog('⚠️ ' + res.title + ' — ' + res.message); }
          updateCounter();
          processNext();
        })
        .withFailureHandler(function(err){
          // Unexpected error (quota/timeout): stop here; the retry button
          // resumes from the same link because idx is not advanced.
          clearInterval(timerHandle);
          tickTimer();
          appendLog('⚠️ থেমে গেছে: ' + (err.message || err) + ' — নিচের বাটনে ক্লিক করে বাকি ' + (queue.length - idx) + 'টা আবার চেষ্টা করো।');
          document.getElementById('retry').style.display = 'inline-block';
          document.getElementById('go').disabled = false;
        })
        .importOneAnswerKeyForm(link);
    }
  </script>
</body></html>`;
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(480).setHeight(470),
    '📘 ফর্ম থেকে প্রশ্ন আনুন'
  );
}

/**
 * Called from the import dialog: imports ONE Form's multiple-choice
 * questions into its own section of "Answer Setup" (divider row +
 * question rows, Q.No like 2.3). Re-importing a Form rebuilds only its
 * own section and keeps its Correct Answer / Explanation values; a new
 * Form is appended with the next section number.
 * Returns { ok, title, count, message }.
 */
function importOneAnswerKeyForm(link) {
  let formId;
  try {
    formId = extractFormId(link);
  } catch (e) {
    return { ok: false, title: link, count: 0, message: e.message };
  }

  let form;
  try {
    form = FormApp.openById(formId);
  } catch (e) {
    return { ok: false, title: link, count: 0, message: 'ফর্মটা খুলতে পারিনি (আইডি ভুল বা তুমি owner/editor না)।' };
  }

  const examTitle = String(form.getTitle() || 'পরীক্ষা').trim();
  const items = form.getItems(FormApp.ItemType.MULTIPLE_CHOICE);
  if (items.length === 0) {
    return { ok: false, title: examTitle, count: 0, message: 'কোনো Multiple choice প্রশ্ন পাওয়া যায়নি।' };
  }

  let isQuiz = false;
  try { isQuiz = form.isQuiz(); } catch (x) {}

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(AK_SHEET_NAME);
  const isNewSheet = !sheet;
  if (isNewSheet) sheet = ss.insertSheet(AK_SHEET_NAME);

  const headers = ['Q.No', 'Question', 'Option A', 'Option B', 'Option C', 'Option D',
                    'Correct Answer (A/B/C/D)', 'Explanation', 'FormId', 'Section', 'ExamTitle'];
  if (isNewSheet || sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setBackground('#0f172a').setFontColor('white').setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 55);
    sheet.setColumnWidth(2, 320);
    for (let c = 3; c <= 6; c++) sheet.setColumnWidth(c, 150);
    sheet.setColumnWidth(7, 100);
    sheet.setColumnWidth(8, 320);
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
  }
  // FormId/Section/ExamTitle are internal — hide them on every call
  try { sheet.hideColumns(9, 3); } catch (x) {}

  // Is this Form's section already there? Read only the FormId/Section columns.
  const lastRow = sheet.getLastRow();
  let existingStart = -1, existingCount = 0, sectionNum = null, maxSection = 0;
  if (lastRow >= 2) {
    const idCol = sheet.getRange(2, 9, lastRow - 1, 2).getValues(); // I:FormId, J:Section
    for (let i = 0; i < idCol.length; i++) {
      const n = Number(idCol[i][1]);
      if (!isNaN(n) && n > maxSection) maxSection = n;
      if (String(idCol[i][0]) === String(formId) && String(formId) !== '') {
        if (existingStart === -1) { existingStart = i + 2; sectionNum = idCol[i][1]; }
        existingCount = (i + 2) - existingStart + 1;
      }
    }
  }
  if (sectionNum === null) sectionNum = maxSection + 1;

  const preserved = {};
  if (existingStart !== -1) {
    sheet.getRange(existingStart, 1, existingCount, 8).getValues().forEach(r => {
      const q = String(r[1]).trim();
      if (q) preserved[q] = { correct: r[6], explanation: r[7] };
    });
    sheet.deleteRows(existingStart, existingCount);
  }
  const insertAt = existingStart !== -1 ? existingStart : sheet.getLastRow() + 1;

  const LETTERS = ['A', 'B', 'C', 'D'];
  let autoCorrectCount = 0, autoExplainCount = 0;
  const dataRows = items.map((item, i) => {
    const mc = item.asMultipleChoiceItem();
    const qText = item.getTitle().trim();
    const choiceObjs = mc.getChoices();
    const choices = choiceObjs.map(c => c.getValue());
    while (choices.length < 4) choices.push('');
    const old = preserved[qText] || {};

    let autoCorrect = '';
    try {
      const idx = choiceObjs.findIndex(c => c.isCorrectAnswer());
      if (idx !== -1) autoCorrect = LETTERS[idx] || '';
    } catch (x) {}

    let autoExplain = '';
    try {
      const fb = mc.getFeedbackForCorrectAnswers();
      if (fb) autoExplain = String(fb.getText() || '').trim();
    } catch (x) {}
    if (!autoExplain) {
      try { autoExplain = String(item.getHelpText() || '').trim(); } catch (x) {}
    }

    // Manual entries always win over auto-filled ones
    const finalCorrect = old.correct || autoCorrect || '';
    const finalExplain = old.explanation || autoExplain || '';
    if (!old.correct && autoCorrect) autoCorrectCount++;
    if (!old.explanation && autoExplain) autoExplainCount++;

    // ExamTitle is written only on the divider row, not on every row
    return [`${sectionNum}.${i + 1}`, qText, choices[0], choices[1], choices[2], choices[3],
            finalCorrect, finalExplain, formId, sectionNum, ''];
  });

  const totalRows = 1 + dataRows.length;
  sheet.insertRowsBefore(insertAt, totalRows);

  const dividerRow = insertAt;
  sheet.getRange(dividerRow, 1, 1, 8).merge()
    .setValue(`📘 সেকশন ${sectionNum}: ${examTitle}`)
    .setBackground('#1d4ed8').setFontColor('white').setFontWeight('bold')
    .setFontSize(12).setHorizontalAlignment('center');
  sheet.getRange(dividerRow, 9, 1, 3).setValues([[formId, sectionNum, examTitle]]);

  // Q.No must be text, otherwise Sheets turns "2.10" into the number 2.1
  sheet.getRange(dividerRow + 1, 1, dataRows.length, 1).setNumberFormat('@');
  sheet.getRange(dividerRow + 1, 1, dataRows.length, 11).setValues(dataRows);

  // Validation/wrap only on question rows (not the merged divider)
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(['A', 'B', 'C', 'D'], true).build();
  sheet.getRange(dividerRow + 1, 7, dataRows.length, 1).setDataValidation(rule);
  sheet.getRange(dividerRow + 1, 1, dataRows.length, 8).setWrap(true).setVerticalAlignment('top');

  let note = '';
  if (autoCorrectCount > 0 || autoExplainCount > 0) note = ` (অটো-ফিল: উত্তর ${autoCorrectCount}, ব্যাখ্যা ${autoExplainCount})`;
  else if (!isQuiz) note = ' (অটো-ফিল হয়নি — হাতে Correct Answer/Explanation ভরো)';

  return {
    ok: true,
    title: examTitle,
    count: dataRows.length,
    message: `${dataRows.length}টা প্রশ্ন ${existingStart !== -1 ? 'আপডেট হয়েছে' : 'যোগ হয়েছে (সেকশন ' + sectionNum + ')'}${note}`
  };
}

function setAnswerKeySettings() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  const curTitle = props.getProperty('akExamTitle') || '';
  const r1 = ui.prompt(
    'Answer Key — পরীক্ষার নাম (ম্যানুয়াল ওভাররাইড)',
    `"ফর্ম থেকে প্রশ্ন আনুন" চালালে এই নামটা ফর্মের নিজের টাইটেল দিয়ে অটো বসে/আপডেট হয়ে যায় — এটা শুধু চাইলে সাময়িকভাবে অন্য নাম দিতে চাইলে ব্যবহার করো।\n\nবর্তমান: ${curTitle || '(সেট করা নেই)'}\nনতুন নাম দাও (ফাঁকা রাখলে আগেরটাই থাকবে):`,
    ui.ButtonSet.OK_CANCEL
  );
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const title = r1.getResponseText().trim();
  if (title) props.setProperty('akExamTitle', title);

  // Marks always come from the main Setup Wizard (no separate override).
  ui.alert('✅ সেভ হয়েছে! (পরের বার এই ফর্ম থেকে "ফর্ম থেকে প্রশ্ন আনুন" চালালে ফর্মের টাইটেলই আবার বসে যাবে — এই নামটা স্থায়ী নয়।)');
}

/**
 * Reads "Answer Setup" and returns
 * { sections: [ { sectionNum, examTitle, formId, questions: [...] } ] }.
 * The exam title sits on the divider row and carries forward; old sheets
 * with a title on every row (or no section columns) still work.
 */
function getAnswerData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AK_SHEET_NAME);
  if (!sheet) return { sections: [] };
  const last = sheet.getLastRow();
  if (last < 2) return { sections: [] };
  const letterToIndex = { A: 0, B: 1, C: 2, D: 3 };
  const allRows = sheet.getRange(2, 1, last - 1, 11).getValues();

  const fallbackTitle = PropertiesService.getScriptProperties().getProperty('akExamTitle') || 'পরীক্ষা';
  const bySection = {};
  const order = [];
  let currentTitle = fallbackTitle;

  allRows.forEach(r => {
    const isDivider = String(r[1]).trim() === '';
    if (isDivider) {
      if (String(r[10] || '').trim()) currentTitle = String(r[10]).trim();
      return;
    }
    const sectionNum = r[9] || 1;
    const rowTitle   = String(r[10] || '').trim(); // legacy per-row title
    const examTitle  = rowTitle || currentTitle;
    if (!bySection[sectionNum]) {
      bySection[sectionNum] = { sectionNum: sectionNum, examTitle: examTitle, formId: String(r[8] || ''), questions: [] };
      order.push(sectionNum);
    }
    // Number is rebuilt from position; the Q.No cell can lose trailing zeros
    const qidx = bySection[sectionNum].questions.length + 1;
    bySection[sectionNum].questions.push({
      qno: sectionNum + '.' + qidx,
      qidx: qidx,
      question: String(r[1]).trim(),
      options: [r[2], r[3], r[4], r[5]].map(o => String(o || '').trim()),
      correctIndex: letterToIndex[String(r[6]).trim().toUpperCase()] !== undefined
        ? letterToIndex[String(r[6]).trim().toUpperCase()] : -1,
      explanation: String(r[7] || '').trim()
    });
  });

  order.sort((a, b) => Number(a) - Number(b));
  return { sections: order.map(n => bySection[n]) };
}

/**
 * Builds an Answer Key row in the first (response) sheet from the
 * correct answers in "Answer Setup". Question text is matched to the
 * response sheet's column headers. The row goes right after the header,
 * so new form responses (appended at the bottom) never move it.
 */
function autoGenerateAnswerKeyRow() {
  const ui = SpreadsheetApp.getUi();
  const bank = getAnswerData();
  if (bank.sections.length === 0) {
    ui.alert('⚠️ কোনো প্রশ্ন পাওয়া যায়নি — আগে "ফর্ম থেকে প্রশ্ন আনুন" চালাও এবং প্রতিটা প্রশ্নের সঠিক উত্তর ঠিক করো।');
    return;
  }

  // One section → use it; several → ask which exam
  let section;
  if (bank.sections.length === 1) {
    section = bank.sections[0];
  } else {
    const list = bank.sections.map((s, i) => `${i + 1}. ${s.examTitle} (${s.questions.length}টি প্রশ্ন)`).join('\n');
    const r = ui.prompt(
      'কোন পরীক্ষার জন্য Answer Key Row বসাবে?',
      list + '\n\nউপরের লিস্ট থেকে নম্বর (১, ২, ...) লিখে দাও:',
      ui.ButtonSet.OK_CANCEL
    );
    if (r.getSelectedButton() !== ui.Button.OK) return;
    const idx = parseInt(r.getResponseText().trim(), 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= bank.sections.length) {
      ui.alert('⚠️ ভুল নম্বর।');
      return;
    }
    section = bank.sections[idx];
  }
  const data = section.questions;

  const missing = data.filter(q => q.correctIndex === -1);
  if (missing.length > 0) {
    const qnos = missing.map(q => q.qno).slice(0, 15).join(', ') + (missing.length > 15 ? '...' : '');
    ui.alert(`⚠️ "${section.examTitle}"-এর ${missing.length}টি প্রশ্নে এখনো সঠিক উত্তর সেট করা নেই (Q.No: ${qnos}) — "Answer Setup" শীটে গিয়ে সব প্রশ্নে সঠিক উত্তর ঠিক করে আবার চেষ্টা করো।`);
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheets()[0];
  const rawData = sourceSheet.getDataRange().getValues();
  if (rawData.length === 0) {
    ui.alert('⚠️ মূল রেসপন্স শীটে (প্রথম শীট) কোনো ডেটা পাওয়া যায়নি।');
    return;
  }

  const titleRowIdx = findHeaderRowIdx(rawData);
  if (titleRowIdx === -1) {
    ui.alert('⚠️ মূল শীটের প্রথম কয়েক রো-তে হেডার (নাম/ফোন কলাম) খুঁজে পাওয়া যায়নি।');
    return;
  }
  const headerRow = rawData[titleRowIdx];
  const lastCol   = headerRow.length;

  const colByQuestion = {};
  headerRow.forEach((h, j) => {
    const key = String(h || '').trim();
    if (key) colByQuestion[key] = j;
  });

  const newRow = Array(lastCol).fill('');
  let matched = 0;
  const unmatched = [];
  data.forEach(q => {
    const colIdx = colByQuestion[q.question];
    if (colIdx === undefined) { unmatched.push(q.qno); return; }
    newRow[colIdx] = q.options[q.correctIndex];
    matched++;
  });

  // Fill name/phone so the row isn't dropped as an invalid student row
  let nCol = -1, wCol = -1;
  headerRow.forEach((h, j) => {
    const head = String(h).toLowerCase();
    if (nCol === -1 && /নাম|name|student/i.test(head)) nCol = j;
    if (wCol === -1 && /whatsapp|phone|মোবাইল|contact/i.test(head)) wCol = j;
  });
  if (nCol !== -1) newRow[nCol] = section.examTitle;
  if (wCol !== -1) newRow[wCol] = '0000000000';

  // Place the row right after the header. First run inserts it; later
  // runs overwrite the same row.
  const targetRowNum = titleRowIdx + 2; // 1-based row right after the header
  const existingRow  = rawData[targetRowNum - 1]; // 0-based, may be undefined
  const alreadyIsKeyRow = existingRow && nCol !== -1 &&
    bank.sections.some(sec => String(existingRow[nCol] || '').trim() === sec.examTitle);

  if (!alreadyIsKeyRow) {
    sourceSheet.insertRowBefore(targetRowNum);
  }
  sourceSheet.getRange(targetRowNum, 1, 1, lastCol).setValues([newRow]);

  let msg = `✅ "${section.examTitle}"-এর ${matched}টি প্রশ্নের সঠিক উত্তর বসানো হয়েছে সোর্স শীটের ${targetRowNum} নম্বর রো-তে (হেডারের ঠিক পরে — নতুন কেউ রেসপন্স করলে সবসময় সবার নিচে যোগ হবে, তাই এই রো নম্বর আর কখনো সরবে না)।`;
  if (unmatched.length > 0) {
    const qnos = unmatched.slice(0, 15).join(', ') + (unmatched.length > 15 ? '...' : '');
    msg += `\n\n⚠️ ${unmatched.length}টি প্রশ্নের কলাম মেলেনি (Q.No: ${qnos}) — সম্ভবত প্রশ্নের টেক্সট আর রেসপন্স শীটের কলাম হেডার হুবহু মিলছে না (দুটো ভিন্ন ফর্ম থেকে হলে এমন হতে পারে); ওই ঘরগুলো ফাঁকা রাখা হয়েছে, ম্যানুয়ালি ঠিক করে নাও।`;
  }
  msg += `\n\nএখন "⚙️ Full System Setup" খুলে "Answer Key Row" নম্বর হিসেবে ${targetRowNum} বসিয়ে সেভ করলেই এই রোটা স্কোরিং-এর Answer Key হিসেবে ব্যবহৃত হবে।`;
  ui.alert(msg);
}

/** HTML-escape for text inserted into markup. */
function _akEscapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Fetches the logo server-side and embeds it as a base64 data URI so it
 * always shows in the dialog and the printed PDF (external <img> can fail).
 * Cached 6 hours; falls back to the original URL on failure.
 */
function _akLogoDataUri(url) {
  const cacheKey = 'akLogoDataUri_' + Utilities.base64EncodeWebSafe(url).slice(0, 40);
  try {
    const cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) return cached;
  } catch(x) {}
  try {
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    if (resp.getResponseCode() !== 200) return url;
    const blob = resp.getBlob();
    const mime = blob.getContentType() || 'image/png';
    const dataUri = 'data:' + mime + ';base64,' + Utilities.base64Encode(blob.getBytes());
    try { CacheService.getScriptCache().put(cacheKey, dataUri, 21600); } catch(x) {}
    return dataUri;
  } catch(x) {
    return url;
  }
}

/**
 * Fetches a font file (.woff2/.woff/.ttf/.otf) from a URL and returns a
 * base64 data URI for @font-face, or null (caller falls back to Anek
 * Bangla). GitHub "blob" links get ?raw=true added. The file signature is
 * checked so an HTML page is never used as a font. The MIME type comes
 * from the signature. Cache key = MD5 of the URL (6 hours; entries over
 * the ~100KB cache limit are simply not cached).
 */
function _akFontDataUri(url) {
  if (!url) return null;
  url = String(url).trim();
  if (/github\.com\/.+\/blob\//.test(url) && !/[?&]raw=true/.test(url)) {
    url += (url.indexOf('?') === -1 ? '?' : '&') + 'raw=true';
  }
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, url);
  const cacheKey = 'akFontDataUri_' + Utilities.base64EncodeWebSafe(digest).replace(/=+$/, '');
  try {
    const cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) return cached;
  } catch (x) {}
  try {
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    if (resp.getResponseCode() !== 200) return null;
    const bytes = resp.getBlob().getBytes();
    if (!bytes || bytes.length < 4) return null;
    const b0 = bytes[0] & 255, b1 = bytes[1] & 255, b2 = bytes[2] & 255, b3 = bytes[3] & 255;
    const sig = String.fromCharCode(b0, b1, b2, b3);
    let mime;
    if      (sig === 'wOF2')                                   mime = 'font/woff2';
    else if (sig === 'wOFF')                                   mime = 'font/woff';
    else if (sig === 'OTTO')                                   mime = 'font/otf';
    else if (b0 === 0 && b1 === 1 && b2 === 0 && b3 === 0)    mime = 'font/ttf';
    else if (sig === 'true')                                   mime = 'font/ttf';
    else return null; // not a font file (probably an HTML page)
    const dataUri = 'data:' + mime + ';base64,' + Utilities.base64Encode(bytes);
    try { CacheService.getScriptCache().put(cacheKey, dataUri, 21600); } catch (x) {}
    return dataUri;
  } catch (x) {
    return null;
  }
}

/** Reads a numeric script property (posMark/negMark) with a default. */
function _akSetupMark(key, defaultVal) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  return (v !== null && v !== '' && !isNaN(parseFloat(v))) ? parseFloat(v) : defaultVal;
}

/** English digits (0-9) to Bengali digits, e.g. "2.13" becomes the Bengali form. */
function _akBnDigits(str) {
  const bn = '০১২৩৪৫৬৭৮৯';
  return String(str == null ? '' : str).replace(/[0-9]/g, function (d) { return bn.charAt(Number(d)); });
}

/**
 * Answer Key dialog with Print / Download PDF. Combines all sections
 * into one book (each later section starts on a new page, page numbers
 * run continuously).
 *
 * Answer modes (switchable live): full / practice / blank. Practice and
 * blank show a per-page answer strip above the page number and hide
 * explanations.
 *
 * Book-style toggle button: two-column, borderless book layout using the
 * optional GitHub font (see the DR_BOOK_* constants at the top).
 */
function showAnswerKeyPdfDialog() {
  const ui = SpreadsheetApp.getUi();
  const bank = getAnswerData();
  const allQuestions = [].concat(...bank.sections.map(s => s.questions));
  if (allQuestions.length === 0) {
    ui.alert('⚠️ কোনো প্রশ্ন পাওয়া যায়নি — আগে "ফর্ম থেকে প্রশ্ন আনুন" চালাও, তারপর প্রতিটা প্রশ্নের সঠিক উত্তর নির্বাচন করো।');
    return;
  }

  const props      = PropertiesService.getScriptProperties();
  props.deleteProperty('akPosMark');
  props.deleteProperty('akNegMark');
  const posMark    = _akSetupMark('posMark', 1);
  const negMark    = _akSetupMark('negMark', 0);
  const labels     = ['ক', 'খ', 'গ', 'ঘ'];
  const noneCorrect = allQuestions.filter(q => q.correctIndex === -1).length;
  const withExplain = allQuestions.filter(q => q.explanation).length;
  const logoSrc    = _akLogoDataUri(DR_LOGO_LIGHT_URL);

  // Optional book font: null if not set or the fetch failed (then no
  // @font-face is added and Anek Bangla is used).
  const bookFontSrc = _akFontDataUri(DR_BOOK_FONT_URL);
  const bookFontFormat = !bookFontSrc ? '' :
    bookFontSrc.indexOf('data:font/woff2;') === 0 ? 'woff2' :
    bookFontSrc.indexOf('data:font/woff;')  === 0 ? 'woff'  :
    bookFontSrc.indexOf('data:font/otf;')   === 0 ? 'opentype' : 'truetype';
  const _feat = s => String(s || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 4);
  const labelFeat  = _feat(DR_BOOK_LABEL_FEATURE);
  const answerFeat = _feat(DR_BOOK_ANSWER_FEATURE);
  const answerMark = DR_BOOK_ANSWER_MARK === 'font' ? 'font' : 'tick';

  const titleSuffix = withExplain > 0 ? 'সঠিক উত্তর ও ব্যাখ্যা' : 'সঠিক উত্তর';
  const isMultiSection = bank.sections.length > 1;
  const manualTitle = props.getProperty('akExamTitle') || '';
  const examTitle = isMultiSection
    ? (manualTitle || 'DreamRise Answer Book')
    : (bank.sections[0] ? bank.sections[0].examTitle : (manualTitle || 'পরীক্ষা'));

  const infoLine = [
    `সঠিক উত্তর: +${posMark}`,
    negMark > 0 ? `ভুল উত্তর: −${negMark}` : 'নেগেটিভ মার্কিং নেই',
    'মোট প্রশ্ন: %%QC%%' // replaced with the selected question count in the page
  ].join('  |  ');

  function buildCardHtml(q, isSectionStart, sectionNum) {
    const correctLetter = q.correctIndex >= 0 ? labels[q.correctIndex] : '';
    // Book style: a long option makes this question's options flow inline
    const flow = q.options.some(o => o && o.length > DR_BOOK_OPT_WRAP_CHARS);
    // Number without the part before the point ("12.5" -> "5")
    const qStr   = String(q.qno);
    const qShort = qStr.indexOf('.') >= 0 ? qStr.slice(qStr.indexOf('.') + 1) : qStr;
    const optsHtml = q.options.map((opt, i) => {
      if (!opt) return '';
      const isCorrect = i === q.correctIndex;
      return `<div class="opt${isCorrect ? ' correct' : ''}"><span class="olab">${labels[i]})</span> ${_akEscapeHtml(opt)}${isCorrect ? ' <span class="tick">✅</span>' : ''}</div>`;
    }).join('');
    const explainHtml = q.explanation
      ? `<div class="explain"><b>ব্যাখ্যা:</b> ${_akEscapeHtml(q.explanation)}</div>`
      : '';
    return `
      <div class="card${isSectionStart ? ' section-start' : ''}${flow ? ' opts-flow' : ''}" data-qno="${_akEscapeHtml(String(q.qno))}" data-qno-bn="${_akEscapeHtml(_akBnDigits(q.qno))}" data-qno-s="${_akEscapeHtml(qShort)}" data-qno-bn-s="${_akEscapeHtml(_akBnDigits(qShort))}" data-correct="${correctLetter}" data-section="${_akEscapeHtml(String(sectionNum))}" data-qidx="${_akEscapeHtml(String(q.qidx))}">
        <div class="qhead"><span class="qno"><span class="qlabel">প্রশ্ন </span><span class="qnum qnum-en">${q.qno}</span><span class="qnum qnum-en-s">${_akEscapeHtml(qShort)}</span><span class="qnum qnum-bn">${_akEscapeHtml(_akBnDigits(q.qno))}</span><span class="qnum qnum-bn-s">${_akEscapeHtml(_akBnDigits(qShort))}</span></span><span class="qtext">${_akEscapeHtml(q.question)}</span></div>
        <div class="opts">${optsHtml}</div>
        ${explainHtml}
      </div>`;
  }

  const cardsHtml = bank.sections.map((section, sIdx) => {
    const dividerHtml = isMultiSection
      ? `<div class="section-divider${sIdx > 0 ? ' force-break' : ''}" data-section="${_akEscapeHtml(String(section.sectionNum))}">📘 ${_akEscapeHtml(section.examTitle)}</div>`
      : '';
    const questionsHtml = section.questions.map((q, qIdx) => buildCardHtml(q, isMultiSection && sIdx > 0 && qIdx === 0, section.sectionNum)).join('');
    return dividerHtml + questionsHtml;
  }).join('');

  // Section picker (only when there is more than one section)
  const sectionsMeta = bank.sections.map(sec => ({ n: sec.sectionNum, title: sec.examTitle, count: sec.questions.length }));
  const sectionsJson = JSON.stringify(sectionsMeta).replace(/</g, '\\u003c');
  const selectorHtml = !isMultiSection ? '' : `
  <div class="sel-panel" id="selPanel" style="display:none">
    <div class="sel-row">
      <b>রেঞ্জ:</b>
      <input id="selRange" class="sel-input" placeholder="যেমন: 35-40 বা 1,3,5-8" oninput="rangeDirty=true" onkeydown="if(event.key==='Enter'){applySelection();}">
      <button class="mode-btn" onclick="selRangeApply()">রেঞ্জ বাছাই করো</button>
      <button class="mode-btn" onclick="selAll(true)">সব</button>
      <button class="mode-btn" onclick="selAll(false)">কিছু না</button>
    </div>
    <div class="sel-list" id="selList"></div>
    <div class="sel-opt"><b>পেজ নম্বর:</b>
      <label><input type="radio" name="pgnum" value="restart" checked> ১ থেকে শুরু</label>
      <label><input type="radio" name="pgnum" value="normal"> বইয়ের স্বাভাবিক নম্বর</label>
    </div>
    <div class="sel-opt"><b>সেকশন / প্রশ্ন নম্বর:</b>
      <label><input type="radio" name="secnum" value="orig" checked> স্বাভাবিক (মূল নম্বর)</label>
      <label><input type="radio" name="secnum" value="renumber"> ১ থেকে নতুন করে</label>
    </div>
    <div class="sel-row">
      <button class="pdf-btn" onclick="applySelection()">✔ প্রয়োগ করো</button>
      <button class="pdf-btn" onclick="applySelection(true)">🖨️ বাছাই করা সেকশন প্রিন্ট</button>
      <span class="sel-msg" id="selMsg"></span>
    </div>
  </div>`;
  const selToggleHtml = !isMultiSection ? '' :
    '<button class="pdf-btn secondary" id="selToggleBtn" onclick="toggleSelPanel()">📑 সেকশন বাছাই (সব)</button>';

  const warnHtml = noneCorrect > 0
    ? `<div class="warn">⚠️ ${noneCorrect}টি প্রশ্নে এখনো সঠিক উত্তর সেট করা নেই — "Answer Setup" শীটে গিয়ে সেগুলো পূরণ করে আবার এই ডায়ালগটা খোলো।</div>`
    : '';

  const headerHtml =
    '<table class="topbar"><tr>' +
    '<td class="logocell"><div class="logo"></div></td>' +
    '<td class="infocell"><div class="ttitle">' + _akEscapeHtml(examTitle.toUpperCase()) + ' — ' + titleSuffix + '</div>' +
    '<div class="tsub">' + infoLine + '</div></td>' +
    '</tr></table>';
  const creditHtml = 'Developed by <a href="https://www.facebook.com/dreamriseadmission" target="_blank" rel="noopener">DreamRise</a> &amp; <a href="https://www.facebook.com/muhammadibrahimsiddiknasib" target="_blank" rel="noopener">Muhammad Ibrahim</a>';
  const explainNote = ' — ব্যাখ্যা আছে ' + withExplain + '/' + allQuestions.length + ' প্রশ্নে';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Anek+Bangla:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  /* PAGE MODEL: every page is a fixed-size A4 box (slightly under A4
     height, overflow hidden) with its own header, border and page
     number, so a blank extra page cannot occur. */
  @page { size:A4; margin:0; }
  * , body { box-sizing:border-box; margin:0; padding:0; font-family:'Anek Bangla',sans-serif; }
  html, body{ background:#eef2f7; color:#0f172a; font-size:15px; }

  .mode-bar{ display:flex; gap:8px; padding:12px 16px 0; background:#eef2f7; flex-wrap:wrap; align-items:center; }
  .mode-btn{
    font-family:inherit; font-size:12px; font-weight:600; padding:7px 14px; border-radius:20px;
    border:1px solid #cbd5e1; background:#fff; color:#334155; cursor:pointer;
  }
  .mode-btn.active{ background:#0f1f3d; color:#fff; border-color:#0f1f3d; }
  .actions{ display:flex; justify-content:flex-end; flex-wrap:wrap; gap:8px; padding:10px 16px 0; background:#eef2f7; }
  .pdf-btn{
    display:inline-flex; align-items:center; gap:6px; background:#0f1f3d; color:#fff;
    border:1px solid #0f1f3d; padding:8px 16px; border-radius:8px; font-size:12.5px;
    font-weight:600; cursor:pointer; font-family:inherit;
  }
  .pdf-btn:hover{ background:#1e2f52; }
  .pdf-btn.secondary{ background:#fff; color:#0f1f3d; border:1px solid #cbd5e1; }
  .pdf-btn.secondary:hover{ background:#f1f5f9; }
  .pdf-btn.secondary.active{ background:#0f1f3d; color:#fff; border-color:#0f1f3d; }
  .warn{
    background:#fffbeb; border:1px solid #fde68a; color:#92400e; font-size:12.5px;
    padding:8px 12px; margin:10px 16px 0; border-radius:8px;
  }
  /* section picker */
  .sel-panel{ margin:10px 16px 0; padding:12px; background:#fff; border:1px solid #cbd5e1; border-radius:10px; font-size:12.5px; }
  .sel-row{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:8px; }
  .sel-input{ font-family:inherit; font-size:12.5px; padding:6px 10px; border:1px solid #cbd5e1; border-radius:8px; width:230px; }
  .sel-list{ display:grid; grid-template-columns:1fr 1fr; gap:3px 14px; max-height:170px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; padding:8px; margin-bottom:8px; }
  .sel-item{ display:flex; gap:6px; align-items:flex-start; line-height:1.4; cursor:pointer; }
  .sel-cnt{ color:#64748b; }
  .sel-opt{ display:flex; gap:14px; flex-wrap:wrap; align-items:center; margin-bottom:6px; }
  .sel-opt label{ cursor:pointer; }
  .sel-msg{ color:#b91c1c; font-size:12px; }

  /* Question number states: normal / book, full / short (hide button) */
  .qnum{ display:none; }
  body:not(.book-mode):not(.hide-sec) .qnum-en{ display:inline; }
  body:not(.book-mode).hide-sec .qnum-en-s{ display:inline; }
  body.book-mode:not(.hide-sec) .qnum-bn{ display:inline; }
  body.book-mode.hide-sec .qnum-bn-s{ display:inline; }
  /* "Hide question number": removes the auto number from the question cards */
  body.hide-qnum .qnum{ display:none !important; }
  body.book-mode.hide-qnum .qhead .qno{ display:none; }
  body.mode-practice .opt.correct, body.mode-blank .opt.correct{
    background:#f8fafc; color:#1e293b; font-weight:normal; border-color:transparent;
  }
  body.mode-practice .opt.correct .tick, body.mode-blank .opt.correct .tick{ display:none; }
  body.mode-practice .explain, body.mode-blank .explain{ display:none; }

  #pages{ padding:14px 0 30px; }
  .pdf-page{
    position:relative; width:210mm; height:296mm; margin:0 auto 16px; background:#fff;
    padding:9mm 11mm 8mm; display:flex; flex-direction:column; overflow:hidden;
    box-shadow:0 2px 10px rgba(15,23,42,.18);
    break-after:page; page-break-after:always; contain:layout style;
  }
  .pdf-page:last-child{ break-after:auto; page-break-after:auto; }
  .pg-frame{
    position:absolute; top:5mm; left:5mm; right:5mm; bottom:5mm;
    border:2.5px solid #2563eb; border-radius:14px; pointer-events:none;
  }
  .pg-header{ flex-shrink:0; }
  .page-content{
    flex:1; min-height:0; overflow:hidden; display:flex; flex-direction:column;
    padding:3mm 3mm 0;
  }
  .page-content > *{ flex-shrink:0; }
  .pg-footer{ flex-shrink:0; text-align:center; padding-top:5px; }
  .pg-num{ color:#64748b; font-size:12px; font-weight:700; }
  .pg-credit{ color:#94a3b8; font-size:10px; margin-top:1px; }
  .pg-credit a{ color:#64748b; font-weight:700; text-decoration:underline; }

  /* hidden measuring areas (same inner width as a page's content box) */
  #stage{ position:fixed; left:-30000px; top:0; width:188mm; visibility:hidden; overflow:visible; flex:none; min-height:0; }
  #probe{ position:fixed; left:-30000px; top:0; visibility:hidden; }

  table.topbar{ width:100%; border-collapse:collapse; background:#fff; border-bottom:3px solid #2563eb; }
  table.topbar td{ padding:12px 16px; vertical-align:middle; }
  table.topbar .logocell{ width:1%; white-space:nowrap; }
  .logo{ height:48px; width:calc(48px * var(--logo-r,3.54)); background:var(--logo-url) left center / contain no-repeat; }
  table.topbar .infocell{ text-align:left; padding-left:16px; border-left:1px solid #cbd5e1; }
  .ttitle{ color:#0f1f3d; font-weight:800; font-size:18px; line-height:1.4; letter-spacing:.2px; }
  .tsub{ color:#2563eb; font-size:14px; margin-top:6px; font-weight:700; line-height:1.5; }

  .card{
    background:#fff; border:1px solid #e2e8f0; border-left:4px solid #2563eb; border-radius:8px;
    padding:12px 14px; margin-bottom:10px;
  }
  .qhead{ display:flex; align-items:flex-start; gap:8px; font-weight:700; margin-bottom:9px; font-size:16px; line-height:1.5; }
  .qhead .qno{
    flex-shrink:0; background:#eff6ff; color:#1d4ed8; font-weight:800; font-size:14px;
    border-radius:6px; padding:3px 9px; white-space:nowrap;
  }
  .qhead .qtext{ padding-top:2px; }
  .opts{ display:grid; grid-template-columns:1fr 1fr; gap:7px; }
  .opt{
    padding:8px 10px; border-radius:6px; font-size:15px; line-height:1.4;
    border:1px solid transparent; background:#f8fafc; color:#1e293b;
  }
  .opt.correct{ background:#dcfce7; color:#166534; font-weight:700; border-color:#16a34a; }
  .explain{
    margin-top:9px; padding:8px 11px; border-radius:6px;
    background:#f1f5f9; font-size:14px; line-height:1.55; color:#475569;
  }
  .explain b{ color:#0f172a; }

  .section-divider{
    background:#1d4ed8; color:#fff; font-weight:800; font-size:15px; text-align:center;
    padding:10px 14px; margin:14px 0 10px; border-radius:8px;
  }

  /* per-page answer strip (practice/blank), pinned above the page number */
  .mini-answer-table{
    background:#eff6ff; border:1.5px solid #93c5fd; border-radius:8px;
    padding:9px 11px; margin:10px 0 2px;
  }
  .page-content > .mini-answer-table{ margin-top:auto; }
  .mini-answer-table .mat-label{
    display:block; font-size:11.5px; font-weight:800; color:#1d4ed8; letter-spacing:.03em; margin-bottom:6px;
  }
  .mini-answer-table .mat-cells{ display:flex; flex-wrap:wrap; gap:7px; justify-content:center; }
  .mat-cell{
    display:flex; align-items:center; gap:5px; font-size:12.5px; font-weight:700;
    background:#fff; border:1px solid #bfdbfe; border-radius:5px; padding:4px 10px;
  }
  .mat-cell .mat-q{ color:#1d4ed8; }
  .mat-cell .mat-a{ color:#166534; min-width:14px; text-align:center; }
  .mat-cell .mat-a.blank{ min-width:20px; border-bottom:1.5px solid #94a3b8; color:transparent; }

  /* ═══ BOOK STYLE: two columns, borderless, compact. Everything is
     scoped to body.book-mode, so the normal layout is untouched. ═══ */
  ${bookFontSrc ? `@font-face{
    font-family:'DRBookFont';
    src:url("${bookFontSrc}") format("${bookFontFormat}");
    font-weight:normal; font-style:normal; font-display:swap;
  }` : ''}

  /* The global "*" rule above sets font-family on every element, so the
     book font must be applied to the page elements directly. */
  body.book-mode .pdf-page, body.book-mode .pdf-page *,
  body.book-mode #stage, body.book-mode #stage *,
  body.book-mode #probe, body.book-mode #probe *{
    font-family:${bookFontSrc ? "'DRBookFont'," : ''}'Anek Bangla',sans-serif;
  }

  /* stage width = one column (88mm) + the stage's own 3mm+3mm padding */
  body.book-mode #stage{ width:94mm; }
  .book-cols{ display:flex; gap:6mm; align-items:flex-start; }
  .book-col{ flex:1 1 0; min-width:0; display:flex; flex-direction:column; }
  .book-col > *{ flex-shrink:0; }

  body.book-mode table.topbar{ border-bottom-width:2px; }
  body.book-mode table.topbar td{ padding:4px 10px; }
  body.book-mode .logo{ height:30px; width:calc(30px * var(--logo-r,3.54)); }
  body.book-mode .ttitle{ font-size:12px; line-height:1.3; letter-spacing:0; }
  body.book-mode .tsub{ font-size:10px; line-height:1.3; margin-top:1px; }

  body.book-mode .card{ background:none; border:0; border-radius:0; padding:0; margin-bottom:7px; }
  body.book-mode .qhead{ display:block; font-size:13px; font-weight:700; line-height:1.45; margin-bottom:2px; }
  body.book-mode .qhead .qno{
    display:inline; background:none; color:inherit; padding:0; border-radius:0;
    font-size:inherit; font-weight:700; margin-right:4px;
  }
  body.book-mode .qhead .qtext{ display:inline; padding-top:0; }
  body.book-mode .qlabel{ display:none; }
  body.book-mode .qnum-bn::after, body.book-mode .qnum-bn-s::after{ content:"."; }

  body.book-mode .opts{ display:grid; grid-template-columns:1fr 1fr; gap:1px 8px; }
  body.book-mode .card.opts-flow .opts{ display:block; }
  body.book-mode .card.opts-flow .opt{ display:inline; margin-right:12px; }
  body.book-mode .opt{
    padding:0; background:none; border:0; border-radius:0;
    font-size:13px; line-height:1.5; color:#000;
  }
  /* no green highlight / bold for the correct option in book style */
  body.book-mode .opt.correct{ background:none; border-color:transparent; color:#000; font-weight:normal; }
  body.book-mode .tick{ display:none; }

  ${labelFeat ? `body.book-mode .olab{ font-feature-settings:"${labelFeat}" 1; }` : ''}
  ${answerMark === 'tick'
    ? `/* correct answer = small tick */
  body.book-mode.mode-full .opt.correct::after{ content:" ✓"; font-weight:800; color:#000; }`
    : `/* correct answer = label with the ANSWER feature set */
  ${answerFeat ? `body.book-mode.mode-full .opt.correct .olab{ font-feature-settings:"${answerFeat}" 1; }` : ''}`}

  body.book-mode .explain{
    font-size:12px; line-height:1.45; padding:0 0 0 7px; margin-top:2px;
    background:none; border-left:2px solid #cbd5e1; border-radius:0;
  }
  body.book-mode .section-divider{ font-size:13px; padding:4px 8px; margin:0 0 6px; border-radius:4px; }
  /* plain black-and-white answer table */
  body.book-mode .mini-answer-table{ background:#fff; border:1px solid #000; border-radius:0; padding:5px 7px 6px; margin:6px 0 2px; }
  body.book-mode .mini-answer-table .mat-label{ color:#000; font-size:14px; margin-bottom:5px; }
  body.book-mode .mini-answer-table .mat-cells{ gap:0; justify-content:flex-start; padding:0 1px 1px 0; }
  body.book-mode .mat-cell{ background:#fff; color:#000; border:1px solid #000; border-radius:0; font-size:16px; padding:3px 9px; gap:8px; margin:0 -1px -1px 0; }
  body.book-mode .mat-cell .mat-q, body.book-mode .mat-cell .mat-a{ color:#000; }
  body.book-mode .mat-cell .mat-a.blank{ border-bottom:0; min-width:22px; }

  @media print{
    html, body{ background:#fff; }
    .mode-bar, .actions, .warn, .sel-panel, #stage, #probe{ display:none !important; }
    #pages{ padding:0; }
    .pdf-page{ margin:0; box-shadow:none; }
    *{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }
</style>
</head>
<body class="mode-full">

  <div class="mode-bar">
    <button class="mode-btn active" id="modeBtn_full" onclick="setMode('full')">✅ উত্তর দেখাও</button>
    <button class="mode-btn" id="modeBtn_practice" onclick="setMode('practice')">📝 প্র্যাকটিসের জন্য সীমিত উত্তর</button>
    <button class="mode-btn" id="modeBtn_blank" onclick="setMode('blank')">✏️ কোনো উত্তর নাই</button>
  </div>

  <div class="actions">
    ${selToggleHtml}
    <button class="pdf-btn secondary" id="secToggleBtn" onclick="toggleSec()">🔢 সেকশন নম্বর লুকাও</button>
    <button class="pdf-btn secondary" id="qnumToggleBtn" onclick="toggleQnum()">🔢 প্রশ্ন নম্বর লুকাও</button>
    <button class="pdf-btn secondary" id="bookModeBtn" onclick="toggleBookMode()">📖 বই স্টাইল (কমপ্যাক্ট)</button>
    <button class="pdf-btn" onclick="window.print()">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="3" y="1" width="10" height="9" rx="1" stroke="white" stroke-width="1.5"/><rect x="1" y="7" width="14" height="7" rx="1" stroke="white" stroke-width="1.5"/><rect x="4" y="11" width="8" height="1.5" rx=".75" fill="white"/></svg>
      Print / Download PDF
    </button>
  </div>

  ${selectorHtml}
  ${warnHtml}

  <div id="pages"></div>
  <div id="stage" class="page-content">${cardsHtml}</div>
  <div id="probe"></div>

  <script>
    var LOGO_SRC     = ${JSON.stringify(logoSrc)};
    var HEADER_HTML  = ${JSON.stringify(headerHtml)};
    var CREDIT_HTML  = ${JSON.stringify(creditHtml)};
    var EXPLAIN_NOTE = ${JSON.stringify(explainNote)};
    var SECTIONS     = ${sectionsJson};
    var TOTAL_Q      = ${allQuestions.length};
    var selected     = null;        // null = all sections, else { sectionNum: true }
    var pageNumMode  = 'restart';   // 'restart' = pages from 1, 'normal' = numbers as in the full book
    var secNumMode   = 'orig';      // 'orig' = original numbers, 'renumber' = sections renumbered from 1
    var qCountSel    = TOTAL_Q;
    var rangeDirty   = false;       // a typed range not yet turned into checkboxes
    var BOOK_FONT_ON = ${bookFontSrc ? 'true' : 'false'};
    var currentMode  = 'full';

    (function(){
      var root = document.documentElement.style;
      root.setProperty('--logo-url', 'url("' + LOGO_SRC + '")');
      var im = new Image();
      im.onload = function(){
        if (im.naturalHeight) root.setProperty('--logo-r', String(im.naturalWidth / im.naturalHeight));
      };
      im.src = LOGO_SRC;
    })();

    var stage    = document.getElementById('stage');
    var pagesEl  = document.getElementById('pages');
    var probeEl  = document.getElementById('probe');
    var nodes    = Array.prototype.slice.call(stage.children);

    // items = each question card (+ the section divider right before a
    // section's first card), in document order
    var items = [];
    (function(){
      var pendingDivider = null;
      nodes.forEach(function(n){
        if (n.classList.contains('section-divider')) { pendingDivider = n; return; }
        if (n.classList.contains('card')) {
          items.push({
            card: n, divider: pendingDivider, h: 0,
            sec:  n.getAttribute('data-section') || '',
            qidx: n.getAttribute('data-qidx') || '',
            en:   n.querySelector('.qnum-en'),
            bn:   n.querySelector('.qnum-bn'),
            startsSection: n.classList.contains('section-start'),
            pair: {
              qno:   n.getAttribute('data-qno') || '',
              qnoBn: n.getAttribute('data-qno-bn') || '',
              qnoS:  n.getAttribute('data-qno-s') || '',
              qnoBnS: n.getAttribute('data-qno-bn-s') || '',
              ans:   n.getAttribute('data-correct') || ''
            }
          });
          pendingDivider = null;
        }
      });
    })();

    function isBook(){ return document.body.classList.contains('book-mode'); }

    function toBn(str){
      var d = '০১২৩৪৫৬৭৮৯';
      return String(str).replace(/[0-9]/g, function(x){ return d.charAt(+x); });
    }
    function escHtml(s){
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function isSel(it){ return !selected || !!selected[it.sec]; }

    // Full question numbers (section.index). With "renumber", the selected
    // sections are numbered 1, 2, 3... in order; otherwise original numbers.
    function applyNumbering(){
      var order = {}, k = 0;
      SECTIONS.forEach(function(s){
        if (!selected || selected[String(s.n)]) { k++; order[String(s.n)] = k; }
      });
      items.forEach(function(it){
        var secShown = (secNumMode === 'renumber' && order[it.sec]) ? order[it.sec] : it.sec;
        var full = secShown + '.' + it.qidx;
        it.pair.qno   = full;
        it.pair.qnoBn = toBn(full);
        if (it.en) it.en.textContent = full;
        if (it.bn) it.bn.textContent = toBn(full);
      });
    }

    // ── Section picker ──
    function buildSelPanel(){
      var box = document.getElementById('selList');
      if (!box) return;
      box.innerHTML = SECTIONS.map(function(s){
        return '<label class="sel-item"><input type="checkbox" class="sel-cb" value="' + escHtml(s.n) + '" checked>' +
               '<span><b>' + escHtml(s.n) + '.</b> ' + escHtml(s.title) + ' <span class="sel-cnt">(' + s.count + ')</span></span></label>';
      }).join('');
    }
    function toggleSelPanel(){
      var p = document.getElementById('selPanel');
      if (p) p.style.display = (p.style.display === 'none') ? 'block' : 'none';
    }
    function setSelMsg(t, ok){ var m = document.getElementById('selMsg'); if (m) { m.textContent = t; m.style.color = ok ? '#15803d' : '#b91c1c'; } }
    function selAll(on){
      Array.prototype.forEach.call(document.querySelectorAll('.sel-cb'), function(c){ c.checked = on; });
    }
    // "35-40", "1,3,5-8" (Bengali digits accepted) → { '35': true, ... }
    function parseRange(text){
      text = toEnDigits(text).replace(/\\s*[-–—]\\s*/g, '-');
      var set = {};
      text.split(/[,\\s]+/).forEach(function(tok){
        if (!tok) return;
        var m = tok.match(/^(\\d+)-(\\d+)$/);
        if (m) {
          var a = +m[1], b = +m[2];
          if (a > b) { var t = a; a = b; b = t; }
          SECTIONS.forEach(function(s){ if (+s.n >= a && +s.n <= b) set[String(s.n)] = true; });
        } else if (/^\\d+$/.test(tok)) {
          set[String(+tok)] = true;
        }
      });
      return set;
    }
    function toEnDigits(str){
      return String(str).replace(/[০-৯]/g, function(d){ return '০১২৩৪৫৬৭৮৯'.indexOf(d); });
    }
    function selRangeApply(){
      var set = parseRange(document.getElementById('selRange').value);
      var any = false;
      Array.prototype.forEach.call(document.querySelectorAll('.sel-cb'), function(c){
        c.checked = !!set[c.value];
        if (c.checked) any = true;
      });
      rangeDirty = false;
      setSelMsg(any ? '' : 'এই রেঞ্জে কোনো সেকশন পাওয়া যায়নি।');
    }
    function radioVal(name, def){
      var r = document.querySelector('input[name="' + name + '"]:checked');
      return r ? r.value : def;
    }
    function applySelection(thenPrint){
      var rin = document.getElementById('selRange');
      if (rin && rin.value.trim() && rangeDirty) selRangeApply();
      var sel = {}, cnt = 0;
      Array.prototype.forEach.call(document.querySelectorAll('.sel-cb'), function(c){
        if (c.checked) { sel[c.value] = true; cnt++; }
      });
      if (!cnt) { setSelMsg('কমপক্ষে একটা সেকশন বাছাই করো।'); return; }
      setSelMsg('');
      selected    = (cnt === SECTIONS.length) ? null : sel;
      pageNumMode = radioVal('pgnum', 'restart');
      secNumMode  = radioVal('secnum', 'orig');
      var b = document.getElementById('selToggleBtn');
      if (b) b.textContent = '📑 সেকশন বাছাই (' + cnt + '/' + SECTIONS.length + ')';
      paginate();
      setSelMsg(toBn(cnt) + 'টি সেকশন · ' + toBn(qCountSel) + 'টি প্রশ্ন · ' + toBn(pagesEl.children.length) + ' পৃষ্ঠা', true);
      if (thenPrint === true) window.print();
    }

    function setMode(m){
      currentMode = m;
      document.body.classList.remove('mode-full','mode-practice','mode-blank');
      document.body.classList.add('mode-' + m);
      ['full','practice','blank'].forEach(function(mm){
        var btn = document.getElementById('modeBtn_' + mm);
        if (btn) btn.classList.toggle('active', mm === m);
      });
      paginate();
    }

    // Hides only the part before the point ("12.5" shows as "5"), on the
    // question cards and on the answer strip.
    function toggleSec(){
      document.body.classList.toggle('hide-sec');
      var hidden = document.body.classList.contains('hide-sec');
      document.getElementById('secToggleBtn').textContent = hidden ? '🔢 সেকশন নম্বর দেখাও' : '🔢 সেকশন নম্বর লুকাও';
      paginate();
    }

    // Hides the whole auto number on the question cards (for questions
    // that already carry their own numbers). The answer strip keeps its
    // numbers so answers can still be matched.
    function toggleQnum(){
      document.body.classList.toggle('hide-qnum');
      var hidden = document.body.classList.contains('hide-qnum');
      document.getElementById('qnumToggleBtn').textContent = hidden ? '🔢 প্রশ্ন নম্বর দেখাও' : '🔢 প্রশ্ন নম্বর লুকাও';
      paginate();
    }

    function toggleBookMode(){
      document.body.classList.toggle('book-mode');
      var on = isBook();
      document.getElementById('bookModeBtn').classList.toggle('active', on);
      document.getElementById('bookModeBtn').textContent = on ? '📖 স্বাভাবিক সাইজ' : '📖 বই স্টাইল (কমপ্যাক্ট)';
      // The custom font loads on first use; repaginate when it arrives
      if (on && BOOK_FONT_ON && document.fonts && document.fonts.load) {
        document.fonts.load("12px 'DRBookFont'", 'ক').then(schedulePaginate, function(){});
      }
      paginate();
    }

    function buildMatCellsHtml(pairs){
      var bn = isBook();
      var hide = document.body.classList.contains('hide-sec');
      return pairs.map(function(p){
        var ansHtml = currentMode === 'blank'
          ? '<span class="mat-a blank"></span>'
          : '<span class="mat-a">' + p.ans + '</span>';
        var q = bn ? (hide ? p.qnoBnS : p.qnoBn) : (hide ? p.qnoS : p.qno);
        if (!q) q = p.qno;
        return '<span class="mat-cell"><span class="mat-q">' + q + '</span>' + ansHtml + '</span>';
      }).join('');
    }
    function matInner(pairs){
      return '<span class="mat-label">উত্তরপত্র</span><span class="mat-cells">' + buildMatCellsHtml(pairs) + '</span>';
    }

    function makePage(num, total, isLast){
      var pg = document.createElement('div');
      pg.className = 'pdf-page';
      pg.innerHTML =
        '<div class="pg-frame"></div>' +
        '<div class="pg-header">' + HEADER_HTML.split('%%QC%%').join(String(qCountSel)) + '</div>' +
        '<div class="page-content"></div>' +
        '<div class="pg-footer"><div class="pg-num">পৃষ্ঠা ' + num + ' / ' + total + '</div>' +
        '<div class="pg-credit">' + CREDIT_HTML + (isLast ? EXPLAIN_NOTE : '') + '</div></div>';
      return pg;
    }

    // Real height (with margin) of an answer strip holding these pairs,
    // measured inside a real page content box so the width is exact.
    function measureMat(host, pairs){
      var el = document.createElement('div');
      el.className = 'mini-answer-table';
      el.innerHTML = matInner(pairs);
      host.appendChild(el);
      var h = el.getBoundingClientRect().height;
      host.removeChild(el);
      return h + 12;
    }
    function samplePairs(n){
      var a = [];
      for (var i = 1; i <= n; i++) a.push({ qno: '12.' + i, qnoBn: '১২.' + i, qnoS: '' + i, qnoBnS: '' + i, ans: currentMode === 'blank' ? '' : 'ক' });
      return a;
    }
    // Learns pills-per-row and row height once per pagination so the
    // packing loop is plain arithmetic.
    function calibrateMat(host){
      var el = document.createElement('div');
      el.className = 'mini-answer-table';
      el.innerHTML = matInner(samplePairs(20));
      host.appendChild(el);
      var tops = {};
      Array.prototype.forEach.call(el.querySelectorAll('.mat-cell'), function(c){
        tops[Math.round(c.getBoundingClientRect().top)] = true;
      });
      host.removeChild(el);
      var rows = Object.keys(tops).length || 1;
      var perRow = Math.max(1, Math.ceil(20 / rows));
      var h1 = measureMat(host, samplePairs(perRow));
      var h2 = measureMat(host, samplePairs(perRow * 2));
      var rowH = Math.max(1, h2 - h1);
      return { perRow: perRow, rowH: rowH, base: Math.max(0, h1 - rowH) };
    }
    function estimateMat(m, n){
      if (!m || n <= 0) return 0;
      return m.base + Math.ceil(n / m.perRow) * m.rowH;
    }

    // ── Normal (single column) packing ──
    function pack(list, avail, needMat, matM, probeContent){
      var groups = [];
      var cur = null, acc = 0;
      list.forEach(function(it){
        var startNew = !cur || it.startsSection ||
          (cur.items.length > 0 && acc + it.h + (needMat ? estimateMat(matM, cur.items.length + 1) : 0) > avail);
        if (startNew) { cur = { items: [] }; groups.push(cur); acc = 0; }
        cur.items.push(it);
        acc += it.h;
      });

      // Safety net: check each page's answer strip with a real
      // measurement; if the estimate was short, push the last question
      // to the next page. A section's first page never mixes sections.
      if (needMat) {
        for (var gi = 0; gi < groups.length; gi++) {
          for (;;) {
            var g = groups[gi];
            if (g.items.length <= 1) break;
            var sum = g.items.reduce(function(s, it){ return s + it.h; }, 0);
            var mh = measureMat(probeContent, g.items.map(function(it){ return it.pair; }));
            if (sum + mh <= avail) break;
            var moved = g.items.pop();
            if (gi + 1 >= groups.length || groups[gi + 1].items[0].startsSection) {
              groups.splice(gi + 1, 0, { items: [] });
            }
            groups[gi + 1].items.unshift(moved);
          }
        }
      }
      return groups;
    }

    function render(groups, needMat, nums, total){
      var frag = document.createDocumentFragment();
      groups.forEach(function(g, i){
        var pg = makePage(nums[i], total, i === groups.length - 1);
        var content = pg.querySelector('.page-content');
        g.items.forEach(function(it){
          if (it.divider) content.appendChild(it.divider);
          content.appendChild(it.card);
        });
        if (needMat) {
          var mat = document.createElement('div');
          mat.className = 'mini-answer-table';
          mat.innerHTML = matInner(g.items.map(function(it){ return it.pair; }));
          content.appendChild(mat);
        }
        frag.appendChild(pg);
      });
      pagesEl.appendChild(frag);
    }

    // ── Book style (two column) packing ──
    // Fill column 1, then column 2, then start a new page. In practice /
    // blank mode the full-width answer strip height (based on the number
    // of questions on the page so far) is reserved for both columns. A
    // section's first question always starts a new page.
    function packBook(list, avail, needMat, matM){
      var pages = [];
      var page = null, col = 0, acc = 0, count = 0;
      function newPage(){ page = { cols: [[], []] }; pages.push(page); col = 0; acc = 0; count = 0; }
      list.forEach(function(it){
        if (!page || it.startsSection) newPage();
        for (;;) {
          var limit = avail - (needMat ? estimateMat(matM, count + 1) : 0);
          if (acc + it.h <= limit || page.cols[col].length === 0) break;
          if (col === 0) { col = 1; acc = 0; } else { newPage(); }
        }
        page.cols[col].push(it);
        acc += it.h;
        count++;
      });
      return pages;
    }

    function renderBook(pages, needMat, nums, total){
      var frag = document.createDocumentFragment();
      pages.forEach(function(p, i){
        var pg = makePage(nums[i], total, i === pages.length - 1);
        var content = pg.querySelector('.page-content');
        var wrap = document.createElement('div');
        wrap.className = 'book-cols';
        var all = [];
        p.cols.forEach(function(colItems){
          var colEl = document.createElement('div');
          colEl.className = 'book-col';
          colItems.forEach(function(it){
            if (it.divider) colEl.appendChild(it.divider);
            colEl.appendChild(it.card);
            all.push(it);
          });
          wrap.appendChild(colEl);
        });
        content.appendChild(wrap);
        if (needMat) {
          var mat = document.createElement('div');
          mat.className = 'mini-answer-table';
          mat.innerHTML = matInner(all.map(function(it){ return it.pair; }));
          content.appendChild(mat);
        }
        frag.appendChild(pg);
      });
      pagesEl.appendChild(frag);
    }

    function resetToStage(){
      nodes.forEach(function(n){ stage.appendChild(n); });
      pagesEl.textContent = '';
    }

    // Element height plus its own top/bottom margin (margins do not
    // collapse in the flex stage, same as on the real page/column).
    function outerH(el){
      var cs = getComputedStyle(el);
      return el.getBoundingClientRect().height +
        (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
    }

    // Section of a packed page (first item on it)
    function pageSecOf(g){
      var it = g.items ? g.items[0] : (g.cols[0][0] || g.cols[1][0]);
      return it ? it.sec : '';
    }

    function paginate(){
      if (!items.length) return;
      resetToStage();
      applyNumbering();
      qCountSel = items.filter(isSel).length;

      var needMat = currentMode !== 'full';
      var book = isBook();

      // Real content height of one page (nothing hard-coded)
      probeEl.textContent = '';
      var probePg = makePage(1, 1, false);
      probeEl.appendChild(probePg);
      var probeContent = probePg.querySelector('.page-content');
      var cs = getComputedStyle(probeContent);
      var availFull = probeContent.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      var matM = needMat ? calibrateMat(probeContent) : null;

      // Batched height read (all items sit in #stage)
      var hs = items.map(function(it){
        return [ outerH(it.card), it.divider ? outerH(it.divider) : 0 ];
      });
      items.forEach(function(it, i){ it.h = hs[i][0] + hs[i][1]; });

      // Pack ALL sections (so "normal" page numbers match the full book),
      // render only the selected ones, then verify no page overflows; on
      // overflow retry with more headroom. Overflow is clipped, so this can
      // only leave pages slightly emptier, never create a blank page.
      var safety = 4;
      for (var attempt = 0; attempt < 6; attempt++) {
        var all = book
          ? packBook(items, availFull - safety, needMat, matM)
          : pack(items, availFull - safety, needMat, matM, probeContent);
        var shown = [], nums = [];
        all.forEach(function(g, i){
          if (!isSel({ sec: pageSecOf(g) })) return;
          shown.push(g);
          nums.push(pageNumMode === 'normal' ? i + 1 : shown.length);
        });
        var total = pageNumMode === 'normal' ? all.length : shown.length;
        if (book) { renderBook(shown, needMat, nums, total); }
        else      { render(shown, needMat, nums, total); }
        var maxOver = 0;
        Array.prototype.forEach.call(pagesEl.children, function(pg){
          var c = pg.querySelector('.page-content');
          var o = c.scrollHeight - c.clientHeight;
          if (o > maxOver) maxOver = o;
        });
        if (maxOver <= 0.5) break;
        resetToStage();
        safety += Math.ceil(maxOver) + 4;
      }
      probeEl.textContent = '';
    }

    var pgTimer = null;
    function schedulePaginate(){ clearTimeout(pgTimer); pgTimer = setTimeout(paginate, 80); }

    buildSelPanel();
    paginate();
    if (document.fonts) {
      if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', schedulePaginate);
      if (document.fonts.ready) document.fonts.ready.then(schedulePaginate);
    }
    window.addEventListener('load', schedulePaginate);
  </script>

</body>
</html>`;

  ui.showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(880).setHeight(700),
    '📄 Answer Key — ' + examTitle
  );
}

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('webapp')
    .setTitle('DreamRise Result Portal')
    .addMetaTag('viewport','width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ===================== PRINT FUNCTIONS =====================
function _buildPrintUrl(sheet, portrait) {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const baseUrl = ss.getUrl().replace(/\/edit(\?.*)?$/, '');
  return baseUrl + '/export?format=pdf' +
    '&size=A4' +
    '&portrait=' + (portrait ? 'true' : 'false') +
    '&fitw=true' +
    '&gridlines=false' +
    '&notes=false' +
    '&sheetnames=false' +
    '&printtitle=false' +
    '&pagenumbers=true' +
    '&gid=' + sheet.getSheetId();
}

function instantPrintRanking() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Ranking Page");
  if (!sheet) { SpreadsheetApp.getUi().alert("Ranking Page নেই। আগে Sync করুন।"); return; }
  showDownloadDialog(_buildPrintUrl(sheet, false), "Ranking Page Print");
}

function instantPrintReport() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PDF Report");
  if (!sheet) { SpreadsheetApp.getUi().alert("PDF Report নেই। আগে Sync করুন।"); return; }
  showDownloadDialog(_buildPrintUrl(sheet, true), "PDF Report Download");
}

function showDownloadDialog(url, title) {
  const html = `
    <style>
      body{font-family:'Segoe UI',sans-serif;text-align:center;padding:25px;background:#f8fafc;}
      h3{color:#1e3a8a;margin-bottom:5px;}
      p{color:#64748b;font-size:13px;margin-bottom:20px;}
      .btn{display:inline-block;background:#2563eb;color:white;padding:13px 28px;
           border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;
           margin-top:5px;transition:background 0.2s;}
      .btn:hover{background:#1d4ed8;}
    </style>
    <h3>📄 ডাউনলোড প্রস্তুত</h3>
    <p>নিচের বাটনে ক্লিক করে PDF ডাউনলোড করুন</p>
    <a href="${url}" target="_blank" class="btn"
       onclick="setTimeout(()=>google.script.host.close(),1500)">⬇️ ডাউনলোড করুন</a>
  `;
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(370).setHeight(220), title
  );
}
