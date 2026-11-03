#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像档 —— check-egress-ip-drift.mjs(家宽公网出口 IPv4 ↔ EdgeOne 源站期望,2026-10-21 立)
 *
 * §22c 纪律:判据一律 import 源脚本的 __test__,本文件不复制任何常量或判定。
 * §5 测试隔离精神:**全程不真打公网** —— 网络一律经 analyze 的 fetchImpl 注入假探测;
 * 台账夹具唯一落点 mkScratch()(§15b,仓库外 + 进程退出回收,禁仓库树内造 git/夹具)。
 * 跑法:node scripts/tests/check-egress-ip-drift.test.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as T } from '../check-egress-ip-drift.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const cases = []
const t = (name, fn) => cases.push({ name, fn })
const fail = (m) => {
  throw new Error(m)
}

const NOW = Date.parse('2026-10-21T00:00:00Z')
const EXPECT = '218.27.70.129'
const row = (over = {}) => ({
  index: 0,
  face: 'www.aizhs.top',
  judge: true,
  expires: '2026-11-20',
  expectedIPv4: EXPECT,
  port: 8801,
  owner: '机主',
  note: '',
  badReason: '',
  expired: false,
  ...over,
})
const okSrc = (ip) => ({ url: 'x', ok: true, ip })
const badSrc = () => ({ url: 'y', ok: false, ip: '', why: 'ECONNRESET' })
const verdict = (rows, cur) => T.judgeRows(rows, cur, NOW)
const agg = (rows, cur) => T.aggregate(verdict(rows, cur))

t('X1 出口==期望 ⇒ ok(exit 0)', () => {
  const a = agg([row()], EXPECT)
  if (a.state !== 'ok' || a.exit !== 0 || verdict([row()], EXPECT)[0].state !== 'ok') fail(JSON.stringify(a))
})

t('X2 出口≠期望 ⇒ drift(exit 1,红优先于未判定)', () => {
  const a = agg([row(), row({ index: 1, face: 'b', state: '' })], '93.184.216.34')
  if (a.state !== 'drift' || a.exit !== 1) fail(JSON.stringify(a))
  const mixed = T.aggregate([...verdict([row({ index: 0 })], '93.184.216.34'), ...verdict([row({ index: 1, face: 'x', expires: '2026-01-01', expired: true })], EXPECT)])
  if (mixed.exit !== 1 || mixed.state !== 'drift') fail(`红被未判定顶掉:${JSON.stringify(mixed)}`)
})

t('X3 探测源全部失败 ⇒ unjudged(exit 2),绝不冒充 ok/没变化', () => {
  const cc = T.crossCheck([badSrc(), badSrc(), badSrc()])
  if (cc.currentIp !== null) fail(`全失败竟量出值:${JSON.stringify(cc)}`)
  const a = agg([row()], cc.currentIp)
  if (a.state !== 'unjudged' || a.exit !== 2) fail(JSON.stringify(a))
})

t('X4 交叉门槛:仅 1 路应答不算取到;≥2 路致才算', () => {
  const one = T.crossCheck([okSrc(EXPECT), badSrc(), badSrc()])
  if (one.currentIp !== null) fail(`单路读数被当成出口:${JSON.stringify(one)}`)
  const two = T.crossCheck([okSrc(EXPECT), okSrc(EXPECT), badSrc()])
  if (two.currentIp !== EXPECT || two.agreeing !== 2) fail(JSON.stringify(two))
})

t('X5 两路一致+一路不一致 ⇒ 取一致值(单源异常不顶死整格)', () => {
  const r = T.crossCheck([okSrc(EXPECT), okSrc(EXPECT), okSrc('8.8.8.8')])
  if (r.currentIp !== EXPECT) fail(JSON.stringify(r))
})

t('X6 台账缺文件/JSON 坏 ⇒ unjudged 且点名(analyze 走注入 fetch,零真网络)', async () => {
  const fakeFetch = async (_u) => okSrc(EXPECT)
  const miss = await T.analyze({ ledgerPath: 'Z:/definitely/not/here-eo.json', fetchImpl: fakeFetch, nowMs: NOW, env: {} })
  if (miss.state !== 'unjudged' || miss.exit !== 2 || !/台账读不到/.test(miss.counts.fatal || '')) fail(JSON.stringify(miss.counts))
  const dir = mkScratch('eo-drift-')
  try {
    const bad = join(dir, 'broken.json')
    writeFileSync(bad, '{ not json', 'utf8')
    const r2 = await T.analyze({ ledgerPath: bad, fetchImpl: fakeFetch, nowMs: NOW, env: {} })
    if (r2.state !== 'unjudged' || !/不可解析/.test(r2.counts.fatal || '')) fail(JSON.stringify(r2.counts))
    const empty = join(dir, 'empty.json')
    writeFileSync(empty, '{"schema":1,"rows":[]}', 'utf8')
    const r3 = await T.analyze({ ledgerPath: empty, fetchImpl: fakeFetch, nowMs: NOW, env: {} })
    if (r3.state !== 'unjudged') fail(`rows=0 被读成绿:${JSON.stringify(r3.counts)}`)
  } finally {
    rmScratch(dir)
  }
})

t('X7 行形状坏逐条点名,同行族其余行照判(一颗坏行不消音整轮)', () => {
  const txt = JSON.stringify({
    schema: 1,
    rows: [
      { face: 'good.face', expectedIPv4: EXPECT, port: 8801, owner: '机主', judge: true, updatedOn: '2026-10-21', expires: '2026-11-20' },
      { face: 'noip.face', expectedIPv4: 'not-an-ip', owner: '机主', judge: true, updatedOn: '2026-10-21', expires: '2026-11-20' },
      { face: 'noowner.face', expectedIPv4: EXPECT, judge: true, updatedOn: '2026-10-21', expires: '2026-11-20' },
      { face: 'noexp.face', expectedIPv4: EXPECT, owner: '机主', judge: true, updatedOn: '2026-10-21' },
    ],
  })
  const p = T.parseLedger(txt, NOW)
  if (p.fatal) fail(`整档被误杀:${p.fatal}`)
  const v = verdict(p.rows, EXPECT)
  if (v[0].state !== 'ok') fail(`好行被坏行连坐:${JSON.stringify(v[0])}`)
  for (const [i, why] of [[1, 'IPv4'], [2, 'owner'], [3, 'expires']])
    if (v[i].state !== 'unjudged' || !v[i].reason.includes(why)) fail(`坏行 ${v[i].face} 未点名到因:${JSON.stringify(v[i])}`)
  if (T.aggregate(v).exit !== 2) fail('行级未判定没进退出码')
})

t('X8 expires 过期 ⇒ 该行 unjudged(该重裁,§0.7 到期族)', () => {
  const v = verdict([row({ expires: '2026-09-30', expired: true })], EXPECT)
  if (v[0].state !== 'unjudged' || !/过期/.test(v[0].reason)) fail(JSON.stringify(v[0]))
})

t('X9 judge=false 与可判行混排不改退出码;整档只剩登记行 ⇒ 可判枚举为 0 判死不记绿', () => {
  const mixed = T.aggregate([...verdict([row()], EXPECT), ...verdict([row({ index: 1, face: 'reg', judge: false, expectedIPv4: null })], EXPECT)])
  if (mixed.exit !== 0 || mixed.counts.registered !== 1) fail(`登记行影响了绿/退出码:${JSON.stringify(mixed)}`)
  const only = T.aggregate(verdict([row({ judge: false, expectedIPv4: null })], EXPECT))
  if (only.state !== 'unjudged' || only.exit !== 2 || !/枚举为 0/.test(JSON.stringify(only.counts))) fail(JSON.stringify(only))
})

t('X10 结论行恒纯 ASCII 且三键在位(§5d 码页坑)', () => {
  const out = { state: 'drift', currentIp: '93.184.216.34', expectedSet: EXPECT, verdicts: [row()], sources: [okSrc(EXPECT), badSrc()], proxyEnv: 'clean', simulated: 'false', counts: { ok: 0, drift: 1, unjudged: 0, registered: 0 } }
  const line = T.machineLine(out)
  if (!/^[\x20-\x7E]+$/.test(line)) fail(`结论行混入非 ASCII:${JSON.stringify(line)}`)
  for (const k of ['state=drift', 'current=93.184.216.34', `expected=${EXPECT}`]) if (!line.includes(k)) fail(`结论行缺 ${k}`)
})

t('X11 代理 env 如实报出(探测恒直连:核心 https 不读 env)', () => {
  if (T.proxyEnvState({}) !== 'clean') fail('无代理被判 detected')
  const d = T.proxyEnvState({ HTTPS_PROXY: 'http://127.0.0.1:7897' })
  if (!/^detected\(HTTPS_PROXY\)$/.test(d)) fail(d)
})

t('X12 IPv6 应答按源失败(强制 IPv4 判据)', () => {
  const r = T.crossCheck([{ url: 'a', ok: true, ip: '2408:8207:0::1' }, okSrc(EXPECT), okSrc(EXPECT)])
  if (r.answered !== 2 || r.currentIp !== EXPECT) fail(`v6 漏进交叉:${JSON.stringify(r)}`)
  if (T.isIPv4('2408:8207::1') || !T.isIPv4('218.27.70.129') || T.isIPv4('999.1.1.1')) fail('isIPv4 面值不对')
})

t('X13 sameIp 去空白后相等(响应尾 \r\n 不产假 drift)', () => {
  const v = verdict([row()], ` ${EXPECT}\r\n`)
  if (v[0].state !== 'ok') fail(JSON.stringify(v[0]))
})

t('X14 变异对照:把比较逻辑摘掉的副本必判不出同一 drift 夹具(证明 X2 有牙)', async () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'check-egress-ip-drift.mjs'), 'utf8')
  const needle = 'function sameIp(a, b) { return normIp(a) === normIp(b) }'
  if (!src.includes(needle)) fail('变异锚点行不在源文件里 —— 锚点漂了,本对照已失效')
  const dir = mkScratch('eo-drift-mut-')
  try {
    const mut = join(dir, 'mutated.mjs')
    mkdirSync(dir, { recursive: true })
    writeFileSync(mut, src.replace(needle, 'function sameIp(a, b) { return true }'), 'utf8')
    const M = (await import(pathToFileURL(mut).href)).__test__
    const a = T.aggregate(T.judgeRows([row()], '93.184.216.34', NOW))
    const m = M.aggregate(M.judgeRows([row()], '93.184.216.34', NOW))
    if (a.state !== 'drift') fail(`真副本先就不是 drift:${JSON.stringify(a)}`)
    if (m.state !== 'ok') fail(`摘掉比较后仍判出 drift(变异未生效或判据另有副本):${JSON.stringify(m)}`)
  } finally {
    rmScratch(dir)
  }
})

let pass = 0
const errs = []
for (const c of cases) {
  try {
    await c.fn()
    pass += 1
  } catch (e) {
    errs.push(`${c.name} — ${String(e && e.message).slice(0, 200)}`)
  }
}
for (const e of errs) console.log(`❌ ${e}`)
console.log(`\n镜像 ${pass}/${cases.length} 通过${errs.length ? `,失败 ${errs.length} 条` : ''}(判据 import 源脚本 __test__,全程零真网络、夹具全在 mkScratch)`)
process.exit(errs.length ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
