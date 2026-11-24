#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-i18n-placeholder-arity.mjs — i18n 占位符一致性守门(2026-11-23 立)。
 *
 * 立因(实测事故,与裸键同一症状的第四种成因):
 *   next-intl 在**文案里有 {var} 而调用没给参数**时不抛错、不回落默认文案,
 *   直接把整条键路径(用户看到的 `nav.hrGroup` 那一类)画到界面上。旧的三道门全部失明:
 *     · check-i18n-keys.mjs       只看"键存在"
 *     · check-i18n-parity.mjs     只看"五语言键集一致"(一致地缺占位符参 ⇒ 恒绿)
 *     · check-i18n-data-keys.mjs  只看"数据表引用的键可否解析"
 *   实测样本(清 .next 冷启后仍复现,证明不是缓存):
 *     `t('autoContrastHint')` 的值是「对比度低于 {threshold} 时…」⇒ 界面出裸键;
 *     补 `{threshold:4.5}` 当场变成正常文案。同族另有 t('steps') / t('pointsUnit') /
 *     `t('relistSuccess')` … 以及 `t('totalItems',{total})` vs 值 `{count}` 这类"变量名对不上"。
 *
 * 判据(实现单一源 = scripts/lib/i18n-placeholder-arity.mjs):
 *   A 调用侧齐备性:每一处 `t('k' …)` / `t.rich('k',…)` 的实参必须覆盖该键在**每一种语言**
 *     文案里需要的参数;`t.raw` 跳过(raw 不插值,花括号是留给 fillTemplate 的模板)。
 *   B 值侧稳定性:同一个键在五语言里的参数集合必须相同 —— 某语言多一个参数,
 *     在那种语言下就是裸键;少一个参数是翻译丢值。
 *
 * 覆盖面(全端,不是只扫 web):
 *   apps/web/{app,src} · apps/mobile-rn/{src,app} · apps/miniapp-taro/src ·
 *   packages/app/src · packages/ui-react/src
 *
 * 存量与增量(AGENTS §12e 恒红门禁令):
 *   历史欠账登记在 scripts/data/i18n-placeholder-arity-baseline.json;**基线外新增一律 exit 1**,
 *   存量只报数。基线只许人工显式重建:node scripts/check-i18n-placeholder-arity.mjs --update-baseline
 *   （重建会把已修条目自动摘掉,不留腐烂清单）
 *
 * 用法:
 *   node scripts/check-i18n-placeholder-arity.mjs                 # 全量
 *   node scripts/check-i18n-placeholder-arity.mjs --staged        # 只审暂存区改动源文件(pre-commit)
 *   node scripts/check-i18n-placeholder-arity.mjs --update-baseline
 *   node scripts/check-i18n-placeholder-arity.mjs --self-test     # 纯判据自检,不碰文件
 *
 * 退出码(三态,AGENTS §0.3):
 *   0 = 无基线外问题(存量只报数;dynamic 报数不红)
 *   1 = 存在基线外问题
 *   2 = 未判定(语言包读不到 / 代码目录读不到 / 参数不识别)
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  ALL_ROOTS,
  LOCALES,
  extractCalls,
  extractTemplateCalls,
  judgeCalls,
  placeholdersOf,
  mergeMessages,
  walkSources,
} from './lib/i18n-placeholder-arity.mjs'
// 判面层单一源(守门 312:注册门必须接 face-reader,面名不得各写一份)
import { FACES, FACE_LABEL } from './lib/face-reader.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const MESSAGES_DIR = path.join(REPO_ROOT, 'packages', 'i18n', 'messages')
const BASELINE_PATH = path.join(__dirname, 'data', 'i18n-placeholder-arity-baseline.json')

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
const FACE = isStaged ? 'staged' : 'worktree'
if (!FACES.includes(FACE)) {
  console.error(`❌ 判面不在 face-reader 的 FACES 内: ${FACE}`)
  process.exit(2)
}
const isUpdate = argv.includes('--update-baseline')

if (argv.includes('--self-test')) {
  const cases = []
  const ok = (name, cond) => cases.push([name, Boolean(cond)])

  ok('占位符提取-简单', JSON.stringify(placeholdersOf('{a} 与 {b}')) === '["a","b"]')
  ok(
    '占位符提取-plural 只取参数不取类型',
    JSON.stringify(placeholdersOf('{count, plural, one{# 条} other{# 条}}')) === '["count"]',
  )
  ok('占位符提取-无参数', placeholdersOf('纯文案').length === 0)

  const srcNone = "const t = useTranslations('a')\n{t('k')}\n"
  const c1 = extractCalls(srcNone)
  ok('调用提取-无第二参', c1.length === 1 && c1[0].kind === 'none' && c1[0].key === 'a.k')

  const srcObj = "const t = useTranslations('a')\nt('k', { x, y: 2 })\n"
  const c2 = extractCalls(srcObj)
  ok(
    '调用提取-对象简写+键值',
    c2.length === 1 && c2[0].kind === 'object' && c2[0].keys.join(',') === 'x,y',
  )

  const srcDyn = "const t = useTranslations('a')\nt('k', values)\n"
  const c3 = extractCalls(srcDyn)
  ok('调用提取-变量第二参=不可判定', c3.length === 1 && c3[0].kind === 'dynamic')

  const srcSpread = "const t = useTranslations('a')\nt('k', { ...base })\n"
  ok('调用提取-展开=不可判定', extractCalls(srcSpread)[0].kind === 'spread')

  const tplSrc = "const t = useTranslations('a')\nt(`k.${x}.title`)\n"
  const tpl = extractTemplateCalls(tplSrc)
  ok('模板拼接提取(棘轮档)', tpl.length === 1 && tpl[0].template === 'k.${x}.title')

  const srcRaw = "const t = useTranslations('a')\nt.raw('k')\n"
  ok('raw 不参与判据', judgeCalls(extractCalls(srcRaw), { a: { k: '{x} 模板' } }).length === 0)

  const j1 = judgeCalls(c1, { a: { k: '需要 {x}' } })
  ok(
    '判定-无参且值需参数=裸键',
    j1.length === 1 && j1[0].kind === 'none' && j1[0].missing[0] === 'x',
  )

  const j2 = judgeCalls(c2, { a: { k: '需要 {x} 与 {y}' } })
  ok('判定-参数齐备=通过', j2.length === 0)

  const j3 = judgeCalls(extractCalls("const t = useTranslations('a')\nt('k', { total })\n"), {
    a: { k: '共 {count} 条' },
  })
  ok('判定-变量名对不上=裸键', j3.length === 1 && j3[0].missing[0] === 'count')

  ok('判定-缺键不归本门', judgeCalls(c1, { a: {} }).length === 0)

  const richSrc = "const t = useTranslations('a')\nt.rich('k', { b: (c) => c })\n"
  const j4 = judgeCalls(extractCalls(richSrc), { a: { k: '<b>粗</b>{x}' } })
  ok('判定-rich 标签不算参数、缺 x 仍判', j4.length === 1 && j4[0].missing[0] === 'x')

  ok(
    '合并消息-深合并',
    JSON.stringify(mergeMessages({ a: { x: '1', y: '2' } }, { a: { y: '3' } })) ===
      JSON.stringify({ a: { x: '1', y: '3' } }),
  )

  for (const [name, cond] of cases) console.log(`${cond ? '✓' : '✗'} ${name}`)
  process.exit(cases.every(([, c]) => c) ? 0 : 1)
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

/** 每语言 merged 树(shared + web,与 apps/web/src/providers/i18n-provider.tsx 同源) */
const messagesByLocale = {}
for (const loc of LOCALES) {
  let merged = {}
  for (const pk of ['shared', 'web']) {
    const p = path.join(MESSAGES_DIR, pk, `${loc}.json`)
    if (!fs.existsSync(p)) {
      console.error(`❌ 未判定:语言包不存在 — ${p}`)
      process.exit(2)
    }
    try {
      merged = mergeMessages(merged, readJson(p))
    } catch (e) {
      console.error(`❌ 未判定:语言包不可解析(${loc}/${pk}) — ${e.message}`)
      process.exit(2)
    }
  }
  messagesByLocale[loc] = merged
}

const allFiles = walkSources(ALL_ROOTS.map((r) => path.join(REPO_ROOT, r)))
if (!allFiles.length) {
  console.error('❌ 未判定:代码目录读不到或有 0 个 ts/tsx')
  process.exit(2)
}

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
    console.error(`❌ 未判定:读不到暂存区文件清单 — ${e.message}`)
    process.exit(2)
  }
}

const files = isStaged ? stagedFiles() : allFiles
const findings = []
let callCount = 0
let dynamicCount = 0

for (const f of files) {
  const rel = path.relative(REPO_ROOT, f).replace(/\\/g, '/')
  if (!/\.(ts|tsx)$/.test(rel) || rel.endsWith('.d.ts')) continue
  if (rel.includes('__tests__') || rel.includes('/tests/') || /\.test\.(ts|tsx)$/.test(rel))
    continue
  let src
  try {
    src = fs.readFileSync(f, 'utf8')
  } catch (e) {
    console.error(`❌ 未判定:读不到 ${rel} — ${e.message}`)
    process.exit(2)
  }
  const calls = extractCalls(src)
  callCount += calls.length
  // D 档:模板拼接键 `t(\`ns.${x}.k\`)` —— 候选域只有运行时才知道,静态判不到可达性,
  // 只能棘轮拦"新增这一型"(存量登记在基线;新增一律改数据表字面量键,落进 data-keys 门射程)。
  for (const tpl of extractTemplateCalls(src)) {
    findings.push({
      sig: `${rel}|tpl|${tpl.ns}|${tpl.template}`,
      kind: 'template',
      file: rel,
      key: `t(\`${tpl.template}\`)`,
      line: tpl.line,
      missing: '',
      locales: '',
    })
  }
  const perLocale = {}
  for (const loc of LOCALES) {
    for (const x of judgeCalls(calls, messagesByLocale[loc])) {
      if (x.kind === 'dynamic' || x.kind === 'spread') {
        if (loc === 'zh-CN') dynamicCount += 1
        continue
      }
      ;(perLocale[x.key] ??= {
        missing: new Set(),
        locales: new Set(),
        line: x.line,
        kind: x.kind,
      }).locales.add(loc)
      perLocale[x.key].missing.add(x.missing.join(','))
    }
  }
  for (const [key, v] of Object.entries(perLocale)) {
    findings.push({
      sig: `${rel}|${key}`,
      kind: v.kind,
      file: rel,
      key,
      line: v.line,
      missing: [...v.missing].join(' '),
      locales: [...v.locales].join(','),
    })
  }
}

// 判据 B:同一键在五语言里的参数集合必须一致
const unstable = []
for (const pk of ['shared', 'web']) {
  const trees = {}
  for (const loc of LOCALES) {
    const p = path.join(MESSAGES_DIR, pk, `${loc}.json`)
    trees[loc] = readJson(p)
  }
  const walkKeys = (node, prefix, fn) => {
    for (const k of Object.keys(node)) {
      const v = node[k]
      const key = prefix ? `${prefix}.${k}` : k
      if (typeof v === 'string') fn(key)
      else if (Array.isArray(v)) v.forEach((el, i) => typeof el === 'string' && fn(`${key}[]#${i}`))
      else if (v && typeof v === 'object') walkKeys(v, key, fn)
    }
  }
  const getBy = (o, dotted) =>
    dotted.split('.').reduce((a, b) => (a && typeof a === 'object' ? a[b] : undefined), o)
  walkKeys(trees['zh-CN'], '', (key) => {
    const sets = LOCALES.map((loc) => {
      const val = getBy(trees[loc], key)
      return `${loc}[${placeholdersOf(typeof val === 'string' ? val : '')
        .sort()
        .join(',')}]`
    })
    if (new Set(sets.map((s) => s.slice(s.indexOf('['))).values()).size > 1)
      unstable.push({
        sig: `locale-set|${pk}|${key}`,
        kind: 'locale-set',
        file: `${pk}/${key}`,
        sets: sets.join(' '),
      })
  })
}

const allFindings = [...findings, ...unstable]

let baseline = { entries: {} }
if (fs.existsSync(BASELINE_PATH)) {
  try {
    baseline = readJson(BASELINE_PATH)
  } catch (e) {
    console.error(`❌ 未判定:基线不可解析 — ${e.message}`)
    process.exit(2)
  }
}

if (isUpdate) {
  const entries = {}
  for (const x of [...allFindings].sort((a, b) => a.sig.localeCompare(b.sig)))
    entries[x.sig] = x.kind
  fs.writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify({ updatedAt: new Date().toISOString(), count: Object.keys(entries).length, dynamicCount, entries }, null, 2)}\n`,
    'utf8',
  )
  console.log(
    `[i18n-placeholder-arity] 基线已重建:${Object.keys(entries).length} 条存量 → ${path.relative(REPO_ROOT, BASELINE_PATH)}(不可静态判定 ${dynamicCount} 处另报数)`,
  )
  process.exit(0)
}

const baseSigs = new Set(Object.keys(baseline.entries ?? {}))
const fresh = allFindings.filter((x) => !baseSigs.has(x.sig))
const stale = [...baseSigs].filter((s) => !allFindings.some((x) => x.sig === s))

console.log(
  `[i18n-placeholder-arity] 面=${FACE_LABEL[FACE] ?? FACE} 文件=${files.length} 调用=${callCount} 违规=${allFindings.length} 基线=${baseSigs.size}`,
)
console.log(
  `  基线外新增: ${fresh.length}   基线内已不再命中(可摘): ${stale.length}   不可静态判定(变量传参): ${dynamicCount}`,
)

if (fresh.length) {
  console.log('\n== 基线外新增(渲染处就是裸键,必须修) ==')
  for (const x of fresh.slice(0, 60)) {
    if (x.kind === 'locale-set') console.log(`  [五语言不一致] ${x.file}  ${x.sets}`)
    else if (x.kind === 'template')
      console.log(`  [模板拼接键(新增)] ${x.file}:${x.line}  ${x.key}  ⇒ 改数据表字面量键`)
    else
      console.log(`  ${x.file}:${x.line}  [${x.kind}] ${x.key}  缺 ${x.missing}  语言 ${x.locales}`)
  }
  if (fresh.length > 60) console.log(`  ... 其余 ${fresh.length - 60} 条`)
  console.log(
    '\n修法:① 给调用补参 `t(key, { x: … })`;② 值里的 `{name}` 与实参同名化;③ 说明文本里有花括号',
  )
  console.log('      用 `t.raw(key)`(raw 不插值);④ 五语言参数集合必须一致,改词条时同批改五份。')
  process.exit(1)
}

if (stale.length) {
  console.log(
    `\n  ⚠ 基线与当前面不一致:${stale.length} 条已修好仍挂在基线上(建议 --update-baseline 收缩)`,
  )
  for (const s of stale.slice(0, 10)) console.log(`    ${s}`)
}
console.log('\n✅ 无基线外新增')
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
