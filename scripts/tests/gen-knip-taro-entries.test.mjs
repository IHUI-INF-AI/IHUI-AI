// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as gen } from '../gen-knip-taro-entries.mjs'

const {
  parseTaroPages,
  parseRncAliases,
  hasCustomTabBar,
  buildEntries,
  buildPaths,
  currentBlock,
  renderBlock,
  parseKnipRncAliases,
} = gen

const CONFIG = `export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/user/index',
    // 'pages/legacy/commented-out', // 注释掉的不得计入
  ],
  subPackages: [
    {
      root: 'pkg-ai',
      pages: ['ai/chat', 'dev-space'],
    },
    {
      root: 'pkg-user',
      pages: ['fans/index'],
    },
  ],
})
`

describe('gen-knip-taro-entries: app.config.ts → knip entry', () => {
  it('主包 pages 与 subPackages 的 root 前缀都要被解析出来', () => {
    const pages = parseTaroPages(CONFIG)
    assert.deepEqual(pages, [
      'pages/index/index',
      'pages/user/index',
      'pkg-ai/ai/chat',
      'pkg-ai/dev-space',
      'pkg-user/fans/index',
    ])
  })

  it('行注释里的路径不得计入(否则会凭空生成 entry)', () => {
    assert.equal(parseTaroPages(CONFIG).includes('pages/legacy/commented-out'), false)
  })

  it('找不到 pages 数组 ⇒ 返回 null(调用方据此 exit 2 未判定,不回落空清单)', () => {
    assert.equal(parseTaroPages('export default {}'), null)
  })

  it('buildEntries:真实存在的页面才进 entry,解析不到的逐条记进 unresolved', () => {
    // 夹具混一真一假:真页面必须被解析成 entry(证明解析规则没退化成"只认 app.tsx"),
    // 假页面必须进 unresolved(证明取不到文件时不会凭空造 entry)
    const built = buildEntries(`export default {
  pages: ['pages/index/index', '__no_such_page__/x'],
}`)
    assert.ok(built, 'buildEntries 应给出结论')
    assert.ok(built.entries.includes('src/app.tsx'))
    assert.ok(built.entries.includes('src/pages/index/index.tsx'))
    assert.deepEqual(built.unresolved, ['__no_such_page__/x'])
  })

  it('renderBlock/currentBlock 成对:渲染出来的块必须能被原样读回', () => {
    const block = renderBlock(['src/app.tsx', 'src/pages/index/index.tsx'])
    const text = `{\n  "workspaces": {\n${block}\n  }\n}\n`
    assert.equal(currentBlock(text), block)
    assert.match(block, /BEGIN:knip-taro-entries/)
    assert.match(block, /END:knip-taro-entries/)
  })

  it('受管块缺失时 currentBlock 返回 null(不得静默当成"已同步")', () => {
    assert.equal(currentBlock('{"workspaces":{}}'), null)
  })
})

const BUILD_CONFIG = `export default defineConfig({
  alias: {
    '@': path.resolve(__dirname, '..', 'src'),
    'react-native$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'index.ts'),
    'lucide-react-native$': path.resolve(
      __dirname,
      '..',
      'src',
      'rn-compat',
      'icons-generated.tsx',
    ),
    nativewind$: path.resolve(__dirname, '..', 'src', 'rn-compat', 'native-extras'),
    '@ihui/rn-app': path.resolve(__dirname, '..', '..', '..', 'packages', 'app', 'src'),
    // 'expo-blur$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'expo-blur.tsx'),
  },
  webpackChain: (chain) => {
    chain.plugin('rnShellReplacements').use(P, [[
      { base: path.resolve(__dirname, '..', '..', '..', 'apps', 'mobile-rn', 'src', 'i18n'),
        to: path.resolve(__dirname, '..', 'src', 'rn-compat', 'theme.tsx') },
    ]])
  },
})`

describe('gen-knip-taro-entries: config/index.ts → knip paths 别名', () => {
  it('只收 alias 块内指向 rn-compat 的键;替换插件的 to: 落点不得被当成别名', () => {
    const aliases = parseRncAliases(BUILD_CONFIG)
    assert.deepEqual([...aliases.keys()].sort(), [
      'lucide-react-native$',
      'nativewind$',
      'react-native$',
    ])
    assert.equal(aliases.has('to'), false)
  })

  it('不带后缀的 alias 要补成真实文件(native-extras → native-extras.ts)', () => {
    const aliases = parseRncAliases(BUILD_CONFIG)
    assert.equal(aliases.get('nativewind$'), 'src/rn-compat/native-extras')
    assert.deepEqual(buildPaths(aliases)['nativewind$'], ['src/rn-compat/native-extras.ts'])
  })

  it('渲染出的 paths 键集可被 parseKnipRncAliases 原样读回', () => {
    const aliases = parseRncAliases(BUILD_CONFIG)
    const block = renderBlock(['src/app.tsx'], buildPaths(aliases))
    const text = `{\n  "workspaces": {\n${block}\n  }\n}\n`
    assert.deepEqual([...(parseKnipRncAliases(text) ?? new Map()).keys()].sort(), [
      ...aliases.keys(),
    ].sort())
  })

  it('alias 目标文件要进 entry(否则共享层 import 的模块根仍不可达)', () => {
    const built = buildEntries(CONFIG, parseRncAliases(BUILD_CONFIG))
    assert.ok(built.entries.includes('src/rn-compat/index.ts'))
    assert.ok(built.entries.includes('src/rn-compat/native-extras.ts'))
    assert.ok(built.entries.includes('src/rn-compat/icons-generated.tsx'))
    assert.equal(built.customTabBar, false)
  })
})

const CUSTOM_TAB_ON = `export default defineAppConfig({
  pages: ['pages/index/index'],
  tabBar: { custom: true, color: '@tabColor' },
})`
const CUSTOM_TAB_OFF = `export default defineAppConfig({
  pages: ['pages/index/index'],
  tabBar: { custom: false },
})`

describe('gen-knip-taro-entries: tabBar.custom → 约定入口', () => {
  it('custom:true 时按目录约定加入 custom-tab-bar/index.tsx 与 index.config.ts', () => {
    assert.equal(hasCustomTabBar(CUSTOM_TAB_ON), true)
    const built = buildEntries(CUSTOM_TAB_ON)
    assert.equal(built.customTabBar, true)
    assert.ok(built.entries.includes('src/custom-tab-bar/index.tsx'))
    assert.ok(built.entries.includes('src/custom-tab-bar/index.config.ts'))
  })

  it('custom:false 时不得凭空加入约定入口', () => {
    assert.equal(hasCustomTabBar(CUSTOM_TAB_OFF), false)
    const built = buildEntries(CUSTOM_TAB_OFF)
    assert.equal(built.customTabBar, false)
    assert.equal(built.entries.some((e) => e.startsWith('src/custom-tab-bar/')), false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
