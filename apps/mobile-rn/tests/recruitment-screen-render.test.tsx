// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RecruitmentScreen(操盘手计划宣传页)的「跨端单一真相源」自证(§17:UI 改动不能只凭代码审查)。
 *
 * 这一屏此前有三份互不相同的实现:RN 端自带一份静态宣传页、共享层躺着一份**没人渲染的招聘列表屏**、
 * 小程序端又是一份 API 驱动的招募信息页(其 privileges/incomeEstimates 字段与 POST /recruitment/apply
 * 后端都不存在)。本套件把能机判的五件事钉住:
 *  ① RN 那一屏渲染的**就是**共享层 packages/app/src/features/recruitment/RecruitmentScreen.tsx
 *     —— 卡与二维码的 testID 只住在共享屏,壳里与小程序端都没有(阳性对照同批给出);
 *  ② 上屏段落的构成与顺序 = 跨端单一源 TRADER_PLAN_SEGMENTS(RN 与小程序读同一张表);
 *  ③ 六个取词键五语言齐备、取到的是真文案而不是键名;
 *  ④ 购买 CTA 真跳到在册屏 VipTrader,长按二维码真调系统相册保存 —— 两枚都不是假按钮;
 *  ⑤ 迁移门(守门 check-rn-app-migration)对本壳的判据断言(零违规、白名单被摘掉后链子仍有牙、
 *     抹掉 import 必翻 V1 红)住在 `scripts/tests/check-rn-app-migration.test.mjs` T11;端内不 import
 *     门体,以免留下 apps/mobile-rn(rank 40)→ repo-tooling(rank 90) 的反向依赖(门 103 判 D1+D2)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { messages, getValueByPath, I18nProvider, type Locale } from '../src/i18n'
import {
  TRADER_PLAN_PROMO_KEYS,
  TRADER_PLAN_SEGMENTS,
} from '@ihui/shared/constants/trader-plan-promo'

const HERE = dirname(fileURLToPath(import.meta.url))

const nav = vi.hoisted(() => ({
  goBack: vi.fn(),
  navigate: vi.fn(),
  setOptions: vi.fn(),
  addListener: vi.fn(() => ({ remove() {} })),
  isFocused: () => true,
}))
/** 相册能力:壳里「长按二维码 → 存相册」这条链必须量到真的调用,不能只写在注释里 */
const media = vi.hoisted(() => ({
  requestPermissionsAsync: vi.fn(async () => ({ granted: true })),
  createAssetAsync: vi.fn(async (uri: string) => ({ uri })),
  saveToLibraryAsync: vi.fn(async () => {}),
}))
const assetMod = vi.hoisted(() => ({
  fromModule: vi.fn(() => ({
    localUri: 'file://ewm@2x.png',
    uri: 'file://ewm@2x.png',
    downloadAsync: vi.fn(async () => {}),
  })),
}))
const pops = vi.hoisted(() => ({ appAlert: vi.fn() }))

vi.mock('@react-navigation/native', () => ({ useNavigation: () => nav }))
vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light', theme: 'system', setTheme: vi.fn() }),
}))
vi.mock('expo-asset', () => ({ Asset: assetMod }))
vi.mock('expo-media-library', () => media)
vi.mock('../src/components/BottomPops', () => ({ appAlert: pops.appAlert }))

import RecruitmentScreen from '../src/screens/RecruitmentScreen'

const shellText = readFileSync(resolve(HERE, '../src/screens/RecruitmentScreen.tsx'), 'utf8')
const sharedText = readFileSync(
  resolve(HERE, '../../../packages/app/src/features/recruitment/RecruitmentScreen.tsx'),
  'utf8',
)
const miniappText = readFileSync(
  resolve(HERE, '../../miniapp-taro/src/pkg-content/recruitment/index/index.tsx'),
  'utf8',
)

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as Locale[]
const zh = messages['zh-CN'] as Record<string, unknown>
const val = (key: string) => getValueByPath(zh, key) as string

/** 壳本身不含 Provider(真机由 App.tsx 挂),渲染必须包一层 —— 包的是真的取词实现,不是替身 */
const renderScreen = () =>
  render(createElement(I18nProvider, null, createElement(RecruitmentScreen)))

const PROMO_KEYS = Object.values(TRADER_PLAN_PROMO_KEYS)

describe('RecruitmentScreen 渲染的是共享层那一份', () => {
  beforeEach(() => {
    cleanup()
    nav.navigate.mockClear()
    media.saveToLibraryAsync.mockClear()
    pops.appAlert.mockClear()
  })

  it('卡片与二维码容器由共享屏的 testID 画出,壳与小程序端都没有这两个标识', () => {
    const { container } = renderScreen()
    // react-native 替身把未知 prop 原样落 DOM(RN 的 testID 属性)⇒ 按属性名检索
    expect(container.querySelector('[testid="trader-plan-promo-card"]')).not.toBeNull()
    expect(container.querySelector('[testid="trader-plan-qrcode"]')).not.toBeNull()
    // 阳性对照:同一把尺子问一枚不存在的标识必须取不到(否则上一条断言是恒真的)
    expect(container.querySelector('[testid="__no_such_card__"]')).toBeNull()
    expect(sharedText).toContain('trader-plan-promo-card')
    expect(shellText).not.toContain('trader-plan-promo-card')
    expect(miniappText).not.toContain('trader-plan-promo-card')
  })

  it('壳里没有第二份样式表,也没自己拿版面主意', () => {
    expect(shellText).not.toMatch(/StyleSheet\.create/)
    expect(sharedText).toMatch(/StyleSheet\.create/)
    // 段构成/顺序/取词键只住在跨端表里,壳与共享屏都不自立
    expect(shellText).not.toMatch(/heroTitle|founderRow/)
  })

  it('小程序端读同一张跨端表(而不是自己抄一份段构成)', () => {
    expect(miniappText).toContain('constants/trader-plan-promo')
    expect(miniappText).toContain('TRADER_PLAN_SEGMENTS')
    expect(miniappText).toContain('TRADER_PLAN_PROMO_KEYS')
    // 小程序端不出现第二份段名字面量数组(段名只从表里来)
    expect(miniappText).not.toMatch(/=\s*\[\s*'hero',\s*'founder'/)
  })

})

describe('段落顺序与取词键 = 跨端单一源', () => {
  it('上屏顺序 = TRADER_PLAN_SEGMENTS 表内 textKeys 展平顺序', () => {
    const { container } = renderScreen()
    const text = container.textContent ?? ''
    const ordered = TRADER_PLAN_SEGMENTS.flatMap((seg) => [...seg.textKeys])
    expect(ordered).toEqual(PROMO_KEYS)
    const positions = ordered.map((key) => text.indexOf(val(key)))
    expect(
      positions.every((p) => p >= 0),
      `有段落没上屏:${JSON.stringify(positions)}`,
    ).toBe(true)
    expect(
      positions.every((p, i) => i === 0 || positions[i - 1]! < p),
      `段序与表不一致:${JSON.stringify(positions)}`,
    ).toBe(true)
  })

  it('六枚取词键五语言齐备:取到非空字符串,且不等于键名本身', () => {
    for (const locale of LOCALES) {
      const pack = messages[locale] as Record<string, unknown>
      for (const key of PROMO_KEYS) {
        const v = getValueByPath(pack, key)
        expect(typeof v, `${locale}.${key} 缺失`).toBe('string')
        expect((v as string).trim(), `${locale}.${key} 空值`).not.toBe('')
        expect(v, `${locale}.${key} 落成了键名`).not.toBe(key)
      }
    }
  })

  it('阳性对照:同一把尺子问一枚不存在的键必须取不到值', () => {
    for (const locale of LOCALES) {
      expect(
        getValueByPath(messages[locale] as Record<string, unknown>, 'recruitment.__missing__'),
        `${locale} 不该有这个键`,
      ).toBeUndefined()
    }
  })

  it('没有任何裸 i18n 键上屏', () => {
    const { container } = renderScreen()
    const text = container.textContent ?? ''
    const bare = /\b(?:recruitment|carte|vipScreen|vipTrader|imageGen)\.[A-Za-z][\w.]*/
    expect(text).not.toMatch(bare)
    // 阳性对照:喂一个真键名必须判红
    const probe = render(createElement('span', null, 'carte.founder'))
    expect(probe.container.textContent).toMatch(bare)
  })
})

describe('两枚按钮都不是假的:CTA 跳在册屏,二维码长按落相册', () => {
  beforeEach(() => {
    cleanup()
    nav.navigate.mockClear()
    media.saveToLibraryAsync.mockClear()
    pops.appAlert.mockClear()
  })

  it('购买 CTA 跳到本端在册屏 VipTrader(不是提示"联系客服")', () => {
    renderScreen()
    fireEvent.click(screen.getByText(val(TRADER_PLAN_PROMO_KEYS.purchase)))
    expect(nav.navigate).toHaveBeenCalledWith('VipTrader')
  })

  it('长按二维码:走系统相册保存并回执成功文案', async () => {
    renderScreen()
    const qr = screen.getByLabelText(val(TRADER_PLAN_PROMO_KEYS.qrcodeHint))
    fireEvent.contextMenu(qr)
    // 保存链是 async(权限 → 资源 → 写库),必须等它真跑完再判 —— 同步断言判的是"还没轮到"
    await waitFor(() => expect(media.requestPermissionsAsync).toHaveBeenCalled())
    await waitFor(() => expect(media.saveToLibraryAsync, '没真落到相册').toHaveBeenCalled())
    await waitFor(() => expect(pops.appAlert).toHaveBeenCalledWith(val('imageGen.saveSuccess')))
  })

  it('相册权限被拒时不写库、给出到人提示(失效方向不是静默)', async () => {
    media.requestPermissionsAsync.mockResolvedValueOnce({ granted: false })
    renderScreen()
    fireEvent.contextMenu(screen.getByLabelText(val(TRADER_PLAN_PROMO_KEYS.qrcodeHint)))
    await waitFor(() => expect(pops.appAlert).toHaveBeenCalledWith(val('imageGen.needPermission')))
    expect(media.saveToLibraryAsync).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
