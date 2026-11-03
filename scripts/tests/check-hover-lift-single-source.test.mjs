// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat S-hover-lift 2026-11-03

/**
 * check-hover-lift-single-source.test.mjs — 门 287 的镜像测试(2026-11-03;原 285 与 props 对账门撞号后顺延)。
 *
 * 纪律(§22c):判据一律从源脚本 `__test__` import,**不在此复制任何 regex**;
 * 本文件钉的是"判据有没有牙 + 接线有没有装实",不是"代码跑得动":
 *   ① 判据三形态(命中/放行/注释遮罩)用真函数跑夹具;
 *   ② 台账四态(配平/超出/腐烂/到期)用同一份 judgeAgainstAllowlist;
 *   ③ 形状锁:runner 注册条目 blocking+skipEnv 成套、script 文件真实存在;
 *   ④ 形状锁:globals.css 的浮起数值源仍单点(`--lift-scale` 只允许出现在该文件);
 *   ⑤ 反向牙:摘掉判据的 hover 语义段,同串文本必须翻零(证明尺子指在语义段上)。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as GATE } from '../check-hover-lift-single-source.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = dirname(dirname(HERE))

test('① 判据导出的键齐备(改名即红:镜像与门体天然同尺的前提)', () => {
  for (const key of [
    'judgeLiftLiterals',
    'judgeAgainstAllowlist',
    'R_TRANSLATE_Y',
    'R_SHADOW',
    'LEDGER_REL',
    'SCAN_GLOBS',
  ]) {
    assert.ok(key in GATE, `__test__ 缺键:${key}`)
  }
})

test('② 命中形态:group-hover/变体链/色档逐一按枚计,静态与 scale 族放行', () => {
  const hits = GATE.judgeLiftLiterals(`const c = "group-hover:-translate-y-2 group-hover:shadow-xl"`)
  assert.equal(hits.length, 2)
  const pass = GATE.judgeLiftLiterals(
    `const c = "object-cover group-hover:scale-105 shadow-lg bg-card p-3 hover:bg-accent/40"`,
  )
  assert.equal(pass.length, 0)
})

test('③ 注释遮罩:提及不算散写(判字面量的门只遮注释)', () => {
  const t = `// 这里曾有 hover:shadow-xl 的散写\n/* group-hover:-translate-y-2 */\nconst x = 1`
  assert.equal(GATE.judgeLiftLiterals(t).length, 0)
})

test('④ 变异(反向牙):摘掉 hover 语义段后同串必须翻零', () => {
  const stray = `"duration-300 hover:-translate-y-1 hover:shadow-xl"`
  assert.equal(GATE.judgeLiftLiterals(stray).length, 2)
  assert.equal(GATE.judgeLiftLiterals(stray.replaceAll('hover:', 'base-')).length, 0)
})

test('⑤ 台账:超出登记数判红、少于登记数判腐烂,两侧都不许静默', () => {
  const entries = [
    {
      file: 'a.tsx',
      liftCalls: 2,
      reason: '豁免理由足够长的一句话说明',
      until: '2099-01-01',
    },
  ]
  const mk = (n) =>
    new Map([['a.tsx', Array.from({ length: n }, (_, i) => ({ line: i + 1, dim: 'shadow', snippet: 's' }))]])
  const v1 = GATE.judgeAgainstAllowlist(mk(2), entries, { today: '2026-11-03' })
  assert.equal(v1.violations.length, 0)
  assert.equal(v1.stale.length, 0)
  const v2 = GATE.judgeAgainstAllowlist(mk(3), entries, { today: '2026-11-03' })
  assert.equal(v2.violations.length, 1)
  const v3 = GATE.judgeAgainstAllowlist(mk(1), entries, { today: '2026-11-03' })
  assert.equal(v3.stale.length, 1)
})

test('⑥ 台账:到期条目 exempt 归零、缺 until/短 reason 一律 malformed(不允许当没豁免)', () => {
  const perFile = new Map([['a.tsx', [{ line: 3, dim: 'shadow', snippet: 'x' }]]])
  const vExp = GATE.judgeAgainstAllowlist(
    perFile,
    [{ file: 'a.tsx', liftCalls: 1, reason: '足够长度的豁免原因说明', until: '2020-01-01' }],
    { today: '2026-11-03' },
  )
  assert.equal(vExp.expired.length, 1)
  assert.ok(!('malformed' in vExp) || !vExp.malformed)
  const bad1 = GATE.judgeAgainstAllowlist(perFile, [{ file: 'a.tsx', liftCalls: 1, reason: '足够长度的豁免原因说明' }], {
    today: '2026-11-03',
  })
  assert.ok(bad1.malformed)
  const bad2 = GATE.judgeAgainstAllowlist(perFile, [{ file: 'a.tsx', liftCalls: 1, reason: '短', until: '2099-01-01' }], {
    today: '2026-11-03',
  })
  assert.ok(bad2.malformed)
})

test('⑦ 形状锁:runner 注册条目 blocking+skipEnv 成套且 script 文件在位', () => {
  const runner = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const re = /\{\s*id:\s*'285',[\s\S]*?\n {2}\},/
  const m = runner.match(re)
  assert.ok(m, 'runner 未注册 id 285(门没装车 = 没有,§0.9)')
  const entry = m[0]
  assert.ok(entry.includes("mode: 'blocking'"), '285 必须是 blocking(清扫后存量=0,非恒红门)')
  assert.ok(
    entry.includes("skipEnv: 'HUSKY_SKIP_HOVER_LIFT_SINGLE_SOURCE'"),
    'blocking 门必须带成套应急跳过变量',
  )
  assert.ok(
    !/(id|script):.*\1/.test('') && (entry.match(/id:/g) || []).length === 1,
    '注册对象里出现两枚 id = R13 吞号形态',
  )
  const scriptName = entry.match(/script:\s*'([^']+)'/)?.[1]
  assert.ok(scriptName && existsSync(join(ROOT, 'scripts', scriptName)), `script 指向的文件不存在:${scriptName}`)
})

test('⑧ 形状锁:浮起数值源仍单点(--lift-scale 只在 globals.css 声明一次)', () => {
  const css = readFileSync(join(ROOT, 'apps', 'web', 'app', 'globals.css'), 'utf8')
  const decls = css.match(/--lift-scale:/g) || []
  assert.equal(decls.length, 1, '--lift-scale 声明必须全仓恰一枚(单一真相源漂开即红)')
  assert.ok(existsSync(join(ROOT, 'scripts', 'data', GATE.LEDGER_REL.split('/').pop())), '豁免台账必须与门同批在位')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
