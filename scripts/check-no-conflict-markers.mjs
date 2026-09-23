#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-no-conflict-markers.mjs
/**
 * 守门 77:提交内容含 Git 冲突标记(blocking)。
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
 *   P3 未配对的开始/结束标记**不计红**,但如实报数(它们是"标记被手删了一半"的强信号,
 *      而"手删标记当作已解决"正是本门要禁掉的动作)。
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
 *   G2 大文件:单文件 >2MB 跳过并计数(位图、锁文件、压缩产物等不是"手写冲突"的载体)。
 *   G3 二进制:前 8KB 含 NUL 字节即跳过并计数(二进制里偶然出现的字节序列不该判红)。
 *   G4 git 解析不到(候选全失败)按脚本自身异常 exit 2,绝不静默放行。
 *
 * 用法:
 *   node scripts/check-no-conflict-markers.mjs [--staged]
 *   node scripts/check-no-conflict-markers.mjs --rev HEAD
 *   node scripts/check-no-conflict-markers.mjs --self-test
 * 退出码:0 通过 / 1 检成对冲突标记 / 2 脚本自身异常。
 * 紧急跳过:HUSKY_SKIP_CONFLICT_MARKERS=1 git commit ...(确属有意保留标记的内容,请先把它放进
 *   字符串字面量或转义,而不是靠跳过守门)
 *
 * 当前接入:guardian-runner id '77',blocking,不设 stagedTriggers(全量/索引扫描本身就是判据面)。
 */
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveGitBin } from './lib/gitdir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const SKIP_ENV = 'HUSKY_SKIP_CONFLICT_MARKERS'
/** G2 大文件上限:超过即跳过并计数。 */
export const MAX_BYTES = 2 * 1024 * 1024
/** G1 自豁免前缀:本脚本 + 其测试文件(必然含标记字面量)。 */
export const SELF_EXEMPT_PREFIX = 'check-no-conflict-markers'
/** 违规清单里每行最多展示的字符数。 */
export const SNIPPET_CHARS = 60

const OPEN_RE = /^<<<<<<< /
const SEP_RE = /^=======$/
const END_RE = /^>>>>>>> /
const OPEN_NEEDLE = Buffer.from('<<<<<<< ', 'latin1')
const END_NEEDLE = Buffer.from('>>>>>>> ', 'latin1')

/**
 * E1 合法豁免:SEARCH/REPLACE 补丁格式与本门的字形完全同形 —— git 标记后面跟的也是
 * "标签"(HEAD / 分支 / sha),语法上无法区分,只能按标签白名单放行。
 * 依据不是猜的:本仓 CLI 的 patch 解析器就定义在 `apps/cli/src/tools/file-edit.ts`
 * 的 `SEARCH_REPLACE_REGEX`(匹配 `<<<<<<< SEARCH\n…\n=======\n…\n>>>>>>> REPLACE`),
 * 且 `apps/cli/tests/file-edit.test.ts` 有按行首原样书写的夹具 —— 不放行会让本门对
 * 合法测试内容恒红。放宽仅限**两端标签都精确等于 SEARCH / REPLACE** 的这一对;
 * `<<<<<<< HEAD` 配 `>>>>>>> REPLACE` 这类混搭一律不豁免(真 merge 不会有 SEARCH 端)。
 */
export const PATCH_OPEN = /^<<<<<<< SEARCH$/
export const PATCH_CLOSE = /^>>>>>>> REPLACE\b/
export function isPatchFormatPair(openText, closeText) {
  return PATCH_OPEN.test(String(openText ?? '')) && PATCH_CLOSE.test(String(closeText ?? ''))
}

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
 * 核心判据 P1/P2/P3:扫描文本,返回成对标记与未配对标记。
 * 行号 1 基。`sepLine` 是该对内部**第一条**整行 `=======`(可能为 null —— git 冲突块必有,
 * 但"只删了分隔线没删两端标记"这类残骸同样要判红,故分隔线只是记录,不是必要条件)。
 * 嵌套(未闭合又遇 `<<<<<<<`)按"前一个进未配对、以后者重新开对"处理,不会漏掉后一对。
 */
export function findMarkerPairs(text) {
  const lines = String(text ?? '').split(/\r?\n/)
  const pairs = []
  const exempt = []
  const unpairedStarts = []
  const unpairedEnds = []
  let open = null
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const no = i + 1
    if (OPEN_RE.test(line)) {
      if (open) unpairedStarts.push(open)
      open = { line: no, text: line, sepLine: null }
      continue
    }
    if (END_RE.test(line)) {
      if (open) {
        const pair = {
          startLine: open.line,
          startText: open.text,
          sepLine: open.sepLine,
          endLine: no,
          endText: line,
        }
        // E1:SEARCH/REPLACE 补丁格式对合法放行,但单独计数(不静默)
        if (isPatchFormatPair(open.text, line)) exempt.push(pair)
        else pairs.push(pair)
        open = null
      } else {
        unpairedEnds.push({ line: no, text: line })
      }
      continue
    }
    if (open && open.sepLine === null && SEP_RE.test(line)) open.sepLine = no
  }
  if (open) unpairedStarts.push(open)
  return { pairs, unpairedStarts, unpairedEnds, exempt }
}

/** G3 二进制判定:前 8KB 出现 NUL 字节即视为二进制。 */
export function looksBinary(buf) {
  const n = Math.min(buf.length, 8192)
  for (let i = 0; i < n; i += 1) if (buf[i] === 0) return true
  return false
}

/**
 * 单文件判定(纯函数 + 计数副作用写进 stats)。
 * 返回 violations(成对标记数组);跳过原因只累加计数,由汇总行如实打印。
 */
export function judgeBuffer(path, buf, stats) {
  if (isSelfExempt(path)) {
    stats.selfExempt += 1
    return []
  }
  if (buf.length > MAX_BYTES) {
    stats.tooLarge += 1
    return []
  }
  if (looksBinary(buf)) {
    stats.binary += 1
    return []
  }
  stats.judged += 1
  if (!buf.includes(OPEN_NEEDLE) && !buf.includes(END_NEEDLE)) return []
  const { pairs, unpairedStarts, unpairedEnds, exempt } = findMarkerPairs(buf.toString('utf8'))
  stats.unpairedStarts += unpairedStarts.length
  stats.unpairedEnds += unpairedEnds.length
  stats.patchFormatExempt += exempt.length
  if (pairs.length === 0) return []
  stats.filesWithViolations += 1
  return pairs.map((p) => ({ path, ...p }))
}

export function newStats() {
  return {
    judged: 0,
    filesWithViolations: 0,
    selfExempt: 0,
    tooLarge: 0,
    binary: 0,
    unreadable: 0,
    unpairedStarts: 0,
    unpairedEnds: 0,
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
  if (violations.length > 0) {
    lines.push(
      `❌ 检出 ${violations.length} 对 Git 冲突标记,分布在 ${stats.filesWithViolations} 个文件:`,
    )
    for (const v of violations.slice(0, 40)) {
      lines.push(`   - ${v.path}:${v.startLine}  |  ${snippet(v.startText)}`)
      if (v.sepLine) lines.push(`       ${v.path}:${v.sepLine}  |  ${'='.repeat(7)}`)
      lines.push(`       ${v.path}:${v.endLine}  |  ${snippet(v.endText)}`)
    }
    if (violations.length > 40) lines.push(`   ... 另有 ${violations.length - 40} 对`)
    lines.push('')
    lines.push(
      '   修复:用 `git checkout --theirs/--ours <文件>` 取一侧真实内容,或按 AGENTS.md §12b 协作收尾',
    )
    lines.push(
      '   重新归并;**禁止手删 <<<<====>>>> 三行标记当作已解决**(那会把两侧代码之一静默丢掉)。',
    )
  } else {
    lines.push('✅ 未检出成对 Git 冲突标记')
  }
  const skips = [
    stats.selfExempt > 0 ? `自豁免(本门自身与测试文件,判据含字面量)=${stats.selfExempt}` : '',
    stats.tooLarge > 0 ? `跳过 >2MB 大文件=${stats.tooLarge}` : '',
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
      `   ⚠️ 另有未配对标记 ${stats.unpairedStarts} 处孤立 \`<<<<<<<\` / ${stats.unpairedEnds} 处孤立 \`>>>>>>>\` —— 按 P2/P3 不计红,但"只剩一半"通常意味着标记被手删,请人工确认`,
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
 * rev 模式的候选:先按 `git grep -Il -- "^<<<<<<< " <rev>` 定位含开始标记的 blob(-I = 跳二进制,
 * -z = `rev\0path\0` 无歧义),再逐个取 blob 复核成对(P2)。
 */
export function revCandidatePaths(repoRoot, rev) {
  let out = ''
  try {
    out = gitPathList(['-C', repoRoot, 'grep', '-Ilz', '--', '^<<<<<<< ', rev])
  } catch (e) {
    // git grep 无命中时以 exit 1 结束(不是错误);其他失败码才是真异常
    const status = e && typeof e === 'object' && 'status' in e ? e.status : undefined
    if (status === 1 && !String(e?.stderr ?? '').includes('fatal')) return []
    throw e
  }
  const prefix = `${rev}:`
  return out
    .split('\0')
    .filter(Boolean)
    .map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : l))
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
    check('20 >2MB 大文件跳过并计数(不计红)', big.code === 0 && big.stats.tooLarge === 1)
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

    let fail = 0
    for (const r of results) {
      console.log(`${r.ok ? '✅' : '❌'} ${r.name}`)
      if (!r.ok) fail += 1
    }
    console.log(
      fail
        ? `❌ check-no-conflict-markers self-test FAILED ${fail}/${results.length}`
        : `✅ check-no-conflict-markers self-test 全部通过(${results.length} 例,含正反成对对照)`,
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
  '判据:同文件内成对的 ^<<<<<<< 与 ^>>>>>>> (中间可夹 ^=======$);单行不判。',
  `退出码:0 通过 / 1 检出成对标记 / 2 脚本自身异常。紧急跳过:${SKIP_ENV}=1`,
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
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
