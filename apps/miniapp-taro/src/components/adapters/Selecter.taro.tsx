import { useState, useEffect, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { getRnTokens, type RnThemeTokens, type RnThemeMode } from '@ihui/design-tokens'

/**
 * Taro 适配层:Selecter
 *
 * 平台特有:依赖 @tarojs/components 的 ScrollView + View/Text + onTap,
 * 不适合共享层。
 *
 * 复用 packages/app/src/components/Selecter 的 5 种 type 行为 + 二级选择状态机,
 * 替换 web 元素(`div` + overflowX:auto → Taro ScrollView)+ 事件(`onClick` → `onTap`)。
 * 颜色通过 `getRnTokens(colorScheme)` 共享注入,保持与 web 端主题一致。
 */
export type SelecterType = 'scale' | 'video' | 'ratio' | 'voice' | ''

export interface SelecterOption {
  name?: string
  desc?: string
  value?: string | number
  [key: string]: unknown
}

export interface SelecterProps {
  type?: SelecterType
  options: Array<string | SelecterOption | Record<string, unknown>>
  defaultVal?: string
  desc?: string
  isVip?: number
  onChange?: (val: unknown, index?: number) => void
  /** 已解析主题,默认 'light' */
  colorScheme?: RnThemeMode
}

const isObject = (v: unknown): v is SelecterOption =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

const firstKey = (obj: Record<string, unknown> | null | undefined): string => {
  if (!obj) return ''
  const keys = Object.keys(obj)
  return keys.length > 0 ? (keys[0] ?? '') : ''
}

const getRatioIconSize = (str: string): { width: number; height: number } => {
  if (!str) return { width: 16, height: 16 }
  if (str === '1:1') return { width: 16, height: 16 }
  const arr = str.split(':')
  const a = Number(arr[0])
  const b = Number(arr[1])
  if (Number.isFinite(a) && Number.isFinite(b)) {
    if (a < b) return { width: 13, height: 18 }
    if (a > b) return { width: 20, height: 15 }
  }
  return { width: 16, height: 16 }
}

// ===== 样式(view/text 分离) =====

const toRpx = (px: number): string => `${px * 2}rpx`

const viewStyles = {
  scroll: (): CSSProperties => ({
    width: '100%',
    whiteSpace: 'nowrap',
  }),
  inner: (): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
  }),
  ratioRoot: (): CSSProperties => ({ width: '100%' }),
  ratioSelected: (tk: RnThemeTokens): CSSProperties => ({
    width: '100%',
    paddingLeft: toRpx(10),
    paddingRight: toRpx(10),
    paddingTop: toRpx(6),
    paddingBottom: toRpx(6),
    marginTop: toRpx(10),
    borderRadius: toRpx(5),
    backgroundColor: tk.indigo.light,
  }),
  item: (
    tk: RnThemeTokens,
    active: boolean,
    disabled: boolean,
    extra?: CSSProperties,
  ): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: toRpx(8),
    paddingRight: toRpx(8),
    height: toRpx(25),
    borderRadius: toRpx(5),
    marginRight: toRpx(10),
    flexShrink: 0,
    border: `1px solid ${active ? tk.brand.DEFAULT : tk.text.primary}`,
    backgroundColor: tk.gray[100],
    opacity: disabled ? 0.5 : 1,
    ...extra,
  }),
  ratioIcon: (tk: RnThemeTokens, active: boolean, w: number, h: number): CSSProperties => ({
    marginRight: toRpx(8),
    border: `1px solid ${active ? tk.brand.DEFAULT : tk.text.primary}`,
    width: toRpx(w),
    height: toRpx(h),
    borderRadius: toRpx(5),
  }),
  backBtn: (): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: toRpx(8),
    paddingRight: toRpx(8),
    height: toRpx(25),
    borderRadius: toRpx(5),
    marginRight: toRpx(10),
    flexShrink: 0,
    border: '1px solid',
  }),
  sizeLabel: (): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    paddingLeft: toRpx(8),
    paddingRight: toRpx(8),
    height: toRpx(25),
    marginRight: toRpx(10),
    flexShrink: 0,
  }),
}

const textStyles = {
  item: (tk: RnThemeTokens, active: boolean): CSSProperties => ({
    fontSize: toRpx(14),
    lineHeight: toRpx(25),
    color: active ? tk.brand.DEFAULT : tk.text.primary,
  }),
  videoItem: (tk: RnThemeTokens, active: boolean): CSSProperties => ({
    fontSize: toRpx(14),
    color: active ? tk.brand.DEFAULT : tk.text.primary,
  }),
  videoSub: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(10),
    color: tk.text.secondary,
    marginLeft: toRpx(4),
    marginTop: toRpx(1),
  }),
  backText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    lineHeight: toRpx(25),
    color: tk.text.secondary,
  }),
  sizeLabel: (): CSSProperties => ({
    fontSize: toRpx(14),
    lineHeight: toRpx(25),
    fontWeight: 700,
  }),
  ratioSelected: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(15),
    fontWeight: 700,
    color: tk.brand.DEFAULT,
  }),
}

export function Selecter({
  type = '',
  options,
  defaultVal,
  desc,
  isVip = 0,
  onChange,
  colorScheme = 'light',
}: SelecterProps) {
  const tk = getRnTokens(colorScheme)
  const [value, setValue] = useState<number | string>('')
  const [selectedSizeIndex, setSelectedSizeIndex] = useState<number | null>(null)
  const [selectedSize, setSelectedSize] = useState<Record<string, unknown> | null>(null)
  const [selectedRatio, setSelectedRatio] = useState<Record<string, unknown> | null>(null)

  // 默认选中第一个(ratio 类型除外)
  useEffect(() => {
    if (type === 'ratio') return
    if (options && options.length > 0 && value === '') {
      setValue(0)
      const first = options[0]
      onChange?.(isObject(first) ? first.value : first, 0)
    }
  }, [options, type, onChange, value])

  // defaultVal 变化时同步选中
  useEffect(() => {
    if (!defaultVal || type === 'ratio') return
    for (let i = 0; i < options.length; i += 1) {
      // eslint-disable-next-line eqeqeq
      if (options[i] == defaultVal) {
        setValue(i)
        break
      }
    }
  }, [defaultVal, options, type])

  const select = useCallback(
    (item: string | SelecterOption | Record<string, unknown>, index: number) => {
      if (value === index) {
        setValue('')
        onChange?.('', 0)
      } else {
        setValue(index)
        onChange?.(isObject(item) ? item.value : item, index)
      }
    },
    [onChange, value],
  )

  const selectVideo = useCallback(
    (val: string) => {
      setValue(val)
      onChange?.(val)
    },
    [onChange],
  )

  const selectSize = useCallback((item: Record<string, unknown>, index: number) => {
    setSelectedSizeIndex(index)
    setSelectedSize(item)
    setValue('')
    setSelectedRatio(null)
  }, [])

  const selectRatio = useCallback(
    (item: Record<string, unknown>, index: number) => {
      setValue(index)
      setSelectedRatio(item)
      const sizeKey = selectedSize ? firstKey(selectedSize) : ''
      const ratioKey = firstKey(item)
      const resolution = (item as Record<string, string>)[ratioKey]
      onChange?.({ size: sizeKey, ratio: ratioKey, resolution, fullData: item }, index)
    },
    [onChange, selectedSize],
  )

  const getCurrentRatioOptions = (): Array<Record<string, unknown>> => {
    if (!selectedSize) return []
    const sizeKey = firstKey(selectedSize)
    return (selectedSize as Record<string, Array<Record<string, unknown>>>)[sizeKey] || []
  }

  const resetRatioSelection = useCallback(() => {
    setSelectedSizeIndex(null)
    setSelectedSize(null)
    setSelectedRatio(null)
    setValue('')
  }, [])

  const isDisabled = (): boolean => !!(desc && desc.includes('水印') && isVip === 0)

  // ===== type='scale' =====
  if (type === 'scale') {
    return (
      <ScrollView scrollX style={viewStyles.scroll()}>
        <View style={viewStyles.inner()}>
          {options.map((item, index) => {
            const str = String(item)
            const iconSize = getRatioIconSize(str)
            const active = value === index
            const disabled = isDisabled()
            return (
              <View
                key={index}
                style={viewStyles.item(tk, active, disabled)}
                onTap={() => !disabled && select(item, index)}
              >
                <View style={viewStyles.ratioIcon(tk, active, iconSize.width, iconSize.height)} />
                <Text style={textStyles.item(tk, active)}>{str}</Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
    )
  }

  // ===== type='video' =====
  if (type === 'video') {
    const items: Array<{ label: string; sub: string; val: string }> = [
      { label: '标清 480p', sub: '(640×480)', val: '480P' },
      { label: '超清 720p', sub: '(1280×720)', val: '720P' },
      { label: '高清 1080p', sub: '(1920×1080)', val: '1080P' },
    ]
    return (
      <ScrollView scrollX style={viewStyles.scroll()}>
        <View style={viewStyles.inner()}>
          {items.map((it) => {
            const active = value === it.val
            return (
              <View
                key={it.val}
                style={viewStyles.item(tk, active, false, {
                  height: toRpx(32),
                  paddingLeft: toRpx(10),
                  paddingRight: toRpx(10),
                })}
                onTap={() => selectVideo(it.val)}
              >
                <Text style={textStyles.videoItem(tk, active)}>{it.label}</Text>
                <Text style={textStyles.videoSub(tk)}>{it.sub}</Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
    )
  }

  // ===== type='voice' =====
  if (type === 'voice') {
    return (
      <ScrollView scrollX style={viewStyles.scroll()}>
        <View style={viewStyles.inner()}>
          {options.map((item, index) => {
            const name = isObject(item) ? item.name || '' : String(item)
            const active = value === index
            return (
              <View
                key={index}
                style={viewStyles.item(tk, active, false)}
                onTap={() => select(item, index)}
              >
                <Text style={textStyles.item(tk, active)}>{name}</Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
    )
  }

  // ===== type='ratio' =====
  if (type === 'ratio') {
    return (
      <View style={viewStyles.ratioRoot()}>
        <ScrollView scrollX style={viewStyles.scroll()}>
          {!selectedSize ? (
            <View style={viewStyles.inner()}>
              {options.map((item, index) => {
                const obj = item as Record<string, unknown>
                const label = firstKey(obj)
                const active = selectedSizeIndex === index
                return (
                  <View
                    key={index}
                    style={viewStyles.item(tk, active, false)}
                    onTap={() => selectSize(obj, index)}
                  >
                    <Text style={textStyles.item(tk, active)}>{label}</Text>
                  </View>
                )
              })}
            </View>
          ) : (
            <View style={viewStyles.inner()}>
              <View
                style={{ ...viewStyles.backBtn(), borderColor: tk.gray[500] }}
                onTap={resetRatioSelection}
              >
                <Text style={textStyles.backText(tk)}>← 返回</Text>
              </View>
              <View style={viewStyles.sizeLabel()}>
                <Text style={{ ...textStyles.sizeLabel(), color: tk.brand.DEFAULT }}>
                  {firstKey(selectedSize)}
                </Text>
              </View>
              {getCurrentRatioOptions().map((item, index) => {
                const ratioKey = firstKey(item)
                const resolution = (item as Record<string, string>)[ratioKey]
                const active = value === index
                return (
                  <View
                    key={index}
                    style={viewStyles.item(tk, active, false)}
                    onTap={() => selectRatio(item, index)}
                  >
                    <Text style={textStyles.item(tk, active)}>
                      {ratioKey} ({resolution})
                    </Text>
                  </View>
                )
              })}
            </View>
          )}
        </ScrollView>
        {selectedRatio ? (
          <View style={viewStyles.ratioSelected(tk)}>
            <Text style={textStyles.ratioSelected(tk)}>
              已选择: {firstKey(selectedSize)} - {firstKey(selectedRatio)} (
              {(selectedRatio as Record<string, string>)[firstKey(selectedRatio)]})
            </Text>
          </View>
        ) : null}
      </View>
    )
  }

  // ===== 默认 =====
  return (
    <ScrollView scrollX style={viewStyles.scroll()}>
      <View style={viewStyles.inner()}>
        {options.map((item, index) => {
          const label = isObject(item) ? item.desc || '' : String(item)
          const active = value === index
          return (
            <View
              key={index}
              style={viewStyles.item(tk, active, false)}
              onTap={() => select(item, index)}
            >
              <Text style={textStyles.item(tk, active)}>{label}</Text>
            </View>
          )
        })}
      </View>
    </ScrollView>
  )
}
