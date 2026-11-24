#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * LIKE/ILIKE 通配符:转义实现必须只有一份,未转义的内插不得再长(门 279,blocking)
 *
 * 判三维(全部只判**代码形状**,不连库、不判机器态):
 *
 *  D1 单源零容忍(绝对):除 `apps/api/src/utils/like-escape.ts` 之外,任何 .ts/.tsx 里
 *     不得再出现"转义 LIKE 元字符"的字面量形态(`replace(/[%_…]/ …)` 或含 `%` 与 `_` 的字符类)。
 *     立因:本仓此前有**六份**各自实现(voice-note / ai-world ×2 / order / tbox-points /
 *     algorithm-record),口径还互不相同 —— 最后一份是**删掉** `%_` 而非转义(且漏了反斜杠),
 *     于是搜 "100%" 会被吃掉百分号变成搜 "100"。同一件事六份表述,必然漂移;漂移的表现形式
 *     永远是安静的那一侧(AGENTS §0.6)。2026-11-01 六份全部改指单源后**现读存量 0**
 *     ⇒ 按 §12e 可以直接绝对零容忍,不是恒红门。
 *
 *  D2 差值棘轮(只拦新增):把用户可控值原样内插进 `%${x}%` / `'%' + x + '%'` 形态的 LIKE 模式串,
 *     全仓现读 221 处(跨 102 文件)—— 存量不归零前不许判红(§12e),所以锚点 = **该文件 HEAD
 *     自身命中数**,本次把它改多的那一档才红,存量只报数。
 *     为什么不一次收完:`relay-logs.ts:40` 的 zod 注释原文写着「客户端 IP 筛选,支持 LIKE 通配符
 *     (如 '192.168.%')」—— 那类面**故意**吃通配,一刀切会把功能改坏;分档收口需要逐面回归,
 *     不是一枚守门能替做的。本门的职责是**钉住不许再长**,把存量交给后续分档清偿。
 *
 *  D3 具名豁免台账(`scripts/data/like-wildcard-intentional.json`):登记"整值即模式"的面
 *     (客户端传的就是模式本身,不是被包裹的字面量)。三条硬规矩照 §0.7:必须带 reason(≥10 字)、
 *     必须带 until(到期即红)、**锚文本不再命中 ⇒ 清单腐烂判红**(豁免比判据活得久是本仓记过的型)。
 *
 * 用法:
 *   node scripts/check-like-wildcard-escape.mjs             # 全量(HEAD blob)
 *   node scripts/check-like-wildcard-escape.mjs --staged     # pre-commit 档(索引 blob)
 *   node scripts/check-like-wildcard-escape.mjs --self-test   # 判据夹具(含变异自证)
 * 跳过(紧急):HUSKY_SKIP_LIKE_WILDCARD_ESCAPE=1 git commit ...
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { COLORS as C } from './lib/logger.mjs'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import { Undetermined, assertRepoRoot, selectFace } from './lib/face-reader.mjs'
import { maskComments, maskCommentsAndStrings } from './lib/code-mask.mjs'
import {
  headAnchors,
  overBaseline,
  readSources,
  sourceCandidates,
  stagedNameStatus,
} from './lib/face-scan.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LEDGER_REL = 'scripts/data/like-wildcard-intentional.json'
const SINGLE_SOURCE = 'apps/api/src/utils/like-escape.ts'
const SCAN_GLOBS = ['apps/**/*.ts', 'apps/**/*.tsx', 'packages/**/*.ts', 'packages/**/*.tsx']

/** D1:转义 LIKE 元字符的字面量。字符类里同时出现 % 与 _(顺序任意、可含反斜杠)。 */
const ESCAPE_LITERAL_RE =
  /\.replace\s*\(\s*\/[^/\n]*\[(?:[^\]\n]*%[^\]\n]*_|[^\]\n]*_[^\]\n]*%)[^\]\n]*\][^/\n]*\/[gimsuy]*/
/** 也认"字符类常量 + 反斜杠替换"这一形(voice-note 迁移前的形态:`const X = /[%_\\]/g`)。 */
const ESCAPE_CLASS_CONST_RE = /=\s*\/\[(?:[^\]/]*%[^\]/]*_|[^\]/]*_[^\]/]*%)[^\]/]*\]\/[gimsuy]*/
/** D2:把值内插进带前后 `%` 的模板串(`%${x}%`)。 */
const WRAP_INTERP_RE = /`%[^`]*\$\{[^`]*\}%`/g
/** D2 的另一形:`'%' + x + '%'`。 */
const CONCAT_WRAP_RE = /'%'\s*\+\s*[^+\n]+\+\s*'%'/g

/**
 * 单文件两维计数(纯函数:进文本,出 {d1, d2})。
 *
 * 两维**遮罩不同**,这不是随手:
 *  - D1 判的是代码结构(正则字面量里的字符类),注释与字符串都要遮 —— 否则注释里写一句
 *    "以前这里是 /[%_]/" 会被判成本文件又长了一份实现;
 *  - D2 判的恰恰是**模板串内部**的 `%${x}%` 形态,把字符串一起遮掉就等于把判据本身遮掉
 *    (第一版自检就是这么炸的两条)。所以 D2 只遮注释,字符串留着;数据形态的误计在
 *    "差值棘轮只拦新增"这一档下不伤人和。
 * 单源文件自身豁免 D1(它就是那份实现)。
 */
export function countViolations(rel, text) {
  let d1 = 0
  if (rel !== SINGLE_SOURCE) {
    for (const line of maskCommentsAndStrings(text).split('\n')) {
      if (ESCAPE_LITERAL_RE.test(line) || ESCAPE_CLASS_CONST_RE.test(line)) d1++
    }
  }
  let d2 = 0
  for (const line of maskComments(text).split('\n')) {
    d2 += (line.match(WRAP_INTERP_RE) ?? []).length
    d2 += (line.match(CONCAT_WRAP_RE) ?? []).length
  }
  return { d1, d2 }
}

/**
 * 台账判序:D1 的"实现只有一份"与 D3 的"整值即模式的面已登记"是同一条纪律的两面 ——
 * 登记了却不再命中,就是清单腐烂(§0.7);缺 reason/until 或形状坏 ⇒ 未判定(不记绿也不冒红)。
 */
export function judgeLedger(entries, hitsByFile, { today }) {
  const violations = []
  const expired = []
  for (const e of entries) {
    if (typeof e.file !== 'string' || typeof e.anchor !== 'string' || e.anchor.trim().length < 8) {
      return {
        malformed: `条目形状坏(file/anchor 必填,anchor ≥8 字):${JSON.stringify(e).slice(0, 120)}`,
      }
    }
    if (typeof e.reason !== 'string' || e.reason.trim().length < 10) {
      return { malformed: `条目 ${e.file} 的 reason 缺失或短于 10 字` }
    }
    if (typeof e.until !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.until)) {
      return { malformed: `条目 ${e.file} 缺 until(YYYY-MM-DD)—— 豁免必须会到期` }
    }
    if (e.until < today) expired.push(`${e.file} 于 ${e.until} 到期`)
    const text = hitsByFile.get(e.file)
    if (text === undefined) {
      violations.push(`${e.file} 已不在被审面(登记的面被删/改名 ⇒ 清单成悬空)`)
      continue
    }
    if (!text.includes(e.anchor)) {
      violations.push(`${e.file} 的 anchor 不再命中 ⇒ 清单腐烂:${e.anchor.slice(0, 60)}`)
    }
  }
  return { violations, expired, malformed: null }
}

function readLedger(top) {
  const abs = join(top, LEDGER_REL)
  if (!existsSync(abs)) throw new Undetermined(`豁免台账不存在:${LEDGER_REL}`)
  let parsed
  try {
    parsed = JSON.parse(readFileSync(abs, 'utf8'))
  } catch (e) {
    throw new Undetermined(`豁免台账不是合法 JSON:${e?.message ?? e}`)
  }
  if (!Array.isArray(parsed?.entries)) throw new Undetermined('豁免台账缺 entries 数组')
  return parsed
}

export async function run({ staged, worktree, selfTest = false } = {}) {
  if (selfTest) return selfTestRun()
  const top = assertRepoRoot(ROOT, 'LIKE 通配符转义单源守门')
  const picked = selectFace({ staged, worktree, def: 'head' })
  if (picked.error) {
    console.log(`${C.yellow}⚠️  未判定:${picked.error}${C.reset}`)
    return 2
  }
  const face = picked.face
  const faceLabel =
    face === 'staged' ? '索引 blob' : face === 'worktree' ? '工作树(人工逃生舱)' : 'HEAD blob'

  let ledger
  try {
    ledger = readLedger(top)
  } catch (e) {
    console.log(`${C.yellow}⚠️  未判定:豁免台账取不到 ⇒ ${e?.message ?? e}${C.reset}`)
    return 2
  }
  const today = new Date().toISOString().slice(0, 10)

  const listed = sourceCandidates(top, face, {
    prefilterRe: '[%_]|replace|ilike|LIKE',
    pathspecs: SCAN_GLOBS,
    skipSegmentTest: (seg) => isExcludedDirName(seg) || /^(tests|__tests__)$/.test(seg),
  })
  const { texts } = readSources(top, face, listed)
  const files = listed.filter((rel) => texts.has(rel))
  if (files.length === 0) {
    // 枚举到 0 个候选判死不记绿(§0.3):"清单空了"永远不该读成"全仓干净"
    console.log(
      `${C.yellow}⚠️  未判定:被审面(${faceLabel})枚举到 0 个候选文件 ⇒ 尺子空转${C.reset}`,
    )
    return 2
  }

  const counts = new Map()
  const hitsByFile = new Map()
  for (const rel of files) {
    const text = texts.get(rel) ?? ''
    hitsByFile.set(rel, text)
    counts.set(rel, countViolations(rel, text))
  }

  // D1:绝对零容忍
  const d1Files = [...counts].filter(([, c]) => c.d1 > 0)
  // D2:差值棘轮,锚点 = 该文件 HEAD 自身命中数(存量只报数)
  // 读数与锚点必须同一个 `countViolations`、同一入参形状(共用层头注原话:两把尺子算出来的
  // 差值不叫棘轮,叫吵架)。headAnchors 的回调签名是 (rel, text) —— 少写一个形参就会拿"路径
  // 字符串"去数 `%${x}%`,锚点恒 0,于是全仓存量都被读成本次新增(第一版就这么炸过)。
  const anchor = headAnchors(top, files, (rel, text) => countViolations(rel, text).d2)
  // **锚点缺位 ≠ 命中 0**。catBatch 在 5000+ 文件上会超时(本仓同一批门为此配过
  // IHUI_BATCH_TIMEOUT_MS),超时后未取到的那批若按 0 算,别人的存量就会被报成"本次新增"——
  // 那是把"没量到"写成"量过了"(§0.3),代价是逼所有人跳门(§12e)。
  // 唯一可以按 0 算的是**本次新加的文件**(HEAD 里本来就没有),而这一格只有索引面能证实,
  // 所以:staged 档问 stagedNameStatus 拿 A 名单;head/worktree 档一律计未判定、不冒红。
  const addedNow = face === 'staged' ? stagedNameStatus(top) : new Map()
  const d2Reads = new Map()
  const anchorMissing = []
  for (const [rel, c] of counts) {
    if (anchor.has(rel)) {
      d2Reads.set(rel, c.d2)
      continue
    }
    const status = addedNow.get(rel)
    if (status === 'A') d2Reads.set(rel, c.d2)
    else anchorMissing.push(rel)
  }
  const d2New = overBaseline(d2Reads, anchor)
  const d2Stock = [...counts].reduce((s, [, c]) => s + c.d2, 0)
  const d2Added = [...d2New].filter(([, n]) => n > 0)

  const verdict = judgeLedger(ledger.entries, hitsByFile, { today })
  if (verdict.malformed) {
    console.log(`${C.yellow}⚠️  未判定:豁免台账 ${verdict.malformed}${C.reset}`)
    return 2
  }
  for (const [rel, c] of d1Files) {
    console.log(
      `${C.red}❌ [D1 单源] ${rel} 有 ${c.d1} 处 LIKE 元字符转义字面量 ⇒ 判据必须只在 ${SINGLE_SOURCE}${C.reset}`,
    )
  }
  for (const [rel, n] of d2Added) {
    console.log(
      `${C.red}❌ [D2 新增] ${rel} 未转义内插比 HEAD 多 ${n} 处(存量 ${counts.get(rel)?.d2 ?? 0})${C.reset}`,
    )
  }
  for (const v of verdict.violations) console.log(`${C.red}❌ [D3 台账] ${v}${C.reset}`)
  for (const v of verdict.expired) console.log(`${C.red}❌ [D3 到期] ${v}${C.reset}`)

  console.log(
    `LIKE 通配符守门结论:面=${faceLabel} 扫描 ${files.length} 文件 | ` +
      `D1 单源外实现 ${d1Files.length} 文件 | D2 未转义内插 存量 ${d2Stock} 处 / 新增 ${d2Added.length} 文件 | ` +
      `D2 锚点未取到 ${anchorMissing.length} 文件 | ` +
      `D3 登记 ${ledger.entries.length} 条,腐烂 ${verdict.violations.length} 条,到期 ${verdict.expired.length} 条` +
      (d1Files.length === 0 &&
      d2Added.length === 0 &&
      verdict.violations.length === 0 &&
      verdict.expired.length === 0
        ? anchorMissing.length > 0
          ? ' ⇒ 判据通过,但 D2 那一半未判定'
          : ' ⇒ 通过'
        : ' ⇒ 红'),
  )
  if (anchorMissing.length > 0) {
    console.log(
      `${C.yellow}⚠️  D2 未判定:${anchorMissing.length} 个文件取不到 HEAD 锚点(前 8 个:${anchorMissing.slice(0, 8).join(', ')})` +
        `—— 不记绿也不冒红;多为 catBatch 超时,可提高 IHUI_BATCH_TIMEOUT_MS 复跑。${C.reset}`,
    )
    return 2
  }
  console.log(
    `${C.dim}  D2 说明:存量按"该文件 HEAD 自身命中数"做锚点,只拦本次改多的那一档(§12e 恒红门禁令);` +
      `分档清偿前不得改成绝对零容忍。故意吃通配符的面(如客户端 IP 网段筛选)走 D3 台账登记。${C.reset}`,
  )
  return d1Files.length === 0 &&
    d2Added.length === 0 &&
    verdict.violations.length === 0 &&
    verdict.expired.length === 0
    ? 0
    : 1
}

/** 夹具自证:每一维都配"摘掉/加回即翻红",真实样本各跑一遍。 */
export function selfTestRun() {
  const cases = []
  const ok = (name, cond) => cases.push({ name, pass: !!cond })

  const escaped = 'const t = kw.replace(/[%_\\\\]/g, "\\\\$&")\n'
  ok('D1 抓转义字面量', countViolations('apps/api/src/routes/x.ts', escaped).d1 === 1)
  ok('D1 单源文件自身放行', countViolations(SINGLE_SOURCE, escaped).d1 === 0)
  const cls = 'const LIKE_ESCAPE = /[%_\\\\]/g\n'
  ok('D1 也抓"字符类常量"形态', countViolations('apps/api/src/db/y.ts', cls).d1 === 1)
  // 变异:把迁移后的写法(调单源出口)抄回旧形态,D1 必须咬住
  const migrated = 'const t = asContainsTerm(kw)\n'
  ok(
    'D1 变异:改指单源 ⇒ 0,抄回本地实现 ⇒ 1',
    countViolations('a.ts', migrated).d1 === 0 && countViolations('a.ts', escaped).d1 === 1,
  )

  ok('D2 抓 `%${x}%` 内插', countViolations('a.ts', 'ilike(t.title, `%${kw}%`)\n').d2 === 1)
  ok(
    "D2 抓 '%' + x + '%' 内插",
    countViolations('a.ts', "ilike(t.title, '%' + kw + '%')\n").d2 === 1,
  )
  ok(
    'D2 不误伤已走单源的写法',
    countViolations('a.ts', 'ilike(t.title, asContainsTerm(kw))\n').d2 === 0,
  )
  ok(
    'D2 注释与字符串里的形态不计入(遮罩)',
    countViolations('a.ts', '// 例:%${kw}%\nconst s = "%x%"\n').d2 === 0,
  )

  const hits = new Map([
    ['apps/api/src/routes/a.ts', 'like(llm.clientIp, clientIp)  // 支持 192.168.%\n'],
  ])
  const entry = {
    file: 'apps/api/src/routes/a.ts',
    anchor: 'like(llm.clientIp, clientIp)',
    reason: '整值即模式:客户端 IP 网段筛选,注释与 zod 都写明支持 192.168.%',
    until: '2099-01-01',
  }
  ok('D3 命中即放行', judgeLedger([entry], hits, { today: '2026-11-01' }).violations.length === 0)
  ok(
    'D3 变异:anchor 不再命中 ⇒ 腐烂红',
    judgeLedger([{ ...entry, anchor: 'like(x, y)' }], hits, { today: '2026-11-01' }).violations
      .length === 1,
  )
  ok(
    'D3 变异:到期 ⇒ 红',
    judgeLedger([{ ...entry, until: '2020-01-01' }], hits, { today: '2026-11-01' }).expired
      .length === 1,
  )
  ok(
    'D3 缺 until ⇒ 未判定',
    !!judgeLedger([{ ...entry, until: undefined }], hits, { today: '2026-11-01' }).malformed,
  )
  ok(
    'D3 reason 过短 ⇒ 未判定',
    !!judgeLedger([{ ...entry, reason: '太短' }], hits, { today: '2026-11-01' }).malformed,
  )
  ok(
    'D3 文件已不在被审面 ⇒ 悬空红',
    judgeLedger([entry], new Map(), { today: '2026-11-01' }).violations.length === 1,
  )

  let rc = 0
  for (const c of cases) {
    if (!c.pass) rc = 1
    console.log(`${c.pass ? `${C.green}✅` : `${C.red}❌`} ${c.name}${C.reset}`)
  }
  console.log(
    `自检:${cases.filter((c) => c.pass).length}/${cases.length}${rc === 0 ? ' 全过' : ' 有失败'}`,
  )
  return rc
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const argv = process.argv.slice(2)
  run({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    selfTest: argv.includes('--self-test'),
  })
    .then((code) => process.exit(code))
    .catch((e) => {
      const undetermined = e instanceof Undetermined
      console.log(
        `${undetermined ? C.yellow : C.red}${undetermined ? '⚠️  未判定(取材失败)' : '❌ 守门异常'}: ${e?.message ?? e}${C.reset}`,
      )
      process.exit(2)
    })
}

export const __test__ = {
  CONCAT_WRAP_RE,
  ESCAPE_CLASS_CONST_RE,
  ESCAPE_LITERAL_RE,
  LEDGER_REL,
  SINGLE_SOURCE,
  WRAP_INTERP_RE,
  countViolations,
  judgeLedger,
  selfTestRun,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
