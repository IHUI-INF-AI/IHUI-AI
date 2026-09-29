// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 守门 167:turn 序号分配点必须上锁(max(turnOrdinal) 与 insert(chatMessages) 同体 ⇒ 体内必须有锁)
//
// 在修什么(2026-09-29,PROJECT_PLAN G-818,ZCode 吸收第三十一批·迁移族):
//   `chat_messages.turn_ordinal` 是**轮次组号**(一轮 = 1 条 user + 其后 assistant/system),
//   索引刻意非唯一(schema/chat.ts:85),`unique(conversation_id, turn_ordinal)` 会把正常数据
//   判成违规 —— 不能抄上游 dwf_event 的"唯一约束兜底"那条路。唯一约束结构上不可用,于是
//   "读 max 再分配"的每一段都**锁不锁靠自觉**:真库实测无事务的"读 max → 插"同会话并发双插
//   撞号率 100%(apps/api/tests/turn-ordinal-concurrency.test.ts,60 对全撞)。已修的两处
//   (chat-queries.ts createMessage / routes/message.ts)都走了"事务 + 会话行 FOR UPDATE";
//   但**没有任何东西会红** —— 下一个人在未上锁处改成自增时,这格是静默的。本门把不变量
//   交给尺子:凡 `max(${chatMessages.turnOrdinal})` 与 `insert(chatMessages)` 同体者,
//   该体内必须有 `.for('update')`(行锁)或显式 `db.transaction(`(事务串行)。
//
// 为什么是"同体"而不是"同文件":max 与 insert 隔着函数边界时,锁彼此不可见,判同文件会把
//   恰好读过一次 max 的无关函数拖进来(误报 ⇒ 逼人绕钩子)。同体判定锚**最深共同体**(LCA):
//   两点都落进的平衡块里最深的那一个,再判该块是不是"语句性块"(开括号前缀含 `=>`/`function`,
//   或尾词是 try/catch/if/else/do/for/while/switch)—— 对象字面量/解构的块不算,两点隔着
//   对象字面量各居一个方法时**跳过不判**(宁漏不误报)。
//
// 取材面纪律(§4,与守门 77/83/121 同口径):全量档判 **HEAD blob**、`--staged` 判**索引 blob**,
//   经 scripts/lib/face-reader.mjs 的 catBatch 一次批量取;取不到 ⇒ exit 2「无法判定」,
//   既不冒红也绝不记绿。**棘轮方向与 121 一致:--staged 只咬本次改动动过的文件,全量档只报数
//   不判红**(存量 patrol-scheduler.ts:198 一处未上锁,一次性判红就是恒红门;改到它的那一刻
//   才必须顺手补锁)。
//
// 两份视图(为什么要有第二台投影而不是一套遮噪走到黑):
//   视图A = code-mask 的 maskCommentsAndStrings:注释/字符串/**模板整段**(含 `${}` 插值)全遮。
//     用于**括号切体与查锁** —— 模板里的伪括号、字符串里的伪 `}` 都因此不可见,切体不破位;
//     `.for(` 与 `db.transaction(` 是代码 token,原样保留。
//   视图B = 本文件 `maskCommentsKeepTemplates`(scanSpans 的投影,**不是第二台分词器**):
//     遮注释 + 普通引号字符串 + 正则体,**模板字面量原文保留** —— 因为 max 聚合恰恰写在
//     SQL 模板里(`sql<number|null>`max(${chatMessages.turnOrdinal})``),blankStrings 会把
//     插值区一并抹掉(max 点整型失明),maskComments 又会把字符串里的伪 max 留在面上。
//   两视图等长(逐字符空格替换、换行保留),行号直通。
//
// 手动:
//   node scripts/check-turn-ordinal-lock.mjs            # 全量档(HEAD):只报数,红不判死
//   node scripts/check-turn-ordinal-lock.mjs --staged   # 提交链:改到的文件里同体无锁 ⇒ exit 1
//   node scripts/check-turn-ordinal-lock.mjs --worktree # 人工排查逃生舱(盘上面,不作门禁)
//   node scripts/check-turn-ordinal-lock.mjs --json
//   node scripts/check-turn-ordinal-lock.mjs --self-test
//   node scripts/check-turn-ordinal-lock.mjs --root <目录>   # 镜像测试通道(值必须存在、非空、不以 - 开头)
// 退出码:0 过(全量档红只报数)/ 1 判红(--staged)/ 2 判不了。紧急跳过:HUSKY_SKIP_TURN_ORDINAL_LOCK=1

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { maskCommentsAndStrings, scanSpans } from './lib/code-mask.mjs'
import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
const ROOT = resolve(HERE, '..')

export const SELF_SKIP = 'HUSKY_SKIP_TURN_ORDINAL_LOCK'
export const SCAN_ROOT = 'apps/api/src/'
const GIT_TIMEOUT = 120000

/**
 * max 聚合的识别形态(本仓三处实测完全同形,宁窄不放宽):
 * `max(${chatMessages.turnOrdinal})` —— 写在 SQL 模板里。其它形态(sql.raw 拼接、别名 import)
 * 判不了就看不见,按已知限制登记,不假装覆盖。
 */
const MAX_AGG_RE = /max\s*\(\s*\$\{\s*chatMessages\s*\.\s*turnOrdinal\s*\}\s*\)/g
/** 直插 chatMessages 的识别形态:`db.insert(chatMessages)` / `tx.insert(chatMessages)` */
const INSERT_RE = /\.insert\s*\(\s*chatMessages\s*\)/g
/** 行锁:`.for('update' | 'share' | …)` —— 参数是字符串,视图A里被遮,认调用形态即可 */
const ROW_LOCK_RE = /\.for\s*\(/
/**
 * 显式事务:只认 `db.transaction(` 字面形态(变量别名/解构传入判不了,宁漏)。
 * 刻意**不带** `\b`:体声明前缀是去空白连拼,`await db.transaction(` 连成 `awaitdb.transaction`
 * 后 `\b` 永不失配不到(实测 P2 误红即此);去掉 `\b` 的代价是 `foodb.transaction(` 也会匹配
 * —— 那是**放行方向**(把某对象的事务调用当锁),本门宁漏不误报,如实登记。
 */
const TX_RE = /db\s*\.\s*transaction\s*\(/
/** 语句性块的开括号尾词(对象字面量/解构不算体) */
const BLOCK_TAIL_KEYWORDS = new Set(['try', 'catch', 'if', 'else', 'do', 'for', 'while', 'switch'])
/** 开括号前缀回溯窗口:足以盖住 `db.transaction(async (tx) => {` 这类声明行 */
const PREFIX_WINDOW = 120

/**
 * 视图B:遮注释 + 普通引号字符串 + 正则体,**模板字面量原文保留**。等长,行号不漂。
 * 与 code-mask 各导出同源一台分词器(scanSpans),只是投影组合不同 —— 判据要读 SQL 模板形态,
 * 这格是既有四个投影都覆盖不了的(blankStrings 连插值一起抹、maskComments 不遮字符串体)。
 */
export function maskCommentsKeepTemplates(src) {
  if (typeof src !== 'string') return ''
  const out = src.split('')
  const blank = (from, to) => {
    for (let k = Math.max(0, from); k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' '
  }
  for (const s of scanSpans(src)) {
    if (s.kind === 'line' || s.kind === 'block') blank(s.start, s.end)
    else if (s.kind === 'string' && !s.isTemplate) blank(s.start, s.end)
    else if (s.kind === 'regex') blank(s.bodyStart, s.bodyEnd)
  }
  return out.join('')
}

/** 行号(1 起):idx 之前的换行数 + 1。两视图等长 ⇒ 直通原文件行号。 */
export function lineOf(view, idx) {
  let line = 1
  for (let i = 0; i < idx && i < view.length; i++) if (view[i] === '\n') line++
  return line
}

/**
 * 括号平衡切体树(视图A上扫):字符串/模板/注释已遮 ⇒ 剩下的大括号都是真代码。
 * 不平衡 ⇒ null(调用方折成 undetermined,不猜)。返回按 open 升序的体清单。
 */
export function buildBodySpans(viewA) {
  const bodies = []
  const stack = []
  for (let i = 0; i < viewA.length; i++) {
    const c = viewA[i]
    if (c === '{') stack.push(i)
    else if (c === '}') {
      const open = stack.pop()
      if (open === undefined) return null
      bodies.push({ open, close: i })
    }
  }
  if (stack.length) return null
  return bodies
}

/** 最深共同体:同时包含 a、b 两点的体里 open 最大(最内层)的那个;无 ⇒ null。 */
export function deepestCommonBody(bodies, a, b) {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  let best = null
  for (const body of bodies) {
    if (body.open < lo && body.close > hi && (!best || body.open > best.open)) best = body
  }
  return best
}

/**
 * 体开括号的前缀声明(视图A,开括号往前回溯 PREFIX_WINDOW 个非空字符):既用于判
 * "是不是语句性块",也用于认 `db.transaction(async (tx) => {` 这种写在**体声明处**的事务
 * (事务包裹即同体串行,票面口径"显式 db.transaction"包含这一形)。
 */
export function bodyPrefix(viewA, open) {
  const from = Math.max(0, open - PREFIX_WINDOW)
  let text = ''
  for (let i = from; i < open; i++) {
    const c = viewA[i]
    if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') text += c
  }
  return text
}

/** 语句性块判定:前缀含 `=>`/`function`,或最后一个词是块语句关键字。 */
export function isBlockishBody(prefix) {
  if (prefix.includes('=>') || prefix.includes('function')) return true
  const words = prefix.match(/[A-Za-z_$][\w$]*/g)
  const last = words && words.length ? words[words.length - 1] : ''
  return BLOCK_TAIL_KEYWORDS.has(last)
}

/** 锁判定:体内有行锁 `.for(`,或体内/体声明前缀有显式 `db.transaction(`。 */
export function hasLockInRange(viewA, prefix, body) {
  if (ROW_LOCK_RE.test(viewA.slice(body.open + 1, body.close))) return true
  if (TX_RE.test(viewA.slice(body.open + 1, body.close))) return true
  return TX_RE.test(prefix)
}

/**
 * 纯判据核心(镜像测试主战场):对一个源文件判"同体分配点是否上锁"。
 * 退出 {maxPoints, insertPoints, pairs, reds, skipped:{noPair, fakeBody}, unbalanced}。
 */
export function judgeSource(code) {
  const viewB = maskCommentsKeepTemplates(code)
  const viewA = maskCommentsAndStrings(code)
  const maxPoints = [...viewB.matchAll(MAX_AGG_RE)].map((m) => ({ idx: m.index, line: lineOf(viewB, m.index) }))
  const insertPoints = [...viewB.matchAll(INSERT_RE)].map((m) => ({ idx: m.index, line: lineOf(viewB, m.index) }))
  const out = {
    maxPoints: maxPoints.map((p) => p.line),
    insertPoints: insertPoints.map((p) => p.line),
    pairs: [],
    reds: [],
    skipped: { noPair: 0, fakeBody: 0 },
    unbalanced: false,
  }
  if (maxPoints.length === 0 || insertPoints.length === 0) return out
  const bodies = buildBodySpans(viewA)
  if (!bodies) {
    out.unbalanced = true
    return out
  }
  for (const m of maxPoints) {
    // 分配必须先于插入:insert 在 max 之前的配对在语义上不构成"读后写",宁窄跳过
    let best = null
    for (const ins of insertPoints) {
      if (ins.idx <= m.idx) continue
      const lca = deepestCommonBody(bodies, m.idx, ins.idx)
      if (lca && (!best || lca.open > best.open)) best = { body: lca, insert: ins }
    }
    if (!best) {
      out.skipped.noPair++
      continue
    }
    const prefix = bodyPrefix(viewA, best.body.open)
    if (!isBlockishBody(prefix)) {
      out.skipped.fakeBody++
      continue
    }
    out.pairs.push({ maxLine: m.line, insertLine: best.insert.line })
    if (!hasLockInRange(viewA, prefix, best.body))
      out.reds.push({
        line: m.line,
        why: `max(turnOrdinal) 与 insert(chatMessages) 同体(${best.body.open === 0 ? '' : ''}LCA)但体内无 .for('update') 也无 db.transaction —— 并发双插撞号(真库实测 100%),见 turn-ordinal-concurrency.test.ts`,
      })
  }
  return out
}

export function inScanRoot(p) {
  return p.startsWith(SCAN_ROOT)
}

/** 各面的文件清单与 blob 预取(head=ls-tree / staged=ls-files;取材一律 catBatch)。 */
export function listFace(root, face) {
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], root, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(inScanRoot)
  return gitRaw(['ls-files', '-z'], root, { timeout: GIT_TIMEOUT })
    .split('\0')
    .filter(inScanRoot)
}

export function readFace(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(root, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

/** 汇总判定:--staged 红 ⇒ 1;取不到 ⇒ 2;全量/工作树红只报数 ⇒ 0。 */
export function decide({ perFile, undetermined, mode }) {
  const reds = []
  const counts = { files: 0, maxPoints: 0, pairs: 0, noPair: 0, fakeBody: 0 }
  for (const [file, r] of perFile) {
    counts.files++
    counts.maxPoints += r.maxPoints.length
    counts.pairs += r.pairs.length
    counts.noPair += r.skipped.noPair
    counts.fakeBody += r.skipped.fakeBody
    for (const red of r.reds) reds.push({ file, line: red.line, why: red.why })
  }
  const exit = undetermined.length ? 2 : reds.length && mode === 'staged' ? 1 : 0
  return { exit, reds, undetermined, mode, counts }
}

export function analyze(root, face) {
  let effFace = face
  let fellBack = false
  let targets = null
  if (face === 'staged') {
    // 只咬本次改动动过的文件(ACMR:A新增/M改/C拷/R改名;D删除不在其列,无内容可判)
    targets = gitRaw(
      ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'],
      root,
      { timeout: GIT_TIMEOUT },
    )
      .split('\0')
      .filter(inScanRoot)
    if (targets.length === 0) {
      effFace = 'head'
      targets = null
      fellBack = true
    }
  }
  const paths = targets ?? listFace(root, effFace)
  if (paths.length === 0)
    throw new Undetermined(`${effFace} 面枚举到 0 个 ${SCAN_ROOT} 源文件 —— 空扫不记绿`)
  const sources = readFace(root, effFace, paths)
  const perFile = new Map()
  const undetermined = []
  for (const [file, code] of sources) {
    if (code === null) {
      undetermined.push(file)
      continue
    }
    perFile.set(file, judgeSource(code))
  }
  return { ...decide({ perFile, undetermined, mode: fellBack ? 'full' : effFace }), face: effFace, fellBack }
}

/** 判据自检:纯函数 + 构造面,零副作用(--self-test 连跑两次 rc=0 由镜像测试再锁一遍)。 */
function selfTest() {
  let ran = 0
  let fail = 0
  const eq = (label, got, want) => {
    ran++
    const g = JSON.stringify(got)
    const w = JSON.stringify(want)
    if (g !== w) {
      fail++
      console.log(`  ❌ ${label}\n      got  ${g}\n      want ${w}`)
    } else console.log(`  ✅ ${label}`)
  }
  const t = (n, body) => `import { chatMessages } from './schema'\nimport { db } from './db'\n\n${body}`

  // 真形态缩略(与 HEAD 三处同构;行号按夹具数好)
  const LOCKED_TX =
    'export async function createMessage(input: CMI): Promise<ChatMessage> {\n' +
    '  return db.transaction(async (tx) => {\n' +
    "    await tx.select({ id: chatConversations.id }).from(chatConversations).where(eq(chatConversations.id, input.conversationId)).for('update')\n" +
    '    const turnRows = await tx\n' +
    '      .select({ maxTurn: sql<number | null>`max(${chatMessages.turnOrdinal})` })\n' +
    '      .from(chatMessages)\n' +
    '      .where(eq(chatMessages.conversationId, input.conversationId))\n' +
    '    const rows = await tx.insert(chatMessages).values({ turnOrdinal: 1 })\n' +
    '    return rows[0]\n' +
    '  })\n' +
    '}\n'
  const UNLOCKED_PATROL =
    'async function injectAlert() {\n' +
    '  if (status === "issue") {\n' +
    '    try {\n' +
    '      const turnRows = await db\n' +
    '        .select({ maxTurn: sql<number | null>`max(${chatMessages.turnOrdinal})` })\n' +
    '        .from(chatMessages)\n' +
    '      await db.insert(chatMessages).values({ turnOrdinal: 1 })\n' +
    '    } catch (err) {\n' +
    '      log.warn(err)\n' +
    '    }\n' +
    '  }\n' +
    '}\n'
  const TX_NO_FOR =
    'async function f() {\n' +
    '  await db.transaction(async (tx) => {\n' +
    '    const turnRows = await tx.select({ m: sql`max(${chatMessages.turnOrdinal})` }).from(chatMessages)\n' +
    '    await tx.insert(chatMessages).values({ turnOrdinal: 1 })\n' +
    '  })\n' +
    '}\n'
  const DIFF_BODIES =
    'async function readMax() {\n' +
    '  const r = await db.select({ m: sql`max(${chatMessages.turnOrdinal})` }).from(chatMessages)\n' +
    '  return r\n' +
    '}\n' +
    'async function insertMsg() {\n' +
    '  await db.insert(chatMessages).values({ turnOrdinal: 1 })\n' +
    '}\n'
  const OBJECT_LITERAL =
    'const impl = {\n' +
    '  async read() {\n' +
    '    return db.select({ m: sql`max(${chatMessages.turnOrdinal})` }).from(chatMessages)\n' +
    '  },\n' +
    '  async write() {\n' +
    '    await db.insert(chatMessages).values({ turnOrdinal: 1 })\n' +
    '  },\n' +
    '}\n'
  const FAKE_IN_STRING =
    "const doc = 'max(${chatMessages.turnOrdinal}) db.insert(chatMessages)'\n" +
    'const x = 1\n'
  const FAKE_IN_COMMENT =
    '// max(${chatMessages.turnOrdinal}) 与 db.insert(chatMessages) 同体\n' +
    'const x = 1\n'
  const NON_MAX_USAGE =
    'const rows = await db.select().from(chatMessages).where(eq(chatMessages.turnOrdinal, 1))\n' +
    'const n = db.insert(chatMessages).values({ turnOrdinal: 1 })\n'

  // P1 放过:事务 + 会话行锁(createMessage 形态)
  eq('P1 事务+.for 放过', judgeSource(t('a', LOCKED_TX)).reds.length, 0)
  // P2 放过:显式事务无 .for(事务串行即达标)
  eq('P2 显式事务无 .for 放过', judgeSource(t('b', TX_NO_FOR)).reds.length, 0)
  // P3 点名:try 体内裸 select max + insert(patrol 形态),行号对准 max 行
  const patrol = judgeSource(t('c', UNLOCKED_PATROL))
  eq('P3 patrol 形态判红', patrol.reds.length, 1)
  eq('P3 patrol 点名行 = max 行', patrol.reds[0]?.line, 8)
  eq('P3 patrol 配对成立', patrol.pairs.length, 1)
  // P4 放过:不同体(max 与 insert 各自函数)
  eq('P4 不同体跳过', judgeSource(t('d', DIFF_BODIES)).skipped.noPair, 1)
  // P5 放过:对象字面量假体 LCA(两方法互不相干)
  eq('P5 对象字面量假体跳过', judgeSource(t('e', OBJECT_LITERAL)).skipped.fakeBody, 1)
  // P6 防伪:字符串里的伪 max / 伪 insert 不可见
  eq('P6 字符串伪代码不识别', judgeSource(t('f', FAKE_IN_STRING)).maxPoints.length, 0)
  // P7 防伪:注释里的伪代码不可见
  eq('P7 注释伪代码不识别', judgeSource(t('g', FAKE_IN_COMMENT)).maxPoints.length, 0)
  // P8 非 max 的 turnOrdinal 用法(select 字段/eq)不构成分配点
  eq('P8 非 max 用法不识别', judgeSource(t('h', NON_MAX_USAGE)).maxPoints.length, 0)
  // P9 视图B投影:模板原文保留、普通字符串遮白、等长
  const src = 'const a = `max(${chatMessages.turnOrdinal})`\nconst b = "x"\n'
  const vb = maskCommentsKeepTemplates(src)
  eq('P9 投影等长', vb.length, src.length)
  eq('P9 模板保留', vb.includes('max(${chatMessages.turnOrdinal})'), true)
  eq('P9 字符串遮白', vb.includes('"x"'), false)
  // P10 行锁三态:.for('share') 也是锁
  const TX_SHARE = TX_NO_FOR.replace(
    'await db.transaction(async (tx) => {',
    "await db.transaction(async (tx) => {\n    await tx.select({ id: c.id }).from(c).for('share')",
  )
  eq('P10 .for(share) 也算锁', judgeSource(t('i', TX_SHARE)).reds.length, 0)
  // P11 不平衡 ⇒ unbalanced(不猜不记绿);夹具须含分配点,否则在切体前就提前返回
  eq(
    'P11 括号不平衡报 undetermined',
    judgeSource(
      t(
        'k',
        'async function f() {\n' +
          '  const r = await db.select({ m: sql`max(${chatMessages.turnOrdinal})` }).from(chatMessages)\n' +
          '  await db.insert(chatMessages).values({ turnOrdinal: 1 })\n',
      ),
    ).unbalanced,
    true,
  )
  // P12 配对语义:insert 在 max 前不构成"读后写"
  const REVERSED =
    'async function f() {\n' +
    '  await db.insert(chatMessages).values({ turnOrdinal: 1 })\n' +
    '  const r = await db.select({ m: sql`max(${chatMessages.turnOrdinal})` }).from(chatMessages)\n' +
    '}\n'
  eq('P12 insert 先于 max 跳过', judgeSource(t('j', REVERSED)).skipped.noPair, 1)

  console.log(`自检:${ran - fail}/${ran} 通过`)
  return fail === 0 ? 0 : 1
}

function main(argv) {
  if (process.env[SELF_SKIP] === '1') {
    console.log(`⏭️  ${SELF_SKIP}=1,本门跳过(跳过即放弃"分配点上锁"这格不变量,须在提交信息里写明理由)`)
    return 0
  }
  if (argv.includes('--self-test')) return selfTest()
  const f = argv.indexOf('--root')
  let root = ROOT
  if (f >= 0) {
    const token = argv[f + 1]
    if (typeof token !== 'string' || token === '' || token.startsWith('-')) {
      console.error(
        `❌ 无法判定(exit 2): --root 没有收到有效的目录 —— 紧邻的 token 实得:${
          token === undefined ? '(其后没有任何参数)' : JSON.stringify(token)
        }`,
      )
      return 2
    }
    root = resolve(token)
  }
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    return 2
  }
  try {
    assertRepoRoot(root, '本门')
  } catch (e) {
    console.error(`❌ 无法判定(exit 2): ${e instanceof Undetermined ? e.message : String(e?.message ?? e)}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  let out
  try {
    out = analyze(root, face)
  } catch (e) {
    console.error(`❌ 无法判定(exit 2): ${e instanceof Undetermined ? e.message : (e?.message ?? String(e))}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(out, null, 2))
    return out.exit
  }
  for (const u of out.undetermined) console.error(`❓ 取不到(${out.face} 面): ${u}`)
  if (out.reds.length) {
    const tag = out.mode === 'staged' ? '本次改动动过的文件里' : '存量(全量档只报数,不判死)'
    console.error(`❌ 检出 ${out.reds.length} 处 turn 序号分配点同体未上锁(${tag}):`)
    for (const r of out.reds) console.error(`   ${r.file}:${r.line} —— ${r.why}`)
    console.error(
      '   出路:把 max 读取与 insert 一并包进 db.transaction,并先对会话行 .for(\'update\')',
      '(参照 apps/api/src/db/chat-queries.ts createMessage 与 apps/api/src/routes/message.ts 的既有形态);',
    )
    console.error(
      '     单独复验:node scripts/check-turn-ordinal-lock.mjs --staged',
      ' 自检:--self-test  镜像:node --test scripts/tests/check-turn-ordinal-lock.test.mjs',
    )
  }
  const c = out.counts
  const fell = out.fellBack ? '(改动集未触及 ' + SCAN_ROOT + ' ⇒ 回落全量只报数)' : ''
  console.log(
    `${out.exit === 0 ? '✅' : out.exit === 2 ? '❌ 无法判定' : '❌ 判红'} [${out.face}]${fell} 文件 ${c.files} / max 点 ${c.maxPoints} / 同体配对 ${c.pairs} / 异体跳过 ${c.noPair} / 假体跳过 ${c.fakeBody} / 取不到 ${out.undetermined.length}`,
  )
  return out.exit
}

// §22d isDirectRun:被 import(镜像测试)时不跑 main
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)))
}

export const __test__ = {
  SELF_SKIP,
  SCAN_ROOT,
  maskCommentsKeepTemplates,
  lineOf,
  buildBodySpans,
  deepestCommonBody,
  bodyPrefix,
  isBlockishBody,
  hasLockInRange,
  judgeSource,
  inScanRoot,
  listFace,
  readFace,
  decide,
  analyze,
}
