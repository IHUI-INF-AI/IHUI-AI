#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-miniapp-build-artifacts.mjs — weapp 构建产物的"入口完整性 + 资源引用存在性"对账(G-933 可自动化面, 2026-10-23 立)。
 *
 * 为什么存在:本机没有微信开发者工具与真机,"加载态"验证此前只能等人。但加载失败里有一整类
 * **结构上可在构建后当场判死**的形态 —— app.json 登记了页面而产物里没有对应 .js/.wxml、
 * tabBar 图标路径落空、入口三件套缺件 —— 微信开发者工具"加载项目"第一步炸的就是这些。
 * 本器把这一类从"等人打开工具"前移成"构建产物对账",编译过 + 本器绿 ⇒ 加载态的结构面已证。
 * 真机渲染/交互(像素、手势、登录态)不在射程,仍归人工清单。
 *
 * 判据(纯结构,不读源码、不跑 taro):
 *   A1 入口三件套:app.js / app.json / app.wxss 在位(app.json 不在或解析不出 ⇒ undetermined,
 *      因为页面清单无从枚举 —— "量不到"不得被读成"通过",与 safe-gc 同一纪律)。
 *   A2 pages[]:每枚页面必须有同名 .js 与 .wxml(.wxss 刻意不强制 —— 无局部样式的页面本就不产)。
 *   A3 subpackages / subPackages(两种拼法都认):root 拼接后同 A2 判据。
 *   A4 tabBar.list[]:pagePath 同 A2;iconPath / selectedIconPath 给了就必须是存在的文件。
 *
 * 用法:
 *   node scripts/check-miniapp-build-artifacts.mjs                 # 默认对账 apps/miniapp-taro/dist
 *   node scripts/check-miniapp-build-artifacts.mjs --dist <dir>    # 指定产物目录(CI 里可指向别处)
 *   node scripts/check-miniapp-build-artifacts.mjs --self-test     # 纯夹具自检(不读真实 dist、不写工作树)
 * 退出码:0 = 绿;1 = 红(逐条点名缺失);2 = 未判定(dist 不在 / app.json 缺失或解析不出 / --dist 缺参)。
 * 自检退出码:0 = 全部用例通过;1 = 有用例失败(取不到结论同样记失败,见 selftest-registrant)。
 */
/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SELF_TEST_FLAG = '--self-test'

/** 在 dir 下按相对路径找文件;返回缺失的扩展名列表(空 = 全在)。 */
function missingPageFiles(dir, relPage) {
  const miss = []
  for (const ext of ['.js', '.wxml']) {
    if (!existsSync(join(dir, `${relPage}${ext}`))) miss.push(ext)
  }
  return miss
}

/**
 * 纯函数判据:对 distDir 做结构对账,返回 { status, findings, undetermined_reason }。
 * status: 'green' | 'red' | 'undetermined'。findings 逐条带 code(A1–A4)与 detail。
 */
export function inspectWeappDist(distDir) {
  const findings = []
  if (!existsSync(distDir)) {
    return { status: 'undetermined', findings, undetermined_reason: `产物目录不存在: ${distDir}` }
  }
  const appJsonPath = join(distDir, 'app.json')
  if (!existsSync(appJsonPath)) {
    return { status: 'undetermined', findings, undetermined_reason: 'app.json 不在产物目录(页面清单无从枚举)' }
  }
  let app
  try {
    app = JSON.parse(readFileSync(appJsonPath, 'utf8'))
  } catch (e) {
    return { status: 'undetermined', findings, undetermined_reason: `app.json 解析不出: ${e.message}` }
  }

  // A1 入口三件套(app.json 已在上面判过)
  for (const entry of ['app.js', 'app.wxss']) {
    if (!existsSync(join(distDir, entry))) findings.push({ code: 'A1', detail: `入口缺件: ${entry}` })
  }

  // A2 主包页面
  const pages = Array.isArray(app.pages) ? app.pages : []
  if (pages.length === 0) findings.push({ code: 'A2', detail: 'app.json 的 pages 为空数组(正常构建不会如此)' })
  for (const p of pages) {
    const miss = missingPageFiles(distDir, p)
    if (miss.length) findings.push({ code: 'A2', detail: `页面 ${p} 缺 ${miss.join('/')}` })
  }

  // A3 分包(两种拼法都认)
  const subpkgs = app.subpackages || app.subPackages || []
  for (const sp of subpkgs) {
    const root = String(sp.root || '').replace(/\/+$/, '')
    for (const p of sp.pages || []) {
      const rel = `${root}/${p}`
      const miss = missingPageFiles(distDir, rel)
      if (miss.length) findings.push({ code: 'A3', detail: `分包页面 ${rel} 缺 ${miss.join('/')}` })
    }
  }

  // A4 tabBar
  const list = app.tabBar && Array.isArray(app.tabBar.list) ? app.tabBar.list : []
  for (const item of list) {
    if (item.pagePath) {
      const miss = missingPageFiles(distDir, item.pagePath)
      if (miss.length) findings.push({ code: 'A4', detail: `tabBar 页面 ${item.pagePath} 缺 ${miss.join('/')}` })
    }
    for (const key of ['iconPath', 'selectedIconPath']) {
      if (item[key] && !existsSync(join(distDir, item[key]))) {
        findings.push({ code: 'A4', detail: `tabBar ${key} 引用落空: ${item[key]}` })
      }
    }
  }

  return { status: findings.length > 0 ? 'red' : 'green', findings, undetermined_reason: null }
}

/** 默认对账面 = 仓内 apps/miniapp-taro/dist;是否真的存在由 inspectWeappDist 落 undetermined。 */
export function defaultDistDir() {
  return join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'apps', 'miniapp-taro', 'dist')
}

/**
 * 纯函数:CLI 参数分派。
 *
 * `--self-test` 必须**先于** `--dist` 解析:此前该旗标被静默忽略,自检请求会按默认 dist
 * 跑出 rc=2("未判定")—— 读起来像"本机没构建",实际是守门自己没接线,属静默失效(§12f)。
 *
 * @returns {{mode:'self-test'} | {mode:'check', distDir:string|null, error:string|null}}
 */
export function parseCli(argv) {
  if (argv.includes(SELF_TEST_FLAG)) return { mode: 'self-test' }
  const i = argv.indexOf('--dist')
  if (i < 0) return { mode: 'check', distDir: defaultDistDir(), error: null }
  const value = argv[i + 1]
  if (!value || value.startsWith('--')) {
    // 取不到输入 ⇒ 显式未判定,绝不回落默认 dist(§0.3:不记绿也不冒红)。
    return { mode: 'check', distDir: null, error: '--dist 缺一个目录参数(取不到输入 ⇒ 未判定)' }
  }
  return { mode: 'check', distDir: resolve(value), error: null }
}

/** 一次对账 ⇒ { code, lines }(自检据此断言 0/1/2 三档,不必派生进程)。 */
export function runCli(argv) {
  const spec = parseCli(argv)
  if (spec.error) return { code: 2, lines: [`⚠️ 未判定: ${spec.error}`] }
  const r = inspectWeappDist(spec.distDir)
  if (r.status === 'undetermined') return { code: 2, lines: [`⚠️ 未判定: ${r.undetermined_reason}`] }
  if (r.status === 'green') {
    return { code: 0, lines: [`✅ weapp 产物对账通过(${spec.distDir}):入口/页面/分包/tabBar 引用全部在位`] }
  }
  return {
    code: 1,
    lines: [
      ...r.findings.map((f) => `❌ [${f.code}] ${f.detail}`),
      `❌ weapp 产物对账失败:${r.findings.length} 条(目录 ${spec.distDir})`,
    ],
  }
}

/**
 * --self-test:纯夹具自检,覆盖正例 / 反例 / 取不到输入三档 + 退出码映射 + 旗标分派。
 *
 * 夹具落点走 `scripts/lib/scratch-dir.mjs` 的 mkScratch(§15b:禁 os.tmpdir、禁裸 mkdtempSync),
 * 且写盘动作只出现在本函数体内(镜像测试有源码锁)。全程不碰工作树、不依赖仓内真实 dist ——
 * 自检不得成为"本机构建过没有"的函数:没构建的机器上,它仍要能证明判据有牙。
 */
async function selfTestRun() {
  const { mkdirSync, writeFileSync } = await import('node:fs')
  const { mkScratch, rmScratch } = await import('./lib/scratch-dir.mjs')
  const { makeRegistrar } = await import('./lib/selftest-registrant.mjs')
  const root = mkScratch('weapp-dist-selftest-')
  const { t, report } = makeRegistrar()
  /** 在 scratch root 下造一枚产物目录;返回其绝对路径。 */
  const put = (name, files) => {
    const dir = join(root, name)
    mkdirSync(dir, { recursive: true })
    for (const [rel, content] of Object.entries(files)) {
      const abs = join(dir, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, content ?? '')
    }
    return dir
  }
  const APP_JSON = JSON.stringify({
    pages: ['pages/index/index', 'pages/user/index'],
    // root 带尾斜杠:真实产物里两种形态都出现过,拼路径必须归一
    subpackages: [{ root: 'pkg-ai/', pages: ['ai/chat'] }],
    tabBar: {
      list: [
        { pagePath: 'pages/index/index', iconPath: 'assets/tab/home.png', selectedIconPath: 'assets/tab/home-on.png' },
        { pagePath: 'pages/user/index' },
      ],
    },
  })
  const goodFiles = (extra = {}) => ({
    'app.js': '',
    'app.wxss': '',
    'app.json': APP_JSON,
    'pages/index/index.js': '',
    'pages/index/index.wxml': '',
    'pages/user/index.js': '',
    'pages/user/index.wxml': '',
    'pkg-ai/ai/chat.js': '',
    'pkg-ai/ai/chat.wxml': '',
    'assets/tab/home.png': '',
    'assets/tab/home-on.png': '',
    ...extra,
  })
  try {
    t('1 正例:入口/主包/分包(root 带尾斜杠)/tabBar 引用全在位 ⇒ green 且零 findings', () => {
      const r = inspectWeappDist(put('good', goodFiles()))
      return r.status === 'green' && r.findings.length === 0
    })

    t('2 A1 反例:缺 app.js ⇒ red 且点名入口缺件', () => {
      const f = goodFiles()
      delete f['app.js']
      const r = inspectWeappDist(put('no-app-js', f))
      return r.status === 'red' && r.findings.some((x) => x.code === 'A1' && x.detail.includes('app.js'))
    })

    t('3 A1 反例:缺 app.wxss ⇒ red', () => {
      const f = goodFiles()
      delete f['app.wxss']
      const r = inspectWeappDist(put('no-app-wxss', f))
      return r.status === 'red' && r.findings.some((x) => x.code === 'A1' && x.detail.includes('app.wxss'))
    })

    t('4 A2 反例:拆掉一枚页面的 .wxml ⇒ red 且点名页面与扩展名', () => {
      const f = goodFiles()
      delete f['pages/user/index.wxml']
      const r = inspectWeappDist(put('no-user-wxml', f))
      return (
        r.status === 'red' &&
        r.findings.some((x) => x.code === 'A2' && x.detail.includes('pages/user/index') && x.detail.includes('.wxml'))
      )
    })

    t('5 A2 反例:pages 为空数组 ⇒ red(空清单不得读成"没有页面要查"⇒绿)', () => {
      const r = inspectWeappDist(
        put('empty-pages', { 'app.js': '', 'app.wxss': '', 'app.json': JSON.stringify({ pages: [] }) }),
      )
      return r.status === 'red' && r.findings.some((x) => x.code === 'A2' && x.detail.includes('空数组'))
    })

    t('6 A3 反例:分包缺 .js ⇒ red 且 detail 带 root 拼接后的路径', () => {
      const f = goodFiles()
      delete f['pkg-ai/ai/chat.js']
      const r = inspectWeappDist(put('no-sub-js', f))
      return r.status === 'red' && r.findings.some((x) => x.code === 'A3' && x.detail.includes('pkg-ai/ai/chat'))
    })

    t('7 A3 拼法:大写 subPackages 同样被枚举(缺件 ⇒ red 点名 pkg-x/a/b)', () => {
      const appJson = JSON.stringify({ pages: ['pages/index/index'], subPackages: [{ root: 'pkg-x', pages: ['a/b'] }] })
      const r = inspectWeappDist(
        put('sub-upper', {
          'app.js': '',
          'app.wxss': '',
          'app.json': appJson,
          'pages/index/index.js': '',
          'pages/index/index.wxml': '',
        }),
      )
      return r.status === 'red' && r.findings.some((x) => x.code === 'A3' && x.detail.includes('pkg-x/a/b'))
    })

    t('8 A4 反例:tabBar iconPath 引用落空 ⇒ red', () => {
      const f = goodFiles()
      delete f['assets/tab/home.png']
      const r = inspectWeappDist(put('no-icon', f))
      return r.status === 'red' && r.findings.some((x) => x.code === 'A4' && x.detail.includes('home.png'))
    })

    t('9 A4 反例:tabBar pagePath 指向不存在的页面 ⇒ red(独立于 A2:该页不在 pages[])', () => {
      const appJson = JSON.stringify({
        pages: ['pages/index/index'],
        tabBar: { list: [{ pagePath: 'pages/index/index' }, { pagePath: 'pages/extra/index' }] },
      })
      const r = inspectWeappDist(
        put('bad-tab-page', {
          'app.js': '',
          'app.wxss': '',
          'app.json': appJson,
          'pages/index/index.js': '',
          'pages/index/index.wxml': '',
        }),
      )
      return (
        r.status === 'red' &&
        r.findings.some((x) => x.code === 'A4' && x.detail.includes('pages/extra/index')) &&
        !r.findings.some((x) => x.code === 'A2')
      )
    })

    t('10 未判定:app.json 缺失 ⇒ undetermined 且 reason 非空(不得读成通过)', () => {
      const r = inspectWeappDist(put('no-app-json', { 'app.js': '', 'app.wxss': '' }))
      return r.status === 'undetermined' && typeof r.undetermined_reason === 'string' && r.undetermined_reason.length > 0
    })

    t('11 未判定:app.json 是坏 JSON ⇒ undetermined 且点名解析不出', () => {
      const r = inspectWeappDist(put('bad-json', { 'app.js': '', 'app.wxss': '', 'app.json': '{oops' }))
      return r.status === 'undetermined' && String(r.undetermined_reason).includes('解析不出')
    })

    t('12 未判定:产物目录不存在 ⇒ undetermined 且点名不存在', () => {
      const r = inspectWeappDist(join(root, 'no-such-dist'))
      return r.status === 'undetermined' && String(r.undetermined_reason).includes('不存在')
    })

    t('13 退出码映射:绿 ⇒ 0', () => runCli(['--dist', put('rc-green', goodFiles())]).code === 0)

    t('14 退出码映射:红 ⇒ 1 且末行是失败汇总', () => {
      const f = goodFiles()
      delete f['app.wxss']
      const out = runCli(['--dist', put('rc-red', f)])
      return out.code === 1 && out.lines.length > 1 && out.lines[out.lines.length - 1].includes('对账失败')
    })

    t('15 退出码映射:未判定 ⇒ 2 且首行显式"未判定"(不记绿也不冒红)', () => {
      const out = runCli(['--dist', join(root, 'no-such-dist-for-rc')])
      return out.code === 2 && out.lines[0].includes('未判定')
    })

    t('16 取不到输入:--dist 缺参数 ⇒ 2 且显式未判定,不回落默认 dist', () => {
      const out = runCli(['--dist'])
      return out.code === 2 && out.lines[0].includes('未判定') && out.lines[0].includes('--dist')
    })

    t('17 S1 --self-test 先于 --dist 解析(旗标不得被静默忽略)', () => {
      const spec = parseCli(['--dist', root, SELF_TEST_FLAG])
      return spec.mode === 'self-test' && spec.distDir === undefined
    })

    t('18 默认面推导:缺 --dist 时指向 apps/miniapp-taro/dist(只判路径形态,不读写)', () => {
      const spec = parseCli([])
      return (
        spec.mode === 'check' &&
        spec.error === null &&
        String(spec.distDir).endsWith(join('apps', 'miniapp-taro', 'dist'))
      )
    })

    const { fail, cases } = report()
    for (const r of cases) console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.pass ? '' : ` —— 实得:${r.got}`}`)
    console.log(
      fail
        ? `self-test FAILED ${fail}/${cases.length}`
        : `✅ check-miniapp-build-artifacts self-test 全部通过(${cases.length} 例)`,
    )
    return fail ? 1 : 0
  } finally {
    // 清理失败不得改写结论(判据的红要留在断言里):bestEffort 只告警不抛。
    rmScratch(root, { bestEffort: true })
  }
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes(SELF_TEST_FLAG)) return selfTestRun()
  const { code, lines } = runCli(argv)
  if (lines.length) console.log(lines.join('\n'))
  return code
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => {
      if (code) process.exit(code)
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  inspectWeappDist,
  missingPageFiles,
  parseCli,
  runCli,
  defaultDistDir,
  SELF_TEST_FLAG,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
