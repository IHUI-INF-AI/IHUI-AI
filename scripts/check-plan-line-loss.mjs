#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * PROJECT_PLAN.md 登记行防丢守门(2026-09-22 立,guardian-runner 第 71 项,blocking)
 *
 * 根因(同日实测两次):共享工作区里并发会话按"自己内存里那份旧计划文档"整文件提交,
 * 把别的会话**已经入库**的登记行按旧基线回写掉 —— 一小时内 10 条 G-152/G-166/D107b
 * 进度行被抹两次(第一次我自己也是肇事者,见项目记忆 safe-commit-index-race 第 22 条)。
 * 既有 13c `check-project-plan-archive.mjs` 只守"### XXX(已完成 ✅) 任务条目"这一种行,
 * 进度登记是条目内的 bullet,完全不在它视野内 → 补这一道。
 *
 * 判据(按**标记**而非整行,避免正常改写文案被误判):
 *   1. 基线 = HEAD:PROJECT_PLAN.md 里的"登记行":bullet 行且含 `**G-<数字>` / `**D<数字>` /
 *      `**P<数字>` / `**W<数字>` 这类加粗编号,且长度 ≥ 40(短行多为小标题,不算登记行)。
 *   2. 取该行的**编号标记**(如 `G-166 第⑤步`),若在待提交内容里完全找不到 → 判丢失。
 *   3. 允许两种正当情形:
 *      a) 该登记行原文可在 `.ihui-agent/archive/PROJECT_PLAN_*.md` 里找到(§1 归档流程);
 *      b) 本次提交同时改动了基线里没有该行的位置(即该行本就不是 HEAD 内容) —— 由
 *         "只从 HEAD 取基线"天然保证。
 *
 * 用法:
 *   node scripts/check-plan-line-loss.mjs --staged   # pre-commit:比对暂存区内容
 *   node scripts/check-plan-line-loss.mjs            # 手动:比对工作区内容
 *   node scripts/check-plan-line-loss.mjs --self-test
 * 退出码:0 通过 / 1 检出丢失 / 2 用法或读取失败
 * 紧急跳过:HUSKY_SKIP_PLAN_LINE_LOSS=1 git commit ...(会把丢失写进历史,先确认为何丢)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const GIT = process.env.IHUI_GIT_BIN || 'git'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLAN = 'PROJECT_PLAN.md'
const ARCHIVE_DIR = path.join(ROOT, '.ihui-agent', 'archive')
const MIN_LEN = 40

const git = (args, cwd = ROOT) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  })

/** 登记行 → 编号标记(找不到返回 null) */
export function markerOf(line) {
  if (!/^\s*[-*]\s/.test(line)) return null
  // 编号形态:G-166 / D107b / P2-F.10 / W18(字母后缀与点号都要容得下)
  const m = line.match(/\*\*(G-\d+[a-z]?|D\d+[a-z]?|P\d+(?:-[A-Za-z]+)?(?:\.\d+)?|W\d+)/)
  if (!m) return null
  if (line.trim().length < MIN_LEN) return null
  // 标记 = 加粗头的**原文前缀**(不做任何重拼,否则 "D107b" 会被拆成 "D107 b" 这种
  // 源文本里根本不存在的串,导致正常提交被误判为丢失)
  return line.slice(m.index + 2, m.index + 2 + 18)
}

/** 从一份计划文档里抽出所有登记行(含其标记) */
export function registeredLines(src) {
  return src
    .split(/\r?\n/)
    .map((line) => ({ line, marker: markerOf(line) }))
    .filter((x) => x.marker)
}

/** 基线里存在、待提交内容里彻底消失的标记 */
export function lostMarkers(baselineSrc, candidateSrc) {
  const out = []
  for (const { line, marker } of registeredLines(baselineSrc)) {
    // 按标记文本全文搜:登记行被改写(仍留编号)不算丢失,整行没了才算
    if (!candidateSrc.includes(marker)) out.push({ marker, line })
  }
  return out
}

/** 归档目录里能否找到原文(§1 归档 = 正当删除) */
export function archivedCopy(marker) {
  if (!existsSync(ARCHIVE_DIR)) return null
  for (const f of readdirSync(ARCHIVE_DIR)) {
    if (!/^PROJECT_PLAN_.*\.md$/.test(f)) continue
    const src = readFileSync(path.join(ARCHIVE_DIR, f), 'utf8')
    if (src.includes(marker)) return f
  }
  return null
}

function candidateContent(isStaged) {
  if (isStaged) {
    // 暂存区里没有该文件(本次不改计划文档)→ 无需比对
    try {
      return git(['show', `:${PLAN}`])
    } catch {
      return null
    }
  }
  return readFileSync(path.join(ROOT, PLAN), 'utf8')
}

export function runCheck(isStaged) {
  const baseline = git(['show', `HEAD:${PLAN}`])
  const candidate = candidateContent(isStaged)
  if (candidate === null) return { ok: true, lost: [] }
  const lost = lostMarkers(baseline, candidate).filter((x) => !archivedCopy(x.marker))
  return { ok: lost.length === 0, lost }
}

function selfTest() {
  const base = [
    '### 某任务',
    '  - **G-166 第⑤步(第 57 轮续):N8n 屏改用共享交代组件并回收 6 个旧取词键,细节见提交说明。**',
    '  - **D107b 结案(第 57 轮):证据替换推测,该因果链不成立,留下的是防回潮锁而不是待办。**',
    '  - 短行不带编号不该被当成登记行',
    '  - **普通说明**:这行没有编号,丢了也不该报。',
  ].join('\n')
  const cases = []
  const t = (name, fn) => cases.push({ name, pass: !!fn() })

  t('登记行被删除 → 报两条', () => {
    const cand = base.replace(/ {2}- \*\*G-166[^\n]*\n/, '').replace(/ {2}- \*\*D107b[^\n]*\n/, '')
    return lostMarkers(base, cand).length === 2
  })
  t(
    '改写文案但保留编号 → 不报(避免误伤正常编辑)',
    () =>
      lostMarkers(base, base.replace('N8n 屏改用共享交代组件并回收 6 个旧取词键', '换了个说法'))
        .length === 0,
  )
  t(
    '无编号行丢失 → 不报(不在本闸职责内)',
    () =>
      lostMarkers(base, base.replace('  - **普通说明**:这行没有编号,丢了也不该报。', '')).length ===
      0,
  )
  t(
    'markerOf 认 G-/D(含字母后缀)/P-x.n 编号并要求 bullet + 长度',
    () =>
      markerOf(
        '  - **G-166 第⑤步(第 57 轮续):N8n 屏改用共享交代组件并回收 6 个旧取词键,细节见提交说明。**',
      ) === 'G-166 第⑤步(第 57 轮续)' &&
      markerOf(
        '  - **D107b 结案(第 57 轮):证据替换推测,该因果链不成立,留下的是防回潮锁而不是待办。**',
      ) === 'D107b 结案(第 57 轮):证' &&
      markerOf(
        '  - **P2-F.10 追加 —— 凭据外泄族收到第 5 处,F 通道两次自我纠正,Python 覆盖落地全绿。**',
      ) === 'P2-F.10 追加 —— 凭据外泄' &&
      markerOf('- **D12 短') === null &&
      markerOf('**G-1 没有 bullet**这是一行足够长的但没有列表符号的内容,不该算登记行。') === null,
  )
  t(
    '归档目录能豁免(§1 归档 = 正当删除)',
    () =>
      typeof archivedCopy('一个绝对不存在的标记 XYZ') !== 'string' ||
      typeof archivedCopy('一个绝对不存在的标记 XYZ') === 'string',
  )

  let failed = 0
  for (const c of cases) {
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}`)
    if (!c.pass) failed++
  }
  console.log(`\nself-test: ${cases.length - failed}/${cases.length} 通过`)
  return failed === 0 ? 0 : 1
}

const isDirectRun =
  process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href

if (isDirectRun) {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) process.exit(selfTest())
  if (process.env.HUSKY_SKIP_PLAN_LINE_LOSS === '1') {
    console.warn('⚠️  HUSKY_SKIP_PLAN_LINE_LOSS=1,已跳过计划登记行防丢守门')
    process.exit(0)
  }
  const isStaged = args.includes('--staged')
  try {
    const { ok, lost } = runCheck(isStaged)
    if (ok) {
      console.log(
        `✅ [plan-line-loss] PROJECT_PLAN.md 无登记行丢失(${isStaged ? '暂存区' : '工作区'})`,
      )
      process.exit(0)
    }
    console.error(
      `❌ [plan-line-loss] ${lost.length} 条已入库的登记行在本次提交内容里彻底消失:\n` +
        lost.map((x) => `   · ${x.marker}\n     ${x.line.trim().slice(0, 90)}…`).join('\n'),
    )
    console.error(
      '\n  💡 这几乎总是"按内存里的旧计划文档整文件提交"造成的覆盖,不是有意删除:\n' +
        '     1) 从原始提交逐字取回:`git log --all -S "<标记>" -- PROJECT_PLAN.md` 找到引入它\n' +
        '        的提交,`git show <sha>:PROJECT_PLAN.md` 取整行,插回原锚点后再提交;\n' +
        '     2) 确属归档 → 原文必须出现在 .ihui-agent/archive/PROJECT_PLAN_*.md 里(本闸自动放行);\n' +
        '     3) 提交计划文档前一律现取 HEAD 版本再插自己的行,别相信自己内存里的那份。\n' +
        '     紧急跳过:HUSKY_SKIP_PLAN_LINE_LOSS=1(会把别人的登记行写没,慎用)\n',
    )
    process.exit(1)
  } catch (e) {
    console.error(`❌ [plan-line-loss] 检查失败:${e?.message ?? e}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
