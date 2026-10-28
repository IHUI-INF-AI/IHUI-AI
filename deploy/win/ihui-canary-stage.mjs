#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ihui-canary-stage — 金丝雀「灰度阶段」的编排层(判据与动作决策的唯一出口)。
 *
 * 分工(§0.6 单一真相源,三处不得各写一份):
 *   scripts/canary-traffic.mjs  — 档位推进判定 + 契约构造 + 灰期策略派生(纯函数)
 *   scripts/canary-verdict.mjs  — 错误率/延迟比对(纯函数)
 *   本文件                      — 「这一轮判定之后该做什么」的**动作决策**
 *   deploy/win/ihui-canary-gray.ps1 — 进程与服务动作(起停实例、切流、重启)
 *
 * 灰度语义(与仓内既有机制对齐,不改):
 *   - stable 槽位 = 现网(8801,一直跑**旧版本**)⇒ 灰度期内线上从没跑过新版本,
 *     这就是「异常自动回滚」在灰度期的形态:**撤灰度流量**即可(不是整份退包);
 *   - canary 槽位 = 灰度候选(8845,跑 .next-staging 那份新构建);
 *   - 分流器 = 源站前置(8846),按契约比例把请求切给两个槽位;
 *   - 档位 pass ⇒ 升档;fail ⇒ 归零(撤灰度,回滚);unknown ⇒ 原地不动(不放量也不回滚)。
 *
 * 档位表的末档(ramp-full = 100%)**不是**「分流器放到 100%」,而是「全量候选已验证通过」
 * 的信号:末档被验证通过之前,流量始终按比例分给两个槽位。
 *
 * 退出码:0 判定完成 / 2 未判定(形状坏、参数非法)。
 */

import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  loadTrafficPolicy,
  stagePercent,
  resolveStage,
  buildRampContract,
  deriveGrayPolicy,
  OFF_STAGE,
  VERDICTS,
  TrafficShapeError,
} from '../../scripts/canary-traffic.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const CONTRACT_PATH = join(ROOT, '.ihui-agent', 'state', 'canary', 'ramp.json')
export const POLICY_PATH = join(ROOT, 'scripts', 'data', 'canary-policy.json')

export const EXIT_OK = 0
export const EXIT_UNKNOWN = 2

/** 动作闭集:调用方(PowerShell)只按这四个动作做事,不得自行解释判定。 */
export const ACTIONS = Object.freeze(['init', 'advance', 'hold', 'rollback', 'promote'])

const asText = (v) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v)).trim()

/**
 * 「这一轮判定之后该做什么」的决策(纯函数 —— 部署环的回滚判定就在这里)。
 *
 * - fail    ⇒ rollback:撤灰度流量(比例归零)+ 停灰度实例 ⇒ 线上留在旧版本(这才是灰度期
 *             真正的「自动回滚」;整份退包是全量切换后的形态,两者不可混)。
 * - unknown ⇒ hold:既不放量也不回滚(没有证据就不动)。
 * - pass    ⇒ advance:升到下一档(比例变大)。
 * - pass 且已在末档 ⇒ promote:末档已被验证通过 ⇒ 可以全量切流(把候选变成 stable)。
 *
 * @param {{verdict: string, currentStage: string, stages: Array<{id: string, percent: number}>}} input
 * @returns {{action: string, stage: string, percent: number, changed: boolean, reason: string}}
 */
export function decideStageAction({ verdict, currentStage, stages } = {}) {
  const v = asText(verdict)
  if (!VERDICTS.includes(v)) {
    throw new TrafficShapeError(`verdict 非法:${v}(闭集:${VERDICTS.join('/')})`)
  }
  if (!Array.isArray(stages) || stages.length === 0) {
    throw new TrafficShapeError('档位表为空')
  }
  const cur = asText(currentStage) || OFF_STAGE
  const r = resolveStage(cur, v, stages)

  if (v === 'fail') {
    return {
      action: 'rollback',
      stage: OFF_STAGE,
      percent: 0,
      changed: r.changed,
      reason: r.reason,
    }
  }
  if (v === 'unknown') {
    return {
      action: 'hold',
      stage: r.stage,
      percent: r.percent,
      changed: false,
      reason: r.reason,
    }
  }
  // pass:changed=true ⇒ 刚升到下一档;changed=false ⇒ 已在末档且本轮 pass 是对末档的验证。
  if (r.changed) {
    return {
      action: 'advance',
      stage: r.stage,
      percent: r.percent,
      changed: true,
      reason: r.reason,
    }
  }
  return {
    action: 'promote',
    stage: r.stage,
    percent: r.percent,
    changed: false,
    reason: r.reason,
  }
}

/**
 * 起始契约:进灰度期的第一档(最低档)。
 * 比例取档位表第一档,不是 100 —— 灰度期从最小流量起步是这一格的全部意义。
 */
export function initRampContract(policy, { sha = '', now } = {}) {
  if (!policy || !Array.isArray(policy.stages) || policy.stages.length === 0) {
    throw new TrafficShapeError('档位表为空')
  }
  const first = policy.stages[0]
  const contract = buildRampContract({ policy, stage: first.id, sha, now })
  if (contract.percent !== first.percent) {
    throw new TrafficShapeError(`起始档比例不符:契约 ${contract.percent} vs 档位 ${first.percent}`)
  }
  return contract
}

/** 读当前契约(缺失/坏 ⇒ null ⇒ 调用方按「不在灰度期」处理,不得回落默认值放量)。 */
export function readRampContract(path = CONTRACT_PATH) {
  try {
    const doc = JSON.parse(readFileSync(path, 'utf8'))
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null
    return doc
  } catch {
    return null
  }
}

/** 写契约(原子:先写临时文件再改名,避免分流器读到半份 JSON)。 */
export function writeRampContract(contract, path = CONTRACT_PATH) {
  const out = resolve(path)
  mkdirSync(dirname(out), { recursive: true })
  const tmp = `${out}.tmp`
  writeFileSync(tmp, `${JSON.stringify(contract, null, 2)}\n`, 'utf8')
  renameSync(tmp, out)
  return out
}

/** 灰期采样策略:把灰度端点的源站改指 canary 槽位 ⇒ 观察窗量的就是新版本。 */
export function graySamplingPolicy(policy, stage) {
  return deriveGrayPolicy(policy, stage).policy
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const eq = key.indexOf('=')
    if (eq >= 0) {
      out[key.slice(0, eq)] = key.slice(eq + 1)
      continue
    }
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      out[key] = true
      continue
    }
    out[key] = next
    i += 1
  }
  return out
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const policyPath = args.policy || POLICY_PATH
  let policy
  try {
    policy = loadTrafficPolicy(readFileSync(policyPath, 'utf8'))
  } catch (e) {
    console.error(`灰度策略未判定(${policyPath}):${e?.message ?? e}`)
    process.exit(EXIT_UNKNOWN)
  }

  const contractPath = args.contract || CONTRACT_PATH

  if (args.init) {
    try {
      const contract = initRampContract(policy, { sha: asText(args.sha) })
      writeRampContract(contract, contractPath)
      console.log(JSON.stringify({ action: 'init', contract }))
      return
    } catch (e) {
      console.error(`灰度起始契约未判定:${e?.message ?? e}`)
      process.exit(EXIT_UNKNOWN)
    }
  }

  if (args.decide) {
    const verdict = asText(args.verdict)
    const current = asText(args.current)
    try {
      const action = decideStageAction({ verdict, currentStage: current, stages: policy.stages })
      let contract = null
      if (action.action === 'advance' || action.action === 'init') {
        contract = buildRampContract({ policy, stage: action.stage, sha: asText(args.sha) })
        writeRampContract(contract, contractPath)
      } else if (action.action === 'rollback') {
        // 回滚:比例归零的契约必须落盘 —— 分流器下一次读契约就是「全走 stable」。
        contract = buildRampContract({ policy, stage: OFF_STAGE, sha: asText(args.sha) })
        writeRampContract(contract, contractPath)
      }
      console.log(JSON.stringify({ ...action, contract }))
      return
    } catch (e) {
      console.error(`灰度动作未判定:${e?.message ?? e}`)
      process.exit(EXIT_UNKNOWN)
    }
  }

  if (args.status) {
    const contract = readRampContract(contractPath)
    const stage = contract ? asText(contract.stage) : OFF_STAGE
    let percent = 0
    try {
      percent = stagePercent(stage, policy.stages)
    } catch {
      percent = 0
    }
    console.log(JSON.stringify({ inGray: Boolean(contract) && percent > 0, stage, percent, contract }))
    return
  }

  console.error('用法:--init [--sha <sha>] [--contract <path>] | --decide --verdict pass|fail|unknown [--current <stage>] [--contract <path>] | --status [--contract <path>]')
  process.exit(EXIT_UNKNOWN)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
