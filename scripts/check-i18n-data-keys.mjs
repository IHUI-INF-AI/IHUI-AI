#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-i18n-data-keys.mjs — 数据驱动键族 / 字面量键族的"渲染可达性"守门(2026-11-22 立)。
 *
 * 立因(实测事故):侧边栏把导航项抽成数据表,渲染侧统一 `t(item.labelKey)`。`check-i18n-keys.mjs`
 * 只认 `t('字面量')` 与 state 键流,这一族整族在射程外 —— 全量跑报 2006 条缺键、其中不含
 * `nav.hrGroup / nav.financeAi / nav.eduHubTitle / nav.contentHubTitle / nav.tradeHubTitle`,
 * 而 SSR HTML 里这五枚就是原样键名(页面上 10 个入口坏 5 个)。同型事故早有登记(G-1079148:
 * "UI 上真的显示了裸键名而门一路报绿"),所以本门不再做"某一族的补丁",而是把
 * 「源码引用 → 命名空间 → 词库解析」这条链收成一道判据(实现单一源 = scripts/lib/i18n-data-keys.mjs)。
 *
 * 判据(每一处引用都必须命中其一,否则红):
 *   ① 字段族  `xxxKey: 'value'` 且该字段进了某个 translator 的实参 → ns.value 必须可解析
 *   ② 字面量族 `t('value')` → ns.value 必须可解析
 *   ③ 数据模块 无 useTranslations 的纯数据表,按 scripts/data/i18n-data-key-namespaces.json 登记的 ns 判
 *
 * 存量与增量(AGENTS §12e 恒红门禁令):
 *   历史欠账(约 1800 处)已登记在 scripts/data/i18n-data-keys-baseline.json;
 *   **任何不在基线的缺失一律 exit 1** —— 新增一条就红,存量只报数。基线只许人工显式重建:
 *     node scripts/check-i18n-data-keys.mjs --update-baseline
 *   清偿一批后重建基线会把已修好的条目自动摘掉,不会留下"已修的还挂在豁免里"的腐烂清单。
 *
 * 用法:
 *   node scripts/check-i18n-data-keys.mjs                 # 全量(报数 + 拦基线外新增)
 *   node scripts/check-i18n-data-keys.mjs --staged        # 只审暂存区改动的源文件(pre-commit)
 *   node scripts/check-i18n-data-keys.mjs --update-baseline
 *   node scripts/check-i18n-data-keys.mjs --self-test     # 纯判据自检,不碰文件
 *
 * 退出码(三态,AGENTS §0.3):
 *   0 = 无基线外缺失(存量只报数)
 *   1 = 存在基线外缺失(新增裸键)
 *   2 = 未判定(语言包读不到 / 代码目录读不到 / 参数不识别)
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  extractKeyRefs,
  extractLiteralRefs,
  classifyRef,
  getMessageByPath,
} from './lib/i18n-data-keys.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const MESSAGES_DIR = path.join(REPO_ROOT, 'packages', 'i18n', 'messages')
const BASELINE_PATH = path.join(__dirname, 'data', 'i18n-data-keys-baseline.json')
const NS_MAP_PATH = path.join(__dirname, 'data', 'i18n-data-key-namespaces.json')
const SCAN_DIRS = ['apps/web/src', 'apps/web/app']

const argv = process.argv.slice(2)
const KNOWN = new Set(['--staged', '--update-baseline', '--self-test'])
for (const a of argv) {
  if (!KNOWN.has(a)) {
    console.error(
      `❌ 未识别的参数: ${JSON.stringify(a)}(可用: --staged / --update-baseline / --self-test)`,
    )
    process.exit(2)
  }
}
const isStaged = argv.includes('--staged')
const isUpdate = argv.includes('--update-baseline')

if (argv.includes('--self-test')) {
  // 纯判据自检:字段提取 / 命名空间归属 / 三档判定
  const src =
    "const t = useTranslations('nav')\nconst x = { labelKey: 'ghostKey', other: 1 }\n<span>{t(x.labelKey)}</span>\n"
  const { refs } = extractKeyRefs(src)
  const ok1 =
    refs.length === 1 &&
    refs[0].value === 'ghostKey' &&
    refs[0].namespaces[0] === 'nav' &&
    refs[0].decidable
  const ok2 = classifyRef(refs[0], { nav: {} }, []) === 'missing-global'
  const ok3 = classifyRef(refs[0], { nav: { ghostKey: 'x' } }, []) === 'ok'
  const lit = extractLiteralRefs("const t = useTranslations('nav')\nt('a')\nt('b.c')\n")
  const ok4 = lit.length === 2 && lit[0].ns === 'nav' && lit[0].key === 'a'
  const ok5 =
    classifyRef(
      { value: 'sub', namespaces: [null], decidable: false, field: 'labelKey' },
      { other: { sub: 'v' } },
      [],
    ) === 'undecidable'
  // 登记数据模块档(2026-11-22 修):纯数据模块本文件里没有 t() 调用,登记过 ns 也必须产出引用
  const regMod = extractKeyRefs("export const ITEMS = [{ href: '/x', labelKey: 'hrGroup' }]\n", {
    registeredNamespaces: ['nav'],
  })
  const ok6 =
    regMod.refs.length === 1 &&
    regMod.refs[0].value === 'hrGroup' &&
    regMod.refs[0].namespaces[0] === 'nav'
  // 未登记的数据模块不得被误收(否则每个 *Key 字段都会变成误报)
  const ok7 =
    extractKeyRefs("export const ITEMS = [{ href: '/x', labelKey: 'hrGroup' }]\n").refs.length === 0
  const cases = [
    ['字段提取', ok1],
    ['全局缺失档', ok2],
    ['命中档', ok3],
    ['字面量提取', ok4],
    ['未判定档', ok5],
    ['登记数据模块档', ok6],
    ['未登记不误收', ok7],
  ]
  for (const [name, ok] of cases) {
    console.log(`${ok ? '✓' : '✗'} ${name}`)
  }
  process.exit(cases.every(([, ok]) => ok) ? 0 : 1)
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

/** shared + web 合并的消息集(与 apps/web/src/providers/i18n-provider.tsx 的取数口径同源) */
function mergeMessages(base, over) {
  const out = { ...base }
  for (const k of Object.keys(over)) {
    const v = over[k]
    const b = out[k]
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      b &&
      typeof b === 'object' &&
      !Array.isArray(b)
    )
      out[k] = mergeMessages(b, v)
    else if (v !== undefined) out[k] = v
  }
  return out
}

function loadMessages(locale) {
  let m = {}
  for (const pk of ['shared', 'web']) {
    const p = path.join(MESSAGES_DIR, pk, `${locale}.json`)
    if (!fs.existsSync(p)) throw new Error(`语言包不存在: ${p}`)
    m = mergeMessages(m, readJson(p))
  }
  return m
}

let messages
try {
  messages = loadMessages('zh-CN')
} catch (e) {
  console.error(`❌ 未判定:读不到 zh-CN 语言包 — ${e.message}`)
  process.exit(2)
}

let nsMap = { modules: {} }
if (fs.existsSync(NS_MAP_PATH)) {
  try {
    nsMap = readJson(NS_MAP_PATH)
  } catch (e) {
    console.error(`❌ 未判定:数据模块登记表不可解析 — ${e.message}`)
    process.exit(2)
  }
}
const moduleNs = nsMap.modules ?? {}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (['node_modules', '.next', 'dist'].includes(e.name)) continue
      walk(p, out)
    } else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
}
const allFiles = []
for (const d of SCAN_DIRS) walk(path.join(REPO_ROOT, d), allFiles)
if (!allFiles.length) {
  console.error('❌ 未判定:代码目录读不到或有 0 个 ts/tsx')
  process.exit(2)
}

/** 暂存区改动文件(仅源码) */
function stagedFiles() {
  try {
    const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    })
    return out
      .split(/\r?\n/)
      .filter(Boolean)
      .map((f) => path.join(REPO_ROOT, f))
  } catch (e) {
    // 取不到暂存区 ⇒ 未判定(不回落成全量,否则每次提交都在扫全仓)
    console.error(`❌ 未判定:读不到暂存区文件清单 — ${e.message}`)
    process.exit(2)
  }
}

const files = isStaged ? stagedFiles() : allFiles
const isSkippable = (rel) =>
  !rel.startsWith('apps/web/') ||
  rel.includes('__tests__') ||
  rel.includes('/tests/') ||
  rel.endsWith('.test.ts') ||
  rel.endsWith('.test.tsx') ||
  rel.endsWith('.d.ts')

const findings = []
for (const f of files) {
  const rel = path.relative(REPO_ROOT, f).replace(/\\/g, '/')
  if (isSkippable(rel)) continue
  const src = fs.readFileSync(f, 'utf8')
  const extra = moduleNs[rel] ?? []

  const { refs } = extractKeyRefs(src, { registeredNamespaces: extra })
  for (const r of refs) {
    const verdict = classifyRef(r, messages, extra)
    if (verdict === 'ok' || verdict === 'undecidable') continue
    findings.push({
      sig: `${rel}|field|${r.field}|${r.value}`,
      kind: verdict,
      file: rel,
      field: r.field,
      value: r.value,
      ns: r.namespaces.map((n) => n ?? '?').join('|'),
    })
  }

  for (const l of extractLiteralRefs(src)) {
    if (!l.ns) continue
    if (typeof getMessageByPath(messages, `${l.ns}.${l.key}`) === 'string') continue
    findings.push({
      sig: `${rel}|literal|${l.ns}|${l.key}`,
      kind: 'missing-literal',
      file: rel,
      ns: l.ns,
      value: l.key,
    })
  }
}

let baseline = { entries: [] }
if (fs.existsSync(BASELINE_PATH)) {
  try {
    baseline = readJson(BASELINE_PATH)
  } catch (e) {
    console.error(`❌ 未判定:基线不可解析 — ${e.message}`)
    process.exit(2)
  }
}
const baseSigs = new Set(Object.keys(baseline.entries ?? {}))

if (isUpdate) {
  // 按签名去重(同一文件内重复引用同一键只算一处);存成 sig→kind 映射,体积约为逐条对象的一半
  const entries = {}
  for (const x of [...findings].sort((a, b) => a.sig.localeCompare(b.sig))) entries[x.sig] = x.kind
  fs.writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify({ updatedAt: new Date().toISOString(), count: Object.keys(entries).length, entries }, null, 2)}\n`,
    'utf8',
  )
  console.log(
    `[i18n-data-keys] 基线已重建:${Object.keys(entries).length} 条存量缺失 → ${path.relative(REPO_ROOT, BASELINE_PATH)}`,
  )
  process.exit(0)
}

const fresh = findings.filter((x) => !baseSigs.has(x.sig))
const stale = [...baseSigs].filter((sig) => !findings.some((x) => x.sig === sig))

console.log(
  `[i18n-data-keys] 面=${isStaged ? 'staged' : 'worktree'} 文件=${files.length} 引用检出=${findings.length} 基线=${baseSigs.size}`,
)
console.log(`  基线外新增缺失: ${fresh.length}   基线内已不再命中(可摘): ${stale.length}`)

if (fresh.length) {
  console.log('\n== 基线外新增缺失(必须修,否则渲染处就是裸键) ==')
  for (const x of fresh.slice(0, 60)) {
    console.log(`  ${x.file}  [${x.kind}] ${x.ns}  ${x.value}`)
  }
  if (fresh.length > 60) console.log(`  ... 其余 ${fresh.length - 60} 条`)
  console.log(
    '\n修法:向 packages/i18n/messages/web/{zh-CN,en,zh-TW,ja,ko}.json 补同名键(用 scripts/i18n-add-keys.mjs),',
  )
  console.log(
    '      或改引用。确属历史欠账请显式重建基线(--update-baseline),不得为了过门放宽判据。',
  )
  process.exit(1)
}

if (stale.length) {
  console.log(
    `\n  ⚠ 基线与当前面不一致:${stale.length} 条已修好仍挂在基线上(建议 --update-baseline 收缩)`,
  )
  for (const s of stale.slice(0, 10)) console.log(`    ${s}`)
}
console.log('\n✅ 无基线外新增缺失')
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
