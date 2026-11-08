// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat S-SCOPE 2026-11-08
/**
 * gate-scope-header-consistency.test.mjs —— DG-11:头注与实现的档位口径不许互斥。
 *
 * ## 立因(缺陷 DG-11)
 *
 * `gate-scope.mjs` 文件头注旧说:「`full` —— 强制全量,两种情形:a) 暂存集含 `apps/` 或
 * `packages/`;b) 暂存集含判据库」。而实现(2026-10-22 起)对业务路径**恒返回 `meta`**,
 * 业务判据整体归 CI。注释与行为互斥,读注释的人会以为改 apps/ 会触发全量。
 *
 * 修法:**以实现为准改注释**,`resolveGateScope` 行为一个字节都不许动。
 *
 * ## 三条断言
 *
 *   a) 头注里不得再有「`full` 情形包含 apps/packages」的旧声明(改前必红);
 *   b) 头注必须写明 `full` 的三种来路(JUDGEMENT_LIBS 判据库 / `IHUI_GATE_SCOPE=full` /
 *      暂存集为空或读不到),以及 2026-10-22 起本地一律 meta、全量归 CI;
 *   c) 行为锁:业务路径仍判 `meta` 且 `businessCount >= 1`,空暂存集仍判 `full` ——
 *      证明这次只改了注释,没动实现。
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const SCOPE_LIB = join(ROOT, 'scripts', 'lib', 'gate-scope.mjs')
const SRC = readFileSync(SCOPE_LIB, 'utf8')

/** 只取模块顶部的文档注释块 —— 断言范围限定在头注,不误伤函数体内的说明。 */
const DOC_START = SRC.indexOf('/**')
assert.ok(DOC_START >= 0, 'gate-scope.mjs 里找不到 `/**` 模块头注')
const DOC_END = SRC.indexOf('*/', DOC_START)
assert.ok(DOC_END > DOC_START, 'gate-scope.mjs 的头注没有闭合 `*/`')
const HEADER = SRC.slice(DOC_START, DOC_END + 2)

/** `full` 档描述段(从头注里第一个 `full` 到第一个 `meta` 之间)。 */
const FULL_SECTION = /`full`([\s\S]*?)(?:`meta`|$)/.exec(HEADER)?.[1] ?? ''

const scopeMod = await import(pathToFileURL(SCOPE_LIB).href)

test('a) 旧声明「full 的两种情形之一是暂存集含 apps/packages」必须 0 命中', () => {
  assert.match(HEADER, /gate-scope\.mjs/, '头注提取失败:没取到 gate-scope.mjs 的模块说明')
  assert.ok(FULL_SECTION.length > 0, '头注里找不到 `full` 档描述段')

  // a-1 精确段扫:`full` 档描述段内不许再出现业务路径 —— 旧头注在此必红。
  assert.ok(
    !/apps|packages/.test(FULL_SECTION),
    '`full` 档描述段仍包含 apps/packages ⇒ 与实现互斥(实现恒对业务路径返回 meta)。\n' +
      `命中段:${FULL_SECTION.trim()}`,
  )

  // a-2 跨行窗口:`full` + 「两种情形」+ 600 字内出现 apps —— 旧头注的原文骨架。
  const oldCrossLine = /`full`[^\n]*[两二]种情形[\s\S]{0,600}?apps/
  assert.ok(
    !oldCrossLine.test(HEADER),
    '头注仍在用「full 两种情形」的旧骨架宣称 apps/packages 触发全量(DG-11)。\n' +
      `命中:${HEADER.match(oldCrossLine)?.[0] ?? ''}`,
  )

  // a-3 单行扫:任何一行同时写「暂存集含 … apps」也一律不许。
  assert.ok(
    !/暂存集含[^\n]*apps/.test(HEADER),
    '头注仍有「暂存集含 … apps」的单行旧说法(DG-11)',
  )
})

test('b) 头注必须写明 full 的三种来路与本地默认 meta', () => {
  // 三种来路:判据库 / 逃生舱 / 空暂存集。
  assert.match(HEADER, /JUDGEMENT_LIBS|判据库/, '头注没写「暂存集含判据库 ⇒ full」这一来路')
  assert.match(HEADER, /IHUI_GATE_SCOPE=full/, '头注没写逃生舱 IHUI_GATE_SCOPE=full')
  assert.match(HEADER, /暂存集为空|读不到/, '头注没写「暂存集为空/读不到 ⇒ full」这一来路')

  // 本地默认档口径与切换日期。
  assert.match(HEADER, /2026-10-22/, '头注没写 2026-10-22 起本地一律 meta、全量归 CI 的切换点')
  assert.match(HEADER, /meta/, '头注没写本地默认档 meta')
  assert.match(HEADER, /businessCount/, '头注没写业务提交在 reason 里用 businessCount 说明')
  assert.match(HEADER, /业务判据归 CI/, '头注没写「业务判据归 CI」')
})

test('c) 行为锁:业务路径仍 meta/businessCount>=1,空暂存集仍 full', () => {
  const saved = process.env.IHUI_GATE_SCOPE
  delete process.env.IHUI_GATE_SCOPE
  try {
    for (const bizPath of ['apps/web/app/page.tsx', 'packages/ui/src/index.ts']) {
      const sc = scopeMod.resolveGateScope([bizPath])
      assert.equal(sc.scope, 'meta', `${bizPath} 应仍判 meta(实得 ${sc.scope}:${sc.reason})`)
      assert.ok(sc.businessCount >= 1, `${bizPath} 的 businessCount 应 >= 1,实得 ${sc.businessCount}`)
    }
    assert.equal(
      scopeMod.resolveGateScope([]).scope,
      'full',
      '空暂存集仍须回落 full(失效方向多跑) —— 该断言锁死「只改注释未改行为」',
    )
  } finally {
    if (saved === undefined) delete process.env.IHUI_GATE_SCOPE
    else process.env.IHUI_GATE_SCOPE = saved
  }
})
