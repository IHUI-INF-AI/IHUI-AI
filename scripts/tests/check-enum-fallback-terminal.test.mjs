// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-enum-fallback-terminal 镜像测试(G-815963)—— 从**外部** import 生产出口,
 * 证明三条成对判据(兜初始态⇒红 / 兜终态⇒绿 / 语义不同形不得误判)确实接在实现上,
 * 而不是只在 `--self-test` 自说自话;并拿真实落点文件当"形态对得上"的正向证明。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { classifyTier, isStatusSetName, scanSource } from '../check-enum-fallback-terminal.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('M1 兜初始态⇒红:三元未命中分支落 pending,行号可点名', () => {
  const src = [
    "const TASK_STATUSES = ['pending', 'running', 'completed', 'failed'] as const",
    'function asTaskStatus(v) {',
    "  return TASK_STATUSES.includes(v) ? v : 'pending'",
    '}',
    '',
  ].join('\n')
  const r = scanSource('fixture-a.ts', src)
  if (r.reds.length !== 1) throw new Error(`红=${r.reds.length},期望 1:${JSON.stringify(r.findings)}`)
  const f = r.reds[0]
  if (f.value !== 'pending') throw new Error(`落点='${f.value}',期望 pending`)
  if (f.line !== 3) throw new Error(`行号=${f.line},期望 3`)
  if (f.form !== 'ternary') throw new Error(`形态=${f.form},期望 ternary`)
})

test('M2 兜初始态⇒红:guard-return(经本文件 const 解析)与 coerceKnownOr safe 实参', () => {
  const guard = [
    "const KNOWN = ['pending', 'running']",
    'function pick(v) {',
    '  if (!RUN_STATUSES.includes(v)) return FALLBACK',
    '}',
    "const FALLBACK = 'running'",
    '',
  ].join('\n')
  const r1 = scanSource('fixture-b.ts', guard)
  if (r1.reds.length !== 1 || r1.reds[0].value !== 'running')
    throw new Error(`guard 判歪:${JSON.stringify(r1.findings)}`)
  if (r1.reds[0].form !== 'guard-return') throw new Error(`形态=${r1.reds[0].form}`)

  const coerce = "const s = coerceKnownOr(row.status, ['active', 'closed'], 'active')\n"
  const r2 = scanSource('fixture-c.ts', coerce)
  if (r2.reds.length !== 1 || r2.reds[0].value !== 'active')
    throw new Error(`coerceKnownOr 判歪:${JSON.stringify(r2.findings)}`)
  if (r2.reds[0].receiver !== 'coerceKnownOr') throw new Error('受判对象应为 coerceKnownOr')
})

test('M3 兜终态/显式拒绝⇒绿:三元 closed、guard null、coerce safe closed 均不判红', () => {
  const cases = [
    "const INSTANCE_STATUSES = ['pending', 'closed'] as const\nconst norm = (v) => INSTANCE_STATUSES.includes(v) ? v : 'closed'\n",
    'function parse(v) {\n  if (!VALID_STATUSES.has(v)) return null\n}\n',
    "const s = coerceKnownOr(row.status, ['active', 'paused', 'closed'], 'closed')\n",
  ]
  for (const [i, src] of cases.entries()) {
    const r = scanSource(`fixture-green-${i}.ts`, src)
    if (r.reds.length !== 0) throw new Error(`用例${i} 误判红:${JSON.stringify(r.reds)}`)
    if (r.greens.length !== 1) throw new Error(`用例${i} 未判绿:${JSON.stringify(r.findings)}`)
  }
})

test('M4 反向锁:语义不同形一律不得误判(红绿皆零)', () => {
  const locks = [
    // 非状态语义的枚举集合(触发类型/任务类型),档位词面再像也不判
    "const TRIGGER_TYPES = ['manual', 'schedule'] as const\nconst n = (v) => (TRIGGER_TYPES.includes(v) ? v : 'manual')\n",
    // 缺键默认(族外形态):MAP[x] ?? pending 不是闭集成员判定
    "const s = STATUS_MAP[row.status] ?? 'pending'\n",
    // 字符串/路径 includes
    "const type = path.includes('/') ? 'AAAA' : 'A'\n",
    // 状态集合但档位两表皆不中(既非初始也非终态)
    "const n2 = (v) => (SESSION_STATES.includes(v) ? v : 'paused')\n",
    // 正向守卫无 else:非成员走穿透,不存在兜底值
    'function f(v) {\n  if (TERMINAL_STATUSES.includes(v)) handle(v)\n}\n',
    // 注释里长得一模一样也不判(词面扫注释=假判据)
    "// return TASK_STATUSES.includes(v) ? v : 'pending'\n",
  ]
  for (const [i, src] of locks.entries()) {
    const r = scanSource(`fixture-lock-${i}.ts`, src)
    if (r.findings.length !== 0)
      throw new Error(`反向锁${i} 被误判:${JSON.stringify(r.findings)}`)
  }
})

test('M5 真实落点:apps/cli workflows.ts 解码器现兜 unknown(终态/拒绝档),判绿不判红', () => {
  const abs = resolve(ROOT, 'apps/cli/src/commands/workflows.ts')
  const r = scanSource('apps/cli/src/commands/workflows.ts', readFileSync(abs, 'utf8'))
  if (r.reds.length !== 0) throw new Error(`存在红:${JSON.stringify(r.reds)}`)
  const unknowns = r.greens.filter((f) => f.value === 'unknown')
  if (unknowns.length !== 2)
    throw new Error(`asInstanceStatus/asTaskStatus 应各有一处 unknown 绿,实际 ${unknowns.length}`)
})

test('M6 档位词表:初始态/终态归类与集合标识符形态', () => {
  if (classifyTier('pending') !== 'initial' || classifyTier('admitted') !== 'initial')
    throw new Error('初始态档归类判歪')
  if (classifyTier('closed') !== 'terminal' || classifyTier('unknown') !== 'terminal')
    throw new Error('终态档归类判歪')
  if (classifyTier('paused') !== null) throw new Error('两表皆不中的档位必须中性(反向锁)')
  if (!isStatusSetName('TASK_STATUSES') || !isStatusSetName('openStates'))
    throw new Error('集合标识符识别判歪')
  if (isStatusSetName('TRIGGER_TYPES') || isStatusSetName('status'))
    throw new Error('非集合/非状态标识符必须不识别(反向锁)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
