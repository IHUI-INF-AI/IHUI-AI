#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自动发帖 / 自动评论工作流的幂等静态对账（镜像测试，非提交链守门）
 *
 * 立因（2026-09-28 外部审计）：开放 issue 里机器人帖占多数 —— 14 条 `[nightly] button 文字换行
 * 违规 (日期)` 与 19 条 star 感谢帖把真实反馈挤出列表。根因是一个可机械判定的形态：
 * **发帖调用的标题里插值了日期，且创建之前不查"是否已有一条在位帖"** ⇒ 每次触发都开新帖。
 *
 * 本文件钉住两件事：
 *   ① 枚举面：所有含 `issues.create(` / `gh issue create` / `gh pr comment` 的 workflow 必须
 *      被列出来（枚举到 0 个 = 尺子失效，判红，不记绿）。
 *   ② 幂等判据：每个发帖调用所在的 **step 块**里，创建之前必须存在"在位帖查找"
 *      （`listForRepo(` / `gh issue list` / `issues/comments?` 列表调用），且
 *      新建标题不得插值日期；若该步会更新/关闭在位帖，标题匹配必须是**逐字相等**
 *      （`.title ===` / `select(.title ==`），出现 `title.startsWith` 即红 ——
 *      startsWith 会把刚清零的带日期历史副本重新接上账。
 *
 * 定级：**只做镜像测试**（`scripts-mirror-tests.yml` 的 `node scripts/run-script-tests.mjs` 会
 * 自动发现它），刻意 **不** 注册进 `scripts/guardian-runner.mjs`。理由：它判的是仓库静态内容，
 * 但一个 workflow 的改动完全可以与"是否发帖"无关，把它挂进提交链就是与本次提交无关的恒红门，
 * 唯一结局是各会话 `--no-verify`、连带其余全部守门作废（AGENTS §12e 同型）。
 *
 * 零依赖：只用 node 内建 + 自带的缩进感知解析（CI 的干净检出没有 js-yaml 可依赖时也能跑）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const WF_DIR = join(ROOT, '.github', 'workflows')

const CREATE_RE = /github\.rest\.issues\.create\(|\bgh issue create\b/g
const COMMENT_RE = /\bgh pr comment\b|rest\.issues\.createComment\(/g

/** 行首 `-` 项（YAML step 条目）⇒ 返回 {start, indent}；块到下一个同缩进的 `- ` 或更缩进行的非空行止。 */
function stepBlockOf(lines, idx) {
  let start = -1
  let indent = -1
  for (let i = idx; i >= 0; i--) {
    const m = /^(\s*)- (\S)/.exec(lines[i])
    if (m) {
      start = i
      indent = m[1].length
      break
    }
  }
  if (start === -1) return null
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const curIndent = line.match(/^\s*/)[0].length
    if (curIndent < indent) return lines.slice(start, i).join('\n')
    if (curIndent === indent && /^\s*- /.test(line)) return lines.slice(start, i).join('\n')
  }
  return lines.slice(start).join('\n')
}

/**
 * 判一个发帖 step 块是否幂等。返回 {ok, reasons[]}。
 * 判不出（块取不到）⇒ ok=false，绝不静默放过。
 */
export function judgePostingBlock(block) {
  if (block == null) return { ok: false, reasons: ['取不到所在 step 块 ⇒ 无法判定（不得记为通过）'] }
  const reasons = []
  const createAt = Math.min(
    ...[block.indexOf('issues.create('), block.search(/\bgh issue create\b/)].filter((i) => i >= 0),
  )
  const commentAt = block.search(/gh pr comment|rest\.issues\.createComment\(/)
  const isUpdateOnly = !Number.isFinite(createAt) && commentAt >= 0
  const lookupRe = isUpdateOnly
    ? /issues\/\$\{?[A-Za-z_][\w}]*\}?\/comments\?|listForRepo\(|rest\.issues\.listComments\(/
    : /listForRepo\(|\bgh issue list\b/
  const before = block.slice(0, Number.isFinite(createAt) ? createAt : commentAt)
  if (!lookupRe.test(before)) reasons.push('创建/评论之前没有"在位帖查找" ⇒ 每次触发都会新发一条')
  if (/title[^\n]{0,160}\$\{\s*(date|DATE|today|TODAY)\b|--title\s+"[^\n]*\$\{DATE\}/i.test(block)) {
    reasons.push('新建标题里插值了日期 ⇒ 同文不同日期的每晚开新帖')
  }
  const updatesExisting = /issues\.update\(|issues\.close\(|gh issue edit|gh issue close/.test(block)
  if (updatesExisting) {
    if (/title\s*\.startsWith\(|startsWith\([^)\n]*[Tt]itle/.test(block)) {
      reasons.push('用 startsWith 匹配跟踪帖 ⇒ 历史带日期副本会被重新接上账')
    } else if (!/select\(\.title\s*==|\.title\s*===/.test(block)) {
      reasons.push('更新/关闭在位帖却没有按标题逐字相等定位 ⇒ 可能改到别人的帖')
    }
  }
  return { ok: reasons.length === 0, reasons }
}

function* enumeratePostings() {
  const files = readdirSync(WF_DIR).filter((f) => /\.ya?ml$/.test(f)).sort()
  assert.ok(files.length > 0, `.github/workflows 下枚举到 0 个文件 ⇒ 尺子失效，不是"没有发帖自动化"`)
  for (const f of files) {
    const lines = readFileSync(join(WF_DIR, f), 'utf8').split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      for (const re of [CREATE_RE, COMMENT_RE]) {
        re.lastIndex = 0
        if (re.test(lines[i])) yield { file: f, line: i + 1, text: lines[i].trim() }
      }
    }
  }
}

test('枚举面：自动化发帖/发帖评论入口必须被看见（空枚举=判红，不记绿）', () => {
  const found = [...enumeratePostings()]
  console.log(`枚举到 ${found.length} 个发帖/评论调用点：\n${found.map((p) => `  ${p.file}:${p.line}  ${p.text.slice(0, 70)}`).join('\n')}`)
  assert.ok(found.length >= 5, `现仓已知至少 5 个入口（nightly 跟踪帖 / 感谢帖 / NativeWind 监控 / 安全审计 / PR AI 评审），只枚举到 ${found.length} ⇒ 判据或扫描面失效`)
})

/**
 * 在途修单的登记（不是豁免清单的替代品，是**带到期与腐烂检查**的待偿台账）：
 * `button-wrap-nightly.yml` 的"单一跟踪帖"改法由 PR #70（分支 `ci-fix/nightly-single-tracker`）
 * 持有，本票禁止改那个文件 ⇒ 若它仍红，只能记成"已知在途"，但**一旦它不再红就必须删行**
 * （否则这张表会变成第二份真相，替后人做出"已经收口了"的判断）。
 */
const PENDING_FIXES = new Map([
  [
    'button-wrap-nightly.yml',
    { reason: 'PR #70 已把它改成单一跟踪帖，本票不得重复改', coveredBy: '#70', until: '2026-10-31' },
  ],
])

test('幂等判据：每个发帖入口所在 step 创建前必须查在位帖，且标题不带日期', () => {
  const byFile = new Map()
  for (const p of enumeratePostings()) {
    const lines = readFileSync(join(WF_DIR, p.file), 'utf8').split(/\r?\n/)
    const block = stepBlockOf(lines, p.line - 1)
    const { ok, reasons } = judgePostingBlock(block)
    if (!ok) {
      if (!byFile.has(p.file)) byFile.set(p.file, [])
      byFile.get(p.file).push(`${p.file}:${p.line} ⇒ ${reasons.join('；')}`)
    }
  }
  const violations = [...byFile.keys()]
  for (const [file, row] of PENDING_FIXES) {
    if (!violations.includes(file)) {
      assert.fail(
        `待偿台账里 ${file} 声称仍在途（${row.reason} / ${row.coveredBy}），但判据现读已不红 ⇒ ` +
          '该 PR 已合并或改法已落地，请删除 PENDING_FIXES 中这一行（留着就是第二份真相）。',
      )
    }
    if (new Date(row.until).getTime() < Date.now()) {
      assert.fail(`${file} 的在途登记已于 ${row.until} 到期仍挂着 ⇒ 要么落地修复，要么显式续期，不得静默放行`)
    }
    console.log(`已知在途（不计本次红）：${file} —— ${row.reason}（${row.coveredBy}，到期 ${row.until}）`)
  }
  const unlisted = violations.filter((f) => !PENDING_FIXES.has(f))
  assert.equal(
    unlisted.length,
    0,
    `以下自动发帖入口不幂等：\n${unlisted.flatMap((f) => byFile.get(f)).join('\n')}`,
  )
})

test('判据有牙（正向对照）：带日期标题 + 无在位帖查找 ⇒ 必须判不幂等', () => {
  const badBlock = [
    '      - name: 创建 GitHub Issue (命中时)',
    '        uses: actions/github-script@v7',
    '        with:',
    '          script: |',
    '            const date = new Date().toISOString().slice(0, 10);',
    '            await github.rest.issues.create({',
    '              owner: o, repo: r,',
    '              title: `[nightly] 违规 1 处 (${date})`,',
    '            });',
  ].join('\n')
  const verdict = judgePostingBlock(badBlock)
  assert.equal(verdict.ok, false, '这段"每晚开新帖"的原文形态必须被判不幂等，否则本测试只是复读实现')
  assert.match(verdict.reasons.join('\n'), /在位帖查找/)
  assert.match(verdict.reasons.join('\n'), /日期/)
})

test('判据不误伤（反向对照）：单一跟踪帖形态 + 逐字相等匹配 ⇒ 判幂等', () => {
  const goodBlock = [
    '      - name: 维护唯一跟踪帖',
    '        uses: actions/github-script@v7',
    '        with:',
    '          script: |',
    "            const TRACK_TITLE = '[nightly] 违规 · 自动跟踪';",
    '            const r = await github.rest.issues.listForRepo({ owner, repo, state: \'open\' });',
    '            const tracker = r.data.find((i) => i.title === TRACK_TITLE) || null;',
    '            if (tracker) { await github.rest.issues.update({ issue_number: tracker.number, body }); return; }',
    '            await github.rest.issues.create({ owner, repo, title: TRACK_TITLE, body });',
  ].join('\n')
  assert.equal(judgePostingBlock(goodBlock).ok, true)
})

test('startsWith 匹配跟踪帖必须判红（否则刚清空的账会重新接上）', () => {
  const block = [
    '      - name: 更新跟踪帖',
    '        run: |',
    '          gh issue list --state open --json number,title --jq \'.[] | select(.title | startswith("[nightly]")) | .number\'',
    '          gh issue edit "$N" --body-file body.md',
    '          gh issue create --title "[nightly] 违规 · 自动跟踪"',
  ].join('\n')
  const v = judgePostingBlock(block)
  assert.equal(v.ok, false)
  assert.match(v.reasons.join('\n'), /startsWith|逐字相等/)
})

test('块解析不得静默失败：解析不到 step 块 ⇒ 判"无法判定"而非通过', () => {
  assert.equal(judgePostingBlock(null).ok, false)
  assert.match(judgePostingBlock(null).reasons.join(''), /无法判定/)
})

/**
 * 自动**关帖**的作用域判据 —— 这条同时是给 PR #66（感谢帖 48h 自动归档）上的相容性锁。
 * 规矩：任何把 issue 关掉的调用，其所在 step 必须先按「标签」或「标题逐字相等」把范围限定死；
 * 只按"存在即关"的写法会替别人把正在回复的帖关掉（48h 那枚判据靠"无真人回复"守住，
 * 而这条守住的是"不得跨族关帖"）。
 */
test('关帖必须先限定作用域（标签或标题逐字相等）—— 与感谢帖 48h 策略互不越界', () => {
  const offenders = []
  let seen = 0
  for (const f of readdirSync(WF_DIR).filter((x) => /\.ya?ml$/.test(x))) {
    const text = readFileSync(join(WF_DIR, f), 'utf8')
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      if (!/gh issue close|state:\s*'closed'/.test(lines[i])) continue
      seen++
      const block = stepBlockOf(lines, i)
      if (block == null) {
        offenders.push(`${f}:${i + 1} ⇒ 取不到 step 块，无法判定关帖范围`)
        continue
      }
      const scoped = /labels:\s*\[/.test(block) || /--label\b/.test(block) || /select\(\.title\s*==|\.title\s*===/.test(block)
      if (!scoped) offenders.push(`${f}:${i + 1} ⇒ 关帖调用未按标签/标题限定范围（会波及他人在飞的帖）`)
    }
  }
  // 空扫描不是"通过"：一条关帖都没看见，说明判据或扫描面失效了
  assert.ok(seen >= 2, `全仓只枚举到 ${seen} 处关帖调用（本票两条跟踪帖的 0 命中分支各一处）⇒ 枚举面失效，不记绿`)
  console.log(`枚举到 ${seen} 处关帖调用，逐条核过范围`)
  assert.equal(offenders.length, 0, offenders.join('\n'))
})

/** 相容性事实核对：感谢帖一族与本票的跟踪帖一族按标签/标题天然分桶，不得互相命中。 */
test('跟踪帖标题与感谢帖标题族不相交（本票改的入口都不得落在"感谢/Star"那一族）', () => {
  // 每个文件要抽的东西不同：两个是 issue 跟踪帖（有标题常量），pr-review 是 PR 评论（只有隐藏标记）。
  // 判据不得对"抽不到对象"的文件静默放过 —— 那正是把测试写成复读机的起点。
  const targets = [
    { file: 'nativewind-monitor.yml', re: /TRACK_TITLE\s*=\s*'([^']+)'/g },
    { file: 'weekly-security-audit.yml', re: /TITLE='([^']+)'/g },
    { file: 'pr-review.yml', re: /<!--\s*(pr-ai-review:auto)\s*-->/g },
  ]
  for (const { file, re } of targets) {
    const text = readFileSync(join(WF_DIR, file), 'utf8')
    const hits = [...text.matchAll(re)].map((m) => m[1])
    assert.ok(hits.length > 0, `${file} 里找不到该抽的对象（标题常量/隐藏标记）⇒ 判据对它失效，先修对象再谈测试`)
    for (const h of hits) {
      assert.ok(!/感谢|Star|star-/.test(h), `${file} 的 "${h}" 落在感谢帖标题族里 ⇒ 会被感谢帖 48h 策略一并关闭`)
    }
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
