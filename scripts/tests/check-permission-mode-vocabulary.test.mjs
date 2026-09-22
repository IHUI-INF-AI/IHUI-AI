// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 68 的镜像测试(§22c:测试不得复制源逻辑,一律 import __test__)。
// 与 --self-test 的分工:--self-test 给人手工/提交前自证;本文件让 CI 也咬住
// "判闸失效" —— 因为一道没人证明过能变红的闸,等于没有闸。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { __test__ as gate } from '../check-permission-mode-vocabulary.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

const ts = gate.parseTsRegistry(read(gate.TS_REGISTRY))
const py = gate.parsePyRegistry(read(gate.PY_REGISTRY))

test('注册表基线:5 个规范档 + 11 个别名(改动会连带影响 R2/R3 判定面)', () => {
  assert.deepEqual(ts.members, ['default', 'acceptEdits', 'bypassPermissions', 'plan', 'manual'])
  assert.equal(Object.keys(ts.aliases).length, 11)
})

test('R1 咬住"只改了 Python 一侧"的跨语言漂移', () => {
  const problems = gate.checkMirror(ts, { ...py, aliases: { ...py.aliases, 'yolo-mode': 'plan' } })
  assert.ok(problems.some((p) => p.startsWith('R1 别名键')), problems.join('\n'))
})

test('R2 咬住成员归不回自身', () => {
  const broken = {
    ...ts,
    aliases: Object.fromEntries(
      Object.entries(ts.aliases).filter(([k]) => k !== 'accept-edits' && k !== 'acceptedits'),
    ),
  }
  assert.ok(gate.checkAliasClosure(broken).some((p) => p.includes('acceptEdits')))
})

test('R3 咬住决策位拿别名比较(== "auto" 复发)', () => {
  const problems = gate.checkConsumers(
    [
      {
        relPath: 'apps/ai-service/app/services/agent_loop_v2.py',
        src: 'if permission_mode == "auto":\n    pass\n',
      },
    ],
    ts,
  )
  assert.ok(problems.some((p) => p.includes('决策位使用别名')), problems.join('\n'))
})

test('R3 不吃档案外的同名变量(MoA 聚合档 debate 不是权限档)', () => {
  const problems = gate.checkConsumers(
    [
      {
        relPath: 'apps/ai-service/app/routers/agents.py',
        src: 'if mode == "debate":\n    pass\n',
      },
    ],
    ts,
  )
  assert.deepEqual(problems, [])
})

test('R4 咬住第二份完整档位清单,放过 kebab 子集', () => {
  const copy = gate.checkNoSecondList(
    [
      {
        relPath: 'apps/cli/src/tools/permissions.ts',
        src: "const VALID_MODES = ['default', 'acceptEdits', 'bypassPermissions', 'plan', 'manual'];\n",
      },
    ],
    ts,
  )
  assert.ok(copy.some((p) => p.startsWith('R4')))
  const subset = gate.checkNoSecondList(
    [
      {
        relPath: 'packages/types/src/workspace.ts',
        src: "export type WorkspacePermissionMode = 'default' | 'accept-edits'\n",
      },
    ],
    ts,
  )
  assert.deepEqual(subset, [])
})

test('R3 哨兵豁免不外溢:unset 只在登记它的文件里被放过', () => {
  const outside = gate.checkConsumers(
    [
      {
        relPath: 'apps/api/src/services/workspace-ai-service.ts',
        src: 'if (permMode === "unset") return allowed\n',
      },
    ],
    ts,
  )
  assert.ok(outside.some((p) => p.includes('unset')), outside.join('\n'))

  const inside = gate.checkConsumers(
    [
      {
        relPath: 'apps/api/src/routes/workspace-ai.ts',
        src: "const code = decision.mode === 'unset' ? 401 : 403\n",
      },
    ],
    ts,
  )
  assert.deepEqual(inside, [])
})

test('R4 咬住第二份 wire 清单副本,放过"引用注册表常量"的写法', () => {
  const wire = gate.parseTsWireValues(read(gate.TS_REGISTRY))
  const copy = gate.checkNoSecondList(
    [
      {
        relPath: 'apps/api/src/routes/workspace.ts',
        src: "  mode: z.enum(['default', 'plan', 'accept-edits', 'bypass-permissions']).optional(),\n",
      },
    ],
    ts,
    wire,
  )
  assert.ok(copy.some((p) => p.startsWith('R4') && p.includes('wire 档')), copy.join('\n'))
  const referenced = gate.checkNoSecondList(
    [
      {
        relPath: 'apps/api/src/routes/workspace.ts',
        src: '  mode: z.enum(PERMISSION_MODE_WIRE_VALUES).optional(),\n',
      },
    ],
    ts,
    wire,
  )
  assert.deepEqual(referenced, [])
})

test('R5 咬住 Python wire 镜像缺档(该镜像无人消费,不查就永远没有信号)', () => {
  const wire = gate.parseTsWireValues(read(gate.TS_REGISTRY))
  const good = `PromptMode = Literal[${wire.map((v) => `"${v}"`).join(', ')}]\n`
  assert.deepEqual(gate.checkWireMirrors(() => good, wire), [])
  const missing = 'PromptMode = Literal["default", "plan", "accept-edits"]\n'
  const problems = gate.checkWireMirrors((rel) => (rel.endsWith('.py') ? missing : good), wire)
  assert.ok(problems.some((p) => p.startsWith('R5') && p.includes('api_client.py:')), problems.join('\n'))
})

test('当前工作区零违规(本门上去后不能给别人制造恒红)', () => {
  const { problems } = gate.runChecks({ root: ROOT })
  assert.deepEqual(problems, [])
})

test('KNOWN_CONSUMERS 指向的文件都存在(漏文件=判据悄悄失效)', () => {
  for (const rel of gate.KNOWN_CONSUMERS) {
    assert.doesNotThrow(() => read(rel), `消费清单里的文件不存在: ${rel}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
