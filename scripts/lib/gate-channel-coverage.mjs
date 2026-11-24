// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gate-channel-coverage.mjs — 「每道注册门至少有一个阻断通道」的元判据(DG-14,2026-11-14)
 *
 * 病理(findings-deploy-gates.md#DG-14):门集覆盖面此前由两张**白名单**拼出来 ——
 *   ① 本地 pre-commit 只跑 `META_SCRIPT_RE` 前缀命中的元门;
 *   ② push 面只跑 `guardian-runner.mjs` 的 `pushGateChecks`。
 * 新门注册进 `checks` 但名字不命中前缀、又没进 push 集 ⇒ 本地与 push 面都不跑,只剩
 * 报告档全量 CI(见 DG-01)。哪一天有人新增这样一门,账面全绿而它一条都没执行过。
 *
 * 判据(本库只做纯函数,读者是 `check-gate-triggers` 第二维):
 *   注册表里的每个 script 必须 ∈ {meta 元门档, pushGate, required CI job} 之一。
 *   · 命中任一通道 ⇒ ok;
 *   · 三处都不在 ∧ 在 `uncoveredBaseline` ⇒ **存量**只报数(§12e:存量 276 枚 ≠ 0 时装红即恒红门);
 *   · 三处都不在 ∧ 不在基线 ⇒ **新增零通道门**判红(这才是DG-14 要拦的口子);
 *   · 基线里已消失的门 ⇒ warning(协议:基线只许删,删是还款);
 *   · metaGates 声明了但注册表里没有 ⇒ warning(声明腐烂,不判红以免与并发删除互锁)。
 *
 * 通道自动发现(不另造清单,§0.6):
 *   · meta   = `scripts/data/gate-channel-registry.json` 的 `metaGates`(唯一声明面);
 *   · push   = 同一份 `guardian-runner.mjs` 文本里 `const pushGateChecks = [` 之后的注册项;
 *   · ciRequired = `.github/workflows/ci.yml` 里 `requiredCiJobs` 列出的 job 块中的 `node scripts/*.mjs`。
 * 三处取数都在调用方同一张被审面上完成(HEAD / 索引),本库不自己读盘。
 */

/** 与注册表元判据同面:调用方(check-gate-triggers)把同一份注册表文本传进来,本库不自己取面。 */
export function parseRegisteredScripts(runnerText) {
  const src = String(runnerText || '')
  // 只按行首注释过滤 —— 注册表里没有"注释行写 script: 'x'"的形态(2026-11-14 实测 0 行),
  // 但为防未来把说明文字里的假门名收进通道集合,保守剔掉整行注释。
  const clean = src
    .split(/\r?\n/)
    .filter((l) => {
      const t = l.trimStart()
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'))
    })
    .join('\n')
  const splitAt = clean.indexOf('const pushGateChecks')
  const commitPart = splitAt >= 0 ? clean.slice(0, splitAt) : clean
  const pushPart = splitAt >= 0 ? clean.slice(splitAt) : ''
  const scriptsOf = (text) =>
    [...text.matchAll(/script:\s*'([^']+)'/g)].map((m) => m[1]).filter(Boolean)
  const commit = [...new Set(scriptsOf(commitPart))]
  const push = [...new Set(scriptsOf(pushPart))]
  const all = [...new Set([...commit, ...push])].sort()
  return { all, commit, push, hasPushArray: splitAt >= 0 }
}

/**
 * 从 required CI workflow 文本里取「required job 块」内被调用的门脚本。
 * job 块边界 = 顶层 `  <name>:` 行(两空格缩进),块内任意行出现 `node scripts/<x>.mjs` 即算。
 * @returns {{scripts: string[], missingJobs: string[]}}
 */
export function parseRequiredCiScripts(ciText, jobNames) {
  const lines = String(ciText || '').split(/\r?\n/)
  const blocks = new Map()
  let cur = null
  for (const line of lines) {
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line)
    if (m) {
      cur = m[1]
      blocks.set(cur, [])
      continue
    }
    if (cur) blocks.get(cur).push(line)
  }
  const scripts = new Set()
  const missingJobs = []
  for (const job of jobNames || []) {
    const block = blocks.get(job)
    if (!block) {
      missingJobs.push(job)
      continue
    }
    for (const line of block) {
      for (const m of line.matchAll(/node\s+scripts\/([A-Za-z0-9._-]+\.mjs)/g)) scripts.add(m[1])
    }
  }
  return { scripts: [...scripts].sort(), missingJobs }
}

/** 校验登记表形态;problems 非空 ⇒ 调用方判红(声明表坏了就不能拿它当合格证)。 */
export function validateChannelRegistry(raw) {
  const problems = []
  const metaGates = {}
  const baseline = []
  let requiredCiJobs = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, problems: ['登记表不是对象'], metaGates, baseline, requiredCiJobs }
  }
  if (raw.version !== 1) problems.push(`version 必须是 1(实得 ${JSON.stringify(raw.version)})`)
  if (!Array.isArray(raw.requiredCiJobs) || raw.requiredCiJobs.length === 0) {
    problems.push('requiredCiJobs 必须是非空数组')
  } else {
    requiredCiJobs = raw.requiredCiJobs.filter((j) => typeof j === 'string' && j.trim())
    if (requiredCiJobs.length !== raw.requiredCiJobs.length)
      problems.push('requiredCiJobs 含非字符串项')
  }
  const mg = raw.metaGates
  if (!mg || typeof mg !== 'object' || Array.isArray(mg)) {
    problems.push('metaGates 必须是对象(script → 入档理由)')
  } else {
    const keys = Object.keys(mg)
    if (keys.length === 0) problems.push('metaGates 为空 —— 元门档不能一个人都没有')
    for (const k of keys) {
      if (typeof mg[k] !== 'string' || !mg[k].trim()) {
        problems.push(`metaGates['${k}'] 缺少入档理由`)
        continue
      }
      metaGates[k] = mg[k].trim()
    }
  }
  if (!Array.isArray(raw.uncoveredBaseline)) {
    problems.push('uncoveredBaseline 必须是数组')
  } else {
    const seen = new Set()
    for (const s of raw.uncoveredBaseline) {
      if (typeof s !== 'string' || !s.trim()) {
        problems.push('uncoveredBaseline 含非字符串项')
        continue
      }
      if (seen.has(s)) problems.push(`uncoveredBaseline 重复项: ${s}`)
      seen.add(s)
      baseline.push(s)
    }
  }
  return {
    ok: problems.length === 0,
    problems,
    metaGates,
    baseline,
    requiredCiJobs,
  }
}

/**
 * 纯函数:算每道注册门的通道归属。
 * @returns {{
 *   channels: Record<string, 'meta'|'push'|'ciRequired'>,
 *   uncovered: string[], newUncovered: string[], repaidBaseline: string[],
 *   staleBaseline: string[], staleMeta: string[], missingCiJobs: string[],
 *   counts: Record<string, number>
 * }}
 */
export function computeChannelCoverage({
  registeredScripts = [],
  pushScripts = [],
  ciScripts = [],
  metaGates = {},
  baseline = [],
  missingCiJobs = [],
} = {}) {
  const registered = [...new Set(registeredScripts)].sort()
  const pushSet = new Set(pushScripts)
  const ciSet = new Set(ciScripts)
  const metaSet = new Set(Object.keys(metaGates || {}))
  const baselineSet = new Set(baseline || [])
  const channels = {}
  for (const s of registered) {
    if (metaSet.has(s)) channels[s] = 'meta'
    else if (pushSet.has(s)) channels[s] = 'push'
    else if (ciSet.has(s)) channels[s] = 'ciRequired'
  }
  const uncovered = registered.filter((s) => !channels[s])
  const newUncovered = uncovered.filter((s) => !baselineSet.has(s))
  const repaidBaseline = [...baselineSet].filter((s) => channels[s]).sort()
  const staleBaseline = [...baselineSet].filter((s) => !registered.includes(s)).sort()
  const staleMeta = [...metaSet].filter((s) => !registered.includes(s)).sort()
  return {
    channels,
    uncovered,
    newUncovered,
    repaidBaseline,
    staleBaseline,
    staleMeta,
    missingCiJobs,
    counts: {
      registered: registered.length,
      meta: registered.filter((s) => channels[s] === 'meta').length,
      push: registered.filter((s) => channels[s] === 'push').length,
      ciRequired: registered.filter((s) => channels[s] === 'ciRequired').length,
      uncovered: uncovered.length,
      newUncovered: newUncovered.length,
      baseline: baselineSet.size,
      repaidBaseline: repaidBaseline.length,
      staleBaseline: staleBaseline.length,
      staleMeta: staleMeta.length,
    },
  }
}

export const __test__ = {
  parseRegisteredScripts,
  parseRequiredCiScripts,
  validateChannelRegistry,
  computeChannelCoverage,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
