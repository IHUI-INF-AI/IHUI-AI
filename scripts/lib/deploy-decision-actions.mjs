// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * deploy-decision-actions — 部署决策 action 闭集与「是否产事故信号」映射的**单一真相源**。
 *
 * 立因(2026-11-04 /goal 自进化轮,全部为现读实测而不是推测):
 *   生产台账 `D:/DevEnv/ihui-prod/.ihui-agent/deploy-decisions.jsonl` 第 94 行有一条
 *   `action:"swap-fail"`(2026-10-28T16:07:44Z,web 蓝绿切换失败未切流)。而:
 *     · `deploy/win/ihui-deploy.ps1` 有 **3 处** `Write-DeployDecision -Action 'swap-fail'`;
 *     · `scripts/deploy-decision.mjs` 的 `DECISION_ACTIONS` **没有**它 ⇒ 现跑
 *       `--action swap-fail --dry-run` 直接 `DEPLOY-DECISION-ERROR action 非法`
 *       ⇒ 这三类严重的"切流失败"事件现在**根本记不进机读台账**(PowerShell 只落一行日志);
 *     · `scripts/deploy-outcome-intake.mjs` 的 `OUTCOME_MAP` 也没有它 ⇒ 读到历史那一行时
 *       `decisionToSignal` 抛形状坏 ⇒ `main()` 整趟 `return 2`、零信号产出。
 *   下游 `.ihui-agent/state/incident-signals.jsonl` 停在 2026-10-29 16:46 共 6 行,
 *   而 `deploy-outcome-intake-dispatch-last.json` 仍每 20 分钟刷新一次 ⇒
 *   **腿一直在跑、闭环一直零产出**,A1-A10 七维尺全绿量不到这一格。
 *
 * 根因是 §0.6「同类判据/清单全仓只许一份」被三处手写清单违背:发射面(PS1)、记账面
 * (deploy-decision)、摄入面(deploy-outcome-intake)各持一份 action 集合,必然漂移。
 * 本文件把两件事一次性收口:
 *   ① `DEPLOY_DECISION_ACTIONS` —— 合法 action 闭集(记账与发射共用);
 *   ② `OUTCOME_SIGNAL_RULES`   —— 每个 action 是否产事故信号及其 kind/severity,
 *      **键集合与 ① 结构同生共死**:新增 action 而不给映射 = 自检立刻判红。
 *
 * 消费方(不得再自抄清单):
 *   - scripts/deploy-decision.mjs        → `export const DECISION_ACTIONS = DEPLOY_DECISION_ACTIONS`
 *   - scripts/deploy-outcome-intake.mjs  → `export const OUTCOME_MAP = OUTCOME_SIGNAL_RULES`
 *   - scripts/tests/deploy-decision-actions.test.mjs → 发射面(PS1)对账 + 两侧同源锁 + 端到端
 *
 * `null` = 该 action 不产信号(健康出口 / 未判定出口)。语义见各 action 的行内注。
 * 新增出口必须**同时**在此登记映射,否则 `assertActionParity()` 判红;这是机器锁,不靠人记得。
 */

/** 合法 action 闭集。顺序即 deploy-decision.mjs 报错信息里的展示顺序。 */
export const DEPLOY_DECISION_ACTIONS = Object.freeze([
  'pass', // 健康门禁三项全绿后切流
  'pass-unproven', // 已切流但没有任何一轮拿到三项全绿(放行≠通过)
  'pass-entry-broken', // 已切流但公网入口读不到(源站直探正常)⇒ 不回滚好构建
  'rollback', // 健康门禁未过,整份退回上一可用包
  'manual-rollback', // 人工执行 -rollbackOnly
  'build-fail', // 构建失败,未切流
  'swap-fail', // web 蓝绿切换失败 / 灰度对照判红或超时 ⇒ 未切流,保持当前在线版本
  'canary-pass', // 金丝雀观察窗通过,放量完成
  'canary-rollback', // 金丝雀观察窗异常,自动回滚
  'canary-unproven', // 金丝雀观察窗未判定(样本不足),不回滚也不冒充通过
])

/**
 * action → 事故信号规则。键集合必须逐字覆盖 `DEPLOY_DECISION_ACTIONS`,由
 * `assertActionParity()` 与镜像测试双重钉住。
 *
 * `swap-fail` 定档 `alert_firing/error`:它与 `build-fail` 同属"新版本没上线"的真失败
 * (区别只在失败发生在构建阶段还是切流阶段),不是 `pass-unproven` 那类"已放行但证据不足"。
 * 定 error 而非 warn 的依据是 `incident-signal-contract.json` 的 `minSeverity=warn`:
 * 定 warn 会让它在聚类里与"入口读不到"同权,切流失败这一格就被稀释了。
 */
export const OUTCOME_SIGNAL_RULES = Object.freeze({
  pass: null,
  'pass-unproven': { kind: 'alert_firing', severity: 'warn' },
  'pass-entry-broken': { kind: 'alert_firing', severity: 'warn' },
  rollback: { kind: 'alert_firing', severity: 'error' },
  'manual-rollback': { kind: 'alert_firing', severity: 'warn' },
  'build-fail': { kind: 'alert_firing', severity: 'error' },
  'swap-fail': { kind: 'alert_firing', severity: 'error' },
  'canary-pass': null,
  'canary-rollback': { kind: 'perf_degradation', severity: 'error' },
  'canary-unproven': null,
})

/**
 * 两表同源自检:键集合、顺序、逐项形状。
 * 纯函数(零 IO),返回判定而不抛 —— 自检与守门都能直接消费。
 * @returns {{ok:boolean, why:string, missingInRules:string[], extraInRules:string[], duplicates:string[]}}
 */
export function assertActionParity() {
  const actions = [...DEPLOY_DECISION_ACTIONS]
  const keys = Object.keys(OUTCOME_SIGNAL_RULES)
  const duplicates = actions.filter((a, i) => actions.indexOf(a) !== i)
  const missingInRules = actions.filter((a) => !Object.prototype.hasOwnProperty.call(OUTCOME_SIGNAL_RULES, a))
  const extraInRules = keys.filter((k) => !actions.includes(k))
  const invalidRules = keys.filter((k) => {
    const r = OUTCOME_SIGNAL_RULES[k]
    if (r === null) return false
    if (!r || typeof r !== 'object' || Array.isArray(r)) return true
    return typeof r.kind !== 'string' || typeof r.severity !== 'string' || !r.kind || !r.severity
  })
  const ok =
    duplicates.length === 0 &&
    missingInRules.length === 0 &&
    extraInRules.length === 0 &&
    invalidRules.length === 0 &&
    keys.length === actions.length
  const why = ok
    ? `两表逐字同源(${actions.length} 枚 action,映射全覆盖)`
    : `闭集与映射漂移:重复=${duplicates.join(',') || '0'} / 缺映射=${missingInRules.join(',') || '0'} / 多映射=${extraInRules.join(',') || '0'} / 规则形状坏=${invalidRules.join(',') || '0'}`
  return { ok, why, missingInRules, extraInRules, duplicates }
}

/** 该 action 是否属于"部署失败型"(产事故信号)。未登记的 action 一律 false,由调用方另判形状坏。 */
export function isFailureAction(action) {
  if (!Object.prototype.hasOwnProperty.call(OUTCOME_SIGNAL_RULES, action)) return false
  return OUTCOME_SIGNAL_RULES[action] !== null
}

/**
 * 从部署环源码收割它**实际发射**的 action 字面量(发射面对账的唯一实现,测试 import 不复制)。
 * 只认显式字面量:PowerShell `-Action 'x'` / `-Action "x"`,CLI `--action x`。
 * 变量/拼接形态收不到 ⇒ 由 `assertEmitterParity` 的「0 枚即未判定」兜住,不冒充"没有未登记动作"。
 */
const PS_ACTION_RE = /-Action\s+['"]([a-z][a-z0-9-]*)['"]/gi
const CLI_ACTION_RE = /--action\s+['"]?([a-z][a-z0-9-]*)['"]?/gi

export function collectDeclaredActions(sourceText) {
  const found = new Set()
  const text = String(sourceText ?? '')
  for (const re of [PS_ACTION_RE, CLI_ACTION_RE]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) !== null) found.add(String(m[1]).toLowerCase())
  }
  return [...found].sort()
}

/**
 * 发射面 ⊆ 闭集 且 ⊆ 映射表。收割到 0 枚一律判 `unjudged`(§0.3:枚举到 0 个候选判死不记绿),
 * 因为那更可能是正则失效或源读不到,不是"部署环一个动作都不发"。
 * @returns {{state:'ok'|'drift'|'unjudged', emitted:string[], undeclared:string[], unmapped:string[], why:string}}
 */
export function assertEmitterParity(sourceText) {
  const emitted = collectDeclaredActions(sourceText)
  if (emitted.length === 0) {
    return { state: 'unjudged', emitted, undeclared: [], unmapped: [], why: '发射面收割到 0 枚 action ⇒ 未判定,不记绿' }
  }
  const undeclared = emitted.filter((a) => !DEPLOY_DECISION_ACTIONS.includes(a))
  const unmapped = emitted.filter((a) => !Object.prototype.hasOwnProperty.call(OUTCOME_SIGNAL_RULES, a))
  if (undeclared.length || unmapped.length) {
    return {
      state: 'drift',
      emitted,
      undeclared,
      unmapped,
      why: `发射面漂移:闭集缺 ${undeclared.join(',') || '0'} / 映射缺 ${unmapped.join(',') || '0'} ⇒ 这些事件会记不上账或把摄入器整趟拖成零产出`,
    }
  }
  return { state: 'ok', emitted, undeclared, unmapped, why: `发射面 ${emitted.length} 枚 action 全部在闭集且有映射` }
}

export const __test__ = {
  DEPLOY_DECISION_ACTIONS,
  OUTCOME_SIGNAL_RULES,
  assertActionParity,
  assertEmitterParity,
  collectDeclaredActions,
  isFailureAction,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
