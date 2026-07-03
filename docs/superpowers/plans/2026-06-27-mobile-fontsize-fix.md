# Mobile Font Size Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 300 mobile-fontsize violations in `client/src` by raising undersized font declarations to a minimum of 12px while preserving intentional design-token definitions.

**Architecture:** Batch-replace unsafe `9px/10px/11px` declarations with `12px` in application code, adjust only the minimums of `clamp(11px, ...)` patterns, keep token/system files untouched, then validate with the project's fontsize checker, lint, build, and runtime screenshots.

**Tech Stack:** Node.js, TypeScript, Vue 3, SCSS, Playwright, stylelint, Vite

---

### Task 1: Audit Violations And Exclusions

**Files:**
- Modify: `client/scripts/check-mobile-fontsize.ts:1`
- Test: `client/scripts/check-mobile-fontsize.ts:1`

- [ ] **Step 1: Create exclusion list for token/system files**

Add a safe-guard allowlist in `scripts/check-mobile-fontsize.ts` to skip known token/system files such as:
- `src/styles/responsive-fonts.scss`
- `src/styles/fonts*.ts|scss`
- `src/styles/_open-platform.scss`
- `src/styles/_openclaw-panels.scss`

- [ ] **Step 2: Run baseline audit after exclusions**

Run: `cd G:/IHUI-AI/client && npx tsx scripts/check-mobile-fontsize.ts`
Expected: Remaining violations should be only in application components/views/styles, not in the token files.

- [ ] **Step 3: Export violation list for patch tracking**

Run: `cd G:/IHUI-AI/client && npx tsx scripts/check-mobile-fontsize.ts > artifacts/fontsize-violations-before.txt`
Expected: File created with exact file/line references.

---

### Task 2: Batch Fix Undersized Declarations

**Files:**
- Modify: `client/src/**/*.vue`
- Modify: `client/src/**/*.scss`
- Modify: `client/src/**/*.css`

- [ ] **Step 1: Replace 9px/10px with 12px in application code**

Search/replace scope:
- `src/components/**/*.vue`
- `src/components/**/*.scss`
- `src/views/**/*.vue`
- `src/views/**/*.scss`
- `src/styles/**/*.scss` (excluding token/system files)

Command pattern:
```powershell
cd G:/IHUI-AI/client
$files = Get-ChildItem -Recurse -Include *.vue,*.scss,*.css src | Where-Object { $_.FullName -notmatch 'node_modules|dist|\.git|responsive-fonts\.scss|fonts(\.|-)|_open-platform\.scss|_openclaw-panels\.scss' }
foreach ($f in $files) { (Get-Content $f) -replace 'font-size:\s*9px', 'font-size: 12px' -replace 'font-size:\s*10px', 'font-size: 12px' -replace 'font-size:\s*11px', 'font-size: 12px' | Set-Content $f }
```

Expected: All plain `9px/10px/11px` values replaced with `12px` outside excluded files.

- [ ] **Step 2: Fix clamp minima from 11px to 12px**

Search/replace scope same as above.

Command pattern:
```powershell
cd G:/IHUI-AI/client
$files = Get-ChildItem -Recurse -Include *.vue,*.scss,*.css src | Where-Object { $_.FullName -notmatch 'node_modules|dist|\.git|responsive-fonts\.scss|fonts(\.|-)|_open-platform\.scss|_openclaw-panels\.scss' }
foreach ($f in $files) { (Get-Content $f) -replace 'clamp\(\s*11px', 'clamp(12px' | Set-Content $f }
```

Expected: All `clamp(11px, ...)` become `clamp(12px, ...)` outside excluded files.

- [ ] **Step 3: Re-run checker immediately after fixes**

Run: `cd G:/IHUI-AI/client && npx tsx scripts/check-mobile-fontsize.ts`
Expected: PASS with exit code 0.

---

### Task 3: Validate With Lint Build And Visual Regression

**Files:**
- Test: `client/e2e/**`
- Test: `client/src/**`

- [ ] **Step 1: Run stylelint**

Run: `cd G:/IHUI-AI/client && npx stylelint 'src/**/*.{vue,scss,css}' --max-warnings=-1`
Expected: PASS.

- [ ] **Step 2: Run fast build**

Run: `cd G:/IHUI-AI/client && $env:VITE_EDU_API_BASE='http://localhost:8000'; $env:VITE_EDU_SSO_BASE='http://localhost:8888'; npm run build:fast`
Expected: PASS.

- [ ] **Step 3: Capture runtime screenshots**

Start dev server if needed and capture:
- Desktop Register page screenshot
- Mobile Register page screenshot

Expected: Screenshots saved under `client/output/playwright/`.

- [ ] **Step 4: Update manifest**

Update `client/STYLE-FIX-MANIFEST.md` to record font-size fix summary.

---

### Task 4: Final Verification Before Completion

**Files:**
- Test: `client/scripts/check-mobile-fontsize.ts:1`

- [ ] **Step 1: Run full fontsize check again**

Run: `cd G:/IHUI-AI/client && npx tsx scripts/check-mobile-fontsize.ts`
Expected: PASS.

- [ ] **Step 2: Report changed files and residual risks**

List modified files with `git status --short` and summarize any remaining `11px` usages that were intentionally preserved.
