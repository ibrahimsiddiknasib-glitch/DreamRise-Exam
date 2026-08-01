# Changelog

All notable changes to DreamRise are tracked here.

## [Unreleased] — Portal badges & branding polish

### Added
- Result portal: per-subject and per-Additional-Mark **pass/fail badges**
  (`✅ পাস` / `❌ ফেইল`) directly on each subject card, so a specific weak
  subject is visible without reading raw numbers.
- Failed subject/Additional-Mark cards get a red left-border + tinted
  background and a red progress bar; passed ones get a subtle green accent.
  Colors are tuned separately for light and dark themes for contrast.
- Additional Mark items not yet manually entered show a neutral
  "⏳ এখনো বসানো হয়নি" badge instead of being wrongly marked as failed.
- Setup Wizard: **Overall** Additional Mark mode now has its own pass-mark
  field (Subject-wise mode already had this). A student can now fail overall
  purely on a weak written/homework mark, not just on percentage.

### Changed
- Print/PDF header in the result portal now shows only the logo — the
  redundant "DreamRise" text title next to it was removed.

### Fixed
- **Portal "প্রতি প্রশ্নের মান" / "নেগেটিভ মার্ক" showing wrong values**
  (e.g. 1.20 instead of 1.25, 0.63 instead of 0.25) when Additional Mark was
  enabled. These were being derived as `fullMarks ÷ totalQ`, but `fullMarks`
  includes the Additional Mark ceiling, so the division no longer equaled
  the configured positive/negative mark. Now read directly from
  `meta.posMark` / `meta.negMark`.
- **Written/Additional Mark not showing on the result portal at all.** The
  cached per-student array never carried the Additional Mark or Grand Total,
  so the portal had nothing to display even after a successful sync. Cache
  rows now include Grand Total and raw Additional Mark data, and
  `findStudentInMinifiedCache()` returns them to the portal.
- **Additional Mark columns going blank on re-sync.** Column matching used
  to rely on locating headers by Bengali text, which was fragile (invisible
  characters, header reordering); it now locates columns by computed
  position via a shared `buildRankingHeaders()` helper used by both the
  renderer and the reader, so structure is always self-consistent.
- **Race condition causing scores to change after auto-sync** — added a
  `LockService` lock around `calculateAndRank()` and around the fresh-payload
  read/merge inside `computeSingleStudentAndMerge()`, closing a lost-update
  window that could occur during burst form submissions or near-simultaneous
  portal searches.
- **Phone-number dedupe mismatch** — dedupe and every search path now share
  one `normalizePhone()` function (last 10 digits, digits-only), so a student
  entering their number in two formats no longer creates two ranking entries.
- Header-row detection is now bounded to the first few rows (previously
  scanned the whole sheet, risking a false match on student answer text).
- A toast now warns if the Answer Key row appears to have moved (e.g. after
  a manual sort), instead of silently mis-scoring everyone.

## Earlier history

- Auto-Sync on Portal Search, permanent `DR_Backup` sheet (survives cache
  expiry), exact full-text answer matching (replacing a comma/slash-split
  heuristic that broke on answers containing punctuation), Exam Summary bar,
  dynamic light/dark logo switching, multi-page print support, and the
  Statistics dialog were all introduced in earlier iterations and remain in
  place.
