// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 313 镜像测试 —— 判据一律 import 源脚本 __test__(§22c:禁止在测试里复制判据)。
 * 覆盖三臂的正反两对照:绿面不误判、回潮面必判出。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as T } from '../check-typography-face-coverage.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const globalsCss = readFileSync(join(ROOT, 'apps/web/app/globals.css'), 'utf8')
const tokensCss = readFileSync(join(ROOT, 'packages/design-tokens/src/styles/tokens.css'), 'utf8')
const typoSrc = readFileSync(join(ROOT, 'packages/design-tokens/src/typography.ts'), 'utf8')
const manifest = readFileSync(join(ROOT, 'scripts/data/font-subset-manifest.json'), 'utf8')
const baseline = readFileSync(join(ROOT, 'scripts/data/typography-face-baseline.json'), 'utf8')

test('字重区间解析:normal/bold/单值/区间/auto', () => {
  assert.deepEqual(T.parseWeightRange('normal'), [400, 400])
  assert.deepEqual(T.parseWeightRange('bold'), [700, 700])
  assert.deepEqual(T.parseWeightRange('500'), [500, 500])
  assert.deepEqual(T.parseWeightRange('600 700'), [600, 700])
  assert.equal(T.parseWeightRange('auto'), null)
  assert.equal(T.parseWeightRange(''), null)
})

test('真仓三臂全绿(现状自证)', () => {
  const faces = T.parseFontFaces(globalsCss)
  const requested = T.collectRequestedWeights(typoSrc, tokensCss)
  assert.deepEqual(requested, [400, 500, 600, 700])
  assert.deepEqual(T.findUncoveredWeights(faces, T.BRAND_FAMILY, requested), [])
  assert.equal(T.checkFallbackChain(tokensCss).ok, true)
  assert.deepEqual(T.checkDisplaySynthesis(faces), [])
  assert.deepEqual(T.checkSubsetRatchet(JSON.parse(manifest), JSON.parse(baseline)), [])
})

test('变异夹具:把 Bold 面收回 700 单点 ⇒ 600 必判未覆盖', () => {
  const mutated = globalsCss.replace(
    "@font-face {\n  font-family: 'HarmonyOS Sans SC';\n  font-weight: 600 700;",
    "@font-face {\n  font-family: 'HarmonyOS Sans SC';\n  font-weight: 700;",
  )
  assert.notEqual(mutated, globalsCss, '变异未命中,夹具失效')
  const faces = T.parseFontFaces(mutated)
  assert.deepEqual(T.findUncoveredWeights(faces, T.BRAND_FAMILY, [600]), [600])
})

test('变异夹具:EDIX 退回单点 normal ⇒ 合成假粗必判出', () => {
  const mutated = globalsCss.replace(
    "font-family: 'EDIX';\n  src: url('/fonts/EDIX.woff2') format('woff2');\n  font-weight: 400 700;",
    "font-family: 'EDIX';\n  src: url('/fonts/EDIX.woff2') format('woff2');\n  font-weight: normal;",
  )
  assert.notEqual(mutated, globalsCss, '变异未命中,夹具失效')
  const bad = T.checkDisplaySynthesis(T.parseFontFaces(mutated))
  assert.equal(bad.length, 1)
  assert.equal(bad[0].family, 'EDIX')
})

test('变异夹具:回退链去掉中文黑体族 ⇒ 必判出', () => {
  // 先证纯合成的拉丁链能判出
  const latinOnly =
    '@theme { --font-sans: "HarmonyOS Sans SC", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }'
  assert.equal(T.checkFallbackChain(latinOnly).ok, false)
  // 再证真仓 tokens.css 被改回"无中文族"时,同一把尺子同样判出。
  // 只删**带引号的族名**(声明里的写法);注释里的裸名不参与匹配,删它会造出假失效。
  let mutated = tokensCss
  for (const fam of T.CJK_SANS_FAMILIES) mutated = mutated.split(`'${fam}'`).join('')
  assert.notEqual(mutated, tokensCss, '变异未命中,夹具失效')
  assert.equal(T.checkFallbackChain(mutated).ok, false)
  // 注释里提到中文族名而声明里没有 ⇒ 不得算数(否则判据会被注释糊弄成假绿)
  const commentOnly =
    '@theme { /* 降级 PingFang SC / Microsoft YaHei */ --font-sans: "HarmonyOS Sans SC", ui-sans-serif, system-ui, sans-serif; }'
  assert.equal(T.checkFallbackChain(commentOnly).ok, false, '注释中的族名被当成了声明')
})

test('变异夹具:中文族排到 ui-sans-serif 之后 ⇒ 必判出(拉丁截胡)', () => {
  const late =
    '@theme { --font-sans: "HarmonyOS Sans SC", ui-sans-serif, system-ui, "PingFang SC", sans-serif; }'
  assert.equal(T.checkFallbackChain(late).ok, false)
})

test('变异夹具:子集汉字数缩水 ⇒ 棘轮必判出', () => {
  const shrunk = JSON.parse(manifest)
  shrunk.tiers['gb2312-l12'].cjk = 2292
  const findings = T.checkSubsetRatchet(shrunk, JSON.parse(baseline))
  assert.equal(findings.length, 1)
  assert.match(findings[0], /2292 < 基线 7155/)
})

test('变异夹具:哨兵未过 ⇒ 必判出', () => {
  const bad = JSON.parse(manifest)
  bad.sentinel = { ok: false, missing: '囍' }
  assert.equal(T.checkSubsetRatchet(bad, JSON.parse(baseline)).length, 1)
})

test('manifest 缺档 ⇒ 判"未判定"措辞而非折成 0', () => {
  const missingTier = JSON.parse(manifest)
  delete missingTier.tiers['gb2312-l12']
  const findings = T.checkSubsetRatchet(missingTier, JSON.parse(baseline))
  assert.equal(findings.length, 1)
  assert.match(findings[0], /取不到即未判定,不折成 0/)
})

test('字体文件引用清单 ⇒ 全部落在 apps/web/public/fonts 下且非空', () => {
  const rels = T.referencedFontPaths(T.parseFontFaces(globalsCss))
  assert.ok(rels.length >= 5)
  for (const rel of rels) {
    assert.match(rel, /^apps\/web\/public\/fonts\/.+\.woff2$/)
    assert.ok(readFileSync(join(ROOT, rel)).length > 1000, `${rel} 体积异常`)
  }
})

test('judge 端到端:现状无 findings,注入缺失文件即有一条', () => {
  const ok = T.judge({
    globalsCss,
    tokensCss,
    typoSrc,
    manifestText: manifest,
    baselineText: baseline,
    missingFonts: [],
  })
  assert.deepEqual(ok.findings, [])
  const bad = T.judge({
    globalsCss,
    tokensCss,
    typoSrc,
    manifestText: manifest,
    baselineText: baseline,
    missingFonts: ['apps/web/public/fonts/Nope.woff2'],
  })
  assert.equal(bad.findings.length, 1)
  assert.match(bad.findings[0], /不存在/)
})

test('面旗互斥:--staged 与 --worktree 同给必报错(守门 118)', () => {
  const r = T.faceFromArgv(['--staged', '--worktree'])
  assert.equal(r.face, null)
  assert.match(r.error, /不得同用/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
