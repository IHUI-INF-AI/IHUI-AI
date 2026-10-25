#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gen-rn-shell-page.mjs — RN 壳 → 小程序页面 的**包装页生成器**(默认只读预演,`--apply` 才写盘)。
 *
 * 为什么需要这一件(2026-10-26):`@rn-shells` 别名 + `rn-compat` 平台适配层 +
 * RnShellReplacePlugin(把壳里的 `../i18n` / `../context/ThemeContext` 换回端内真相源)已经就位,
 * 就绪尺现读 256/279 屏的 import 闭包在 mini 端可解析 —— 但**页面还得一屏一手写**,
 * 而每个页面本可只有 10 行(壳复用,不重复布局与数据逻辑)。本器把"造一屏"变成一条命令。
 *
 * 判据零复算(§0.6):
 *   · 路由插入 import `insertConfigPage`(与 gen-miniapp-mirror 同一实现);
 *   · 壳的导出形态/是否自包含(无必填 props)由本文件解析 —— 这是**本器新增的唯一判断**,
 *     因为没有任何现成尺子回答"这个壳能不能零参渲染";解析不到一律拒并点名,不猜。
 *
 * 取材面(§0.4):壳与 app.config 一律取 HEAD blob;写盘基底取 HEAD 文本(工作树滞后不回流)。
 *
 * Usage:
 *   node scripts/gen-rn-shell-page.mjs --screen=MoreCourseScreen --route=pkg-learn/more-course --title=更多课程
 *   node scripts/gen-rn-shell-page.mjs --screen=… --route=… --title=… --apply
 *   node scripts/gen-rn-shell-page.mjs --screen=… --route=… --title=… --json
 *   node scripts/gen-rn-shell-page.mjs --self-test
 *
 * 退出码:0 = 生成/合法跳过;1 = 判定成立但拒绝落地(路由已占/页面已存在/配置形态异常);
 *         2 = 未判定(取不到面、壳不存在、壳需要必填 props、分包 root 推断不出)。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

import { insertConfigPage } from './gen-miniapp-mirror.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SCREENS = 'apps/mobile-rn/src/screens'
const MP_CONFIG = 'apps/miniapp-taro/src/app.config.ts'

const faceText = (rel) => {
  try {
    return execFileSync('git', ['show', `HEAD:${rel}`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 16 << 20,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    return null
  }
}

/**
 * 解析壳的导出面:函数名、导出形态(named/default)、是否自包含(签名无必填 props)。
 * 返回 { ok:true, name, exportKind } | { ok:false, why, props? }
 */
export function parseShellExport(text) {
  const src = String(text ?? '')
  const named = /export\s+function\s+([A-Z][A-Za-z0-9_]*)\s*\(([^)]{0,400})\)/.exec(src)
  if (named) {
    const params = named[2].trim()
    if (params.startsWith('{') && params.length > 2) {
      const props = params
        .replace(/[{}\n]/g, ' ')
        .split(',')
        .map((p) => p.trim().split(/[:?=]/)[0].trim())
        .filter(Boolean)
      // `= {}` 默认空对象 ⇒ 调用方可不传
      const optional = /=\s*\{\s*\}/.test(params)
      if (!optional) return { ok: false, why: `壳需要必填 props:${props.join(', ')}`, props }
    }
    return { ok: true, name: named[1], exportKind: 'named' }
  }
  const def = /export\s+default\s+function\s*([A-Z][A-Za-z0-9_]*)?\s*\(/.exec(src)
  if (def) return { ok: true, name: def[1] ?? null, exportKind: 'default' }
  const constDef = /export\s+default\s+(?:React\.)?(?:memo|forwardRef)?\(?\s*([A-Z][A-Za-z0-9_]*)/.exec(src)
  if (constDef) return { ok: true, name: constDef[1], exportKind: 'default' }
  return { ok: false, why: '解析不到壳的导出形态(既非 `export function` 也非 `export default`)' }
}

/** 生成页面与配置文本(纯函数,供自测)。 */
export function buildPageFiles({ screenName, route, title, exportKind }) {
  const pageFn = `${screenName.replace(/Screen$/, '')}Page`
  const importLine =
    exportKind === 'default'
      ? `import Shell from '@rn-shells/${screenName}'`
      : `import { ${screenName} as Shell } from '@rn-shells/${screenName}'`
  const page = [
    `// 壳复用:${SCREENS}/${screenName}.tsx —— 布局与数据逻辑全在 RN 壳里,本页只做平台外壳。`,
    importLine,
    "import ThemeRoot from '@/components/ThemeRoot'",
    '',
    `export default function ${pageFn}() {`,
    '  return (',
    '    <ThemeRoot>',
    '      <Shell />',
    '    </ThemeRoot>',
    '  )',
    '}',
    '',
  ].join('\n')
  const config = [
    'export default definePageConfig({',
    `  navigationBarTitleText: ${JSON.stringify(title)},`,
    '})',
    '',
  ].join('\n')
  return { page, config, pageRel: `apps/miniapp-taro/src/${route}/index.tsx`, configRel: `apps/miniapp-taro/src/${route}/index.config.ts` }
}

/** 工作树副本是否有"不在 HEAD"的行(他席在飞)。有 ⇒ 绝不整文件回写配置。 */
export function worktreeDiverges(headText, workText) {
  const headSet = new Set(String(headText).split('\n').filter((l) => l.trim() !== ''))
  return String(workText)
    .split('\n')
    .filter((l) => l.trim() !== '')
    .some((l) => !headSet.has(l))
}

function selfTest() {
  const cases = []
  const push = (n, ok) => cases.push([n, ok])
  const a = parseShellExport('export function ActivityScreen() { return null }')
  push('无参命名导出', a.ok && a.name === 'ActivityScreen' && a.exportKind === 'named')
  const b = parseShellExport('export function XScreen({ t, items }: Props) { return null }')
  push('必填 props ⇒ 拒并点名', !b.ok && b.props.includes('t') && b.props.includes('items'))
  const c = parseShellExport('export function YScreen({ t = {} }: Props) { return null }')
  push('props 默认空对象 ⇒ 可零参', c.ok)
  const d = parseShellExport('export default function Z() { return null }')
  push('默认导出', d.ok && d.exportKind === 'default')
  const e = parseShellExport('const x = 1')
  push('解析不到 ⇒ 拒', !e.ok)
  const f = buildPageFiles({ screenName: 'MoreCourseScreen', route: 'pkg-learn/more-course', title: '更多课程', exportKind: 'named' })
  push('页面含命名导入与 ThemeRoot', f.page.includes("import { MoreCourseScreen as Shell } from '@rn-shells/MoreCourseScreen'") && f.page.includes('<ThemeRoot>'))
  push('配置带标题', f.config.includes('"更多课程"'))
  push('页面函数名去 Screen 后缀', f.page.includes('export default function MoreCoursePage('))
  const L = (...xs) => xs.join('\n')
  push('他席在飞行 ⇒ 判分叉', worktreeDiverges(L('a', 'b'), L('a', 'b', 'c')) === true)
  push('同基线 ⇒ 不分叉', worktreeDiverges(L('a', 'b'), L('b', 'a')) === false)
  const failed = cases.filter(([, ok]) => !ok)
  for (const [n, ok] of cases) console.log(`  ${ok ? '✓' : '✗'} ${n}`)
  return { pass: cases.length - failed.length, total: cases.length }
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    const r = selfTest()
    console.log(`[self-test] ${r.pass}/${r.total}`)
    process.exit(r.pass === r.total ? 0 : 1)
  }
  const get = (k) => argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3)
  const screen = get('screen')
  const route = get('route')
  const title = get('title')
  const apply = argv.includes('--apply')
  const json = argv.includes('--json')
  if (!screen || !route || !title) {
    console.error('用法: node scripts/gen-rn-shell-page.mjs --screen=<Name>Screen --route=<pkg-x/y> --title=<标题> [--apply] [--json]')
    process.exit(2)
  }
  const screenName = screen.replace(/\.tsx$/, '').split(/[\\/]/).pop()
  const shellRel = `${SCREENS}/${screenName}.tsx`
  const shellText = faceText(shellRel)
  if (shellText === null) {
    console.error(`❌ 未判定:HEAD 面取不到壳 ${shellRel}`)
    process.exit(2)
  }
  const parsed = parseShellExport(shellText)
  if (!parsed.ok) {
    console.error(`❌ 未判定:${parsed.why}`)
    process.exit(2)
  }
  const files = buildPageFiles({ screenName, route, title, exportKind: parsed.exportKind })
  if (existsSync(join(ROOT, files.pageRel))) {
    console.error(`❌ 拒绝:页面已存在 ${files.pageRel}(不覆盖他席/既有实现)`)
    process.exit(1)
  }
  const cfgHead = faceText(MP_CONFIG)
  if (cfgHead === null) {
    console.error('❌ 未判定:HEAD 面取不到 app.config.ts')
    process.exit(2)
  }
  const [pkgRoot, ...rest] = route.split('/')
  const pageName = `${rest.join('/')}/index`
  const ins = insertConfigPage(cfgHead, pkgRoot, pageName)
  if (!ins.ok) {
    console.error(`❌ ${ins.skipped ? '拒绝' : '未判定'}:${ins.why}`)
    process.exit(ins.skipped ? 1 : 2)
  }
  const report = {
    screen: screenName,
    shell: shellRel,
    exportKind: parsed.exportKind,
    page: files.pageRel,
    config: files.configRel,
    route: `${pkgRoot}/${pageName}`,
    insertedLine: ins.insertedLine,
    applied: false,
  }
  const emitArg = get('emit-config')
  if (emitArg) {
    writeFileSync(join(ROOT, emitArg), ins.text, 'utf8')
    console.error(`↪ 已写出 HEAD+插入 的配置文本:${emitArg}(供对象空间落地,不碰工作树)`)
  }
  if (apply) {
    const pageAbs = join(ROOT, files.pageRel)
    mkdirSync(dirname(pageAbs), { recursive: true })
    writeFileSync(pageAbs, files.page, 'utf8')
    writeFileSync(join(ROOT, files.configRel), files.config, 'utf8')
    // 配置写回的最后一道护栏:工作树有他席未入库行 ⇒ 只写页面,不整文件回写配置。
    let workCfg = null
    try {
      workCfg = readFileSync(join(ROOT, MP_CONFIG), 'utf8')
    } catch {
      workCfg = null
    }
    if (workCfg === null || worktreeDiverges(cfgHead, workCfg)) {
      report.configSkipped = '工作树 app.config 有他席在飞的行(或读不到)⇒ 路由插入留提交时落地'
      console.error(`⚠️ ${report.configSkipped}`)
    } else {
      writeFileSync(join(ROOT, MP_CONFIG), ins.text, 'utf8')
      report.configWritten = true
    }
    // 新页必须带溯源水印(§5c);生成器 writeFileSync 后紧随注入。
    try {
      execFileSync(process.execPath, [join(ROOT, 'scripts', 'watermark.mjs'), 'inject', files.pageRel], {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        timeout: 60_000,
      })
    } catch (e) {
      console.error(`⚠️ 水印注入失败(页面已写,需人工补):${String(e?.message ?? e).slice(0, 120)}`)
    }
    report.applied = true
  }
  if (json) console.log(JSON.stringify(report, null, 1))
  else {
    console.log(`${apply ? '✅ 已生成' : '📝 预演(加 --apply 落地)'}`)
    console.log(`  壳:${shellRel}(${parsed.exportKind} 导出,零必填 props)`)
    console.log(`  页:${files.pageRel}`)
    console.log(`  配置:${files.configRel}`)
    console.log(`  路由插入:${ins.insertedLine}`)
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  }
}

export const __test__ = { parseShellExport, buildPageFiles, worktreeDiverges, selfTest }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
