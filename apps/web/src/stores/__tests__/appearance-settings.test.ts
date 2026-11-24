// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it } from 'vitest'

import {
  APPEARANCE_DEFAULTS,
  resolveSizePreset,
  resolveVerbosityPreset,
  SIZE_PRESETS,
  useAppearanceStore,
  VERBOSITY_PRESETS,
} from '../appearance-settings'
import { buildAiStyleDirective, parseBannedWords, parseGlossary } from '@/lib/ai-style-directive'

beforeEach(() => {
  useAppearanceStore.getState().resetAll()
})

describe('buildAiStyleDirective(外观设置 → 系统风格指令)', () => {
  it('全默认必须返回空串(请求体与接线前逐字节一致)', () => {
    expect(buildAiStyleDirective(APPEARANCE_DEFAULTS)).toBe('')
  })

  it('非默认偏好逐条编译,且带优先级声明', () => {
    const text = buildAiStyleDirective({
      ...APPEARANCE_DEFAULTS,
      tone: 'professional',
      aiLanguage: 'zh-CN',
      aiLength: 'short',
      aiFormat: 'list',
      explainDepth: 'beginner',
    })
    expect(text).toContain('【回复风格要求】')
    expect(text).toContain('始终使用简体中文回答')
    expect(text).toContain('语气专业、准确、克制')
    expect(text).toContain('尽量精简')
    expect(text).toContain('优先使用列表')
    expect(text).toContain('面向初学者')
    expect(text).toContain('优先级低于用户的直接指令与安全规则')
  })

  it('自定义风格指令会 trim 后追加', () => {
    const text = buildAiStyleDirective({
      ...APPEARANCE_DEFAULTS,
      customStyle: '  先给结论,再给三条可执行步骤  ',
    })
    expect(text).toContain('- 额外要求:先给结论,再给三条可执行步骤')
    expect(text).not.toContain('  - 额外要求')
  })
})

describe('useAppearanceStore 导入/导出', () => {
  it('导出后可原样导入', () => {
    useAppearanceStore.getState().update({
      uiScale: 1.2,
      chatFontScale: 1.15,
      tone: 'academic',
      contentWidth: 'wide',
      showUsage: false,
    })
    const exported = useAppearanceStore.getState().exportConfig()
    useAppearanceStore.getState().resetAll()
    expect(useAppearanceStore.getState().uiScale).toBe(1)
    expect(useAppearanceStore.getState().importConfig(exported)).toBe(true)
    const s = useAppearanceStore.getState()
    expect(s.uiScale).toBe(1.2)
    expect(s.chatFontScale).toBe(1.15)
    expect(s.tone).toBe('academic')
    expect(s.contentWidth).toBe('wide')
    expect(s.showUsage).toBe(false)
  })

  it('坏 JSON 返回 false 且状态不变', () => {
    const before = useAppearanceStore.getState().uiScale
    expect(useAppearanceStore.getState().importConfig('not-json{')).toBe(false)
    expect(useAppearanceStore.getState().uiScale).toBe(before)
  })

  it('越界数值夹紧、未知枚举忽略', () => {
    expect(
      useAppearanceStore
        .getState()
        .importConfig(
          JSON.stringify({ uiScale: 99, chatFontScale: -1, tone: 'nope', contentWidth: 'wide' }),
        ),
    ).toBe(true)
    const s = useAppearanceStore.getState()
    expect(s.uiScale).toBe(1.4)
    expect(s.chatFontScale).toBe(0.8)
    expect(s.tone).toBe('default')
    expect(s.contentWidth).toBe('wide')
  })

  it('空对象视为非法导入(不静默吞掉)', () => {
    expect(useAppearanceStore.getState().importConfig('{}')).toBe(false)
  })
})

describe('resolveVerbosityPreset(由开关 + 折叠策略反推,不存第二份预设)', () => {
  it('默认(auto)= standard', () => {
    expect(resolveVerbosityPreset(APPEARANCE_DEFAULTS)).toBe('standard')
  })

  it('简洁/详细预设可被识别', () => {
    expect(
      resolveVerbosityPreset({ ...APPEARANCE_DEFAULTS, ...VERBOSITY_PRESETS.concise }, 'collapsed'),
    ).toBe('concise')
    expect(
      resolveVerbosityPreset({ ...APPEARANCE_DEFAULTS, ...VERBOSITY_PRESETS.detailed }, 'expanded'),
    ).toBe('detailed')
  })

  it('开关与折叠策略不匹配 = custom', () => {
    expect(
      resolveVerbosityPreset(
        { ...APPEARANCE_DEFAULTS, showTimestamps: false, showActions: true },
        'auto',
      ),
    ).toBe('custom')
    expect(resolveVerbosityPreset(APPEARANCE_DEFAULTS, 'collapsed')).toBe('custom')
  })
})

describe('v2 扩展配置', () => {
  it('默认值保持既有观感(全部为不改变现状的档位)', () => {
    const s = useAppearanceStore.getState()
    expect(s.accentColor).toBe('default')
    expect(s.radiusScale).toBe('standard')
    expect(s.chatInputScale).toBe(1)
    expect(s.collapseLines).toBe(14)
    expect(s.longMessageCollapse).toBe(false)
    expect(s.bionicReading).toBe(false)
    expect(s.readingRuler).toBe(false)
    expect(s.grayscale).toBe(false)
    expect(s.glossary).toBe('')
    expect(s.bannedWords).toBe('')
    expect(s.textAlign).toBe('left')
    expect(s.emojiPolicy).toBe('auto')
  })

  it('v2 数值越界夹紧、未知枚举回退默认', () => {
    expect(
      useAppearanceStore.getState().importConfig(
        JSON.stringify({
          chatInputScale: 9,
          collapseLines: 1,
          accentColor: 'nope',
          radiusScale: 'rounded',
          paragraphGap: true,
        }),
      ),
    ).toBe(true)
    const s = useAppearanceStore.getState()
    expect(s.chatInputScale).toBe(1.3)
    expect(s.collapseLines).toBe(6)
    expect(s.accentColor).toBe('default')
    expect(s.radiusScale).toBe('rounded')
    expect(s.paragraphGap).toBe(true)
  })

  it('v2 字段参与导出/导入往返', () => {
    useAppearanceStore.getState().update({
      accentColor: 'emerald',
      radiusScale: 'sharp',
      bionicReading: true,
      glossary: 'API=接口',
      followQuestionLanguage: true,
    })
    const exported = useAppearanceStore.getState().exportConfig()
    useAppearanceStore.getState().resetAll()
    expect(useAppearanceStore.getState().importConfig(exported)).toBe(true)
    const s = useAppearanceStore.getState()
    expect(s.accentColor).toBe('emerald')
    expect(s.radiusScale).toBe('sharp')
    expect(s.bionicReading).toBe(true)
    expect(s.glossary).toBe('API=接口')
    expect(s.followQuestionLanguage).toBe(true)
  })
})

describe('buildAiStyleDirective v2 扩展', () => {
  it('跟随提问语言:语言=auto 时生效,显式语言优先', () => {
    const follow = buildAiStyleDirective({
      ...APPEARANCE_DEFAULTS,
      followQuestionLanguage: true,
    })
    expect(follow).toContain('使用与用户提问相同的语言回答')

    const explicit = buildAiStyleDirective({
      ...APPEARANCE_DEFAULTS,
      aiLanguage: 'en',
      followQuestionLanguage: true,
    })
    expect(explicit).toContain('Always answer in English')
    expect(explicit).not.toContain('使用与用户提问相同的语言回答')
  })

  it('术语表/禁用词/中西文空格/全角标点逐条编译', () => {
    const text = buildAiStyleDirective({
      ...APPEARANCE_DEFAULTS,
      glossary: 'API=接口\nagent:智能体',
      bannedWords: '显然,众所周知、显然',
      chineseSpacing: true,
      fullWidthPunctuation: true,
    })
    expect(text).toContain('- 术语:API → 接口')
    expect(text).toContain('- 术语:agent → 智能体')
    expect(text).toContain('- 禁用词:避免使用以下词汇:显然、众所周知')
    expect(text).toContain('中文与英文、数字之间保留一个半角空格')
    expect(text).toContain('中文语境使用全角标点')
  })

  it('术语表坏行被跳过,禁用词去重并截断', () => {
    expect(parseGlossary('A=B\n没有分隔符\n=C\nD=E')).toEqual([
      { source: 'A', target: 'B' },
      { source: 'D', target: 'E' },
    ])
    const words = parseBannedWords('x, y、x；z\nw')
    expect(words).toEqual(['x', 'y', 'z', 'w'])
  })

  it('emoji 策略:auto 不产生指令,禁用/少量分别编译', () => {
    expect(buildAiStyleDirective({ ...APPEARANCE_DEFAULTS, emojiPolicy: 'auto' })).toBe('')
    expect(buildAiStyleDirective({ ...APPEARANCE_DEFAULTS, emojiPolicy: 'none' })).toContain(
      '不要使用 emoji 表情符号',
    )
    expect(buildAiStyleDirective({ ...APPEARANCE_DEFAULTS, emojiPolicy: 'minimal' })).toContain(
      '尽量少用 emoji',
    )
  })
})

describe('resolveSizePreset(一键字号,不落盘第二份预设)', () => {
  it('默认命中 comfortable', () => {
    expect(resolveSizePreset(APPEARANCE_DEFAULTS)).toBe('comfortable')
  })

  it('预设可被识别,单独改动任一字段即 custom', () => {
    expect(resolveSizePreset({ ...APPEARANCE_DEFAULTS, ...SIZE_PRESETS.compact })).toBe('compact')
    expect(resolveSizePreset({ ...APPEARANCE_DEFAULTS, ...SIZE_PRESETS.large })).toBe('large')
    expect(resolveSizePreset({ ...APPEARANCE_DEFAULTS, uiScale: 1.05 })).toBe('custom')
  })
})

describe('v3 主题/无障碍字段', () => {
  it('默认值不改变既有观感', () => {
    const s = useAppearanceStore.getState()
    expect(s.legibilityFont).toBe(false)
    expect(s.colorVision).toBe('none')
    expect(s.customTheme.enabled).toBe(false)
  })

  it('自定义主题坏色值按字段回退,合法值小写保存', () => {
    useAppearanceStore.getState().importConfig(
      JSON.stringify({
        customTheme: {
          enabled: true,
          light: { primary: '#FF0000', background: 'not-a-color' },
          dark: {},
        },
      }),
    )
    const theme = useAppearanceStore.getState().customTheme
    expect(theme.enabled).toBe(true)
    expect(theme.light.primary).toBe('#ff0000')
    expect(theme.light.background).toBe(APPEARANCE_DEFAULTS.customTheme.light.background)
    expect(theme.dark.primary).toBe(APPEARANCE_DEFAULTS.customTheme.dark.primary)
  })

  it('色觉枚举只接受白名单', () => {
    useAppearanceStore.getState().importConfig(JSON.stringify({ colorVision: 'rainbow' }))
    expect(useAppearanceStore.getState().colorVision).toBe('none')
    useAppearanceStore.getState().importConfig(JSON.stringify({ colorVision: 'deuteranopia' }))
    expect(useAppearanceStore.getState().colorVision).toBe('deuteranopia')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
