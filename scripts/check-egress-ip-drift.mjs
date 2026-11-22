#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 只读巡检工具,诊断信息走 console */
/**
 * check-egress-ip-drift.mjs — 家宽公网出口 IPv4 ↔ EdgeOne 源站期望值 的只读对账(2026-10-21 立)
 *
 * 立因(不是假想):2026-10 站点公网链路改为 EdgeOne **源站直填家宽公网 IPv4**
 * (`218.27.70.129:8801`,实测把回源 ttfb 从 10~45s 降到 0.28~0.34s)。代价是这个地址是
 * **动态的** —— 一变就全公网 5xx,而此前全仓没有任何尺子看守它(grep ddns/该 IP/ip-drift 零命中)。
 * 2026-10-21 立时写"本机无腾讯云/EdgeOne API 凭据 ⇒ 做不到自动改源站";**2026-10-28 更正**:
 * 生产 api 的 `.env` 里 TENCENT_SMS_* 实测可调 teo API(读 + 写)。自动改源站已落地在
 * `scripts/repair-eo-origin.mjs`;**本文件仍是只读巡检**(单一职责,不在此处写云端),期望值
 * 由守护用"EO 现配投影"的运行时台账经 `--ledger` 喂入(见 git-guardian.mjs 的 refreshEoLiveLedger)。
 *
 * 为什么**不在提交链**:它判的是机器态(这台机此刻的公网出口),挂 blocking 即 §12e 恒红门。
 * 唯一调度器 = `scripts/git-guardian.mjs` 的 `auditEgressIpDrift()`(每 2 分钟一趟,派发经
 * 唯一邮件出口 notifyGuardRed,未判定连满持续门槛才到人 —— 探测公网有瞬时抖动,单轮不可达
 * 不是故障,参照本文件 auditEnvDrift 同族做法)。
 *
 * 判据四条(全部现读,零写入):
 *   P1 现测出口 IPv4:**强制 IPv4**(本机实测有 `2408:` 族 IPv6 出口,拿默认双栈结果会把 v6
 *      当答案)—— 每路 https 一律 `family: 4` + IPv4-only 子域双保险;响应必须过 IPv4 字面量
 *      校验,IPv6/HTML/空一律按该源失败处理。**绕代理**:node 核心 https 天生不读 HTTP(S)_PROXY
 *      (只有显式装 agent 才吃),本文件不装任何 agent,并把 env 里是否存在代理变量如实报出
 *      `proxy_env=`;人工 curl 复现须带 `--noproxy '*'`(本机 Clash Verge 在 7897)。
 *   P2 交叉验证:**≥2 路独立 endpoint 给出同一 IPv4** 才算"取到了出口地址";0 路或仅 1 路应答
 *      (含"两路答案互不一致")⇒ 当前值取不到 ⇒ 未判定 —— 绝不用单路读数或空值冒充"没变化"(§0.3)。
 *   P3 期望值不硬编码:唯一来源 `scripts/data/eo-origin-expectation.json`(逐条 face/expectedIPv4/
 *      port/owner/note/judge/updatedOn/expires)。台账缺文件/JSON 坏/行形状坏 ⇒ **逐条点名**并落
 *      未判定;`expires` 到期 ⇒ 该行按"该重裁"落未判定(§0.7 豁免会到期同族纪律);`judge:false`
 *      只登记不判(不影响退出码)。judged 行枚举为 0 ⇒ 判死,不记绿。
 *   P4 三态逐维独立:任一 judged 行 current≠expected ⇒ `drift`(exit 1,红优先);
 *      否则任一行取不到/坏/过期 ⇒ `unjudged`(exit 2,不记绿也不冒红);全 ok ⇒ `ok`(exit 0)。
 *
 * 输出纪律:人读行可含中文;**结论行 `PROBE-RESULT ...` 恒纯 ASCII**(键值对,中文不进 —— §5d
 * GBK 码页会把 node stdout 的中文吃掉,而守护日志/工单都按这行取值)。
 *
 * 用法:
 *   node scripts/check-egress-ip-drift.mjs                 # 巡检(只读)
 *   node scripts/check-egress-ip-drift.mjs --check --json  # 守护派发档(同一结论,JSON 单对象)
 *   node scripts/check-egress-ip-drift.mjs --ledger <path> # 取证通道:换台账文件(外部输入,磁盘直读)
 *   node scripts/check-egress-ip-drift.mjs --set-current <ipv4> # 人工取证档:跳过网络、以该值当实测出口
 *                                                       # (输出与结论行标 simulated=true;守护**永不**使用该旗)
 *   IHUI_EGRESS_PROBE_URLS=<a,b,c>                          # 取证/换源通道:覆盖探测 endpoint 清单
 *
 * 退出码:0 = ok / 1 = drift(优先)/ 2 = unjudged(取不到输入,不出合格证)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import https from 'node:https'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const LEDGER_REL = join('scripts', 'data', 'eo-origin-expectation.json')

// 至少两个独立厂商(ipify / Fastly-icanhazip / AWS),单家抽风不顶死整格(实测 2026-10-21:
// api.ipify.org 对本机 ECONNRESET,另两路 311~751ms 一致 ⇒ P2 的"≥2 致"正是为这一型留的)
export const DEFAULT_PROBE_URLS = [
  'https://api.ipify.org',
  'https://ipv4.icanhazip.com',
  'https://checkip.amazonaws.com',
]
const PROBE_TIMEOUT_MS = 8000

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/

export function isIPv4(s) {
  return IPV4_RE.test(String(s ?? '').trim())
}

export function normIp(s) {
  return String(s ?? '').trim()
}

// 变异对照锚点(镜像测试整行替换这一枚):比较逻辑被摘掉时同一 drift 夹具必判不出
function sameIp(a, b) { return normIp(a) === normIp(b) }

/** P2 交叉验证(纯函数):≥2 路 ok 且给出同一 IPv4 ⇒ 该值;否则 null(取不到,不是"没变")。 */
export function crossCheck(results) {
  const ips = (results || []).filter((r) => r && r.ok && isIPv4(r.ip)).map((r) => normIp(r.ip))
  const count = new Map()
  for (const ip of ips) count.set(ip, (count.get(ip) || 0) + 1)
  for (const [ip, n] of count) if (n >= 2) return { currentIp: ip, agreeing: n, answered: ips.length }
  return { currentIp: null, agreeing: 0, answered: ips.length }
}

/** 台账解析(纯函数):返回逐行判定材料;文件级坏 ⇒ {fatal};行级坏 ⇒ 该行带 badReason 逐条点名。 */
export function parseLedger(text, nowMs = Date.now()) {
  let doc = null
  try {
    doc = JSON.parse(String(text))
  } catch (e) {
    return { fatal: `台账 JSON 不可解析:${String(e && e.message).slice(0, 160)}`, rows: [] }
  }
  if (!doc || !Array.isArray(doc.rows) || doc.rows.length === 0)
    return { fatal: '台账缺 rows 数组或为空枚(枚举为 0 判死,不记绿)', rows: [] }
  const rows = doc.rows.map((raw, i) => {
    const face = String(raw?.face ?? '').trim()
    const exp = normIp(raw?.expectedIPv4)
    const expires = String(raw?.expires ?? '').trim()
    const expMs = Date.parse(expires)
    const base = { index: i, face: face || `(第 ${i + 1} 行无 face)`, judge: raw?.judge === true, expires }
    const badReason = !face
      ? '缺 face'
      : !Number.isFinite(Date.parse(String(raw?.updatedOn ?? '')))
        ? 'updatedOn 不可解析'
        : !expires || !Number.isFinite(expMs)
          ? '缺 expires 或不可解析(§0.7:登记必须会到期)'
          : !raw?.owner
            ? '缺 owner(收信人不知道谁能改)'
            : base.judge && !isIPv4(exp)
              ? 'judge=true 而 expectedIPv4 不是 IPv4 字面量'
              : ''
    if (badReason) return { ...base, badReason }
    return { ...base, badReason: '', expectedIPv4: base.judge ? exp : null, port: raw?.port ?? null, owner: raw.owner, note: String(raw?.note ?? ''), expired: base.judge ? expMs < nowMs : false }
  })
  return { fatal: '', rows }
}

/** P1~P4 的行级裁决(纯函数,currentIp=null 即"出口取不到",逐行落未判定而非冒绿)。
 *  第三位形参只为既有调用点的位置契约保留 —— 过期与否在 parseLedger 那一步已算成 r.expired。 */
export function judgeRows(rows, currentIp, _nowMs = Date.now()) {
  return (rows || []).map((r) => {
    if (r.badReason) return { ...r, state: 'unjudged', reason: `台账行形状坏:${r.badReason}` }
    if (!r.judge) return { ...r, state: 'registered', reason: '登记不判(judge=false)' }
    if (r.expired) return { ...r, state: 'unjudged', reason: `台账条目已过期(expires=${r.expires || '?'})⇒ 该重裁(去 EO 控制台重读源站那一格并刷新台账)` }
    if (!currentIp) return { ...r, state: 'unjudged', reason: '出口 IPv4 未取得(交叉不足或全失败),不得冒充"没变化"' }
    return sameIp(currentIp, r.expectedIPv4)
      ? { ...r, state: 'ok', reason: '现测出口 == 期望' }
      : { ...r, state: 'drift', reason: `现测 ${currentIp} ≠ 期望 ${r.expectedIPv4}` }
  })
}

/** 聚合(纯函数):红 > 未判定 > 绿;judged 行(非 registered)枚举为 0 ⇒ 判死不记绿(§0.3)。 */
export function aggregate(verdicts) {
  const c = { ok: 0, drift: 0, unjudged: 0, registered: 0 }
  for (const v of verdicts || []) c[v.state] = (c[v.state] || 0) + 1
  const judgedTotal = c.ok + c.drift + c.unjudged
  if (c.drift > 0) return { state: 'drift', exit: 1, counts: c }
  if (judgedTotal === 0) return { state: 'unjudged', exit: 2, counts: { ...c, note: '可判行枚举为 0 ⇒ 判死' } }
  if (c.unjudged > 0) return { state: 'unjudged', exit: 2, counts: c }
  return { state: 'ok', exit: 0, counts: c }
}

/** 期望值集(结论行用):所有可判且期望可取的行,按字典序 '+' 连接;取不到 ⇒ na。 */
export function expectedSet(verdicts) {
  const set = (verdicts || []).filter((v) => v.judge && v.expectedIPv4).map((v) => v.expectedIPv4).sort()
  return set.length ? set.join('+') : 'na'
}

/** 结论行:恒纯 ASCII(§5d 码页坑 —— 守护日志与工单都按这行取值)。 */
export function machineLine(out) {
  return `PROBE-RESULT state=${out.state} current=${out.currentIp || 'na'} expected=${out.expectedSet || 'na'} faces=${(out.verdicts || []).filter((v) => v.state === 'drift' || v.state === 'ok').length} sources_ok=${(out.sources || []).filter((s) => s.ok).length}/${(out.sources || []).length} proxy_env=${out.proxyEnv} simulated=${out.simulated}`
}

export function renderText(out) {
  const lines = [`判定面:这台机此刻的公网出口 IPv4 vs 台账期望(${out.ledgerPath})`, `探测源:${out.sources.map((s) => `${s.url} => ${s.ok ? s.ip : `FAIL(${s.why})`}`).join(' | ')}`]
  for (const v of out.verdicts) {
    const tag = { ok: '✅', drift: '❌', unjudged: '❓', registered: '⏸' }[v.state] || '❓'
    lines.push(`${tag} ${v.face} —— ${v.state}:${v.reason}${v.port ? ` 端口=${v.port}` : ''}${v.owner ? ` 归属=${v.owner}` : ''}`)
  }
  lines.push(`合计:${out.state}(ok ${out.counts.ok} / drift ${out.counts.drift} / unjudged ${out.counts.unjudged} / 登记不判 ${out.counts.registered})`)
  lines.push(machineLine(out))
  return lines.join('\n')
}

/** P1 取源(唯一真网络处,可注入):强制 family:4 + UA;核心 https 不读代理 env ⇒ 直连。 */
export function fetchEgress(url, timeoutMs = PROBE_TIMEOUT_MS) {
  return new Promise((res) => {
    let done = false
    const finish = (r) => { if (!done) { done = true; res(r) } }
    let req
    try {
      req = https.get(url, { family: 4, headers: { 'User-Agent': 'ihui-egress-probe/1.0' }, timeout: timeoutMs }, (s) => {
        let body = ''
        s.setEncoding('utf8')
        s.on('data', (d) => { body += d; if (body.length > 4096) req.destroy() })
        s.on('end', () => {
          const ip = normIp(body.split(/\r?\n/)[0])
          finish(s.statusCode === 200 && isIPv4(ip) ? { url, ok: true, ip } : { url, ok: false, ip: '', why: s.statusCode !== 200 ? `http=${s.statusCode}` : `非 IPv4 字面量(${ip ? '疑 v6/HTML' : '空响应'})` })
        })
      })
    } catch (e) { finish({ url, ok: false, ip: '', why: String(e && e.message).slice(0, 120) }); return }
    req.on('timeout', () => { req.destroy(); finish({ url, ok: false, ip: '', why: `timeout>${timeoutMs}ms` }) })
    req.on('error', (e) => finish({ url, ok: false, ip: '', why: String(e && (e.code || e.message)).slice(0, 120) }))
  })
}

export function proxyEnvState(env = process.env) {
  const hit = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy'].filter((k) => env[k])
  return hit.length ? `detected(${hit[0]})` : 'clean'
}

/** 整轮编排:IO 全可注入(镜像测试经 fetchImpl 打假网络,绝不真打公网 —— §5"测试隔离"精神)。 */
export async function analyze({ root = ROOT, ledgerPath = null, urls = null, fetchImpl = fetchEgress, nowMs = Date.now(), set_current = null, env = process.env } = {}) {
  const ledgerFile = ledgerPath ? resolve(ledgerPath) : join(root, LEDGER_REL)
  const probeUrls = urls || (String(env.IHUI_EGRESS_PROBE_URLS || '').trim() ? String(env.IHUI_EGRESS_PROBE_URLS).split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_PROBE_URLS)
  const base = { face: '磁盘台账 + 本机实时公网探测(非 HEAD/索引面)', ledgerPath: ledgerFile, proxyEnv: proxyEnvState(env), simulated: set_current ? 'true' : 'false', sources: [] }
  let ledger
  try {
    ledger = parseLedger(readFileSync(ledgerFile, 'utf8'), nowMs)
  } catch (e) {
    ledger = { fatal: `台账读不到(${String(e && e.code || e)}):${ledgerFile}`, rows: [] }
  }
  let currentIp = set_current && isIPv4(normIp(set_current)) ? normIp(set_current) : null
  if (!set_current) {
    const results = await Promise.all(probeUrls.map((u) => fetchImpl(u)))
    base.sources = results
    currentIp = crossCheck(results).currentIp
  } else {
    base.sources = [{ url: '(simulated --set-current)', ok: Boolean(currentIp), ip: currentIp || '', why: currentIp ? '' : '给的不是 IPv4' }]
  }
  if (ledger.fatal) {
    const out = { ...base, currentIp, expectedSet: 'na', verdicts: [], ...aggregate([]), fatal: ledger.fatal }
    out.state = 'unjudged'; out.exit = 2; out.counts = { ok: 0, drift: 0, unjudged: 0, registered: 0, fatal: ledger.fatal }
    return out
  }
  const verdicts = judgeRows(ledger.rows, currentIp, nowMs)
  const agg = aggregate(verdicts)
  return { ...base, currentIp, expectedSet: expectedSet(verdicts), verdicts, ...agg, fatal: '' }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('用法: node scripts/check-egress-ip-drift.mjs [--check] [--json] [--ledger <path>] [--set-current <ipv4>]')
    console.log('只读巡检:本机公网出口 IPv4 vs EdgeOne 源站期望;0=ok 1=drift 2=unjudged(取不到不出合格证)。')
    return 0
  }
  const flagVal = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
  const out = await analyze({
    ledgerPath: flagVal('--ledger') || null,
    set_current: flagVal('--set-current') || null,
    urls: flagVal('--urls') ? String(flagVal('--urls')).split(',') : null,
  })
  if (argv.includes('--json')) console.log(JSON.stringify(out))
  else console.log(renderText(out))
  return out.exit
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error(`❌ 脚本自身异常(exit 2,不冒充判据结论):${String((e && e.message) || e)}`)
    process.exit(2)
  })
}

// §22c:镜像测试直接 import 判据本体,禁止在测试里再抄一份实现。
// 本文件刻意**零相对 import**(只用 node 内置)—— 镜像测试的变异对照要把逐字副本
// 落到仓库外临时目录再 dynamic import,任何 `./lib/...` 都会让副本解析不到依赖。
export const __test__ = {
  isIPv4,
  normIp,
  sameIp,
  crossCheck,
  parseLedger,
  judgeRows,
  aggregate,
  expectedSet,
  machineLine,
  renderText,
  analyze,
  proxyEnvState,
  DEFAULT_PROBE_URLS,
  LEDGER_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
