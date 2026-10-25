// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CarteScreen 的「跨端单一真相源」自证(§17:UI 改动不能只凭代码审查)。
 *
 * 这一屏此前有三份实现(RN 端自带一份、共享层一份、小程序端一份)而彼此不同形,
 * 本套件把能机判的两件事钉住,第三件(迁移门判据)由门体镜像测试对 HEAD 全屏承担:
 *  ① RN 那一屏渲染的**就是**共享层 packages/app/src/features/carte/CarteScreen.tsx
 *     —— 替身按既有纪律转发真身,卡片的 testID 只住在共享屏,壳里没有;
 *  ② 上屏段落的构成与顺序 = 跨端单一源 `CARTE_SEGMENTS`(RN 与小程序读同一张表),
 *     两端按表出段即同形,漂一段/换一次序当场判红;
 *  ③ 迁移门(守门 check-rn-app-migration)的判据由门体镜像测试
 *     scripts/tests/check-rn-app-migration.test.mjs T3 对 HEAD 全屏承担(§22c 同源 import 门体,
 *     不复制判据);本文件不再越层 import repo-tooling —— 端内测试相对路径穿透 scripts/ 命中
 *     架构政策 D1/D2(原票两禁:不得塞表例外、不得行内 arch-exempt),按屏断言与 T3 是重复覆盖。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, cleanup } from '@testing-library/react'
import { messages, getValueByPath, I18nProvider, type Locale } from '../src/i18n'
import { CARTE_I18N_KEYS, CARTE_SEGMENTS } from '@ihui/shared/constants'

const HERE = dirname(fileURLToPath(import.meta.url))

const nav = vi.hoisted(() => ({
  goBack: vi.fn(),
  navigate: vi.fn(),
  setOptions: vi.fn(),
  addListener: vi.fn(() => ({ remove() {} })),
  isFocused: () => true,
}))

vi.mock('@react-navigation/native', () => ({ useNavigation: () => nav }))
vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light', theme: 'system', setTheme: vi.fn() }),
}))

// 图标素材不是本页判据;替掉以免 lucide 的 RN 依赖把套件拖进收集期失败。
// 名单须覆盖共享屏 + BackChevron 两处 import,漏一枚即运行时 export 缺失。
vi.mock('lucide-react-native', () => {
  const icon = (name: string) => {
    const MockIcon = () => createElement('i', { 'data-icon': name })
    MockIcon.displayName = `MockIcon(${name})`
    return MockIcon
  }
  return { Users: icon('users'), ChevronLeft: icon('chevron-left') }
})

import CarteScreen from '../src/screens/CarteScreen'

const shellText = readFileSync(resolve(HERE, '../src/screens/CarteScreen.tsx'), 'utf8')
const sharedText = readFileSync(
  resolve(HERE, '../../../packages/app/src/features/carte/CarteScreen.tsx'),
  'utf8',
)

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as Locale[]
const zh = messages['zh-CN'] as Record<string, unknown>
const val = (key: string) => getValueByPath(zh, key) as string

/** 壳本身不含 Provider(真机由 App.tsx 挂),渲染必须包一层 —— 包的是真的取词实现,不是替身 */
const renderScreen = () => render(createElement(I18nProvider, null, createElement(CarteScreen)))

/** 单调不减判定(undefined 兜成 +∞,避免把 noUncheckedIndexedAccess 逼成断言) */
const monotonic = (xs: number[]) =>
  xs.every((p, i) => i === 0 || (xs[i - 1] ?? Number.POSITIVE_INFINITY) <= p)

describe('CarteScreen 渲染的是共享层那一份', () => {
  beforeEach(() => {
    cleanup()
    nav.goBack.mockClear()
  })

  it('卡片容器由共享屏的 testID 画出,而 RN 壳不含这个标识', () => {
    const { container } = renderScreen()
    // react-native 替身把未知 prop 原样落 DOM(RN 的 testID 属性)⇒ 按属性名检索,
    // 而不是 RTL 的 data-testid 约定(那是 web 侧的默认值)。
    expect(container.querySelector('[testid="carte-promo-card"]')).not.toBeNull()
    // 阳性对照:同一把尺子问一枚不存在的标识必须取不到(否则上一条断言是恒真的)
    expect(container.querySelector('[testid="__no_such_card__"]')).toBeNull()
    expect(sharedText).toContain('carte-promo-card')
    expect(shellText).not.toContain('carte-promo-card')
  })

  it('壳里没有第二份样式表 —— 版式只住在共享屏', () => {
    expect(shellText).not.toMatch(/StyleSheet\.create/)
    expect(sharedText).toMatch(/StyleSheet\.create/)
  })
})

describe('段落构成与取词键与小程序端同源', () => {
  it('上屏顺序 = CARTE_SEGMENTS 表内 textKeys 展平顺序', () => {
    const { container } = renderScreen()
    const text = container.textContent ?? ''
    const ordered = CARTE_SEGMENTS.flatMap((seg) => [...seg.textKeys])
    expect(ordered.length).toBe(4)
    const positions = ordered.map((key) => text.indexOf(val(key)))
    for (const [i, p] of positions.entries()) {
      expect(p, `${ordered[i]} 未上屏`).toBeGreaterThanOrEqual(0)
    }
    expect(monotonic(positions), '段落顺序与跨端单一源不一致').toBe(true)
    // 阳性对照:把期望顺序倒过来,同一把尺子必须判不成立
    const reversed = [...ordered].reverse().map((key) => text.indexOf(val(key)))
    expect(monotonic(reversed)).toBe(false)
  })

  it('五枚取词键全部以真文案上屏,且没有裸键名漏出', () => {
    const { container } = renderScreen()
    const keys = Object.values(CARTE_I18N_KEYS)
    for (const key of keys) {
      expect(screen.queryByText(val(key)), `${key} 未上屏`).not.toBeNull()
    }
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\bcarte\.[A-Za-z][\w.]*/)
    // 阳性对照:同一把尺子喂一个真键名必须判红
    const probe = render(createElement('span', null, 'carte.title'), {
      container: document.createElement('div'),
    })
    expect(probe.container.textContent).toMatch(/\bcarte\.[A-Za-z][\w.]*/)
  })

  it.each(LOCALES)('%s:carte 五键取到非空文案且不落成形', (locale) => {
    const pack = messages[locale] as Record<string, unknown>
    for (const key of Object.values(CARTE_I18N_KEYS)) {
      const v = getValueByPath(pack, key)
      expect(typeof v, `${locale}.${key} 缺失`).toBe('string')
      expect((v as string).trim(), `${locale}.${key} 空值`).not.toBe('')
      expect(v, `${locale}.${key} 落成了键名`).not.toBe(key)
    }
  })

  it('阳性对照:同一把尺子问一张不存在的段落 id 必须枚举到 0 段', () => {
    const probe: string = '__no_such_segment__'
    expect(CARTE_SEGMENTS.filter((seg) => (seg.id as string) === probe)).toHaveLength(0)
    expect(CARTE_SEGMENTS.length).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
