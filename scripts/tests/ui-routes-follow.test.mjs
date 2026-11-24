// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 路由跟随格的镜像测试(§22c):生成器 --check 判据 + 跨端差集棘轮。
 *
 * 覆盖方向(逐条对应判据设计):
 *   T1 多行 Screen 条目必须被解析(历史事故:正则只认 `{ name:` 漏掉 4 条,347 被读成 343)
 *   T2 行差分方向正确(盘上多出 / 盘上缺少)
 *   T3 幂等:只差 generatedAt/sourceCommit 的两份内容判「相等」;正文改一字判「不等」
 *   T4 inspectGenerated 三态:missing / fresh / stale,且 stale 必须点名增删行
 *   T5 基线棘轮:增 ⇒ 红、降 ⇒ 绿、键缺失 ⇒ 不猜(跳过)
 *   T6 端到端:仓内现有产物可被解析且互相对账(registry 页面全在小程序页面表)
 *   T7 CLI 用法:未知旗标 ⇒ exit 2;--report ⇒ exit 0 且给出差集表
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as CHECK, formatInspection, inspectGenerated, maskVolatile } from '../lib/generated-output-check.mjs'
import { __test__ as FOLLOW, computeFollow, compareBaseline, formatFollowReport } from '../lib/ui-routes-follow.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { injectText } from '../watermark.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('T1 多行 Screen 条目必须被解析(347 而不是 343)', () => {
  const fixture = `
export const RN_UI_ROUTES: X[] = [
  { name: 'Wallet', param: false, group: 'main' },
  {
    name: 'LetterChat',
    param: true,
    requiredParams: ['id'],
  },
]
`
  assert.deepEqual(FOLLOW.parseRnScreens(fixture), ['Wallet', 'LetterChat'])
})

test('T2 行差分方向:expected 少一行 ⇒ 盘上多出;expected 多一行 ⇒ 盘上缺少', () => {
  const expected = 'a\nb\nc\n'
  const actual = 'a\nb\nc\nextra\n'
  const { added, removed } = CHECK.diffLines(expected, actual)
  assert.deepEqual(added, ['extra'])
  assert.deepEqual(removed, [])
  const reverse = CHECK.diffLines(actual, expected)
  assert.deepEqual(reverse.added, [])
  assert.deepEqual(reverse.removed, ['extra'])
})

test('T3 幂等:generatedAt / sourceCommit 漂移不产生差异,正文改一字必须产生差异', () => {
  const base = '// generatedAt: 2026-11-07T00:00:00.000Z\n// sourceCommit: aaa\n  { path: `/x` }\n'
  const drifted = '// generatedAt: 2026-11-07T01:00:00.000Z\n// sourceCommit: bbb\n  { path: `/x` }\n'
  assert.equal(maskVolatile(base), maskVolatile(drifted))
  const changedBody = base.replace('/x', '/y')
  assert.notEqual(maskVolatile(base), maskVolatile(changedBody))
})

test('T4 inspectGenerated 三态 + stale 必须点名增删行', () => {
  const dir = mkScratch('ui-routes-follow')
  try {
    const outFile = join(dir, 'sample.generated.ts')
    const expected = '// generatedAt: 2026-11-07T00:00:00.000Z\n// sourceCommit: aaa\nexport const X = [\n  1,\n]\n'
    const missing = inspectGenerated({ outFile, expected })
    assert.equal(missing.state, 'missing')
    assert.equal(missing.ok, false)

    // 盘上产物必经水印注入(生成器写盘链路的一环),夹具必须按落盘形态写,否则验的是假世界
    const onDisk = injectText(expected, { rel: 'scripts/tmp/sample.generated.ts' }).text
    writeFileSync(outFile, onDisk, 'utf8')
    const fresh = inspectGenerated({ outFile, expected })
    assert.equal(fresh.state, 'fresh')

    writeFileSync(outFile, injectText(expected.replace('  1,', '  2,'), { rel: 'scripts/tmp/sample.generated.ts' }).text, 'utf8')
    const stale = inspectGenerated({ outFile, expected })
    assert.equal(stale.state, 'stale')
    assert.equal(stale.ok, false)
    const text = formatInspection(stale)
    assert.match(text, /陈旧/)
    assert.match(text, /2/)
  } finally {
    rmScratch(dir)
  }
})

test('T5 基线棘轮:增 ⇒ 红,降 ⇒ 绿,键缺失 ⇒ 跳过不猜', () => {
  const baseline = { gaps: { rnScreensWithoutRouteMap: 3, taroPagesWithoutRouteMap: 2 } }
  assert.equal(compareBaseline({ gaps: { rnScreensWithoutRouteMap: 4, taroPagesWithoutRouteMap: 2 } }, baseline).ok, false)
  assert.equal(compareBaseline({ gaps: { rnScreensWithoutRouteMap: 2, taroPagesWithoutRouteMap: 2 } }, baseline).ok, true)
  const partial = compareBaseline({ gaps: { rnScreensWithoutRouteMap: 3 } }, baseline)
  assert.equal(partial.ok, true)
})

test('T6 端到端:现有五份产物可解析且 registry 页面全部落在小程序页面表', () => {
  const report = computeFollow()
  assert.ok(report.entries.webRoutes > 0, 'web 路由不应为空')
  assert.ok(report.entries.rnScreens > 0, 'RN Screen 不应为空')
  assert.ok(report.entries.taroPages > 0, '小程序页面不应为空')
  assert.ok(report.entries.routeMapEntries > 0, 'route-map 不应为空')
  assert.equal(report.gaps.registryPagesNotInTaro, 0, 'registry 声明的页面必须都在小程序页面表里')
  assert.equal(report.gaps.registryRnFilesMissing, 0, 'registry 声明的 RN 文件必须都在盘上')
  assert.match(formatFollowReport(report), /Web   UI_ROUTES/)
})

test('T7 CLI 用法:未知旗标 ⇒ exit 2,--report ⇒ exit 0', () => {
  const script = join(REPO_ROOT, 'scripts', 'gen-ui-routes.mjs')
  let unknownExit = 0
  try {
    execFileSync(process.execPath, [script, '--nope'], { cwd: REPO_ROOT, stdio: 'ignore', windowsHide: true })
  } catch (err) {
    unknownExit = err.status
  }
  assert.equal(unknownExit, 2)

  const out = execFileSync(process.execPath, [script, '--report'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    windowsHide: true,
  })
  assert.match(out, /三端路由真源与当前读数/)
  assert.match(out, /当前差集/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
