// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { EcosystemHub } from '../ecosystem-hub'

// 与 web 端既有组件测试同一约定:结构走 DOM,文案一律走 key;
// 真实文案由下面「读五份词包」那组用例守 —— 那组才是防"造好没装车/键名直出界面"的牙齿。
vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}))

const LEGACY_HREFS = [
  '/ai-skills',
  '/mcp-store',
  '/capability-market',
  '/skills-market',
  '/connectors',
]

describe('D17 生态统一入口', () => {
  it('五个并列市场全部渲染,且 href 就是老 URL(收敛入口不得让老地址变死链)', () => {
    const { container } = render(<EcosystemHub />)
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    for (const href of LEGACY_HREFS) {
      expect(
        hrefs.filter((h) => h === href).length,
        `老 URL ${href} 必须至少有一个入口`,
      ).toBeGreaterThan(0)
    }
    // 卡片 5 张 + 专家包内引用 5 条 + 专家包 2 张内各自引用所含市场
    expect(container.querySelectorAll('section').length).toBe(2)
  })

  it('取词全部带 ecosystem 命名空间前缀(不得依赖全局隐式命名空间)', () => {
    const { container } = render(<EcosystemHub />)
    const texts = [...container.querySelectorAll('span, h1, h2, p')].map((n) => n.textContent ?? '')
    const used = texts.filter((t) => t.startsWith('ecosystem.'))
    expect(used.length).toBeGreaterThan(15)
    expect(used.every((t) => !t.includes('undefined') && !t.endsWith('.'))).toBe(true)
  })

  it('组件被页面真实挂载(文件面装车证明)', () => {
    const page = readFileSync(join(process.cwd(), 'app/(main)/ecosystem/page.tsx'), 'utf8')
    expect(page).toMatch(/import\s*\{\s*EcosystemHub\s*\}\s*from/)
    expect(page).toMatch(/<EcosystemHub\s*\/>/)
    const nav = readFileSync(join(process.cwd(), 'src/components/sidebar/nav-data.ts'), 'utf8')
    expect(nav).toMatch(/href:\s*'\/ecosystem'/)
  })
})

describe('D17 五语词包可达', () => {
  const KEYS = [
    'title',
    'description',
    'marketsSection',
    'bundlesSection',
    'bundlesHint',
    ...['aiSkills', 'mcpStore', 'capabilityMarket', 'skillsMarket', 'connectors'].flatMap((k) => [
      `cards.${k}.title`,
      `cards.${k}.desc`,
    ]),
    ...['contentCreator', 'developerExtension'].flatMap((k) => [
      `bundles.${k}.title`,
      `bundles.${k}.desc`,
    ]),
  ]
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
        const v = pick(root.ecosystem ?? {}, k)
        expect(typeof v, `${loc} ecosystem.${k} 缺失`).toBe('string')
        expect((v as string).trim().length, `${loc} ecosystem.${k} 空值`).toBeGreaterThan(0)
      }
      expect(typeof pick(root.nav ?? {}, 'ecosystemHub')).toBe('string')
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
