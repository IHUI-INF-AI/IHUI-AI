// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-stale-copy.mjs — 陈旧副本检测守门(pre-commit blocking, AGENTS.md §22)。
 *
 * 背景(2026-09-14 338 快照事故):338 项 staged WIP 夹带 2026-09-13 生产关键工作
 * 的整体回退(计费 roundCents/多模态计费/4 迁移/守门脚本),typecheck/守门全绿
 * 也发现不了(删功能不报错、测试也被删)。根因:staged 区被并行会话塞入
 * **陈旧副本**(文件内容 = 基线祖先的历史版本,如从旧检出/旧分支 checkout 的文件)。
 *
 * 判定(仅对 staged 的 M/D 文件):
 *   D 红旗类:被删除文件命中保护区(数据库迁移/测试/守门脚本)→ blocking,
 *     要求 HUSKY_SKIP_STALE_COPY=1 或逐条给出理由。
 *   M 陈旧副本:worktree blob 与**基线祖先的历史版本**一致(即内容是旧版)→ blocking。
 *     判定法:该 blob 曾出现在「基线祖先」的历史提交中(而非基线之后),即
 *     `git log --all --find-object=<blob> -- <path>` 最早命中 commit 是 HEAD 的祖先。
 *
 * 红旗路径(删除即拦):
 *   packages/database/drizzle 下的 .sql   数据库迁移(计费/多模态/结构变更)
 *   apps 下各端 tests 目录中的测试文件     测试文件
 *   scripts/check-*.mjs                   守门脚本
 *   scripts/lib/*.mjs                     守门共享库
 *
 * 跳过方法:HUSKY_SKIP_STALE_COPY=1 git commit ...
 *
 * 自检:`node scripts/check-stale-copy.mjs --self-test` —— 除判据正反例外,它还判
 *   「本门失败时打印的那几条修复出路,今天到底能不能跑」(见 repairHintLines /
 *   checkExitsResolvable)。立因见台账票 G-816503(原编号 G-815998):此处曾写着
 *   「详细检测法:.ihui-agent/tmp/detect-stale2.mjs」,而那个路径在工作树、索引、HEAD 树
 *   与 `git log --all --diff-filter=A` 全量零命中 —— 它从来没被版本化过(且 `.ihui-agent/tmp/`
 *   整目录被 gitignore,结构上不可能成为一条受版本控制的出路)。拿它的人会以为自己有出路,
 *   实际什么都执行不了,并把门报的红读成「我的处置失败了」。
 */
import { execFile, execSync } from 'node:child_process'
import { cpus } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Undetermined, catBatch, gitRaw } from './lib/face-reader.mjs'
import {
  blobOidOf,
  changedAgainstEveryParent,
  deltaParents,
} from './lib/merge-delta.mjs'

/** 仓库根由脚本自身位置推导(不依赖调用者站在哪个目录 —— 守门 70 的 cwd 恒红那一型)。 */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const shSafe = (cmd) => {
  try {
    // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
    return execSync(cmd, {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      windowsHide: true,
    }).trim()
  } catch {
    return ''
  }
}

/** 基线提交:main 分支与 origin/main 的分叉点 */
const BASE = shSafe('git merge-base HEAD origin/main') || 'HEAD'

/**
 * 每个 staged M 文件的 `git log --all --find-object` 是**全 ref 历史搜索**:本仓现读 26,072 个 ref
 * (其中 26,047 个是备份/lost-commit tag)⇒ 单文件约 1.1s。2026-10-28 实测:40 个 M 文件串行 44s;
 * 在落地复跑通道里(暂存区挂着所有在飞席位的文件)单臂 101s,成为整批受影响门的墙钟下限。
 *
 * 并发只改"等谁":每个文件仍跑同一条命令、同一套条件与同一顺序回填,判据一字未动。
 * `HUSKY_STALE_COPY_CONCURRENCY` 可覆盖(测试/低配机);给 1 = 逐文件串行,语义与改前同形。
 */
const CONCURRENCY = (() => {
  const raw = Number(process.env.HUSKY_STALE_COPY_CONCURRENCY)
  if (Number.isFinite(raw) && raw >= 1) return Math.min(32, Math.floor(raw))
  return Math.max(2, Math.min(8, (cpus?.() ?? []).length - 2 || 2))
})()

/** 异步 git(只读):取 stdout,失败/超时一律空串 —— 与原 shSafe 的失败语义同形。 */
function gitOut(args) {
  return new Promise((settle) => {
    execFile(
      'git',
      args,
      {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 180000,
        maxBuffer: 256 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
      (err, stdout) => settle(err ? '' : String(stdout ?? '').trim()),
    )
  })
}

/** 异步 git(只判退出码):0 = 命中;取不到(超时/异常)落 1 = 非祖先,与原 `&& echo yes` 的失败态同形。 */
function gitRc(args) {
  return new Promise((settle) => {
    execFile(
      'git',
      args,
      {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 180000,
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
      (err) => settle(typeof err?.code === 'number' ? err.code : err ? 1 : 0),
    )
  })
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  async function drain() {
    for (;;) {
      const i = next
      next += 1
      if (i >= items.length) return
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, drain))
  return out
}

/** 红旗路径(删除即拦):数据库迁移 / 测试 / 守门脚本 / 守门共享库 */
const RED_FLAG_DELETE = [
  /packages\/database\/drizzle\/.*\.sql$/,
  /packages\/database\/drizzle\/meta\//,
  /^apps\/[^/]+\/tests\/.*\.(test|spec)\.(ts|tsx|py)$/,
  /^tests\/.*\.(test|spec)\.(ts|py)$/,
  /^scripts\/(check|guard)[\w-]*\.mjs$/,
  /^scripts\/lib\/[\w-]+\.mjs$/,
]

/**
 * 纯解析:`--files <路径…>`(落地档)⇒ 路径数组;没给或给空 ⇒ null(⇒ 维持 staged 档)。
 * 只吃紧随其后的非旗 token,遇旗即停(与仓库内其它 CLI 的取法同形)。
 */
export function filesFaceOf(argv = process.argv) {
  const list = Array.isArray(argv) ? argv : []
  const i = list.indexOf('--files')
  if (i < 0) return null
  const out = []
  for (let k = i + 1; k < list.length; k++) {
    const a = String(list[k])
    if (a.startsWith('--')) break
    if (a) out.push(a)
  }
  return out.length ? out : null
}

/**
 * 落地档的父集:HEAD 若是合并提交,取它自己的父(结果 blob 等于任一父 ⇒ 归因该父,不判本次)。
 * 非合并/取不到 ⇒ null,退回单父判据。
 */
export function headMergeParents() {
  const line = shSafe(`git rev-list --parents -n 1 HEAD`)
  const parts = String(line || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length <= 2) return null
  return parts.slice(1).map((rev) => ({ rev }))
}

/**
 * 本次 staged 面的父集:非合并提交 ⇒ null(判据逐字走改前的单父写法);
 * 合并未收口 ⇒ [HEAD, MERGE_HEAD...](见 lib/merge-delta.mjs 的 `deltaParents`)。
 * 取不到父提交 = 未判定,抛 Undetermined,绝不折成空集(空集会把上游既有内容记成本次动作)。
 */
export function stagingParentSet(root = ROOT) {
  try {
    gitRaw(['rev-parse', '--git-dir'], root, { timeout: 15000 })
  } catch {
    return null // 非 git 现场:维持改前行为(此时 staged 清单本来就是空的)
  }
  try {
    const d = deltaParents({ root, face: 'staged' })
    return d.merge ? d.parents : null
  } catch (e) {
    throw new Undetermined(`无法判定本次提交的父集:${e?.message ?? e}`)
  }
}

/**
 * 纯判据:一条 staged 条目是否**归属本次提交**(父集由调用方注入,故可单测)。
 *  - modified:结果 blob 必须与**每一枚**父提交都不同(与任一父相同即归因该父);
 *  - removed :结果面没有该件,且**每一枚**父提交都有(缺任一父就不记本次删除)。
 */
export function attributableToMergeParents({ kind, curOid, parentOids = [] }) {
  const present = parentOids.filter((o) => o !== null && o !== undefined)
  if (kind === 'removed') {
    if (curOid) return false
    return parentOids.length > 0 && present.length === parentOids.length
  }
  if (!curOid) return false
  return changedAgainstEveryParent(curOid, present)
}

/**
 * 修复出路 —— 这份文本只许有一处来源:main() 打印它,--self-test 与镜像测试判它能不能跑。
 * 两处各写一遍必然漂开(漂开的表现是"自检绿着而用户拿到的仍是死指针")。
 *
 * 每一行要么是一条**当场可执行的命令**,要么点名一个**在被审面上存在的文件**。写
 * `<文件路径>` 这类占位是允许的(它不是路径候选,判据会跳过它)。
 */
export function repairHintLines() {
  return [
    '  1. 确为有意删除 → HUSKY_SKIP_STALE_COPY=1 git commit ...(并在 commit message 说明理由)',
    '  2. 确为陈旧副本 → 先按第 3 条复现确认,再 git checkout origin/main -- <文件路径> 还原后重新暂存',
    '  3. 逐文件复现本门判据(<文件路径> 换成上面点名的那个;命中提交若都早于基线,即为陈旧副本):',
    '     git log --all --format=%h --find-object=$(git rev-parse ":<文件路径>") -- ":<文件路径>"',
    '  4. 本门自检(含"上面这几条出路今天能不能跑"):node scripts/check-stale-copy.mjs --self-test',
  ]
}

/**
 * 从任意输出文本里挑出「可兑现性该被问一句」的路径候选:`scripts/<…>` 与
 * `.ihui-agent/tmp/<…>` 两型、且必须带扩展名。纯函数,不碰磁盘也不碰 git。
 *
 * 为什么按这两型:`scripts/` 是门体与工具的唯一落点(写歪即 MODULE_NOT_FOUND),
 * `.ihui-agent/tmp/` 整目录被 gitignore(写进那里的一切只存在于某一台机器)。
 * 为什么必须带扩展名:散文里的 `scripts/` 目录名本身不是出路。
 */
export function printedPathCandidates(lines) {
  const text = (Array.isArray(lines) ? lines : [lines]).join('\n')
  const re = /(?:scripts|\.ihui-agent\/tmp)\/[A-Za-z0-9_@./-]*\.[A-Za-z][A-Za-z0-9]*/g
  return [...new Set(text.match(re) || [])].sort()
}

/**
 * 出路可兑现性判据(纯函数):`has(path)` 由调用方按**被审面**给,判据本身不知道 HEAD 是什么。
 * 取不到面(派生 git 失败)一律落 `undetermined` —— 那是"没判",不得被读成"出路都在"。
 */
export function checkExitsResolvable({ lines, has, undetermined = '' } = {}) {
  const candidates = printedPathCandidates(lines)
  if (undetermined) return { kind: 'undetermined', candidates, missing: [], why: undetermined }
  if (typeof has !== 'function')
    return {
      kind: 'undetermined',
      candidates,
      missing: [],
      why: '未注入被审面读取器,无从验证出路是否存在',
    }
  const missing = candidates.filter((p) => !has(p))
  return { kind: missing.length ? 'fail' : 'pass', candidates, missing, why: '' }
}

/** HEAD 面的 `has` —— 一次 cat-file --batch 读满所有候选(经 face-reader,不散写 git)。 */
function headFaceHas(root, candidates) {
  const specs = candidates.map((p) => `HEAD:${p}`)
  const map = catBatch(root, specs)
  return (p) => {
    const v = map.get(`HEAD:${p}`)
    return v !== undefined && v !== null
  }
}

/**
 * 自检。三条正例配三条反例,缺一条这判据就等于没有:
 *  ① 本票那一型(`.ihui-agent/tmp/<file>`)必须被候选式抓到 —— 否则判据对自己立项的形态失明;
 *  ② 同一形态在被审面取不到时必须落 fail —— 否则抓到也不红;
 *  ③ 真面判据必须**至少有一个候选**(空候选的"全部可兑现"是一句空话)且当场全可兑现。
 *  ④ 散文/占位/命令名不得被当成出路(假阳比漏报更贵)。
 */
export function selfTest(root = ROOT) {
  const out = []
  const t = (name, cond) => {
    out.push(`${cond ? 'PASS' : 'FAIL'} ${name}`)
    return !!cond
  }
  let ok = true

  // ① 正例:本票立项的那一型 + scripts/ 型
  const dead = ['.ihui-agent/tmp/detect-stale2.mjs', 'scripts/nope.mjs']
  const got = printedPathCandidates([
    '详细检测法:.ihui-agent/tmp/detect-stale2.mjs',
    'node scripts/nope.mjs',
  ])
  ok = t('S1 两型出路路径都被抓到', got.length === 2 && dead.every((p) => got.includes(p))) && ok

  // ② 正例(有牙):面里没有 ⇒ 必须 fail 并点名
  const fakeHas = (p) => p === 'scripts/nope.mjs'
  const r2 = checkExitsResolvable({ lines: dead, has: fakeHas })
  ok =
    t(
      'S2 面里取不到 ⇒ fail 且点名死路径',
      r2.kind === 'fail' && r2.missing.length === 1 && r2.missing[0] === dead[0],
    ) && ok

  // ②b 反例:两条都在面上 ⇒ pass(同一条判据不得恒红)
  const r2b = checkExitsResolvable({ lines: dead, has: () => true })
  ok =
    t('S2b 全部可兑现 ⇒ pass 且 missing 为空', r2b.kind === 'pass' && r2b.missing.length === 0) &&
    ok

  // ④ 反例:占位符 / 裸目录名不是出路;真文件才是(只判一边 = 允许判据被摘空)
  const r4 = printedPathCandidates([
    '还原:git checkout origin/main -- <文件路径>',
    '目录:scripts/ 下有门体',
    '问责:node scripts/run-script-tests.mjs --stale',
  ])
  ok =
    t(
      'S4 只收带扩展名的真出路、不收占位与裸目录名(候选=' + JSON.stringify(r4) + ')',
      r4.length === 1 && r4[0] === 'scripts/run-script-tests.mjs',
    ) && ok

  // ③ 真面:本门打印的出路必须现读现判,且不得因"零候选"蒙过
  const hints = repairHintLines()
  const real = printedPathCandidates(hints)
  let verdict
  try {
    verdict = checkExitsResolvable({ lines: hints, has: headFaceHas(root, real) })
  } catch (e) {
    verdict = {
      kind: 'undetermined',
      candidates: real,
      missing: [],
      why: `被审面取不到:${e && e.message}`,
    }
  }
  ok = t('S3 出路候选非空(判据不靠空集合蒙绿)', real.length >= 1) && ok
  ok =
    t(
      `S5 真面结论=${verdict.kind}${verdict.missing.length ? ' 死路径:' + verdict.missing.join(', ') : ''}${verdict.why ? ' 原因:' + verdict.why : ''}`,
      verdict.kind === 'pass' && !verdict.missing.length,
    ) && ok

  // ⑥ 出路文本里不得再出现死指针,也不得指向 gitignore 的临时目录(那里只存在于一台机器)
  const hintText = hints.join('\n')
  ok =
    t('S6 修复出路里不得再出现 detect-stale2', !hintText.includes('detect-stale2')) &&
    t('S6b 修复出路不得指向 .ihui-agent/tmp/', !/\.ihui-agent\/tmp\//.test(hintText)) &&
    ok

  console.log(out.join('\n'))
  // 两条独立记账:ok 是逐条与门的累计,failed 是对输出的重数 —— 只留一条时,
  // 累计逻辑自己写错(如 `x && ok` 少写一次)不会被发现。
  const failed = out.filter((l) => l.startsWith('FAIL')).length
  console.log(`\n自检: ${out.length - failed}/${out.length} 通过`)
  return ok && failed === 0 ? 0 : 1
}

async function main() {
  // HUSKY_SKIP_STALE_COPY=1 紧急跳过 —— 头注/guardian-runner 30c 注释均立规的文档化逃生口。
  // 2026-09-22 实测:该变量此前只在帮助文本里、代码未实现,merge 场景被自己的逃生口卡死
  // (merge staged 的 blob 本就等于 origin/main 已审查 tip 的内容,属守门对 BASE 口径的误报)。
  if (process.env.HUSKY_SKIP_STALE_COPY === '1') {
    console.log('⏭  HUSKY_SKIP_STALE_COPY=1 — 跳过陈旧副本守门')
    return
  }
  // ── 面:staged 档(pre-commit 默认) vs 落地档(`--files <路径…>`) ──
  // 2026-11-11 根治:落地后复跑通道里共享索引挂着**其他会话**的 123 个在飞文件,
  // 旧形态恒按 `git diff --cached` 判 ⇒ 每轮必红(~50 条不属于本次落地的"陈旧副本"),
  // 且单臂 200-300s,是"每次推送卡 5 分钟"的直接成因。
  // `--files` 由 land-gate-rerun 的注册表臂按「本次落地声明面」注入:只判这几条,
  // blob 取 `HEAD:<path>`(落地面),父集取 HEAD 自己的父 —— 判据本身一字未改。
  const filesFace = filesFaceOf(process.argv)
  // pre-commit 场景:只看 staged 区(git diff --cached),即本次要提交的内容
  // core.quotePath=false:中文路径不被引号转义,保证 slice(3) 定位准确
  const statusRaw = filesFace ? '' : shSafe('git -c core.quotePath=false diff --cached --name-status')
  // name-status 行以制表符分隔状态与路径(R/C 改名行还有第二路径);slice(3) 定位
  // 对含中文/改名行会错位,必须按 \t 分割
  const entries = filesFace
    ? filesFace.map((path) => ({ x: 'M', y: 'M', path }))
    : statusRaw
        .split('\n')
        .filter(Boolean)
        .map((l) => {
          const tab = l.indexOf('\t')
          return { x: l[0], path: l.slice(tab + 1).trim() }
        })
        .filter((e) => !e.path.startsWith('.ihui-agent/') && !e.path.includes('loop-runtime'))

  const blocked = []
  const checked = { deleted: [], stale: [] }

  // 合并未收口时,上游既有的 M/D 不得记成本次动作;非合并(父集只有 HEAD)保持原判据。
  // 落地档取 HEAD 自身的父(见 headMergeParents),不读共享索引的 MERGE_HEAD(那是别人的面)。
  let mergeParents
  try {
    mergeParents = filesFace ? headMergeParents() : stagingParentSet(ROOT)
  } catch (e) {
    console.error(`❌ 无法判定本次提交的父集:${String(e?.message ?? e).split('\n')[0]}`)
    process.exit(2)
  }
  const parentOidsOf = (rel) =>
    (mergeParents ?? []).map((p) =>
      blobOidOf({ root: ROOT, face: 'rev', rev: p.rev, rel }),
    )

  // 逐文件判定(判据与改前逐字同形),只把三个 git 调用换成异步、按 CONCURRENCY 并发;
  // 结果按 entries 原顺序回填 ⇒ blocked / checked.stale 的内容与顺序都不变。
  const judged = await mapLimit(entries, CONCURRENCY, async (e) => {
    const path = e.path.replace(/\\/g, '/')
    // D = 工作区删除(staged 删除在 porcelain 里是 'D ')
    const isDeleted = e.x === 'D' || e.y === 'D'
    if (isDeleted && RED_FLAG_DELETE.some((r) => r.test(path))) {
      if (
        mergeParents &&
        !attributableToMergeParents({
          kind: 'removed',
          curOid: null,
          parentOids: parentOidsOf(path),
        })
      )
        return null
      return { blocked: { path, kind: '删除红旗文件(迁移/测试/守门脚本)' } }
    }
    if (e.y !== 'M' && e.x !== 'M') return null
    // 已修改文件:blob 级陈旧副本检测(blob 在基线祖先中出现过)
    // 落地档取 HEAD 的那一份(落地面);staged 档取索引(本次要提交的那一份)。
    const blob = filesFace
      ? await gitOut(['rev-parse', `HEAD:${path}`])
      : await gitOut(['rev-parse', `:${path}`])
    if (!blob) {
      // 落地档里取不到 blob = 该路径在 HEAD 面被删除(不是"新内容")。
      if (!filesFace) return null
      if (!RED_FLAG_DELETE.some((r) => r.test(path))) return null
      if (
        mergeParents &&
        !attributableToMergeParents({
          kind: 'removed',
          curOid: null,
          parentOids: parentOidsOf(path),
        })
      )
        return null
      return { blocked: { path, kind: '删除红旗文件(迁移/测试/守门脚本)' } }
    }
    // 合并面:结果 blob 与任一父相同 ⇒ 该改动归因那枚父提交,不判本次的"陈旧副本"。
    if (
      mergeParents &&
      !attributableToMergeParents({
        kind: 'modified',
        curOid: blob,
        parentOids: parentOidsOf(path),
      })
    )
      return null
    const hits = (
      await gitOut(['log', '--all', '--format=%H', `--find-object=${blob}`, '--', path])
    )
      .split('\n')
      .filter(Boolean)
    const real = hits.filter((h) => h !== BASE)
    if (real.length === 0) return null // 新内容
    const oldest = real[real.length - 1]
    const rc = await gitRc(['merge-base', '--is-ancestor', oldest, BASE])
    if (rc === 0 && real.length > 1)
      return { blocked: { path, kind: '陈旧副本(blob=基线祖先历史版本)' }, stale: path }
    return null
  })
  for (const j of judged) {
    if (!j) continue
    if (j.blocked) blocked.push(j.blocked)
    if (j.stale) checked.stale.push(j.stale)
  }

  if (blocked.length > 0) {
    console.error('\n❌ 陈旧副本守门(blocking):检测到生产关键文件被回退/删除\n')
    console.error('违反 AGENTS.md §22 + 2026-09-15 立规:338 快照曾夹带生产关键工作的')
    console.error('整体回退(计费 roundCents/多模态计费/4 迁移/守门脚本),typecheck/守门')
    console.error('全绿也发现不了(删功能不报错、测试也被删)。逐项:')
    for (const b of blocked) {
      console.error(`  [陈旧副本] ${b.path}\n    原因: ${b.kind}`)
    }
    console.error('\n修复方法:')
    const hints = repairHintLines()
    for (const line of hints) console.error(line)
    // 出路自身也要过一遍判据:印一条跑不通的命令,比不印更坏(台账票 G-816503)。
    // 这里不改变退出码 —— 本门红在"陈旧副本"上,不因自己的文案再叠一层红。
    const cand = printedPathCandidates(hints)
    let v
    try {
      v = checkExitsResolvable({ lines: hints, has: headFaceHas(ROOT, cand) })
    } catch (e) {
      v = { kind: 'undetermined', missing: [], why: String((e && e.message) || e) }
    }
    if (v.kind !== 'pass')
      console.error(
        `⚠️  上面这些出路里有不可兑现项(${v.kind}):${(v.missing || []).join(', ') || v.why}\n    这是本门自己的缺陷,请修 scripts/check-stale-copy.mjs 的 repairHintLines(),不要去照那条死指针找文件。`,
      )
    process.exit(1)
  }
  console.log('✅ 陈旧副本守门通过')
}

// §22d:CLI 与"被测试 import"双形态。没有这道守卫,镜像测试一 import 就会跑完整判据
// (并可能 process.exit(1)),把测试环境搞炸。
// 面:缺省 = staged 档(pre-commit);`--files <路径…>` = 落地档(land-gate-rerun 注册表臂注入,
// 只判本次落地声明面,blob 取 HEAD)。其余未知旗标(如 runner 追加的 --staged)仍忽略。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const runCli = async () => {
    if (process.argv.includes('--self-test')) process.exit(selfTest())
    await main()
  }
  runCli().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  repairHintLines,
  printedPathCandidates,
  checkExitsResolvable,
  selfTest,
  RED_FLAG_DELETE,
  stagingParentSet,
  attributableToMergeParents,
  filesFaceOf,
  headMergeParents,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
