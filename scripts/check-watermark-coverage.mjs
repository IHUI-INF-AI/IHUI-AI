#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 溯源署名覆盖守门(blocking, 2026-09-12 升级为**自愈式**;2026-09-28 随 v2 收口改判据)
 *
 * 背景: CI 的 `node scripts/watermark.mjs verify` 要求所有可注入源文件携带**可见署名横幅**。
 * 历史两次翻车:
 *   ① 新增文件未注入水印 -> 本地提交通过、CI 红(Provenance watermark check);
 *   ② 生成器/文本级改写把已跟踪文件的横幅弄丢 -> 门禁**恒红**,
 *      而当时工具无法复现自己强制的版式,导致只能靠 `HUSKY_SKIP_WATERMARK_GUARD=1` 绕过提交。
 *
 * 2026-09-12 根治(不再依赖"每个生成器自觉注入"):
 *   门禁自身具备**自愈能力** —— 检出缺口后自动 `clean + inject` 回写, 并同步 `git add` 到暂存区,
 *   使"未加水印的文件进入提交"这一状态在结构上不可能发生; 无论文件是被谁(生成器/脚本/sed)改写出来的。
 *   生成器自带注入(如 apps/miniapp-taro/scripts/gen-i18n-compressed.mjs)仍保留, 属"更早一步"的优化,
 *   不再是唯一防线。
 *
 * 判定口径(v2): `watermark.mjs list-uncovered` = **只有 `missing` 一档进这份清单** ∩ 分母集合
 *   分母集合 = 已跟踪 ∪ 未跟踪但未忽略(唯一实现:`scripts/lib/watermark-scope.mjs`)。
 *   2026-09-27 G-253 并上未跟踪面:此前"只看已跟踪"把两格真实缺口挡在分母之外 ——
 *   新建还没 `git add` 的文件、以及**整文件重写把已跟踪文件的横幅冲掉后尚未 add** 的那一格。
 *   两格的失效形态相同:闸门一路绿灯,而盘上真有一个无水印的源文件等着进仓库。
 *   `.gitignore` 依旧把构建产物与本机临时面挡在分母外(`--exclude-standard`),
 *   所以"本地未跟踪产物不计入"这句原口径没有被放宽 —— 放宽的只是"注定要提交的那部分"。
 *
 * ⚠️ **v1 零宽载荷 = 待升级,不是缺口,也不得被自愈**。这一条是本门随 v2 收口的全部理由:
 *   旧形态在 HEAD 面覆盖 11,511 个文件。若把它算进缺口,后果有两型,都不可接受 ——
 *     · 判红:一台与任何提交都无关的恒红门 ⇒ 每个并行会话各走一次应急跳门 ⇒ 约 190 道
 *       守门对该提交整体作废(AGENTS §12e 反复记过这一型);
 *     · 自愈:`MAX_AUTOFIX=200` 的安全闸当场拒绝(11k > 200),于是**每一次**提交都被
 *       这台与本次改动无关的红门挡住 —— 与判红同结局,而且注入动作本身会在别人的提交里
 *       顺手做一次全仓改写。
 *   所以全仓剥离只能是**一次性、单独落地、由人挑时机**的动作
 *   (`node scripts/watermark-strip-payload.mjs --dry-run` → `--apply`),不是提交链的副产品。
 *   本门对它只做一件事:**把数量与出口喊出来**(见下方 `#watermark-stats` 解析),不判红、
 *   不写盘、不 `git add`。
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
import { coverageFileSet } from './lib/watermark-scope.mjs'

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

/**
 * watermark.mjs list-uncovered → **缺口清单(missing 一档)** + 一行 `#watermark-stats` 统计。
 *
 * v2 起旧形态(v1 零宽载荷)**不在这份清单里**:它既不该被自愈注入(那等于在别人的提交里
 * 顺手做全仓改写),也不该判红(恒红门 ⇒ 全队跳门 ⇒ 约 190 道守门作废,§12e)。
 * 统计行与清单同轮同面产出:为了让"还剩多少待升级"这句话有实数可喊,而不必为它再全量扫
 * 一遍 11.5k 文件(两次扫描之间仓库可能已被并发会话推进 ⇒ 判据输入被拆成两个时刻)。
 */
function listUncovered() {
  try {
    const raw = run('node', ['scripts/watermark.mjs', 'list-uncovered'])
    let stats = null
    const gaps = []
    for (const line of raw.split('\n')) {
      const l = line.trim()
      if (!l) continue
      if (l.startsWith('#watermark-stats ')) {
        try {
          stats = JSON.parse(l.slice('#watermark-stats '.length))
        } catch {
          console.warn(
            '[watermark-coverage] ⚠️ 统计行解析失败 ⇒ 待升级只报"未判定",不猜数:' + l.slice(0, 120),
          )
        }
        continue
      }
      if (l.startsWith('#')) continue
      gaps.push(l)
    }
    return { gaps, stats }
  } catch (e) {
    console.error('[watermark-coverage] 无法获取未覆盖清单:', e.message)
    process.exit(1)
  }
}

function trackedFiles() {
  // G-253:口径与 watermark.mjs 共用 scripts/lib/watermark-scope.mjs 那一份实现。
  // 返回**两层**集合:indexFiles(可阻塞面)/ untrackedFiles(只报数面)。
  const scope = coverageFileSet({ root: REPO_ROOT })
  if (scope.error) {
    console.error(`[watermark-coverage] ❌ ${scope.error}`)
    console.error('  取不到清单时**不**按"没有缺口"放行 —— 那等于把"没判"写成"判过了"。')
    process.exit(1)
  }
  return scope
}

function reportGap(missing, reason) {
  console.error(`[watermark-coverage] ❌ ${missing.length} 个已跟踪文件缺少可见署名横幅${reason}:`)
  for (const f of missing.slice(0, 30)) console.error('  - ' + f)
  if (missing.length > 30) console.error(`  ... 其余 ${missing.length - 30} 个`)
  console.error('')
  console.error('  手动修复(只补缺口,不动已升级文件): node scripts/watermark.mjs inject <file>')
  console.error('            node scripts/watermark.mjs list-uncovered   # 列出全部缺口')
  console.error('  紧急跳过: HUSKY_SKIP_WATERMARK_GUARD=1 git commit ...')
}

const scope = trackedFiles()
const indexSet = new Set(scope.indexFiles)
const denominator = new Set(scope.files)
const { gaps: uncovered, stats } = listUncovered()
// 双保险:排除面已由 watermark.mjs 的 scanCoverage 用同一个谓词移出分母,这里再筛一次 ——
// 若哪天有人只改了一侧,本门要么把横幅打进第三方内容(自愈侧),要么恒红(判定侧)。
// 被这里筛掉的即为"两侧谓词不一致"的证据,必须喊出来,不得静默(静默 = 下一次只有一侧在防)。
const inDenominator = uncovered.filter((f) => denominator.has(f) && !exclusion.isExcluded(f))
// 只有**索引里**的那批可以判红/自愈:未跟踪面里挂着别人在飞的源文件,
// 判红 = 与本次提交无关的恒红门(各会话只好 --no-verify,连带全部守门作废),
// 自动注入 = 往别人的未提交文件里写字并 git add 别人的东西(污染 + 越权两型)。
const missing = inDenominator.filter((f) => indexSet.has(f))
const untrackedGaps = inDenominator.filter((f) => !indexSet.has(f))
const drift = uncovered.filter((f) => indexSet.has(f) && exclusion.isExcluded(f))
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

// ---------- v1 零宽载荷:待升级只报数,不判红、不自愈 ----------
// 这一段的全部作用是"让数量与出口可见"。缺了它,11k 个带隐写字符的文件在账面上与
// "已经干净"长得一模一样 —— 而"把没判写成判过了"是本仓最高频的失效型。
{
  const legacy = (stats?.legacy ?? 0) + (stats?.legacyCorrupt ?? 0)
  if (!stats) {
    console.warn(
      '[watermark-coverage] ⚠️ 未拿到 watermark 统计行 ⇒ 旧形态(v1 零宽载荷)剩余量**未判定**,' +
        '不得据此认为已清完(核验:`node scripts/watermark.mjs verify`)',
    )
  } else if (legacy > 0) {
    console.log(
      `[watermark-coverage] ℹ️ 旧形态待升级 ${legacy} 个文件仍带零宽隐写载荷` +
        `(其中载荷损坏 ${stats.legacyCorrupt} 个;口径内零宽字符合计 ${stats.zwTotal} 个)—— ` +
        `**不计入退出码、不自动回写**:全仓剥离是一次性、单独落地、由人挑时机的动作,`,
    )
    console.log(
      `   出口:node scripts/watermark-strip-payload.mjs --dry-run  →  --apply` +
        `(逐文件亦可:node scripts/watermark.mjs inject <file> 会把该文件升级为 v2)`,
    )
  } else {
    console.log(
      `[watermark-coverage] ✅ v1 零宽载荷已清零(纳入口径 ${stats.total} 个文件均为 v2 可见署名)`,
    )
  }
}

// ---------- 双横幅(重复版权头)巡检:warn-only,不计入退出码 ----------
// 2026-09-22 实测:injectFile 旧版只在"见到载荷标记"时才清洗 ⇒ 已有裸横幅(无载荷)的文件
// 被前置一条新横幅,之后恒 skip-done ⇒ 重复头永久冻结,而"有载荷即完好"的判据看不见它。
// 工具已修(横幅文本存在即先清洗);这里把残留量显式报出来,便于后续下调到 0 再升 blocking。
const CANON_BANNER = /^\/\/ © \d{4} IHUI AI \(智汇AI\) · 版权所有者:/gm
let dupBanner = 0
const dupSamples = []
for (const f of scope.indexFiles) {
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

if (untrackedGaps.length > 0) {
  // 只报数、不判红、不代写:那批文件属别人在飞的现场(见文件头 G-253 那段)。
  // 但必须**喊出来** —— 否则"分母并上了未跟踪面"这件事与没做只差一行日志。
  console.log(
    `[watermark-coverage] ℹ️ 未跟踪面上另有 ${untrackedGaps.length} 个缺水印的源文件` +
      `(**不计入退出码、不自动往别人未提交的文件里写字**):` +
      untrackedGaps.slice(0, 5).join(', ') +
      (untrackedGaps.length > 5 ? ` … 其余 ${untrackedGaps.length - 5} 个` : ''),
  )
  console.log(
    '   出口:各自作者在被提交/落地前跑 `node scripts/watermark.mjs inject <file>`;' +
      '旁路提交由 scripts/object-space-land.mjs 兜(它拒绝落地无有效横幅的声明路径)。',
  )
}

if (missing.length === 0) {
  console.log(
    '[watermark-coverage] ✅ 已跟踪文件署名横幅完整(未跟踪产物不计入,见上;v1 载荷是否清完看上方待升级那一行)',
  )
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

console.log(`[watermark-coverage] 🔧 检出 ${missing.length} 个文件缺少可见署名横幅, 自动补齐中...`)
for (const f of missing) {
  try {
    run('node', ['scripts/watermark.mjs', 'inject', f])
  } catch (e) {
    console.warn(`  ⚠️ ${f} 注入失败: ${String(e.message || e).split('\n')[0]}`)
  }
}

// 回读校验: 注入后必须彻底达标(不信任"命令返回 0"这一层)
const stillMissing = listUncovered().gaps.filter((f) => indexSet.has(f) && !exclusion.isExcluded(f))
if (stillMissing.length > 0) {
  reportGap(stillMissing, '(自愈后仍不达标)')
  console.error('')
  console.error(
    '  ⚠️ 自动补齐未能达标: 该文件类型可能不可注入(扩展名不在映射表), 或横幅清洗反复失败。',
  )
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
  `[watermark-coverage] ✅ 已自动补齐 ${missing.length} 个文件的署名横幅并加入暂存区(无需再跳过门禁):`,
)
for (const f of missing.slice(0, 30)) console.log('  - ' + f)
if (missing.length > 30) console.log(`  ... 其余 ${missing.length - 30} 个`)
process.exit(0)
