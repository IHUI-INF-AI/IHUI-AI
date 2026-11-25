// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 纯判据模块,不打日志;关闭仅为与同族 lib 保持同一头注 */
import { createHash } from 'node:crypto'

/**
 * 服务与配置面漂移判据(2026-11-25 立,第十九件)。纯函数,零 IO。
 *
 * 为什么要有:账号面(第十七件)盯的是「谁能进来」,这一面盯的是「门本身有没有被改松」。
 * 把 nssm 的 IHUI_EDGE_SECRET_MODE 从 enforce 改成 observe、把 IHUI_WAF_MODE 关掉、
 * 把服务启动类型从 AUTO_START 改成 DEMAND_START、在 0.0.0.0 上多开一个监听端口 ——
 * 这四件事做完,服务照常跑、所有原有判据照常是绿的,但防线已经换了一副样子。
 *
 * 三条设计纪律:
 *   ① **密钥类环境变量的值只存指纹**(IHUI_EDGE_SECRET / IHUI_ADMIN_PASSWORD 都是明文躺在
 *      nssm 里的,基线入仓等于把凭据抄进仓库)。比对用 sha256 前 16 位,值本身永不出 lib。
 *   ② 端口面只记「对外固定端口」—— 0.0.0.0 且 <49152。RPC 动态段(49152-65535)每次重启
 *      都换号,记进基线等于每天报一次假警。
 *   ③ 关键 env 有「期望值」而不只是「和基线一致」—— 基线若在攻击者改过之后才建,
 *      只比基线就永远发现不了。CRITICAL_ENV 写的期望是强制的,与基线无关。
 */

export const SERVICE_STATE = Object.freeze({
  OK: 'ok',
  BREACH: 'breach',
  UNDETERMINED: 'undetermined',
})

/** 三个受管面。 */
export const SERVICE_CLASSES = Object.freeze([
  { id: 'service-env', label: '服务环境变量' },
  { id: 'service-start', label: '服务启停策略' },
  { id: 'external-port', label: '对外监听端口' },
])

export const CLASS_IDS = Object.freeze(SERVICE_CLASSES.map((c) => c.id))

/**
 * 关键环境变量的**强制期望**,按「服务 + 键」逐条写。
 *
 * 为什么不能一刀切要求所有服务都 enforce:
 *   IHUI-API-ROUTER 只监听 127.0.0.1:8802(回环,公网进不来),它前面已经站着 WEB-ROUTER,
 *   所以它的 IHUI_EDGE_SECRET_MODE 实测就是 observe —— 那不是缺口,是分层设计。
 *   真正必须 enforce 的是**公网入口这一层**(WEB-ROUTER 的守卫与 WAF)。
 *   把它写成全局期望会让每轮都误报 breach,误报到人不再看告警为止。
 *
 * 这一档刻意不看基线 —— 基线本身可能就是在被改松之后建的。
 */
export const CRITICAL_ENV = Object.freeze([
  { service: 'IHUI-WEB-ROUTER', key: 'IHUI_EDGE_SECRET_MODE', expect: 'enforce', why: '公网入口,守卫必须真拦,不能只观察' },
  { service: 'IHUI-WEB-ROUTER', key: 'IHUI_WAF_MODE', expect: 'enforce', why: '公网入口的 WAF' },
  { service: 'IHUI-API-ROUTER', key: 'IHUI_WAF_MODE', expect: 'enforce', why: '回源 WAF,挡穿透 WEB-ROUTER 的载荷' },
])

/** 值属于凭据的环境变量:只存指纹。 */
export const SECRET_ENV_RE = /(SECRET|PASSWORD|PASSWD|TOKEN|APIKEY|API_KEY|PRIVATE)/i

/**
 * 开关/档位类后缀:键名里带 SECRET 但它本身是个档位,不是凭据。
 *
 * 为什么必须排除:`IHUI_EDGE_SECRET_MODE` 含 "SECRET",不排除就会被脱敏成指纹 ——
 * 于是 CRITICAL_ENV 拿指纹和 "enforce" 比永远不相等,每一次运行都误报 breach,
 * 而基线里也永远看不到这个最关键开关的真实取值。这一档是本模块最容易搞反的地方。
 */
export const SWITCH_SUFFIX_RE = /_(MODE|ENABLED|ENABLE|TYPE|LEVEL|POLICY|STRATEGY|HOURS|SECONDS|BYTES|RPS)$/i

/** 这个键的值算不算凭据。开关类一律不算。 */
export function isSecretKey(key) {
  const k = normalizeEntry(key)
  if (!k) return false
  if (SWITCH_SUFFIX_RE.test(k)) return false
  return SECRET_ENV_RE.test(k)
}

/** 端口基线只认这个段以下;49152 起是 Windows 动态/RPC 段。 */
export const DYNAMIC_PORT_FROM = 49152

/**
 * 已登记的固定端口 —— 不进基线。
 *
 * 两类:① Windows 系统固定端口;② 本机明确配过规则的高位固定端口。
 * `53389` 属后者:它在防火墙里有一条专门的 `IHUI-ALLOW-LAN-RDP-53389`(仅 192.168.1.0/24),
 * 落进动态段是端口号的巧合,不是"每次重启换号"。不登记它会让本基线每轮都点名一个
 * 早就配好的端口,报到人不再看告警为止。
 */
export const IGNORED_PORTS = Object.freeze(new Set([22, 80, 135, 139, 443, 445, 5040, 5357, 53389]))

/**
 * 已知第三方软件的对外监听 —— **只观察,不进基线**。
 *
 * 为什么按进程名而不是端口号排除:这类软件每次启动**换端口**。
 * 实测微信开发者工具在几分钟内从 11940 换到 38099(同一台机、同一个进程)。
 * 按端口号拉黑只会追不上;按进程名排除才稳定。它们进 `observed` 单列,
 * 台账里看得见,但不参与 breach 判定 —— 看得见和判红是两件事。
 */
export const OBSERVED_ONLY_PROCS = Object.freeze(new Set([
  '微信开发者工具',
  'GameViewerServer',
  'baidunetdiskhost',
  'EEventManager',
  'YunDetectService',
  'Weixin',
]))

/** 归一化:去首尾空白、压内部空白。 */
export function normalizeEntry(v) {
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ')
}

/**
 * 指纹:sha256 前 16 位 hex。用于凭据值比对 —— 改了值指纹就变,但指纹本身不能反推值。
 * 空值与缺失都返回 null(空值不产生指纹,否则会把"没设"记成"设了一个空值")。
 */
export function fingerprint(value) {
  const s = normalizeEntry(value)
  if (!s) return null
  return createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16)
}

/**
 * 解析 nssm 的 AppEnvironmentExtra 输出。
 *
 * 实测格式(2026-11-25):键值对之间用 **空行** 分隔,即 `\n\n`;
 * 同族旧文档写的"用 \r 单独分隔"在本机不成立 —— 单测按实测形态钉住,
 * 同时兼容 `\r\n\r\n` 与单 `\r` 分隔,免得换机后静默解析成 0 个键。
 *
 * @returns {{key:string,value:string}[]} 顺序按输出原序
 */
export function parseEnvBlock(text) {
  const raw = String(text == null ? '' : text)
  /* 先把三种可能的分隔统一成 \n,再按「含 = 的行」切 */
  const lines = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
  const out = []
  for (const line of lines) {
    if (!line) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    if (!key) continue
    out.push({ key, value })
  }
  return out
}

/**
 * 脱敏:凭据类只留指纹,其余原值保留。
 * @returns {Record<string,string>} key => 可直接入仓的值
 */
export function sanitizeEnv(pairs) {
  const out = {}
  for (const { key, value } of pairs) {
    if (isSecretKey(key)) {
      const fp = fingerprint(value)
      out[key] = fp == null ? '<empty>' : `sha256:${fp}`
    } else out[key] = normalizeEntry(value)
  }
  return out
}

/**
 * 把 `{ '<svc>': { KEY: value } }` 拍平成 `{ '<svc>|KEY': value }`。
 *
 * 为什么必须拍平:env 面是两层结构(服务 → 变量),如果直接拿它喂 diffEnv,
 * 比的只是「三个服务名在不在」——**变量值改了也一点看不出来**。
 * 这一条曾经让一次反向对照静默通过,是本模块第二个最容易搞反的地方。
 */
export function flattenEnv(nested) {
  const out = {}
  for (const svc of Object.keys(nested ?? {})) {
    const env = nested[svc] ?? {}
    for (const k of Object.keys(env)) out[`${svc}|${k}`] = env[k]
  }
  return out
}

/**
 * 比两面的差异。env/start 面拍平后按键值差,port 面由调用方单独处理。
 * @returns {{added:string[], removed:string[], changed:string[]}}
 */
export function diffEnv(baseline, current) {
  const b = baseline ?? {}
  const c = current ?? {}
  const added = []
  const removed = []
  const changed = []
  for (const k of Object.keys(c)) {
    if (!(k in b)) added.push(k)
    else if (normalizeEntry(b[k]) !== normalizeEntry(c[k])) changed.push(k)
  }
  for (const k of Object.keys(b)) {
    if (!(k in c)) removed.push(k)
  }
  return { added, removed, changed }
}

/**
 * 端口面:只留「对外 + 固定段」。
 * @param {(string|{addr:string})[]} listeners 形如 `0.0.0.0:8801` / `127.0.0.1:8802` / `192.168.1.37:7800`
 */
export function normalizeListeners(listeners) {
  const out = new Set()
  for (const l of listeners ?? []) {
    const s = normalizeEntry(typeof l === 'string' ? l : l?.addr)
    const idx = s.lastIndexOf(':')
    if (idx <= 0) continue
    const addr = s.slice(0, idx).trim()
    const portStr = s.slice(idx + 1).trim()
    if (!/^\d{1,5}$/.test(portStr)) continue
    const port = Number(portStr)
    /* 只要对外绑定。回环与内网 IP 不产生公网暴露面 */
    if (addr !== '0.0.0.0') continue
    if (port >= DYNAMIC_PORT_FROM) continue
    if (IGNORED_PORTS.has(port)) continue
    out.add(port)
  }
  return [...out].sort((a, b) => a - b)
}

/**
 * 端口面分流:进基线的 `tracked` 与只观察的 `observed`。
 *
 * @param {{addr:string,proc?:string}[]} rows
 * @returns {{tracked:number[], observed:number[]}}
 */
export function partitionListeners(rows, observedProcs = OBSERVED_ONLY_PROCS) {
  const tracked = new Set()
  const observed = new Set()
  for (const r of rows ?? []) {
    const s = normalizeEntry(typeof r === 'string' ? r : r?.addr)
    const proc = normalizeEntry(typeof r === 'string' ? '' : r?.proc)
    const idx = s.lastIndexOf(':')
    if (idx <= 0) continue
    const addr = s.slice(0, idx).trim()
    const portStr = s.slice(idx + 1).trim()
    if (!/^\d{1,5}$/.test(portStr)) continue
    const port = Number(portStr)
    if (addr !== '0.0.0.0') continue
    if (port >= DYNAMIC_PORT_FROM) continue
    if (IGNORED_PORTS.has(port)) continue
    if (proc && observedProcs.has(proc)) observed.add(port)
    else tracked.add(port)
  }
  return {
    tracked: [...tracked].sort((a, b) => a - b),
    observed: [...observed].sort((a, b) => a - b),
  }
}

/**
 * 关键 env 的强制期望检查(不看基线)。current 形如 `{ '<svc>': { KEY: value } }`。
 * @returns {{service:string,key:string,expect:string,actual:string|null,why:string}[]}
 */
export function criticalEnvViolations(current) {
  const c = current ?? {}
  const bad = []
  for (const { service, key, expect: want, why } of CRITICAL_ENV) {
    const env = c[service] ?? {}
    const actual = env[key] == null ? null : normalizeEntry(env[key])
    /* 缺这个键也算违规:把变量删掉和改掉是同一个效果 */
    if (actual !== want) bad.push({ service, key, expect: want, actual, why })
  }
  return bad
}

/**
 * 总判定。
 *
 * 语义:
 *   关键 env 违反强制期望 ⇒ breach(**优先于一切**,因为它意味着防线已经被换掉)
 *   无基线 ⇒ undetermined(首次需人工确认后落基线,理由同账号面:先写进去再建基线等于洗白)
 *   env 新增/删除/变更 ⇒ breach
 *   启动策略变更 ⇒ breach(改成 DEMAND_START 后重启就起不来)
 *   对外端口新增 ⇒ breach(开一个新洞)
 *   对外端口消失 ⇒ 只点名(可能是关掉了,也可能是服务挂了)
 */
export function judgeServiceDrift({ baseline, current }, opts = {}) {
  const critical = criticalEnvViolations(current?.['service-env'])
  const perClass = []
  const addedAll = []
  const removedAll = []

  /* env 面是两层结构,必须先拍平再比 —— 否则只比到「服务名在不在」 */
  const curEnvFlat = flattenEnv(current?.['service-env'])
  const baseEnvFlat = baseline ? flattenEnv(baseline['service-env']) : {}
  const envDiff = diffEnv(baseEnvFlat, curEnvFlat)
  const startDiff = diffEnv(baseline?.['service-start'], current?.['service-start'])
  const basePorts = baseline?.['external-port'] ?? []
  const curPorts = current?.['external-port'] ?? []
  const portAdded = curPorts.filter((p) => !basePorts.includes(p))
  const portRemoved = basePorts.filter((p) => !curPorts.includes(p))

  const envAdded = envDiff.added.map((k) => `env:${k}`)
  const envRemoved = envDiff.removed.map((k) => `env:${k}`)
  const envChanged = envDiff.changed.map((k) => `env:${k}`)
  const startChanged = [...startDiff.added, ...startDiff.removed, ...startDiff.changed].map((k) => `start:${k}`)
  const portAddedIds = portAdded.map((p) => `port:${p}`)
  const portRemovedIds = portRemoved.map((p) => `port:${p}`)

  const envTotal = Object.keys(curEnvFlat).length
  const startTotal = Object.keys(current?.['service-start'] ?? {}).length
  const envTouched = envAdded.length + envChanged.length
  const startTouched = startChanged.length

  perClass.push({ id: 'service-env', total: envTotal, added: [...envAdded, ...envChanged], removed: envRemoved, unchanged: envTotal - envTouched })
  perClass.push({ id: 'service-start', total: startTotal, added: startChanged, removed: startDiff.removed.map((k) => `start:${k}`), unchanged: startTotal - startTouched })
  perClass.push({ id: 'external-port', total: curPorts.length, added: portAddedIds, removed: portRemovedIds, unchanged: curPorts.length - portAddedIds.length })

  addedAll.push(...envAdded, ...envChanged, ...startChanged, ...portAddedIds)
  removedAll.push(...envRemoved, ...portRemovedIds)

  const totalCurrent = perClass.reduce((s, c) => s + c.total, 0)

  /* 采集全失败必须排在关键开关检查之前。
     否则「三个面一条都没采到」会被判成「关键开关全部缺失 ⇒ 被改松」——
     把工具自己没取到数据,报成有人在攻击,是最不能接受的一类误报。 */
  if (totalCurrent === 0) {
    return { state: SERVICE_STATE.UNDETERMINED, reason: '三个面都没采到内容(采集失败,不是"干净")', perClass, addedAll: [], removedAll: [], totalCurrent }
  }

  if (critical.length > 0) {
    return {
      state: SERVICE_STATE.BREACH,
      reason: `关键防线开关被改松: ${critical.map((c) => `${c.service}/${c.key}=${c.actual ?? '<缺失>'}(应为 ${c.expect})`).join('、')}`,
      perClass, addedAll, removedAll, totalCurrent,
    }
  }

  if (!baseline) {
    return { state: SERVICE_STATE.UNDETERMINED, reason: '没有基线,无法判新增(首次需人工确认后落基线)', perClass, addedAll: [], removedAll: [], totalCurrent }
  }
  if (addedAll.length > 0) {
    const parts = []
    if (envAdded.length + envChanged.length > 0) parts.push(`${envAdded.length + envChanged.length} 个环境变量`)
    if (startChanged.length > 0) parts.push(`${startChanged.length} 个启停项`)
    if (portAddedIds.length > 0) parts.push(`${portAddedIds.length} 个新对外端口`)
    return { state: SERVICE_STATE.BREACH, reason: `${addedAll.length} 处新增/变更: ${parts.join('、')}`, perClass, addedAll, removedAll, totalCurrent }
  }
  if (removedAll.length > 0) {
    return { state: SERVICE_STATE.OK, reason: `${removedAll.length} 处消失(需确认是否正常下线)`, perClass, addedAll, removedAll, totalCurrent }
  }
  return { state: SERVICE_STATE.OK, reason: `${totalCurrent} 项与基线一致`, perClass, addedAll, removedAll, totalCurrent }
}

/**
 * 给每条新增/消失一句可执行下一步。
 */
export function remediationForService(result) {
  const steps = []
  for (const id of result?.addedAll ?? []) {
    if (id.startsWith('env:')) {
      const k = id.slice(4)
      steps.push(`${k}: nssm get <svc> AppEnvironmentExtra 核对这一项是谁加的;不是本次运维添加就按配置篡改处理(改回并把服务重启)`)
    } else if (id.startsWith('start:')) {
      steps.push(`${id.slice(6)}: nssm get <svc> Start 核对;启动类型被改成手动后,机器重启该服务不会自己起来`)
    } else if (id.startsWith('port:')) {
      const p = id.slice(5)
      steps.push(`对外端口 ${p}: netstat -ano | findstr :${p} 找 pid → 查进程;不是本次开通就立刻关掉或加防火墙拒绝`)
    }
  }
  for (const id of result?.removedAll ?? []) {
    if (id.startsWith('port:')) steps.push(`对外端口 ${id.slice(5)} 已消失: 确认是有意关闭;若是服务异常退出则按主机侧故障处置`)
    else if (id.startsWith('env:')) steps.push(`${id.slice(4)}: 环境变量被删;缺关键变量会让服务以默认值启动,先确认改动来源`)
  }
  return steps
}

export const __test__ = {
  CLASS_IDS,
  normalizeEntry,
  fingerprint,
  isSecretKey,
  parseEnvBlock,
  sanitizeEnv,
  flattenEnv,
  diffEnv,
  normalizeListeners,
  criticalEnvViolations,
  SWITCH_SUFFIX_RE,
  SECRET_ENV_RE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
