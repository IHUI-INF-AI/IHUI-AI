// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试(AGENTS.md §22c):判据一律 import 源脚本的 __test__,本文件零复算。
 * 反向牙:每个夹具都配一对 —— "缺件必命中" 与 "件齐必归零",任一方向失守即翻红;
 * 另钉一条「摘掉判据即翻绿」,证明红来自判据本身而不是文案。
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { __test__ as G, listAppTree, ROOT, runChecks } from '../check-docs-public-health.mjs'

const DEAD_SOURCE = `export const metadata: Metadata = {
  alternates: {
    canonical: '/docs',
    languages: {
      'zh-CN': '/zh-cn/docs',
      'zh-TW': '/zh-tw/docs',
      en: '/en/docs',
      ko: '/ko/docs',
      ja: '/ja/docs',
      'x-default': '/docs',
    },
  },
}`

const MINIMAL_TREE = [
  'apps/web/app/(main)/docs/page.tsx',
  'apps/web/app/(main)/docs/api/page.tsx',
  'apps/web/app/(main)/layout.tsx',
  'apps/web/app/en/page.tsx',
  'apps/web/app/en/docs/page.tsx',
  'apps/web/app/(main)/zh-TW/use-cases/ai-edu/page.tsx',
]

const okDims = { entries: 1, dead: [], alive: [], unparseable: [] }

describe('形状锁:__test__ 必须把判据原语交出来(§22c 禁测试侧第二份)', () => {
  it('导出的判据件齐备', () => {
    for (const key of [
      'parseLanguageBlocks',
      'parseSitemapDocPaths',
      'parseEmojiIcons',
      'buildRouteIndex',
      'routeExists',
      'judgeDocsLanguages',
      'judgeSitemap',
      'judgeEmojiIcons',
      'localeFamilies',
      'localeBuckets',
      'assemble',
      'resolveFace',
    ]) {
      assert.equal(typeof G[key], 'function', `__test__ 缺 ${key} ⇒ 镜像测试只能另写一份判据,违规`)
    }
  })
})

describe('D1 languages 声明解析', () => {
  it('六条声明全解析,收尾的 }, 不得冒充"解析不出"', () => {
    const { declared, unparseable } = G.parseLanguageBlocks(DEAD_SOURCE)
    assert.equal(declared.length, 6, `声明条数应为 6,实得 ${declared.length}`)
    assert.deepEqual(
      declared.map((d) => d.locale),
      ['zh-CN', 'zh-TW', 'en', 'ko', 'ja', 'x-default'],
    )
    assert.equal(unparseable.length, 0, `闭合行被误报为解析不出:${JSON.stringify(unparseable)}`)
    assert.ok(
      declared.every((d) => Number.isInteger(d.line) && d.line > 0),
      '行号必须是正整数(证据锚点)',
    )
  })

  it('模板字符串/非站内路径 ⇒ 点名进 unparseable,不静默吞', () => {
    const src = `  languages: {
    en: \`/en/docs\`,
    ja: \`\${prefix}/docs\`,
    ko: 'https://aizhs.top/ko/docs',
  },`
    const { declared, unparseable } = G.parseLanguageBlocks(src)
    assert.equal(declared.length, 1, '静态可判的只有 en 一条')
    assert.equal(unparseable.length, 2, `两条该点名的没点名:${JSON.stringify(unparseable)}`)
    assert.ok(unparseable.some((u) => u.reason.includes('模板字符串')))
    assert.ok(unparseable.some((u) => u.reason.includes('不是站内路径')))
  })
})

describe('D1 路由可达性(App Router 目录/文件规则,不联网)', () => {
  const idx = G.buildRouteIndex(MINIMAL_TREE)

  it('路由组 (main) 透明、终点须有 page 文件', () => {
    assert.equal(G.routeExists(idx, '/docs').reachable, true, '/docs 应可达(经 (main) 组)')
    assert.equal(G.routeExists(idx, '/docs/api').reachable, true)
    assert.equal(G.routeExists(idx, '/pricing').reachable, false, '清单里没有的路径不得判可达')
    assert.equal(G.routeExists(idx, '/').reachable, false, 'app 根只有 layout 时首页不可达')
  })

  it('动态段与 catch-all 通配', () => {
    const dyn = G.buildRouteIndex([
      ...MINIMAL_TREE,
      'apps/web/app/(main)/docs/[slug]/page.tsx',
      'apps/web/app/(main)/articles/[...rest]/page.tsx',
    ])
    assert.equal(G.routeExists(dyn, '/docs/anything').reachable, true)
    assert.equal(G.routeExists(dyn, '/articles/a/b/c').reachable, true)
  })

  it('URL 段大小写敏感,但近似目录必须点名成 near-miss', () => {
    const r = G.routeExists(idx, '/zh-tw/use-cases/ai-edu')
    assert.equal(r.reachable, false, '小写 zh-tw 不得命中 zh-TW 目录')
    assert.equal(r.nearMiss, 'zh-TW', `near-miss 应点名 zh-TW,实得 ${r.nearMiss}`)
  })
})

describe('D1 反向牙:缺件必命中 / 件齐必归零 / 摘判据必翻绿', () => {
  const idx = G.buildRouteIndex(MINIMAL_TREE)

  it('缺件 ⇒ 4 条死链逐条点名(locale + 断在哪一段)', () => {
    const r = G.judgeDocsLanguages(
      [{ rel: 'apps/web/app/(main)/docs/page.tsx', text: DEAD_SOURCE }],
      idx,
    )
    assert.equal(r.dead.length, 4, `死链应 4,实得 ${r.dead.length}`)
    assert.deepEqual(r.dead.map((d) => d.locale).sort(), ['ja', 'ko', 'zh-CN', 'zh-TW'])
    assert.deepEqual(
      [...G.localeFamilies(r.dead).keys()].sort(),
      ['ja', 'ko', 'zh-CN', 'zh-TW'],
      '语言族聚合必须与死链同源(localeFamilies 直接吃 dead)',
    )
    assert.ok(
      r.dead.every((d) => typeof d.file === 'string' && d.line > 0 && d.brokenAt),
      '每条都得带文件:行 + 断点段',
    )
  })

  it('件齐 ⇒ 同一判据归零(判据不得恒真)', () => {
    const full = G.buildRouteIndex([
      ...MINIMAL_TREE,
      'apps/web/app/(main)/zh-cn/docs/page.tsx',
      'apps/web/app/(main)/zh-tw/docs/page.tsx',
      'apps/web/app/(main)/ko/docs/page.tsx',
      'apps/web/app/(main)/ja/docs/page.tsx',
    ])
    const r = G.judgeDocsLanguages([{ rel: 'x', text: DEAD_SOURCE }], full)
    assert.equal(r.dead.length, 0, `路由齐备仍报 ${r.dead.length} 条 ⇒ 判据过宽`)
    assert.equal(r.alive.length, 6)
  })

  it('摘掉判据即翻绿:红确实由判据产生(§12e 反向锁)', () => {
    const strict = G.judgeDocsLanguages([{ rel: 'x', text: DEAD_SOURCE }], idx)
    assert.ok(strict.dead.length > 0, '夹具本身必须命中,否则反向牙无从谈起')
    const withJudge = G.assemble({ d1: strict, d2: okDims, d3: [] })
    const neutered = G.assemble({ d1: { ...strict, dead: [] }, d2: okDims, d3: [] })
    assert.equal(withJudge.exitCode, G.EXIT.violation, '带判据应 exit 1')
    assert.equal(neutered.exitCode, G.EXIT.clean, '摘掉判据仍红 ⇒ 红与判据脱钩,是假红源')
  })

  it('语言族分档:全灭簇与部分死簇不得混为一谈(§10 话术锁)', () => {
    const idx = G.buildRouteIndex([
      'apps/web/app/(main)/docs/page.tsx',
      'apps/web/app/(main)/docs/api/page.tsx',
      'apps/web/app/en/page.tsx',
      'apps/web/app/en/docs/page.tsx',
      'apps/web/app/(main)/ko/docs/page.tsx',
    ])
    const subSource = `export const metadata = {
  alternates: {
    languages: {
      'zh-CN': '/zh-cn/docs/api',
      'zh-TW': '/zh-tw/docs/api',
      en: '/en/docs/api',
      'x-default': '/docs/api',
    },
  },
}`
    const pages = [
      { rel: 'apps/web/app/(main)/docs/page.tsx', text: DEAD_SOURCE },
      { rel: 'apps/web/app/(main)/docs/api/page.tsx', text: subSource },
    ]
    const j = G.judgeDocsLanguages(pages, idx)
    const b = G.localeBuckets(j)
    assert.ok(
      b.allDead.every((f) => f.dead === f.declared),
      '全灭簇的定义 = 死数==声明数',
    )
    assert.ok(
      b.partial.every((f) => f.dead < f.declared && f.dead > 0),
      '部分死簇必须有死有活',
    )
    // 真仓就是这一型:zh-CN/zh-TW/ja 条条死(全灭簇),en 是 /en/docs 活着、子页死了(部分死簇)
    for (const [locale, declared] of [
      ['zh-CN', 2],
      ['zh-TW', 2],
      ['ja', 1],
    ]) {
      assert.ok(
        b.allDead.some((f) => f.locale === locale && f.dead === declared),
        `${locale} 应进全灭簇 ${declared}/${declared},实得 ${JSON.stringify(b.allDead)}`,
      )
    }
    assert.ok(
      b.partial.some((f) => f.locale === 'en' && f.dead === 1 && f.declared === 2),
      `en 应进部分死簇(1 死 2 声明),实得 ${JSON.stringify(b.partial)}`,
    )
    assert.ok(
      !b.allDead.some((f) => f.locale === 'ko') && !b.partial.some((f) => f.locale === 'ko'),
      'ko 声明的 /ko/docs 有路由文件 ⇒ 两簇都不该出现(判据不得把活链算成死链)',
    )
    const a = G.assemble({ d1: j, d2: okDims, d3: [] })
    assert.deepEqual(
      a.dims.D1.deadLocaleFamilies.map((f) => f.locale).sort(),
      b.allDead.map((f) => f.locale).sort(),
      '结论里的全灭簇清单必须来自 localeBuckets,不得另算一份',
    )
    assert.deepEqual(
      a.dims.D1.partialLocaleFamilies.map((f) => f.locale).sort(),
      b.partial.map((f) => f.locale).sort(),
      '结论里的部分死簇清单必须来自 localeBuckets,不得另算一份',
    )
  })
})

describe('D2 sitemap /docs* 收录对账', () => {
  const src = `const PAGES = [
  { path: '/docs', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/docs/api', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/docs/dead-one', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.9 },
]`

  it('只收射程内条目,死链逐条点名行号', () => {
    const r = G.judgeSitemap(src, G.buildRouteIndex(MINIMAL_TREE))
    assert.equal(r.entries, 3, `/docs* 应 3 条(pricing 不在射程),实得 ${r.entries}`)
    assert.equal(r.dead.length, 1)
    assert.equal(r.dead[0].path, '/docs/dead-one')
    assert.ok(r.dead[0].line > 0 && r.dead[0].brokenAt === 'dead-one')
  })

  it('件齐 ⇒ 0 命中(反向牙配对)', () => {
    const r = G.judgeSitemap(
      src,
      G.buildRouteIndex([...MINIMAL_TREE, 'apps/web/app/(main)/docs/dead-one/page.tsx']),
    )
    assert.equal(r.dead.length, 0)
  })

  it('解析不出任何条目 ⇒ unjudged 而不是 ok', () => {
    const a = G.assemble({
      d1: G.judgeDocsLanguages([{ rel: 'x', text: DEAD_SOURCE }], G.buildRouteIndex(MINIMAL_TREE)),
      d2: G.judgeSitemap('const PAGES = []', G.buildRouteIndex(MINIMAL_TREE)),
      d3: [],
    })
    assert.equal(a.dims.D2.state, 'unjudged')
    assert.equal(a.exitCode, G.EXIT.unjudged, '有一维未判定 ⇒ 顶 exit 2,不记绿')
  })
})

describe('D3 docs 专项 emoji icon', () => {
  it('emoji 字符串命中,组件标识符不得命中(成对夹具防判据过宽)', () => {
    assert.equal(G.judgeEmojiIcons([{ rel: 'a', text: `const x = {\n  icon: '📄',\n}` }]).length, 1)
    assert.equal(
      G.judgeEmojiIcons([{ rel: 'a', text: `const x = {\n  icon: BookOpen,\n}` }]).length,
      0,
    )
    assert.equal(
      G.judgeEmojiIcons([{ rel: 'a', text: `const x = {\n  icon: '文档',\n}` }]).length,
      0,
      '中文非 emoji',
    )
  })

  it('键不在行首也要命中;文档展示用的模板字符串示例不判(成对夹具)', () => {
    // 真配置:`{ icon: '🔒' }` 这种一行内联形态
    assert.equal(G.judgeEmojiIcons([{ rel: 'a', text: `const real = { icon: '🔒' }` }]).length, 1)
    // 展示示例:docs 页把别人的 SDK 用法整段塞进 <pre><code>{`…`}</code></pre>,
    // 那段里的 icon: 是被展示的字面量,不是本页配置 ⇒ 判了就是假红
    const sample = [
      'const page = () => (',
      '  <pre><code>{`',
      'export default defineAgentTemplate({',
      "  icon: '📄',",
      '})',
      '`}</code></pre>',
      ')',
    ].join('\n')
    assert.equal(
      G.judgeEmojiIcons([{ rel: 'a', text: sample }]).length,
      0,
      '展示示例被判成本页配置',
    )
    // 同文件既有示例又有真配置 ⇒ 只点名真配置那一行
    const both = `${sample}\nconst real = { icon: '🔒' }`
    const hits = G.judgeEmojiIcons([{ rel: 'a', text: both }])
    assert.equal(hits.length, 1, `应只命中真配置,实得 ${JSON.stringify(hits)}`)
    assert.equal(hits[0].line, 8, `行号应指向真配置(8),实得 ${hits[0].line}`)
  })

  it('D3 命中 ⇒ violation,且不影响其余维(绝不并桶)', () => {
    const a = G.assemble({
      d1: { dead: [], alive: [], declaredTotal: 6, filesWithDeclaration: [], unparseable: [] },
      d2: okDims,
      d3: [{ file: 'a', line: 1, value: '📄' }],
    })
    assert.equal(a.dims.D3.state, 'violation')
    assert.equal(a.dims.D1.state, 'ok')
    assert.equal(a.exitCode, G.EXIT.violation)
  })
})

describe('三态与取材面(§0.3 / §0.4)', () => {
  it('解析不到任何 languages 声明 ⇒ D1 未判定,既不记绿也不冒红', () => {
    const a = G.assemble({
      d1: G.judgeDocsLanguages(
        [{ rel: 'a', text: 'export const metadata = {}' }],
        G.buildRouteIndex(MINIMAL_TREE),
      ),
      d2: okDims,
      d3: [],
    })
    assert.equal(a.dims.D1.state, 'unjudged')
    assert.match(a.dims.D1.reason, /未判定/)
    assert.equal(a.exitCode, G.EXIT.unjudged)
  })

  it('三维独立:一维 violation 不拖累他维记 ok', () => {
    const a = G.assemble({
      d1: G.judgeDocsLanguages([{ rel: 'x', text: DEAD_SOURCE }], G.buildRouteIndex(MINIMAL_TREE)),
      d2: okDims,
      d3: [],
    })
    assert.equal(a.dims.D1.state, 'violation')
    assert.equal(a.dims.D2.state, 'ok')
    assert.equal(a.dims.D3.state, 'ok')
  })

  it('两面旗同给 ⇒ 面未定义 ⇒ exit 2;单旗与默认面各归其位', () => {
    const both = G.resolveFace(['--staged', '--worktree'])
    assert.equal(both.face, null)
    assert.match(both.error, /不得同给/)
    assert.equal(G.resolveFace(['--staged']).face, 'staged')
    assert.equal(G.resolveFace(['--worktree']).face, 'worktree')
    assert.equal(G.resolveFace([]).face, 'head')
  })
})

describe('真仓自证:读数与路由面必须自洽(数字现读,不写死)', () => {
  // 只判 HEAD 面:工作树是多人共享面(别席正在改 docs),把它锁进单测就是别人头上的恒红门
  // (AGENTS.md §12e;--worktree 只是人工逃生舱)。夹具侧的三形态已由上面的成对夹具覆盖。
  it('head 面:每条结论都能用同一判据复算出来', () => {
    const result = runChecks('head')
    const d1 = result.dims.D1
    const index = G.buildRouteIndex(listAppTree('head', ROOT))
    assert.equal(
      d1.dead.length + d1.aliveCount,
      d1.declaredTotal,
      '死+活必须等于声明总数(并桶/漏计即红)',
    )
    assert.equal(
      d1.declaredTotal === 0,
      d1.state === 'unjudged',
      '枚举到 0 条声明必须判未判定,不得记绿也不得冒红(§0.3)',
    )
    // 逐条复算:同一条声明在同一路由面上只能有一个结论
    for (const it of d1.dead) {
      assert.equal(
        G.routeExists(index, it.path).reachable,
        false,
        `${it.file}:${it.line} 被判死,但复算可达 ⇒ 读数与判据脱钩`,
      )
      assert.ok(it.file.startsWith(G.DOCS_REL), `点名文件必须落在 docs 射程内:${it.file}`)
    }
    for (const it of d1.alive) {
      assert.equal(G.routeExists(index, it.path).reachable, true, `${it.path} 复算不可达`)
    }
    assert.ok(
      ['ok', 'violation', 'unjudged'].includes(result.overall),
      `结论形态越界:${result.overall}`,
    )
    const expectExit = Object.values(result.dims).some((d) => d.state === 'unjudged')
      ? G.EXIT.unjudged
      : Object.values(result.dims).some((d) => d.state === 'violation')
        ? G.EXIT.violation
        : G.EXIT.clean
    assert.equal(result.exitCode, expectExit, 'exit 码必须由三维结论折出,不得另写一套')
    assert.ok(result.meta.docsFiles > 0, '候选清单为空 ⇒ 判死,不得出现在这里')
    assert.ok(result.dims.D2.entries > 0, 'sitemap /docs* 收录条目数必须量得到')
    // 分档读数必须由同一份死链清单折出(全灭簇 + 部分死簇都不许漏点名)
    const named = [...d1.deadLocaleFamilies, ...d1.partialLocaleFamilies].reduce(
      (a, f) => a + f.dead,
      0,
    )
    assert.equal(named, d1.dead.length, '语言族分档的死链总数必须等于逐条点名的死链条数')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
