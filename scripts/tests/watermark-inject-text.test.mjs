#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:G-04 —— 文本级注入出口 `injectText`(横幅/L2 载荷/L3 尾行三段只在那一处算)
 * 与「新建路径在对象空间内补注入」的编排函数 `injectNewPathBlobs`。
 *
 * 立因(票面现读事实):旁路落地器按「HEAD blob → 内存改写 → commit-tree → CAS」产出,
 * 刻意从不写工作树(§1/§12 要求),于是 §5c 的「writeFileSync 后必须紧随注入」在它身上
 * 结构上不可能触发 —— 新建的归档台账曾以"无水印"形态直接进 HEAD(2026-10-15 实测)。
 *
 * 四条臂(§22c:判据直接 import 生产实现,本文件不复制任何横幅/载荷构造):
 *  - A 注入:裸文本 → 'injected',载荷可解码、正文逐行保留;
 *  - B 幂等:同一份再注入 → 'skip-done' 且逐字节不变(调用方据此避免无谓重算 oid);
 *  - C 与 CLI 同一份构造:`watermark.mjs inject <file>` 的产物 == `injectText` 的返回
 *    ("不留两份注入逻辑"的镜像证明 —— 这一条红了就是有人把构造抄了第二份);
 *  - D 编排:只动 newPaths、入参 Map 不被就地改写、取不到正文必须进 refused(不是静默跳过)。
 *
 * 跑法:`node --test scripts/tests/watermark-inject-text.test.mjs`
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as WM } from '../watermark.mjs'
import { __test__ as OSL } from '../object-space-land.mjs'

const REPO = join(import.meta.dirname, '..', '..')
const WM_CLI = join(REPO, 'scripts', 'watermark.mjs')
const SRC = readFileSync(WM_CLI, 'utf8')
const BODY = ['export const answer = 42', 'export function hi() {', "  return 'hi'", '}', ''].join('\n')

test('A 注入:裸文本 ⇒ injected,载荷可解码、横幅与尾行各一份、正文逐行保留', () => {
  const r = WM.injectText(BODY, { rel: 'src/demo.ts' })
  assert.equal(r.action, 'injected', JSON.stringify(r.action))
  assert.ok(WM.payloadIntact(r.text), '载荷必须可解码(= WATERMARK_TEXT)')
  assert.ok(r.text.includes(WM.BANNER_ID), '缺少可见横幅标记')
  assert.equal((r.text.match(new RegExp(WM.BANNER_ID, 'g')) ?? []).length, 1, '横幅标记只能有一份')
  for (const line of BODY.split('\n')) {
    if (line.trim() === '') continue
    assert.ok(r.text.includes(line), `正文行被改动:${line}`)
  }
  const tail = r.text.replace(/\r?\n+$/, '').split('\n').pop() || ''
  assert.match(tail, /^\/\/ /, 'L3 必须是末行的注释包裹形态(裸零宽行会让 JS 解析失败)')
  assert.ok(WM.payloadIntact(tail), 'L3 尾行自身必须可解码')
})

test('B 幂等:同一份再注入 ⇒ skip-done 且逐字节不变(否则每次落地都会换一个 oid)', () => {
  const once = WM.injectText(BODY, { rel: 'src/demo.ts' })
  const twice = WM.injectText(once.text, { rel: 'src/demo.ts' })
  assert.equal(twice.action, 'skip-done')
  assert.equal(twice.text, once.text, 'skip-done 时调用方不得写盘,文本必须原样回传')
})

test('C 与 CLI 同一份构造:injectFile 的产物必须 == injectText 的返回(禁止第二份注入逻辑)', () => {
  const dir = mkScratch('wm-inject-text-')
  try {
    const f = join(dir, 'demo.ts')
    writeFileSync(f, BODY, 'utf8')
    execFileSync(process.execPath, [WM_CLI, 'inject', f], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const viaCli = readFileSync(f, 'utf8')
    const viaText = WM.injectText(BODY, { rel: 'demo.ts' }).text
    assert.equal(viaCli, viaText, '两条通道的产物逐字节相等 —— 不等就是有人把构造抄了第二份(§0.6)')
  } finally {
    rmScratch(dir)
  }
})

test('C2 形状锁:injectFile 只做策略档与读写,构造(横幅/尾行)只在 injectText 一处', () => {
  const start = SRC.indexOf('function injectFile(')
  assert.ok(start > 0, 'injectFile 必须还在(缺了说明被整体改写,需人工复核)')
  const end = SRC.indexOf('\n}\n', start)
  const bodyOfInjectFile = SRC.slice(start, end)
  assert.match(bodyOfInjectFile, /injectText\(/, 'injectFile 必须复用 injectText')
  assert.equal(
    bodyOfInjectFile.includes('makeBanner('),
    false,
    'injectFile 里不得再直接拼横幅(第二份构造必然漂移)',
  )
  assert.equal(
    (SRC.match(/makeBanner\(/g) ?? []).length,
    2, // 1 处定义 + 1 处调用(在 injectText 内)
    'makeBanner 的调用点必须只有 injectText 一处',
  )
})

test('D 编排:只动 newPaths、入参 Map 不被就地改写、已带载荷不重算 oid', () => {
  const blobs = new Map([
    ['brand/new.ts', 'old-a'],
    ['keep.ts', 'old-b'],
  ])
  const calls = []
  const r = OSL.injectNewPathBlobs({
    newPaths: ['brand/new.ts'],
    blobs,
    readText: () => ({ text: BODY }),
    hashText: (text, p) => {
      calls.push(p)
      assert.ok(WM.payloadIntact(text), '写进对象库的必须是注入后的那一份')
      return 'new-a'
    },
  })
  assert.deepEqual(r.injected, ['brand/new.ts'])
  assert.equal(r.blobs.get('brand/new.ts'), 'new-a')
  assert.equal(r.blobs.get('keep.ts'), 'old-b', '没进 newPaths 的路径一个字节都不许动(已存在路径语义不变)')
  assert.equal(blobs.get('brand/new.ts'), 'old-a', '入参 Map 不得被就地改写(调用方还要用它做对照)')
  assert.deepEqual(calls, ['brand/new.ts'])

  // 已带可解码载荷 ⇒ 进 already,hashText 一次都不派(避免每次落地都换 oid)
  const signed = WM.injectText(BODY, { rel: 'brand/new.ts' }).text
  let hashed = 0
  const r2 = OSL.injectNewPathBlobs({
    newPaths: ['brand/new.ts'],
    blobs,
    readText: () => ({ text: signed }),
    hashText: () => {
      hashed++
      return 'x'
    },
  })
  assert.deepEqual(r2.already, ['brand/new.ts'])
  assert.equal(hashed, 0)
})

test('D2 取不到正文 / 政策豁免 / 类型不在口径:三档不并桶(refused 必须非空,不得静默放行)', () => {
  const blobs = new Map([
    ['a.ts', 'oid-a'],
    ['b.ts', 'oid-b'],
    ['c.txt', 'oid-c'],
  ])
  const r = OSL.injectNewPathBlobs({
    newPaths: ['a.ts', 'b.ts', 'c.txt'],
    blobs,
    readText: (p) => (p === 'a.ts' ? { why: '对象库问不到该 blob' } : { text: BODY }),
    hashText: () => 'never',
    skip: (p) => (p === 'b.ts' ? '台账登记的第三方内容' : null),
  })
  assert.deepEqual(
    r.refused.map((x) => x.path),
    ['a.ts'],
    '取不到正文 = 未判定,必须进 refused(调用方据此 exit 2),不得折成"无需注入"',
  )
  assert.deepEqual(
    r.skipped.map((x) => x.path),
    ['b.ts', 'c.txt'],
    '政策豁免与类型不在口径都只跳过,不进 refused',
  )
  assert.deepEqual(r.injected, [])
  assert.equal(r.blobs.get('a.ts'), 'oid-a', '未判定的路径保持原 oid(不猜一个新 blob 出来)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
