import { useState, useEffect, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { getTokens, type AppThemeTokens, type AppThemeMode } from '../theme/tokens'

/**
 * 通用选择器 — 跨端共享层。
 *
 * 对齐原项目 ModelConfigDialog/selecter.vue。5 种 type:
 * - 'scale': 比例尺寸(1:1 / 4:3 / 16:9 等,带 icon 视觉)
 * - 'video': 视频分辨率(480P / 720P / 1080P)
 * - 'voice': 音色选择(name 字段)
 * - 'ratio': 二级选择(先选 1K/2K/4K 尺寸,再选比例)
 * - 默认:普通数组或 {desc,value} 对象数组
 *
 * 平台无关:不依赖 @tarojs/* 或 react-native,ScrollView → div + overflowX:auto。
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
  colorScheme?: AppThemeMode
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

const viewStyles = {
  scroll: (): CSSProperties => ({
    width: '100%',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
  }),
  inner: (): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
  }),
  ratioRoot: (): CSSProperties => ({ width: '100%' }),
  ratioSelected: (tk: AppThemeTokens): CSSProperties => ({
    width: '100%',
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 6,
    paddingBottom: 6,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: tk.surface.muted,
  }),
  item: (
    tk: AppThemeTokens,
    active: boolean,
    disabled: boolean,
    extra?: CSSProperties,
  ): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
    paddingRight: 8,
    height: 25,
    borderRadius: 12,
    marginRight: 10,
    flexShrink: 0,
    border: `1px solid ${active ? tk.brand.DEFAULT : tk.text.primary}`,
    backgroundColor: tk.surface.light,
    opacity: disabled ? 0.5 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
    cursor: disabled ? 'not-allowed' : 'pointer',
    ...extra,
  }),
  ratioIcon: (tk: AppThemeTokens, active: boolean, w: number, h: number): CSSProperties => ({
    marginRight: 8,
    border: `1px solid ${active ? tk.brand.DEFAULT : tk.text.primary}`,
    width: w,
    height: h,
    borderRadius: 5,
  }),
  backBtn: (): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
    paddingRight: 8,
    height: 25,
    borderRadius: 12,
    marginRight: 10,
    flexShrink: 0,
    border: '1px solid',
    cursor: 'pointer',
  }),
  sizeLabel: (): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 8,
    height: 25,
    marginRight: 10,
    flexShrink: 0,
  }),
}

const textStyles = {
  item: (tk: AppThemeTokens, active: boolean): CSSProperties => ({
    fontSize: 14,
    lineHeight: '25px',
    color: active ? tk.brand.DEFAULT : tk.text.primary,
  }),
  videoItem: (tk: AppThemeTokens, active: boolean): CSSProperties => ({
    fontSize: 14,
    color: active ? tk.brand.DEFAULT : tk.text.primary,
  }),
  videoSub: (tk: AppThemeTokens): CSSProperties => ({
    fontSize: 10,
    color: tk.text.secondary,
    marginLeft: 4,
    marginTop: 1,
  }),
  backText: (tk: AppThemeTokens): CSSProperties => ({
    fontSize: 14,
    lineHeight: '25px',
    color: tk.text.secondary,
  }),
  sizeLabel: (): CSSProperties => ({
    fontSize: 14,
    lineHeight: '25px',
    fontWeight: 700,
  }),
  ratioSelected: (tk: AppThemeTokens): CSSProperties => ({
    fontSize: 15,
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
  const tk = getTokens(colorScheme)
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
      <div style={viewStyles.scroll()}>
        <div style={viewStyles.inner()}>
          {options.map((item, index) => {
            const str = String(item)
            const iconSize = getRatioIconSize(str)
            const active = value === index
            const disabled = isDisabled()
            return (
              <div
                key={index}
                role="button"
                tabIndex={0}
                style={viewStyles.item(tk, active, disabled)}
                onClick={() => !disabled && select(item, index)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                    e.preventDefault()
                    select(item, index)
                  }
                }}
              >
                <span style={viewStyles.ratioIcon(tk, active, iconSize.width, iconSize.height)} />
                <span style={textStyles.item(tk, active)}>{str}</span>
              </div>
            )
          })}
        </div>
      </div>
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
      <div style={viewStyles.scroll()}>
        <div style={viewStyles.inner()}>
          {items.map((it) => {
            const active = value === it.val
            return (
              <div
                key={it.val}
                role="button"
                tabIndex={0}
                style={viewStyles.item(tk, active, false, { height: 32, paddingLeft: 10, paddingRight: 10 })}
                onClick={() => selectVideo(it.val)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    selectVideo(it.val)
                  }
                }}
              >
                <span style={textStyles.videoItem(tk, active)}>{it.label}</span>
                <span style={textStyles.videoSub(tk)}>{it.sub}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ===== type='voice' =====
  if (type === 'voice') {
    return (
      <div style={viewStyles.scroll()}>
        <div style={viewStyles.inner()}>
          {options.map((item, index) => {
            const name = isObject(item) ? item.name || '' : String(item)
            const active = value === index
            return (
              <div
                key={index}
                role="button"
                tabIndex={0}
                style={viewStyles.item(tk, active, false)}
                onClick={() => select(item, index)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    select(item, index)
                  }
                }}
              >
                <span style={textStyles.item(tk, active)}>{name}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ===== type='ratio' =====
  if (type === 'ratio') {
    return (
      <div style={viewStyles.ratioRoot()}>
        <div style={viewStyles.scroll()}>
          {!selectedSize ? (
            <div style={viewStyles.inner()}>
              {options.map((item, index) => {
                const obj = item as Record<string, unknown>
                const label = firstKey(obj)
                const active = selectedSizeIndex === index
                return (
                  <div
                    key={index}
                    role="button"
                    tabIndex={0}
                    style={viewStyles.item(tk, active, false)}
                    onClick={() => selectSize(obj, index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        selectSize(obj, index)
                      }
                    }}
                  >
                    <span style={textStyles.item(tk, active)}>{label}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={viewStyles.inner()}>
              <div
                role="button"
                tabIndex={0}
                style={{ ...viewStyles.backBtn(), borderColor: tk.gray[500] }}
                onClick={resetRatioSelection}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    resetRatioSelection()
                  }
                }}
              >
                <span style={textStyles.backText(tk)}>← 返回</span>
              </div>
              <div style={viewStyles.sizeLabel()}>
                <span style={{ ...textStyles.sizeLabel(), color: tk.brand.DEFAULT }}>
                  {firstKey(selectedSize)}
                </span>
              </div>
              {getCurrentRatioOptions().map((item, index) => {
                const ratioKey = firstKey(item)
                const resolution = (item as Record<string, string>)[ratioKey]
                const active = value === index
                return (
                  <div
                    key={index}
                    role="button"
                    tabIndex={0}
                    style={viewStyles.item(tk, active, false)}
                    onClick={() => selectRatio(item, index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        selectRatio(item, index)
                      }
                    }}
                  >
                    <span style={textStyles.item(tk, active)}>
                      {ratioKey} ({resolution})
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {selectedRatio ? (
          <div style={viewStyles.ratioSelected(tk)}>
            <span style={textStyles.ratioSelected(tk)}>
              已选择: {firstKey(selectedSize)} - {firstKey(selectedRatio)} (
              {(selectedRatio as Record<string, string>)[firstKey(selectedRatio)]})
            </span>
          </div>
        ) : null}
      </div>
    )
  }

  // ===== 默认 =====
  return (
    <div style={viewStyles.scroll()}>
      <div style={viewStyles.inner()}>
        {options.map((item, index) => {
          const label = isObject(item) ? item.desc || '' : String(item)
          const active = value === index
          return (
            <div
              key={index}
              role="button"
              tabIndex={0}
              style={viewStyles.item(tk, active, false)}
              onClick={() => select(item, index)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  select(item, index)
                }
              }}
            >
              <span style={textStyles.item(tk, active)}>{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
