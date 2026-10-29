#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 器物,需打印预演/落地结论 */
/**
 * gen-rn-host-shell.mjs —— 「共享屏 → RN 宿主薄壳」的生成器 + 对账器(2026-10-28 立)。
 *
 * 立因:RN 端 312 屏里 257 是共享屏薄壳,全部手写。每接一枚新共享屏,都要手抄一遍
 * 「imports + t/colorScheme 注入 + navigation.goBack」这百行样板 —— 判据侧早有 props 的
 * 权威解析(lib/cross-end-screen-props.mjs),生壳侧却一直没有器物,新屏只能靠抄旧屏。
 * 本器把这条链补上:**可生成的生成,不可生成的点名缺哪条腿**。
 *
 * 判据单源(§0.6):必填 props 一律取 `lib/cross-end-screen-props.mjs` 的 requiredPropsOf,
 * 本器不另写"读 interface 猜字段"的第二套算式(那套已实测把数据项类型当成 props)。
 *
 * 三档(由判据给出,本器不重判):
 *   seedable     必填腿全部落在可注入集(t / colorScheme / onBack / onClose / onDismiss)
 *                ⇒ 生成完整可运行薄壳,零 TODO。
 *   needs-manual 必填腿里含端上事实(onRetry / entries / 业务数据…)
 *                ⇒ **不生成**(不产半成品),只把缺哪几条腿点名输出。
 *   undetermined 编译面取不到 ⇒ 如实未判定,不记绿也不冒红(§0.3)。
 *
 * 与 TS 编译的分工:props 传不齐 **本来就编译不过**(共享屏签名是强约束),所以本器不负责
 * "抓脱节",负责的是"省掉抄写"与"登记表断链"这两件事。
 *
 * 幂等:目标文件已存在即 skipped;`--force` 才覆盖。生成物带 `@gen-rn-host-shell` 标记,
 * 供 R3 判「生成后被手改」。
 *
 * 退出码:0 = 无需推进 / 已落;1 = 判定成立但被护栏拦住(--write 缺省、cap、目标已存在);
 *         2 = 未判定(编译面取不到、登记表读不到)。
 *
 * Usage:
 *   node scripts/gen-rn-host-shell.mjs --list
 *   node scripts/gen-rn-host-shell.mjs --screen=packages/app/src/features/about/AboutScreen.tsx
 *   node scripts/gen-rn-host-shell.mjs --screen=... --write
 *   node scripts/gen-rn-host-shell.mjs --all --write --cap=5
 *   node scripts/gen-rn-host-shell.mjs --check
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { allPropsOf, requiredPropsOf } from './lib/cross-end-screen-props.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const R = (...p) => join(ROOT, ...p)
const REGISTRY = 'scripts/data/cross-end-screen-registry.json'
const RN_DIR = 'apps/mobile-rn/src/screens'
const MARK = '@gen-rn-host-shell'

/** 平台能当场注入的腿 → 生成时写进 JSX 的表达式。不在此表内的可注入腿一律算 needs-manual。 */
const LEG_EXPR = {
  t: 't',
  colorScheme: 'resolvedTheme',
  scheme: 'resolvedTheme',
  resolvedTheme: 'resolvedTheme',
  themeMode: 'resolvedTheme',
  onBack: '() => navigation.goBack()',
  onClose: '() => navigation.goBack()',
  onDismiss: '() => navigation.goBack()',
}

export const SEEDABLE = new Set(Object.keys(LEG_EXPR))

const argv = process.argv.slice(2)
const has = (name) => argv.some((a) => a === `--${name}` || a.startsWith(`--${name}=`))
const val = (name, fallback = null) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    // §12g:派生 git 必须显式接管 stdio —— 不写在本机稳定 EBUSY(守门 193)
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

function loadRegistry() {
  const abs = R(REGISTRY)
  if (!existsSync(abs)) return null
  const raw = JSON.parse(readFileSync(abs, 'utf8'))
  const rows = Array.isArray(raw) ? raw : raw.entries || raw.rows || []
  return rows.filter((r) => r && typeof r.shared === 'string')
}

/** 共享屏相对路径 → 其导出组件名(取文件 basename,与仓内 249 屏一致) */
function symbolOf(specRel) {
  const base = specRel
    .split('/')
    .pop()
    .replace(/\.tsx$/, '')
  return { component: base, shared: `Shared${base}` }
}

/** 生成时的腿序:取词 → 主题 → 返回,与仓内手写壳的书写习惯一致(不是字母序) */
const LEG_ORDER = ['t', 'colorScheme', 'onBack']
const sortLegs = (legs) =>
  [...legs].sort((a, b) => {
    const ia = LEG_ORDER.indexOf(a)
    const ib = LEG_ORDER.indexOf(b)
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    return a.localeCompare(b)
  })

/** 档位:判据给 reusable/needs-data,本器再按"腿能否直接注入"细分为 seedable/needs-manual */
function classify(specRel) {
  const probe = requiredPropsOf(specRel)
  if (probe.state === 'undetermined')
    return { kind: 'undetermined', reason: probe.reason, legs: [], hard: [] }
  const required = probe.required || []
  const hard = required.filter((l) => !SEEDABLE.has(l))
  // 可选但语义必须注入的腿(不传则暗色/返回静默失效):取同一解析器的全量面,只认可注入集
  const all = allPropsOf(specRel)
  const optionalInject =
    all.state === 'ok'
      ? all.props.filter((p) => p.optional && SEEDABLE.has(p.name)).map((p) => p.name)
      : []
  const legs = sortLegs([...new Set([...required, ...optionalInject])])
  return hard.length === 0
    ? { kind: 'seedable', legs, hard: [] }
    : { kind: 'needs-manual', legs, hard }
}

/** 生成薄壳源码。纯函数(便于自测):只依赖 specRel 与 legs。 */
export function buildShell(specRel, legs) {
  const { component, shared } = symbolOf(specRel)
  const specs = specRel.split('/features/')[1] ?? specRel
  const body = sortLegs(legs)
    .map((l) => `      ${l}={${LEG_EXPR[l]}}`)
    .join('\n')
  return `// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// ${MARK} —— 本文件为生成物,勿手改结构;共享屏 props 变更后重跑:
//   node scripts/gen-rn-host-shell.mjs --screen=${specRel} --write --force

import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ${component} as ${shared} } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * RN 宿主薄壳 —— 真相源 ${specs}。
 * 端内不写布局、不写样式:视觉与结构全在共享屏,本屏只做平台注入(取词/主题/返回)。
 */
export function ${component}() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  return (
    <${shared}
${body}
    />
  )
}
`
}

function targetPathOf(specRel, registry) {
  const hit = (registry || []).find((r) => r.shared === specRel && r.rn)
  if (hit) return hit.rn
  const base = specRel.split('/').pop()
  return `${RN_DIR}/${base}`
}

/** R1: 登记表 rn 断链。返回断链清单(不存在即红)。 */
export function brokenLinks(registry) {
  return (registry || []).filter((r) => r.rn && !existsSync(R(r.rn))).map((r) => r.rn)
}

/** R3: 已存在的生成物与重新生成的结果是否一致(被判"生成后被手改") */
export function drifted(registry, classifyFn = classify) {
  const out = []
  for (const row of registry || []) {
    if (!row.rn || !existsSync(R(row.rn))) continue
    const text = readFileSync(R(row.rn), 'utf8')
    if (!text.includes(MARK)) continue
    const c = classifyFn(row.shared)
    if (c.kind !== 'seedable') continue
    if (text !== buildShell(row.shared, c.legs)) out.push({ rn: row.rn, shared: row.shared })
  }
  return out
}

function listAll(registry) {
  const specs = git(['ls-files', 'packages/app/src/features/**/*Screen.tsx'])
    .trim()
    .split('\n')
    .filter(Boolean)
  const tally = { seedable: 0, 'needs-manual': 0, undetermined: 0 }
  const rows = []
  for (const spec of specs) {
    const c = classify(spec)
    tally[c.kind]++
    rows.push({ spec, ...c })
  }
  return { specs, tally, rows, registry }
}

function main() {
  const registry = loadRegistry()
  if (has('check')) {
    if (!registry) {
      console.error('未判定:读不到登记表 ' + REGISTRY)
      process.exit(2)
    }
    const broken = brokenLinks(registry)
    const drift = drifted(registry)
    console.log(
      `[gen-rn-host-shell --check] 登记表 ${registry.length} 条 · R1 断链 ${broken.length} · R3 生成物漂移 ${drift.length}`,
    )
    for (const b of broken) console.log('  R1 断链:', b)
    for (const d of drift) console.log('  R3 漂移:', d.rn, '←', d.shared)
    process.exit(broken.length + drift.length > 0 ? 1 : 0)
  }

  if (has('list')) {
    const { tally, rows } = listAll(registry)
    console.log(
      `共享屏 ${rows.length} 个 · seedable ${tally.seedable} · needs-manual ${tally['needs-manual']} · undetermined ${tally.undetermined}`,
    )
    for (const r of rows.filter((x) => x.kind === 'seedable')) {
      const tgt = targetPathOf(r.spec, registry)
      console.log(
        `  seedable  ${r.spec.split('/features/')[1]} → ${tgt}${existsSync(R(tgt)) ? ' (已存在)' : ' (待生成)'}`,
      )
    }
    return
  }

  const screen = val('screen')
  const all = has('all')
  if (!screen && !all) {
    console.error('用法: --list | --check | --screen=<spec> [--write] | --all [--write] [--cap=n]')
    process.exit(2)
  }
  if (!registry) {
    console.error('未判定:读不到登记表 ' + REGISTRY)
    process.exit(2)
  }

  let targets = []
  if (screen) {
    if (!existsSync(R(screen))) {
      console.error('未判定:共享屏不存在 ' + screen)
      process.exit(2)
    }
    targets = [screen]
  } else {
    const { rows } = listAll(registry)
    const cap = Number(val('cap', '5')) || 5
    targets = rows
      .filter((r) => r.kind === 'seedable')
      .map((r) => r.spec)
      .filter((s) => !existsSync(R(targetPathOf(s, registry))))
      .slice(0, cap)
  }

  const force = has('force')
  const adopt = has('adopt')
  const write = has('write') || adopt
  let wrote = 0
  let skipped = 0
  let manual = 0
  for (const spec of targets) {
    const c = classify(spec)
    if (c.kind === 'undetermined') {
      console.log(`  未判定 ${spec}: ${c.reason}`)
      continue
    }
    if (c.kind === 'needs-manual') {
      manual++
      console.log(
        `  needs-manual ${spec.split('/features/')[1]} ← 需人工接的腿: ${c.hard.join(', ')}`,
      )
      continue
    }
    const goal = targetPathOf(spec, registry)
    const abs = R(goal)
    const existing = existsSync(abs) ? readFileSync(abs, 'utf8') : null
    if (existing !== null && !force && !has('adopt')) {
      skipped++
      console.log(`  skipped ${goal} (已存在;--force 覆盖生成物,--adopt 接管手写壳)`)
      continue
    }
    // 手写壳往往带生成器不认识的额外接线(entries / onRegister / onOpenPortal …),
    // 直接覆盖会把功能冲掉 ⇒ 只有显式 --adopt 才允许接管。
    if (existing !== null && !existing.includes(MARK) && !has('adopt')) {
      skipped++
      console.log(`  refused ${goal} (手写壳,拒绝覆盖;确需接管请加 --adopt)`)
      continue
    }
    if (!write) {
      console.log(`  [预演] ${spec.split('/features/')[1]} → ${goal}`)
      continue
    }
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, buildShell(spec, c.legs))
    wrote++
    console.log(`  written ${goal}`)
  }
  console.log(
    `GEN-RN-HOST-SHELL state=${write ? 'applied' : 'preview'} 目标=${targets.length} 写出=${wrote} 跳过=${skipped} 需人工=${manual}`,
  )
  process.exit(write || targets.length === 0 ? 0 : 1)
}

if (
  process.argv[1] &&
  relative(ROOT, process.argv[1]).replace(/\\/g, '/') === 'scripts/gen-rn-host-shell.mjs'
)
  main()

export const __test__ = {
  buildShell,
  symbolOf,
  classify,
  SEEDABLE,
  LEG_EXPR,
  MARK,
  brokenLinks,
  drifted,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
