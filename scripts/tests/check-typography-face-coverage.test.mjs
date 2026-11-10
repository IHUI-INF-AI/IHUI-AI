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

// ─────────────────────────────────────────────────────────────
// T4：品牌/子集/display 族所在栈必须有确定的中文现代黑体兜底(2026-11-10 补)
// ─────────────────────────────────────────────────────────────

const readRepo = (rel) => readFileSync(join(ROOT, rel), 'utf8')

test('T4 现状:11 处书写面逐处合规(真仓自证,不是"应该没问题")', () => {
  const bad = []
  for (const rel of T.FONT_STACK_SITES) {
    const text = readRepo(rel)
    for (const f of T.checkBrandStacks(text)) bad.push(`${rel}: ${f.snippet}`)
  }
  assert.deepEqual(bad, [])
})

test('T4 反向牙:把小程序标题链的中文族删干净 ⇒ 必判出', () => {
  const rel = 'apps/miniapp-taro/src/pages/user/index.css'
  let mutated = readRepo(rel)
  for (const fam of T.CJK_SANS_FAMILIES) mutated = mutated.split(`'${fam}',`).join('')
  assert.notEqual(mutated, readRepo(rel), '变异未命中,夹具失效')
  const hits = T.checkBrandStacks(mutated)
  assert.ok(hits.length >= 1)
  assert.match(hits[0].why, /没有中文现代黑体族/)
})

test('T4 反向牙:营销作用域链退回"Home + 拉丁族" ⇒ 必判出', () => {
  const rel = 'apps/web/app/(marketing)/marketing-fonts.css'
  const mutated = readRepo(rel).replace(
    /'HarmonyOS Sans SC Home', 'PingFang SC',[\s\S]*?'Hiragino Sans GB',/,
    "'HarmonyOS Sans SC Home',",
  )
  assert.notEqual(mutated, readRepo(rel), '变异未命中,夹具失效')
  assert.ok(T.checkBrandStacks(mutated).length >= 1)
})

test('T4 反向牙:中文族排在裸 sans-serif 之后 ⇒ 判"先被泛族截走"', () => {
  const late = ".x { font-family: 'EDIX', sans-serif, 'PingFang SC'; }"
  const hits = T.checkBrandStacks(late)
  assert.equal(hits.length, 1)
  assert.match(hits[0].why, /排在裸 sans-serif 之后/)
})

test('T4 不误伤:纯拉丁/等宽栈、@font-face 族名、注释里的族名都不算', () => {
  assert.deepEqual(T.checkBrandStacks('.y { font-family: Menlo, Consolas, monospace; }'), [])
  assert.deepEqual(
    T.checkBrandStacks(
      "@font-face { font-family: 'HarmonyOS Sans SC'; src: url('/fonts/a.woff2'); }",
    ),
    [],
  )
  assert.deepEqual(T.checkBrandStacks("/* 'EDIX', sans-serif */ .z { color: red; }"), [])
})

test('T4 登记维:声明集里出现未登记的新品牌族书写面 ⇒ 点名;拿不到声明集 ⇒ 不发言', () => {
  const rel = 'apps/web/src/components/new-face.css'
  const inputs = { [rel]: ".a { font-family: 'HarmonyOS Sans SC', sans-serif; }" }
  assert.deepEqual(T.findUnregisteredStackSites([rel], inputs), [rel])
  assert.deepEqual(T.findUnregisteredStackSites([], inputs), [])
  assert.deepEqual(T.findUnregisteredStackSites(['README.md'], { 'README.md': 'EDIX' }), [])
})

// ─── 生产装配路径的反向牙(2026-11-10 立)──────────────────────────────────
// 病灶:旧实现里 T4 登记维的取材集是 `if (RELS.includes(rel)) declaredInputs[rel] = inputs[rel]`
// ⇒ 声明集里**不在 RELS 的新书写面永远拿不到正文** ⇒ `findUnregisteredStackSites` 的
// `typeof text !== 'string'` 分支直接跳过它 ⇒ 纯函数有牙、生产调用路径没牙:
// 实测 `income.css` 在生产路径上返回 `[]`(不点名),而直喂内容才返回命中。
// 本组用例钉住**装配环节**:取材器必须被问到、问到的正文必须进判定输入集。
test('T4 生产装配路径:声明集里不在 RELS 的文件必须被取材(旧实现恒不取材 ⇒ 登记维空转)', () => {
  const rel = 'apps/web/src/components/new-face.css'
  assert.equal(T.RELS.includes(rel), false, '夹具前提:该路径必须不在 RELS 里')
  const asked = []
  const out = T.assembleDeclaredInputs({
    declared: [rel],
    inputs: {},
    readExtra: (r) => {
      asked.push(r)
      return ".a { font-family: 'HarmonyOS Sans SC', sans-serif; }"
    },
  })
  assert.deepEqual(asked, [rel], '取材器必须被问到该路径')
  assert.equal(typeof out[rel], 'string', '正文必须进判定输入集')
  // 装配后,登记维真的能点名它
  assert.deepEqual(T.findUnregisteredStackSites([rel], out), [rel])
})

test('T4 生产装配路径:取材失败 ⇒ 该路径不发言(不记绿也不冒红,§0.3)', () => {
  const rel = 'apps/web/src/components/new-face.css'
  const out = T.assembleDeclaredInputs({
    declared: [rel],
    inputs: {},
    readExtra: () => null,
  })
  assert.equal(rel in out, false, '取不到 ⇒ 不进判定输入集')
  assert.deepEqual(T.findUnregisteredStackSites([rel], out), [], '没判 ≠ 判过')
})

test('T4 生产装配路径:非代码类路径(README.md 等)不取材、不点名', () => {
  const asked = []
  const out = T.assembleDeclaredInputs({
    declared: ['README.md'],
    inputs: {},
    readExtra: (r) => {
      asked.push(r)
      return 'EDIX'
    },
  })
  assert.deepEqual(asked, [], '非 .css/.ts/.tsx/.mjs/.js 路径不取材')
  assert.deepEqual(T.findUnregisteredStackSites(['README.md'], out), [])
})

test('T4 生产装配路径:已在 RELS 的文件走 inputs 直取,不重复取材', () => {
  const rel = T.RELS[0]
  const asked = []
  const out = T.assembleDeclaredInputs({
    declared: [rel],
    inputs: { [rel]: 'FROM_INPUTS' },
    readExtra: (r) => {
      asked.push(r)
      return 'FROM_READER'
    },
  })
  assert.deepEqual(asked, [], 'RELS 内文件不重复取材')
  assert.equal(out[rel], 'FROM_INPUTS')
})

test('T4 端到端:现状 judge 无 findings;注入一处坏栈即多一条且带路径名', () => {
  const sites = T.FONT_STACK_SITES.map((rel) => ({ rel, text: readRepo(rel) }))
  const ok = T.judge({
    globalsCss: readRepo('apps/web/app/globals.css'),
    tokensCss,
    typoSrc,
    manifestText: manifest,
    baselineText: baseline,
    missingFonts: [],
    stackSites: sites,
  })
  assert.deepEqual(ok.findings, [])
  const broken = T.judge({
    globalsCss: readRepo('apps/web/app/globals.css'),
    tokensCss,
    typoSrc,
    manifestText: manifest,
    baselineText: baseline,
    missingFonts: [],
    stackSites: [
      { rel: 'apps/x/y.css', text: ".a { font-family: 'AlimamaFangYuanTi', sans-serif; }" },
    ],
  })
  assert.equal(broken.findings.length, 1)
  assert.match(broken.findings[0], /T4 apps\/x\/y\.css/)
})


// ─── T5:unicode-range 互补(2026-11-10 立)─────────────────────────────────
// 病灶:常规面不声明 unicode-range ⇒ 它隐式覆盖**全部**码位 ⇒ 罕见字面永远抢不过它
// ⇒ 浏览器在两面都命中时按声明顺序取先声明的那一面 ⇒ 罕见字换脸
// (真 Chromium 实测:「昇啰厏」落 Microsoft YaHei)。
// 判据只对**声明了 range 的面**提要求;manifest 取不到实测值时该条不发言(§0.3)。
const t5ManifestFor = (fs) => ({
  faces: fs.map((f) => ({
    dst: f.srcs[0].split('/').pop(),
    faceCodepoints: T.intervalCodepoints(f.unicodeRange),
    rangeSegments: f.unicodeRange ? f.unicodeRange.length : 0,
    rangeSha: f.unicodeRange ? T.sha256Hex(T.canonicalRangeText(f.unicodeRange)) : '',
  })),
})
const T5_CSS = [
  "@font-face { font-family: 'HarmonyOS Sans SC'; font-weight: 400; src: url('/fonts/reg.woff2'); unicode-range: U+0020-007F, U+4E00-4EFF; }",
  "@font-face { font-family: 'HarmonyOS Sans SC'; font-weight: 400; src: url('/fonts/rare.woff2'); unicode-range: U+5000-9FFF; }",
].join('\n')

test('T5 互补必通过:两面 range 严格互斥且与产出一致 ⇒ 零 findings', () => {
  const faces = T.parseFontFaces(T5_CSS)
  const mf = t5ManifestFor(faces)
  assert.deepEqual(T.checkUnicodeRangeExclusivity(faces, T.BRAND_FAMILY, mf.faces), [])
})

test('T5 反向牙:两面 range 重叠 ⇒ 必判出(罕见字被抢走)', () => {
  const faces = T.parseFontFaces(T5_CSS.replace('U+5000-9FFF', 'U+4E00-9FFF'))
  const mf = t5ManifestFor(faces)
  const hits = T.checkUnicodeRangeExclusivity(faces, T.BRAND_FAMILY, mf.faces)
  assert.ok(hits.length >= 1, 'range 重叠未被判出')
  assert.match(hits.join('\n'), /重叠/)
})

test('T5 反向牙:覆盖不全(产出面比声明的 range 多码位)⇒ 必判出', () => {
  const faces = T.parseFontFaces(T5_CSS)
  const mf = t5ManifestFor(faces)
  mf.faces[1].faceCodepoints += 100
  const hits = T.checkUnicodeRangeExclusivity(faces, T.BRAND_FAMILY, mf.faces)
  assert.ok(hits.length >= 1, '覆盖不全未被判出')
  assert.match(hits.join('\n'), /覆盖有洞或越界/)
})

test('T5 反向牙:同组混用「声明 range 的面」与「未声明的面」⇒ 必判出', () => {
  const faces = T.parseFontFaces(
    T5_CSS.replace(
      " src: url('/fonts/rare.woff2'); unicode-range: U+5000-9FFF;",
      " src: url('/fonts/rare.woff2');",
    ),
  )
  const mf = t5ManifestFor(faces)
  const hits = T.checkUnicodeRangeExclusivity(faces, T.BRAND_FAMILY, mf.faces)
  assert.ok(hits.length >= 1, '混用声明/未声明未被判出')
  assert.match(hits.join('\n'), /隐式覆盖全部码位/)
})

test('T5 真仓现状:400 档两面互补且与 manifest 实测一致 ⇒ 零 findings', () => {
  const faces = T.parseFontFaces(globalsCss)
  const mf = JSON.parse(manifest)
  assert.deepEqual(T.checkUnicodeRangeExclusivity(faces, T.BRAND_FAMILY, mf.faces ?? []), [])
  // 真仓必须真有 rare 面这一枚,否则本组用例是空转
  const w400 = faces.filter(
    (f) => f.family === T.BRAND_FAMILY && f.range && f.range[0] === 400 && f.range[1] === 400,
  )
  assert.equal(w400.length, 2, '400 档应当是 regular + rare 两面')
  assert.ok(
    w400.every((f) => f.unicodeRange),
    '400 档两面都必须声明精确 unicode-range',
  )
  assert.equal((mf.faces ?? []).some((m) => m.tier === 'gbk-rare'), true, 'manifest 缺 gbk-rare 档')
})

test('T5 unicode-range 解析:单点/区间/通配符/空', () => {
  assert.deepEqual(T.parseUnicodeRange('U+4E00-9FFF'), [[0x4e00, 0x9fff]])
  assert.deepEqual(T.parseUnicodeRange('U+61'), [[0x61, 0x61]])
  assert.deepEqual(T.parseUnicodeRange('U+61-63, U+65'), [
    [0x61, 0x63],
    [0x65, 0x65],
  ])
  assert.equal(T.parseUnicodeRange('U+4??'), null, '通配符记法应当解析不出')
  assert.equal(T.parseUnicodeRange(''), null, '空声明 ≠ 解析失败')
  assert.equal(T.intervalCodepoints([[0x4e00, 0x9fff]]), 0x9fff - 0x4e00 + 1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
