// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨包具名导入的 HEAD 面契约对账(2026-09-26 立)。
 *
 * 钉住的契约:`@ihui/types` 在 **HEAD blob** 上导出 `AgentInstanceState`,且消费方
 * `packages/shared/src/chat/agent-actions.ts` 对它的具名导入在 HEAD 面成立。
 *
 * 为什么需要单独一把尺子(守门 98 覆盖不到的那一型):
 *   - 守门 98(check-dangling-local-imports)的判据明确**只判仓内相对路径**
 *     (`spec.startsWith('./' | '../')`,见其 :279),`from '@ihui/types'` 这类
 *     工作区包说明符整类隐身;
 *   - `pnpm typecheck` 只跑**共享工作区**,而共享工作树常年滞后 HEAD(§12d/§5b:
 *     实测数百路径)。2026-09-26 实证:HEAD 的 `agent-runtime.ts` 有该导出(138/149 行),
 *     工作树副本却被并发会话回写成 2026-09-23 祖先版本(`git log --find-object` 点名
 *     `1d0a143f71`,净删 45 行、零新增工作),于是 miniapp/web/shared 三条 typecheck 同时报
 *     TS2305「no exported member」——**红在 worktree、HEAD 自洽**,即"旧工作树源码 ×
 *     别处新基线"制造的假缺陷。诊断只能取同一个面,判据也是。
 *   - 本测试因此**只读 HEAD blob**(经 scripts/lib/face-reader.mjs 的 catBatch,与
 *     守门 70/77/83/98 同一取材层),绝不读磁盘;HEAD 上契约一旦被真删,本测试判红。
 *
 * 取材失败(git 不可达/blob 取不到)⇒ 抛错点名「无法判定」,不记为通过
 * (AGENTS §22d 反向假绿禁令;测试形态没有 exit 2,红比绿诚实)。
 *
 * 跑法:`node --test scripts/tests/types-agent-instance-state-export.test.mjs`
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { catBatch, Undetermined } from '../lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const BARREL = 'packages/types/src/index.ts'
const RUNTIME = 'packages/types/src/agent-runtime.ts'
const CONSUMER = 'packages/shared/src/chat/agent-actions.ts'

/**
 * 纯判据(§22c/门 103 的教训:证明取材面这类行为只能用纯函数+构造面,
 * 不得依赖仓库瞬时状态)。输入三份文本,输出违规清单(空数组 = 契约成立)。
 * @param {{barrel?: string, runtime?: string, consumer?: string}} files
 * @returns {string[]}
 */
export function checkContract(files) {
  const violations = []
  const barrel = files.barrel ?? ''
  const runtime = files.runtime ?? ''
  const consumer = files.consumer ?? ''

  // ① 生产者:HEAD 的 agent-runtime.ts 必须导出这套符号(D103 七态协议层)。
  if (!/export\s+const\s+AGENT_INSTANCE_STATES\s*=/.test(runtime)) {
    violations.push('agent-runtime.ts 未导出 AGENT_INSTANCE_STATES 常量')
  }
  if (!/export\s+type\s+AgentInstanceState\s*=/.test(runtime)) {
    violations.push('agent-runtime.ts 未导出 type AgentInstanceState')
  }
  if (!/export\s+function\s+sessionStatusFromInstance\s*\(/.test(runtime)) {
    violations.push('agent-runtime.ts 未导出 sessionStatusFromInstance(唯一映射)')
  }

  // ② 桶文件:barrel 必须把 agent-runtime 再导出(`export * from './agent-runtime'`)。
  //    `export *` 目标不可枚举是守门 98 放过的那一型,所以这里点名这一条具体链路。
  if (!/export\s*\*\s*from\s*['"]\.\/agent-runtime['"]/.test(barrel)) {
    violations.push("types/src/index.ts 不再 `export * from './agent-runtime'`(导出链路断裂)")
  }

  // ③ 消费方:shared 确实从 '@ihui/types' 具名导入该类型(契约的另一半;
  //    若哪天真的删干净了消费方,本测试应红着提醒"契约已整体退役",由人裁撤本文件)。
  if (
    !/import\s+type\s*\{[^}]*\bAgentInstanceState\b[^}]*\}\s*from\s*['"]@ihui\/types['"]/.test(
      consumer,
    )
  ) {
    violations.push("shared/chat/agent-actions.ts 不再从 '@ihui/types' 导入 AgentInstanceState")
  }

  return violations
}

/** 读 HEAD 面三份 blob;任何一份取不到 ⇒ 抛「无法判定」,绝不记绿。 */
function readHeadFace() {
  const specs = [BARREL, RUNTIME, CONSUMER].map((p) => `HEAD:${p}`)
  let map
  try {
    map = catBatch(ROOT, specs)
  } catch (e) {
    if (e instanceof Undetermined) {
      throw new Error(`无法判定(HEAD 面取材失败,不得记为通过): ${e.message}`)
    }
    throw e
  }
  const out = {}
  const missing = []
  for (const [spec, text] of map) {
    const rel = spec.slice('HEAD:'.length)
    if (text === null || text === undefined) missing.push(rel)
    else out[rel] = text
  }
  if (missing.length > 0) {
    throw new Error(`无法判定(HEAD 面缺 blob,不记为通过): ${missing.join(', ')}`)
  }
  return { barrel: out[BARREL], runtime: out[RUNTIME], consumer: out[CONSUMER] }
}

test('真仓 HEAD 面:types 导出 AgentInstanceState 且 shared 消费链路成立', () => {
  const violations = checkContract(readHeadFace())
  assert.deepEqual(violations, [], 'HEAD 面契约被破坏(本测试只判 HEAD,与滞后的工作树无关)')
})

test('反向对照:agent-runtime 导出被删 ⇒ 必判违规(生产者隐身即红)', () => {
  const face = readHeadFace()
  const gutted = {
    ...face,
    runtime: face.runtime.replace(/export type AgentInstanceState[^\n]*/g, ''),
  }
  const violations = checkContract(gutted)
  assert.ok(
    violations.some((v) => v.includes('AgentInstanceState')),
    '删掉导出后判据必须点名 AgentInstanceState',
  )
})

test('反向对照:barrel 摘掉 export * 链路 ⇒ 必判违规(桶文件断链即红)', () => {
  const face = readHeadFace()
  const detached = {
    ...face,
    barrel: face.barrel.replace(
      /export \* from '\.\/agent-runtime'/g,
      "export * from './agent-runtime-old'",
    ),
  }
  assert.ok(checkContract(detached).some((v) => v.includes('agent-runtime')))
})

test('反向对照:消费方导入消失 ⇒ 必判违规(契约被整体挪用而非退役)', () => {
  const face = readHeadFace()
  const orphan = {
    ...face,
    consumer: face.consumer.replace(
      /import type \{ AgentInstanceState \} from '@ihui\/types'/,
      '// removed',
    ),
  }
  assert.ok(checkContract(orphan).some((v) => v.includes('agent-actions.ts')))
})

test('形状锁:判据不得从磁盘读这三份被审内容(只许 HEAD 面)', () => {
  // 读本测试自身源码(不触碰任何被审文件,不违反上面的口径):
  // 被审三份路径若出现在 readFileSync 调用旁,即视为取材面漂移(工作树可能是并行会话半编辑态)。
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  for (const p of [BARREL, RUNTIME, CONSUMER]) {
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.ok(
      !new RegExp(`readFileSync\\((?:[^)]*)${esc}`).test(src),
      `测试不得按磁盘读 ${p}(工作树可能是并行会话半编辑态)`,
    )
  }
})

export const __test__ = { checkContract }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
