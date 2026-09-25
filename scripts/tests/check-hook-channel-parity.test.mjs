// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Hook 通知渠道三面静态对账:TS 契约 / api zod / ai-service Python 执行体。
// 成因:packages/types 曾长期只登 3 值(toast/notification/email),而 api zod 与
// hook_engine._run_notify 都真执行 webhook 档(notify 复用 webhook 发送器,2026-07-22 立,
// 证据在 routes/hooks.ts 的 secret 字段注释)⇒ 契约过期。本测试把"到底有几档"变成机器事实:
// 任一面与其余面出现差集即红。落库面为条件面 —— hooks 配置按 JSON 存 Redis(REDIS_HOOKS_KEY),
// drizzle 侧若将来出现 channel 枚举/CHECK 约束,本测试自动把它拉进对账。
// 全程只读仓库文本,不连 PostgreSQL/Redis、不起服务(AGENTS §5 测试隔离铁律)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')

const TS_FILE = join(REPO_ROOT, 'packages', 'types', 'src', 'hooks.ts')
const ZOD_FILE = join(REPO_ROOT, 'apps', 'api', 'src', 'routes', 'hooks.ts')
const PY_FILE = join(REPO_ROOT, 'apps', 'ai-service', 'app', 'services', 'hook_engine.py')
const DRIZZLE_DIR = join(REPO_ROOT, 'packages', 'database', 'drizzle')
const WEB_FILE = join(REPO_ROOT, 'apps', 'web', 'src', 'components', 'hooks', 'hooks-manager.tsx')

function quotedLiterals(text) {
  return [...text.matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] ?? m[2])
}

/** 面 1:TS 契约 `export type HookNotifyChannel = 'a' | 'b' ...` */
export function parseTsContract(src) {
  const m = src.match(/export type HookNotifyChannel\s*=\s*([^;\n]+(?:\n\s*\|[^;\n]+)*)/)
  if (!m) return null
  return new Set(quotedLiterals(m[1]))
}

/** 面 2:api zod `channel: z.enum([...])` */
export function parseApiZodChannel(src) {
  const m = src.match(/channel:\s*z\.enum\(\[([^\]]*)\]\)/)
  if (!m) return null
  return new Set(quotedLiterals(m[1]))
}

/** 面 3:Python 执行体 `_run_notify` 内的 channel 分支(== 与 in 两形态) */
export function parsePyNotifyChannels(src) {
  const start = src.indexOf('async def _run_notify(')
  if (start === -1) return null
  const bodyEnd = src.indexOf('\n    async def ', start + 1)
  const body = src.slice(start, bodyEnd === -1 ? undefined : bodyEnd)
  const found = new Set()
  for (const m of body.matchAll(/channel\s*==\s*['"]([^'"]+)['"]/g)) found.add(m[1])
  for (const m of body.matchAll(/channel\s+in\s*\(([^)]*)\)/g)) {
    for (const v of quotedLiterals(m[1])) found.add(v)
  }
  return found.size > 0 ? found : null
}

/** 面 4:web 侧下拉的取用清单 `NOTIFY_CHANNEL_OPTIONS`(值 + labelKey 成对) */
export function parseWebNotifyChannelOptions(src) {
  const start = src.indexOf('const NOTIFY_CHANNEL_OPTIONS')
  if (start === -1) return null
  const blockEnd = src.indexOf('\n]', start)
  if (blockEnd === -1) return null
  const block = src.slice(start, blockEnd)
  const found = new Set()
  for (const m of block.matchAll(/\bvalue:\s*['"]([^'"]+)['"]/g)) found.add(m[1])
  return found.size > 0 ? found : null
}

/**
 * 已知欠账面(2026-09-25 登记于 O80):web 下拉尚未承认 `webhook` 档。
 * **这不是豁免,是一张带到期日的欠条** —— reconcileFaces 里的两条断言把它钉住:
 *  · 腐烂:web 面其实已经有这个值了,欠条还挂着 ⇒ 红(清单腐烂,§4 的 RN_ONLY_BRAND_KEYS 同型);
 *  · 到期:过了 `until` 仍缺 ⇒ 红(欠条不能无限期存在,到期只有两种合法出路:补上,或改判方向)。
 * **欠条还清后必须清空成 `[]`,空表才是终态**(2026-09-25 已还清:web 下拉四档齐);
 * 将来任一面再出现缺档,按 `{ face, missing, until }` 形态重新登记一条即可 —— 判据机制见 judgePending。
 */
export const WEB_PENDING = []

/**
 * 欠条判据(**权威入口** —— 下面的断言一律调它,不得在测试里另抄一份逻辑,
 * 否则测的是测试自己的副本,仓库真况变了它也不会红)。
 * @returns {'ok'|'stale-entry'|'expired'|'no-face'}
 */
export function judgePending(entry, faceSet, nowMs) {
  if (!faceSet) return 'no-face' // 该面解析不到 ⇒ 由"面不得全盲"那条断言负责,不在这里猜
  if (faceSet.has(entry.missing)) return 'stale-entry' // 已补上却还挂着 ⇒ 清单腐烂
  if (nowMs > Date.parse(entry.until)) return 'expired' // 到期仍未补 ⇒ 欠条不能无限期存在
  return 'ok'
}

/** 条件落库面:drizzle SQL 里针对 channel 的 CHECK/枚举约束(当前机制上不存在,存在即纳管) */
export function parseDbChannelConstraint(repoRoot = REPO_ROOT) {
  let files
  try {
    files = readdirSync(repoRoot)
  } catch {
    return null
  }
  for (const f of files.filter((n) => n.endsWith('.sql'))) {
    const src = readFileSync(join(repoRoot, f), 'utf8')
    const m =
      src.match(/(?:"|\b)channel(?:"|\b)[^;\n]*CHECK[^;\n]*\(([^)]*)\)/i) ||
      src.match(/CHECK\s*\(\s*"?channel"?\s+IN\s*\(([^)]*)\)/i)
    if (m) return new Set(quotedLiterals(m[1]))
  }
  return null
}

/** 差集对账:并集由全体面共同决定,某面多一档 ⇒ 其余面各报一条"缺档"(双向都出 finding) */
export function diffFaces(faces) {
  const entries = Object.entries(faces).filter(([, set]) => set !== null)
  assert.ok(entries.length >= 2, '对账面不足 2 个 ⇒ 判据失明,不是通过')
  const union = new Set(entries.flatMap(([, s]) => [...s]))
  const findings = []
  for (const [name, set] of entries) {
    for (const v of union) if (!set.has(v)) findings.push(`${name} 缺档: ${v}`)
  }
  return findings
}

/**
 * 四面集合对账。**接 CI / 巡检一律走这个导出入口**,不要在别处再拼一份 faces 表 ——
 * 那正是本仓守门 89 要拦的"判据存在而永不调用"与"两处算同一件事各写一遍"。
 * 欠条只救它点名的那一格:其余任何缺档/多加一律照红(不得用一张表把整面洗掉)。
 */
export function reconcileFaces(srcTs, srcZod, srcPy, srcWeb, sqlDir, nowMs = Date.now()) {
  const ts = parseTsContract(srcTs)
  const zod = parseApiZodChannel(srcZod)
  const py = parsePyNotifyChannels(srcPy)
  const web = parseWebNotifyChannelOptions(srcWeb)
  const db = parseDbChannelConstraint(sqlDir)
  const faces = {
    'TS 契约': ts,
    'api zod': zod,
    'Python 执行体': py,
    '落库面(条件存在)': db,
    'web 下拉': web,
  }
  assert.ok(web && web.size >= 3, 'web NOTIFY_CHANNEL_OPTIONS 解析不到 ⇒ 对账只剩三面,是假绿')
  const excused = new Set(
    WEB_PENDING.filter((p) => p.face === 'web 下拉' && !web.has(p.missing)).map((p) => p.missing),
  )
  for (const p of WEB_PENDING) {
    if (p.face !== 'web 下拉') continue
    const verdict = judgePending(p, web, nowMs)
    assert.ok(
      verdict === 'ok',
      `欠条失效(${verdict}):web 下拉面缺/已含 '${p.missing}',到期日 ${p.until} —— 出路只有两条:补上该面,或改判方向并更新本表`,
    )
  }
  const findings = diffFaces(faces).filter(
    (f) => !excused.has(f.slice(f.lastIndexOf(':') + 1).trim()),
  )
  return { faces, findings }
}

/** 真仓四面现值(按当前磁盘/HEAD 文本调用 reconcileFaces) */
export function reconcileRepoFaces(nowMs = Date.now()) {
  return reconcileFaces(
    readFileSync(TS_FILE, 'utf8'),
    readFileSync(ZOD_FILE, 'utf8'),
    readFileSync(PY_FILE, 'utf8'),
    readFileSync(WEB_FILE, 'utf8'),
    DRIZZLE_DIR,
    nowMs,
  )
}

test('三面真文件都能被解析出非空集合(解析器漂移交代即红,不静默绿)', () => {
  const ts = parseTsContract(readFileSync(TS_FILE, 'utf8'))
  const zod = parseApiZodChannel(readFileSync(ZOD_FILE, 'utf8'))
  const py = parsePyNotifyChannels(readFileSync(PY_FILE, 'utf8'))
  assert.ok(ts && ts.size >= 3, 'TS 契约 HookNotifyChannel 解析不到 ⇒ 判据对本面全盲')
  assert.ok(zod && zod.size >= 3, 'api zod channel 枚举解析不到 ⇒ 判据对本面全盲')
  assert.ok(py && py.size >= 3, 'Python _run_notify 分支解析不到 ⇒ 判据对本面全盲')
})

test('web 下拉面能解析出非空集合(判据不得对第四面全盲)', () => {
  const web = parseWebNotifyChannelOptions(readFileSync(WEB_FILE, 'utf8'))
  assert.ok(web && web.size >= 3, 'web NOTIFY_CHANNEL_OPTIONS 解析不到 ⇒ 对账只剩三面,是假绿')
})

test('四面集合逐项同值(走 reconcileFaces 权威入口);真仓现况必须零 finding', () => {
  assert.deepEqual(reconcileRepoFaces().findings, [])
})

test('变异对照:只往 api zod 加第 5 值 ⇒ reconcileFaces 点名其余三面', () => {
  const srcZod = readFileSync(ZOD_FILE, 'utf8').replace(
    /channel:\s*z\.enum\(\[([^\]]*)\]\)/,
    "channel: z.enum([$1, 'sms'])",
  )
  const { findings } = reconcileFaces(
    readFileSync(TS_FILE, 'utf8'),
    srcZod,
    readFileSync(PY_FILE, 'utf8'),
    readFileSync(WEB_FILE, 'utf8'),
    DRIZZLE_DIR,
  )
  const named = findings.join('\n')
  for (const face of ['TS 契约', 'Python 执行体', 'web 下拉']) {
    assert.ok(named.includes(face) && named.includes('sms'), `${face} 未被点名 ⇒ 判据偏袒`)
  }
})

test('欠条判据有两道锁:腐烂(其实已补上)与到期(过期仍缺)都判红(构造条目,不依赖真仓现况)', () => {
  const web = parseWebNotifyChannelOptions(readFileSync(WEB_FILE, 'utf8'))
  const DAY = 24 * 60 * 60 * 1000
  // 真仓欠条已还清(空表是终态);登记中的条目必须既没补上也没到期
  for (const p of WEB_PENDING) {
    assert.equal(judgePending(p, web, Date.now()), 'ok')
  }
  // 构造条目钉判据本身,将来再挂欠条时机制必须仍在:
  const entry = { face: 'web 下拉', missing: 'webhook', until: '2026-10-02' }
  // 变异 1:web 面补上了 webhook,而欠条没删 ⇒ 判"清单腐烂"(真仓 web 面现含 webhook,可直接当阳性面)
  assert.equal(judgePending(entry, web, Date.parse(entry.until) - DAY), 'stale-entry')
  // 变异 2:时间推到到期日之后而值仍缺 ⇒ 判"到期"
  assert.equal(
    judgePending(entry, new Set(['toast', 'notification', 'email']), Date.parse(entry.until) + DAY),
    'expired',
  )
  // 变异 3:该面解析不到 ⇒ 如实 no-face,不冒"没问题"
  assert.equal(judgePending(entry, null, Date.now()), 'no-face')
})

test('webhook 档在全部三面同时在位(本票定性:执行侧真实能力,三面皆须承认)', () => {
  for (const [label, set] of [
    ['TS', parseTsContract(readFileSync(TS_FILE, 'utf8'))],
    ['zod', parseApiZodChannel(readFileSync(ZOD_FILE, 'utf8'))],
    ['py', parsePyNotifyChannels(readFileSync(PY_FILE, 'utf8'))],
  ]) {
    assert.ok(set.has('webhook'), `${label} 面缺 webhook 档`)
  }
})

// ── 反向对照:条件断言一律用构造输入证明,不依赖仓库瞬时状态 ──

test('构造面三方全等 ⇒ 无 finding(证明对账函数不是恒真式)', () => {
  const mk = () => new Set(['toast', 'notification', 'email', 'webhook'])
  assert.deepEqual(diffFaces({ a: mk(), b: mk(), c: mk() }), [])
})

test('只往一面(zod)加第 5 值 sms ⇒ 必红且点名其余两面', () => {
  const base = ['toast', 'notification', 'email', 'webhook']
  const src = `channel: z.enum(['${base.join("', '")}', 'sms']).optional()`
  const zod = parseApiZodChannel(src)
  assert.ok(zod.has('sms'), '注入的 sms 根本没被解析出来 ⇒ 该面判据无牙')
  const findings = diffFaces({
    'api zod': zod,
    'TS 契约': new Set(base),
    'Python 执行体': new Set(base),
  })
  assert.ok(findings.length > 0, '单面加值未被抓到')
  assert.ok(findings.some((f) => f.includes('sms') && f.includes('TS 契约')))
  assert.ok(findings.some((f) => f.includes('sms') && f.includes('Python 执行体')))
})

test('只从一面(Python)删 webhook ⇒ 同样必红(缺面方向也有牙)', () => {
  const pySrc = `
    async def _run_notify(self, config, event, context):
        channel = config.get("channel", "toast")
        if channel in ("toast", "notification"):
            return "notify(toast)", None
        if channel == "email":
            return "notify(email)", None
        return None, "未知通知渠道"

    async def _notify_toast(self):
        pass
`
  const py = parsePyNotifyChannels(pySrc)
  assert.ok(py && !py.has('webhook'), '夹具应构造出缺 webhook 的一面')
  const findings = diffFaces({
    'Python 执行体': py,
    'api zod': new Set(['toast', 'notification', 'email', 'webhook']),
    'TS 契约': new Set(['toast', 'notification', 'email', 'webhook']),
  })
  assert.ok(findings.some((f) => f.includes('webhook') && f.includes('缺档')))
})

test('TS 面同样能抓到单面加值(三面判据同形,不是只偏袒某一侧)', () => {
  const ts = parseTsContract(
    "export type HookNotifyChannel = 'toast' | 'notification' | 'email' | 'webhook' | 'sms'\n",
  )
  const others = new Set(['toast', 'notification', 'email', 'webhook'])
  const findings = diffFaces({ 'TS 契约': ts, 'api zod': new Set(others), py: new Set(others) })
  assert.ok(findings.some((f) => f.includes('sms')))
})

// ── 第五面(2026-09-25,第五十三波):web store 的草稿类型不得再手抄联合 ──
// 成因:O80 把契约加宽到 4 值时只验了 @ihui/types 与 @ihui/api 两个包,web store 里
// 那份 3 值手抄联合让 `pnpm --filter @ihui/web typecheck` 在 main 上红了(TS2322,
// 载入 channel=webhook 的既有 hook 即触发)。修法是引用契约本体;这道锁防的是
// 有人"顺手"再写回一份手抄联合 —— 类型漂移的病根是第二份真相,不是差一个值。
// (本面 2026-09-25 已收口:下拉/表单/回填/builder 均承认 webhook 档,见第五十三波。)
test('web store 草稿类型必须引用契约本体,不得手抄联合(第五面)', () => {
  const store = readFileSync(join(REPO_ROOT, 'apps', 'web', 'src', 'stores', 'hooks.ts'), 'utf8')
  assert.match(
    store,
    /notifyChannel:\s*HookNotifyChannel\b/,
    'stores/hooks.ts 的 HookDraft.notifyChannel 必须引用 HookNotifyChannel(手抄联合=第二份真相,O80 已栽过)',
  )
  assert.ok(
    !/notifyChannel:\s*'[^']*'\s*\|/.test(store),
    'stores/hooks.ts 不得再出现手抄的 channel 联合类型',
  )
})

// 第六面(2026-09-25,第五十三波续):欠条还清后,web 表单必须给 notify(webhook) 一个
// 可用的 URL 入口 —— 否则"下拉承认 4 档"只是把用户送进一条运行时必失败的配置。
// 两侧各钉一条:表单按 channel 条件渲染 URL 字段;builder 在 webhook 渠道时把
// url/method/headers 写进 config(执行侧 _run_notify 的 webhook 分支读的就是这几个键)。
test('notify(webhook) 的表单与 builder 双侧接线(第六面)', () => {
  const ui = readFileSync(WEB_FILE, 'utf8')
  assert.ok(
    /notifyChannel === 'webhook'[\s\S]{0,2000}Field label="URL"/.test(ui),
    'hooks-manager 的 notify 分支在 webhook 渠道下未渲染 URL 字段(欠条主出口要求补上,不是只加选项)',
  )
  const store = readFileSync(join(REPO_ROOT, 'apps', 'web', 'src', 'stores', 'hooks.ts'), 'utf8')
  const m = store.match(/if \(type === 'notify'\) \{[\s\S]*?\n  \}/)
  assert.ok(m, 'store 的 notify builder 分支解析不到')
  const branch = m[0]
  assert.ok(
    /draft\.notifyChannel === 'webhook'/.test(branch),
    'builder 未按 notifyChannel 分流 webhook 渠道',
  )
  assert.ok(
    /url:\s*draft\.webhookUrl/.test(branch) && /method:\s*draft\.webhookMethod/.test(branch),
    "builder 未把 url/method 写进 config —— 执行侧 _run_notify 的 webhook 分支从 config.get('url') 取值,缺了就是静默失败",
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
