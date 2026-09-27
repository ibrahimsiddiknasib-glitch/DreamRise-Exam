/**
 * ═══════════════════════════════════════════════════════════
 *   DreamRise Web App — v87.0
 *   Developer: Muhammad Ibrahim
 * ═══════════════════════════════════════════════════════════
 * Changelog (latest first, short notes):
 *  - Answer Key PDF: page number footer at the bottom of every page
 *    (JS-measured — Chrome print has no native page counter, so
 *    this is a best-effort estimate, not a true browser page count).
 *  - Answer Key PDF: blue border frame around every printed page
 *    (position:fixed — repeats natively per page in Chrome print),
 *    to make multiple exported PDFs look consistent when merged
 *    into one book later.
 *  - Answer Key PDF: "সঠিক উত্তর ও ব্যাখ্যা" title now drops
 *    "ও ব্যাখ্যা" automatically when not a single question has an
 *    explanation.
 *  - Answer Key PDF: "Developed by DreamRise & Muhammad Ibrahim"
 *    footer credit is now clickable (links to their Facebook pages).
 *  - fetchQuestionsFromForm() now auto-sets the exam title from the
 *    Form's own title, instead of requiring a separate manual entry
 *    in "Answer Key সেটিংস" every time.
 *  - Answer Key PDF: question-number badge can now be hidden/
 *    revealed with a toggle button (useful when the question
 *    text already has its own numbering).
 *  - Answer Key PDF: fixed logo (wrong file-name casing caused
 *    404s), fixed header/marking-line not repeating on every
 *    printed page (now uses a real <table><thead>), fixed
 *    negative-marking override getting stuck from a past exam,
 *    bigger print font sizes, 2x2 option grid, refreshed look.
 *  - Removed the separate online-link version of the Answer Key
 *    (?page=answerkey route + its menu item) — PDF/print dialog
 *    is now the only way to view it.
 *  - fetchQuestionsFromForm(): auto-fills correct answers +
 *    explanations from a Quiz-mode Form (manual entries always
 *    win); fixed a clearDataValidations() crash.
 *  - "Overall" mode's Additional Mark now supports its own pass
 *    mark too (previously only Subject-wise mode did).
 * ═══════════════════════════════════════════════════════════
 */

// ===================== BRANDING =====================
// DreamRise লোগো — এখানে একবার বদলালে সব জায়গায় আপডেট হয়ে যাবে।
// Light UI (Web App light mode) এর জন্য light-background লোগো
const DR_LOGO_LIGHT_URL = "https://github.com/ibrahimsiddiknasib-glitch/DreamRise/blob/main/Logo_For_light.png?raw=true";
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

// ফর্ম সাবমিট বার্স্ট debounce — এর মধ্যে যতগুলো সাবমিশন আসুক, শেষেরটার
// এই সময় পরে মাত্র একটাই পূর্ণাঙ্গ calculateAndRank() চলবে।
const DR_FORM_SUBMIT_DEBOUNCE_MS = 8 * 1000;

// শুধু প্রথম এত row-এর মধ্যে header (নাম/ফোন কলাম) খোঁজা হবে —
// পুরো শীট স্ক্যান করলে কোনো ছাত্রের উত্তরে ভুলবশত মিলে যাওয়ার ঝুঁকি থাকে।
const DR_HEADER_SEARCH_ROWS = 5;

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
      .addItem('❌ Fail/Weak Report (WhatsApp)',  'showFailReportDialog')
      .addItem('🔁 Reset System Settings',         'resetSettings')
      .addSeparator()
      .addItem('📘 ফর্ম থেকে প্রশ্ন আনুন (Answer Key)', 'fetchQuestionsFromForm')
      .addItem('📝 Answer Key সেটিংস (নাম/মার্ক)',       'setAnswerKeySettings')
      .addItem('🧮 Answer Key Row অটো বসাও (সোর্স শীটে)', 'autoGenerateAnswerKeyRow')
      .addItem('📄 Answer Key (দেখুন ও PDF নিন)',        'showAnswerKeyPdfDialog')
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
      'standardRange': config.standardRange || "",
      // ── Additional Mark (লিখিত/হোমওয়ার্ক) কনফিগারেশন ──
      // এই সেটিং প্রতি রানে আলাদাভাবে টিক/আনটিক করা যায়; ভুল হলে
      // Setup Wizard আবার খুলে এডিট করে রি-রান করা যাবে (getSavedConfig()
      // এখান থেকেই প্রি-ফিল করবে)। additionalOverall-এ এখন name/max-এর
      // পাশাপাশি "pass" (পাস মার্ক)-ও থাকে।
      'hasAdditionalMark':  (!!config.hasAdditionalMark).toString(),
      'additionalMode':     config.additionalMode || "",
      'additionalOverall':  JSON.stringify(config.additionalOverall || {}),
      'additionalSubjects': JSON.stringify(config.additionalSubjects || [])
    });
    // নতুন করে সেভ হলে পুরনো "savedAnsKeyName" ভ্যালিডেশন মার্কারও মুছে দাও,
    // যাতে নতুন Answer Key Row-কে ভুল করে "বদলে গেছে" মনে না করে।
    PropertiesService.getScriptProperties().deleteProperty('savedAnsKeyName');
    setupAutomationTriggers();
    calculateAndRank();
    return "Success!";
  } catch (e) {
    return "Error: " + e.message;
  }
}

/**
 * Setup Wizard খোলার সময় আগের সেভ করা কনফিগারেশন ফেরত দেয়, যাতে ফর্ম
 * প্রি-ফিল হয়ে থাকে এবং ভুল হলে এডিট করে আবার রান করা যায়।
 */
function getSavedConfig() {
  try {
    const props = PropertiesService.getScriptProperties().getProperties();
    if (!props.examName) return null; // প্রথমবার — কিছু সেভ নেই
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
  // পুরনো সব DreamRise trigger মুছো
  // 'onOpen' কে কখনো installable trigger হিসেবে রাখা উচিত নয় —
  // সেটা থাকলে time-based context-এ getUi() error দেয়।
  ScriptApp.getProjectTriggers().forEach(t => {
    if (['calculateAndRank','onEditThrottled','runDebouncedRank','onOpen','onFormSubmitThrottled'].includes(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  });
  // Form Submit → এখন সরাসরি calculateAndRank() নয়, বরং একটা ছোট
  // debounce (দেখুন onFormSubmitThrottled)। আগে প্রতিটা সাবমিশনে সরাসরি
  // ভারী calculateAndRank() চলত — বার্স্ট সাবমিশনে (যেমন exam শেষে সবাই
  // একসাথে সাবমিট করলে) একাধিক ইনস্ট্যান্স সমান্তরালে চলে একে অপরের
  // cache/backup write নষ্ট করে দিত। এখন এই race window ছোট + কাজও দ্রুত।
  ScriptApp.newTrigger('onFormSubmitThrottled').forSpreadsheet(ss).onFormSubmit().create();
  // Manual Edit → debounce
  ScriptApp.newTrigger('onEditThrottled').forSpreadsheet(ss).onEdit().create();
}

/**
 * FORM SUBMIT HANDLER (short debounce)
 * ---------------------------------------------------
 * প্রতিটা সাবমিশনে সরাসরি ভারী calculateAndRank() চালানোর বদলে, শুধু একটা
 * ছোট (৮ সেকেন্ড) timer রিসেট করে। বার্স্টে যতগুলোই সাবমিশন আসুক, শেষটার
 * কয়েক সেকেন্ড পর মাত্র একবারই পূর্ণাঙ্গ recalculation চলবে — এতে (ক)
 * সমান্তরাল calculateAndRank() রান হওয়ার সুযোগ প্রায় শূন্যে নেমে আসে, এবং
 * (খ) বারবার একই ভারী কাজ (Ranking Page + PDF Report rebuild + Logo fetch)
 * না হওয়ায় স্পিডও বাড়ে। কেউ সাবমিট করার সাথে সাথেই নিজের রেজাল্ট
 * সার্চ করলে সেটা searchStudent()-এর টার্গেটেড fallback
 * (computeSingleStudentAndMerge) থেকেই সাথে সাথে পাবে — কোনো বিলম্ব হবে না।
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
 * এটাই একমাত্র জায়গা যেখানে ফোন-নম্বর normalize হয় — সবসময় শেষ ১০ ডিজিট,
 * digit-only। dedupe (calculateAndRank), সার্চ (searchStudent/
 * computeSingleStudentAndMerge/findStudentInMinifiedCache) — সব জায়গায়
 * এই একই ফাংশন ব্যবহার হয়, যাতে একই স্টুডেন্ট ভিন্নভাবে ফোন লিখলেও
 * (01712345678 বনাম +8801712345678) সবসময় একই কী দিয়ে ম্যাচ হয়।
 */
function normalizePhone(raw) {
  return String(raw || "").trim().replace(/\D/g, '').slice(-10);
}

/**
 * Multi-answer check — Google Sheet formula-র লজিকের (F2:DA2 = F$7:DA$7)
 * সাথে হুবহু মিলিয়ে সরাসরি, সম্পূর্ণ টেক্সট তুলনা (trim + case-insensitive)।
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

/** শুধু প্রথম কয়েক row-এর মধ্যে header (নাম/জেলা/ফোন কলাম যুক্ত row) খোঁজে। */
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

  // এই পুরো ফাংশনটা LockService দিয়ে serialize করা — বার্স্ট ফর্ম-সাবমিশনে
  // একাধিক calculateAndRank() সমান্তরালে চলে একে অপরের cache/backup/
  // ScriptProperties write চাপা দেওয়া ঠেকাতে। একসাথে সর্বোচ্চ একটাই
  // instance চলবে; বাকিরা lock না পেয়ে নিরাপদে skip করবে (ডেটা হারায় না,
  // কারণ debounce mechanism আবার নতুন রান শিডিউল করে দেয়)।
  const lock = LockService.getScriptLock();
  let gotLock = false;
  try {
    gotLock = lock.tryLock(DR_LOCK_WAIT_MS);
    if (!gotLock) {
      console.log("calculateAndRank: আরেকটা sync ইতিমধ্যে চলছে — এই কলটা skip করা হলো (duplicate/race এড়াতে)।");
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

    // ── Additional Mark (লিখিত/হোমওয়ার্ক) কনফিগারেশন ──
    const hasAddl    = props.hasAdditionalMark === "true";
    const addlMode   = props.additionalMode || "";               // 'overall' | 'subjectwise'
    const addlOverall= JSON.parse(props.additionalOverall  || "{}"); // {name, max, pass}
    const addlSubjects = JSON.parse(props.additionalSubjects || "[]"); // [{name, max, pass}]
    const addlMaxTotal = !hasAddl ? 0 :
      (addlMode === 'overall'
        ? (parseFloat(addlOverall.max) || 0)
        : addlSubjects.reduce((sum, as) => sum + (parseFloat(as.max) || 0), 0));

    // Ranking Page-এ আগে ম্যানুয়ালি বসানো Additional Mark ভ্যালু থাকলে,
    // sheet রিবিল্ড হওয়ার আগেই সেগুলো পড়ে নাও — নয়তো রি-রান করলে
    // ম্যানুয়ালি বসানো নম্বরগুলো হারিয়ে যাবে।
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

    // header row শুধু প্রথম কয়েক row-এর মধ্যেই খোঁজা হয় — পুরো শীট স্ক্যান
    // করলে কোনো ছাত্রের উত্তরে ভুলবশত "name/full/নাম" শব্দ থাকলে ভুল
    // row-কে header ধরে নেওয়ার ঝুঁকি ছিল।
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

    // Answer Key row বদলে গেছে কিনা যাচাই — শীট ম্যানুয়ালি সর্ট/এডিট হলে
    // (সাধারণ একটা ভুল) ansKeyRow-এর ফিক্সড row-নাম্বারে এখন ভিন্ন কেউ চলে
    // আসতে পারে, যা silently পুরো স্কোরিং ভুল করে দেয়। এখন অন্তত টোস্ট দিয়ে
    // সতর্ক করা হয়, চুপচাপ ভুল হিসাব করে না।
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
      // normalizePhone() — dedupe আর সার্চ একই normalize ব্যবহার করে
      const rawDigits = String(row[wCol] || "").trim().replace(/\D/g, '');
      if (!name || rawDigits.length < 7) continue;
      const phone = normalizePhone(rawDigits);
      if (name === ansKeyName) continue;      // answer key row বাদ
      if (seen.has(phone)) continue;           // duplicate বাদ
      seen.add(phone);

      let totalC = 0, totalW = 0, totalScore = 0, subFail = false, subDataForTable = [];
      let weakSubjects = []; // যেসব সাবজেক্টে স্কোর পাস মার্কের নিচে — Fail Report-এ স্পেসিফিক উল্লেখের জন্য

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

      // ── Additional Mark যোগ করা (আগে ম্যানুয়ালি বসানো ভ্যালু থেকে) ──
      let addlScore = 0, addlSubFail = false, addlOverallVal = "", addlSubVals = null;
      let weakAddlSubjects = []; // Additional Mark-এ পাস মার্কের নিচে থাকা সাবজেক্টের (বা Overall বিষয়ের) নাম
      if (hasAddl) {
        const prev = prevAddl[phone];
        if (addlMode === 'overall') {
          if (prev && typeof prev.overall === 'number') {
            addlOverallVal = prev.overall;
            addlScore = prev.overall;
            // NEW: Overall Additional Mark-এরও এখন নিজস্ব পাস মার্ক চেক হয় —
            // Subject-wise মোডের মতোই, এই বিষয়ে পাস মার্কের নিচে থাকলে ছাত্র
            // সার্বিকভাবে ফেইল ধরা হবে (শুধু Grand Total percentage-এর উপর
            // নির্ভর করে না)।
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

    // Sort: pass > fail, then (grand)score desc, then wrong asc (tie-breaker)
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
      // ── Additional Mark মেটা — Ranking Page / PDF Report / পোর্টাল রেন্ডারে দরকার ──
      hasAdditionalMark: hasAddl,
      addlMode, addlOverall, addlSubjects
    };

    renderRankingPage(students, props, subjects, meta);
    renderPdfReport(students, props, subjects, meta);

    // Meta → ScriptProperties (permanent fallback, কখনো এক্সপায়ার হয় না)
    try {
      PropertiesService.getScriptProperties().setProperty('lastMeta', JSON.stringify(meta));
      PropertiesService.getScriptProperties().setProperty('lastSyncTime', Date.now().toString());
    } catch(x){}

    // ════════════════════════════════════════════════════════════════
    // PERMANENT DATA STORAGE
    // ════════════════════════════════════════════════════════════════
    try {
      // ── প্রতিটা স্টুডেন্টের Additional Mark ডেটা (থাকলে) মিনিফাইড অ্যারেতে যোগ ──
      // index 8 = Grand Total, index 9 = Additional Mark এর কাঁচা ডেটা।
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

      // 1) Fast cache (best-effort, ৬ ঘণ্টা)
      try { CacheService.getScriptCache().put('rankDataMin', payloadJson, 21600); } catch(x){}

      // 2) Permanent backup sheet (কখনো এক্সপায়ার হয় না — মূল উৎস)
      saveBackupSheet(payloadJson);

    } catch(x) { console.error("Data persist failed:", x); }

    // ── Fail/Weak Report (WhatsApp) এর জন্য লিস্ট সেভ করা ──
    // মেনু থেকে "❌ Fail Report" ক্লিক করলে এখান থেকেই লিস্ট দেখানো হবে,
    // তাই প্রতিবার সিঙ্ক করার সাথেই এটা আপডেট হয়ে যায়। দুই ভাগে রাখা হচ্ছে:
    // ১) failList — যারা Overall Fail করেছে (নির্দিষ্ট দুর্বল সাবজেক্ট/
    //    Additional Mark সহ)
    // ২) weakPassList — যারা Overall Pass করেছে কিন্তু কোনো নির্দিষ্ট
    //    সাবজেক্টে (বা Additional Mark-এ) পাস মার্কের নিচে আছে, যাতে
    //    ভালো রেজাল্ট করা স্টুডেন্টের নির্দিষ্ট দুর্বলতা নিয়েও সরাসরি কথা বলা যায়।
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
 * Ranking Page-এর হেডার লিস্ট বানায়। renderRankingPage() আর
 * readPreviousAdditionalMarks() — দুই জায়গাতেই এই ONE ফাংশন ব্যবহার হয়,
 * যাতে কলামের পজিশন সবসময় ১০০% সামঞ্জস্যপূর্ণ থাকে।
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
 * Ranking Page-এ আগে ম্যানুয়ালি বসানো Additional Mark (লিখিত/হোমওয়ার্ক)
 * ভ্যালুগুলো রি-রানের আগে পড়ে নেয়, যাতে sheet.clear() করার পরেও ডেটা
 * হারিয়ে না যায় — বরং নতুন Grand Total-এ যোগ হয়ে যায়।
 *
 * হেডারের বাংলা টেক্সট মিলিয়ে (headers.indexOf(name)) কলাম না খুঁজে,
 * buildRankingHeaders()-এর একই লজিক দিয়ে কলামের POSITION হিসাব করা হয় —
 * টেক্সট যাই থাকুক, পজিশন কখনো ভুল হবে না (যতক্ষণ সাবজেক্ট/মোড অপরিবর্তিত)।
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

    // Sanity check: পুরনো শীটে ওই একই পজিশনে সত্যিই "_FullPhone_" আছে কিনা —
    // থাকলে বুঝি স্ট্রাকচার (সাবজেক্ট/মোড) অপরিবর্তিত, তাই বাকি পজিশনও
    // বিশ্বাসযোগ্য। না থাকলে (যেমন আগের রানে Additional Mark অফ ছিল),
    // পুরনো ডেটা trust না করে খালি ম্যাপ ফেরত দাও।
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

  // Headers — buildRankingHeaders() ব্যবহার করা হচ্ছে যাতে readPreviousAdditionalMarks()-এর
  // সাথে কলাম পজিশন সবসময় ১০০% মিলে যায়।
  let headers = buildRankingHeaders(
    props.isSubjectWise === "true", subjects,
    meta.hasAdditionalMark, meta.addlMode, meta.addlOverall, meta.addlSubjects
  );
  const COL = headers.length;
  const resultColIdx = headers.indexOf("Result"); // 0-based, রঙ ঠিক করতে ব্যবহার হবে

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

  // ── Row 4: Headers ──
  sheet.getRange(4,1,1,COL).setValues([headers])
    .setBackground("#0f172a").setFontColor("white").setFontWeight("Bold")
    .setHorizontalAlignment("center").setFontFamily("Anek Bangla").setFontSize(11);

  // ── Rows 5+: Student data ──
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

  // "_FullPhone_" কলাম স্টুডেন্টদের দেখানোর দরকার নেই — শুধু রি-রানের সময়
  // Additional Mark ম্যাচ করার জন্য রাখা, তাই hide করে দেওয়া হচ্ছে।
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
  const COL = meta.hasAdditionalMark ? 9 : 8; // Additional Mark চালু থাকলে একটা Grand Total কলাম যোগ হয়

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

    // ── সাবজেক্ট-ভিত্তিক MCQ ব্রেকডাউন + Additional Mark ডিটেইল লাইন ──
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
        // NEW: এখন Overall Additional Mark-এর পাস মার্কও এখানে দেখানো হয়
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
    // normalizePhone() ব্যবহার — dedupe-এর সাথে অভিন্ন লজিক
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
 * lost-update race ফিক্স করা আছে: caller থেকে পাঠানো (lock নেওয়ার আগে
 * পড়া) payload-কে merge-এর ভিত্তি না ধরে, lock পাওয়ার পরে payload আবার
 * freshly পড়া হয়, তারপরই merge হয় — যাতে দুইজন প্রায় একই সময়ে সার্চ
 * করলে একজনের merge আরেকজনেরটা মুছে না ফেলে।
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

    // ── Additional Mark কনফিগারেশন (calculateAndRank()-এর সাথে সামঞ্জস্যপূর্ণ) ──
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

    // এই ফোন নম্বরের সারি খুঁজে বের করো (header + answer key বাদে)
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
    if (!matchRow) return null; // সোর্স শীটেও নেই

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

    // ── এই ফাংশনেও bulk sync-এর মতোই Additional Mark যোগ করা হচ্ছে —
    // NEW: Overall মোডেও এখানে পাস মার্ক চেক করা হয়, calculateAndRank()-এর
    // সাথে সামঞ্জস্যপূর্ণ রাখতে।
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

    // Lock নাও — এরপরই payload freshly পড়ো, merge করো, তারপর save করো।
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
    // normalizePhone() দিয়ে তুলনা — dedupe-এর সাথে অভিন্ন লজিক
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

    // ── Additional Mark (লিখিত/হোমওয়ার্ক) ব্রেকডাউন পোর্টালের জন্য বানানো ──
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
          // NEW: পাস মার্কও পোর্টালের জন্য পাঠানো হয়
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
 * ফেইল করা স্টুডেন্টদের নাম + WhatsApp নম্বর সহ একটা লিস্ট Dialog-এ দেখায়।
 * প্রতিটার পাশে একটা বাটন থাকে যেটাতে ক্লিক করলে সরাসরি সেই স্টুডেন্টের
 * WhatsApp নম্বরে একটা রেডি (কিন্তু এডিটেবল) মেসেজ সহ চ্যাট খুলে যায়,
 * যাতে সহজে যোগাযোগ করে জানা যায় কেন খারাপ করেছে আর কীভাবে ভালো করা যায়।
 * ডেটা আসে calculateAndRank()-এর সবশেষ রান থেকে ক্যাশ করা ফেইল-লিস্ট থেকে।
 */
function showFailReportDialog() {
  const ui = SpreadsheetApp.getUi();
  const cached = CacheService.getScriptCache().get('failedListMin');
  if (!cached) {
    ui.alert('⚠️ কোনো ডেটা পাওয়া যায়নি। আগে "🔄 Manual Sync Ranking" চালিয়ে নিন, তারপর আবার চেষ্টা করুন।');
    return;
  }

  const payload      = JSON.parse(cached);
  const failList     = payload.failList     || payload.list || []; // পুরনো cache ফরম্যাটের সাথেও ব্যাকওয়ার্ড-কম্প্যাটিবল
  const weakPassList = payload.weakPassList || [];

  if (failList.length === 0 && weakPassList.length === 0) {
    ui.alert('🎉 সবাই ভালো করেছে — কোনো ফেইল বা দুর্বল সাবজেক্ট পাওয়া যায়নি!');
    return;
  }

  /** একজন স্টুডেন্টের দুর্বল সাবজেক্টগুলো নিয়ে একটা ছোট বাংলা বাক্যাংশ বানায় */
  function weakSubjectPhrase(s) {
    const names = [...(s.weakSubjects || []), ...(s.weakAddlSubjects || [])];
    if (names.length === 0) return '';
    if (names.length === 1) return `বিশেষ করে "${names[0]}" বিষয়ে`;
    return `বিশেষ করে "${names.join('", "')}" — এই বিষয়গুলোতে`;
  }

  function buildRow(s, i, isFail) {
    const waNumber = "880" + s.phone; // বাংলাদেশ কান্ট্রি কোড + normalize করা ১০ ডিজিট নম্বর
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

// ===================== WEB APP ENTRY =====================
// ============================================================
// 📘 Answer Key & Explanation Publisher
// ------------------------------------------------------------
// এই অংশটা তোমার আলাদা Google Form-ভিত্তিক MCQ পরীক্ষা (যেখানে student
// name/number ম্যাটার করে না) থেকে সরাসরি প্রশ্ন+অপশন টেনে এনে, তুমি শুধু
// "Correct Answer" আর "Explanation" ভরে দিলেই একটা প্রফেশনাল Answer +
// Explanation ওয়েব পেজ আর PDF বানিয়ে দেয়। এটা মূল DreamRise
// exam/ranking সিস্টেম থেকে সম্পূর্ণ আলাদা ডেটা/Properties ব্যবহার করে
// (ak প্রিফিক্স দিয়ে), তাই একটা আরেকটার সাথে সংঘর্ষ করবে না।
//
// PDF জেনারেশন এখন আর Google Doc/Drive বা Sheet-cell রেন্ডার দিয়ে হয় না —
// showStatisticsDialog()-এর মতোই একটা HTML Dialog দেখানো হয়
// (showAnswerKeyPdfDialog, নিচে দেখুন), যেখানে window.print() দিয়ে PDF
// ডাউনলোড করা যায় আর সঠিক উত্তর CSS দিয়ে নির্ভরযোগ্যভাবে হাইলাইট হয়।
// ============================================================

const AK_SHEET_NAME = 'Answer Setup';

/** Form-এর এডিট/শেয়ার লিংক থেকে Form ID বের করে */
function extractFormId(url) {
  url = String(url).trim();
  if (/\/forms\/d\/e\//.test(url)) {
    throw new Error('এটা পাবলিক শেয়ার লিংক (viewform) মনে হচ্ছে। ফর্মটা Edit মোডে খুলে ঠিকানার বার থেকে লিংক দাও (…/forms/d/FORM_ID/edit)।');
  }
  const m = url.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) return url; // হয়তো সরাসরি আইডিই পেস্ট করেছে
  throw new Error('লিংক থেকে Form ID খুঁজে পাওয়া যায়নি। Edit মোডের লিংক (…/edit) দাও।');
}

/** এই ফর্মের একটা Section "Answer Setup"-এ আগে থেকে আছে কি না খুঁজে বের করে
 *  (FormId কলাম মিলিয়ে) — থাকলে {startRow, rowCount, sectionNum}, না
 *  থাকলে null রিটার্ন করে। */
function _akFindSectionRows(sheet, formId) {
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const vals = sheet.getRange(2, 9, last - 1, 2).getValues(); // I:FormId, J:Section
  let startIdx = -1, endIdx = -1, sectionNum = null;
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === String(formId) && String(formId) !== '') {
      if (startIdx === -1) { startIdx = i; sectionNum = vals[i][1]; }
      endIdx = i;
    }
  }
  if (startIdx === -1) return null;
  return { startRow: startIdx + 2, rowCount: endIdx - startIdx + 1, sectionNum: sectionNum };
}

/** পরের নতুন Sectionের নম্বর — বিদ্যমান সব Sectionের সর্বোচ্চ নম্বরের পরেরটা। */
function _akNextSectionNum(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return 1;
  const vals = sheet.getRange(2, 10, last - 1, 1).getValues(); // J: Section
  let max = 0;
  vals.forEach(r => { const n = Number(r[0]); if (!isNaN(n) && n > max) max = n; });
  return max + 1;
}

/** "🚀 DreamRise System" মেনু থেকে চালু হয় — একটা ছোট HTML ডায়ালগ খোলে
 *  যেখানে একটা টেক্সটএরিয়ায় একটা বা একাধিক Google Form-এর Edit লিংক
 *  (এক লাইনে একটা) পেস্ট করে একবারে সব Fetch করা যায়। একই ফর্ম থেকে
 *  পরেও আবার এখান থেকে লিংক যোগ করলে শুধু সেই ফর্মের Sectionটাই আপডেট হয়,
 *  বাকি ফর্মের প্রশ্ন অক্ষত থাকে (importAnswerKeyForms() দেখো)। */
function fetchQuestionsFromForm() {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { box-sizing:border-box; }
  body{ font-family:'Segoe UI',Arial,sans-serif; margin:0; padding:16px; color:#0f172a; background:#f8fafc; }
  p{ font-size:12.5px; color:#475569; line-height:1.6; margin:0 0 10px; }
  textarea{
    width:100%; height:150px; font-family:monospace; font-size:12.5px; padding:10px;
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
  #status{ margin-top:12px; font-size:12.5px; white-space:pre-wrap; line-height:1.6; }
</style></head>
<body>
  <p>একটা বা একাধিক Google Form-এর <b>Edit লিংক</b> দাও (…/forms/d/FORM_ID/edit) — একাধিক হলে <b>এক লাইনে একটা</b> করে। প্রতিটা ফর্মের নিজের টাইটেলই তার পরীক্ষার নাম হিসেবে বসবে। আগে থেকে আনা কোনো ফর্মের লিংক আবার দিলে শুধু সেই ফর্মেরটাই আপডেট হবে, বাকিগুলো অক্ষত থাকবে — তাই পরেও এসে নতুন ফর্মের লিংক যোগ করা যাবে।</p>
  <textarea id="links" placeholder="https://docs.google.com/forms/d/FORM_ID_1/edit
https://docs.google.com/forms/d/FORM_ID_2/edit"></textarea>
  <div class="row">
    <button id="close" onclick="google.script.host.close()">বন্ধ করো</button>
    <button id="go" onclick="run()">আনুন</button>
  </div>
  <div id="status"></div>
  <script>
    function run(){
      var links = document.getElementById('links').value.trim();
      if (!links) return;
      document.getElementById('go').disabled = true;
      document.getElementById('status').textContent = '⏳ আনা হচ্ছে...';
      google.script.run
        .withSuccessHandler(function(msg){
          document.getElementById('status').textContent = msg;
          document.getElementById('go').disabled = false;
        })
        .withFailureHandler(function(err){
          document.getElementById('status').textContent = '⚠️ ' + (err.message || err);
          document.getElementById('go').disabled = false;
        })
        .importAnswerKeyForms(links);
    }
  </script>
</body></html>`;
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(480).setHeight(400),
    '📘 ফর্ম থেকে প্রশ্ন আনুন'
  );
}

/** fetchQuestionsFromForm()-এর ডায়ালগ থেকে google.script.run দিয়ে কল হয়।
 *  একাধিক লিংক (এক লাইনে একটা) নিয়ে প্রতিটার জন্য: ফর্মের সব Multiple
 *  Choice প্রশ্ন + অপশন টেনে "Answer Setup" শীটে বসায় — নিজের একটা
 *  Section হিসেবে (ডিভাইডার রো + প্রশ্নগুলো), Q.No "Section.প্রশ্ন" ফরম্যাটে
 *  (যেমন ২.৩)। আগে থেকে এই ফর্মের Section থাকলে সেই একই জায়গায় রিবিল্ড
 *  হয় (আগে ভরা Correct/Explanation সংরক্ষিত থেকে যায়), না থাকলে নতুন
 *  Section নম্বর নিয়ে একদম শেষে যোগ হয়। রিটার্ন ভ্যালু ডায়ালগে দেখানো
 *  স্ট্যাটাস মেসেজ (প্রতিটা ফর্মের নাম + কতটা প্রশ্ন এলো/আপডেট হলো)। */
function importAnswerKeyForms(linksText) {
  const links = String(linksText || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (links.length === 0) return 'কোনো লিংক দেওয়া হয়নি।';

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
    // FormId/Section/ExamTitle — মানুষের দেখার দরকার নেই, শুধু কোড ব্যবহার করে
    try { sheet.hideColumns(9, 3); } catch (x) {}
    // FIXED: clearDataValidations() একটি Range-level মেথড, Sheet-level নয়
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
  }

  const LETTERS = ['A', 'B', 'C', 'D'];
  const results = [];

  links.forEach(link => {
    let formId;
    try {
      formId = extractFormId(link);
    } catch (e) {
      results.push(`⚠️ "${link}" — ${e.message}`);
      return;
    }

    let form;
    try {
      form = FormApp.openById(formId);
    } catch (e) {
      results.push(`⚠️ "${link}" — ফর্মটা খুলতে পারিনি (আইডি ভুল বা তুমি owner/editor না)।`);
      return;
    }

    const items = form.getItems(FormApp.ItemType.MULTIPLE_CHOICE);
    if (items.length === 0) {
      results.push(`⚠️ "${form.getTitle()}" — কোনো Multiple choice প্রশ্ন পাওয়া যায়নি।`);
      return;
    }

    let isQuiz = false;
    try { isQuiz = form.isQuiz(); } catch (x) {}
    const examTitle = String(form.getTitle() || 'পরীক্ষা').trim();

    // আগে থেকেই এই ফর্মের Section থাকলে তার Correct/Explanation সংরক্ষণ
    // করে রেখে সেই একই পজিশনে রিবিল্ড করা হয় (বাকি Sectionগুলোর ক্রম/ডেটা
    // অক্ষত থাকে); না থাকলে নতুন Section নম্বর নিয়ে একদম শেষে যোগ হয়।
    const existing = _akFindSectionRows(sheet, formId);
    const preserved = {};
    let sectionNum, insertAt;
    if (existing) {
      sectionNum = existing.sectionNum;
      sheet.getRange(existing.startRow, 1, existing.rowCount, 8).getValues().forEach(r => {
        const q = String(r[1]).trim();
        if (q) preserved[q] = { correct: r[6], explanation: r[7] };
      });
      sheet.deleteRows(existing.startRow, existing.rowCount);
      insertAt = existing.startRow;
    } else {
      sectionNum = _akNextSectionNum(sheet);
      insertAt = sheet.getLastRow() + 1;
    }

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

      const finalCorrect = old.correct || autoCorrect || '';
      const finalExplain = old.explanation || autoExplain || '';
      if (!old.correct && autoCorrect) autoCorrectCount++;
      if (!old.explanation && autoExplain) autoExplainCount++;

      // Q.No "Section.প্রশ্ন" ফরম্যাটে টেক্সট হিসেবে বানানো হচ্ছে (নিচে
      // setNumberFormat('@') দিয়ে কলামটা Plain text করে রাখা হয়েছে,
      // নয়তো Google Sheets এটাকে সংখ্যা ভেবে "2.100"-কে "2.1" বানিয়ে
      // দশমিকের পরের শূন্য কেটে ফেলত)।
      return [`${sectionNum}.${i + 1}`, qText, choices[0], choices[1], choices[2], choices[3],
              finalCorrect, finalExplain, formId, sectionNum, examTitle];
    });

    const totalRows = 1 + dataRows.length;
    sheet.insertRowsBefore(insertAt, totalRows);

    const dividerRow = insertAt;
    sheet.getRange(dividerRow, 1, 1, 8).merge()
      .setValue(`📘 Section ${sectionNum}: ${examTitle}`)
      .setBackground('#1d4ed8').setFontColor('white').setFontWeight('bold')
      .setFontSize(12).setHorizontalAlignment('center');
    sheet.getRange(dividerRow, 9, 1, 3).setValues([[formId, sectionNum, examTitle]]);

    // FIX: Q.No কলাম (A) Plain-text ফরম্যাট করে রাখা হচ্ছে — setValues()-এর
    // ঠিক আগে, যাতে "2.100"-এর মতো টেক্সট Sheets নিজে থেকে সংখ্যা ভেবে
    // "2.1"-এ রূপান্তর (দশমিকের শূন্য বাদ) না করে দেয়।
    sheet.getRange(dividerRow + 1, 1, dataRows.length, 1).setNumberFormat('@');
    sheet.getRange(dividerRow + 1, 1, dataRows.length, 11).setValues(dataRows);

    const rule = SpreadsheetApp.newDataValidation().requireValueInList(['A', 'B', 'C', 'D'], true).build();
    sheet.getRange(dividerRow + 1, 7, dataRows.length, 1).setDataValidation(rule);
    sheet.getRange(dividerRow + 1, 1, dataRows.length, 8).setWrap(true).setVerticalAlignment('top');

    let note = '';
    if (autoCorrectCount > 0 || autoExplainCount > 0) note = ` (অটো-ফিল: উত্তর ${autoCorrectCount}, ব্যাখ্যা ${autoExplainCount})`;
    else if (!isQuiz) note = ' (অটো-ফিল হয়নি — হাতে Correct Answer/Explanation ভরো)';
    results.push(`✅ ${examTitle} — ${dataRows.length}টা প্রশ্ন ${existing ? 'আপডেট হয়েছে' : 'যোগ হয়েছে (Section ' + sectionNum + ')'}${note}`);
  });

  return results.join('\n') + '\n\nএখন "Answer Setup" শীটে গিয়ে যেখানে দরকার Correct Answer/Explanation ঠিক করো, তারপর মেনু থেকে PDF দেখো/ডাউনলোড করো।';
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

  // মার্ক (পজিটিভ/নেগেটিভ) এখানে আলাদাভাবে সেট করার সুবিধা বাদ দেওয়া
  // হয়েছে — Answer Key সবসময় "⚙️ Full System Setup"-এ সেভ করা
  // posMark/negMark থেকেই নেবে, যাতে প্রতিটা পরীক্ষায় সঠিক, আপ-টু-ডেট
  // মার্কিং স্কিম দেখায়। মার্ক বদলাতে হলে মূল Setup Wizard থেকেই বদলাও।
  ui.alert('✅ সেভ হয়েছে! (পরের বার এই ফর্ম থেকে "ফর্ম থেকে প্রশ্ন আনুন" চালালে ফর্মের টাইটেলই আবার বসে যাবে — এই নামটা স্থায়ী নয়।)');
}

/** "Answer Setup" শীট পড়ে Section-ভিত্তিক (প্রতিটা আলাদা ফর্ম/পরীক্ষার
 *  নিজের গ্রুপ) স্ট্রাকচার্ড ডেটা রিটার্ন করে — { sections: [...] }।
 *  পুরনো (মাল্টি-ফর্ম সাপোর্টের আগের) সিঙ্গেল-Section শীটেও কাজ করে —
 *  Section/ExamTitle কলাম ফাঁকা থাকলে সবকিছু একটাই ধরে নিয়ে (Section ১,
 *  পুরনো akExamTitle প্রপার্টি থেকে নাম) গ্রুপ করে দেয়।
 *
 *  FIX: প্রতিটা প্রশ্নের q.qno এখানে সবসময় রানটাইমে "Section.পজিশন" থেকে
 *  নতুন করে বানানো হয় (শীটে সেভ থাকা কাঁচা মান কখনোই সরাসরি ব্যবহার হয়
 *  না) — কারণ Google Sheets মাঝে মাঝে "2.100"-এর মতো টেক্সটকে সংখ্যা
 *  ভেবে "2.1" বানিয়ে দশমিকের পরের শূন্য কেটে ফেলে; পজিশন থেকে বানালে এই
 *  বাগ আর প্রভাব ফেলতে পারে না, আর পুরনো (প্রিফিক্স-বিহীন, প্লেইন
 *  "1,2,3...") প্রথম Sectionও এখন বাকিগুলোর মতো "1.1, 1.2..." ফরম্যাটে
 *  ধারাবাহিকভাবে দেখাবে। */
function getAnswerData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AK_SHEET_NAME);
  if (!sheet) return { sections: [] };
  const last = sheet.getLastRow();
  if (last < 2) return { sections: [] };
  const letterToIndex = { A: 0, B: 1, C: 2, D: 3 };
  const rows = sheet.getRange(2, 1, last - 1, 11).getValues()
    .filter(r => String(r[1]).trim() !== ''); // ডিভাইডার রো বাদ (Question ফাঁকা)

  const fallbackTitle = PropertiesService.getScriptProperties().getProperty('akExamTitle') || 'পরীক্ষা';
  const bySection = {};
  const order = [];
  rows.forEach(r => {
    const sectionNum = r[9] || 1;
    const examTitle  = String(r[10] || '').trim() || fallbackTitle;
    if (!bySection[sectionNum]) {
      bySection[sectionNum] = { sectionNum: sectionNum, examTitle: examTitle, formId: String(r[8] || ''), questions: [] };
      order.push(sectionNum);
    }
    bySection[sectionNum].questions.push({
      qno: r[0],
      question: String(r[1]).trim(),
      options: [r[2], r[3], r[4], r[5]].map(o => String(o || '').trim()),
      correctIndex: letterToIndex[String(r[6]).trim().toUpperCase()] !== undefined
        ? letterToIndex[String(r[6]).trim().toUpperCase()] : -1,
      explanation: String(r[7] || '').trim()
    });
  });

  order.sort((a, b) => Number(a) - Number(b));
  const sections = order.map(n => bySection[n]);

  // FIX: qno সবসময় পজিশন থেকে পুনর্গঠন — শীটের কাঁচা মান (Sheets-এর
  // auto-number রূপান্তরে ভাঙতে পারে) কখনোই সরাসরি দেখানো হয় না।
  sections.forEach(sec => {
    sec.questions.forEach((q, i) => { q.qno = `${sec.sectionNum}.${i + 1}`; });
  });

  return { sections: sections };
}

/**
 * "Answer Setup"-এ ঠিক করা সঠিক উত্তরগুলো (Correct Answer A/B/C/D) থেকে
 * মূল রেসপন্স শীটে (প্রথম শীট — যেটা calculateAndRank() স্কোরিং-এর জন্য
 * ব্যবহার করে) একটা "Answer Key" রো অটো-জেনারেট করে একদম শেষে বসিয়ে দেয়।
 * আগে এই কাজটা ম্যানুয়ালি — প্রতিটা প্রশ্নের সঠিক অপশনের হুবহু টেক্সট
 * রেসপন্স শীটে গিয়ে প্রতিটা কলামে বসাতে হতো — এখন একবার Answer Setup-এ
 * সঠিক উত্তর ঠিক করলেই এই ফাংশন দিয়ে অটো বসানো যায়।
 *
 * কীভাবে মেলায়: Google Form-ভিত্তিক রেসপন্স শীটে প্রতিটা কলামের হেডার
 * টেক্সট = ফর্মের প্রশ্নের টাইটেল। তাই Answer Setup-এর প্রশ্নের টেক্সট আর
 * রেসপন্স শীটের হেডার রো হুবহু (ট্রিম করে) মিলিয়ে কলাম পজিশন বের করা হয় —
 * তাই এই দুটো একই Google Form থেকে আসা দরকার।
 */
function autoGenerateAnswerKeyRow() {
  const ui = SpreadsheetApp.getUi();
  const bank = getAnswerData();
  if (bank.sections.length === 0) {
    ui.alert('⚠️ কোনো প্রশ্ন পাওয়া যায়নি — আগে "ফর্ম থেকে প্রশ্ন আনুন" চালাও এবং প্রতিটা প্রশ্নের সঠিক উত্তর ঠিক করো।');
    return;
  }

  // একাধিক ফর্মের প্রশ্ন ব্যাংক জমা থাকতে পারে, কিন্তু মূল রেসপন্স শীট
  // সবসময় একটাই নির্দিষ্ট পরীক্ষার — তাই একাধিক Section থাকলে কোনটার জন্য
  // Answer Key Row বসাতে হবে জিজ্ঞেস করা হয়; একটাই থাকলে (সবচেয়ে সাধারণ
  // ক্ষেত্র) সরাসরি সেটাই ব্যবহার হয়, কিছু জিজ্ঞেস করা লাগে না।
  let section;
  if (bank.sections.length === 1) {
    section = bank.sections[0];
  } else {
    const list = bank.sections.map((s, i) => `${i + 1}. ${s.examTitle} (${s.questions.length}টা প্রশ্ন)`).join('\n');
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
    ui.alert(`⚠️ "${section.examTitle}"-এর ${missing.length}টা প্রশ্নে এখনো সঠিক উত্তর সেট করা নেই (Q.No: ${qnos}) — "Answer Setup" শীটে গিয়ে সব প্রশ্নে সঠিক উত্তর ঠিক করে আবার চেষ্টা করো।`);
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

  // প্রশ্নের টেক্সট → কলাম index ম্যাপ (হেডার টেক্সট ট্রিম করে মিলিয়ে)
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

  // নাম/ফোন কলাম বসানো — যাতে calculateAndRank()-এর হেডার-ডিটেকশন এই
  // রোটাকে সাধারণ স্টুডেন্ট রো হিসেবে ভুল না করে (ফোন নম্বর অন্তত ৭ ডিজিট
  // না হলে dedupe/scoring লজিক রো-টা বাদ দিয়ে দেয়)।
  let nCol = -1, wCol = -1;
  headerRow.forEach((h, j) => {
    const head = String(h).toLowerCase();
    if (nCol === -1 && /নাম|name|student/i.test(head)) nCol = j;
    if (wCol === -1 && /whatsapp|phone|মোবাইল|contact/i.test(head)) wCol = j;
  });
  if (nCol !== -1) newRow[nCol] = section.examTitle;
  if (wCol !== -1) newRow[wCol] = '0000000000';

  const insertRowNum = rawData.length + 1; // একদম শেষ রো
  sourceSheet.getRange(insertRowNum, 1, 1, lastCol).setValues([newRow]);

  let msg = `✅ "${section.examTitle}"-এর ${matched}টা প্রশ্নের সঠিক উত্তর বসানো হয়েছে সোর্স শীটের ${insertRowNum} নম্বর রো-তে।`;
  if (unmatched.length > 0) {
    const qnos = unmatched.slice(0, 15).join(', ') + (unmatched.length > 15 ? '...' : '');
    msg += `\n\n⚠️ ${unmatched.length}টা প্রশ্নের কলাম মেলেনি (Q.No: ${qnos}) — সম্ভবত প্রশ্নের টেক্সট আর রেসপন্স শীটের কলাম হেডার হুবহু মিলছে না (দুটো ভিন্ন ফর্ম থেকে হলে এমন হতে পারে); ওই ঘরগুলো ফাঁকা রাখা হয়েছে, ম্যানুয়ালি ঠিক করে নাও।`;
  }
  msg += `\n\nএখন "⚙️ Full System Setup" খুলে "Answer Key Row" নম্বর হিসেবে ${insertRowNum} বসিয়ে সেভ করলেই এই রোটা স্কোরিং-এর Answer Key হিসেবে ব্যবহৃত হবে।`;
  ui.alert(msg);
}

/** HTML-এ বসানোর আগে বেসিক escape — প্রশ্ন/অপশনে "&","<",">","\"" থাকলে
 *  markup ভেঙে না যায় সেজন্য। */
function _akEscapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * <img src="external-url"> মাঝে মাঝে Dialog খোলার সময় বা প্রিন্ট/PDF
 * এক্সপোর্টের সময় লোড হয় না — নেটওয়ার্ক টাইমিং বা হটলিংক রেসট্রিকশনের
 * কারণে (বিশেষ করে GitHub-এর raw লিংকে), যার ফলে লোগো একেবারেই দেখা
 * যায় না। এটা এড়াতে লোগো ছবিটা সার্ভার-সাইডে ফেচ করে base64 data URI
 * হিসেবে HTML-এর ভেতরেই এমবেড করে দেওয়া হয় — এরপর আর কোনো বাইরের
 * রিকোয়েস্টের উপর নির্ভর করতে হয় না, তাই Dialog-এ এবং প্রিন্ট/PDF-এ
 * সবসময় নির্ভরযোগ্যভাবে দেখা যাবে। ফলাফল ৬ ঘণ্টার জন্য cache করা থাকে
 * (বারবার fetch এড়াতে); fetch ব্যর্থ হলে মূল URL-ই fallback হিসেবে
 * ফেরত দেওয়া হয় (তখনো অন্তত চেষ্টা করে, একেবারে ভাঙা না দেখিয়ে)।
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
    console.error('_akLogoDataUri failed:', x);
    return url;
  }
}

/**
 * Answer Key-এর মার্ক আলাদাভাবে সেট করার (akPosMark/akNegMark) সুবিধাটা
 * বাদ দেওয়া হয়েছে — এটাই বাগের আসল কারণ ছিল: একবার আলাদা করে সেট করলে
 * সেই মান স্ক্রিপ্ট প্রপার্টিতে চিরস্থায়ীভাবে রয়ে যেত এবং পরবর্তী প্রতিটা
 * পরীক্ষায়, মূল Setup Wizard-এ নতুন নেগেটিভ মার্ক দিলেও, সেই পুরনো
 * override-ই প্রাধান্য পেয়ে ভুল তথ্য (যেমন "নেগেটিভ মার্কিং নেই") দেখাতো।
 * এখন থেকে সবসময় সরাসরি মূল Setup Wizard-এ সেভ করা posMark/negMark-ই
 * ব্যবহার হয়, তাই Answer Key সবসময় বর্তমান পরীক্ষার আসল মার্কিং স্কিম
 * দেখাবে।
 */
function _akSetupMark(key, defaultVal) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  return (v !== null && v !== '' && !isNaN(parseFloat(v))) ? parseFloat(v) : defaultVal;
}

/**
 * "Answer Setup"-এর সব Sectionের (একাধিক ফর্ম/পরীক্ষা হতে পারে) প্রশ্ন
 * একসাথে একটাই "বই" আকারে (continuous page numbering, প্রতিটা Section
 * নতুন পেজ থেকে শুরু) HTML Dialog-এ দেখায়। একটাই Section থাকলে আগের
 * মতোই একক-পরীক্ষার লে-আউট দেখায়; একাধিক থাকলে প্রতিটা Sectionের আগে
 * একটা "Section ডিভাইডার" কার্ড বসে (নিজের পরীক্ষার নাম + প্রশ্ন সংখ্যা
 * সহ), যেটা সবসময় নতুন পেজ থেকে শুরু হতে বাধ্য করা হয়।
 *
 * FIX: getAnswerData() এখন { sections: [...] } রিটার্ন করে (আগে যা
 * সরাসরি অ্যারে ছিল) — তাই এই ফাংশনটাও সেই অনুযায়ী আপডেট করা হয়েছে
 * (আগে data.filter/.map সরাসরি অবজেক্টের উপর কল হচ্ছিল বলেই
 * "data.filter is not a function" এররটা আসছিল)।
 */
function showAnswerKeyPdfDialog() {
  const ui = SpreadsheetApp.getUi();
  const bank = getAnswerData();
  if (!bank.sections || bank.sections.length === 0) {
    ui.alert('⚠️ কোনো প্রশ্ন পাওয়া যায়নি — আগে "ফর্ম থেকে প্রশ্ন আনুন" চালাও, তারপর প্রতিটা প্রশ্নের সঠিক উত্তর নির্বাচন করো।');
    return;
  }

  const props      = PropertiesService.getScriptProperties();
  // পুরনো, এখন-অব্যবহৃত override মুছে দেওয়া হচ্ছে যাতে ভুলবশত কোথাও
  // রয়ে যাওয়া স্টেল ভ্যালু ভবিষ্যতেও বিভ্রান্তি না ছড়ায়
  props.deleteProperty('akPosMark');
  props.deleteProperty('akNegMark');
  const posMark    = _akSetupMark('posMark', 1);
  const negMark    = _akSetupMark('negMark', 0);
  const labels     = ['ক', 'খ', 'গ', 'ঘ'];
  const logoSrc    = _akLogoDataUri(DR_LOGO_LIGHT_URL);

  const sections     = bank.sections;
  const isBook       = sections.length > 1;
  const allQuestions = sections.reduce((acc, s) => acc.concat(s.questions), []);
  const totalQ       = allQuestions.length;
  const noneCorrect  = allQuestions.filter(q => q.correctIndex === -1).length;
  const withExplain  = allQuestions.filter(q => q.explanation).length;

  // একটাই Section থাকলে সেই Sectionের নিজের পরীক্ষার নামই বইয়ের টাইটেল;
  // একাধিক থাকলে একটা কম্বাইন্ড টাইটেল দেখানো হয়, প্রতিটা Sectionের নাম
  // তার নিজের ডিভাইডার কার্ডেই দেখা যাবে।
  const examTitle = isBook
    ? (props.getProperty('akExamTitle') || 'উত্তরমালা সংকলন')
    : (sections[0].examTitle || props.getProperty('akExamTitle') || 'পরীক্ষা');
  // একটাও প্রশ্নে ব্যাখ্যা না থাকলে টাইটেল থেকে "ও ব্যাখ্যা" শব্দটা বাদ
  // দেওয়া হয় — খামোখা "ব্যাখ্যা" শব্দ থাকলে বিভ্রান্তিকর লাগে যদি আদতে
  // কোনো ব্যাখ্যাই না থাকে
  const titleSuffix = withExplain > 0 ? 'সঠিক উত্তর ও ব্যাখ্যা' : 'সঠিক উত্তর';

  const infoLine = [
    `সঠিক উত্তর: +${posMark}`,
    negMark > 0 ? `ভুল উত্তর: −${negMark}` : 'নেগেটিভ মার্কিং নেই',
    isBook ? `মোট পরীক্ষা: ${sections.length}  |  মোট প্রশ্ন: ${totalQ}` : `মোট প্রশ্ন: ${totalQ}`
  ].join('  |  ');

  const cardHtmlFor = (q) => {
    const optsHtml = q.options.map((opt, i) => {
      if (!opt) return '';
      const isCorrect = i === q.correctIndex;
      return `<div class="opt${isCorrect ? ' correct' : ''}">${labels[i]}) ${_akEscapeHtml(opt)}${isCorrect ? ' ✅' : ''}</div>`;
    }).join('');
    const explainHtml = q.explanation
      ? `<div class="explain"><b>ব্যাখ্যা:</b> ${_akEscapeHtml(q.explanation)}</div>`
      : '';
    return `
      <div class="card">
        <div class="qhead"><span class="qno">প্রশ্ন <span class="qnum">${q.qno}</span></span><span class="qtext">${_akEscapeHtml(q.question)}</span></div>
        <div class="opts">${optsHtml}</div>
        ${explainHtml}
      </div>`;
  };

  // মাল্টি-Section "বই": প্রতিটা Sectionের আগে একটা ডিভাইডার — সবসময় নতুন
  // পেজ থেকে শুরু হয় (paginate()-এ .section-divider দেখলেই ফোর্স-ব্রেক)।
  // সিঙ্গেল-এক্সাম মোডে ডিভাইডার দেখানো হয় না (আগের মতোই লে-আউট)।
  const cardsHtml = sections.map(sec => {
    const dividerHtml = isBook
      ? `<div class="section-divider"> Section ${sec.sectionNum}: ${_akEscapeHtml(sec.examTitle)} — ${sec.questions.length}টা প্রশ্ন</div>`
      : '';
    return dividerHtml + sec.questions.map(cardHtmlFor).join('');
  }).join('');

  const warnHtml = noneCorrect > 0
    ? `<div class="warn">⚠️ ${noneCorrect}টা প্রশ্নে এখনো সঠিক উত্তর সেট করা নেই — "Answer Setup" শীটে গিয়ে সেগুলো পূরণ করে আবার এই ডায়ালগটা খোলো।</div>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Anek+Bangla:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size:A4; margin:14mm 12mm; }
  * , body { box-sizing:border-box; margin:0; padding:0; font-family:'Anek Bangla',sans-serif; }
  html, body{ background:#eef2f7; color:#0f172a; font-size:15px; }

  .actions{
    display:flex; justify-content:flex-end; gap:8px; padding:12px 16px 0; background:#eef2f7;
  }
  .pdf-btn{
    display:inline-flex; align-items:center; gap:6px; background:#0f1f3d; color:#fff;
    border:1px solid #0f1f3d; padding:8px 16px; border-radius:8px; font-size:12.5px;
    font-weight:600; cursor:pointer; font-family:inherit;
  }
  .pdf-btn:hover{ background:#1e2f52; }
  .pdf-btn.secondary{ background:#fff; color:#0f1f3d; border:1px solid #cbd5e1; }
  .pdf-btn.secondary:hover{ background:#f1f5f9; }

  /* ── প্রশ্ন-নম্বর হাইড/রিভিল টগল — শুধু নম্বরটাই (qnum) লুকায়, "প্রশ্ন"
     লেবেলটা ব্যাজ আকারে সবসময় থেকে যায় (ডিজাইন যেমন ছিল সেটাই বজায়
     থাকে); body-তে .hide-qno ক্লাস পড়লে টগল হয়, প্রিন্টেও একই আচরণ। ── */
  body.hide-qno .qnum{ display:none; }

  .warn{
    background:#fffbeb; border:1px solid #fde68a; color:#92400e; font-size:12.5px;
    padding:8px 12px; margin:10px 16px 0; border-radius:8px;
  }

  /* ── আসল <table>/<thead> দিয়ে হেডার রিপিট — আগে div + table-header-group
     ব্যবহার হতো, কিন্তু ভেতরে display:flex (topbar) থাকায় Chrome-এর একটা
     পরিচিত বাগে প্রিন্টের সময় হেডার রিপিট না হয়ে একবারই দেখাচ্ছিল। এখন
     সরাসরি <table><thead> — যা <thead>-এর ডিফল্ট আচরণেই প্রতিটা প্রিন্ট
     পেজে নির্ভরযোগ্যভাবে রিপিট হয় — আর হেডারের ভেতরের লে-আউটও flex বাদ
     দিয়ে সাব-টেবিল দিয়ে করা হয়েছে, যাতে থিড-এর ভেতরের কনটেন্ট রিপিট সব
     ব্রাউজারে/PDF এক্সপোর্টে সমানভাবে কাজ করে।
     max-width A4-এর প্রিন্টেবল প্রস্থের (210mm − 12mm×2 মার্জিন ≈ 703px)
     সমান রাখা হয়েছে, যাতে স্ক্রিনে দেখতে পাওয়া লে-আউটই হুবহু প্রিন্ট/PDF-এ
     যায় — এটাই নিচের পেজ-নম্বর হিসাবের ভিত্তি। ── */
  table.sheet{ width:100%; max-width:703px; margin:0 auto; border-collapse:collapse; }
  table.sheet > thead > tr > th{ padding:0; text-align:left; font-weight:normal; }
  table.sheet > tbody > tr > td{ padding:0; vertical-align:top; }

  table.topbar{ width:100%; border-collapse:collapse; background:#fff; border-bottom:3px solid #2563eb; }
  table.topbar td{ padding:14px 16px; vertical-align:middle; }
  table.topbar .logocell{ width:1%; white-space:nowrap; }
  table.topbar img.logo{ height:48px; width:auto; display:block; }
  table.topbar .dividercell{ width:1px; background:#e2e8f0; padding:0; }
  table.topbar .infocell{ text-align:left; padding-left:16px; }
  .ttitle{ color:#0f1f3d; font-weight:800; font-size:18px; line-height:1.4; letter-spacing:.2px; }
  .tsub{ color:#2563eb; font-size:14px; margin-top:6px; font-weight:700; line-height:1.5; }

  .body{ padding:16px 16px 24px; }
  .card{
    background:#fff; border:1px solid #e2e8f0; border-left:4px solid #2563eb; border-radius:8px;
    padding:12px 14px; margin-bottom:10px;
  }
  /* মাল্টি-ফর্ম "বই"-এর প্রতিটা Sectionের শুরুতে বসে — নিজের পরীক্ষার নাম
     আর প্রশ্ন সংখ্যা দেখায়, আর সবসময় নতুন পেজ থেকে শুরু হতে বাধ্য করা হয়
     (paginate() জাভাস্ক্রিপ্টে .force-break যোগ হয়)। */
  .section-divider{
    background:#1d4ed8; color:#fff; font-weight:800; font-size:15px;
    border-radius:8px; padding:11px 16px; margin-bottom:12px; text-align:center;
  }
  /* JS পেজিনেশন যেখানে হিসাব করে একটা নতুন পেজ শুরু হওয়া উচিত (বা যেটা
     সবসময় নতুন পেজ থেকে শুরু হওয়া দরকার, যেমন Section ডিভাইডার), সেই
     ব্লকে এই ক্লাস বসিয়ে দেয় — প্রিন্ট/PDF-এ জোর করে নতুন পেজ থেকে
     শুরু করায়। */
  .force-break{ break-before:page; page-break-before:always; }
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
  .opt.correct{
    background:#dcfce7; color:#166534; font-weight:700; border-color:#16a34a;
  }
  .explain{
    margin-top:9px; padding:8px 11px; border-radius:6px;
    background:#f1f5f9; font-size:14px; line-height:1.55; color:#475569;
  }
  .explain b{ color:#0f172a; }
  .footer{
    text-align:center; color:#94a3b8; font-size:12px; padding:14px;
  }
  .footer a{ color:#64748b; font-weight:700; text-decoration:underline; }

  /* ── JS পেজিনেশন প্রতিটা পেজের শেষে এই ফুটার বসিয়ে দেয় ("পৃষ্ঠা ২ / ৫"
     স্টাইলে) — .brk ক্লাসসহ ফুটারের পরেই পরবর্তী পেজ শুরু হয় (শেষ পেজের
     ফুটারে .brk থাকে না, তাই এর পর আর নতুন খালি পেজ তৈরি হয় না)। এটা
     ব্রাউজারের real page-counter না — Chrome print engine CSS দিয়ে আসল
     পেজ-নম্বর দেওয়ার সুবিধা দেয় না, তাই কন্টেন্টের উচ্চতা মেপে জাভাস্ক্রিপ্ট
     নিজে হিসাব করে বসায়; প্রায় সব ক্ষেত্রেই নির্ভুল হবে, তবে সীমার একদম
     কাছাকাছি কোনো লাইনে ১ পেজ এদিক-ওদিক হতে পারে। বইয়ের ক্ষেত্রে (একাধিক
     Section) নাম্বারিং পুরো বই জুড়ে ধারাবাহিক থাকে, প্রতিটা Sectionে রিসেট
     হয় না। ── */
  .page-footer{
    text-align:center; color:#64748b; font-size:11.5px; font-weight:700;
    padding:8px 0 2px;
  }
  .page-footer.brk{ break-after:page; page-break-after:always; }

  /* ── পুরো পেজ জুড়ে নীল বর্ডার — position:fixed এলিমেন্ট Chrome-এর প্রিন্ট
     ইঞ্জিনে প্রতিটা পেজেই স্বয়ংক্রিয়ভাবে রিপিট হয় (কোনো JS ছাড়াই), তাই এই
     একই বর্ডার প্রতিটা প্রিন্ট/PDF পেজের চারদিকেই বসবে — পরে সবগুলো PDF
     একত্রিত করে একটা "বই" বানালে প্রতিটা পেজ একই রকম দেখাবে। ── */
  .page-frame{ display:none; }
  @media print{
    html, body{ background:#fff; }
    .actions{ display:none; }
    .card, .section-divider{ break-inside:avoid; }
    .card{ border:1px solid #e2e8f0 !important; }
    thead{ display:table-header-group; }
    tbody tr{ break-inside:avoid; }
    *{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .page-frame{
      display:block; position:fixed; top:0; left:0; right:0; bottom:0;
      border:2px solid #93c5fd; border-radius:16px; pointer-events:none;
    }
  }
</style>

</head>
<body>

  <div class="page-frame"></div>

  <div class="actions">
    <button class="pdf-btn secondary" id="qnoToggleBtn" onclick="toggleQno()">🔢 নম্বর লুকাও</button>
    <button class="pdf-btn" onclick="window.print()">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="3" y="1" width="10" height="9" rx="1" stroke="white" stroke-width="1.5"/><rect x="1" y="7" width="14" height="7" rx="1" stroke="white" stroke-width="1.5"/><rect x="4" y="11" width="8" height="1.5" rx=".75" fill="white"/></svg>
      Print / Download PDF
    </button>
  </div>

  ${warnHtml}

  <table class="sheet">
    <thead>
      <tr><th>
        <table class="topbar"><tr>
          <td class="logocell"><img class="logo" src="${logoSrc}" alt="DreamRise"></td>
          <td class="dividercell"></td>
          <td class="infocell">
            <div class="ttitle">${_akEscapeHtml(examTitle.toUpperCase())} — ${titleSuffix}</div>
            <div class="tsub">${infoLine}</div>
          </td>
        </tr></table>
      </th></tr>
    </thead>
    <tbody>
      <tr><td>
        <div class="body">
          ${cardsHtml}
          <div class="footer">Developed by <a href="https://www.facebook.com/dreamriseadmission" target="_blank" rel="noopener">DreamRise</a> &amp; <a href="https://www.facebook.com/muhammadibrahimsiddiknasib" target="_blank" rel="noopener">Muhammad Ibrahim</a> — ব্যাখ্যা আছে ${withExplain}/${totalQ} প্রশ্নে</div>
        </div>
      </td></tr>
    </tbody>
  </table>

  <script>
    function toggleQno(){
      document.body.classList.toggle('hide-qno');
      var hidden = document.body.classList.contains('hide-qno');
      document.getElementById('qnoToggleBtn').textContent = hidden ? '🔢 নম্বর দেখাও' : '🔢 নম্বর লুকাও';
      paginate();
    }

    /* ── প্রতিটা পেজের নিচে "পৃষ্ঠা N / মোট" বসানোর জন্য ব্লকগুলোর
       (কার্ড + Section-ডিভাইডার) উচ্চতা মেপে হিসাব করা হয় — Chrome-এর
       প্রিন্ট ইঞ্জিন CSS দিয়ে আসল পেজ-কাউন্টার সাপোর্ট করে না, তাই এভাবে
       JS দিয়ে অনুমান করে বসাতে হয়েছে। table.sheet-এর max-width A4-এর
       প্রিন্টেবল প্রস্থের সমান রাখা হয়েছে বলে স্ক্রিনে যেভাবে লাইন-র‍্যাপ
       হয়, প্রিন্টেও সেভাবেই হবে — তাই হিসাবটা বেশিরভাগ ক্ষেত্রেই নির্ভুল
       হওয়া উচিত। মাল্টি-Section বইয়ে প্রতিটা .section-divider সবসময় নতুন
       পেজ থেকে শুরু হয় (ঐচ্ছিক height-based break ছাড়াই), কিন্তু পেজ
       নাম্বারিং পুরো বই জুড়ে ধারাবাহিক থাকে। ── */
    function paginate(){
      document.querySelectorAll('.page-footer').forEach(function(el){ el.remove(); });
      document.querySelectorAll('.force-break').forEach(function(el){ el.classList.remove('force-break'); });

      var blocks = Array.prototype.slice.call(document.querySelectorAll('.card, .section-divider'));
      if (!blocks.length) return;

      var MM_TO_PX = 96 / 25.4;
      var pageH    = (297 - 14 - 14) * MM_TO_PX; // A4 উচ্চতা − @page-এর উপর/নিচ মার্জিন
      var headerEl = document.querySelector('table.topbar');
      var headerH  = headerEl ? headerEl.getBoundingClientRect().height : 90;
      var usableH  = pageH - headerH - 30; // পেজ-ফুটারের জন্য একটু জায়গা রাখা

      var groups  = [[]];
      var heights = [0]; // প্রতিটা গ্রুপের জমা height — footer কে পেজের
                          // নিচের দিকে (বর্ডারের কাছাকাছি) ঠেলে দিতে লাগবে
      var acc = 0;
      blocks.forEach(function(block, idx){
        var isDivider = block.classList.contains('section-divider');
        var h = block.getBoundingClientRect().height + 10; // + margin-bottom
        // Section ডিভাইডার (প্রথমটা বাদে) সবসময় নতুন পেজ থেকে শুরু হয়,
        // height যতই বাকি থাকুক না কেন — একটা নতুন পরীক্ষা মাঝপথে
        // আগের পরীক্ষার পাতার সাথে মিশে যাওয়া ঠেকাতে।
        var mustBreak = isDivider && idx > 0;
        if ((mustBreak || acc + h > usableH) && groups[groups.length - 1].length > 0) {
          groups.push([]);
          heights.push(0);
          acc = 0;
        }
        groups[groups.length - 1].push(block);
        acc += h;
        heights[heights.length - 1] = acc;
      });

      var total = groups.length;
      groups.forEach(function(group, i){
        if (i > 0) group[0].classList.add('force-break');
        var footer = document.createElement('div');
        footer.className = 'page-footer' + (i < total - 1 ? ' brk' : '');
        footer.textContent = 'পৃষ্ঠা ' + (i + 1) + ' / ' + total;
        // ঐ পেজের অবশিষ্ট (খালি) জায়গাটা margin-top হিসেবে বসিয়ে দেওয়া
        // হচ্ছে, যাতে ফুটার মাঝপথে না থেকে পেজের নিচের বর্ডারের কাছাকাছি
        // গিয়ে বসে — 24px রাখা হয়েছে ফুটারের নিজের উচ্চতার জন্য বাফার।
        var leftover = Math.max(0, usableH - heights[i] - 24);
        footer.style.marginTop = leftover + 'px';
        group[group.length - 1].insertAdjacentElement('afterend', footer);
      });
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(paginate);
    } else {
      window.addEventListener('load', paginate);
    }
    window.addEventListener('beforeprint', paginate);
  </script>

</body>
</html>`;

  ui.showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(760).setHeight(680),
    '📄 Answer Key — ' + examTitle
  );
}

// ── Answer Key-এর অনলাইন-লিংক ভার্সন (AnswerPage.html + এই নির্দেশিকা
// ফাংশন) সরিয়ে ফেলা হয়েছে — এখন থেকে Answer Key শুধু "📄 Answer Key
// (দেখুন ও PDF নিন)" ডায়ালগ দিয়েই দেখা/প্রিন্ট/ডাউনলোড হবে। Apps Script
// এডিটরে গিয়ে AnswerPage.html ফাইলটাও (এই স্ক্রিপ্ট এখন আর সেটা কোথাও
// ব্যবহার করে না) হাতে ডিলিট করে দিতে পারো, চাইলে।

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
