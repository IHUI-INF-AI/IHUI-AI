// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读计划器需打印清单 */
/**
 * plan-rn-token-pairing.mjs —— RN 手抄色档 → tokens.css 源变量的**配对计划器**(只读,默认不写盘)。
 *
 * 治的是哪一格(2026-10-27 现读):`rn-tokens.ts` 里还有一批色档没登记进守门 93 的 MAPPINGS,
 * 于是它们是**手抄字面量**而不是派生态 —— web 改 `tokens.css` 一处,这些档不动,正是 §4「派生态一律
 * 由源头派生」想消灭的东西,也是「RN 自动同步 web 样式」这条目标里唯一还在人肉的那半格。
 * 守门 254 的台账只会点名「不可派生 N 档」并写原因「按门口径不猜语义」;点名之后没有器物把
 * 「哪一档其实有同值真源」量出来 ⇒ 每一档都得有人自己开两边文件对颜色。本器就是那件器物。
 *
 * 判据(两条,硬前提都是**色彩等值**,等值判定直接叫守门 93 的 colorsAgree,零复算 §0.6):
 *   R1 同值候选唯一 ⇒ 可登记(rn 亮档与暗档各自都要唯一,且暗档与 .dark 面同值)。
 *   R2 同值候选多于一个,但其中**按命名推导(deriveCssVarNames)只剩一个** ⇒ 可登记,并点名歧义集;
 *      命名推导用的是守门自己那套(同名才是同一档),不是我另起的一套驼峰转连字符。
 *   其余一律不配对:多条同名同值 ⇒ 归 ambiguous(交人);源侧无同值档 ⇒ 归 noSource(要么 RN 专属、
 *      要么源侧缺档,两种都不是本器能替人裁的)。失效方向恒为"少配对",绝不为了账面干净猜一条。
 *
 * 取材面(§0.4):默认 HEAD blob;`--worktree` 仅人工逃生舱;两面旗同给 exit 2。
 * 取不到任一面 ⇒ exit 2 显式「未判定」(§0.3),不输出空清单冒充"没有可配对的"。
 *
 * Usage:
 *   node scripts/plan-rn-token-pairing.mjs                # 人读:三档计数 + 可登记清单
 *   node scripts/plan-rn-token-pairing.mjs --emit=mappings # 直接打印可粘进 MAPPINGS 的条目
 *   node scripts/plan-rn-token-pairing.mjs --json          # 机读
 *   node scripts/plan-rn-token-pairing.mjs --self-test    # 判据自检(含阳性对照与"歧义不猜"反向对照)
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as xct } from './check-cross-end-tokens.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const TOKENS_REL = 'packages/design-tokens/src/styles/tokens.css'
const RN_REL = 'packages/design-tokens/src/rn-tokens.ts'
const GATE_REL = 'scripts/check-cross-end-tokens.mjs'
// 这里不能引用下面才声明的 argv(TDZ:模块一加载就 ReferenceError,连 --self-test 都跑不起来)
const applyMode = process.argv.includes('--apply')
const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const worktreeMode = argv.includes('--worktree')
const stagedMode = argv.includes('--staged')
const emitArg = argv.find((a) => a.startsWith('--emit='))
const selfTest = argv.includes('--self-test')

if (stagedMode && worktreeMode) {
  console.error('❌ 未判定:--staged 与 --worktree 同给,取材面不明(§0.4 不回落另一个面)')
  process.exit(2)
}
const FACE = stagedMode ? 'staged' : worktreeMode ? 'worktree' : 'head'

function readFace(rel) {
  if (FACE === 'worktree') {
    try {
      return { text: readFileSync(join(ROOT, rel), 'utf8') }
    } catch (e) {
      return { err: String(e?.message ?? e) }
    }
  }
  const args = FACE === 'staged' ? ['show', `:${rel}`] : ['show', `HEAD:${rel}`]
  try {
    return {
      text: execFileSync('git', args, {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 1 << 26,
        stdio: ['ignore', 'pipe', 'pipe'], // §12g 派生 git 必须显式 stdio
      }),
    }
  } catch (e) {
    return { err: String(e?.message ?? e) }
  }
}

/** 已登记 MAPPINGS 覆盖到的 RN 档(path 形如 glass.bg / brand.DEFAULT,按表分别登记)。 */
function mappedPaths(mappings) {
  const out = new Set()
  for (const mp of mappings ?? []) {
    for (const mode of ['light', 'dark']) {
      const arr = mp.rn?.[mode]
      if (Array.isArray(arr) && arr.length >= 2) out.add(`${arr[0]}|${arr.slice(1).join('.')}`)
    }
  }
  return out
}

/** RN 侧三张色表的色档叶子 → [{table,path,value}]。解析不了 ⇒ 抛错(由 plan 落未判定)。 */
function rnLeaves(rnSrc) {
  const out = []
  for (const table of ['rnLightTokens', 'rnDarkTokens']) {
    // 锚点必须容得下 TS 类型标注(`export const rnLightTokens: RnThemeTokens = {`)——
    // 真仓就是这一形,只认 `= {` 会当场命中 0 处并落「未判定」(自检 S1 的夹具因此照真仓形写)。
    const body = xct.extractObjectBody(
      xct.maskComments(rnSrc, false),
      new RegExp(`^export const ${table}(?::[^=]*)?\\s*=\\s*\\{`, 'm'),
    )
    if (!body) throw new Error(`${table} 取不到对象体(锚点或表形变了,不按猜的形状派生)`)
    for (const leaf of xct.objectLeaves(body)) {
      const v = typeof leaf.value === 'string' ? leaf.value : null
      if (!v || !/^(#|rgb|hsl)/i.test(v.trim())) continue
      out.push({ table, path: leaf.path, value: v })
    }
  }
  return out
}

/** 色阶档(纯刻度名)不得挂到角色档上:值相同不代表同一档 —— 一条 web 侧改 `--color-border-medium`
 * 的理由,不该顺带改掉 RN 的 `gray.300`。这类档的正确出路是把刻度补进 tokens.css 源,单独成桶点名。 */
const SCALE_NS = new Set(['gray', 'grey', 'neutral', 'slate', 'zinc', 'stone', 'red', 'blue', 'green', 'yellow'])

/** 核心:纯函数,输入两侧面文本 + MAPPINGS,输出四档清单。 */
export function plan({ tokensTxt, rnSrc, mappings }) {
  const cssSrc = xct.stripCssComments(tokensTxt)
  const cssLight = xct.mergeCssVars(cssSrc, ['@theme', ':root'])
  const cssDark = { ...cssLight, ...xct.mergeCssVars(cssSrc, ['.dark']) }
  const mapped = mappedPaths(mappings)
  const leaves = rnLeaves(rnSrc)
  const byTablePath = new Map(leaves.map((l) => [`${l.table}|${l.path}`, l.value]))

  const pairs = []
  const ambiguous = []
  const noSource = []
  const scale = []
  const safeAgree = (a, b) => {
    try {
      return xct.colorsAgree(a, b)
    } catch {
      return false
    }
  }
  for (const l of leaves) {
    if (l.table !== 'rnLightTokens') continue // 暗档随同一路径一起判定,不重复开列
    if (mapped.has(`${l.table}|${l.path}`) || mapped.has(`rnTokens|${l.path}`)) continue
    const cssFace = (face) =>
      Object.entries(face).filter(([, v]) => {
        try {
          return xct.colorsAgree(l.value, v)
        } catch {
          return false
        }
      })
    const lightCands = cssFace(cssLight)
    const darkValue = byTablePath.get(`rnDarkTokens|${l.path}`)
    const darkCands = darkValue ? Object.entries(cssDark).filter(([, v]) => {
      try {
        return xct.colorsAgree(darkValue, v)
      } catch {
        return false
      }
    }) : null

    const pick = (cands) => {
      if (cands.length === 1) return { name: cands[0][0], rule: 'R1' }
      const named = new Set(xct.deriveCssVarNames(l.path))
      const hit = cands.filter(([n]) => named.has(n))
      return hit.length === 1 ? { name: hit[0][0], rule: 'R2', rivals: cands.length } : null
    }
    const L = pick(lightCands)
    const rec = {
      rn: l.path,
      light: { value: l.value, cands: lightCands.map(([n]) => n) },
      dark: darkValue ? { value: darkValue, cands: (darkCands ?? []).map(([n]) => n) } : null,
    }
    if (lightCands.length === 0) {
      noSource.push(rec)
      continue
    }
    if (!darkValue) {
      // 暗表没有同名档 ⇒ 登记后 .dark 面无处可写,门 93 会判"映射指向不存在的档" ⇒ 不配。
      ambiguous.push({ ...rec, why: 'RN 暗表无同名档(登记后无处可写)' })
      continue
    }
    if (!L) {
      ambiguous.push({ ...rec, why: '亮档同值多源且命名推不出唯一' })
      continue
    }
    if (SCALE_NS.has(l.path.split('.')[0])) {
      scale.push({ ...rec, css: L.name })
      continue
    }
    // 暗档必须落**同一个源变量**:一条 MAPPINGS 的 rn 档 ↔ 一个 css 档,亮暗取该档在两个面的值。
    // 若 RN 暗值与 `.dark` 面该档的值不等 ⇒ 这一档两端本来就不是同一语义,不配对(交人)。
    if (darkValue) {
      const srcDark = cssDark[L.name]
      const agree = srcDark !== undefined && safeAgree(darkValue, srcDark)
      if (!agree) {
        ambiguous.push({ ...rec, why: `暗档 ${darkValue} 与源 ${L.name} 的 .dark 值(${srcDark ?? '无此档'})不同值` })
        continue
      }
    }
    pairs.push({ ...rec, css: L.name, dark: L.name, rule: L.rule })
  }
  return { pairs, ambiguous, noSource, scale, face: FACE }
}

/** 打成可直接粘进守门 93 MAPPINGS 的条目(basis 带实测值,不留"以后再说"的空白)。 */
export function emitMappings(pairs, at = new Date().toISOString().slice(0, 10)) {
  const why = (p) =>
    p.rule === 'R1'
      ? `源侧与该值同色的档唯一(${p.light.cands.join(', ')})`
      : `同值候选 ${p.light.cands.length} 个(${p.light.cands.slice(0, 3).join(', ')}),其中与 RN 档名同名的只有 ${p.css}(命名口径取守门自己的 deriveCssVarNames)`
  return pairs
    .map(
      (p) => `  {
    label: '${p.rn} ↔ ${p.css}',
    rn: { light: ['rnLightTokens', ${p.rn.split('.').map((x) => `'${x}'`).join(', ')}], dark: ['rnDarkTokens', ${p.rn.split('.').map((x) => `'${x}'`).join(', ')}] },
    css: { light: '${p.css}', dark: '${p.css}' },
    basis:
      '${at} 由 plan-rn-token-pairing 量得(${p.rule}):RN 亮档 ${p.light.value} / 暗档 ${p.dark?.value ?? '(同亮)'} 与源 ${p.css} 在 :root/@theme 与 .dark 两个面各自同值;${why(p)}。此前 RN 侧是手抄字面量 ⇒ web 改这一档 RN 不动(§4 派生态纪律)。',
  },`,
    )
    .join('\n')
}

/** 把条目插进守门 93 的 MAPPINGS 数组:锚点取不到 ⇒ 抛错(不猜插入点);同 label 已在 ⇒ 幂等跳过。 */
export function insertMappings(gateTxt, pairs, at = new Date().toISOString().slice(0, 10)) {
  const m = /^const MAPPINGS = \[$/m.exec(gateTxt)
  if (!m) throw new Error(`${GATE_REL} 里取不到 const MAPPINGS = [ 那一行(门的声明形变了)⇒ 未判定,不猜插入点`)
  const existing = new Set([...gateTxt.matchAll(/^\s*label:\s*'([^']+)'/gm)].map((x) => x[1]))
  const fresh = pairs.filter((p) => !existing.has(`${p.rn} ↔ ${p.css}`))
  if (fresh.length === 0) return { text: gateTxt, inserted: 0, skipped: pairs.length }
  const pos = m.index + m[0].length
  return { text: `${gateTxt.slice(0, pos)}\n${emitMappings(fresh, at)}${gateTxt.slice(pos)}`, inserted: fresh.length, skipped: pairs.length - fresh.length }
}

function run() {
  if (selfTest) return selfTests()
  const t = readFace(TOKENS_REL)
  const r = readFace(RN_REL)
  if (t.err || r.err) {
    console.error(
      `❌ 未判定:取不到被审面(${TOKENS_REL}: ${t.err ?? 'ok'} / ${RN_REL}: ${r.err ?? 'ok'})⇒ 不出空清单冒充"无可配对"`,
    )
    process.exit(2)
  }
  const p = plan({ tokensTxt: t.text, rnSrc: r.text, mappings: xct.MAPPINGS })
  if (applyMode) {
    const gate = readFace(GATE_REL)
    if (gate.err) {
      console.error(`❌ 未判定:取不到 ${GATE_REL} 的 ${FACE} 面(${gate.err})`)
      process.exit(2)
    }
    // 与造页器同一条护栏:底稿取被审面;工作树若挂着他席不在 HEAD 的行 ⇒ 当场拒,不替人提交(§12)。
    const work = readFileSync(join(ROOT, GATE_REL), 'utf8')
    const headLines = new Set(gate.text.split('\n'))
    const extra = work.split('\n').filter((l) => l.trim() !== '' && !headLines.has(l))
    if (extra.length > 0) {
      console.log(
        `PLAN-RN-PAIRING-APPLY state=refused inserted=0 why=${GATE_REL} 工作树有 ${extra.length} 行不在 HEAD(他席在飞)⇒ 本轮不动,留待下轮`,
      )
      process.exit(1)
    }
    try {
      const res = insertMappings(gate.text, p.pairs)
      if (res.inserted === 0) {
        console.log(`PLAN-RN-PAIRING-APPLY state=nochange inserted=0 已在册=${res.skipped}`)
        return
      }
      writeFileSync(join(ROOT, GATE_REL), res.text)
      console.log(`PLAN-RN-PAIRING-APPLY state=applied inserted=${res.inserted} 已在册=${res.skipped}`)
    } catch (e) {
      console.error(`❌ 未判定:${String(e?.message ?? e)}`)
      process.exit(2)
    }
    return
  }
  if (emitArg === '--emit=mappings') {
    console.log(emitMappings(p.pairs))
    return
  }
  const line = `PLAN-RN-PAIRING face=${p.face} 未登记色档 ${p.pairs.length + p.ambiguous.length + p.noSource.length + p.scale.length} 可配对 ${p.pairs.length} 歧义 ${p.ambiguous.length} 色阶待补源 ${p.scale.length} 源无等值 ${p.noSource.length}`
  if (jsonMode) {
    console.log(JSON.stringify({ summary: line, ...p }, null, 2))
    return
  }
  console.log(line)
  console.log('\n── 可配对(亮暗同落一个源变量;粘进守门 93 MAPPINGS 即转派生态)──')
  for (const x of p.pairs) console.log(`  ${x.rn}  ${x.light.value} → ${x.css} [${x.rule}]`)
  console.log('\n── 歧义:命名推不出唯一,或暗档与源 .dark 值不等(交人,不猜)──')
  for (const x of p.ambiguous) console.log(`  ${x.rn}  ${x.light.value}  ${x.why ?? ''}  候选 ${x.light.cands.slice(0, 4).join(', ')}`)
  console.log('\n── 色阶档:值同≠语义同,不得挂角色档;正解是把刻度补进 tokens.css ──')
  for (const x of p.scale) console.log(`  ${x.rn}  ${x.light.value}  (同值源档 ${x.css})`)
  console.log('\n── 源无等值档:RN 专属或源侧缺档(两种都不是本器能代裁的)──')
  for (const x of p.noSource) console.log(`  ${x.rn}  ${x.light.value}`)
}

/** 自检:三条判据分支都可构造 + 阳性对照 + "歧义不得猜"的反向对照 + 面取不到不冒绿。 */
function selfTests() {
  const cases = []
  const mk = (cssPairs, rnSrc) => ({ tokensTxt: cssPairs, rnSrc, mappings: [] })
  // 夹具照真仓那一形写(带 TS 类型标注):锚点只认 `= {` 时,S1 会当场红,而不是"真仓未判定、自检全绿"。
  const rnOf = (light, dark) =>
    `export const rnLightTokens: RnThemeTokens = { foo: { bar: '${light}' } }\nexport const rnDarkTokens: RnThemeTokens = { foo: { bar: '${dark}' } }\n`

  cases.push([
    'S1 R1 阳性对照:源里唯一同值档必须被配出来(拿正例喂判据,否则"0 可配对"可能是坏尺子)',
    () => {
      const css = `@theme {\n  --color-foo-bar: #0a0a0a;\n  --color-other: hsl(120 50% 50%);\n}`
      const p = plan(mk(css, rnOf('#0A0A0A', '#0A0A0A')))
      assertEq(p.pairs.length, 1, '唯一同值档没配出来')
      assertEq(p.pairs[0].css, '--color-foo-bar', '配到了别的源档')
      assertEq(p.pairs[0].rule.startsWith('R1'), true, '唯一候选应走 R1')
    },
  ])
  cases.push([
    'S2 hsl ↔ hex 跨写法等值:源写 hsl(0 0% 3.9%) 而 RN 写 #0A0A0A 必须算同值(否则永远配不上)',
    () => {
      const css = `:root {\n  --color-foo-bar: hsl(0 0% 3.9%);\n}`
      const p = plan(mk(css, rnOf('#0A0A0A', '#0A0A0A')))
      assertEq(p.pairs.length, 1, 'hsl 与 hex 同色被判成不同值 ⇒ 等值判定没走色彩空间')
    },
  ])
  cases.push([
    'S3 歧义不猜:两条同值源档而命名都对不上 ⇒ 必须落 ambiguous,一条也不许配对',
    () => {
      const css = `:root {\n  --color-zz: #f5f5f5;\n  --color-yy: #f5f5f5;\n}`
      const p = plan(mk(css, rnOf('#F5F5F5', '#F5F5F5')))
      assertEq(p.pairs.length, 0, '歧义被猜成了配对')
      assertEq(p.ambiguous.length, 1, '歧义没进队列')
    },
  ])
  cases.push([
    'S4 R2 命名推导:同值多源,只有一条与 RN 档名同名 ⇒ 按守门自己的命名口径定它',
    () => {
      const css = `:root {\n  --color-foo-bar: #22c55e;\n  --color-chart-3: #22c55e;\n}`
      const p = plan(mk(css, rnOf('#22C55E', '#22C55E')))
      assertEq(p.pairs.length, 1, '命名能推出的唯一档没配出来')
      assertEq(p.pairs[0].css, '--color-foo-bar', '配到了同值的他档')
      assertEq(p.pairs[0].rule.startsWith('R2'), true, '应走 R2 命名推导')
    },
  ])
  cases.push([
    'S5 源侧 .dark 覆盖也参与:暗档与源暗值不一致 ⇒ 不配对(不能把暗表烘成亮值)',
    () => {
      const css = `:root {\n  --color-foo-bar: #000000;\n}\n.dark {\n  --color-foo-bar: #ffffff;\n}`
      const p = plan(mk(css, rnOf('#000000', '#000000')))
      assertEq(p.pairs.length, 0, '暗表要 #000 而源暗档是 #fff,却被配上了')
    },
  ])
  cases.push([
    'S6 已登记的档不重复开列(计划器只补漏,不得把门已有的配对再提一遍)',
    () => {
      const css = `:root {\n  --color-foo-bar: #0a0a0a;\n}`
      const mappings = [{ rn: { light: ['rnLightTokens', 'foo', 'bar'], dark: ['rnDarkTokens', 'foo', 'bar'] }, css: { light: '--color-foo-bar', dark: '--color-foo-bar' } }]
      const p = plan({ tokensTxt: css, rnSrc: rnOf('#0A0A0A', '#0A0A0A'), mappings })
      assertEq(p.pairs.length + p.ambiguous.length + p.noSource.length, 0, '已登记档被重复提出')
    },
  ])
  cases.push([
    'S7 暗档必须落同名源档:亮档唯一同值,但 RN 暗值与该档 .dark 值不等 ⇒ 不配对(两端本不是同一语义)',
    () => {
      const css = `:root {\n  --color-foo-bar: #000000;\n}\n.dark {\n  --color-foo-bar: #ffffff;\n}`
      const p = plan(mk(css, rnOf('#000000', '#000000')))
      assertEq(p.pairs.length, 0, '暗档与源 .dark 不等却被配上了')
      assertEq(p.ambiguous.length, 1, '这一型必须进歧义并写明原因')
      assertEq(/\.dark 值/.test(p.ambiguous[0].why), true, '歧义原因没点名暗档分歧')
    },
  ])
  cases.push([
    'S8 色阶档不得挂角色档:gray.300 与 --color-border-medium 同值,也必须落 scale 桶而不是配对',
    () => {
      const css = `:root {\n  --color-border-medium: #d4d4d4;\n}`
      const src =
        "export const rnLightTokens: RnThemeTokens = { gray: { '300': '#D4D4D4' } }\n" +
        "export const rnDarkTokens: RnThemeTokens = { gray: { '300': '#D4D4D4' } }\n"
      const p = plan(mk(css, src))
      assertEq(p.pairs.length, 0, '色阶档被挂上了角色档')
      assertEq(p.scale.length, 1, '色阶档没进独立桶')
      assertEq(p.scale[0].css, '--color-border-medium', '桶里没记下那个同值角色档,人无法据此补源刻度')
    },
  ])
  let fail = 0
  for (const [name, fn] of cases) {
    try {
      fn()
      console.log(`✅ ${name}`)
    } catch (e) {
      fail++
      console.log(`❌ ${name}:${e.message}`)
    }
  }
  console.log(`PLAN-RN-PAIRING-SELFTEST pass=${cases.length - fail} fail=${fail}`)
  if (fail) process.exit(1)
}
function assertEq(a, b, why) {
  if (a !== b) throw new Error(`${why}(实际 ${JSON.stringify(a)} ≠ 期望 ${JSON.stringify(b)})`)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    run()
  } catch (e) {
    console.error(`❌ 未判定:${String(e?.message ?? e)}`)
    process.exit(2)
  }
}

export const __test__ = { plan, emitMappings, rnLeaves, mappedPaths, TOKENS_REL, RN_REL }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
