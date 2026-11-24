// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EcosystemHub } from '../ecosystem-hub'

// 与 web 端既有组件测试同一约定:结构走 DOM,文案一律走 key;
// 真实文案由下面「读五份词包」那组用例守 —— 那组才是防"造好没装车/键名直出界面"的牙齿。
vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => 'zh-CN',
}))

/**
 * 取数层走 @ihui/api-client(§3 禁止端内裸 fetch),所以这里桩的是**端点出口**而不是 fetch。
 * `mode:'failed'` 那一档专用于反向对照:计数取不到时**不得**渲染成 0。
 */
const api = vi.hoisted(() => ({
  mode: 'ready' as 'ready' | 'failed',
}))

const SKILL = {
  name: '内容引擎',
  description: '写作流水线技能',
  tags: [],
  author: 'ihui',
  version: '1.0.0',
  license: 'Apache-2.0',
  installCount: 7,
  rating: 4.5,
  ratingCount: 3,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

const CONNECTOR = {
  key: 'yuque:kb',
  type: 'yuque',
  name: '产品知识库',
  extra: { user: 'u', repo: 'r' },
  configured: true,
  enabled: true,
  installed_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-02T00:00:00.000Z',
  last_sync_at: '2026-09-03T00:00:00.000Z',
  last_error: '',
  sync_items: [{ doc_id: 'd1', title: '文档一' }],
  capabilities: { doc_list: true, fetch_doc: true },
}

const ok = (data: unknown) => ({ success: true, data })
const fail = { success: false, error: 'offline' }

vi.mock('@ihui/api-client/endpoints/skills-market', () => ({
  fetchMarketSkills: () =>
    api.mode === 'failed'
      ? Promise.resolve(fail)
      : Promise.resolve(ok({ items: [SKILL], total: 12, page: 1, pageSize: 4 })),
}))
vi.mock('@ihui/api-client/endpoints/connectors', () => ({
  getConnectors: () =>
    api.mode === 'failed'
      ? Promise.resolve(fail)
      : Promise.resolve(ok({ connectors: [CONNECTOR], count: 1 })),
}))
vi.mock('@ihui/api-client/endpoints/ai-skills', () => ({
  listAiSkills: () => Promise.resolve(ok([])),
}))
vi.mock('@ihui/api-client/endpoints/mcp', () => ({
  getMcpStore: () => Promise.resolve(ok({ servers: [], count: 0 })),
  getCapabilities: () => Promise.resolve(ok({ items: [], total: 0, page: 1, page_size: 1, categories: [] })),
}))

const LEGACY_HREFS = [
  '/ai-skills',
  '/mcp-store',
  '/capability-market',
  '/skills-market',
  '/connectors',
]

function renderHub() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={qc}>
      <EcosystemHub />
    </QueryClientProvider>,
  )
}

function hrefsOf(container: HTMLElement): string[] {
  return [...container.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '')
}

beforeEach(() => {
  api.mode = 'ready'
})

describe('D17 生态统一入口', () => {
  it('五个并列市场全部渲染,且 href 就是老 URL(收敛入口不得让老地址变死链)', () => {
    const { container } = renderHub()
    const hrefs = hrefsOf(container)
    for (const href of LEGACY_HREFS) {
      expect(
        hrefs.filter((h) => h === href).length,
        `老 URL ${href} 必须至少有一个入口`,
      ).toBeGreaterThan(0)
    }
  })

  it('四个分区齐备:专家包 / 技能市场 / 连接器授权 / 能力市场', () => {
    const { container } = renderHub()
    const ids = [...container.querySelectorAll('section')].map((s) => s.getAttribute('aria-labelledby'))
    expect(ids).toEqual(
      expect.arrayContaining([
        'ecosystem-packs',
        'ecosystem-skills',
        'ecosystem-connectors',
        'ecosystem-markets',
      ]),
    )
    expect(container.querySelectorAll('section').length).toBe(4)
  })

  it('取词全部带 ecosystem 命名空间前缀(不得依赖全局隐式命名空间)', () => {
    const { container } = renderHub()
    const texts = [...container.querySelectorAll('span, h1, h2, p')].map((n) => n.textContent ?? '')
    const used = texts.filter((t) => t.startsWith('ecosystem.'))
    expect(used.length).toBeGreaterThan(15)
    expect(used.every((t) => !t.includes('undefined') && !t.endsWith('.'))).toBe(true)
  })

  it('技能市场条目深链到 /skills-market/<name>(真实详情页,不是列表页的复制品)', async () => {
    const { container } = renderHub()
    await waitFor(() => {
      expect(hrefsOf(container)).toContain(`/skills-market/${encodeURIComponent(SKILL.name)}`)
    })
  })

  it('连接器行深链到 /ecosystem/connectors/<key>,同时保留 /connectors 的管理入口', async () => {
    const { container } = renderHub()
    await waitFor(() => {
      expect(hrefsOf(container)).toContain(
        `/ecosystem/connectors/${encodeURIComponent(CONNECTOR.key)}`,
      )
    })
    expect(hrefsOf(container)).toContain('/connectors')
  })

  it('专家包卡片深链到 /ecosystem/expert-packs/<slug>,slug 集合与注册表一致', () => {
    const { container } = renderHub()
    const packLinks = hrefsOf(container).filter((h) => h.startsWith('/ecosystem/expert-packs/'))
    expect(packLinks.length).toBeGreaterThan(0)
    const registry = readFileSync(join(process.cwd(), 'src/components/ecosystem/expert-packs.ts'), 'utf8')
    for (const link of packLinks) {
      const slug = decodeURIComponent(link.split('/').pop() ?? '')
      expect(registry).toContain(`slug: '${slug}'`)
    }
  })

  it('计数就绪才给数字;取不到时喊"统计暂不可用"而不是把 0 当真值', async () => {
    const { container } = renderHub()
    // skillsMarket 计数来自 total=12
    await waitFor(() => {
      const badge = [...container.querySelectorAll('[data-testid="ecosystem-count"]')]
      expect(badge.some((b) => b.textContent === '12')).toBe(true)
    })

    api.mode = 'failed'
    const failed = renderHub()
    await waitFor(() => {
      const texts = [...failed.container.querySelectorAll('span')].map((n) => n.textContent ?? '')
      expect(texts.filter((x) => x === 'ecosystem.countFailed').length).toBeGreaterThan(0)
    })
    // 反向对照:失败态不得出现"该处显示 0 当作真实计数"的徽章
    expect(
      [...failed.container.querySelectorAll('[data-testid="ecosystem-count"]')].map((n) => n.textContent),
    ).not.toContain('12')
  })

  /**
   * 运行时取证(2026-09-26,D17 §17 自验)抓到的那一型:取数失败时**只有分区头徽章**喊
   * "统计暂不可用",正文那一段渲染的是一个空 `<ul>` —— 用户读到的是"这个市场没有东西",
   * 而不是"取不到"。上面那条只核徽章,所以它对这一格全盲。
   * 判据刻意钉在「取数的那两个分区的尾元素」上:静态分区(专家包/能力市场)尾元素本来就是
   * 非空 `<ul>`,拿整页当判据会假红;ready 档同断言反向取"尾部是非空 ul",防这条被判成恒真。
   */
  const fetchedSection = (container: HTMLElement, id: string): Element | undefined =>
    [...container.querySelectorAll('section')].find((s) => s.querySelector('h2')?.id === id)

  it('取数失败时分区正文不得整段空白:尾部必须是说话的一行,不是空 <ul>', async () => {
    const ready = renderHub()
    await waitFor(() => {
      const s = fetchedSection(ready.container, 'ecosystem-skills')
      expect(s?.lastElementChild?.tagName).toBe('UL')
      expect((s?.lastElementChild?.querySelectorAll('li').length ?? 0)).toBeGreaterThan(0)
    })
    ready.unmount()

    api.mode = 'failed'
    const failed = renderHub()
    await waitFor(() => {
      for (const id of ['ecosystem-skills', 'ecosystem-connectors']) {
        const s = fetchedSection(failed.container, id)
        expect(s, `找不到分区 ${id}`).toBeDefined()
        const tail = s!.lastElementChild
        expect(tail?.tagName, `${id} 尾部仍是 <ul> ⇒ 失败态整段空白`).toBe('P')
        expect(tail?.textContent ?? '', `${id} 尾部没说"取不到"`).toContain('ecosystem.countFailed')
      }
    })
  })

  it('组件被页面真实挂载(文件面装车证明)', () => {
    const page = readFileSync(join(process.cwd(), 'app/(main)/ecosystem/page.tsx'), 'utf8')
    expect(page).toMatch(/import\s*\{\s*EcosystemHub\s*\}\s*from/)
    expect(page).toMatch(/<EcosystemHub\s*\/>/)
    const nav = readFileSync(join(process.cwd(), 'src/components/sidebar/nav-data.ts'), 'utf8')
    expect(nav).toMatch(/href:\s*'\/ecosystem'/)
  })

  it('新建的三个跳转目标页都存在且各自挂载自己的 PageClient(不留死链的判据本身)', () => {
    const routes: string[] = [
      'app/(main)/ecosystem/expert-packs/page.tsx',
      'app/(main)/ecosystem/expert-packs/[slug]/page.tsx',
      'app/(main)/ecosystem/connectors/[key]/page.tsx',
    ]
    for (const rel of routes) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8')
      expect(src, `${rel} 必须挂载客户端`).toMatch(/PageClient/)
      expect(src, `${rel} 必须有 page 默认导出`).toMatch(/export default function Page\(\)/)
      expect(readFileSync(join(process.cwd(), rel.replace('page.tsx', 'PageClient.tsx')), 'utf8')).toMatch(
        /'use client'/,
      )
    }
    // 动态路由在静态导出下必须给 generateStaticParams,否则 next build 直接报错
    for (const rel of routes.slice(1)) {
      expect(readFileSync(join(process.cwd(), rel), 'utf8')).toMatch(/generateStaticParams/)
    }
  })
})

describe('D17 五语词包可达', () => {
  const KEYS = [
    'title',
    'description',
    'marketsSection',
    'bundlesSection',
    'bundlesHint',
    'skillsSection',
    'connectorsSection',
    'connectorsHint',
    'emptySkills',
    'emptyConnectors',
    'connectorAuthDetail',
    'countPending',
    'countFailed',
    'packMembers',
    'expertPackFooterHint',
    'packNotFound',
    'packsListLink',
    'packStepsHint',
    'entrySample',
    'backToEcosystem',
    'connectorNotFound',
    'connectorAuthReadonlyHint',
    'connectorAuthStateTitle',
    'connectorAuthConfigLabel',
    'connectorAuthEnableLabel',
    'installedAt',
    'lastErrorLabel',
    'connectorAuthScopeTitle',
    'capDocList',
    'capFetchDoc',
    'capSupported',
    'capUnsupported',
    'connectorNoDocs',
    'manageConnectors',
    ...['aiSkills', 'mcpStore', 'capabilityMarket', 'skillsMarket', 'connectors'].flatMap((k) => [
      `cards.${k}.title`,
      `cards.${k}.desc`,
    ]),
    ...['contentCreator', 'developerExtension'].flatMap((k) => [
      `bundles.${k}.title`,
      `bundles.${k}.desc`,
    ]),
  ].map((k) => `ecosystem.${k}`)

  const read = (loc: string) =>
    JSON.parse(
      readFileSync(
        join(process.cwd(), '..', '..', 'packages/i18n/messages/web', `${loc}.json`),
        'utf8',
      ),
    )
  const pick = (obj: Record<string, unknown>, path: string) =>
    path
      .split('.')
      .reduce<unknown>(
        (c, k) => (c && typeof c === 'object' ? (c as Record<string, unknown>)[k] : undefined),
        obj,
      )

  for (const loc of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']) {
    it(`${loc}: ${KEYS.length} 个键全部存在且非空、不回显键名`, () => {
      const root = read(loc)
      for (const k of KEYS) {
        const v = pick(root, k)
        expect(typeof v, `${loc} ${k} 缺失`).toBe('string')
        expect((v as string).trim().length, `${loc} ${k} 空值`).toBeGreaterThan(0)
      }
      expect(typeof pick(root, 'nav.ecosystemHub')).toBe('string')
    })
  }

  it('词包里的 ecosystem 键与代码取词一一对应(键加了没人用 = 死键)', () => {
    const used = new Set<string>()
    for (const rel of [
      'src/components/ecosystem/ecosystem-hub.tsx',
      'src/components/ecosystem/count-badge.tsx',
      'app/(main)/ecosystem/expert-packs/PageClient.tsx',
      'app/(main)/ecosystem/expert-packs/[slug]/PageClient.tsx',
      'app/(main)/ecosystem/connectors/[key]/PageClient.tsx',
    ]) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8')
      for (const m of src.matchAll(/\bt\('([A-Za-z0-9_.]+)'/g)) used.add(`ecosystem.${m[1]}`)
    }
    for (const k of KEYS) {
      // cards.* / bundles.* 走动态模板,单独认前缀
      if (/^ecosystem\.(cards|bundles)\./.test(k)) continue
      expect(used.has(k), `${k} 在词包里但没被取用`).toBe(true)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
