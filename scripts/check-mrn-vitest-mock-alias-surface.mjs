#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-mrn-vitest-mock-alias-surface.mjs
/**
 * 观测门(只报名不判红):apps/mobile-rn vitest 的"alias → 手写替身面"常驻清单
 * (2026-10-15 立,继 G-364 之后主会话普查批③;与 tests/shared-auth-alias-fidelity.test.ts 同型,
 * 但档位不同 —— 那是判红锁,本门是观测清单,票面原话「只报名不判红」)。
 *
 * 票面事实(2026-10-15 现读):mobile-rn vitest 仍有 5 条别名为手写替身(非纯转发):
 * `@ihui/shared/utils`、`@ihui/shared/hooks`、`@ihui/shared`、`@ihui/types`、`@ihui/rn-app`。
 * 各替身头注均已写明替换理由,符合「刻意 mock 必须写明替换了哪几处、为什么不能指真」那一档;
 * 其中 `@ihui/shared/hooks` 自述 "realistic hook implementations",是该族最弱一格。
 * 本门把这一族从"没人看守"变成"看得见":每次现读 vitest.config.ts 的 alias 表,
 * 对落点在 tests/__mocks__ 的每条别名逐格核三件事:
 *   ① 落点是否在 `apps/mobile-rn/tests/__mocks__/` 下(替身面命中即入清单);
 *   ② 该包名(含子路径)是否真实存在于对应 workspace 包 package.json 的 `exports` 表
 *      (@ihui 开头按包名解析到 apps 与 packages 两面的 package.json;非本仓包 = n-a,不判);
 *   ③ 替身头注是否写明替换理由(剥掉 provenance 水印行后的前导注释非空,并摘首行供人读)。
 *
 * 档位纪律(§12e/§12f):观测档**恒退出 0** —— 命中再多也只是报名,绝不让提交链变红;
 * 判失明的两型(config 取不到 / alias 表解析为 0)打 ⚠ 喊出来,同样不红。
 * 逐格是否转指真实现属 owner 裁决,本门不裁、只把面摊开。
 *
 * 跑法:node scripts/check-mrn-vitest-mock-alias-surface.mjs [--root <仓库根>]
 *   --root 供 §22c 镜像测试指向合成夹具仓(默认本仓库根)。
 *
 * 已知盲区(如实登记):vitest.config.ts 里 `...SHARED_UI_SPEC_ALIASES` 派生展开的条目
 * 不经本门解析 —— 它们由目录派生、按构造直指真实源码(readdirSync *-spec.ts),落不到
 * tests/__mocks__,所以盲区不覆盖本门守的那一型;将来若有别的计算形态别名,须回本门补登记。
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { requireFlagValue } from './lib/flag-value.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const RN_DIR_REL = 'apps/mobile-rn'
const CONFIG_REL = 'vitest.config.ts'
const MOCKS_REL = 'tests/__mocks__'

/**
 * 从 vitest.config.ts 源码按**源序**取 `'key': resolve(__dirname, 'target')` 别名条目。
 * 必须同时吃单行与多行两种书写并吃下尾随逗号(shared-auth-alias-fidelity 的 L1 同一条课:
 * 只认单行会把多行条目看成不存在,"没扫到"不得读成通过)。
 * 还必须吃下**无引号 key**(config 里 `nativewind:` 就是无引号书写 —— 首版只认带引号 key,
 * 真仓现读漏掉 1 条替身面命中,镜像测试前当场咬出,已补;判据的"没扫到=失明"课再记一笔)。
 */
export function parseAliasEntries(configCode) {
  const re = /['"]?([^\s:'"()]+)['"]?\s*:\s*resolve\(\s*__dirname\s*,\s*'([^']+)'\s*,?\s*\)/g
  const entries = []
  for (const m of configCode.matchAll(re)) entries.push({ key: m[1], target: m[2] })
  return entries
}

function isUnder(child, parent) {
  const rel = relative(parent, child)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/** ①落点:别名目标是否落在 <rnDir>/tests/__mocks__/ 下。 */
export function isMockTarget(absTarget, rnDir) {
  return isUnder(resolve(absTarget), join(resolve(rnDir), ...MOCKS_REL.split('/')))
}

/**
 * workspace 包名 → { dir, exports }。扫 apps 与 packages 两面的 package.json,
 * 以 `"name"` 字段为准(不猜目录名 = 包名)。
 */
export function loadWorkspacePackages(root) {
  const map = new Map()
  for (const top of ['apps', 'packages']) {
    const dir = join(resolve(root), top)
    if (!existsSync(dir)) continue
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue
      const pj = join(dir, d.name, 'package.json')
      if (!existsSync(pj)) continue
      try {
        const pkg = JSON.parse(readFileSync(pj, 'utf8'))
        if (pkg && typeof pkg.name === 'string') map.set(pkg.name, { dir: join(dir, d.name), exports: pkg.exports ?? null })
      } catch {
        // 坏 JSON 不吞面:留一条占位,让清单把它报出来而不是当包不存在
        map.set(`@__broken__/${top}/${d.name}`, { dir: join(dir, d.name), exports: null, broken: true })
      }
    }
  }
  return map
}

/**
 * 拆"包名 / 子路径":带 scope 的包名(@scope/name)必须吃到第二个斜杠,
 * 否则 `@ihui/fakepkg/utils` 会被拆成 `@ihui` + `/fakepkg/utils`(第一版实测咬到这条)。
 */
export function splitPkgAndSub(aliasKey) {
  if (!aliasKey.startsWith('@')) {
    const i = aliasKey.indexOf('/')
    return i < 0 ? [aliasKey, ''] : [aliasKey.slice(0, i), aliasKey.slice(i)]
  }
  const i = aliasKey.indexOf('/')
  if (i < 0) return [aliasKey, '']
  const j = aliasKey.indexOf('/', i + 1)
  return j < 0 ? [aliasKey, ''] : [aliasKey.slice(0, j), aliasKey.slice(j)]
}

/**
 * ②包名面:alias key(如 `@ihui/shared/utils`)是否在对应包 exports 表真实存在。
 * 返回 'yes' | 'no' | 'pkg-missing' | null(非 @ihui/* 的外部包,不在本仓核对面,不判)。
 * 子路径匹配口径:exports 键逐字等值(`./utils`),或键带 `/*` 尾且子路径落在该前缀下
 * (`./hooks/*` 覆盖 `./hooks/use-x`);裸包名只认 `.` 键。
 */
export function exportsExists(aliasKey, packages) {
  if (!aliasKey.startsWith('@ihui/')) return null
  const [pkgName, sub] = splitPkgAndSub(aliasKey)
  const pkg = packages.get(pkgName)
  if (!pkg) return 'pkg-missing'
  if (pkg.broken) return 'pkg-missing'
  if (!pkg.exports || typeof pkg.exports !== 'object') return 'no'
  const wanted = sub === '' ? '.' : `.${sub}`
  for (const k of Object.keys(pkg.exports)) {
    if (k === wanted) return 'yes'
    if (k.endsWith('/*') && wanted.startsWith(k.slice(0, -1)) && wanted !== k.slice(0, -1)) return 'yes'
  }
  return 'no'
}

/** provenance 水印行的形状(头三行 + 文件尾各一枚),不参与"理由"判定。 */
function isWatermarkLine(line) {
  const t = line.trim()
  return (
    t.startsWith('// ©') ||
    t.startsWith('// Provenance-watermarked') ||
    t.startsWith('// [IHUI-AI-PROVENANCE]') ||
    /^\/\/ [\u2060\u200b\u200c\u200d\u200e\u200f\ufeff]/.test(t)
  )
}

/**
 * ③头注面:替身文件剥掉水印行后的前导注释(首个代码行之前)。
 * 返回 { lines, first } —— lines 为空 = 头注没写理由(报 no)。
 */
export function leadingReasonComment(source) {
  const src = source.split('\n')
  const lines = []
  for (let i = 0; i < src.length; i += 1) {
    const line = src[i]
    if (isWatermarkLine(line)) continue
    const t = line.trim()
    if (t === '') {
      if (lines.length > 0) lines.push('')
      continue
    }
    if (t.startsWith('//')) {
      lines.push(t.replace(/^\/\/\s?/, ''))
      continue
    }
    if (t.startsWith('/*')) {
      // 块注释:吞到 */ 为止(首版只吃首行,把跨行 `/** 理由 */` 误判成"没写头注" —— 镜像测试前当场咬出)
      let buf = t.replace(/^\/\*+/, '')
      while (!buf.includes('*/') && i + 1 < src.length) {
        if (buf.trim()) lines.push(buf.trim().replace(/^\*+\s?/, ''))
        buf = src[i + 1].trim()
        i += 1
      }
      if (buf.includes('*/')) buf = buf.slice(0, buf.indexOf('*/'))
      if (buf.trim()) lines.push(buf.trim().replace(/^\*+\s?/, ''))
      continue
    }
    break // 首个代码行:前导注释到此为止
  }
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return { lines, first: (lines.find((l) => l.trim() !== '') ?? '').trim() }
}

/**
 * 纯函数盘点:给定仓库根,产出逐条清单行。
 * blind ≠ null 时 rows 为空(config 取不到 / alias 解析为 0),判失明如实上报。
 */
export function audit(root = REPO_ROOT) {
  const rnDir = join(resolve(root), RN_DIR_REL)
  const configFile = join(rnDir, CONFIG_REL)
  if (!existsSync(configFile)) {
    return { blind: `vitest 配置取不到:${relative(resolve(root), configFile)}`, rows: [] }
  }
  const entries = parseAliasEntries(readFileSync(configFile, 'utf8'))
  if (entries.length === 0) {
    return { blind: `vitest.config.ts 解析出 0 条别名(判据失明:书写形态可能已漂)`, rows: [] }
  }
  const packages = loadWorkspacePackages(root)
  const rows = []
  for (const { key, target } of entries) {
    const abs = resolve(rnDir, target)
    if (!isMockTarget(abs, rnDir)) continue // 落点不在 tests/__mocks__ ⇒ 直指真实源码/夹具,不在本门射程
    const targetExists = existsSync(abs) && statSync(abs).isFile()
    let header = null
    if (targetExists) header = leadingReasonComment(readFileSync(abs, 'utf8'))
    rows.push({
      key,
      target,
      stub: relative(resolve(root), abs),
      targetExists,
      exportsVerdict: exportsExists(key, packages),
      headerFirst: header?.first ?? '',
      headerOk: (header?.lines.filter((l) => l.trim() !== '').length ?? 0) > 0,
    })
  }
  return { blind: null, rows, totalAliases: entries.length }
}

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

/** 主入口:观测档恒 0(只报名,绝不判红 —— §12e/§12f)。 */
export function main(argv = process.argv.slice(2)) {
  // G-322(本站):`--root` 被下一枚旗标顶值 ⇒ 在一棵不存在的树上"报名清单为空";裸形态 resolve(undefined)
  // 崩裸栈。本门是观测档(只报名不判红),但**观测面错了就等于没观测**,而输出看起来照样正常。
  const rootFlag = requireFlagValue(argv, '--root', { noun: '目录' })
  if (rootFlag.error) {
    console.error(`❌ ${rootFlag.error}`)
    return 2
  }
  const root = rootFlag.value ? resolve(rootFlag.value) : REPO_ROOT
  console.log(
    `${C.bold}[mrn 替身面] mobile-rn vitest alias→mocks 观测清单(只报名不判红)${C.reset} ${C.dim}root=${root}${C.reset}`,
  )

  let face
  try {
    face = audit(root)
  } catch (e) {
    console.error(`${C.yellow}⚠ 盘点执行失败(观测档不拦):${e?.message ?? e}${C.reset}`)
    return 0
  }

  if (face.blind) {
    console.log(`${C.yellow}⚠ 判失明:${face.blind} —— 观测档不判红,但这一格必须有人回来看${C.reset}`)
    return 0
  }

  for (const r of face.rows) {
    const ex =
      r.exportsVerdict === 'yes'
        ? `${C.green}exports✓${C.reset}`
        : r.exportsVerdict === 'no'
          ? `${C.red}exports✗${C.reset}`
          : r.exportsVerdict === 'pkg-missing'
            ? `${C.red}包缺✗${C.reset}`
            : `${C.dim}exports n-a(外部包)${C.reset}`
    const hd = r.headerOk
      ? `${C.green}头注✓${C.reset} ${C.dim}${r.headerFirst.slice(0, 72)}${C.reset}`
      : `${C.red}头注✗(未写理由)${C.reset}`
    const miss = r.targetExists ? '' : ` ${C.red}[替身文件不存在]${C.reset}`
    console.log(`  ${C.yellow}●${C.reset} ${r.key} → ${r.stub}${miss}`)
    console.log(`      ${ex} · ${hd}`)
  }

  const ok = face.rows.filter((r) => r.exportsVerdict !== 'no' && r.exportsVerdict !== 'pkg-missing' && r.headerOk).length
  console.log(
    `  alias 总数 ${face.totalAliases} · 替身面命中 ${face.rows.length} · 三格全明 ${ok}` +
      ` ${C.dim}(观测档:命中只报名,RC 恒 0;转指真实现归 owner 裁决)${C.reset}`,
  )
  return 0
}

/** §22c:镜像测试只 import 这一份真相,不复制判据实现。 */
export const __test__ = {
  parseAliasEntries,
  isMockTarget,
  loadWorkspacePackages,
  splitPkgAndSub,
  exportsExists,
  leadingReasonComment,
  audit,
  main,
}

/** §22d 双形态入口守护:测试 import 时不得触发 CLI 副作用。 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const code = main()
  if (code) process.exit(code)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
