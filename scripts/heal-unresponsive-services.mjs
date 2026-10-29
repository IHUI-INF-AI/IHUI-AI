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
export const STATE_REL = '.ihui-agent/state/service-heal-state.json'
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
  // ── 排除台账也要"验过才免、且会到期"(§0.7)────────────────────────────────────────
  // 这一族此前只是**散文**:`excluded` 整份原样透传,全仓**没有一个消费者**读过它 —— 于是
  // 它的真实作用等于零,而头注与条目 reason 里写着"只喊人"。"只喊人"这件事从来没有生产者。
  // 现在把它接进判定(见 decideRound 的 `not-in-list` 分支),并逐行要求三件:
  //  ① 一行只许一台(原先两行写成 `ihui-prometheus / ihui-loki / ihui-promtail` 这种伪名,
  //    任何按服务名的查表**结构上永远命中不了** ⇒ 5 台服务在台账里"看着有豁免",实际无人豁免);
  //  ② 带 reason(为什么不许自动重启);
  //  ③ 带可解析 reviewBy(豁免必须到期;缺或坏 ⇒ 不生效并点名,方向是**多喊一次**,不是多静音一次,§0.10)。
  const excluded = []
  const excludedByName = new Map()
  for (const e of Array.isArray(raw.excluded) ? raw.excluded : []) {
    const name = typeof e?.name === 'string' ? e.name.trim() : ''
    if (!name) {
      problems.push('excluded 有一条缺 name')
      continue
    }
    if (name.includes('/')) {
      problems.push(`excluded「${name}」一行盖多台(伪名)⇒ 按服务名查表永远命中不了 ⇒ 这行不构成豁免,请拆成逐台一行`)
      continue
    }
    const reason = typeof e?.reason === 'string' && e.reason.trim() ? e.reason.trim() : ''
    if (!reason) {
      problems.push(`excluded「${name}」缺 reason ⇒ 说不清为什么不自动重启的豁免不生效`)
      continue
    }
    const due = Date.parse(e?.reviewBy)
    if (!Number.isFinite(due)) {
      problems.push(`excluded「${name}」缺可解析 reviewBy(${e?.reviewBy ?? '(缺)'})⇒ 永不到期的豁免不生效(§0.7)`)
      continue
    }
    const item = { name, reason, reviewBy: e.reviewBy, expired: due < nowMs }
    excluded.push(item)
    excludedByName.set(name, item)
  }
  return { limits, services, problems, excluded, excludedByName }
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
  // 门已裁定『停着是设计内』(2026-10-28):退役服务与蓝绿冷备。这一档**不是故障**,动作器不得拉起它 ——
  // 拉起蓝绿冷备 = 让它用旧代码接走 router 的兜底流量(版本不一致的隐性事故);拉起退役的 IHUI-API
  // = 与 IHUI-API-ROUTER 抢 8802。判据只在门那一侧(`scripts/data/expected-stopped-services.json`),
  // 本文件**不**读状态文件、不认服务名硬编码 —— 两处各判一次必然漂移(§0.6)。
  if (gate.expectedStopped)
    return {
      verdict: 'expected-stopped',
      why: `门已裁定停着是设计内(${gate.expectedStopped.source}):${gate.expectedStopped.reason ?? ''}`,
    }
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
      next.services[name] = {
        strikes,
        lastRestartMs: p.lastRestartMs ?? null,
        // 故障链的开账时刻(2026-10-29 立):0→1 时开账,链条未恢复就一直带着,恢复(归零)即清。
        // 消费方 = `git-guardian.mjs` 的 `healUnresponsiveServices` —— 带伤期间把派发节流从 30 分钟
        // 压到 2 分钟。立因是当晚实测:09:31 重启后 web 入口没自启,09:33:15 这一轮只记到 strikes=1,
        // 而 `consecutiveRounds=2` 要下一轮才动手 ⇒ 下一轮排在 30 分钟之后 ⇒ 站点从"已经发现"到
        // "真的去拉"要等半小时。确认轮数一颗不减(防瞬时抖动),缩短的只是"一轮隔多久"。
        // 缺字段的旧状态(升级前留下的)在这里**就地盖章**:实测本机有一条 10-28 之前留下的僵尸链
        // (IHUI-API 退役后走 expected-stopped,那一支只保留计数、永不清零)——不盖章就会把快档窗口
        // 永久钉死在"刚发生";盖了 ⇒ 最多多跑一个窗口(15 分钟)快档,之后照旧按标称节流。
        sinceMs: strikes > 0 ? (Number.isFinite(p.sinceMs) ? p.sinceMs : nowMs) : null,
        lastVerdict: v.verdict,
      }
    }
    // 『停着是设计内』必须在"在册 / 不在册"之前判(2026-10-28):退役的 IHUI-API 已从 services
    // 台账移除,若先走 `!entry` 那一格,门刚裁定的 expected-stopped 会被静默吞掉 —— 报告里少一行,
    // 而"这台被判成设计内"与"这台压根没被看见"在读数上完全同形(本仓最贵的假绿正是这一型)。
    if (v.verdict === 'expected-stopped') {
      actions.push({
        name,
        kind: 'expected-stopped',
        why: v.why + (entry ? '' : '(台账未登记该服务:门已裁定设计内停止,动作器不碰)'),
      })
      keep(p.strikes ?? 0)
      continue
    }
    if (!entry) {
      // 白名单外**不重启**,但"坏了就必须对人"(2026-10-21 补)。原先这一格对 answering 也推一行,
      // 而真停的那台和它同形;更要紧的是全仓没有任何消费者读这一档 —— 台账 reason 里写着"只喊人",
      // 而"只喊人"这件事从来没有生产者(门 153 只是提交链上的 warn,几天没人提交就几天不响)。
      // ⚠️ 语义分界:`excluded` 免的是**自动重启**这一项,**不免"对人喊一声"** —— 这张表自己的
      // 措辞就是"只喊人"。所以三档都进发信集,`ackState` 只决定出路那句话怎么写、以及台账烂没烂:
      //  - acked       有人裁定过不自动重启 ⇒ 喊人时给"按登记的处置"
      //  - expired     复核日已过 ⇒ 豁免到期,喊人时点名"这条要回看"(§0.7:豁免必须会到期)
      //  - unregistered 既无服务条目也无排除条目 ⇒ 这台压根没人决定过(RSSHub 静默停 3 天那一型)
      if (v.verdict === 'down' || v.verdict === 'silent') {
        const acked = config.excludedByName?.get?.(name)
        const ackState = !acked ? 'unregistered' : acked.expired ? 'expired' : 'acked'
        actions.push({
          name,
          kind: 'not-in-list',
          ackState,
          why:
            `${v.verdict}:${v.why} ⇒ 白名单外不自动重启,` +
            (ackState === 'acked'
              ? `已登记排除(${acked.reviewBy} 前回看):${acked.reason}`
              : ackState === 'expired'
                ? `排除台账复核日已过(${acked.reviewBy})⇒ 豁免到期,请重新裁定是否仍不自动重启`
                : '既无服务条目也无排除条目 ⇒ 这台没人决定过,请补登记') +
            (v.problems?.length ? `|门 153 自报:${v.problems.join(' / ')}` : ''),
        })
      }
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

/**
 * 把"门的一次派生"分成三件事:**有结论 / 没跑到 / 门自身异常** —— 三者绝不可并桶。
 *
 * 立因(2026-10-16 现读):`check-service-binary-paths.mjs` 的 **rc=1 的含义是"量到了问题"**
 * (`totals` 当时为 22 台 · ok 3 · issue 2 · unattested 16 ⇒ exitCode 1),而它的 `--json`
 * stdout 仍是完整报告。旧写法用 `execFileSync` 的 try/catch 把**任何非零退出**一并读成
 * "取不到服务应答报告 ⇒ 本轮不行动" ⇒ 只要这台机上有任何一个服务出过问题,这第三层自愈
 * 就永久罢职,而账面每轮都在报"未判定"(与"判据失效的表现永远是安静"同族)。
 * 反过来,把"真没跑到"当成结论更糟 —— 所以只有下列三档才算未判定:
 *   ① 派生不起来(ENOENT);② 被信号/超时终止且没有 JSON;③ 门自报异常档 rc≥2(本仓退出码约定:
 *   0=成功 / 1=业务判定 / 2=脚本自身失效),或 stdout 根本解不出一份 JSON。
 */
export function classifyGateSpawn({ stdout = '', stderr = '', status = null, code = null, signal = null } = {}) {
  const text = typeof stdout === 'string' ? stdout : Buffer.from(stdout ?? '').toString('utf8')
  const rc = Number.isFinite(status) ? status : null
  const hasJson = /^\s*\{[\s\S]*\}\s*$/.test(text)
  if (hasJson && (rc === null || rc <= 1)) return { ok: true, json: text, gateRc: rc }
  const head = String(stderr || '').split(/\r?\n/)[0].slice(0, 160)
  const why =
    code === 'ENOENT'
      ? '门不可派生(ENOENT)'
      : signal
        ? `门被信号终止(${signal})`
        : rc !== null && rc >= 2
          ? `门自报异常档(rc=${rc})`
          : '门无 JSON 输出'
  return { ok: false, why: `${why}${rc === null ? '' : `(rc=${rc})`}:${head}` }
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
      return classifyGateSpawn({ stdout, status: 0 })
    } catch (e) {
      // 非零退出**不**等于没跑到:门判出问题时就是这个 rc,而 stdout 里就是结论。
      return classifyGateSpawn({
        stdout: e?.stdout ?? '',
        stderr: e?.stderr ?? '',
        status: e?.status ?? null,
        code: e?.code ?? null,
        signal: e?.signal ?? null,
      })
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
  // 名单**内**的每台要判,名单**外**的也要判 —— 否则"这台压根不在任何台账里"这一型永远不会被看见
  // (2026-10-21 现读:IHUI-OLLAMA STATE=STOPPED、Application 路径已不存在、11434 无应答,
  // 而到人通道一封信都没有;直接原因就是这个循环只遍历白名单)。
  for (const name of new Set([...config.services.map((s) => s.name), ...(gate.services || []).map((s) => s.name)])) {
    const v = verdictOf(name, byName.get(name))
    // 把门 153 **自己已经判出来的问题行**原样带到 verdict 上(纯透传,不在这里再量任何东西,§0.6)。
    // 为什么必须有:`verdictOf` 给的 `why` 只有 `STATE=STOPPED` 这一句,收信人拿到信还要再去跑
    // 一次门才知道"哦,它的 Application 指向一个已经被卸掉的 exe" —— 而那才是能整改的那一句(§5e-1)。
    const rec = byName.get(name)
    const problems = Array.isArray(rec?.problems) ? rec.problems.filter((p) => typeof p === 'string' && p.trim()).slice(0, 4) : []
    verdicts[name] = problems.length ? { ...v, problems } : v
  }
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
  // 名单外的健康/未判定**不立行**(不是故障,不该在报告里刷 13 行"不行动"),但它们必须**有数**:
  // 否则 `checked` 与各档之和不相等,读起来就像"有 13 台被漏判了"—— 而真正的漏判反而藏在这笔糊涂账里。
  const whiteSet = new Set(config.services.map((s) => s.name))
  const offVerdicts = Object.entries(verdicts)
    .filter(([name]) => !whiteSet.has(name))
    .map(([, v]) => v)
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
    // 门裁定"停着是设计内"的台数(退役服务 / 蓝绿冷备)。它是**单独一档**而不是并进 answering:
    // "按设计该停"与"量到它健康"是两件事,合并会让蓝绿冷备看起来像在服务。
    expectedStopped: act('expected-stopped'),
    // 名单外**且真坏了**的台数,再按台账形态折三档 —— 台账烂没烂必须是量得到的数(§5e-3),
    // 不能只写在散文 reason 里等人自己去读。
    offlist: act('not-in-list'),
    offlistAnswering: offVerdicts.filter((v) => v.verdict === 'answering').length,
    offlistUndetermined: offVerdicts.filter((v) => v.verdict === 'undetermined').length,
    offlistUnregistered: actions.filter((a) => a.kind === 'not-in-list' && a.ackState === 'unregistered').length,
    offlistAckExpired: actions.filter((a) => a.kind === 'not-in-list' && a.ackState === 'expired').length,
  }
  const body = [...actions.map((a) => `· ${a.name} ${a.kind} — ${a.why}`), ...results.map((r) => `✔ ${r.name} ${r.kind} — ${r.why}`)].join('\n')
  const line =
    `动作器完 ${new Date(now()).toISOString()} | ${opts.apply ? 'APPLY' : '只读'} | 在册 ${counts.checked} 台:应答 ${counts.answering} / 设计内停止 ${counts.expectedStopped} / 计划 ${counts.planned} / 已重启 ${counts.restarted} / 失败 ${counts.failed} / 观察 ${counts.watch} / 冷却 ${counts.cooldown} / 窗口封顶 ${counts.capped} / 未判定 ${counts.undetermined} / 名单外故障 ${counts.offlist}(未登记 ${counts.offlistUnregistered} / 豁免到期 ${counts.offlistAckExpired})/ 名单外健康 ${counts.offlistAnswering} / 名单外未判定 ${counts.offlistUndetermined}`
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
  // H11~H13:名单外那一格从"只有一行散文、无人消费"改成"真坏了就立行待喊人"(2026-10-21 补)。
  // 三条互相成对:健康/未判定都不许长行(H11)⇔ 真坏了必须长行且分三档(H12)⇔ 分档的依据
  // (排除台账)自身必须"验过才免、且会到期",否则 8 台服务会在"看着有豁免"的伪名下无人豁免(H13)。
  ok('H11 名单外**健康或未判定**的服务不立行(它不是故障;白名单内的应答仍每台报名)', (() => {
    const r = decideRound({ config: cfg, state: empty, verdicts: { Z: { verdict: 'answering', why: 'ok' }, Y: { verdict: 'undetermined', why: '无端口' } }, nowMs: NOW, apply: true })
    return r.actions.length === 0 && !r.actions.some((a) => a.kind === 'restart')
  })())
  ok('H12 名单外真坏了 ⇒ 恰好一行 not-in-list,ackState 三档各归各的(免自动重启 ≠ 免喊人)', (() => {
    const ackedCfg = {
      ...cfg,
      excludedByName: new Map([
        ['E', { name: 'E', reason: 'r', reviewBy: '2027-01-01', expired: false }],
        ['X', { name: 'X', reason: 'r', reviewBy: '2026-01-01', expired: true }],
      ]),
    }
    const r = decideRound({
      config: ackedCfg,
      state: empty,
      verdicts: { E: { verdict: 'down', why: 'STOPPED' }, X: { verdict: 'silent', why: '8802' }, Z: { verdict: 'down', why: 'STOPPED' } },
      nowMs: NOW,
      apply: true,
    })
    const byName = Object.fromEntries(r.actions.map((a) => [a.name, a]))
    return (
      r.actions.length === 3 &&
      byName.E.ackState === 'acked' &&
      /已登记排除/.test(byName.E.why) &&
      byName.X.ackState === 'expired' &&
      /复核日已过/.test(byName.X.why) &&
      byName.Z.ackState === 'unregistered' &&
      /没人决定过/.test(byName.Z.why) &&
      !r.actions.some((a) => a.kind === 'restart')
    )
  })())
  ok('H13 排除台账与白名单同规矩:伪名/缺 reason/缺到期 一律不入册并点名(§0.7)', (() => {
    const c = parseConfig(
      JSON.stringify({
        services: [{ name: 'A', reason: 'r', owner: 'o', reviewBy: '2027-01-01' }],
        excluded: [
          { name: 'ok1', reason: 'r', reviewBy: '2027-01-01' },
          { name: 'a / b', reason: 'r', reviewBy: '2027-01-01' },
          { name: 'noreason', reviewBy: '2027-01-01' },
          { name: 'noexpiry', reason: 'r' },
        ],
      }),
      NOW,
    )
    return (
      c.excluded.length === 1 &&
      c.excluded[0].name === 'ok1' &&
      c.excludedByName.has('ok1') &&
      !c.excludedByName.has('a / b') &&
      !c.excludedByName.has('noexpiry') &&
      c.problems.filter((p) => /^excluded/.test(p)).length === 3
    )
  })())
  ok('H14 门自报的问题行必须透传到出路句里(成对:没有 problems 时不得凭空造一句)', (() => {
    const withP = decideRound({
      config: cfg,
      state: empty,
      verdicts: { Z: { verdict: 'down', why: 'STATE=STOPPED', problems: ['Application 路径不是可用文件(missing):C:/x/ollama.exe'] } },
      nowMs: NOW,
      apply: true,
    })
    const withoutP = decideRound({ config: cfg, state: empty, verdicts: { Z: { verdict: 'down', why: 'STATE=STOPPED' } }, nowMs: NOW, apply: true })
    return (
      /门 153 自报:Application 路径不是可用文件/.test(withP.actions[0].why) &&
      !/门 153 自报/.test(withoutP.actions[0].why) &&
      withoutP.actions[0].kind === 'not-in-list'
    )
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
  // V10/V10b:门的 rc 语义。**rc=1 是"量到了问题"这一档结论**,不是"没跑到"。
  // 这一条是 2026-10-16 现读逼出来的:当时 22 台里 ok 3 / issue 2 ⇒ exitCode 1,而旧写法把
  // 非零退出整档读成"取不到报告",于是第三层自愈在"确实有服务出问题"的那些时刻**必然**罢职。
  ok('V10 门 rc=1 且 stdout 是完整 JSON ⇒ 必须当结论用(不得折成"没跑到")', (() => {
    const r = classifyGateSpawn({ stdout: JSON.stringify({ totals: { services: 22, issue: 2, exitCode: 1 } }), status: 1 })
    return r.ok === true && r.gateRc === 1 && JSON.parse(r.json).totals.issue === 2
  })())
  ok('V10b 未判定三档各有各的措辞,且一律不换动作授权(成对反向锁)', (() => {
    const enoent = classifyGateSpawn({ stdout: '', status: null, code: 'ENOENT' })
    const killed = classifyGateSpawn({ stdout: '', status: null, signal: 'SIGTERM' })
    const gateCrash = classifyGateSpawn({ stdout: '{"fatal":"x"}', status: 2 })
    const noJson = classifyGateSpawn({ stdout: '', status: 1 })
    const labeled = [enoent, killed, gateCrash, noJson].every((x) => x.ok === false && /ENOENT|信号|异常档|无 JSON/.test(x.why))
    return labeled && /ENOENT/.test(enoent.why) && !/异常档/.test(enoent.why) && !/无 JSON/.test(gateCrash.why)
  })())
  ok('V11 装车锁:成功分支与 catch 分支都必须走 classifyGateSpawn 那一份判据,旧的笼统措辞(把三档并成一档的那句)不得回来', (() => {
    const src = readFileSync(path.join(ROOT, 'scripts', 'heal-unresponsive-services.mjs'), 'utf8')
    const body = src.slice(src.indexOf('const defaultDeps = {'), src.indexOf('  restart(name)'))
    const calls = (body.match(/classifyGateSpawn\(/g) || []).length
    // 判据串自己拼出来:写进本行的字面量会命中下面对自己所在文件的搜索(说明性文字也带执行性字符)。
    const legacy = new RegExp('门' + '派生失败')
    return calls === 2 && !legacy.test(src) && /export function classifyGateSpawn/.test(src)
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

export const __test__ = { parseConfig, verdictOf, decideRound, readState, writeState, resolveNssm, buildGateArgs, classifyGateSpawn, main, selfTest, renderExit, CONFIG_REL, STATE_REL, GATE_REL, DAY_MS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
