#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 不响应服务的自愈动作器(第 3 层)—— 默认只读,`--apply` 才动。
 *
 * 为什么需要它(2026-10-01 机主拍板的三层重启方案,台账 G-978121):
 *   本机 22 个服务里 21 个是 nssm 包装的。对这一族,SCM 的恢复动作**结构上不会触发** ——
 *   死的是里面的子进程,`nssm.exe` 自己还活着,服务状态一直是 Running。nssm 的退出重启只覆盖
 *   "子进程退出"那一型;而这台机真出过的两次事故恰好都不在里头:一次是**路径烂掉导致子进程根本起不来**
 *   (RSSHub 静默停 3 天),一次是**进程在但不应答**。两种都表现为"服务 Running、端口不通" ⇒
 *   需要一个看端口的动作器。
 *
 * 三条不可漂的写法:
 *  1. **判据只有一份**:"是否应答 / 是否 RUNNING"一律取 `check-service-binary-paths.mjs --json` 的现值,
 *     本文件内**不得出现 net.connect / createConnection 之类第二把应答尺子**(§"两处算同一件事必漂移")。
 *     重启之后的复验也走同一把尺子(再跑一次门),不自己握手。
 *  2. **未判定永不动作**:门的应答维给不出结论时(含"任务型无端口"),既不记故障也不清零,只报名。
 *     把"没判"当成"沉默的坏"会让一台量不到的尺子获得重启生产的权力。
 *  3. **名单是台账不是常量**:每条必须带 reason + owner + reviewBy,过期即降级为"不行动并报名";
 *     白名单为空/解析不到 ⇒ 整轮不行动并 exit 2(空表不等于"都没有",同守门 120 那条)。
 *
 * 用法:
 *   node scripts/heal-unresponsive-services.mjs                 # 只读:打印每一台会怎么处置
 *   node scripts/heal-unresponsive-services.mjs --json          # 机器可读面(守护派发用)
 *   node scripts/heal-unresponsive-services.mjs --apply         # 真重启(仍受冷却/窗口上限约束)
 *   node scripts/heal-unresponsive-services.mjs --self-test     # 构造面正反例,零派生、零写盘
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 遮噪只引这一份实现(§22c / 守门 131·134·157 同一条理由:两处各写一遍必然漂开)。
import { maskCommentsStringsAndRegex } from './lib/code-mask.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const CONFIG_REL = 'scripts/data/service-auto-restart.json'
export const STATE_REL = '.workbuddy/service-heal-state.json'
export const GATE_REL = 'scripts/check-service-binary-paths.mjs'
export const NSSM_CANDIDATES = ['C:\\Windows\\System32\\nssm.exe', 'C:/Windows/System32/nssm.exe']
export const GATE_TIMEOUT_MS = Number(process.env.IHUI_SERVICE_HEAL_GATE_TIMEOUT_MS || 300_000)
export const RESTART_TIMEOUT_MS = Number(process.env.IHUI_SERVICE_HEAL_RESTART_TIMEOUT_MS || 120_000)
const DAY_MS = 86_400_000

/** 台账解析:字段不齐 / 形状漂了 ⇒ 抛错由调用方折叠成"整轮不行动"。 */
export function parseConfig(text, nowMs = Date.now()) {
  let raw
  try {
    raw = JSON.parse(String(text))
  } catch (e) {
    throw new Error(`台账 JSON 解析失败:${e?.message ?? e}`)
  }
  const lim = raw.limits || {}
  const limits = {
    consecutiveRounds: pos(lim.consecutiveRounds, 2),
    cooldownMinutes: pos(lim.cooldownMinutes, 60),
    maxRestartsPerWindow: pos(lim.maxRestartsPerWindow, 2),
    windowMinutes: pos(lim.windowMinutes, 60),
  }
  const list = Array.isArray(raw.services) ? raw.services : []
  if (list.length === 0) throw new Error('台账 services 为空 ⇒ 拒绝整轮动作(空表不等于"都没有",不能据此判定"无事可做")')
  const problems = []
  const services = []
  for (const s of list) {
    const name = typeof s?.name === 'string' ? s.name.trim() : ''
    if (!name) {
      problems.push('有一条缺 name')
      continue
    }
    const missing = ['reason', 'owner', 'reviewBy'].filter((k) => typeof s[k] !== 'string' || s[k].trim() === '')
    if (missing.length) {
      problems.push(`${name}:缺 ${missing.join('/')}`)
      continue
    }
    const due = Date.parse(s.reviewBy)
    if (!Number.isFinite(due)) {
      problems.push(`${name}:reviewBy 不是可解析日期(${s.reviewBy})`)
      continue
    }
    const expired = due < nowMs
    services.push({ name, reason: s.reason.trim(), owner: s.owner.trim(), reviewBy: s.reviewBy, expired })
    if (expired) problems.push(`${name}:复核日已过期(${s.reviewBy})⇒ 本轮不行动`)
  }
  if (services.length === 0) throw new Error(`台账里没有任何可用条目(${problems.join('; ') || '全被字段问题挡掉'})`)
  return { limits, services, problems, excluded: Array.isArray(raw.excluded) ? raw.excluded : [] }
}
const pos = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d)

/**
 * 把门 153 的一份报告折叠成动作器需要的四态。**这里不产生任何新的应答判据**,只做映射:
 *  - `answering` 实测在听且探到应答
 *  - `silent`    RUNNING 而探不到应答(且它确实声明/观测到了端口)
 *  - `down`      STATE 不是 RUNNING
 *  - `undetermined` 别的任何情形(包括"任务型无端口"、门取不到值、这台服务不在门的面上)
 */
export function verdictOf(name, gate) {
  if (!gate || typeof gate !== 'object') return { verdict: 'undetermined', why: '门的报告里没有这台服务' }
  const rec = gate.rec || {}
  const state = rec.state
  if (!state || state.kind !== 'measured') return { verdict: 'undetermined', why: '服务态量不到' }
  if (state.value !== 'RUNNING') return { verdict: 'down', why: `STATE=${state.value}` }
  const probe = rec.probe
  if (!probe || probe.kind !== 'measured') return { verdict: 'undetermined', why: `应答维未判定:${probe?.reason ?? '没有该维'}` }
  if (probe.value?.listening === true) return { verdict: 'answering', why: (probe.value.ports || []).join(',') || '应答' }
  const labels = probe.value?.labels || probe.value?.ports || []
  if (!labels.length) return { verdict: 'undetermined', why: '应答维给的是"无可探端点",不推测为故障' }
  return { verdict: 'silent', why: `不应答:${labels.join(',')}${probe.value?.why ? ` —— ${probe.value.why}` : ''}` }
}

/**
 * 单轮决策(纯函数)。输入 = 台账 + 上次状态 + 本轮四态读数 + 是否允许动作。
 * 输出 kind:restart / planned / watch / cooldown / window-capped / not-in-list / cleared / undetermined。
 */
export function decideRound({ config, state, verdicts, nowMs, apply = false }) {
  const limits = config.limits
  const byName = new Map(config.services.map((s) => [s.name, s]))
  const prev = state && state.services ? state.services : {}
  const windowCutoff = nowMs - limits.windowMinutes * 60_000
  const recent = (Array.isArray(state?.restarts) ? state.restarts : []).filter((t) => Number.isFinite(t) && t > windowCutoff)
  const next = { services: {}, restarts: [...recent] }
  const actions = []
  let inWindow = recent.length
  for (const [name, v] of Object.entries(verdicts)) {
    const entry = byName.get(name)
    const p = prev[name] || { strikes: 0, lastRestartMs: null }
    const keep = (strikes) => {
      next.services[name] = { strikes, lastRestartMs: p.lastRestartMs ?? null, lastVerdict: v.verdict }
    }
    if (!entry) {
      actions.push({ name, kind: 'not-in-list', why: '不在白名单(排除项或未登记)⇒ 不行动' })
      keep(p.strikes ?? 0)
      continue
    }
    if (entry.expired) {
      actions.push({ name, kind: 'undetermined', why: `台账复核日过期(${entry.reviewBy})⇒ 本轮不行动,请回看` })
      keep(p.strikes ?? 0)
      continue
    }
    if (v.verdict === 'answering') {
      // 即使健康也要逐台报名:否则"7 台都应答"与"循环没跑到/名单空"在读数上完全同形
      // (本仓最贵的假绿就是把"没判"或"没跑"读成"没问题")。
      actions.push({ name, kind: 'answering', why: (p.strikes ?? 0) > 0 ? `应答恢复 ⇒ 计数清零:${v.why}` : `应答正常:${v.why}` })
      keep(0)
      continue
    }
    if (v.verdict === 'undetermined') {
      actions.push({ name, kind: 'undetermined', why: `未判定:${v.why} ⇒ 不记故障也不清零` })
      keep(p.strikes ?? 0)
      continue
    }
    const strikes = (p.strikes ?? 0) + 1
    if (strikes < limits.consecutiveRounds) {
      actions.push({ name, kind: 'watch', why: `${v.verdict}(第 ${strikes}/${limits.consecutiveRounds} 轮):${v.why}` })
      keep(strikes)
      continue
    }
    const since = p.lastRestartMs ? nowMs - p.lastRestartMs : Infinity
    if (since < limits.cooldownMinutes * 60_000) {
      actions.push({ name, kind: 'cooldown', why: `${Math.round(since / 60_000)} 分钟前刚拉起过(冷却 ${limits.cooldownMinutes} 分钟)⇒ 本轮不再动,请人看` })
      keep(strikes)
      continue
    }
    if (inWindow >= limits.maxRestartsPerWindow) {
      actions.push({ name, kind: 'window-capped', why: `本 ${limits.windowMinutes} 分钟窗口已动作 ${inWindow}/${limits.maxRestartsPerWindow} 台 ⇒ 防重启风暴,本轮不动` })
      keep(strikes)
      continue
    }
    if (!apply) {
      actions.push({ name, kind: 'planned', why: `${v.verdict} 连续 ${strikes} 轮 ⇒ 加 --apply 会重启它:${v.why}` })
      keep(strikes)
      continue
    }
    actions.push({ name, kind: 'restart', why: v.why })
    next.restarts.push(nowMs)
    inWindow += 1
    keep(0)
    next.services[name] = { strikes: 0, lastRestartMs: nowMs, lastVerdict: v.verdict }
  }
  next.updatedAt = new Date(nowMs).toISOString()
  return { actions, next }
}

export function readState(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return { services: {}, restarts: [] }
  }
}
export function writeState(p, st) {
  mkdirSync(path.dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(st, null, 2) + '\n', 'utf8')
}
export function resolveNssm(exists = existsSync) {
  return NSSM_CANDIDATES.find((p) => exists(p)) ?? null
}
/** 复验用:重启后再问一次同一把尺子(单服务)。不做本地握手。 */
export function buildGateArgs(name) {
  return name ? [GATE_REL, '--json', '--service', name] : [GATE_REL, '--json']
}

const defaultDeps = {
  gate(reportName = null) {
    try {
      const stdout = execFileSync(process.execPath, buildGateArgs(reportName), {
        cwd: ROOT,
        windowsHide: true, // §5b:漏此参数在守护/计划任务下必弹控制台窗
        timeout: GATE_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
        maxBuffer: 1 << 24,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
      })
      return { ok: true, json: stdout }
    } catch (e) {
      return { ok: false, why: `门派生失败(rc=${e?.status ?? '?'}):${String(e?.stderr || e?.message || '').split(/\r?\n/)[0]}` }
    }
  },
  restart(name) {
    const bin = resolveNssm()
    if (!bin) return { ok: false, why: 'nssm 不在位 ⇒ 无法动作(不是"已恢复")' }
    if (process.platform !== 'win32') return { ok: false, why: `非 win32(${process.platform})⇒ 不复验` }
    try {
      execFileSync(bin, ['restart', name], {
        windowsHide: true,
        timeout: RESTART_TIMEOUT_MS,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf16le', // nssm 的输出面是 UTF-16LE(实测),按 UTF-8 解会得到乱码结论
      })
      return { ok: true }
    } catch (e) {
      return { ok: false, why: `nssm restart 失败:${String(e?.stderr || e?.message || '').slice(0, 160)}` }
    }
  },
  sleep(ms) {
    const until = Date.now() + ms
    while (Date.now() < until) {
      /* 守护内同步等待:动作罕见,起定时器会被宿主清掉(§26 那一型) */
    }
  },
}

/**
 * stdout/stderr 分配(判据派发侧的读法决定它必须长这样)。
 * `--json` 档的 stdout **只能是纯 JSON** —— 派发方(`git-guardian` 的 `healUnresponsiveServices`)判的就是
 * `JSON.parse(stdout)`;把"动作器完 …"这种人读行拼在 JSON 前面,派发方每一轮都会记成"未拿到可解析结论",
 * 于是真发生了重启或失败也**永远不会到人**(§1 水印门那条"--json 面必须是可 JSON.parse 的纯 JSON"同型)。
 * 人读行不退场,退到 stderr:人工跑 `--json` 时仍看得见结论,而两个流各自语义单一。
 */
export function renderExit(r) {
  if (r && r.json) return { stdout: r.json, stderr: r.text || '' }
  return { stdout: (r && r.text) || '', stderr: '' }
}

export async function main({ argv = process.argv.slice(2), deps = defaultDeps, now = Date.now, configFile = null, stateFile = null } = {}) {
  const opts = { json: false, apply: false, selfTest: false }
  for (const a of argv) {
    if (a === '--json') opts.json = true
    else if (a === '--apply') opts.apply = true
    else if (a === '--self-test') opts.selfTest = true
    else if (a !== '--') return { text: `未知参数:${a}`, exit: 2 }
  }
  if (opts.selfTest) return selfTest()
  const cfgPath = configFile ? path.resolve(configFile) : path.join(ROOT, CONFIG_REL)
  const statePath = stateFile ? path.resolve(stateFile) : path.join(ROOT, STATE_REL)
  if (!existsSync(cfgPath)) return { text: `❌ 台账不在位:${CONFIG_REL} ⇒ 拒绝动作`, exit: 2 }
  let config
  try {
    config = parseConfig(readFileSync(cfgPath, 'utf8'), now())
  } catch (e) {
    return { text: `❌ 台账不可用:${e?.message ?? e} ⇒ 本轮不行动`, exit: 2 }
  }
  if (!existsSync(path.join(ROOT, GATE_REL))) return { text: `❌ 判据脚本不在位:${GATE_REL} ⇒ 拒绝动作`, exit: 2 }
  const rep = deps.gate(null)
  if (!rep || !rep.ok) return { text: `❌ 取不到服务应答报告:${rep?.why ?? '未知'} ⇒ 本轮不行动(未判定不是"都健康")`, exit: 2 }
  let gate
  try {
    gate = JSON.parse(rep.json)
  } catch (e) {
    return { text: `❌ 报告不可解析:${e?.message ?? e} ⇒ 本轮不行动`, exit: 2 }
  }
  const byName = new Map((gate.services || []).map((s) => [s.name, s]))
  if ((gate.services || []).length === 0) return { text: '❌ 门的报告里一个服务都没有 ⇒ 判据失明,不记为通过', exit: 2 }
  const verdicts = {}
  for (const s of config.services) verdicts[s.name] = verdictOf(s.name, byName.get(s.name))
  const state = readState(statePath)
  const { actions, next } = decideRound({ config, state, verdicts, nowMs: now(), apply: opts.apply })
  const results = []
  for (const a of actions.filter((x) => x.kind === 'restart')) {
    const r = deps.restart(a.name)
    if (!r.ok) {
      results.push({ name: a.name, kind: 'restart-failed', why: r.why })
      continue
    }
    deps.sleep(20_000)
    const after = deps.gate(a.name)
    let v = { verdict: 'undetermined', why: '复验取不到报告' }
    if (after?.ok) {
      try {
        const g = JSON.parse(after.json)
        const e2 = (g.services || []).find((x) => x.name === a.name)
        if (e2) v = verdictOf(a.name, e2)
      } catch {
        /* 保持未判定 */
      }
    }
    results.push({ name: a.name, kind: v.verdict === 'answering' ? 'restarted-recovered' : 'restarted-unverified', why: `${v.verdict}:${v.why}` })
  }
  if (opts.apply) writeState(statePath, next)
  const act = (kind) => actions.filter((a) => a.kind === kind).length
  const counts = {
    checked: Object.keys(verdicts).length,
    answering: act('answering'),
    planned: act('planned'),
    restarted: results.filter((r) => r.kind.startsWith('restarted')).length,
    failed: results.filter((r) => r.kind === 'restart-failed').length,
    watch: act('watch'),
    cooldown: act('cooldown'),
    capped: act('window-capped'),
    undetermined: act('undetermined'),
    offlist: act('not-in-list'),
  }
  const body = [...actions.map((a) => `· ${a.name} ${a.kind} — ${a.why}`), ...results.map((r) => `✔ ${r.name} ${r.kind} — ${r.why}`)].join('\n')
  const line =
    `动作器完 ${new Date(now()).toISOString()} | ${opts.apply ? 'APPLY' : '只读'} | 在册 ${counts.checked} 台:应答 ${counts.answering} / 计划 ${counts.planned} / 已重启 ${counts.restarted} / 失败 ${counts.failed} / 观察 ${counts.watch} / 冷却 ${counts.cooldown} / 窗口封顶 ${counts.capped} / 未判定 ${counts.undetermined} / 名单外 ${counts.offlist}`
  const exit = counts.failed > 0 || counts.restarted > 0 ? 1 : 0
  if (opts.json) {
    return { json: JSON.stringify({ at: new Date(now()).toISOString(), apply: opts.apply, counts, actions, results }, null, 2), exit, text: line }
  }
  return { text: `${body}\n${line}`, exit }
}

/** 构造面自检:零派生、零写盘。每条正例都配一条反例。 */
async function selfTest() {
  const out = []
  let fail = 0
  const ok = (name, cond) => {
    const v = typeof cond === 'function' ? (() => ({ bad: true }))() : cond
    if (v === true) out.push(`  ✔ ${name}`)
    else {
      fail++
      out.push(`  ✘ ${name}${typeof cond === 'function' ? '(cond 是函数 ⇒ 断言从未求值)' : ''}`)
    }
  }
  const NOW = Date.parse('2026-10-01T12:00:00Z')
  const cfg = {
    limits: { consecutiveRounds: 2, cooldownMinutes: 60, maxRestartsPerWindow: 2, windowMinutes: 60 },
    services: [
      { name: 'A', reason: 'r', owner: 'o', reviewBy: '2027-01-01', expired: false },
      { name: 'B', reason: 'r', owner: 'o', reviewBy: '2027-01-01', expired: false },
    ],
    excluded: [],
  }
  const empty = { services: {}, restarts: [] }
  ok('H1 首轮不应答只记观察、不动作(单轮抖动不算故障)', (() => {
    const r = decideRound({ config: cfg, state: empty, verdicts: { A: { verdict: 'silent', why: 'x' } }, nowMs: NOW, apply: true })
    return r.actions[0].kind === 'watch' && !r.actions.some((a) => a.kind === 'restart')
  })())
  ok('H2 连续两轮 + apply ⇒ 真重启一条', (() => {
    const st = { services: { A: { strikes: 1, lastRestartMs: null } }, restarts: [] }
    const r = decideRound({ config: cfg, state: st, verdicts: { A: { verdict: 'silent', why: 'x' } }, nowMs: NOW, apply: true })
    return r.actions[0].kind === 'restart' && r.next.restarts.length === 1 && r.next.services.A.lastRestartMs === NOW
  })())
  ok('H3 同一情形在只读档只能是 planned(默认不写盘、不动手)', (() => {
    const st = { services: { A: { strikes: 1, lastRestartMs: null } }, restarts: [] }
    const r = decideRound({ config: cfg, state: st, verdicts: { A: { verdict: 'silent', why: 'x' } }, nowMs: NOW, apply: false })
    return r.actions[0].kind === 'planned' && r.next.restarts.length === 0
  })())
  ok('H4 未判定 ⇒ 既不清零也不记故障(把"没判"当坏 = 让量不到的尺子获得重启权)', (() => {
    const st = { services: { A: { strikes: 1, lastRestartMs: null } }, restarts: [] }
    const r = decideRound({ config: cfg, state: st, verdicts: { A: { verdict: 'undetermined', why: '门的应答维没结论' } }, nowMs: NOW, apply: true })
    return r.actions[0].kind === 'undetermined' && r.next.services.A.strikes === 1
  })())
  ok('H5 恢复应答 ⇒ 计数清零且**逐台报名**(成对:H4 不清零、这里必须清;健康不许是静默)', (() => {
    const st = { services: { A: { strikes: 1, lastRestartMs: null } }, restarts: [] }
    const r = decideRound({ config: cfg, state: st, verdicts: { A: { verdict: 'answering', why: 'ok' } }, nowMs: NOW, apply: true })
    return r.next.services.A.strikes === 0 && r.actions[0].kind === 'answering' && /清零/.test(r.actions[0].why)
  })())
  ok('H5b 全都应答时读数非空:每台各一条(把"没跑"与"没问题"分开)', (() => {
    const r = decideRound({ config: cfg, state: empty, verdicts: { A: { verdict: 'answering', why: 'ok' }, B: { verdict: 'answering', why: 'ok' } }, nowMs: NOW, apply: false })
    return r.actions.length === 2 && r.actions.every((a) => a.kind === 'answering')
  })())
  ok('H6 冷却与窗口上限各挡一次(刚重启过不再重启;攒够阈值又遇窗口封顶才不动)', (() => {
    const cd = decideRound({
      config: cfg,
      state: { services: { A: { strikes: 1, lastRestartMs: NOW - 5 * 60_000 } }, restarts: [NOW - 5 * 60_000] },
      verdicts: { A: { verdict: 'silent', why: 'x' } },
      nowMs: NOW,
      apply: true,
    })
    const cfg3 = { ...cfg, services: [...cfg.services, { name: 'C', reason: 'r', owner: 'o', reviewBy: '2027-01-01', expired: false }] }
    // C 已攒到阈值(strikes=1,+本轮=2),而窗口里已经有 A、B 两次动作 ⇒ 轮到 C 必须被封顶。
    const st3 = {
      services: {
        A: { strikes: 1, lastRestartMs: NOW - 90 * 60_000 },
        B: { strikes: 1, lastRestartMs: NOW - 90 * 60_000 },
        C: { strikes: 1, lastRestartMs: NOW - 90 * 60_000 },
      },
      restarts: [],
    }
    const cap = decideRound({
      config: cfg3,
      state: st3,
      verdicts: { A: { verdict: 'silent', why: 'x' }, B: { verdict: 'silent', why: 'x' }, C: { verdict: 'down', why: 'STOPPED' } },
      nowMs: NOW,
      apply: true,
    })
    const kinds = Object.fromEntries(cap.actions.map((a) => [a.name, a.kind]))
    return cd.actions[0].kind === 'cooldown' && kinds.A === 'restart' && kinds.B === 'restart' && kinds.C === 'window-capped'
  })())
  ok('H7 白名单外的服务永不动作', (() => {
    const r = decideRound({ config: cfg, state: empty, verdicts: { Z: { verdict: 'silent', why: 'x' } }, nowMs: NOW, apply: true })
    return r.actions[0].kind === 'not-in-list'
  })())
  ok('H8 台账复核日过期 ⇒ 该条降级为不行动(过期豁免不是永久免检)', (() => {
    const c2 = { ...cfg, services: [{ name: 'A', reason: 'r', owner: 'o', reviewBy: '2027-01-01', expired: true }, cfg.services[1]] }
    const st = { services: { A: { strikes: 1, lastRestartMs: null } }, restarts: [] }
    const r = decideRound({ config: c2, state: st, verdicts: { A: { verdict: 'silent', why: 'x' } }, nowMs: NOW, apply: true })
    return r.actions[0].kind === 'undetermined' && r.next.services.A.strikes === 1
  })())
  ok('H9 台账:缺字段与空表都拒(空表不得被读成"都没有")', (() => {
    let e1 = null
    try {
      parseConfig(JSON.stringify({ services: [{ name: 'A', reason: 'r' }] }), NOW)
    } catch (e) {
      e1 = e
    }
    let e2 = null
    try {
      parseConfig(JSON.stringify({ services: [] }), NOW)
    } catch (e) {
      e2 = e
    }
    return e1 instanceof Error && /缺 owner\/reviewBy/.test(String(e1?.message)) && e2 instanceof Error
  })())
  ok('H10 台账里一条正常记录解析得出来,且带过期标记', (() => {
    const c = parseConfig(JSON.stringify({ services: [{ name: 'A', reason: 'r', owner: 'o', reviewBy: '2026-01-01' }] }), NOW)
    return c.services.length === 1 && c.services[0].expired === true && c.problems.length === 1
  })())
  ok('V1 四态映射:不应答=silent、非 RUNNING=down、无端口/取不到=未判定(四态不得并桶)', (() => {
    const gate = (stateVal, probe) => verdictOf('X', { rec: { state: { kind: 'measured', value: stateVal }, probe } })
    const silent = { kind: 'measured', value: { listening: false, labels: ['127.0.0.1:8802'] } }
    const answering = { kind: 'measured', value: { listening: true, ports: [8802] } }
    const noEndpoint = { kind: 'measured', value: { listening: false, labels: [] } }
    const noAnswerDim = { kind: 'unmeasured', reason: '任务型,此维不适用' }
    return (
      gate('RUNNING', silent).verdict === 'silent' &&
      gate('RUNNING', answering).verdict === 'answering' &&
      gate('STOPPED', answering).verdict === 'down' &&
      gate('RUNNING', noAnswerDim).verdict === 'undetermined' &&
      // "量到它在听、却一个端点都列不出" ≠ 故障:那是没看清。让它换到重启权,是本动作器最贵的假绿。
      gate('RUNNING', noEndpoint).verdict === 'undetermined' &&
      verdictOf('X', null).verdict === 'undetermined'
    )
  })())
  ok('V2 复验也走门:代码面不得出现第二把应答尺子(取材先过唯一遮罩实现 —— 本文件头注里就写着这些词,不剥注释会自咬)', (() => {
    const src = readFileSync(path.join(ROOT, 'scripts', 'heal-unresponsive-services.mjs'), 'utf8')
    const code = maskCommentsStringsAndRegex(src)
    const RE = /\bnet\s*\.\s*connect\b|\bcreateConnection\b|\bnew\s+Socket\s*\(/
    // 成对:同一把尺子喂一段真调用必须命中,否则 V2 只是"扫不到东西"的恒绿。
    return !RE.test(code) && RE.test(maskCommentsStringsAndRegex('const s = net.connect({ host, port })'))
  })())
  ok('V3 派生三件套:绝对路径 nssm + windowsHide + 超时,且 nssm 输出按 UTF-16 解', (() => {
    const src = readFileSync(path.join(ROOT, 'scripts', 'heal-unresponsive-services.mjs'), 'utf8')
    return (
      /windowsHide: true/.test(src) &&
      /timeout: RESTART_TIMEOUT_MS/.test(src) &&
      /encoding: 'utf16le'/.test(src) &&
      /NSSM_CANDIDATES/.test(src)
    )
  })())
  // V4/V5:必须先真的跑完再判 —— 把一个 Promise 交给 ok() 与把箭头函数交给它是同一个坑(恒真)。
  const r4 = await main({
    argv: ['--json'],
    now: () => NOW,
    deps: { gate: () => ({ ok: true, json: JSON.stringify({ services: [] }) }), restart: () => ({ ok: true }), sleep: () => {} },
  })
  ok('V4 门的报告里一个服务都没有 ⇒ 判"判据失明"并 exit 2,不得读成"都健康"', r4.exit === 2 && /失明/.test(r4.text || ''))
  const r5 = await main({ argv: [], now: () => NOW, deps: { gate: () => ({ ok: false, why: 'spawn ENOENT' }), restart: () => ({ ok: true }), sleep: () => {} } })
  ok('V5 取不到门的报告 ⇒ 同样 exit 2(未判定不是"没有故障")', r5.exit === 2 && /不行动/.test(r5.text || ''))
  // V6/V6b/V7:--json 档的 stdout 必须是**可直接 JSON.parse 的那一份**(派发侧判的就是它)。
  // 这一族是本文件真实犯过的错的锁:人读行拼在 JSON 前面 ⇒ 守护每一轮记"未拿到可解析结论",
  // 于是"拉起 / 失败"永远不会到人 —— 判据在跑,结论却没人读得到。
  // 判据用构造面而不是真跑一遍 main():main 要读真台账,那条"绿"就取决于仓库此刻有什么,不是判据。
  const o6 = renderExit({ json: '{"at":"2026-10-01T00:00:00.000Z","counts":{"checked":1}}', text: '动作器完 … | APPLY | 在册 1 台', exit: 0 })
  ok(
    'V6 --json 档:stdout 逐字可 JSON.parse(不掺任何人读行)',
    (() => {
      try {
        const p = JSON.parse(o6.stdout)
        return !!p.counts && typeof p.at === 'string'
      } catch {
        return false
      }
    })(),
  )
  ok('V6b --json 档:人读行没退场,只是改走 stderr(两流各判一件事)', o6.stderr.startsWith('动作器完') && !o6.stdout.includes('动作器完'))
  const o7 = renderExit({ text: '动作器完 … | 只读', exit: 0 })
  ok('V7 非 --json 档:人读面留在 stdout,stderr 为空(不得把两档做成同一个形状)', o7.stdout.includes('动作器完') && o7.stderr === '')
  ok('V8 接线锁:CLI 入口必须走 renderExit 那一份分配判据,不得在入口里另写一遍打印顺序', (() => {
    const src = readFileSync(path.join(ROOT, 'scripts', 'heal-unresponsive-services.mjs'), 'utf8')
    const entry = src.slice(src.indexOf('if (process.argv[1] && import.meta.url'))
    return /renderExit\(r\)/.test(entry) && !/if \(r\.text\) console\.info\(r\.text\)\s*\n\s*if \(r\.json\) console\.info\(r\.json\)/.test(entry)
  })())
  ok('V9 派发侧读法同源:git-guardian 判的是 JSON.parse(stdout),不得改成 stdout⊕stderr 拼接', (() => {
    const src = readFileSync(path.join(ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')
    return /JSON\.parse\(String\(r\.stdout \|\| ''\)\)/.test(src) && !/JSON\.parse\(String\(`\$\{r\.stdout\}/.test(src)
  })())
  const text = out.join('\n')
  return { text: `${text}\n自检 ${out.length} 条,失败 ${fail} 条`, exit: fail === 0 ? 0 : 1 }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (r) => {
      // 走 renderExit 那一份分配判据,不在这里另写一遍 console.info 的顺序(两处算同一件事必漂移)。
      const { stdout, stderr } = renderExit(r)
      if (stdout) console.log(stdout)
      if (stderr) console.error(stderr)
      process.exitCode = r.exit ?? 0
    },
    (e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exitCode = 2
    },
  )
}

export const __test__ = { parseConfig, verdictOf, decideRound, readState, writeState, resolveNssm, buildGateArgs, main, selfTest, renderExit, CONFIG_REL, STATE_REL, GATE_REL, DAY_MS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
