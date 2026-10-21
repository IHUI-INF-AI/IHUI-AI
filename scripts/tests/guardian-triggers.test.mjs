// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/guardian-triggers.mjs` 的镜像测试(§22c:直接 import 源实现,不抄第二份)。
 *
 * 钉的是 2026-09-25 那次真实失效:runner 的 `stagedPathsTouch` 只认数组,而 HEAD 有三道门
 * 注册成裸字符串 ⇒ **任何一次 --staged 的 pre-commit 都在第 118 道门处 TypeError**,
 * 崩溃点之后的全部守门没跑,提交被 --no-verify 兜住 —— 后果等于全队关掉 140+ 道门。
 * 所以除了行为对照,还有一条**反向回归锁**:注册表里不得再出现裸字符串写法。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { normalizeTriggers, triggersTouch } from '../lib/guardian-triggers.mjs'

const RUNNER = resolve(import.meta.dirname, '../guardian-runner.mjs')
// 2026-10-16 执行段外置:消费面(T9)改判外置层源;注册面(T8)仍读 runner。
const EXECUTOR = resolve(import.meta.dirname, '../lib/guardian-executor.mjs')

test('T1 数组注册:逐条保留,顺序不变', () => {
  assert.deepEqual(normalizeTriggers(['apps/', 'packages/']), ['apps/', 'packages/'])
})

test('T2 裸字符串注册:归一成单元素数组(旧写法曾让整条守门链崩在这里)', () => {
  assert.deepEqual(normalizeTriggers('scripts/'), ['scripts/'])
})

test('T3 逗号串注册:按逗号拆,且作者意图不丢(HEAD 里确有一条写成 "apps/,packages/")', () => {
  assert.deepEqual(normalizeTriggers('apps/,packages/'), ['apps/', 'packages/'])
})

test('T4 空清单必须抛错 —— 静默为空等于那道门在提交链上永不运行', () => {
  for (const bad of [[], '', ' , ', [ '', '' ]]) {
    assert.throws(() => normalizeTriggers(bad), TypeError, `收到 ${JSON.stringify(bad)} 应抛错`)
  }
})

test('T5 非字符串条目抛错,不当成"匹配不上"放过', () => {
  assert.throws(() => normalizeTriggers(['apps/', 42]), TypeError)
})

test('T6 暂存清单取不到(null)时保守判"触及",门照跑', () => {
  assert.equal(triggersTouch(null, ['apps/']), true)
})

test('T7 命中与不命中的正向对照(判据必须有牙,不是恒真)', () => {
  assert.equal(triggersTouch(['apps/api/src/x.ts'], ['apps/']), true)
  assert.equal(triggersTouch(['docs/x.md'], ['apps/', 'packages/']), false)
  assert.equal(triggersTouch(['apps\\api\\x.ts'], ['apps/']), true) // Windows 反斜杠归一
})

test('T8 反向回归锁:注册表里不得再有裸字符串 stagedTriggers', () => {
  const src = readFileSync(RUNNER, 'utf8')
  const bare = [...src.matchAll(/^\s*stagedTriggers:\s*'[^']*'\s*,\s*$/gm)].map((m) => m[0].trim())
  assert.deepEqual(bare, [], `仍有裸字符串注册:${bare.join(' | ')}`)
  // 且三条历史条目必须仍在(被改成数组,而不是被删掉 —— 删掉等于把门从提交链上摘线)
  for (const keep of ["stagedTriggers: ['scripts/']", "stagedTriggers: ['apps/cli/src/']", "stagedTriggers: ['apps/', 'packages/']"]) {
    assert.ok(src.includes(keep), `注册丢失:${keep}`)
  }
  // 2026-10-21:三条 glob 注册同理必须仍在 —— 本票是让 matcher 认 glob,不是把 glob 删成前缀。
  for (const keep of [
    "stagedTriggers: ['apps/mobile-rn/**', 'packages/app/**']",
    "stagedTriggers: ['apps/**/*.ts', 'apps/**/*.tsx', 'packages/**/*.ts', 'packages/**/*.tsx', 'scripts/**/*.mjs']",
    "stagedTriggers: ['apps/**/*.tsx', 'apps/**/*.ts', 'packages/app/**/*.tsx', 'packages/**/*.ts']",
  ]) {
    assert.ok(src.includes(keep), `glob 注册丢失(门会被摘线):${keep}`)
  }
})

test('T9 消费面两处都走归一层(不得只修一处留下另一个崩点)', () => {
  // 2026-10-16 执行段外置:stagedPathsTouch 定义与跳过提示行逐字搬到 scripts/lib/guardian-executor.mjs,
  // 本锁跟着落点走;链路 runner → executor → guardian-triggers,运行时仍是同一份归一实现。
  const src = readFileSync(EXECUTOR, 'utf8')
  assert.ok(/function stagedPathsTouch\(prefixes\) \{[\s\S]*?\n\}/.test(src))
  const body = src.match(/function stagedPathsTouch\(prefixes\) \{([\s\S]*?)\n\}/)[1]
  assert.ok(body.includes('triggersTouch('), 'stagedPathsTouch 未改道共用层')
  assert.ok(!body.includes('prefixes.some'), '仍在直接调用数组方法(旧崩点)')
  assert.ok(src.includes('normalizeTriggers(check.stagedTriggers).join'), '跳过提示行仍可能崩在 .join 上')
})

test('T10 glob 中间段:apps/**/*.tsx 覆盖任意深度,且不越目录、不过扩展名', () => {
  const t = ['apps/**/*.tsx']
  assert.equal(triggersTouch(['apps/x.tsx'], t), true, '零层目录也必须命中(globstar 语义)')
  assert.equal(triggersTouch(['apps/web/src/x.tsx'], t), true)
  assert.equal(triggersTouch(['apps/web/src/deep/x.tsx'], t), true)
  assert.equal(triggersTouch(['apps/web/src/x.ts'], t), false)
  assert.equal(triggersTouch(['packages/web/x.tsx'], t), false)
})

test('T11 glob 尾段:apps/mobile-rn/** 只覆盖该目录,不吃前缀相近的兄弟目录', () => {
  const t = ['apps/mobile-rn/**', 'packages/app/**']
  assert.equal(triggersTouch(['apps/mobile-rn/App.tsx'], t), true)
  assert.equal(triggersTouch(['apps/mobile-rn/src/screens/x.tsx'], t), true)
  assert.equal(triggersTouch(['packages/app/src/components/x.tsx'], t), true)
  assert.equal(triggersTouch(['apps/mobile-rn2/App.tsx'], t), false, '** 不得退化成前缀匹配')
  assert.equal(triggersTouch(['apps/api/src/x.ts'], t), false)
})

test('T12 单星不跨目录(scripts/*.mjs 只吃一层)', () => {
  assert.equal(triggersTouch(['scripts/a.mjs'], ['scripts/*.mjs']), true)
  assert.equal(triggersTouch(['scripts/lib/a.mjs'], ['scripts/*.mjs']), false)
})

test('T13 前缀与 glob 混用:各按各的语义,互不污染', () => {
  const t = ['PROJECT_PLAN.md', 'apps/**/*.ts']
  assert.equal(triggersTouch(['PROJECT_PLAN.md'], t), true)
  assert.equal(triggersTouch(['apps/api/src/x.ts'], t), true)
  assert.equal(triggersTouch(['apps/api/src/x.tsx'], t), false)
})

test('T14 Windows 反斜杠与 glob 同用', () => {
  assert.equal(triggersTouch(['apps\\web\\src\\x.tsx'], ['apps/**/*.tsx']), true)
})

test('T15 阳性对照:去掉 glob 分支后,注册表里的真实 glob 对真实路径必须判"不触及"', () => {
  // 用真实注册形态 + 真实路径复现修复前的行为:startsWith 一定为假 ⇒ 门被隐形跳过。
  const globTriggers = ['apps/**/*.tsx', 'apps/**/*.ts', 'packages/app/**/*.tsx', 'packages/**/*.ts']
  const realPaths = [
    'apps/web/src/components/sidebar/SidebarUserRow.tsx',
    'apps/mobile-rn/src/components/Drawer.tsx',
    'packages/app/src/components/BackChevron.tsx',
  ]
  const oldBehavior = realPaths.some((f) => globTriggers.some((p) => f.startsWith(p)))
  assert.equal(oldBehavior, false, '修复前 startsWith 恒假 —— 这就是三道门永不执行的原因')
  assert.equal(triggersTouch(realPaths, globTriggers), true, '修复后同一组输入必须判"触及"')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
