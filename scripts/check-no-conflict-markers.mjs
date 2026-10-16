#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-no-conflict-markers.mjs
/**
 * 守门 79:提交内容含 Git 冲突标记(blocking)。
 *   (编号让号留痕:本门立项时占了 77,而 77 同时被 `check-radius-single-source` 使用,
 *    2026-09-24 由后落地方让号至 79 —— 见 `scripts/guardian-runner.mjs` 的 id 唯一性自检注释。
 *    本文旧版通篇仍写 77,G-588 收紧时按 runner 注册条目现值改正。)
 *
 * 起因(2026-09-23 实测,不是假想):本机 `.git` 于 15:49 被宿主清除,恢复期间某个会话
 *   在**共享工作区**里跑了真实 `git merge`,留下 103 个未合并路径、94 个工作区文件带字面
 *   冲突标记。而全链 100+ 道守门里**没有任何一道**拦"被提交的内容含冲突标记",于是带
 *   `<<<<<<<` / `>>>>>>>` 的文件一路走到 HEAD 树,整个 merge 结束都没被任何门发现。
 *   本门补这个缺口:**成对**的冲突标记一旦进入"将要被提交的内容 / 指定 rev 的树 / 全工作区
 *   跟踪文件",立即红并点名文件 + 行号。
 *
 * 判据(务必按此理解,别放宽也别收紧):
 *   P1 违规 = 同一文件内**成对**出现 `^<<<<<<< `(行首 7 个小于号 + 空格)与 `^>>>>>>> `
 *      (行首 7 个大于号 + 空格),中间允许夹 `^=======$`(整行恰好 7 个等号)。
 *   P2 强制成对,单行不判:`=======` 在 Markdown setext 标题下划线、表格分隔、ASCII 示意图里
 *      都是合法内容,只判单行会满天假红 —— 实测全仓 `^=======$` 命中远多于成对命中。
 *   P3 未配对的开始/结束标记**默认不计红**,但如实报数(它们是"标记被手删了一半"的强信号,
 *      而"手删标记当作已解决"正是本门要禁掉的动作)。
 *   P4(G-588,2026-10-16 收紧)**带 `ours|theirs|HEAD` 词尾的孤立标记升为判红** —— 判据吃的是
 *      `findMarkerPairs` 已经算出来的 `unpairedStarts/unpairedEnds`,不在本文件另扫一遍行。
 *      为什么只升这一族:那三种写法(`<<<<<<< HEAD` / `<<<<<<< ours` / `>>>>>>> theirs` 等)在
 *      Markdown 里没有任何合法用途 —— setext 下划线、表格分隔、ASCII 示意图都写不出带词尾的
 *      尖括号行,所以升档不会造出与提交内容无关的恒红面(§12e)。而**孤立的 `=======`、以及
 *      不带 ours/theirs/HEAD 词尾的孤立尖括号维持 P3 只报数**:P2 那条单行假阳风险正是为它们
 *      立的,把它们一并改成判红就是本票明令禁止的出路。
 *      收紧前置(先清偿再收紧)由 G-588 达成:真仓 HEAD 面带词尾的孤立标记现读 = 0。
 *      E1 的 SEARCH/REPLACE 豁免族(`>>>>>>> REPLACE`)不属于 P4:词尾不在名单内。
 *
 * 三种模式:
 *   --staged         pre-commit(runner 自动下发):只判**索引内容**(`git show :<path>`),
 *                    取不到再退回读工作区文件。理由:真正会被提交的是索引,不是磁盘 ——
 *                    磁盘上"已经改好了"而索引里还是脏内容,提交出去依然是脏内容。
 *   缺省(全量审计) 判所有 **git 跟踪文件的工作区内容**(`git ls-files`),不扫 node_modules /
 *                    .git / 未跟踪文件(未跟踪内容不会被提交,拦它只会逼人 --no-verify)。
 *   --rev <sha|HEAD> 判某个提交树(候选文件用 `git grep -Il -- "^<<<<<<< " <rev>` 定位,再逐个
 *                    取 blob 复核成对),供事后核验与本脚本 self-test 使用。
 *
 * 护栏:
 *   G1 自豁免:本脚本与其测试文件必然含这些字面量,按文件名前缀跳过 —— 跳过项**在输出里如实
 *      计数说明**,不静默吞掉。
 *   G2 大文件:单文件 >2MB **且不含任何标记线索**时跳过并计数(位图、锁文件、压缩产物等不是
 *      "手写冲突"的载体)。**含标记线索的大文件一律照判** —— `PROJECT_PLAN.md` 常年 >2MB,
 *      旧版那条"体积优先"把多会话唯一会真撞车的文件挡在射程外(2026-09-28 实测被自动归档
 *      提交带进台账那一枚,本门对它报绿),次序因此改成"先问有没有线索,再谈体积"。
 *   G3 二进制:前 8KB 含 NUL 字节即跳过并计数(二进制里偶然出现的字节序列不该判红)。
 *   G4 git 解析不到(候选全失败)按脚本自身异常 exit 2,绝不静默放行。
 *
 * 用法:
 *   node scripts/check-no-conflict-markers.mjs [--staged]
 *   node scripts/check-no-conflict-markers.mjs --rev HEAD
 *   node scripts/check-no-conflict-markers.mjs --self-test
 * 退出码:0 通过 / 1 检出成对标记(P1)或带 ours/theirs/HEAD 词尾的孤立标记(P4) / 2 脚本自身异常。
 * 紧急跳过:HUSKY_SKIP_CONFLICT_MARKERS=1 git commit ...(确属有意保留标记的内容,请先把它放进
 *   字符串字面量或转义,而不是靠跳过守门)
 *
 * 当前接入:guardian-runner id '79',blocking,不设 stagedTriggers(全量/索引扫描本身就是判据面)。
 *
 * 判据住在哪儿(2026-09-28 收口):**配对判据与「剥三行」判据只有一份实现**,在
 *   `scripts/lib/conflict-marker-triples.mjs`。本文件 import 再 re-export,不另写一份正则。
 *   消费者按现读只有两处(2026-10-16 核):本门(判红)与 `archive-completed-tasks.mjs`
 *   (搬运前问一句 —— `grep -n findMarkerPairs scripts/archive-completed-tasks.mjs` 现值)。
 *   旧版本此处还写了第三个 `union-converge.mjs`,那是条不成立的声明:该器自己调
 *   `git merge-file`,通篇不 import 这份判据(它因此把"剥三行"这一维留成了自己的盲区,
 *   `stripMarkerTriples` 目前在 scripts/ 面零消费者 —— 记下而不据此删函数,那是另一票)。
 *   两处各写一遍必漂,是本仓记过最多次的失败型。
 *   P4(G-588)新增的只有"孤立标记里哪一族升判红"这一份词尾名单(`ORPHAN_JUDGED_RE`,经 `__test__`
 *   供镜像测试 import,**不在测试里再抄一遍**),它吃的配对结果仍是上面那一份实现 ——
 *   "什么算孤立"只问一次,不允许本门与 lib 各扫一遍行。
 */
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveGitBin } from './lib/gitdir.mjs'
// 配对判据的唯一实现(见头注"判据住在哪儿")。本文件只 re-export,不再各写一份正则。
import { findMarkerPairs } from './lib/conflict-marker-triples.mjs'

export {
  findMarkerPairs,
  isPatchFormatPair,
  PATCH_OPEN,
  PATCH_CLOSE,
} from './lib/conflict-marker-triples.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const SKIP_ENV = 'HUSKY_SKIP_CONFLICT_MARKERS'
/** G2 大文件上限:超过即跳过并计数。 */
export const MAX_BYTES = 2 * 1024 * 1024
/** G1 自豁免前缀:本脚本 + 其测试文件(必然含标记字面量)。 */
export const SELF_EXEMPT_PREFIX = 'check-no-conflict-markers'
/** 违规清单里每行最多展示的字符数。 */
export const SNIPPET_CHARS = 60

/** 大文件预筛用的字节针(内容判据在共用层,这里只留"要不要把这份内容拿去判"的快速问句)。 */
const OPEN_NEEDLE = Buffer.from('<<<<<<< ', 'latin1')
const END_NEEDLE = Buffer.from('>>>>>>> ', 'latin1')
/**
 * P4(G-588,2026-10-16 收紧):**带 `ours|theirs|HEAD` 词尾的孤立标记**判红。
 * 只升这一族的理由是"它在 Markdown 里没有任何合法写法":setext 下划线、表格分隔、ASCII 示意图
 * 都可能产出孤立 `=======` 或裸尖括号行,而 `>>>>>>> theirs` / `<<<<<<< HEAD` 只会是"合并标记
 * 被手删了一半"。孤立 `=======` 与不带词尾的孤立尖括号**维持只报数**(头注 P2 的单行假阳风险
 * 正是为它们立的)—— 这个不对称是刻意的,不是漏;把它整档改成判红就是本票明令禁止的恒红门出路。
 */
const ORPHAN_JUDGED_RE = /^(?:<{7}|>{7}) (?:ours|theirs|HEAD)\b/

// ── git 派生:绝对路径候选解析(服务账户无 PATH 时 'git' 会失败)+ 强制 windowsHide(守门 52) ──
let _gitBin = undefined
export function gitBin() {
  if (_gitBin === undefined) _gitBin = resolveGitBin()
  return _gitBin
}

function git(args, opts = {}) {
  const bin = gitBin()
  if (!bin) throw new Error('git 可执行文件候选解析全部失败 —— 判据无法执行(按脚本异常处理)')
  return execFileSync(bin, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    ...opts,
    windowsHide: true,
    // EBUSY 根治(errno -4082):调用点全为只读 git(ls-files / show),不喂 stdin。
    // stdio 写在 ...opts **之后**:本门两个多参数调用点自己传的也是 stdio[0]='ignore'
    // (取 buffer 用),覆盖后形态一致;若哪天有调用方要喂 stdin,必须先在这里加两态判据。
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/**
 * 路径清单专用:git 输出的是 UTF-8 字节,Node 按 utf8 解码才不丢中文文件名
 * (用 encoding:'latin1' 会让非 ASCII 路径变成乱码,后续 `git show :<path>` 与 readFileSync
 * 双双取不到内容 → 该判的文件被当成"取不到"跳过 = 静默漏判)。
 */
function gitPathList(args) {
  const buf = git(args, { encoding: 'buffer', stdio: ['ignore', 'pipe', 'ignore'] })
  return buf.toString('utf8')
}

// ══════════════ 纯函数层(零副作用,经 __test__ 供 §22c 镜像测试直接 import) ══════════════

/**
 * G1 自豁免判定:只看文件名前缀(路径可能是 `scripts/x.mjs` 或 `scripts/tests/x.test.mjs`,
 * 也可能带 Windows 反斜杠),不做内容猜测。
 */
export function isSelfExempt(path) {
  const norm = String(path || '').replace(/\\/g, '/')
  const name = norm.slice(norm.lastIndexOf('/') + 1)
  return name.startsWith(SELF_EXEMPT_PREFIX)
}

/**
 * 核心判据 P1/P2/P3 的唯一实现已收进 `scripts/lib/conflict-marker-triples.mjs`
 * (配对语义、E1 的 SEARCH/REPLACE 豁免依据、以及"只剥成套三行"的边界都写在那一份头注里)。
 * 本文件在顶部 import 再 re-export,既有调用方(`archive-completed-tasks.mjs`、本门镜像测试)
 * 的导入路径一字不改地继续可用 —— 判据只有一份,不再两处各写一遍正则。
 */

/** G3 二进制判定:前 8KB 出现 NUL 字节即视为二进制。 */
export function looksBinary(buf) {
  const n = Math.min(buf.length, 8192)
  for (let i = 0; i < n; i += 1) if (buf[i] === 0) return true
  return false
}

/**
 * 单文件判定(纯函数 + 计数副作用写进 stats)。
 * 返回 violations(成对标记数组);跳过原因只累加计数,由汇总行如实打印。
 *
 * ⚠️ **体积护栏不得挡在"文件里确实有标记线索"之前**(2026-09-28 实测的自盲):
 * `MAX_BYTES` 的本意是"位图 / 锁文件 / 压缩产物不是手写冲突的载体",而 `PROJECT_PLAN.md`
 * 长期 >2MB —— 恰是多会话唯一会真撞在一起的那份文件。实测枚 `b54c79c36`(自动归档提交)
 * 把带 `<<<<<<< ours` 的工作树副本提交进台账,而本门对那一枚报"未检出成对标记",
 * 汇总行里的 `跳过 >2MB 大文件=1` 就是它唯一的痕迹(没人读)。所以次序改成:
 * **先用两次 `buf.includes(needle)` 问"有没有标记线索"(快、零字符串化),没有才按体积跳过;
 * 有标记线索的文件无论多大都必须判**(配对逻辑只跑在标记行上,不是整文件正则)。
 */
export function judgeBuffer(path, buf, stats) {
  if (isSelfExempt(path)) {
    stats.selfExempt += 1
    return []
  }
  if (looksBinary(buf)) {
    stats.binary += 1
    return []
  }
  const big = buf.length > MAX_BYTES
  const hasNeedle = buf.includes(OPEN_NEEDLE) || buf.includes(END_NEEDLE)
  if (big && !hasNeedle) {
    // 护栏只放过"又大又没有标记线索"的文件(位图 / 压缩产物 / minified js)。
    stats.tooLarge += 1
    return []
  }
  if (big) stats.largeWithMarkers += 1
  stats.judged += 1
  if (!hasNeedle) return []
  const { pairs, unpairedStarts, unpairedEnds, exempt } = findMarkerPairs(buf.toString('utf8'))
  stats.unpairedStarts += unpairedStarts.length
  stats.unpairedEnds += unpairedEnds.length
  stats.patchFormatExempt += exempt.length
  // 孤立标记的判据**必须吃 findMarkerPairs 那一份配对结果**(验收③):在这里再扫一遍行,
  // 就会与成对判据在"什么算未配对"上漂开,而漂开的表现是同一份内容两道判据各说各话。
  const orphans = []
  for (const u of [...unpairedStarts, ...unpairedEnds]) {
    if (!ORPHAN_JUDGED_RE.test(String(u.text ?? ''))) continue
    orphans.push({ path, kind: 'orphan', startLine: u.line, startText: u.text })
    stats.orphanJudged += 1
  }
  const out = [...pairs.map((p) => ({ path, kind: 'pair', ...p })), ...orphans]
  if (out.length === 0) return []
  stats.filesWithViolations += 1
  return out
}

export function newStats() {
  return {
    judged: 0,
    filesWithViolations: 0,
    selfExempt: 0,
    tooLarge: 0,
    /** >2MB **且**含标记线索的文件数:这些不被护栏挡掉,必须如实报出"照判了"。 */
    largeWithMarkers: 0,
    binary: 0,
    unreadable: 0,
    unpairedStarts: 0,
    unpairedEnds: 0,
    /** P4:其中"带 ours|theirs|HEAD 词尾"而被判红的孤立标记数(与上面两项并列报,不互相顶名额)。 */
    orphanJudged: 0,
    patchFormatExempt: 0,
  }
}

function snippet(line) {
  const s = String(line).replace(/\s+/g, ' ').trim()
  return s.length > SNIPPET_CHARS ? `${s.slice(0, SNIPPET_CHARS)}…` : s
}

/** 违规清单 + 汇总 + 修复指引(三种模式共用一份渲染,避免结论漂移)。 */
export function render(modeLabel, totalPaths, violations, stats) {
  const lines = [`🔀 冲突标记守门(${modeLabel}):判定 ${stats.judged} 个内容源(候选 ${totalPaths})`]
  // 两型必须分开报数(G-588 验收②的可读面):合成一句"检出 N 对"会把 P4 的孤立标记
  // 伪装成成对标记,读的人会去找那条并不存在的 >>>>>>> 闭合行。
  const pairItems = violations.filter((v) => v.kind !== 'orphan')
  const orphanItems = violations.filter((v) => v.kind === 'orphan')
  if (violations.length > 0) {
    lines.push(
      `❌ 检出 Git 冲突标记:成对 ${pairItems.length} 对 / 孤立带词尾 ${orphanItems.length} 处(P1/P4),分布在 ${stats.filesWithViolations} 个文件:`,
    )
    for (const v of violations.slice(0, 40)) {
      if (v.kind === 'orphan') {
        lines.push(
          `   - ${v.path}:${v.startLine}  |  ${snippet(v.startText)}  ⟵ 孤立标记(只剩一半;P4:带 ours/theirs/HEAD 词尾判红)`,
        )
        continue
      }
      lines.push(`   - ${v.path}:${v.startLine}  |  ${snippet(v.startText)}`)
      if (v.sepLine) lines.push(`       ${v.path}:${v.sepLine}  |  ${'='.repeat(7)}`)
      lines.push(`       ${v.path}:${v.endLine}  |  ${snippet(v.endText)}`)
    }
    if (violations.length > 40) lines.push(`   ... 另有 ${violations.length - 40} 项`)
    lines.push('')
    lines.push(
      '   修复:用 `git checkout --theirs/--ours <文件>` 取一侧真实内容,或按 AGENTS.md §12b 协作收尾',
    )
    lines.push(
      '   重新归并;**禁止手删 <<<<====>>>> 三行标记当作已解决**(那会把两侧代码之一静默丢掉)。',
    )
    if (orphanItems.length > 0) {
      lines.push(
        '   孤立那一型:先查是哪一次并发改动把另一半吃掉(`git log -S\'>>>>>>> \'<file>`),按上面同一条归并取回完整内容;' +
          ' 若这份内容本就是"逐字留档的合并残留"(归档件/台账),同样不许只删标记 —— 要么整段按原样取回,要么走 §1 两步归档。',
      )
    }
  } else {
    lines.push('✅ 未检出成对 Git 冲突标记(P1),也没有带 ours/theirs/HEAD 词尾的孤立标记(P4)')
  }
  const skips = [
    stats.selfExempt > 0 ? `自豁免(本门自身与测试文件,判据含字面量)=${stats.selfExempt}` : '',
    stats.tooLarge > 0 ? `跳过 >2MB 且无标记线索的大文件=${stats.tooLarge}` : '',
    stats.largeWithMarkers > 0
      ? `>2MB 但含标记线索 ⇒ 照判不误=${stats.largeWithMarkers}`
      : '',
    stats.binary > 0 ? `跳过二进制=${stats.binary}` : '',
    stats.unreadable > 0 ? `取不到内容=${stats.unreadable}` : '',
    stats.patchFormatExempt > 0
      ? `E1 合法豁免 SEARCH/REPLACE 补丁格式对=${stats.patchFormatExempt}(本仓 CLI patch 语法与之同形,见 apps/cli/src/tools/file-edit.ts)`
      : '',
  ].filter(Boolean)
  if (skips.length) lines.push(`   跳过计数:${skips.join(' · ')}(均为如实计数,非静默)`)
  const unpaired = stats.unpairedStarts + stats.unpairedEnds
  if (unpaired > 0) {
    lines.push(
      `   ⚠️ 另有未配对标记 ${stats.unpairedStarts} 处孤立 \`<<<<<<<\` / ${stats.unpairedEnds} 处孤立 \`>>>>>>>\` —— 其中带 ours/theirs/HEAD 词尾的 ${stats.orphanJudged} 处已按 P4 判红(见上方清单),剩下的按 P2/P3 只报数不计红;"只剩一半"通常意味着标记被手删,请人工确认`,
    )
  }
  return lines
}

// ══════════════ 三种模式的取材 ══════════════

/**
 * 暂存区路径(A/C/M/R 有内容可判;U = 未合并路径必须纳进来 —— 真实 merge 冲突时 git 把该文件
 * 标为 unmerged,只按 ACMR 过滤会恰好漏掉本门要拦的那一类)。删除态无内容,不判。
 * `-z` 避免路径转义歧义。
 */
export function stagedPaths(repoRoot) {
  return gitPathList([
    '-C',
    repoRoot,
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=ACMRTU',
    '-z',
  ])
    .split('\0')
    .filter(Boolean)
}

/** 索引 blob;取不到(未合并态 stage 1/2/3、或已从索引删除)返回 null,调用方退回工作区。 */
function readIndexBlob(repoRoot, rel) {
  try {
    return git(['-C', repoRoot, 'show', `:${rel}`], {
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return null
  }
}

function readWorktreeFile(repoRoot, rel) {
  try {
    return readFileSync(join(repoRoot, rel))
  } catch {
    return null
  }
}

/** 全量模式的候选:git 跟踪文件(未跟踪内容不会被提交,不判)。 */
export function trackedPaths(repoRoot) {
  return gitPathList(['-C', repoRoot, 'ls-files', '-z']).split('\0').filter(Boolean)
}

/**
 * rev 模式的候选:先按行首标记针定位含标记的 blob(-I = 跳二进制,-z = `rev\0path\0` 无歧义),
 * 再逐个取 blob 复核(P1 成对 / P4 孤立)。
 *
 * **两枚针都必须下**(G-588 收紧时补的洞):旧实现只 grep `^<<<<<<< `,于是"只有闭合行、
 * 开始行已被手删"的文件在 rev 档**根本进不了候选清单** —— 那正是本票的立项现场(归档件里
 * `>>>>>>> theirs` 成段残留)。判据升到 P4 却仍用单针候选,等于把新判据挂在一个看不见它的面上。
 */
const REV_CANDIDATE_NEEDLES = ['^<<<<<<< ', '^>>>>>>> ']

export function revCandidatePaths(repoRoot, rev) {
  const found = new Set()
  const prefix = `${rev}:`
  for (const needle of REV_CANDIDATE_NEEDLES) {
    let out = ''
    try {
      out = gitPathList(['-C', repoRoot, 'grep', '-Ilz', '--', needle, rev])
    } catch (e) {
      // git grep 无命中时以 exit 1 结束(不是错误);其他失败码才是真异常
      const status = e && typeof e === 'object' && 'status' in e ? e.status : undefined
      if (status === 1 && !String(e?.stderr ?? '').includes('fatal')) continue
      throw e
    }
    for (const l of out.split('\0').filter(Boolean)) {
      found.add(l.startsWith(prefix) ? l.slice(prefix.length) : l)
    }
  }
  return [...found]
}

function readRevBlob(repoRoot, rev, rel) {
  try {
    return git(['-C', repoRoot, 'show', `${rev}:${rel}`], {
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return null
  }
}

// ══════════════ 审计入口(repoRoot 可注入,供 self-test 用临时仓取证) ══════════════

/** --staged(索引优先)与缺省(全量跟踪文件工作区内容)共用一套流程。 */
export function audit(repoRoot, { staged = false } = {}) {
  const stats = newStats()
  const paths = staged ? stagedPaths(repoRoot) : trackedPaths(repoRoot)
  const violations = []
  for (const rel of paths) {
    let buf = null
    if (staged) {
      buf = readIndexBlob(repoRoot, rel)
      if (buf === null) buf = readWorktreeFile(repoRoot, rel)
    } else {
      buf = readWorktreeFile(repoRoot, rel)
    }
    if (buf === null) {
      if (!isSelfExempt(rel)) stats.unreadable += 1
      continue
    }
    violations.push(...judgeBuffer(rel, buf, stats))
  }
  const label = staged ? 'pre-commit:索引内容' : '全量:跟踪文件工作区内容'
  return {
    code: violations.length > 0 ? 1 : 0,
    lines: render(label, paths.length, violations, stats),
    violations,
    stats,
  }
}

/** --rev <sha|HEAD>:判某个提交树(事后核验)。 */
export function auditRev(repoRoot, rev) {
  const stats = newStats()
  const paths = revCandidatePaths(repoRoot, rev)
  const violations = []
  for (const rel of paths) {
    const buf = readRevBlob(repoRoot, rev, rel)
    if (buf === null) {
      if (!isSelfExempt(rel)) stats.unreadable += 1
      continue
    }
    violations.push(...judgeBuffer(rel, buf, stats))
  }
  return {
    code: violations.length > 0 ? 1 : 0,
    lines: render(`提交树 ${rev}`, paths.length, violations, stats),
    violations,
    stats,
  }
}

// ══════════════ self-test(临时仓端到端取证,不触碰真实仓) ══════════════

function selfTestRun() {
  const results = []
  const check = (name, ok) => results.push({ name, ok: Boolean(ok) })
  const root = mkdtempSync(join(ROOT, '.ihui-agent', 'tmp', 'conflict-markers-drill-'))
  const repo = join(root, 'repo')
  mkdirSync(repo, { recursive: true })
  const g = (args) => git(['-C', repo, ...args])
  try {
    g(['init', '-q', '--initial-branch=main'])
    // 演练仓必须关掉 autocrlf,否则全局配置会改写 LF 并在 stderr 刷噪音
    g(['config', 'core.autocrlf', 'false'])
    g(['config', 'user.email', 't@t'])
    g(['config', 'user.name', 't'])

    // ── 判据纯函数:正反成对用例 ──
    const conflict = [
      'line-a',
      '<<<<<<< HEAD',
      'ours',
      '=======',
      'theirs',
      '>>>>>>> feature/x',
      'line-b',
    ].join('\n')
    const r1 = findMarkerPairs(conflict)
    check(
      '1 成对标记判红(行号 + 分隔线定位正确)',
      r1.pairs.length === 1 &&
        r1.pairs[0].startLine === 2 &&
        r1.pairs[0].endLine === 6 &&
        r1.pairs[0].sepLine === 4,
    )
    check('2 无未配对残留', r1.unpairedStarts.length === 0 && r1.unpairedEnds.length === 0)

    const setext = [
      '# 标题',
      '正文',
      '小节名',
      '=======',
      '另一段',
      '| a | b |',
      '| --- | --- |',
    ].join('\n')
    const r2 = findMarkerPairs(setext)
    check('3 单行 ======= (setext 下划线/表格)判绿 —— 成对才拦', r2.pairs.length === 0)

    const twoPairs = [
      '<<<<<<< HEAD',
      'a',
      '=======',
      'b',
      '>>>>>>> x',
      '',
      '<<<<<<< HEAD',
      'c',
      '=======',
      'd',
      '>>>>>>> y',
    ].join('\n')
    check('4 同文件两对标记分别计 2', findMarkerPairs(twoPairs).pairs.length === 2)

    // E1 真实形态取证:apps/cli/tests/file-edit.test.ts 的夹具里,闭合标记带模板串尾巴
    // (`>>>>>>> REPLACE`;),开始标记在块内才是行首 —— 必须按该原样钉住,否则放宽会过头。
    const patchFixture = [
      "const patch = `<<<<<<< SEARCH",
      'one',
      '=======',
      'ONE',
      '>>>>>>> REPLACE',
      '<<<<<<< SEARCH',
      'three',
      '=======',
      'THREE',
      '>>>>>>> REPLACE`;',
    ].join('\n')
    const rPatch = findMarkerPairs(patchFixture)
    check('4b SEARCH/REPLACE 补丁格式合法豁免(行首那对进 exempt 不进 pairs)', rPatch.pairs.length === 0 && rPatch.exempt.length === 1)
    const mixed = ['<<<<<<< HEAD', 'a', '=======', 'b', '>>>>>>> REPLACE'].join('\n')
    check('4c 混搭端(HEAD 配 REPLACE)不豁免仍判红', findMarkerPairs(mixed).pairs.length === 1)
    const stillBad = ['<<<<<<< HEAD', 'a', '=======', 'b', '>>>>>>> feature/x'].join('\n')
    check('4d 真 merge 标记不受 E1 影响', findMarkerPairs(stillBad).pairs.length === 1)

    const halfDeleted = ['<<<<<<< HEAD', 'a', '=======', 'b'].join('\n')
    const r3 = findMarkerPairs(halfDeleted)
    check(
      '5 只剩一半(无 >>>>>>>)不判红但如实报孤立数',
      r3.pairs.length === 0 && r3.unpairedStarts.length === 1,
    )
    check(
      '6 孤立 >>>>>>> 同样不判红',
      findMarkerPairs(['x', '>>>>>>> y'].join('\n')).pairs.length === 0,
    )
    check(
      '7 CRLF 换行不影响配对判定',
      findMarkerPairs('<<<<<<< HEAD\r\na\r\n=======\r\nb\r\n>>>>>>> y').pairs.length === 1,
    )

    check('8 自豁免命中本门脚本', isSelfExempt('scripts/check-no-conflict-markers.mjs'))
    check(
      '9 自豁免命中本门测试(含反斜杠路径)',
      isSelfExempt('scripts\\tests\\check-no-conflict-markers.test.mjs'),
    )
    check('10 自豁免不误伤普通文件', !isSelfExempt('apps/cli/tests/file-edit.test.ts'))

    // ── 模式 1:--staged 判索引内容(且证明读的不是磁盘) ──
    writeFileSync(join(repo, 'a.ts'), 'clean\n')
    writeFileSync(join(repo, 'keep.md'), '# t\n====\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'init'])
    check('11 干净暂存集判绿', audit(repo, { staged: true }).code === 0)

    writeFileSync(
      join(repo, 'a.ts'),
      ['<<<<<<< HEAD', 'ours', '=======', 'theirs', '>>>>>>> feature'].join('\n'),
    )
    g(['add', 'a.ts'])
    const s1 = audit(repo, { staged: true })
    check('12 --staged 命中索引里的标记并点名', s1.code === 1 && s1.violations[0].path === 'a.ts')
    // 磁盘上"已经改好"但索引仍是脏内容 → 必须照判红(提交出去的是索引)
    writeFileSync(join(repo, 'a.ts'), 'fixed on disk\n')
    check(
      '13 磁盘已修、索引仍脏 → 照判红(证明判的是索引)',
      audit(repo, { staged: true }).code === 1,
    )

    // 反向:索引干净、磁盘脏 → 不得判红(未暂存内容不会被本次提交带上)
    g(['add', 'a.ts'])
    writeFileSync(
      join(repo, 'a.ts'),
      ['<<<<<<< HEAD', 'ours', '=======', 'theirs', '>>>>>>> feature'].join('\n'),
    )
    check('14 索引干净、仅工作区脏 → 本次提交判绿', audit(repo, { staged: true }).code === 0)
    // 全量模式覆盖工作区内容,此时必须红
    check('15 全量模式扫到工作区脏内容', audit(repo, { staged: false }).code === 1)
    writeFileSync(join(repo, 'a.ts'), 'fixed on disk\n')

    // ── 模式 2:--rev 判提交树 ──
    writeFileSync(join(repo, 'b.ts'), ['<<<<<<< HEAD', 'x', '=======', 'y', '>>>>>>> z'].join('\n'))
    g(['add', 'b.ts'])
    g(['commit', '-qm', 'commit with markers'])
    const rv = auditRev(repo, 'HEAD')
    check(
      '16 --rev HEAD 判红且点名 b.ts',
      rv.code === 1 && rv.violations.some((v) => v.path === 'b.ts'),
    )
    g(['rm', '-q', '--cached', 'b.ts'])
    rmSync(join(repo, 'b.ts'), { force: true })
    g(['commit', '-qm', 'remove markers'])
    check('17 修好后的 HEAD 判绿,旧提交仍判红(rev 隔离有效)', auditRev(repo, 'HEAD').code === 0)
    check('18 指定历史 sha 仍可复核', auditRev(repo, g(['rev-parse', 'HEAD~1']).trim()).code === 1)

    // ── 护栏:自豁免 / 大文件 / 二进制 ──
    writeFileSync(
      join(repo, 'check-no-conflict-markers.mjs'),
      ['<<<<<<< HEAD', 'x', '=======', 'y', '>>>>>>> z'].join('\n'),
    )
    g(['add', '-A'])
    g(['commit', '-qm', 'self exempt fixture'])
    const se = auditRev(repo, 'HEAD')
    check('19 自豁免文件不判红且如实计数', se.code === 0 && se.stats.selfExempt === 1)

    writeFileSync(
      join(repo, 'big.txt'),
      `${'x'.repeat(2 * 1024 * 1024)}\n<<<<<<< HEAD\ny\n=======\nz\n>>>>>>> w\n`,
    )
    g(['add', '-A'])
    const big = audit(repo, { staged: true })
    // 20 号断言的**方向在 2026-09-28 反过来**了:原先它钉的是">2MB 就跳过、不计红",
    // 而那份夹具正是"大文件 + 真成对标记"—— 台账 `PROJECT_PLAN.md` 天天 >2MB,
    // 于是护栏把唯一会真撞车的文件挡在射程外(实测枚 b54c79c36 把带标记的工作树副本
    // 提交进台账,本门对它报"未检出成对",汇总里只剩一句 `跳过 >2MB 大文件=1`)。
    // 现在两型分别钉:含标记线索的大文件必红,无标记线索的大文件仍按护栏跳过并计数。
    check(
      '20 >2MB 且含成对标记 ⇒ 判红(护栏不得变成盲区)',
      big.code === 1 && big.stats.largeWithMarkers === 1 && big.violations.length === 1,
      `code=${big.code} largeWithMarkers=${big.stats.largeWithMarkers} v=${big.violations.length}`,
    )
    writeFileSync(join(repo, 'big.txt'), `${'x'.repeat(2 * 1024 * 1024)}\n干净内容\n`)
    g(['add', '-A'])
    const bigClean = audit(repo, { staged: true })
    check(
      '20b >2MB 而无任何标记线索 ⇒ 仍按护栏跳过并计数(不计红)',
      bigClean.code === 0 && bigClean.stats.tooLarge === 1 && bigClean.stats.largeWithMarkers === 0,
      `code=${bigClean.code} tooLarge=${bigClean.stats.tooLarge}`,
    )
    writeFileSync(join(repo, 'big.txt'), 'shrink\n')
    g(['add', '-A'])

    writeFileSync(
      join(repo, 'blob.bin'),
      Buffer.concat([Buffer.from([0, 1, 2, 0]), Buffer.from('<<<<<<< HEAD\n=======\n>>>>>>> z\n')]),
    )
    g(['add', '-A'])
    const bin = audit(repo, { staged: true })
    check('21 二进制内容跳过并计数(不计红)', bin.code === 0 && bin.stats.binary === 1)

    // ── 退出码语义:0 通过 / 1 命中 ──
    writeFileSync(join(repo, 'blob.bin'), 'plain\n')
    writeFileSync(join(repo, 'a.ts'), 'clean\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'clean again'])
    check('22 清理后全量审计回到判绿', audit(repo, { staged: false }).code === 0)

    // ── 23 真实 merge 留下的未合并(U)路径 —— 本门的立项现场 ──
    //    merge 冲突时 git 把该文件标为 UU,若候选清单只按 ACMR 过滤,会**恰好漏掉**这一类;
    //    而多阶段索引条目让 `git show :<path>` 直接失败,所以必须由工作区兜底取证。
    writeFileSync(join(repo, 'f.txt'), 'line1\nshared\nline3\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'base for conflict'])
    g(['checkout', '-qb', 'side'])
    writeFileSync(join(repo, 'f.txt'), 'line1\nside\nline3\n')
    g(['commit', '-qam', 'side-change'])
    g(['checkout', '-q', 'main'])
    writeFileSync(join(repo, 'f.txt'), 'line1\nmain\nline3\n')
    g(['commit', '-qam', 'main-change'])
    try {
      g(['merge', '-q', 'side'])
    } catch {
      /* 预期:自动合并失败并留下未合并路径 */
    }
    const mergeConflict = audit(repo, { staged: true })
    check(
      '23 未合并路径进候选清单并判红(索引取不到 → 工作区兜底)',
      stagedPaths(repo).includes('f.txt') &&
        mergeConflict.code === 1 &&
        mergeConflict.violations.some((v) => v.path === 'f.txt'),
    )
    try {
      g(['merge', '--abort'])
    } catch {
      /* 已不在 merge 态:无副作用,后面的臂自己会重写内容 */
    }

    // ── P4(G-588)成对正反例:验收②要求"注入一处单侧 ⇒ 必红 / 注入合法单行 ⇒ 必不红" ──
    //     必须走真仓 + 真 audit(纯函数臂钉不住"退出码真的翻红"这一维,而那才是本票要的洞)。
    const onlyEnd = join(repo, 'orphan_end.md')
    writeFileSync(onlyEnd, ['# 标题', '正文一行', '', '>>>>>>> theirs', ''].join('\n'))
    g(['add', '-A'])
    const p4end = audit(repo, { staged: true })
    check(
      '24 单侧 `>>>>>>> theirs` 判红(P4 正向,kind=orphan 且计数如实)',
      p4end.code === 1 &&
        p4end.violations.length === 1 &&
        p4end.violations[0].kind === 'orphan' &&
        p4end.violations[0].path === 'orphan_end.md' &&
        p4end.stats.orphanJudged === 1 &&
        p4end.stats.filesWithViolations === 1,
    )

    writeFileSync(onlyEnd, ['# 标题', '正文一行', '', '<<<<<<< ours', ''].join('\n'))
    g(['add', '-A'])
    const p4start = audit(repo, { staged: true })
    check(
      '25 单侧 `<<<<<<< ours` 同样判红(开始/结束两侧都得有牙,只升一侧等于没升)',
      p4start.code === 1 && p4start.violations[0].kind === 'orphan',
    )

    // 反向锁:这一族**不得**被顺手升红(本票明令禁止的出路 = 把 P2/P3 整档改判红,
    // 那会把 Markdown 合法单行判成违规,造出一台与任何提交内容无关的恒红门)。
    writeFileSync(
      onlyEnd,
      ['小节名', '=======', '| a | b |', '| --- | --- |', '', '>>>>>>> feature/x', ''].join('\n'),
    )
    g(['add', '-A'])
    const legal = audit(repo, { staged: true })
    check(
      '26 反向:孤立 `=======`(setext/表格)+ 不带词尾的孤立 `>>>>>>>` ⇒ 判绿,但报数照常',
      legal.code === 0 &&
        legal.violations.length === 0 &&
        legal.stats.orphanJudged === 0 &&
        legal.stats.unpairedEnds === 1,
    )

    // E1 合法豁免族(SEARCH/REPLACE)的词尾不在 P4 名单内 —— 真仓 HEAD 面上那一处就是它。
    writeFileSync(onlyEnd, ['some patch text', '>>>>>>> REPLACE', ''].join('\n'))
    g(['add', '-A'])
    const e1 = audit(repo, { staged: true })
    check(
      '27 反向:`>>>>>>> REPLACE` 属 E1 补丁语法族,升 P4 后仍判绿(升档不得吃掉既有豁免)',
      e1.code === 0 && e1.stats.orphanJudged === 0,
    )

    // rev 档必须也看得见这一型:旧候选清单只 grep `^<<<<<<< `,单侧闭合行的文件根本进不了候选
    // (G-588 立项现场正是那一型),所以这一臂同时是"两枚针"的阳性对照。
    writeFileSync(onlyEnd, ['归档正文', '>>>>>>> theirs', ''].join('\n'))
    g(['add', '-A'])
    g(['commit', '-qm', 'orphan end marker in tree'])
    const revOrphan = auditRev(repo, 'HEAD')
    check(
      '28 --rev 档下两枚针:只有单侧闭合行的提交树判红(旧单针候选下本臂必失败)',
      revCandidatePaths(repo, 'HEAD').includes('orphan_end.md') &&
        revOrphan.code === 1 &&
        revOrphan.violations.some((v) => v.kind === 'orphan' && v.path === 'orphan_end.md'),
    )

    writeFileSync(onlyEnd, '归档正文(标记已按 §12b 归并取回)\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'clean again 2'])
    check('29 摘净单侧标记后 --rev HEAD 回到判绿(收紧后置条件可复核)', auditRev(repo, 'HEAD').code === 0)

    let fail = 0
    for (const r of results) {
      console.log(`${r.ok ? '✅' : '❌'} ${r.name}`)
      if (!r.ok) fail += 1
    }
    console.log(
      fail
        ? `❌ check-no-conflict-markers self-test FAILED ${fail}/${results.length}`
        : `✅ check-no-conflict-markers self-test 全部通过(${results.length} 例:P1 正反成对对照 + E1 豁免与混搭反例 + 真实 merge 未合并路径 + P4 单侧升红与"合法单行仍判绿"反向锁)`,
    )
    return fail ? 1 : 0
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

// ══════════════ main ══════════════

const HELP = [
  '用法:node scripts/check-no-conflict-markers.mjs [--staged | --rev <sha|HEAD>] [--self-test] [--help]',
  '',
  '  缺省        全量审计:所有 git 跟踪文件的工作区内容',
  '  --staged    pre-commit 模式:只判索引内容(git show :<path>,取不到退回工作区)',
  '  --rev <r>   判某个提交树(git grep -Il 定位候选 + blob 复核成对)',
  '  --self-test 临时仓端到端取证,不触碰真实仓',
  '',
  '判据:P1 同文件内成对的 ^<<<<<<< 与 ^>>>>>>> (中间可夹 ^=======$);P4 带 ours/theirs/HEAD 词尾',
  '          的孤立标记(只剩一半)同样判红;孤立 ======= 与不带该词尾的孤立尖括号只报数不判红。',
  `退出码:0 通过 / 1 检出 P1 成对标记或 P4 孤立带词尾标记 / 2 脚本自身异常。紧急跳过:${SKIP_ENV}=1`,
].join('\n')

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help')) {
    console.log(HELP)
    return 0
  }
  if (argv.includes('--self-test')) return selfTestRun()
  if (process.env[SKIP_ENV] === '1') {
    console.log(`⚠️  已跳过冲突标记守门(${SKIP_ENV}=1)`)
    return 0
  }
  const revIdx = argv.findIndex((a) => a === '--rev')
  const revEq = argv.find((a) => a.startsWith('--rev='))
  const rev = (revIdx >= 0 ? argv[revIdx + 1] : revEq ? revEq.slice('--rev='.length) : '') || ''
  if ((revIdx >= 0 || revEq) && !rev) {
    console.error('❌ --rev 需要一个提交参数,例:--rev HEAD')
    return 2
  }
  if (!gitBin()) {
    console.error('❌ 未解析到可用 git 可执行文件(候选全失败)—— 判据无法执行,按异常处理')
    return 2
  }
  const { code, lines } = rev
    ? auditRev(ROOT, rev)
    : audit(ROOT, { staged: argv.includes('--staged') })
  console.log(lines.join('\n'))
  return code
}

/** §22d 双形态入口守护:测试 import 时不得触发 CLI 副作用。 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => {
      if (code) process.exit(code)
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  gitBin,
  findMarkerPairs,
  isSelfExempt,
  judgeBuffer,
  looksBinary,
  newStats,
  stagedPaths,
  trackedPaths,
  revCandidatePaths,
  audit,
  auditRev,
  render,
  SKIP_ENV,
  MAX_BYTES,
  SELF_EXEMPT_PREFIX,
  /** P4 词尾名单(镜像测试 import 这一份,禁止在测试里复制正则 —— §22c)。 */
  ORPHAN_JUDGED_RE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
