#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-biz-day-single-source.mjs
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 守门:业务日界只许一个出口(2026-10-25 立,守门 246)。
 *
 * 接线状态(如实,守门 89 会读这段):**已接 pre-commit** —— 注册条目在
 * scripts/guardian-runner.mjs(id 以 runner 现值为准,blocking,
 * skipEnv = HUSKY_SKIP_BIZ_DAY_SINGLE_SOURCE,stagedTriggers = apps/api/src/)。
 *
 * —— 立因(现读为证)——
 * "哪一天算一天"在 apps/api 里曾有六份私有实现:逐字相同的 `shanghaiDayStartUtc` 复制在
 * 5 个文件(db/mobile-stats-queries、routes/admin/mobile-stats、routes/admin/relay-stats、
 * routes/admin-ops-wallboard、services/relay-ops-snapshot),外加同屏第 6 份 `shanghaiDateString`,
 * 再加 `+8h 后 slice` 变体 2 份(services/edu-ledger、services/edu-arrear-remind-service),
 * 以及把日界**钉成 UTC** 的 utils/checkin-helpers.todayString(扇出 6 个签到/积分调用点)与
 * db/visit-tracking-queries 的访客日。后果不是"不好看":运营大屏 BusinessSnapshot 同屏把
 * 「今日新增用户(上海日)」与「今日签到人数(UTC 日)」并排 —— 每天上海 00:00–08:00 之间签到格
 * 读成 0 而新增照常跳;签到本身把这段时刻的签到记到前一天、连续天数断裂。
 * 更糟的是这个分叉被**当注释登记成了正确口径**("与写入口同源(UTC 日期)"),所以没人觉得它是 bug。
 *
 * —— 三条判据 ——
 * B1 第二份日界**算法**:apps/api/src 内(唯一出口 utils/biz-day.ts 除外)出现
 *    ① 私有偏移指纹 `Date.now() + 8 * 3600 * 1000`,或 ② 已知私有实现名(shanghaiDayStartUtc /
 *       shanghaiDateString / shanghaiDateKey / beijingMidnightUtc / todayIso)且**函数体内仍带日历算式**
 *       (Date.UTC / setUTCDate / 再算 +8h / toISOString().slice(0,10)) ⇒ 绝对零容忍。
 *    定罪看实现不看名字:体内只 `return bizDayStartUtc(0)` 的同名转发是合法形状(测试与调用方还认这个名字),
 *    而"名义委托、体内又自己算一遍"必须红 —— 只按名字判会把委托也咬掉,逼人把出口改成第二个实现来绕门。
 *    (本枚把 6 份私有实现的算法全部摘掉,存量现读 0 ⇒ §12e "升档前置 = 存量归零"满足。)
 * B2 日键型 UTC 取值:`toISOString().slice(0, 10)` 当日期键用 ⇒ **差值棘轮**
 *    (锚点 = 该文件在锚点面的自身命中数)。这一维存量现读 34 处、且部分是纯 UTC 语义
 *    (云厂商签名 credential scope 等),当场判红就是恒红门,只能只拦新增。
 * B3 装车证明:唯一出口必须在位且被至少一个非测试文件 import ⇒ 绝对零容忍
 *    (AGENTS §0.9:"造好没装车"= 没有;`utils/calendar-boundary.ts` 就是前车之鉴——它自称
 *    日界工具而全仓无一个调用方)。
 *
 * 取材面纪律(§0.4):全量档判 HEAD blob、--staged 判索引 blob、--worktree 仅人工逃生舱;
 * 两面旗同给 ⇒ exit 2;取不到 ⇒ 未判定(不记绿也不冒红);枚举到 0 个文件 ⇒ 判死。
 *
 * 用法:node scripts/check-biz-day-single-source.mjs [--staged|--worktree] [--self-test] [--json]
 * 退出码:0 无判红 / 1 判红 / 2 未判定
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 遮罩复用全仓唯一那把尺(§22c:自造一份遮罩必然与别的门判得不一致)
import { maskCommentsAndStrings } from './lib/code-mask.mjs'
// 括号配平同样复用那台分词器(§22c:分词只许一台)
import { closeBrace } from './lib/batch-write-lexer.mjs'
// 取材复用面读取层:清单与内容同面同轮,一次 cat-file --batch 读满(逐文件派生=fork 风暴)
import { catBatch, gitErrText } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCOPE = 'apps/api/src'
const SINGLE_SOURCE = 'apps/api/src/utils/biz-day.ts'
/** 已知的私有日界实现函数名(逐字指纹,不做模糊匹配)。 */
export const PRIVATE_IMPL_NAMES = [
  'shanghaiDayStartUtc',
  'shanghaiDateString',
  'shanghaiDateKey',
  'beijingMidnightUtc',
  'todayIso',
]
/** 私有偏移指纹:自己算 +8h 而不是叫出口要。 */
export const OFFSET_FINGERPRINT = /Date\.now\(\)\s*\+\s*8\s*\*\s*3600\s*\*\s*1000/
export const UTC_DAY_KEY_RE = /toISOString\(\)\s*\.\s*slice\(\s*0\s*,\s*10\s*\)/

/** 遮罩口径全仓唯一(§22c):注释与字符串都不参与"实现指纹"匹配,且保持长度可映射回行号。 */
function stripNoise(text) {
  return maskCommentsAndStrings(text)
}

/** 已知私有日界实现的函数名 —— 单凭名字不判红:委托转发(body 里不再有任何日历算式)是合法形状,
 *  真正的缺陷是"自己又算了一遍"。所以 B1 按**实现**定罪,名字只用来定位函数体。 */
export const DAY_MATH_RE = /Date\.UTC\(|setUTCDate\(|8\s*\*\s*3600|28_?800_?000|toISOString\(\)\s*\.\s*slice\(\s*0\s*,\s*10\s*\)/

/** B1:本文件是否又写了一份日界算法。 */
export function findPrivateDayBoundaryImpls(code, rel) {
  if (rel === SINGLE_SOURCE) return []
  const src = stripNoise(code)
  const hits = []
  for (const m of src.matchAll(new RegExp(OFFSET_FINGERPRINT.source, 'g')))
    hits.push({ at: m.index, dim: 'B1', why: '自算 +8h 偏移,而不是调用 biz-day.ts' })
  for (const name of PRIVATE_IMPL_NAMES) {
    for (const m of src.matchAll(new RegExp(String.raw`function\s+${name}\b`, 'g'))) {
      const open = src.indexOf('{', m.index)
      if (open < 0) continue
      const end = closeBrace(src, open)
      if (end < 0) continue
      const body = src.slice(open, end)
      // 体内既无日历算式、也只是转发调出口 ⇒ 委托,不收
      if (!DAY_MATH_RE.test(body)) continue
      hits.push({ at: m.index, dim: 'B1', why: `第二份日界实现(${name} 体内自己算日界)` })
    }
  }
  return hits
}

/** B2:日键型 UTC 取值(差值棘轮的读数)。 */
export function findUtcDayKeys(code) {
  const src = stripNoise(code)
  const out = []
  for (const m of src.matchAll(new RegExp(UTC_DAY_KEY_RE.source, 'g'))) out.push({ at: m.index, dim: 'B2' })
  return out
}

/** B3:唯一出口是否真被装车(至少一个非测试文件 import 它)。 */
export function findImporters(files) {
  return files.filter(
    (f) => f.rel !== SINGLE_SOURCE && !/__tests__|\.test\.ts$/.test(f.rel) && /from '.*utils\/biz-day\.js'|from '\.\.?\/biz-day\.js'/.test(f.code),
  )
}

/** 清单枚举:head=HEAD 树、staged=索引、worktree=盘上(人工逃生舱)。三档都排除测试目录。 */
function listScope(face) {
  if (face === 'worktree') {
    const out = []
    const walk = (dir, prefix) => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${ent.name}` : ent.name
        if (ent.isDirectory()) {
          if (ent.name === '__tests__' || ent.name === 'node_modules' || ent.name === 'dist') continue
          walk(path.join(dir, ent.name), rel)
        } else if (rel.endsWith('.ts')) out.push(`${SCOPE}/${rel}`)
      }
    }
    walk(path.join(ROOT, SCOPE), '')
    return out.sort()
  }
  const args =
    face === 'staged'
      ? ['ls-files', '--', SCOPE]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', SCOPE]
  const r = spawnSync('git', args, {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    shell: false,
    windowsHide: true, // §5f:派生一律不弹窗(nssm/守护会话下漏此参数必弹控制台)
  })
  if (r.status !== 0) return null
  return r.stdout
    .split(/\r?\n/)
    .filter((s) => s.endsWith('.ts') && !s.includes('__tests__'))
    .sort()
}

function listFiles(face) {
  if (face === 'worktree') {
    const rels = listScope(face)
    return rels.map((rel) => ({ rel, code: existsSync(path.join(ROOT, rel)) ? readFileSync(path.join(ROOT, rel), 'utf8') : null }))
  }
  const rels = listScope(face)
  if (rels === null) return null
  if (rels.length === 0) return []
  // 清单与内容**同面同轮**:一次 cat-file --batch 读满整批正文(逐文件派生 git 在真仓是上千次
  // 进程创建,§5b fork 风暴同型;`git show <一堆 rev:path>` 在 Windows 还会撞 32k 命令行上限)
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = rels.map((r) => prefix + r)
  let got
  try {
    got = catBatch(ROOT, specs, { maxBuffer: 1 << 29 })
  } catch (e) {
    console.error(`❌ 取材失败 ⇒ 未判定:${gitErrText(e)}`)
    return null
  }
  return rels.map((rel, i) => ({ rel, code: got.get(specs[i]) ?? null }))
}

/** 一次 cat-file --batch 读一批路径的**锚点面**正文(差值棘轮的锚点计数用),取不到记 null。 */
function readAnchorContents(paths, anchorRef) {
  if (paths.length === 0) return new Map()
  const specs = paths.map((p) => `${anchorRef}:${p}`)
  try {
    return catBatch(ROOT, specs, { maxBuffer: 1 << 29 })
  } catch {
    return null
  }
}

function lineOf(text, at) {
  return text.slice(0, at).split('\n').length
}

export function selfTest() {
  const cases = []
  const ok = (name, cond) => cases.push({ name, pass: Boolean(cond) })
  const priv = `function shanghaiDayStartUtc(daysAgo = 0): Date {
  const shanghaiNow = new Date(Date.now() + 8 * 3600 * 1000)
  return new Date(Date.UTC(shanghaiNow.getUTCFullYear(), 0, 1))
}`
  ok('B1 抓到私有日界实现(按函数名)', findPrivateDayBoundaryImpls(priv, 'apps/api/src/routes/x.ts').length === 2)
  ok('B1 唯一出口自身不参与', findPrivateDayBoundaryImpls(priv, SINGLE_SOURCE).length === 0)
  ok('B1 注释里写的函数名不算实现(先遮罩)', findPrivateDayBoundaryImpls('// function shanghaiDayStartUtc 已被淘汰\nexport const a = 1', 'apps/api/src/routes/y.ts').length === 0)
  const delegated = `import { bizDayStartUtc } from '../utils/biz-day.js'
function beijingMidnightUtc(): Date { return bizDayStartUtc(0) }`
  ok('B1 放过"只留名字、体内只转发"的委托形状(定罪看实现不看名字)', findPrivateDayBoundaryImpls(delegated, 'apps/api/src/services/z.ts').length === 0)
  const halfDelegated = `import { bizDayKey } from '../utils/biz-day.js'
function todayIso(): string { const n = new Date(Date.now() + 8 * 3600 * 1000); return n.toISOString().slice(0, 10) }`
  ok('B1 抓到"名义上委托、体内又自己算一遍"(偏移 + 日界算式两处都点名)', findPrivateDayBoundaryImpls(halfDelegated, 'apps/api/src/services/w.ts').length === 2)
  ok(
    'B2 抓到日键型 UTC 取值',
    findUtcDayKeys(`export function todayString(): string { return new Date().toISOString().slice(0, 10) }`).length === 1,
  )
  ok('B2 遮罩后不数字符串示例里的写法', findUtcDayKeys(`const doc = "toISOString().slice(0, 10) 已淘汰"`).length === 0)
  const importers = findImporters([
    { rel: SINGLE_SOURCE, code: 'export function bizDayKey() {}' },
    { rel: 'apps/api/src/utils/__tests__/biz-day.test.ts', code: `import { bizDayKey } from '../utils/biz-day.js'` },
    { rel: 'apps/api/src/db/a.ts', code: `import { bizDayKey } from '../utils/biz-day.js'` },
  ])
  ok('B3 出口被非测试文件 import ⇒ 装车成立', importers.length === 1 && importers[0].rel === 'apps/api/src/db/a.ts')
  ok('B3 只有测试在 import ⇒ 不算装车', findImporters([
    { rel: SINGLE_SOURCE, code: '' },
    { rel: 'apps/api/src/utils/__tests__/biz-day.test.ts', code: `import { bizDayKey } from '../utils/biz-day.js'` },
  ]).length === 0)
  let rc = 0
  for (const c of cases) {
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}`)
    if (!c.pass) rc = 1
  }
  console.log(`self-test ${cases.filter((c) => c.pass).length}/${cases.length}`)
  return rc
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const flags = ['--staged', '--worktree'].filter((f) => argv.includes(f))
  if (flags.length > 1) {
    console.error('❌ 两面旗同给(§0.4)⇒ 未判定')
    return 2
  }
  const face = argv.includes('--staged') ? 'staged' : argv.includes('--worktree') ? 'worktree' : 'head'
  const files = listFiles(face)
  if (files === null) {
    console.error('❌ 被审面取不到 ⇒ 未判定,不出具合格证')
    return 2
  }
  if (files.length === 0) {
    console.error('❌ 枚举到 0 个 .ts 文件 ⇒ 判死(射程空了不叫绿)')
    return 2
  }
  const missing = files.filter((f) => f.code === null)
  if (missing.length) {
    console.error(`❌ ${missing.length} 个文件在被审面取不到(首个:${missing[0].rel})⇒ 未判定`)
    return 2
  }
  const findings = []
  let b2Stock = 0
  const perFileUtc = new Map()
  for (const f of files) {
    for (const h of findPrivateDayBoundaryImpls(f.code, f.rel))
      findings.push({ dim: 'B1', rel: f.rel, line: lineOf(f.code, h.at), why: h.why })
    const utc = findUtcDayKeys(f.code)
    if (utc.length) {
      b2Stock += utc.length
      perFileUtc.set(f.rel, utc)
    }
  }
  // B2 差值棘轮:只给"本面确有 UTC 日键"的文件量锚点(锚点面一次 batch 读完,不逐文件派生)
  if (face !== 'worktree' && perFileUtc.size > 0) {
    const anchorRef = face === 'staged' ? 'HEAD' : 'HEAD^'
    const paths = [...perFileUtc.keys()]
    const anchorContents = readAnchorContents(paths, anchorRef)
    if (anchorContents === null) {
      console.error('❌ 锚点面取不到 ⇒ 未判定(不拿 0 冒充"锚上没违规")')
      return 2
    }
    for (const rel of paths) {
      const utc = perFileUtc.get(rel)
      const text = anchorContents.get(`${anchorRef}:${rel}`)
      // catBatch 对整批失败会抛(上面已兜成未判定);单条 null = 锚点面上**确实没有这个对象**
      // ⇒ 那是"基线为 0"的已知事实(本次新建的文件),不是"取不到"。两种状态不能混。
      const anchorCount = text === null || text === undefined ? null : findUtcDayKeys(text).length
      const base = anchorCount ?? 0
      if (utc.length > base)
        findings.push({
          dim: 'B2',
          rel,
          line: lineOf(files.find((f) => f.rel === rel).code, utc[base]?.at ?? utc[0].at),
          why: `日键型 toISOString().slice(0,10) 比锚点面(${anchorRef})多 ${utc.length - base} 处 ⇒ 新写的日界请调 biz-day.ts`,
        })
    }
  }
  const importers = findImporters(files)
  if (importers.length === 0)
    findings.push({ dim: 'B3', rel: SINGLE_SOURCE, line: 1, why: '唯一出口没有任何非测试文件 import ⇒ 造好未装车(§0.9)' })

  const label = face === 'staged' ? '索引 blob' : face === 'worktree' ? '工作树(人工逃生舱)' : 'HEAD blob'
  console.log(`[biz-day] 面=${label} 射程 ${files.length} 个文件 | B3 装车 importers=${importers.length} | B2 存量读数=${b2Stock}`)
  if (argv.includes('--json')) console.log(JSON.stringify({ face, files: files.length, findings, b2Stock }))
  if (findings.length) {
    for (const f of findings) console.error(`   ${f.dim} ${f.rel}:${f.line} — ${f.why}`)
    console.error(
      '❌ 判红。出口只有一条:日界一律走 apps/api/src/utils/biz-day.ts' +
        '(bizDayStartUtc / bizDayKey / shiftBizDayKey);B2 档是差值棘轮,只拦比锚点面多出来的那几处。'
    )
    return 1
  }
  console.log(`✅ 无判红(B1 第二份实现 0 处;B3 装车在位;B2 存量 ${b2Stock} 处只报数)`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exit(main())

export const __test__ = {
  findPrivateDayBoundaryImpls,
  findUtcDayKeys,
  findImporters,
  PRIVATE_IMPL_NAMES,
  SINGLE_SOURCE,
  lineOf,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
