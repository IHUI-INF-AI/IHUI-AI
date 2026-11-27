// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 皮肤表面覆盖守门(2026-11-27 立,门 329)
 *
 * 立因:皮肤(customTheme)只映射 globals.css 里手写的一段变量;2026-11-27 芭比粉上线时
 * 静态差集实测 27/222 覆盖 —— 描边、容器底、链接、选中整类漏在皮肤外,观感是"半套换肤"。
 * 本门把"新增 --color-* 角色必须回答是否随皮肤"变成机器判据:
 *   V1 每个 tokens 角色必须 ∈ 皮肤映射 ∪ 豁免台账(族通配);都不在 ⇒ 红并点名。
 *   V2 高对比块(html[data-high-contrast])必须排在皮肤段之后(同特异度后写者胜,顺序即优先级)。
 *   V3 皮肤段内引用的 --custom-* 变量必须由 store 色板真实产出(防拼错静默失效)。
 *   V4 亮/暗两档映射的角色集合必须一致(单侧新增 = 另一档漏配,切换明暗时半套换肤)。
 *
 * 取材面纪律(AGENTS §0.4):默认 HEAD blob;--staged 判索引 blob;--worktree 人工逃生舱;
 * 取不到 ⇒ exit 2 未判定。判面与取数一律走 scripts/lib/face-reader.mjs(门 118/312 要求)。
 * 豁免台账:scripts/data/skin-surface-exemptions.json(每条 pattern+reason 必填,可带 owner/until)。
 */

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, readWorktreeFile, selectFace, Undetermined } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TOKENS = 'packages/design-tokens/src/styles/tokens.css'
const GLOBALS = 'apps/web/app/globals.css'
const LEDGER = 'scripts/data/skin-surface-exemptions.json'

/** 统一取材:worktree 走 readWorktreeFile,HEAD/索引走 catBatch(一次性批量读) */
export async function readSource(root, face, rel) {
  if (face === 'worktree') {
    const txt = await readWorktreeFile(root, rel)
    if (txt === null || txt === undefined) throw new Undetermined(`${rel}:worktree 面读不到`)
    return txt
  }
  const spec = face === 'head' ? `HEAD:${rel}` : `:${rel}`
  const out = await catBatch(root, [spec])
  const txt = out.get(spec)
  if (txt === null || txt === undefined) throw new Undetermined(`${rel}:${face} 面读不到`)
  return txt
}

/** 从 tokens.css 抽全部 --color-* 角色名(含值) */
function tokensRoles(tokensCss) {
  const roles = new Map()
  for (const m of tokensCss.matchAll(/(--color-([a-z0-9-]+))\s*:\s*([^;]+);/g)) {
    if (!roles.has(m[2])) roles.set(m[2], m[3].trim())
  }
  return roles
}

/** 皮肤段 = html[data-custom-theme='true'] 与 html.dark[data-custom-theme='true'] 两个块 */
function skinBlocks(globalsCss) {
  const blocks = []
  const re = /html(?:\.dark)?\[data-custom-theme='true'\]\s*\{([\s\S]*?)\n\}/g
  for (const m of globalsCss.matchAll(re)) blocks.push({ body: m[1], index: m.index })
  return blocks
}

function mappedRoles(blocks) {
  const mapped = new Set()
  for (const b of blocks) {
    for (const m of b.body.matchAll(/^\s*--color-([a-z0-9-]+)\s*:/gm)) mapped.add(m[1])
  }
  return mapped
}

/** 族通配:black-* / success-* / 精确名三形态 */
function isExempt(role, ledger) {
  for (const entry of ledger) {
    if (!entry.pattern || !entry.reason) continue
    if (entry.pattern.endsWith('*')) {
      if (role.startsWith(entry.pattern.slice(0, -1))) return entry
    } else if (role === entry.pattern) return entry
  }
  return null
}

/** 纯判据核心(self-test 与镜像测试共用) */
function check(globalsCss, tokensCss, ledger) {
  const problems = []
  const roles = tokensRoles(tokensCss)
  const blocks = skinBlocks(globalsCss)
  if (blocks.length !== 2) problems.push(`皮肤段应恰有 2 块(亮/暗),实测 ${blocks.length}`)
  const mapped = mappedRoles(blocks)
  if (mapped.size < 20) problems.push(`皮肤映射仅 ${mapped.size} 个角色,疑似段被整体删除`)

  const uncovered = []
  for (const role of roles.keys()) {
    if (mapped.has(role)) continue
    if (isExempt(role, ledger)) continue
    uncovered.push(role)
  }

  // V4:亮/暗两档映射集合必须一致(只在单侧加角色 = 另一档漏配)
  if (blocks.length === 2) {
    const [light, dark] = blocks.map((b) => {
      const set = new Set()
      for (const m of b.body.matchAll(/^\s*--color-([a-z0-9-]+)\s*:/gm)) set.add(m[1])
      return set
    })
    const onlyLight = [...light].filter((r) => !dark.has(r))
    const onlyDark = [...dark].filter((r) => !light.has(r))
    if (onlyLight.length)
      problems.push(`亮档独有映射(暗档漏配):${onlyLight.map((r) => `--color-${r}`).join(' ')}`)
    if (onlyDark.length)
      problems.push(`暗档独有映射(亮档漏配):${onlyDark.map((r) => `--color-${r}`).join(' ')}`)
  }

  const hcIdx = globalsCss.indexOf("html[data-high-contrast='true']")
  const skinIdx = blocks.length ? Math.min(...blocks.map((b) => b.index)) : -1
  if (hcIdx >= 0 && skinIdx >= 0 && hcIdx < skinIdx)
    problems.push('高对比块排在皮肤段之前(会被皮肤同特异度覆盖,可读性让位于观感)')

  const paletteKeys = ['primary', 'background', 'foreground', 'card', 'muted', 'border']
  for (const b of blocks) {
    for (const m of b.body.matchAll(/var\(--custom-(light|dark)-([a-z-]+)\)/g)) {
      const key = m[2].replace(/-foreground(-rgb)?$/, '')
      if (!paletteKeys.includes(key))
        problems.push(`皮肤段引用了色板不存在的键 --custom-${m[1]}-${m[2]}`)
    }
  }

  return {
    problems,
    uncovered: uncovered.sort(),
    mappedCount: mapped.size,
    totalRoles: roles.size,
    exemptCount: ledger.length,
  }
}

function selfTest() {
  const tokens = ':root{--color-background:#fff;--color-mystery:#123;--color-success-500:#0f0;}'
  const skin =
    "html[data-custom-theme='true'] {\n--color-background: var(--custom-light-card);\n}\n" +
    "html.dark[data-custom-theme='true'] {\n--color-background: var(--custom-dark-card);\n}\n"
  const ledger = [{ pattern: 'success-*', reason: '语义色恒定' }]
  const ok = check(skin + "html[data-high-contrast='true'] { --color-border: #000; }", tokens, ledger)
  const hcBad = check("html[data-high-contrast='true'] { --color-border: #000; }\n" + skin, tokens, ledger)
  const asym = check(
    "html[data-custom-theme='true'] {\n--color-background: var(--custom-light-card);\n}\n" +
      "html.dark[data-custom-theme='true'] {\n--color-background: var(--custom-dark-card);\n--color-muted: var(--custom-dark-muted);\n}\n" +
      "html[data-high-contrast='true'] { --color-border: #000; }",
    tokens,
    ledger,
  )
  const cases = [
    ['未登记角色被点名', ok.uncovered.includes('mystery')],
    ['家族豁免生效', !ok.uncovered.includes('success-500')],
    ['高对比倒序判红', hcBad.problems.some((p) => p.includes('高对比块'))],
    ['亮暗不对称判红', asym.problems.some((p) => p.includes('亮档漏配'))],
  ]
  let bad = 0
  for (const [name, pass] of cases) {
    console.log(`${pass ? '✅' : '❌'} ${name}`)
    if (!pass) bad += 1
  }
  process.exit(bad === 0 ? 0 : 1)
}

async function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const picked = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (picked.error) {
    console.error(`❌ [329] 未判定:${picked.error}(--staged 与 --worktree 两面同给 = 判死)`)
    return 2
  }
  const face = picked.face
  let globalsCss
  let tokensCss
  let ledgerRaw
  try {
    globalsCss = await readSource(ROOT, face, GLOBALS)
    tokensCss = await readSource(ROOT, face, TOKENS)
    ledgerRaw = await readSource(ROOT, face, LEDGER)
  } catch (e) {
    console.error(`❌ [329] 未判定:${e.message}`)
    return 2
  }
  let ledger
  try {
    ledger = JSON.parse(ledgerRaw)
    if (!Array.isArray(ledger)) throw new Error('not array')
  } catch {
    console.error(`❌ [329] 未判定:豁免台账 ${LEDGER} 不是合法 JSON 数组`)
    return 2
  }
  const r = check(globalsCss, tokensCss, ledger)
  const head = `[329] 判定面=${face} 角色 ${r.totalRoles} / 皮肤映射 ${r.mappedCount} / 豁免族 ${r.exemptCount} / 未登记 ${r.uncovered.length}`
  if (r.problems.length || r.uncovered.length) {
    console.error(`❌ ${head}`)
    for (const p of r.problems) console.error(`   - ${p}`)
    if (r.uncovered.length) {
      console.error('   未登记角色(接进皮肤映射或写进豁免台账并说明理由):')
      for (const role of r.uncovered.slice(0, 40)) console.error(`   - --color-${role}`)
    }
    return 1
  }
  console.log(`✅ ${head}`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  tokensRoles,
  skinBlocks,
  mappedRoles,
  isExempt,
  check,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
