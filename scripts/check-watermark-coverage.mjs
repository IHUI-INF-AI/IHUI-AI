#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 溯源水印覆盖守门(blocking, 2026-09-12 升级为**自愈式**)
 *
 * 背景: CI 的 `node scripts/watermark.mjs verify` 要求所有可注入源文件携带**完整可解码**水印。
 * 历史两次翻车:
 *   ① 新增文件未注入水印 -> 本地提交通过、CI 红(Provenance watermark check);
 *   ② 生成器/文本级改写把已跟踪文件的水印横幅或零宽载荷弄丢/弄坏 -> 门禁**恒红**,
 *      而当时工具无法复现自己强制的版式,导致只能靠 `HUSKY_SKIP_WATERMARK_GUARD=1` 绕过提交。
 *
 * 2026-09-12 根治(不再依赖"每个生成器自觉注入"):
 *   门禁自身具备**自愈能力** —— 检出缺口后自动 `clean + inject` 回写, 并同步 `git add` 到暂存区,
 *   使"未加水印的文件进入提交"这一状态在结构上不可能发生; 无论文件是被谁(生成器/脚本/sed)改写出来的。
 *   生成器自带注入(如 apps/miniapp-taro/scripts/gen-i18n-compressed.mjs)仍保留, 属"更早一步"的优化,
 *   不再是唯一防线。
 *
 * 判定口径: `watermark.mjs list-uncovered`(载荷损坏 + 残迹 + 未覆盖) ∩ `git ls-files`
 *   - 只看 git 已跟踪(含本次新 `git add`)文件, 与 CI 检出范围一致; 本地未跟踪构建产物不计入。
 *
 * 用法:
 *   node scripts/check-watermark-coverage.mjs            # 自愈模式(pre-commit 默认)
 *   node scripts/check-watermark-coverage.mjs --no-fix   # 纯判定, 不修改(CI / 审计用)
 * 紧急跳过: HUSKY_SKIP_WATERMARK_GUARD=1 git commit ...   (正常流程不再需要)
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { createExclusionPredicate, LedgerUnavailable } from './lib/third-party-roots.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = join(ROOT)
const NO_FIX = process.argv.includes('--no-fix')
// 安全闸: 一次性自动回写的文件数上限。超过则拒绝自愈并直接报错,
// 避免"某个批量改写脚本把半个仓库打回未水印态"时被静默整体重写。
const MAX_AUTOFIX = 200

if (process.env.HUSKY_SKIP_WATERMARK_GUARD === '1') {
  console.log('[skip] HUSKY_SKIP_WATERMARK_GUARD=1, 跳过溯源水印覆盖守门')
  process.exit(0)
}

/**
 * 第三方排除面与 watermark.mjs 走**同一个出口**(scripts/lib/third-party-roots.mjs)。
 * 本门自己不再拼一份 roots 清单 —— 两处算同一件事各写一份,正是本仓最高频的失守形态。
 * 之所以两处都要判:本门的自愈循环(`inject` + 双横幅巡检)与 list-uncovered 是两条独立路径,
 * 只收窄其一,另一条照样会把横幅打进已登记的第三方内容。
 */
let exclusion
try {
  exclusion = createExclusionPredicate(REPO_ROOT)
} catch (e) {
  const why = e instanceof LedgerUnavailable ? e.message : String(e?.message ?? e)
  console.error('[watermark-coverage] ❌ 第三方排除面无法判定:' + why.split('\n')[0])
  console.error('  算不出"哪些是已登记第三方内容"时**拒绝**自愈 —— 自愈的动作是往文件里写归属横幅,')
  console.error(
    '  把横幅写进 Apache-2.0/MIT 许可原文比"少一个横幅"严重得多。请先修台账或 git 可用性。',
  )
  process.exit(1)
}

const run = (cmd, args) =>
  execFileSync(cmd, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  })

/** watermark.mjs list-uncovered → 载荷损坏 + 残迹 + 未覆盖(相对仓库根, / 分隔) */
function listUncovered() {
  try {
    return run('node', ['scripts/watermark.mjs', 'list-uncovered'])
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  } catch (e) {
    console.error('[watermark-coverage] 无法获取未覆盖清单:', e.message)
    process.exit(1)
  }
}

function trackedFiles() {
  return new Set(
    run('git', ['ls-files'])
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  )
}

function reportGap(missing, reason) {
  console.error(`[watermark-coverage] ❌ ${missing.length} 个已跟踪文件缺失/损坏溯源水印${reason}:`)
  for (const f of missing.slice(0, 30)) console.error('  - ' + f)
  if (missing.length > 30) console.error(`  ... 其余 ${missing.length - 30} 个`)
  console.error('')
  console.error('  手动修复: node scripts/watermark.mjs inject <file>')
  console.error('            node scripts/watermark.mjs list-uncovered   # 列出全部缺口')
  console.error('  紧急跳过: HUSKY_SKIP_WATERMARK_GUARD=1 git commit ...')
}

const tracked = trackedFiles()
const uncovered = listUncovered()
// 双保险:排除面已由 watermark.mjs 的 scanCoverage 用同一个谓词移出分母,这里再筛一次 ——
// 若哪天有人只改了一侧,本门要么把横幅打进第三方内容(自愈侧),要么恒红(判定侧)。
// 被这里筛掉的即为"两侧谓词不一致"的证据,必须喊出来,不得静默(静默 = 下一次只有一侧在防)。
const missing = uncovered.filter((f) => tracked.has(f) && !exclusion.isExcluded(f))
const drift = uncovered.filter((f) => tracked.has(f) && exclusion.isExcluded(f))
if (drift.length > 0) {
  console.warn(
    `[watermark-coverage] ⚠️ 排除面两侧不一致:${drift.length} 个已登记第三方文件被 list-uncovered 报成缺口(watermark.mjs 未走同一谓词?),已跳过不注入。示例: ${drift.slice(0, 5).join(', ')}`,
  )
}
console.log(
  `[watermark-coverage] 台账登记的第三方排除面:roots ${exclusion.roots.length} 条 → 真实文件 ${exclusion.paths.size} 个(不计入水印分母,改由 provenance-ledger P8 审计)`,
)
if (exclusion.notes.length) {
  for (const n of exclusion.notes) console.warn(`[watermark-coverage] NOTE 排除面: ${n}`)
}
if (exclusion.unresolvedRoots.length) {
  console.warn(
    `[watermark-coverage] NOTE 台账登记了而当前清单里没有的 root ${exclusion.unresolvedRoots.length} 条(归 provenance-ledger P1 问责): ${exclusion.unresolvedRoots.join(', ')}`,
  )
}

// ---------- 双横幅(重复版权头)巡检:warn-only,不计入退出码 ----------
// 2026-09-22 实测:injectFile 旧版只在"见到载荷标记"时才清洗 ⇒ 已有裸横幅(无载荷)的文件
// 被前置一条新横幅,之后恒 skip-done ⇒ 重复头永久冻结,而"有载荷即完好"的判据看不见它。
// 工具已修(横幅文本存在即先清洗);这里把残留量显式报出来,便于后续下调到 0 再升 blocking。
const CANON_BANNER = /^\/\/ © \d{4} IHUI AI \(智汇AI\) · 版权所有者:/gm
let dupBanner = 0
const dupSamples = []
for (const f of tracked) {
  if (!/\.(ts|tsx|js|mjs|cjs|css)$/.test(f)) continue
  // 已登记第三方内容不参与"双横幅"巡检:本项统计的是**我方文件重复打了几个头**,
  // 而"第三方文件上出现了我方横幅"是另一件事,由 provenance-ledger P8 独立判红。
  // 两个判据不重叠,也不留空档 —— 这里少算的那一类正是 P8 的全部射程。
  if (exclusion.isExcluded(f)) continue
  let text
  try {
    text = readFileSync(join(REPO_ROOT, f), 'utf8')
  } catch {
    continue
  }
  const n = (text.match(CANON_BANNER) || []).length
  if (n > 1) {
    dupBanner += 1
    if (dupSamples.length < 5) dupSamples.push(`${f}(×${n})`)
  }
}
if (dupBanner > 0) {
  console.log(
    `[watermark-coverage] ⚠️ 双横幅文件 ${dupBanner} 个(warn,不阻塞;修复:node scripts/watermark.mjs clean <f> && inject <f>)`,
  )
  console.log(`   样例: ${dupSamples.join(', ')}`)
}

if (missing.length === 0) {
  console.log('[watermark-coverage] ✅ 已跟踪文件水印完整(其余为未跟踪本地产物,不计入)')
  process.exit(0)
}

// ---------- 纯判定模式(CI / 审计): 不修改任何文件 ----------
if (NO_FIX) {
  reportGap(missing, '(会导致 CI 红)')
  process.exit(1)
}

// ---------- 自愈模式(pre-commit 默认) ----------
if (missing.length > MAX_AUTOFIX) {
  reportGap(missing, `(超过自愈上限 ${MAX_AUTOFIX}, 拒绝自动回写)`)
  console.error('')
  console.error(`  ⚠️ 单次缺口 ${missing.length} 个 > 上限 ${MAX_AUTOFIX}: 疑似批量改写事故。`)
  console.error('     请先排查改写来源(文本级 sed/prettier/生成器), 再整体重注入:')
  console.error('     node scripts/watermark.mjs inject')
  process.exit(1)
}

console.log(`[watermark-coverage] 🔧 检出 ${missing.length} 个文件水印缺失/损坏, 自动补齐中...`)
for (const f of missing) {
  try {
    run('node', ['scripts/watermark.mjs', 'inject', f])
  } catch (e) {
    console.warn(`  ⚠️ ${f} 注入失败: ${String(e.message || e).split('\n')[0]}`)
  }
}

// 回读校验: 注入后必须彻底达标(不信任"命令返回 0"这一层)
const stillMissing = listUncovered().filter((f) => tracked.has(f) && !exclusion.isExcluded(f))
if (stillMissing.length > 0) {
  reportGap(stillMissing, '(自愈后仍不达标)')
  console.error('')
  console.error('  ⚠️ 自动补齐未能达标: 该文件类型可能不可注入, 或载荷被结构性破坏。')
  console.error('     请按上方清单手动排查后重试。')
  process.exit(1)
}

// 同步暂存区: 否则提交的仍是"未加水印"的旧 index blob(注入只改了工作区)
try {
  execFileSync('git', ['add', '--', ...missing], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
    windowsHide: true,
  })
} catch (e) {
  console.error('[watermark-coverage] ⚠️ git add 同步暂存区失败:', String(e.message || e))
  console.error('     注入已写入工作区, 请手动 `git add` 后重试提交。')
  process.exit(1)
}

console.log(
  `[watermark-coverage] ✅ 已自动补齐 ${missing.length} 个文件的水印并加入暂存区(无需再跳过门禁):`,
)
for (const f of missing.slice(0, 30)) console.log('  - ' + f)
if (missing.length > 30) console.log(`  ... 其余 ${missing.length - 30} 个`)
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
