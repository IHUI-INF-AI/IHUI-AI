// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 外观预设(2026-11-15 v4)
 *
 * 两个契约:
 *   ① 内置预设的 overrides 经 update() 合并后必须落到全局配置;
 *   ② 自定义预设的新增/删除/整包导入/持久化坏数据都必须逐条校验。
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { BUILT_IN_APPEARANCE_PRESETS } from '@/lib/appearance-presets'
import { APPEARANCE_DEFAULTS, useAppearanceStore } from '../appearance-settings'
import {
  APPEARANCE_PRESETS_STORAGE_KEY,
  CUSTOM_PRESET_LIMIT,
  PRESET_NAME_MAX,
  sanitizePresetList,
  useAppearancePresetsStore,
} from '../appearance-presets'

beforeEach(() => {
  useAppearanceStore.getState().resetAll()
  useAppearancePresetsStore.setState({ presets: [] })
})

describe('内置预设', () => {
  it('阅读预设经 update() 合并后生效,且不污染未声明的字段', () => {
    const reading = BUILT_IN_APPEARANCE_PRESETS.find((preset) => preset.id === 'reading')
    expect(reading).toBeTruthy()
    useAppearanceStore.getState().update(reading!.overrides)
    const state = useAppearanceStore.getState()
    expect(state.fontFamily).toBe('serif')
    expect(state.lineHeight).toBe('relaxed')
    expect(state.paragraphGap).toBe(true)
    // 未在预设里声明的字段保持默认
    expect(state.codeFontSize).toBe(APPEARANCE_DEFAULTS.codeFontSize)
    expect(state.tone).toBe(APPEARANCE_DEFAULTS.tone)
  })

  it('默认预设置回全部默认值,自定义预设不被删除', () => {
    useAppearanceStore.getState().update({ uiScale: 1.3, bionicReading: true })
    useAppearancePresetsStore.getState().addPreset('保留我', { uiScale: 1.3 })

    const fallback = BUILT_IN_APPEARANCE_PRESETS.find((preset) => preset.id === 'default')
    useAppearanceStore.getState().update(fallback!.overrides)

    expect(useAppearanceStore.getState().uiScale).toBe(APPEARANCE_DEFAULTS.uiScale)
    expect(useAppearanceStore.getState().bionicReading).toBe(false)
    expect(useAppearancePresetsStore.getState().presets).toHaveLength(1)
  })

  it('每个内置预设只使用已知配置字段', () => {
    const known = new Set(Object.keys(APPEARANCE_DEFAULTS))
    for (const preset of BUILT_IN_APPEARANCE_PRESETS) {
      for (const key of Object.keys(preset.overrides)) {
        expect(known.has(key), `${preset.id}.${key}`).toBe(true)
      }
    }
  })
})

describe('自定义预设 store', () => {
  it('名称 trim + 空白归一,保存后可应用', () => {
    const id = useAppearancePresetsStore
      .getState()
      .addPreset('  我的   阅读模式  ', { lineHeight: 'relaxed' })
    expect(id).toBeTruthy()
    const preset = useAppearancePresetsStore.getState().presets[0]
    expect(preset?.name).toBe('我的 阅读模式')
    expect(preset?.overrides).toEqual({ lineHeight: 'relaxed' })

    useAppearanceStore.getState().update(preset!.overrides)
    expect(useAppearanceStore.getState().lineHeight).toBe('relaxed')
  })

  it('空名称或空覆盖值被拒绝', () => {
    const store = useAppearancePresetsStore.getState()
    expect(store.addPreset('   ', { uiScale: 1.1 })).toBeNull()
    expect(store.addPreset('没有内容', {})).toBeNull()
    expect(useAppearancePresetsStore.getState().presets).toHaveLength(0)
  })

  it(`最多 ${CUSTOM_PRESET_LIMIT} 条,名称截断到 ${PRESET_NAME_MAX} 字`, () => {
    const store = useAppearancePresetsStore.getState()
    for (let index = 0; index < CUSTOM_PRESET_LIMIT; index += 1) {
      expect(store.addPreset(`预设 ${index}`, { uiScale: 1 })).toBeTruthy()
    }
    expect(store.addPreset('超限', { uiScale: 1 })).toBeNull()
    expect(useAppearancePresetsStore.getState().presets).toHaveLength(CUSTOM_PRESET_LIMIT)

    useAppearancePresetsStore.getState().clearPresets()
    const longName = 'x'.repeat(PRESET_NAME_MAX + 20)
    useAppearancePresetsStore.getState().addPreset(longName, { uiScale: 1 })
    expect(useAppearancePresetsStore.getState().presets[0]?.name).toHaveLength(PRESET_NAME_MAX)
  })

  it('removePreset 只删指定条目', () => {
    const store = useAppearancePresetsStore.getState()
    const keep = store.addPreset('保留', { uiScale: 1.05 })
    const drop = store.addPreset('删除', { uiScale: 1.1 })
    useAppearancePresetsStore.getState().removePreset(drop!)
    const presets = useAppearancePresetsStore.getState().presets
    expect(presets).toHaveLength(1)
    expect(presets[0]?.id).toBe(keep)
  })
})

describe('预设整包导入(云同步/导出文件)', () => {
  it('坏条目逐条丢弃、越界值夹紧、重复 id 去重', () => {
    expect(
      sanitizePresetList([
        { id: 'a', name: ' 有效 ', overrides: { uiScale: 99 }, createdAt: 1 },
        { id: 'a', name: '重复 id', overrides: { uiScale: 1.1 } },
        null,
        { name: '缺 id', overrides: { uiScale: 1.1 } },
        { id: 'b', name: '', overrides: { uiScale: 1.1 } },
        { id: 'c', name: '空覆盖', overrides: {} },
      ]),
    ).toEqual([{ id: 'a', name: '有效', overrides: { uiScale: 1.4 }, createdAt: 1 }])
  })

  it('applyPresets 只接受数组;空数组表示清空', () => {
    const store = useAppearancePresetsStore.getState()
    expect(store.applyPresets({ presets: [] })).toBe(false)
    expect(store.applyPresets('nope')).toBe(false)

    store.addPreset('将被清空', { uiScale: 1.1 })
    expect(useAppearancePresetsStore.getState().applyPresets([])).toBe(true)
    expect(useAppearancePresetsStore.getState().presets).toHaveLength(0)
  })

  it('导出是深拷贝,外部修改不回写 store', () => {
    const store = useAppearancePresetsStore.getState()
    store.addPreset('快照', { uiScale: 1.1 })
    const exported = useAppearancePresetsStore.getState().exportPresets()
    exported[0]!.overrides.uiScale = 1.4
    exported[0]!.name = '被改了'
    const preset = useAppearancePresetsStore.getState().presets[0]
    expect(preset?.overrides.uiScale).toBe(1.1)
    expect(preset?.name).toBe('快照')
  })

  it('持久化回读时坏条目被丢弃(merge 校验)', async () => {
    window.localStorage.setItem(
      APPEARANCE_PRESETS_STORAGE_KEY,
      JSON.stringify({
        state: {
          presets: [
            { id: 'ok', name: '有效', overrides: { uiScale: 1.1 }, createdAt: 1 },
            { id: 'bad', name: '坏值', overrides: { lineHeight: 'nope' } },
          ],
        },
        version: 0,
      }),
    )
    await useAppearancePresetsStore.persist.rehydrate()
    const presets = useAppearancePresetsStore.getState().presets
    expect(presets).toHaveLength(1)
    expect(presets[0]?.id).toBe('ok')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
