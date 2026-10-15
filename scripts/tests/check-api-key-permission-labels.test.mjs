// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:判据 import 源脚本的 __test__,本文件不复制第二份。
// 本票锁四件事:① 装车证明(注册条目 blocking + skipEnv + 按输入面触发,读 HEAD 面不读工作区);
// ② 真面现读必须对齐(落地当刻的凭据,也是防"另一半年没补"的回潮尺);
// ③ 表类型不许被改掉(把 Record 改成 Partial / 加 ! 断言 = 为消红废掉编译期那把尺);
// ④ 取材面口径与互斥档。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate } from '../check-api-key-permission-labels.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-api-key-permission-labels.mjs')
const stdio = ['ignore', 'pipe', 'pipe']

const run = (args = []) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, stdio })

test('装车证明:注册条目是 blocking + skipEnv + 只在输入面触发(读 HEAD 面 runner)', () => {
  const head = spawnSync('git', ['show', 'HEAD:scripts/guardian-runner.mjs'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, stdio }).stdout
  const i = head.indexOf("'check-api-key-permission-labels.mjs'")
  assert.ok(i > -1, '门体未接进提交链注册表')
  const block = head.slice(Math.max(0, i - 500), i + 900)
  assert.match(block, /mode:\s*'blocking'/, '须为 blocking')
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_API_KEY_PERM_LABELS'/, 'blocking 门必须成套带 skipEnv')
  assert.match(block, /stagedTriggers:/, '必须按输入面收窄触发(不给无关提交造恒红,§12e)')
  assert.ok(block.includes(gate.UNION_FILE) || block.includes('packages/types/src/api-key.ts'), '触发面必须含 union 源文件')
})

test('正控:HEAD 面三方逐枚对齐(缺键=0 且 多键=0)', () => {
  const r = run([])
  assert.equal(r.status, 0, `HEAD 面应齐,实得:\n${r.stdout}\n${r.stderr}`)
  assert.match(r.stdout, /✅ 联合 \/ 两处标签表 \/ 五语言取词逐枚对齐/)
})

test('判据本体:表缺枚 ⇒ P1 缺键;表多枚 ⇒ P1 多键;一端缺词 ⇒ P2 点名该端', () => {
  const UNION = "export const API_KEY_PERMISSIONS = [\n  'a:b',\n  'c:d',\n]\n"
  const MAP = "const X: Record<ApiKeyPermission, string> = {\n  'a:b': 'apiKeyPerms.aB',\n  'c:d': 'apiKeyPerms.cD',\n}\n"
  const MSGS = Object.fromEntries(gate.LOCALES.map((l) => [l, '{"apiKeyPerms":{"aB":"x","cD":"y"}}']))
  const base = { unionSrc: UNION, mapSrcs: { 'm.tsx': MAP }, messageTexts: MSGS }
  assert.deepEqual(gate.judge(base), { undetermined: [], violations: [] })
  const miss = gate.judge({ ...base, mapSrcs: { 'm.tsx': MAP.replace("  'c:d': 'apiKeyPerms.cD',\n", '') } })
  assert.match(miss.violations[0], /^P1 缺键.*c:d/)
  const extra = gate.judge({ ...base, mapSrcs: { 'm.tsx': MAP.replace("  'a:b'", "  'zz:qq': 'apiKeyPerms.zzQq',\n  'a:b'") } })
  assert.ok(extra.violations.some((v) => v.startsWith('P1 多键')), JSON.stringify(extra.violations))
  const one = gate.judge({ ...base, messageTexts: { ...MSGS, ko: '{"apiKeyPerms":{"aB":"x"}}' } })
  assert.ok(one.violations.some((v) => v.startsWith('P2 取词不可达:ko')), JSON.stringify(one.violations))
})

test('不许用"改掉表类型"换绿灯:两处标签表仍是 Record<ApiKeyPermission, string>', () => {
  for (const f of gate.LABEL_MAPS) {
    const src = readFileSync(join(ROOT, f), 'utf8')
    assert.match(src, /Record<ApiKeyPermission,\s*string>/, `${f} 的表类型被改掉 = 废掉编译期那把尺`)
    assert.doesNotMatch(src, /Partial<Record<ApiKeyPermission|Record<ApiKeyPermission,\s*string>\s*>?\s*!/, `${f} 不得用 Partial/断言遮缺键`)
  }
})

test('口径:两面同给 ⇒ exit 2 未判定;枚举为 0 不记绿', () => {
  const both = run(['--staged', '--worktree'])
  assert.equal(both.status, 2, both.stdout + both.stderr)
  assert.match(both.stdout, /未判定/)
  const u = gate.unionOf('export const OTHER = ["a"]')
  assert.equal(u, null, '取不到 union 必须回 null(由调用方落成"未判定")')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
