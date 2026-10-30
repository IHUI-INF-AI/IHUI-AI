#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * hue-tints.test.mjs — 色相族 tint 单源表(packages/design-tokens/src/hue-tints.js)的接线锁。
 *
 * 立项起因(2026-10-31):同一族 emerald tint 在 packages/app 里被手抄进 8 个文件,抄本之间已漂出
 * alpha 不一致、族名与色相对不上、同族灰三张名字两种值三类实缺陷。本表把取值收成一份,
 * 而"收成一份"必须有机器在看,否则下一个屏再抄一份就是第九份抄本。
 *
 * 钉五件事:
 *  ① 形状:tint 两档必须写成两位小数 alpha(0.10/0.12)—— 端内既成字面量都是这个形态,
 *     数值等价而字符串不等会被跨端同源对账判成漂移;
 *  ② 同值不重复登记:amber.dot 与 rnTokens.warning.amber、neutral.fg 与 rnTokens.gray.500
 *     同值,必须**现算等值**而不是各处写死(值改了这条就响);
 *  ③ 族名禁用 `gray`:本仓 gray.* 档是 Tailwind neutral 系,与 Tailwind 的 gray 系不同值,
 *     用 gray 当族名必然被读成前者;
 *  ④ 覆盖面:packages/app 在册抄本里的每一条色值,都必须能从本表取到同值 —— 取不到就是
 *     "有人抄了第九份而表里没有这族";带正例对照,坏值必须判不过;
 *  ⑤ 装车:包根出口必须真的把 rnHue 导出去(判据存在而永不可取用 = 没有)。
 *
 * 取材口径:表与包出口读磁盘源;④ 的抄本面读磁盘(与其余镜像测试同形,被审内容的面由门自己管)。
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { rnHue, hueFamilies, hueTint, hueTintStrong } from '../../packages/design-tokens/src/hue-tints.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const require_ = createRequire(import.meta.url)

const TABLE_FAMILIES = hueFamilies()

test('① 形状:tint 两档的 alpha 必须是两位小数', () => {
  for (const f of TABLE_FAMILIES) {
    for (const [key, value] of Object.entries(rnHue[f])) {
      if (key !== 'tint' && key !== 'tintStrong') continue
      assert.match(value, /^rgba\(\d{1,3},\d{1,3},\d{1,3},0\.\d{2}\)$/, `${f}.${key} 形态不合约定:${value}`)
    }
  }
  assert.equal(rnHue.emerald.tint, 'rgba(16,185,129,0.10)')
  assert.equal(rnHue.emerald.tintStrong, 'rgba(16,185,129,0.12)')
})

test('② 表内不得登记已由 tokens.css 派生承载的色值(防新造第二真相)', () => {
  const dt = require_(join(ROOT, 'packages/design-tokens/dist/rn-tokens.js'))
  const tokens = dt.rnTokens ?? dt.default?.rnTokens
  assert.ok(tokens, 'dist 里取不到 rnTokens ⇒ dist 落后或形态变了,本条判不出')
  const flatHexes = {}
  const walk = (o) => {
    for (const v of Object.values(o)) {
      if (typeof v === 'string' && v.startsWith('#')) flatHexes[v.toLowerCase()] = 1
      else if (v && typeof v === 'object') walk(v)
    }
  }
  walk(tokens)
  // 正向对照:值集里必须真拿得到 warning.amber,否则"没有重复"是空集而非结论
  assert.ok(
    Object.hasOwn(flatHexes, tokens.warning.amber.toLowerCase()),
    '对照失效:rnTokens 里连 warning.amber 都没扫到 ⇒ 这把尺子在空转',
  )

  const duplicated = []
  for (const f of TABLE_FAMILIES)
    for (const [key, value] of Object.entries(rnHue[f]))
      if (value.startsWith('#') && Object.hasOwn(flatHexes, value.toLowerCase()))
        duplicated.push(`${f}.${key}=${value}`)
  assert.deepEqual(
    duplicated,
    [],
    `这些枚已由 tokens.css 派生进 RN 令牌表,再登一份就是守门 93 R8 禁的第二真相;消费方应取语义档:${duplicated.join(', ')}`,
  )
})

test('③ 族名禁用裸 gray,禁用未登记的族', () => {
  assert.ok(!TABLE_FAMILIES.includes('gray'), '族名 gray 与本仓 gray.* 档(Tailwind neutral 系)同字不同值,禁止使用')
  for (const f of TABLE_FAMILIES) assert.equal(typeof rnHue[f].tint, 'string', `${f} 缺 tint 档`)
})

test('④ 覆盖面:packages/app 在册抄本每条色值都要能从表里取到同值', () => {
  const tableValues = new Set()
  for (const f of TABLE_FAMILIES)
    for (const v of Object.values(rnHue[f])) if (typeof v === 'string') tableValues.add(v.toLowerCase())

  // 抄本里凡"已由语义档承载"的色值(#737373 = text.tertiary、#f59e0b = warning.amber)
  // 也算有出处 —— 收编时那些枚取语义档而不是 rnHue,所以可接受集 = 色相表 ∪ 令牌表
  const dt = require_(join(ROOT, 'packages/design-tokens/dist/rn-tokens.js'))
  const walkInto = (o) => {
    for (const v of Object.values(o ?? {})) {
      if (typeof v === 'string' && v.startsWith('#')) tableValues.add(v.toLowerCase())
      else if (v && typeof v === 'object') walkInto(v)
    }
  }
  walkInto(dt.rnTokens ?? dt.default?.rnTokens)

  const copied = [
    'packages/app/src/features/edu-ai/edu-ai-styles.ts',
    'packages/app/src/features/plan/plan-styles.ts',
    'packages/app/src/features/status/status-styles.ts',
    'packages/app/src/features/support/support-styles.ts',
    'packages/app/src/features/student/student-styles.ts',
    'packages/app/src/features/sign-up/SignUpScreen.tsx',
    'packages/app/src/features/artifacts/ArtifactsScreen.tsx',
    'packages/app/src/features/cards/AgentCard.tsx',
  ]

  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const uncovered = []
  let seen = 0
  for (const rel of copied) {
    const text = stripComments(readFileSync(join(ROOT, rel), 'utf8'))
    for (const raw of new Set(text.match(/rgba\(\s*[\d,.\s]+?\)|#[0-9a-fA-F]{6}\b/g) ?? [])) {
      seen += 1
      const norm = raw.replace(/\s+/g, '').toLowerCase()
      // 表里没有、但确实引用了 rnTokens 档的同值形态(如 #f59e0b)也算覆盖:②已管等值
      const inTable = [...tableValues].some((v) => v.replace(/\s+/g, '') === norm)
      if (!inTable) uncovered.push(`${norm} ← ${rel.split('/').pop()}`)
    }
  }
  // 空转保护不能钉死一个绝对阈值:收编进行中抄本会变少(实测从 84 条降到只剩未收编那几个文件)。
  // 口径改成两态:还有抄本 ⇒ 逐条必须有出处;抄本清零 ⇒ 必须证明这张表真有消费方(否则是死档)。
  if (seen === 0) {
    const consuming = copied.filter((rel) => readFileSync(join(ROOT, rel), 'utf8').includes('rnHue.'))
    assert.ok(
      consuming.length > 0,
      '抄本已清零而这几个文件一处都不取用 rnHue ⇒ 表成了死档(判据存在而无人 import = 没有)',
    )
  }
  assert.deepEqual(uncovered, [], `这些色值在表里取不到 ⇒ 有人抄了表里没有的族,须先落档: ${uncovered.join(', ')}`)

  // 反向对照:同一条尺子喂一个表外值,必须判不过(否则"零缺口"是坏尺)
  const broken = 'rgba(1,2,3,0.10)'.replace(/\s+/g, '')
  assert.equal(
    [...tableValues].some((v) => v.replace(/\s+/g, '') === broken),
    false,
    '反向对照失效:表外值被判成覆盖',
  )
})

test('⑥ 装车腿:dist 里必须真拿得到这张表,且值与源逐字相同', () => {
  // 立因:上一枚把表写进 src 并加了包根出口,却没登记 copy-assets 的 FIXED_FILES ——
  // 干净重建后 dist 里没有 hue-tints,而 dist/index.js 已在 `export { rnHue } from './hue-tints.js'`,
  // 于是每个消费屏在运行时直接 ERR_MODULE_NOT_FOUND。"源码里有"不等于"装上车"。
  const distPath = join(ROOT, 'packages/design-tokens/dist/hue-tints.js')
  let distText
  try {
    distText = readFileSync(distPath, 'utf8')
  } catch {
    assert.fail(
      'dist 里没有 hue-tints.js ⇒ 包构建清单没登记它(packages/design-tokens/scripts/copy-assets.mjs 的 FIXED_FILES),表造好但装不上车',
    )
  }
  const dist = require_(distPath)
  const distHue = dist.rnHue ?? dist.default?.rnHue
  assert.ok(distHue, 'dist 里的 hue-tints 取不到 rnHue 导出')
  for (const f of TABLE_FAMILIES)
    assert.deepEqual(distHue[f], rnHue[f], `dist 与源的 ${f} 族不同形 ⇒ 派生态落后`)
  assert.match(
    readFileSync(join(ROOT, 'packages/design-tokens/scripts/copy-assets.mjs'), 'utf8'),
    /FIXED_FILES[\s\S]*'hue-tints\.js'[\s\S]*'hue-tints\.d\.ts'/,
    'copy-assets 清单里没登记 hue-tints 两枚 ⇒ 下次干净构建又会缺件',
  )
})

test('⑤ 装车:包根出口真的导出 rnHue 与两个函数形态', () => {
  const index = readFileSync(join(ROOT, 'packages/design-tokens/src/index.ts'), 'utf8')
  assert.match(index, /export\s*\{[^}]*rnHue[^}]*\}\s*from\s*'\.\/hue-tints\.js'/, 'index.ts 未导出 rnHue')
  assert.equal(typeof hueTint, 'function')
  assert.equal(typeof hueTintStrong, 'function')
  assert.equal(hueTint('rose'), rnHue.rose.tint)
  assert.throws(() => hueTint('notAFamily'), /不在表内|不在本表/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
