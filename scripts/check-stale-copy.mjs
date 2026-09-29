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
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch } from './lib/face-reader.mjs'

/** 仓库根由脚本自身位置推导(不依赖调用者站在哪个目录 —— 守门 70 的 cwd 恒红那一型)。 */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const shSafe = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true }).trim()
  } catch {
    return ''
  }
}

/** 基线提交:main 分支与 origin/main 的分叉点 */
const BASE = shSafe('git merge-base HEAD origin/main') || 'HEAD'

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
    return { kind: 'undetermined', candidates, missing: [], why: '未注入被审面读取器,无从验证出路是否存在' }
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
  const got = printedPathCandidates(['详细检测法:.ihui-agent/tmp/detect-stale2.mjs', 'node scripts/nope.mjs'])
  ok = t('S1 两型出路路径都被抓到', got.length === 2 && dead.every((p) => got.includes(p))) && ok

  // ② 正例(有牙):面里没有 ⇒ 必须 fail 并点名
  const fakeHas = (p) => p === 'scripts/nope.mjs'
  const r2 = checkExitsResolvable({ lines: dead, has: fakeHas })
  ok = t('S2 面里取不到 ⇒ fail 且点名死路径', r2.kind === 'fail' && r2.missing.length === 1 && r2.missing[0] === dead[0]) && ok

  // ②b 反例:两条都在面上 ⇒ pass(同一条判据不得恒红)
  const r2b = checkExitsResolvable({ lines: dead, has: () => true })
  ok = t('S2b 全部可兑现 ⇒ pass 且 missing 为空', r2b.kind === 'pass' && r2b.missing.length === 0) && ok

  // ④ 反例:占位符 / 裸目录名不是出路;真文件才是(只判一边 = 允许判据被摘空)
  const r4 = printedPathCandidates([
    '还原:git checkout origin/main -- <文件路径>',
    '目录:scripts/ 下有门体',
    '问责:node scripts/run-script-tests.mjs --stale',
  ])
  ok = t(
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
    verdict = { kind: 'undetermined', candidates: real, missing: [], why: `被审面取不到:${e && e.message}` }
  }
  ok = t('S3 出路候选非空(判据不靠空集合蒙绿)', real.length >= 1) && ok
  ok = t(
    `S5 真面结论=${verdict.kind}${verdict.missing.length ? ' 死路径:' + verdict.missing.join(', ') : ''}${verdict.why ? ' 原因:' + verdict.why : ''}`,
    verdict.kind === 'pass' && !verdict.missing.length,
  ) && ok

  // ⑥ 出路文本里不得再出现本票点名的那个死指针(反向回归锁)
  ok = t('S6 修复出路里不得再出现 detect-stale2', !hints.join('\n').includes('detect-stale2')) && ok

  console.log(out.join('\n'))
  // 两条独立记账:ok 是逐条与门的累计,failed 是对输出的重数 —— 只留一条时,
  // 累计逻辑自己写错(如 `x && ok` 少写一次)不会被发现。
  const failed = out.filter((l) => l.startsWith('FAIL')).length
  console.log(`\n自检: ${out.length - failed}/${out.length} 通过`)
  return ok && failed === 0 ? 0 : 1
}

function main() {
  // HUSKY_SKIP_STALE_COPY=1 紧急跳过 —— 头注/guardian-runner 30c 注释均立规的文档化逃生口。
  // 2026-09-22 实测:该变量此前只在帮助文本里、代码未实现,merge 场景被自己的逃生口卡死
  // (merge staged 的 blob 本就等于 origin/main 已审查 tip 的内容,属守门对 BASE 口径的误报)。
  if (process.env.HUSKY_SKIP_STALE_COPY === '1') {
    console.log('⏭  HUSKY_SKIP_STALE_COPY=1 — 跳过陈旧副本守门')
    return
  }
  // pre-commit 场景:只看 staged 区(git diff --cached),即本次要提交的内容
  // core.quotePath=false:中文路径不被引号转义,保证 slice(3) 定位准确
  const statusRaw = shSafe('git -c core.quotePath=false diff --cached --name-status')
  // name-status 行以制表符分隔状态与路径(R/C 改名行还有第二路径);slice(3) 定位
  // 对含中文/改名行会错位,必须按 \t 分割
  const entries = statusRaw
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const tab = l.indexOf('\t')
      return { x: l[0], path: l.slice(tab + 1).trim() }
    })
    .filter((e) => !e.path.startsWith('.ihui-agent/') && !e.path.includes('loop-runtime'))

  const blocked = []
  const checked = { deleted: [], stale: [] }

  for (const e of entries) {
    const path = e.path.replace(/\\/g, '/')
    // D = 工作区删除(staged 删除在 porcelain 里是 'D ')
    const isDeleted = e.x === 'D' || e.y === 'D'
    if (isDeleted && RED_FLAG_DELETE.some((r) => r.test(path))) {
      blocked.push({ path, kind: '删除红旗文件(迁移/测试/守门脚本)' })
      continue
    }
    if (e.y === 'M' || e.x === 'M') {
      // 已修改文件:blob 级陈旧副本检测(blob 在基线祖先中出现过)
      const blob = shSafe(`git rev-parse :${JSON.stringify(path)}`)
      if (!blob) continue
      const hits = shSafe(
        `git log --all --format=%H --find-object=${blob} -- "${path}"`,
      )
        .split('\n')
        .filter(Boolean)
      const real = hits.filter((h) => h !== BASE)
      if (real.length === 0) continue // 新内容
      const oldest = real[real.length - 1]
      const isAncestor = shSafe(`git merge-base --is-ancestor ${oldest} ${BASE} && echo yes`)
      if (isAncestor === 'yes' && real.length > 1) {
        blocked.push({ path, kind: '陈旧副本(blob=基线祖先历史版本)' })
        checked.stale.push(path)
      }
    }
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
// (并可能 process.exit(1)),把测试环境搞炸。未知旗标(如 runner 追加的 --staged)忽略,
// 本门恒按 staged 区判定,不需要面旗。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const runCli = async () => {
    if (process.argv.includes('--self-test')) process.exit(selfTest())
    main()
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
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
