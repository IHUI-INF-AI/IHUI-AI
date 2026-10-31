// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-miniapp-style-tiers.test.mjs — 小程序非色档尺的镜像测试(§22c)
 *
 * 判据**全部 import 源脚本**(`__test__.scanText` / `reduceCounts`),本文件不复制任何正则或档值;
 * 这里只钉三件事:①纯函数分桶对;②真仓三桶都非零(尺子没有静默读小);③接线态与声明一致。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as tier } from '../check-miniapp-style-tiers.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-miniapp-style-tiers.mjs')
const PARITY_AUTO = join(ROOT, 'scripts', 'parity-auto.mjs')

const TABLE = {
  spacingPx: new Set([0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64]),
  typeSizes: new Set([10, 11, 12, 14, 15, 16, 18, 20, 24, 30]),
}

function runCli(args = []) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1 << 28,
    })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? 2, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

test('T1 项目字号档与 Tailwind 默认字号档必须分桶(同一份文本两种形态)', () => {
  const a = tier.scanText('className="text-body text-title"', TABLE)
  assert.equal(a.textProject, 2)
  assert.equal(a.textDefault, 0)
  const b = tier.scanText('className="text-sm text-xs text-lg"', TABLE)
  assert.equal(b.textDefault, 3)
  assert.equal(b.textProject, 0)
})

test('T2 任意值是否可等值落档:命中档表才算,档外值一律不算', () => {
  const hit = tier.scanText('className="text-[length:28rpx]"', TABLE)
  assert.equal(hit.textArbitrary, 1)
  assert.equal(hit.textArbitraryHittable, 1, '28rpx = 14px 在 TYPE_STEPS 里')
  const miss = tier.scanText('className="text-[length:26rpx]"', TABLE)
  assert.equal(miss.textArbitraryHittable, 0, '26rpx = 13px 不在档表,不得算可落档')
})

test('T3 间距:具名档 / 默认数字档 / rpx 字面量三桶互不吞并', () => {
  const c = tier.scanText('className="p-md gap-lg p-3 gap-2"', TABLE)
  assert.equal(c.spaceProjectNamed, 2)
  assert.equal(c.spaceDefaultNumeric, 2)
  const d = tier.scanText("style={{ padding: '24rpx', marginTop: 12rpx }}", TABLE)
  assert.equal(d.spaceLiteral, 2)
  assert.equal(d.spaceLiteralHittable, 2, '24rpx=12px / 12rpx=6px 都在 SPACING_STEPS')
})

test('T4 注释里的写法不得计数(判据必须吃剥过注释的正文)', () => {
  const raw = '// className="text-sm p-3"\n/* text-[length:28rpx] */\n'
  const c = tier.scanText(raw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''), TABLE)
  assert.equal(c.textDefault + c.spaceDefaultNumeric + c.textArbitrary, 0)
})

test('T5 汇总:三桶之和恰等于总数(不得有值落进缝里)', () => {
  const list = [
    tier.scanText('className="text-body p-md text-sm p-3 text-[length:28rpx]"', TABLE),
    tier.scanText("style={{ padding: '24rpx' }}", TABLE),
  ]
  const r = tier.reduceCounts(list)
  assert.equal(r.project + r.defaulted + r.literal, r.all)
  assert.ok(r.all > 0)
  assert.ok(r.project > 0 && r.defaulted > 0 && r.literal > 0, '三桶都必须非零,否则分流判据是空转')
})

test('T6 真仓 --self-test 必须全绿(纯函数层无回归)', () => {
  const r = runCli(['--self-test'])
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /0 failed/)
})

test('T7 真仓 --json:三桶都非零且形状稳定(尺子没静默读小)', () => {
  const r = runCli(['--json'])
  assert.equal(r.code, 0, r.out)
  const j = JSON.parse(r.out.trim().split('\n').pop())
  assert.ok(j.files > 100, `文件数异常偏小(${j.files})—— 目录清单可能没读到`)
  assert.ok(j.project > 0, '项目档桶为 0 ⇒ 尺子没认出具名档类')
  assert.ok(j.defaulted > 0, '默认档桶为 0 ⇒ 尺子没认出 Tailwind 默认档')
  assert.ok(j.literal > 0, '字面量桶为 0 ⇒ 尺子没认出 rpx 字面量')
  for (const k of ['textProject', 'textDefault', 'textArbitrary', 'spaceProjectNamed', 'spaceDefaultNumeric', 'spaceLiteral', 'tsRefs', 'cssVarRefs']) {
    assert.equal(typeof j[k], 'number', `缺字段 ${k}`)
  }
})

test('T8 已接线:parity-auto 的 gate 组必须有本尺(声明与调度同形)', () => {
  const src = readFileSync(PARITY_AUTO, 'utf8')
  assert.match(src, /check-miniapp-style-tiers\.mjs/, '尺子未登记进 parity-auto 的调度表 ⇒ "造好没装车"')
})

test('T9 本文件必须是测试本体,不是守门脚本的整文件副本', () => {
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  const target = readFileSync(SCRIPT, 'utf8')
  assert.ok(target.length > self.length, '守门脚本不得比镜像测试还小')
  // 断言串**拼接**构造:直接写完整标识符会让本条断言自指恒命中(记忆项"形状判据不能用串写")。
  const copyMarker = ['export', 'function', 'scanText'].join(' ')
  assert.equal(self.includes(copyMarker), false, '测试里不得出现第二份判据实现')
  assert.ok(self.includes('..\\check-miniapp-style-tiers.mjs') || self.includes('../check-miniapp-style-tiers.mjs'), '判据必须 import 源脚本')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
