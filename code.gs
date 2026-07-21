/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║         DreamRise Web App — v70.0 (Self-Syncing Edition)         ║
 * ║  Developer: Muhammad Ibrahim                                     ║
 * ║  Fixes from v69:                                                 ║
 * ║   ✅ NEW: Auto-Sync on Portal Search — শীট ম্যানুয়ালি না        ║
 * ║      খুললেও, স্টুডেন্ট যখন রেজাল্ট পোর্টালে ফোন নম্বর দিয়ে      ║
 * ║      সার্চ করবে, ব্যাকগ্রাউন্ডে নিজে থেকেই (≤১ মিনিট stale হলে) ║
 * ║      সিঙ্ক হয়ে যাবে। ২৪/৭ ফর্ম খোলা থাকলেও কেউ রেজাল্ট মিস     ║
 * ║      করবে না।                                                    ║
 * ║   ✅ LockService দিয়ে race-condition প্রতিরোধ — একসাথে অনেকে    ║
 * ║      এলেও মাত্র একজনের রিকোয়েস্টে sync চলবে, বাকিরা সেই         ║
 * ║      মুহূর্তের বিদ্যমান ডেটা থেকেই সার্চ পাবে (কখনো error/wait  ║
 * ║      হবে না)।                                                    ║
 * ║  Fixes from v68:                                                 ║
 * ║   ✅ FIXED: কয়েক ঘন্টা পর রেজাল্ট না পাওয়ার বাগ                ║
 * ║      (কারণ ছিল: CacheService ৬ ঘণ্টা পর মুছে যেত, fallback      ║
 * ║       ভঙ্গুর ছিল। এখন একটি permanent hidden "DR_Backup" শীটে    ║
 * ║       ডেটা রাখা হয় যা কখনো এক্সপায়ার হয় না)                   ║
 * ║   ✅ Exam Summary bar (Total Q, Full Marks, Pass Mark,           ║
 * ║      Avg, Highest) — Ranking Page, PDF Report, Web App সব        ║
 * ║      জায়গায় দেখানো হয়                                          ║
 * ║   ✅ DreamRise Logo (ছবি) — Setup Wizard, Ranking Page,          ║
 * ║      PDF Report এবং Web App হেডারে যুক্ত                        ║
 * ║   ✅ JSON প্রিন্টে আর আসবে না (note & hidden cell দুটোই বন্ধ)  ║
 * ║   ✅ Multi-page print সঠিকভাবে কাজ করে (print area explicit)   ║
 * ║   ✅ শুধু Top-3 সবুজ, বাকি সব সাদা/ধূসর (zebra stripe)        ║
 * ║   ✅ Smart Debounce Auto-Rank (30s delay, form=instant)         ║
 * ║   ✅ Tie-breaker: same score → কম ভুল = ভালো rank              ║
 * ║   ✅ Duplicate phone filter + short phone skip                  ║
 * ║   ✅ Answer Key row double-check (name+position)                ║
 * ║   ✅ Statistics Dialog                                           ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ===================== BRANDING =====================
// DreamRise লোগো — এখানে একবার বদলালে সব জায়গায় আপডেট হয়ে যাবে।
// Light UI (Web App light mode) এর জন্য light-background লোগো
const DR_LOGO_LIGHT_URL = "https://github.com/ibrahimsiddiknasib-glitch/DreamRise/blob/main/Logo_For_Light.png?raw=true";
// Dark UI (Web App dark mode) এবং Ranking/PDF header (dark bg) এর জন্য dark-background লোগো
const DR_LOGO_DARK_URL  = "https://github.com/ibrahimsiddiknasib-glitch/DreamRise/blob/main/Logo_For_Dark.png?raw=true";
// Default (backward-compat alias — Ranking Page, PDF, Setup Wizard এ dark bg থাকে)
const DR_LOGO_URL = DR_LOGO_DARK_URL;
// PDF Watermark টেক্সট
const DR_WATERMARK_TEXT = "DreamRise";

// Permanent backup sheet এর নাম (cache এক্সপায়ার হলেও এখান থেকে ডেটা পাওয়া যাবে)
const DR_BACKUP_SHEET = "DR_Backup";

// Auto-Sync: পোর্টালে সার্চ করার সময় ডেটা এই সময়ের (মিলিসেকেন্ড) চেয়ে পুরনো হলে
// ব্যাকগ্রাউন্ডে নতুন sync চালানো হবে। ডিফল্ট ৬০ সেকেন্ড।
const DR_AUTO_SYNC_MAX_AGE_MS = 60 * 1000;

// Lock অপেক্ষার সর্বোচ্চ সময় (মিলিসেকেন্ড) — এর বেশি হলে lock না পেয়েই
// বিদ্যমান ডেটা দিয়ে এগিয়ে যাওয়া হবে, যাতে ইউজার কখনো আটকে না থাকে।
const DR_LOCK_WAIT_MS = 8000;

// ===================== MENU & SETUP =====================
function onOpen(e) {
  // installable trigger বা time-based context-এ getUi() কাজ করে না
  // AuthMode.NONE বা LIMITED হলে menu বানানো যাবে না — silently skip করো
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
      .addItem('🔁 Reset System Settings',         'resetSettings')
      .addToUi();
  } catch(x) {
    // time-based trigger বা editor-run context — menu দেখানো সম্ভব নয়, skip
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
      'standardRange': config.standardRange || ""
    });
    setupAutomationTriggers();
    calculateAndRank();
    return "Success!";
  } catch (e) {
    return "Error: " + e.message;
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
  // পুরনো সব DreamRise trigger মুছো
  // 'onOpen' কে কখনো installable trigger হিসেবে রাখা উচিত নয় —
  // সেটা থাকলে time-based context-এ getUi() error দেয়।
  ScriptApp.getProjectTriggers().forEach(t => {
    if (['calculateAndRank','onEditThrottled','runDebouncedRank','onOpen'].includes(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  });
  // Form Submit → তাৎক্ষণিক rank
  ScriptApp.newTrigger('calculateAndRank').forSpreadsheet(ss).onFormSubmit().create();
  // Manual Edit → debounce
  ScriptApp.newTrigger('onEditThrottled').forSpreadsheet(ss).onEdit().create();
}

/**
 * SMART AUTO-RANK ENGINE (Debounce)
 * ----------------------------------
 * - Answer Key row edit  → তাৎক্ষণিক recalculate
 * - Student data edit    → 30s debounce (bulk entry তে বারবার চলে না)
 * - Ranking Page / PDF Report / DR_Backup sheet এ edit → সম্পূর্ণ ignore (infinite loop বন্ধ)
 */
function onEditThrottled(e) {
  try {
    const props = PropertiesService.getScriptProperties().getProperties();
    if (!props.examName) return;

    const ss          = SpreadsheetApp.getActiveSpreadsheet();
    const editedSheet = e.range.getSheet();

    // Ranking / PDF / Backup sheet এ edit → ignore
    if (["Ranking Page","PDF Report",DR_BACKUP_SHEET].includes(editedSheet.getName())) return;

    // Source sheet (প্রথম sheet) ছাড়া অন্য sheet → ignore
    if (editedSheet.getSheetId() !== ss.getSheets()[0].getSheetId()) return;

    const ansKeyRow  = parseInt(props.ansKeyRow) || 2;
    const editedRow  = e.range.getRow();

    // Answer Key edit → সাথে সাথে rank
    if (editedRow === ansKeyRow) { calculateAndRank(); return; }

    // Student edit → debounce: পুরনো pending trigger মুছো, নতুন 30s timer সেট করো
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

/**
 * Multi-answer check.
 * FIXED (v71): আগে এই ফাংশন Answer Key-কে কমা (,) বা স্ল্যাশ (/) দিয়ে ভেঙে
 * একাধিক সঠিক উত্তর সাপোর্ট করার চেষ্টা করত। কিন্তু আসল exam ডেটাতে (Google
 * Form থেকে) MCQ অপশনের পূর্ণ টেক্সটের ভিতরেই স্বাভাবিকভাবে কমা/স্ল্যাশ
 * থাকে (যেমন: "সাপও মরে, লাঠিও না ভাঙ্গে", "টেকনাফ, কক্সবাজার")। ফলে সেই
 * split লজিক সঠিক উত্তরকেও ভুল ভাবে টুকরো করে ফেলত এবং তুলনা মিলত না —
 * এতে বাস্তবের চেয়ে কম "সঠিক" গণনা হতো।
 * এখন Google Sheet formula-র লজিকের (F2:DA2 = F$7:DA$7) সাথে হুবহু মিলিয়ে
 * সরাসরি, সম্পূর্ণ টেক্সট তুলনা (trim + case-insensitive) করা হয়।
 */
function isCorrect(studentAns, keyAns) {
  const k = String(keyAns).trim().toUpperCase();
  const s = String(studentAns).trim().toUpperCase();
  if (!k || !s) return false;
  return k === s;
}

/** Exam summary string — Ranking Page, PDF Report, Web App সব জায়গায় একই ফরম্যাটে দেখানো হয় */
function buildSummaryText(meta) {
  return `Total Q: ${meta.totalQ} | Full Marks: ${meta.fullMarks} | Pass Mark: ${meta.passPercent}% (${meta.passThreshold}) | ` +
         `Examinees: ${meta.examinees} | Passed: ${meta.passCount} | Avg: ${meta.avg} | Highest: ${meta.highScore}`;
}

// ===================== MAIN RANKING ENGINE =====================
function calculateAndRank() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

  // Header row
  const titleRowIdx = rawData.findIndex(row => /name|full|নাম/i.test(row.join(" ")));
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

  let students = [], seen = new Set();
  let passCount = 0, highScore = -Infinity, totalScoreSum = 0;

  for (let i = 0; i < rawData.length; i++) {
    if (i === titleRowIdx || i === ansKeyRowIdx) continue;
    const row  = rawData[i];
    const name = String(row[nCol] || "").trim();
    // শুধু সংখ্যা রাখো, কমপক্ষে ৭ ডিজিট দরকার
    const phone = String(row[wCol] || "").trim().replace(/\D/g, '');
    if (!name || phone.length < 7) continue;
    if (name === ansKeyName) continue;      // answer key row বাদ
    if (seen.has(phone)) continue;          // duplicate বাদ
    seen.add(phone);

    let totalC = 0, totalW = 0, totalScore = 0, subFail = false, subDataForTable = [];

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
        if (score < subPassMark) subFail = true;
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
    const isPassed = !subFail && totalScore >= (fullMarksPossible * globalPassPct / 100);
    if (isPassed) passCount++;
    if (totalScore > highScore) highScore = totalScore;
    totalScoreSum += totalScore;

    const phoneDisplay = phone.length >= 3 ? "********" + phone.slice(-3) : phone;
    students.push({
      name, phone,
      district:     dCol !== -1 ? String(row[dCol] || "N/A").trim() : "N/A",
      phoneDisplay,
      subData:      subDataForTable,
      totalC, totalW,
      score:        totalScore,
      passed:       isPassed
    });
  }

  if (students.length === 0) {
    try { ss.toast('⚠️ কোনো valid student পাওয়া যায়নি!', 'DreamRise', 5); } catch(x){}
    return;
  }
  if (highScore === -Infinity) highScore = 0;

  // Sort: pass > fail, then score desc, then wrong asc (tie-breaker)
  students.sort((a, b) => {
    if (a.passed !== b.passed) return a.passed ? -1 : 1;
    if (b.score  !== a.score)  return b.score - a.score;
    return a.totalW - b.totalW;
  });

  const fullMarks     = (totalQCount * posMark).toFixed(2);
  const passThreshold = (totalQCount * posMark * globalPassPct / 100).toFixed(2);
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
    subjects
  };

  renderRankingPage(students, props, subjects, meta);
  renderPdfReport(students, props, subjects, meta);

  // Meta → ScriptProperties (permanent fallback, কখনো এক্সপায়ার হয় না)
  try {
    PropertiesService.getScriptProperties().setProperty('lastMeta', JSON.stringify(meta));
    PropertiesService.getScriptProperties().setProperty('lastSyncTime', Date.now().toString());
  } catch(x){}

  // ════════════════════════════════════════════════════════════════
  // PERMANENT DATA STORAGE — মূল বাগ ফিক্স
  // ────────────────────────────────────────────────────────────────
  // আগে এই ডেটা শুধু CacheService তে থাকতো যা ৬ ঘণ্টা পর মুছে যেত,
  // ফলে কয়েক ঘণ্টা পর কেউ ফোন নম্বর দিয়ে খুঁজলে রেজাল্ট পেতো না।
  // এখন একটি hidden "DR_Backup" শীটে এই ডেটা স্থায়ীভাবে রাখা হয়,
  // যা কখনো এক্সপায়ার হবে না (Manual Sync না করা পর্যন্ত থাকবে)।
  // CacheService এখনো ব্যবহার করা হয় শুধু speed বাড়ানোর জন্য —
  // কিন্তু সেটা miss/expire হলে সরাসরি DR_Backup শীট থেকে পড়া হবে,
  // ভঙ্গুর "Ranking Page" column-guessing fallback আর নেই।
  // ════════════════════════════════════════════════════════════════
  try {
    const cacheStudents = students.map(s => [
      s.name, s.district, s.phone, s.totalC, s.totalW, s.score, s.passed ? 1 : 0, s.subData
    ]);
    const payload = { s: cacheStudents, m: meta, t: Date.now() };
    const payloadJson = JSON.stringify(payload);

    // 1) Fast cache (best-effort, ৬ ঘণ্টা)
    try { CacheService.getScriptCache().put('rankDataMin', payloadJson, 21600); } catch(x){}

    // 2) Permanent backup sheet (কখনো এক্সপায়ার হয় না — মূল উৎস)
    saveBackupSheet(payloadJson);

  } catch(x) { console.error("Data persist failed:", x); }

  try { ss.toast(`✅ সম্পন্ন! ${students.length} জন | পাস: ${passCount}`, 'DreamRise System', 5); } catch(x){}
}

/**
 * Backup ডেটা একটি hidden sheet-এ সেভ করে। Apps Script সিঙ্গেল-সেলে
 * সর্বোচ্চ ৫০,০০০ ক্যারেক্টার রাখতে পারে, তাই বড় ডেটাকে একাধিক
 * cell-এ ভাগ করে chunk করে রাখা হয় (3000+ student নিরাপদ থাকার জন্য)।
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

  const CHUNK_SIZE = 40000; // safety margin নিচে ৫০k limit থেকে
  const chunks = [];
  for (let i = 0; i < payloadJson.length; i += CHUNK_SIZE) {
    chunks.push(payloadJson.slice(i, i + CHUNK_SIZE));
  }
  // প্রতিটা chunk একটা করে row-এর A কলামে
  const rows = chunks.map(c => [c]);
  if (rows.length > 0) {
    sheet.getRange(1, 1, rows.length, 1).setValues(rows);
  }
}

/** Backup sheet থেকে পুরো payload পড়ে JSON parse করে ফেরত দেয়, অথবা null */
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

/** Cache → Backup Sheet — এই ক্রমে চেষ্টা করে সবচেয়ে আপডেটেড ডেটা আনে */
function getStudentDataPayload() {
  try {
    const cached = CacheService.getScriptCache().get('rankDataMin');
    if (cached) return JSON.parse(cached);
  } catch(x){}
  return loadBackupSheet();
}

// ===================== AUTO-SYNC ON PORTAL SEARCH =====================
/**
 * FIXED (v71): আগে এই ফাংশন Portal সার্চের সময় ডেটা পুরনো (stale) হলে
 * সরাসরি ভারী calculateAndRank() (পুরো re-rank + Ranking Page + PDF Report
 * পুনর্নির্মাণ + লোগো ফেচ) চালিয়ে দিত এবং search request সেটা শেষ না হওয়া
 * পর্যন্ত ব্লক হয়ে থাকত — অনেক সময় লেগে যেত বা টাইমআউট হয়ে যেত, ফলে
 * ব্যবহারকারী কোনো error ছাড়াই অনন্তকাল "Loading..." দেখতে থাকত।
 *
 * এখন এই ফাংশন কখনো ব্লক করে না — শুধু একটি হালকা background trigger
 * শিডিউল করে (কয়েক সেকেন্ড পরে চলবে), search request নিজে তৎক্ষণাৎ ফিরে
 * আসে। প্রকৃত sync হয় মূলত ফর্ম সাবমিটের সাথে সাথেই (onFormSubmit
 * trigger), এবং কোনো কারণে সেটা মিস হলে searchStudent() নিজে থেকেই
 * নির্দিষ্ট স্টুডেন্টের রেজাল্ট খুঁজে হিসাব করে নেয় (দেখুন
 * computeSingleStudentAndMerge)।
 */
function ensureFreshDataForPortal() {
  try {
    const lastSync = parseInt(PropertiesService.getScriptProperties().getProperty('lastSyncTime')) || 0;
    const isStale  = (Date.now() - lastSync) > DR_AUTO_SYNC_MAX_AGE_MS;
    if (isStale) scheduleBackgroundSync();
  } catch(x) {
    console.error("ensureFreshDataForPortal failed:", x);
  }
}

/**
 * একটি non-blocking, "fire-and-forget" ফুল sync শিডিউল করে (৫ সেকেন্ড পরে
 * চলবে)। ইতিমধ্যে একটি pending sync trigger থাকলে নতুন করে আর বসানো হয় না
 * (duplicate trigger এড়ানোর জন্য)। এই ফাংশন সবসময় সাথে সাথেই রিটার্ন করে,
 * কখনো কাউকে অপেক্ষা করায় না।
 */
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
function renderRankingPage(students, props, subjects, meta) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName("Ranking Page") || ss.insertSheet("Ranking Page");
  sheet.clear();
  sheet.clearNotes();

  // Headers
  let headers = ["Rank", "Student Name", "District", "WhatsApp"];
  if (props.isSubjectWise === "true") {
    subjects.forEach(sub => headers.push(sub.name+"(C)", sub.name+"(W)", sub.name+"(S)"));
  }
  headers.push("Total C", "Total W", "Score", "Result");
  const COL = headers.length;

  // ── Row 1: Logo header — শুধু লোগো ছবি, কোনো টেক্সট নেই ──
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

  // ── Row 2: Exam Name ──
  sheet.getRange(2,1,1,COL).merge()
    .setValue("- " + meta.examName.toUpperCase() + " RESULT -")
    .setBackground("#2563eb").setFontColor("white").setFontSize(14)
    .setFontWeight("Bold").setHorizontalAlignment("center").setFontFamily("Anek Bangla");

  // ── Row 3: Summary (note বা hidden cell — কোনোটাই নেই) ──
  const summary = buildSummaryText(meta);
  sheet.getRange(3,1,1,COL).merge()
    .setValue(summary)
    .setBackground("#f1f5f9").setFontWeight("Regular").setFontSize(10)
    .setHorizontalAlignment("center")
    .setBorder(true,true,true,true,true,true,"#cbd5e1",SpreadsheetApp.BorderStyle.SOLID)
    .setFontFamily("Anek Bangla");
  // ❌ কোনো .setNote() নেই — JSON প্রিন্টে আসবে না
  // ❌ কোনো hidden cell নেই — সম্পূর্ণ পরিষ্কার

  // ── Row 4: Headers ──
  sheet.getRange(4,1,1,COL).setValues([headers])
    .setBackground("#0f172a").setFontColor("white").setFontWeight("Bold")
    .setHorizontalAlignment("center").setFontFamily("Anek Bangla").setFontSize(11);

  // ── Rows 5+: Student data ──
  if (students.length > 0) {
    const tableData = students.map((s, idx) => {
      let row = [idx+1, s.name, s.district, s.phoneDisplay];
      if (s.subData.length > 0) row.push(...s.subData);
      row.push(s.totalC, s.totalW, s.score.toFixed(2), s.passed ? "PASS" : "FAIL");
      return row;
    });

    const range = sheet.getRange(5, 1, tableData.length, COL);
    range.setValues(tableData)
      .setHorizontalAlignment("center").setVerticalAlignment("middle").setFontFamily("Anek Bangla");

    // ─── Colors ───
    // Top 3 Pass: সবুজ (#dcfce7 / #166534)
    // Fail:       লাল   (#fee2e2 / #991b1b)
    // Others:     zebra  সাদা / হালকা ধূসর
    let bgColors = [], txtColors = [];
    let passIdx = 0; // pass করা student এর মধ্যে top 3 গণনা
    tableData.forEach((row, i) => {
      const isFail = row[COL-1] === "FAIL";
      if (isFail) {
        bgColors.push(Array(COL).fill("#fee2e2"));
        txtColors.push(Array(COL).fill("#991b1b"));
      } else {
        if (passIdx < 3) {
          // TOP 3 PASS → সবুজ
          bgColors.push(Array(COL).fill("#dcfce7"));
          txtColors.push(Array(COL).fill("#166534"));
        } else {
          // বাকি সব → zebra (সাদা / হালকা ধূসর)
          bgColors.push(Array(COL).fill(passIdx % 2 === 0 ? "#ffffff" : "#f8fafc"));
          txtColors.push(Array(COL).fill("#1e293b"));
        }
        passIdx++;
      }
    });
    range.setBackgrounds(bgColors).setFontColors(txtColors);

    // Rank column Bold
    sheet.getRange(5,1,tableData.length,1).setFontWeight("bold");
    // Name column left-align
    sheet.getRange(5,2,tableData.length,1).setHorizontalAlignment("left");
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

  // ════ PRINT AREA — meta column নেই, শুধু A থেকে শেষ data column ════
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
  const COL = 8;

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
  // ❌ কোনো .setNote() নেই

  sheet.getRange(4,1,1,COL)
    .setValues([["Rank","Student Name","District","WhatsApp","Total C","Total W","Score","Result"]])
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

    values.push([idx+1, s.name, s.district, s.phoneDisplay,
                 s.totalC, s.totalW, s.score.toFixed(2), s.passed ? "PASS" : "FAIL"]);
    backgrounds.push(Array(COL).fill(bgHex));
    fontColors.push(["#000000","#000000","#000000","#64748b",
                     "#000000","#000000","#000000", txtResult]);
    rowPtr++;

    // Subject detail row (isSubjectWise)
    if (props.isSubjectWise === "true" && s.subData.length > 0) {
      let parts = [];
      subjects.forEach((sub, sIdx) => {
        const c  = s.subData[sIdx*3], w = s.subData[sIdx*3+1], sc = s.subData[sIdx*3+2];
        parts.push(`${sub.name}: ✔${c} ✘${w} [${sc}] পাস:${parseFloat(sub.pass).toFixed(2)}`);
      });
      values.push(["","  ↳ "+parts.join(" | "),"","","","","",""]);
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
  [45,180,100,100,55,55,60,60].forEach((w,i) => sheet.setColumnWidth(i+1, w));
}

// ===================== WEB APP: GET EXAM INFO =====================
function getExamInfo() {
  // পোর্টাল লোড হওয়ার সাথেই ডেটা স্টেইল থাকলে ব্যাকগ্রাউন্ডে (non-blocking)
  // sync শিডিউল করো, যাতে summary bar-ও সবসময় সাম্প্রতিক তথ্য দেখায়।
  ensureFreshDataForPortal();
  try {
    // 1. ScriptProperties (permanent, কখনো এক্সপায়ার হয় না) — primary source
    const lastMeta = PropertiesService.getScriptProperties().getProperty('lastMeta');
    if (lastMeta) {
      const meta = JSON.parse(lastMeta);
      meta.summaryText = buildSummaryText(meta);
      meta.logoUrl      = DR_LOGO_DARK_URL;
      meta.logoLightUrl = DR_LOGO_LIGHT_URL;
      return meta;
    }
    // 2. Cache fallback (সাধারণত দরকার হবে না, কিন্তু রেখে দেওয়া হলো)
    const cached = CacheService.getScriptCache().get('rankDataMin');
    if (cached) {
      const meta = Object.assign({}, JSON.parse(cached).m);
      meta.summaryText  = buildSummaryText(meta);
      meta.logoUrl      = DR_LOGO_DARK_URL;
      meta.logoLightUrl = DR_LOGO_LIGHT_URL;
      return meta;
    }
    // 3. Fallback
    return { examName: SpreadsheetApp.getActiveSpreadsheet().getName(), logoUrl: DR_LOGO_DARK_URL, logoLightUrl: DR_LOGO_LIGHT_URL };
  } catch(e) {
    return { examName: SpreadsheetApp.getActiveSpreadsheet().getName(), logoUrl: DR_LOGO_DARK_URL, logoLightUrl: DR_LOGO_LIGHT_URL };
  }
}

// ===================== WEB APP: SEARCH STUDENT =====================
/**
 * FIXED (v71): সার্চ এখন আর কখনো ভারী পূর্ণাঙ্গ calculateAndRank()-এর জন্য
 * অপেক্ষা করে না (আগের ব্লকিং বাগ, যেখানে নতুন স্টুডেন্ট সার্চ করলে কোনো
 * error ছাড়াই অনন্তকাল Loading থেকে যেত)।
 *
 * নতুন ধাপ:
 *  1) প্রথমে বিদ্যমান প্রস্তুত ডেটাতে (Cache → Backup Sheet) খোঁজা হয় —
 *     পাওয়া গেলে সাথে সাথেই রেজাল্ট দেখানো হয় (দ্রুততম পথ)।
 *  2) না পাওয়া গেলে (যেমন: ফর্ম সাবমিট হয়েছে কিন্তু এখনো পূর্ণ sync হয়নি)
 *     — শুধু এই একজন স্টুডেন্টের জন্য "Form Responses" সোর্স শীট থেকে
 *     তার সারি খুঁজে বের করে শুধু তার হিসাব (correct/wrong/score) করা হয়,
 *     বিদ্যমান ডেটার সাথে merge করে rank বসিয়ে সাথে সাথেই ফেরত দেওয়া হয়।
 *     পুরো re-sync না করায় এটা অনেক দ্রুত।
 *  3) এরপর ব্যাকগ্রাউন্ডে একটি সম্পূর্ণ sync শিডিউল হয়ে যায় (non-blocking),
 *     যাতে Ranking Page/PDF Report ইত্যাদিও শীঘ্রই সম্পূর্ণ আপডেট হয়।
 *  4) সোর্স শীটেও না পাওয়া গেলে তখনই "নম্বর পাওয়া যায়নি" দেখানো হয়।
 *
 * নেগেটিভ মার্কের কারণে স্কোর ঋণাত্মক (negative) হলেও তাদের রেজাল্ট
 * স্বাভাবিকভাবেই দেখানো হয় — কোথাও স্কোরের sign অনুযায়ী কোনো filtering
 * নেই।
 */
function searchStudent(phone) {
  try {
    const searchPhone = phone.replace(/\D/g,'').slice(-10);
    if (searchPhone.length < 7) return { error: "সঠিক ফোন নম্বর দিন!" };

    // ডেটা পুরনো হলে ব্যাকগ্রাউন্ডে (non-blocking) সম্পূর্ণ sync শিডিউল করো
    ensureFreshDataForPortal();

    let payload = getStudentDataPayload();

    // 1) প্রস্তুত ডেটাতে খোঁজো — দ্রুততম পথ
    if (payload) {
      const result = findStudentInMinifiedCache(payload, searchPhone);
      if (result) {
        result.meta.summaryText  = buildSummaryText(result.meta);
        result.meta.logoUrl      = DR_LOGO_DARK_URL;
        result.meta.logoLightUrl = DR_LOGO_LIGHT_URL;
        return result;
      }
    }

    // 2) প্রস্তুত ডেটাতে না থাকলে — শুধু এই স্টুডেন্টের জন্য টার্গেটেড হিসাব
    const singleResult = computeSingleStudentAndMerge(searchPhone, payload);
    if (singleResult) {
      singleResult.meta.summaryText  = buildSummaryText(singleResult.meta);
      singleResult.meta.logoUrl      = DR_LOGO_DARK_URL;
      singleResult.meta.logoLightUrl = DR_LOGO_LIGHT_URL;
      return singleResult;
    }

    // 3) কোথাও পাওয়া যায়নি
    if (!payload) return { error: "⚠️ 'Manual Sync Ranking' চালু করুন!" };
    return { error: "❌ আপনার নম্বর পাওয়া যায়নি!" };
  } catch(e) {
    return { error: "⚠️ সার্ভার ত্রুটি: " + e.toString() };
  }
}

/**
 * শুধু একজন স্টুডেন্টের জন্য টার্গেটেড হিসাব:
 *  - Source sheet-এ ফোন নম্বর দিয়ে তার সারি খুঁজে বের করে
 *  - configuration (posMark/negMark/ansKeyRow/subjects) অনুযায়ী তার
 *    correct/wrong/score হিসাব করে (calculateAndRank()-এর মতোই লজিক)
 *  - বিদ্যমান payload (যদি থাকে)-এর সাথে merge করে rank ও meta আপডেট করে
 *  - LockService দিয়ে race-condition এড়িয়ে ফলাফল Cache+Backup-এ সেভ করে,
 *    যাতে পরের সার্চে এটা সরাসরি ফাস্ট পাথ থেকেই পাওয়া যায়
 *  - শেষে একটি ব্যাকগ্রাউন্ড ফুল-sync শিডিউল করে দেয়, যাতে Ranking
 *    Page/PDF Report ইত্যাদিও শীঘ্রই authoritative ভাবে আপডেট হয়
 *
 * পাওয়া না গেলে null রিটার্ন করে।
 */
function computeSingleStudentAndMerge(searchPhone, payload) {
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

    const titleRowIdx = rawData.findIndex(row => /name|full|নাম/i.test(row.join(" ")));
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

    // এই ফোন নম্বরের সারি খুঁজে বের করো (header + answer key বাদে)
    let matchRow = null;
    for (let i = 0; i < rawData.length; i++) {
      if (i === titleRowIdx || i === ansKeyRowIdx) continue;
      const row  = rawData[i];
      const name = String(row[nCol] || "").trim();
      const phoneDigits = String(row[wCol] || "").trim().replace(/\D/g, '');
      if (!name || phoneDigits.length < 7) continue;
      if (name === ansKeyName) continue;
      if (phoneDigits.endsWith(searchPhone)) { matchRow = row; break; }
    }
    if (!matchRow) return null; // সোর্স শীটেও নেই

    // এই একজনের correct/wrong/score হিসাব (calculateAndRank()-এর সাথে অভিন্ন লজিক)
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
    const isPassed = !subFail && totalScore >= (fullMarksPossible * globalPassPct / 100);
    const name    = String(matchRow[nCol]).trim();
    const phone   = String(matchRow[wCol]).trim().replace(/\D/g, '');
    const district = dCol !== -1 ? String(matchRow[dCol] || "N/A").trim() : "N/A";

    // বিদ্যমান students লিস্টের সাথে merge করো (নেগেটিভ স্কোর হলেও যোগ হবে,
    // কোনো sign-ভিত্তিক filtering নেই)
    let students = payload ? payload.s.slice() : [];
    students = students.filter(s => String(s[2]) !== phone); // safety dedupe
    students.push([name, district, phone, totalC, totalW, totalScore, isPassed ? 1 : 0, subDataForTable]);

    // পুনরায় sort: pass > fail, score desc, wrong asc
    students.sort((a, b) => {
      const aPass = a[6] === 1, bPass = b[6] === 1;
      if (aPass !== bPass) return aPass ? -1 : 1;
      if (b[5] !== a[5]) return b[5] - a[5];
      return a[4] - b[4];
    });

    // Meta পুনর্গণনা
    let passCount = 0, highScore = -Infinity, sum = 0;
    students.forEach(s => {
      if (s[6] === 1) passCount++;
      if (s[5] > highScore) highScore = s[5];
      sum += s[5];
    });

    const baseMeta = payload ? Object.assign({}, payload.m) : {
      examName:      props.examName,
      totalQ:        totalQCount,
      fullMarks:     fullMarksPossible.toFixed(2),
      passPercent:   globalPassPct,
      passThreshold: (fullMarksPossible * globalPassPct / 100).toFixed(2),
      negMark, posMark,
      isSubjectWise: isSubWise,
      subjects
    };
    baseMeta.examinees = students.length;
    baseMeta.passCount = passCount;
    baseMeta.failCount = students.length - passCount;
    baseMeta.avg       = students.length > 0 ? (sum / students.length).toFixed(2) : "0";
    baseMeta.highScore = (highScore === -Infinity ? 0 : highScore).toFixed(2);

    const newPayload = { s: students, m: baseMeta, t: Date.now() };

    // Lock নিয়ে persist করো — না পেলেও রেজাল্ট দেখানো বন্ধ হবে না,
    // শুধু এবারের মতো save না-ও হতে পারে (পরের ফুল sync-এ ঠিক হয়ে যাবে)
    gotLock = lock.tryLock(DR_LOCK_WAIT_MS);
    if (gotLock) {
      try {
        const json = JSON.stringify(newPayload);
        CacheService.getScriptCache().put('rankDataMin', json, 21600);
        saveBackupSheet(json);
        PropertiesService.getScriptProperties().setProperty('lastMeta', JSON.stringify(baseMeta));
      } catch(x) { console.error("computeSingleStudentAndMerge persist failed:", x); }
    }

    // এই merge সাময়িক — শীঘ্রই একটি প্রকৃত পূর্ণাঙ্গ sync (Ranking Page/PDF
    // Report সহ) ব্যাকগ্রাউন্ডে চালিয়ে সব authoritative করে ফেলা হবে
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
    const s = students[i]; // [name,district,phone,totalC,totalW,score,passFlag,subData]
    if (!String(s[2]||"").replace(/\D/g,'').endsWith(searchPhone)) continue;
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
    return {
      success:true, rank, name:s[0], district:s[1],
      score:parseFloat(s[5]).toFixed(2), result:s[6]===1?"PASS":"FAIL",
      totalCorrect:s[3], totalWrong:s[4],
      percentile:(((examinees-rank+1)/examinees)*100).toFixed(2),
      subjects, meta
    };
  }
  return null;
}

/**
 * DreamRise v68 — showStatisticsDialog() FINAL
 * ─────────────────────────────────────────────
 * পুরনো function টি সম্পূর্ণ মুছে এটি দিয়ে replace করুন।
 * বাকি সব v68 code হুবহু একই থাকবে।
 *
 * নতুন features:
 *  ✅ Color legend — কোন রঙ কী বোঝায় স্পষ্ট
 *  ✅ Band labels বারের বাইরে — ভেতরে ঢোকে না
 *  ✅ Fail/Pass/Borderline — ৩ রঙ পরিষ্কার অর্থ সহ
 *  ✅ Print / PDF বাটন → browser print dialog
 *  ✅ Subject chart — legend সহ
 *  ✅ @media print CSS — clean printable layout
 *  ✅ FIXED: এখন permanent ডেটা সোর্স থেকে পড়ে (cache miss এর সমস্যা নেই)
 */
function showStatisticsDialog() {
  try {
    const payload = getStudentDataPayload();
    if (!payload) { SpreadsheetApp.getUi().alert("আগে Sync করুন।"); return; }

    const { s: students, m: meta } = payload;
    const fullM      = parseFloat(meta.fullMarks) || 400;
    const passRate   = meta.examinees > 0 ? ((meta.passCount / meta.examinees) * 100).toFixed(1) : "0";
    const failRate   = (100 - parseFloat(passRate)).toFixed(1);

    // Score buckets (10 buckets, each 10% of fullM)
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

    // Pass threshold index in 10-bucket array
    const passThreshPct = parseFloat(meta.passPercent) || 45;
    const passBucketIdx = Math.floor(passThreshPct / 10);

    // Band data from buckets
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

    // Bar colors for distribution chart
    const barColorsArr = buckets.map((_, i) =>
      i < passBucketIdx ? '#f09595' : i === passBucketIdx ? '#EF9F27' : '#5DCAA5'
    );

    // Subject data
    const subjects   = meta.subjects || [];
    const colToNum   = c => { let n=0; c=String(c).toUpperCase().replace(/[^A-Z]/g,''); for(let i=0;i<c.length;i++) n=n*26+(c.charCodeAt(i)-64); return n; };
    const subNames   = subjects.map(s => s.name);
    const subPass    = subjects.map(s => parseFloat(s.pass) || 0);
    const subTotalQ  = subjects.map(s => {
      if (!s.range || !s.range.includes(':')) return 0;
      const parts = s.range.split(':');
      return colToNum(parts[1]) - colToNum(parts[0]) + 1;
    });

    // Build band rows HTML
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
  {box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;color:#1e293b;font-size:13px;padding:0}
  .topbar{background:#1e3a8a;padding:13px 18px;display:flex;align-items:center;gap:10px}
  .topbar img.logo{height:30px;width:auto;flex-shrink:0;border-radius:4px}
  .dr-badge{background:rgba(255,255,255,.18);color:#c7d7fb;font-size:10px;font-weight:600;padding:3px 9px;border-radius:5px;letter-spacing:.04em;flex-shrink:0}
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

// ===================== WEB APP ENTRY =====================
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('webapp')
    .setTitle('DreamRise Result Portal')
    .addMetaTag('viewport','width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ===================== PRINT FUNCTIONS =====================
/**
 * Print URL parameters ব্যাখ্যা:
 *   notes=false       → cell notes প্রিন্টে আসবে না (JSON block করে)
 *   sheetnames=false  → sheet tab name আসবে না
 *   printtitle=false  → spreadsheet title আসবে না
 *   pagenumbers=true  → page number আসবে
 *   fitw=true         → width-fit (সব column এক পাতায়)
 *   fith=false        → height-fit বন্ধ (multi-page কাজ করবে ✅)
 *
 *   ⚠️ fith=true দিলে সব row এক পাতায় চাপিয়ে ফেলে → multi-page ভাঙে
 *      তাই fith একদম নেই (default false)
 */
function _buildPrintUrl(sheet, portrait) {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const baseUrl = ss.getUrl().replace(/\/edit(\?.*)?$/, '');
  return baseUrl + '/export?format=pdf' +
    '&size=A4' +
    '&portrait=' + (portrait ? 'true' : 'false') +
    '&fitw=true' +   // width ফিট
    // fith ইচ্ছাকৃতভাবে নেই → multi-page কাজ করে
    '&gridlines=false' +
    '&notes=false' +       // ✅ JSON note বন্ধ
    '&sheetnames=false' +  // ✅ sheet নাম বন্ধ
    '&printtitle=false' +  // ✅ spreadsheet title বন্ধ
    '&pagenumbers=true' +  // ✅ page number
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
