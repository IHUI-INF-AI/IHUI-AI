#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 再生 apps/miniapp-taro/src/components/LineIcon/icons.ts —— 并回答"这张表里哪些条目是有源的、哪些是手写的"。
 *
 * 为什么要有这个文件:icons.ts 头注长期写着「由 scripts/gen-line-icons.mjs 生成,勿手改」,而**该脚本从来不在仓里**,
 * 于是这张表成了无法再生的冻结件;另一条通道 `scripts/gen-taro-lucide-icons.mjs` 把版本写死成
 * lucide-react@1.31.0(本机未装),照 AGENTS §4 跑它必抛 `lucide icon not found`(实测 exit 1)。
 *
 * 版本钉法:图标集版本取 **RN 端实际用的那份**(lucide-react-native@<v>),否则"两端同一字形"只是意图。
 * 目录按 pnpm 实际落盘解析,不写哈希后缀 —— 正是这条写死把旧脚本变成了死路。
 *
 * 三种条目,处置不同(这就是 --check 报告的全部内容):
 *   generated  按同名从 lucide 取 __iconNode,逐字节复现 ⇒ 由本脚本负责;
 *   aliased    lucide 里没有这个名字,但内层路径与另一个图标全等(如 bar-chart-3 → chart-column)⇒ 按别名复现;
 *   custom     内层路径在 lucide 全集中找不到(如 heart-fill / star-fill / x-error / check-white 这类描边+填充变体)
 *              ⇒ **原样保留并在报告里点名**,绝不"就近找一个代替"—— 那是把别人的设计悄悄换成另一份真相。
 *
 * 用法:
 *   node scripts/gen-line-icons.mjs                 # 只验"能否逐字节复现现表",不改文件
 *   node scripts/gen-line-icons.mjs --add=plus,camera   # 追加 lucide 图标(需再配 --write)
 *   node scripts/gen-line-icons.mjs --write --add=...   # 写回 + 重注水印
 *   node scripts/gen-line-icons.mjs --classified        # 打印每条的归类
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(ROOT, 'apps/miniapp-taro/src/components/LineIcon/icons.ts')
const PNPM = join(ROOT, 'node_modules/.pnpm')

function rnLucideVersion() {
  const dirs = readdirSync(PNPM).filter((d) => d.startsWith('lucide-react-native@'))
  if (!dirs.length) throw new Error('解析不到 lucide-react-native(先跑全量 pnpm install)')
  const vers = [...new Set(dirs.map((d) => /^lucide-react-native@([^_]+)/.exec(d)?.[1]))]
  if (vers.length > 1)
    throw new Error(`lucide-react-native 多版本共存:${vers.join(' / ')} —— 先收口依赖再生成`)
  return vers[0]
}

function lucideIconsDir(version) {
  const hit = readdirSync(PNPM).find((d) => d.startsWith(`lucide-react@${version}_`))
  if (!hit) {
    const have = readdirSync(PNPM)
      .filter((d) => d.startsWith('lucide-react@'))
      .join(' , ')
    throw new Error(
      `node_modules 里没有 lucide-react@${version},而 RN 端 lucide-react-native 正是这一版本。已装:${have || '无'}`,
    )
  }
  const p = join(PNPM, hit, 'node_modules/lucide-react/dist/esm/icons')
  if (!existsSync(p)) throw new Error(`图标目录不存在:${p}`)
  return p
}

function rawNode(file) {
  const src = readFileSync(file, 'utf8')
  const alias = /export \{ default \} from '\.\/([\w-]+)\.mjs';/.exec(src)
  const target = alias ? join(dirname(file), `${alias[1]}.mjs`) : file
  if (!existsSync(target)) throw new Error(`别名目标不存在:${target}`)
  const m = /const __iconNode = (\[[\s\S]*?\]);/m.exec(readFileSync(target, 'utf8'))
  if (!m) throw new Error(`解析不到 __iconNode:${target}`)
   
  return { nodes: eval(m[1]), via: alias ? `${alias[1]}` : null }
}

function parseNode(node) {
  const [tag, attrs] = node
  const { key: _key, ...rest } = attrs
  const a = Object.entries(rest)
    .map(([k, v]) => `${k}="${String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)
    .join(' ')
  return `<${tag}${a ? ' ' + a : ''} />`
}

/** 与现表逐字同形(不带 @license 行 —— 现表就没有)。cls 单独传,因为别名条目要保留**键名**做 class。 */
function svgFor(cls, nodes) {
  const body = nodes.map(parseNode).join('\n  ')
  return [
    '<svg',
    `  class="lucide lucide-${cls}"`,
    '  xmlns="http://www.w3.org/2000/svg"',
    '  width="24"',
    '  height="24"',
    '  viewBox="0 0 24 24"',
    '  fill="none"',
    '  stroke="#000000"',
    '  stroke-width="2"',
    '  stroke-linecap="round"',
    '  stroke-linejoin="round"',
    '>',
    `  ${body}`,
    '</svg>',
  ].join('\n')
}

/**
 * 字形身份 = 去掉 class 行之后的**整串**(保留根元素 fill/stroke)。
 * 只比内层路径会出错:heart 与 heart-fill 的路径完全相同,差的是根上 fill="none" vs fill="#000000" ——
 * 按路径认别名会把填充版悄悄重生成描边版,那是拿生成器改掉别人的设计。
 */
function prettify(text) {
  return execFileSync(
    process.execPath,
    [join(ROOT, 'node_modules/prettier/bin/prettier.cjs'), '--parser', 'babel-ts', '--stdin-filepath', OUT],
    { input: text, encoding: 'utf8', maxBuffer: 1 << 26, windowsHide: true },
  )
}

function sigOf(svg) {
  return svg
    .split('\n')
    .filter((l) => !l.includes('class="lucide'))
    .join('\n')
}

function loadTable() {
  return import(pathToFileURL(OUT).href)
}

/**
 * 定点改写:只替换"需要变的那几个键"的字符串字面量,并在 `} as const` 前追加新键。
 * 为什么不整表重建:对象里夹着人工注释(实测 `// radius-exempt: lucide 字形几何…`),
 * 重建会把它们丢掉 —— 而这张表的头注本来就写"勿手改",生成器的手感必须是"改最小的一片"。
 */
function splice(orig, replacements, adds) {
  let out = orig
  for (const [key, svg] of replacements) {
    const lit = JSON.stringify(svg)
    const kq = JSON.stringify(key)
    // 键可能写成 'a-b': / "a-b": / a_b:(prettier 单引号 + 安全标识符去引号),三种都要认
    const ke = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(
      `(^|\\n)(\\s*)(?:'${ke}'|"${ke}"|${ke}):\\s*(?:'(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*")`,
      'm',
    )
    let hit = false
    if (re.test(out)) {
      out = out.replace(re, (_m, a, ind) => `${a}${ind}${kq}: ${lit}`)
      hit = true
    }
    if (!hit) throw new Error(`定位不到键 ${key},拒绝盲写`)
  }
  if (adds.length) {
    const tail =
      adds.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n'
    const at = out.lastIndexOf('} as const')
    if (at < 0) throw new Error('找不到 `} as const` 收尾,拒绝盲写')
    out = out.slice(0, at) + tail + out.slice(at)
  }
  return out
}

/**
 * prettier 会把长条目折成 `key:` + 下一行字面量两行,于是"写在 key 上方"的豁免注释
 * 变成违规行的上上行 —— 门 77 B5 只认「同行或紧邻上行」,该约定在折行条目上结构性失效。
 * 故注释必须在 prettier 之后按违规行实际位置补(幂等:已有则不重复插)。
 *
 * 日期刻意写成**常量**而不是"跑一次算一次今天+90 天":后者每再生一次就改一次字节,
 * 生成器的幂等性(--check 必须零差异)当场作废。到期后果是门 108 E2 报一条待复核,
 * 而不是把 lucide 字形几何变成真债务 —— rx 属字形固有几何,这条本不该逐条目记账,
 * 真正的收口在"字形登记表整体归类"(见 icons.ts 的 custom 分类与 PLAN 图标载体票)。
 */
const EXEMPT =
  '// radius-exempt: lucide 字形几何,rx/ry 为 24 格 viewBox 单位而非 UI 圆角档位 until 2026-12-25'

function ensureExemption(text) {
  const out = []
  for (const line of text.split('\n')) {
    if (/[ry]x="[^"]*"/.test(line) && !line.includes('radius-exempt')) {
      const prev = out.length ? out[out.length - 1] : ''
      if (!prev.includes('radius-exempt')) out.push(`${/^\s*/.exec(line)[0]}${EXEMPT}`)
    }
    out.push(line)
  }
  return out.join('\n')
}

function run(entries, nodesOf, nameSet, args) {
  const existing = readFileSync(OUT, 'utf8')
  const cls = { generated: 0, aliased: [], custom: [] }
  const replacements = []
  for (const [k, stored] of entries) {
    if (nameSet.has(k)) {
      const gen = svgFor(k, nodesOf(k))
      if (gen === stored) {
        cls.generated++
        continue
      }
    }
    const src = [...nameSet].find((n) => sigOf(svgFor(k, nodesOf(n))) === sigOf(stored))
    if (src) {
      replacements.push([k, svgFor(k, nodesOf(src))])
      cls.aliased.push(`${k}→${src}`)
      continue
    }
    cls.custom.push(k)
  }
  const present = new Set(entries.map(([k]) => k))
  const adds = []
  for (const k of (args.find((a) => a.startsWith('--add=')) ?? '').slice(6).split(',').filter(Boolean)) {
    if (present.has(k)) continue
    if (!nameSet.has(k))
      throw new Error(`要新增的 ${k} 在 lucide 里没有同名图标 —— 换一个真名,别塞自造字形`)
    adds.push([k, svgFor(k, nodesOf(k))])
  }
  return { cls, replacements, adds, existing }
}

async function main() {
  const args = process.argv.slice(2)
  const ver = rnLucideVersion()
  const dir = lucideIconsDir(ver)
  const nodesCache = new Map()
  const names = readdirSync(dir)
    .filter((f) => f.endsWith('.mjs') && f !== 'index.mjs')
    .map((f) => f.slice(0, -4))
  const nodesOf = (n) => {
    if (!nodesCache.has(n)) nodesCache.set(n, rawNode(join(dir, `${n}.mjs`)).nodes)
    return nodesCache.get(n)
  }
  const nameSet = new Set(names)
  const { ICONS } = await loadTable()
  const entries = Object.entries(ICONS)
  if (args.includes('--list')) console.log(entries.map(([k]) => k).join('\n'))
  const { cls, replacements, adds, existing } = run(entries, nodesOf, nameSet, args)
  const total = entries.length + adds.length

  if (args.includes('--classified')) {
    console.log(`表内 ${entries.length} 条 | generated ${cls.generated} / aliased ${cls.aliased.length} / custom ${cls.custom.length}`)
    console.log('别名:', cls.aliased.join(' , ') || '(无)')
    console.log('手写(lucide 无同字形,原样保留):', cls.custom.join(' , ') || '(无)')
    return 0
  }

  const flowed = ensureExemption(prettify(splice(existing, replacements, adds.map((a) => a))))
  if (!args.includes('--write')) {
    const same = flowed === existing
    console.log(
      `数据源 lucide-react@${ver}(= RN 端 lucide-react-native 同版本)| 表内 ${total} 条 | ` +
        `generated ${cls.generated} / 待归一 ${cls.aliased.length} / custom ${cls.custom.length} / 新增 ${adds.length}`,
    )
    if (cls.aliased.length) console.log('  待归一(现表内容与 lucide 同名图标全等,仅声明名不同):', cls.aliased.join(' , '))
    console.log(same ? '✅ 现表与数据源一致(未受影响的条目与内联注释逐字保留)' : '❌ 有出入,差异见下')
    if (!same) {
      const a = existing.split('\n')
      const b = flowed.split('\n')
      let shown = 0
      for (let i = 0; i < Math.max(a.length, b.length) && shown < 5; i++)
        if (a[i] !== b[i]) {
          console.log(
            `  行 ${i + 1}\n    现表: ${(a[i] ?? '').slice(0, 96)}\n    再生: ${(b[i] ?? '').slice(0, 96)}`,
          )
          shown++
        }
    }
    return same ? 0 : 1
  }

  writeFileSync(OUT, flowed, 'utf8')
  execFileSync(process.execPath, [join(ROOT, 'scripts/watermark.mjs'), 'inject', OUT], {
    stdio: 'inherit',
    windowsHide: true,
  })
  console.log(`已写回:归一 ${replacements.length} 条,新增 ${adds.map(([k]) => k).join(',') || '无'},总数 ${total}`)
  return 0
}

/**
 * 校验档的兜底:比较的是**本次运行前后**的字节,而不是与 HEAD 的差异 ——
 * 表在开发过程中本就是"已生成、待提交"的状态,拿 git status 判会把这种正常状态误报成
 * "校验档改了文件"(写第一版时就踩过,叫狼的尺子比没有尺子更坏)。
 */
const preState = readFileSync(OUT, 'utf8')

main().then(
  (code) => {
    if (!process.argv.includes('--write')) {
      if (readFileSync(OUT, 'utf8') !== preState) {
        console.error('❌ 校验档竟改动了 icons.ts —— 判据本身有问题,停止')
        process.exit(2)
      }
    }
    process.exit(code)
  },
  (err) => {
    console.error(`❌ ${err?.message ?? err}`)
    process.exit(2)
  },
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
