import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'

/**
 * 通用选择器 — 对齐原项目 ModelConfigDialog/selecter.vue
 * 5 种 type:
 * - 'scale': 比例尺寸(1:1 / 4:3 / 16:9 等,带 icon 视觉)
 * - 'video': 视频分辨率(480P / 720P / 1080P)
 * - 'voice': 音色选择(name 字段)
 * - 'ratio': 二级选择(先选 1K/2K/4K 尺寸,再选比例)
 * - 默认:普通数组或 {desc,value} 对象数组
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
}

const isObject = (v: unknown): v is SelecterOption =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

// 获取对象第一个 key
const firstKey = (obj: Record<string, unknown> | null | undefined): string => {
  if (!obj) return ''
  const keys = Object.keys(obj)
  return keys.length > 0 ? (keys[0] as string) : ''
}

// 通过比例字符串返回 icon 的宽高 class
const getRatioIconStyle = (str: string): { width: string; height: string } => {
  if (!str) return { width: '33rpx', height: '33rpx' }
  if (str === '1:1') return { width: '33rpx', height: '33rpx' }
  const arr = str.split(':')
  const a = Number(arr[0])
  const b = Number(arr[1])
  if (a < b) return { width: '26rpx', height: '35rpx' }
  if (a > b) return { width: '39rpx', height: '29rpx' }
  return { width: '33rpx', height: '33rpx' }
}

const ITEM_BASE = 'flex items-center justify-center px-2 h-[50rpx] rounded-[10rpx] mr-[21rpx] flex-shrink-0 border'
const ITEM_BG = 'bg-muted/40'

export default function Selecter({
  type = '',
  options,
  defaultVal,
  desc,
  isVip = 0,
  onChange,
}: SelecterProps) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, type])

  // defaultVal 变化时同步选中
  useEffect(() => {
    if (!defaultVal || type === 'ratio') return
    for (let i = 0; i < options.length; i++) {
      // eslint-disable-next-line eqeqeq
      if (options[i] == defaultVal) {
        setValue(i)
        break
      }
    }
  }, [defaultVal, options, type])

  const select = (item: string | SelecterOption | Record<string, unknown>, index: number) => {
    if (value === index) {
      setValue('')
      onChange?.('', 0)
    } else {
      setValue(index)
      onChange?.(isObject(item) ? item.value : item, index)
    }
  }

  const selectVideo = (val: string) => {
    setValue(val)
    onChange?.(val)
  }

  // ratio 类型:选尺寸
  const selectSize = (item: Record<string, unknown>, index: number) => {
    setSelectedSizeIndex(index)
    setSelectedSize(item)
    setValue('')
    setSelectedRatio(null)
  }

  // ratio 类型:选比例
  const selectRatio = (item: Record<string, unknown>, index: number) => {
    setValue(index)
    setSelectedRatio(item)
    const sizeKey = selectedSize ? firstKey(selectedSize) : ''
    const ratioKey = firstKey(item)
    const resolution = (item as Record<string, string>)[ratioKey]
    onChange?.({ size: sizeKey, ratio: ratioKey, resolution, fullData: item }, index)
  }

  const getCurrentRatioOptions = (): Array<Record<string, unknown>> => {
    if (!selectedSize) return []
    const sizeKey = firstKey(selectedSize)
    return (selectedSize as Record<string, Array<Record<string, unknown>>>)[sizeKey] || []
  }

  const resetRatioSelection = () => {
    setSelectedSizeIndex(null)
    setSelectedSize(null)
    setSelectedRatio(null)
    setValue('')
  }

  // 水印 desc + 非 VIP 时禁用
  const isDisabled = ():
 boolean => !!(desc && desc.includes('水印') && isVip === 0)

  // ===== type='scale':比例尺寸选择(带 icon) =====
  if (type === 'scale') {
    return (
      <ScrollView scrollX className="w-full whitespace-nowrap">
        <View className="flex items-center w-full">
          {options.map((item, index) => {
            const str = String(item)
            const iconStyle = getRatioIconStyle(str)
            const active = value === index
            return (
              <View
                key={index}
                className={`${ITEM_BASE} ${ITEM_BG} ${isDisabled() ? 'opacity-50 pointer-events-none' : ''}`}
                style={{ borderColor: active ? 'var(--color-primary)' : 'var(--color-foreground)' }}
                onClick={() => !isDisabled() && select(item, index)}
              >
                <View
                  className="mr-2 border rounded-[10rpx]"
                  style={{ ...iconStyle, borderColor: active ? 'var(--color-primary)' : 'var(--color-foreground)' }}
                />
                <Text
                  className="text-[29rpx] leading-[50rpx]"
                  style={{ color: active ? 'var(--color-primary)' : 'var(--color-foreground)' }}
                >
                  {str}
                </Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
    )
  }

  // ===== type='video':视频分辨率选择 =====
  if (type === 'video') {
    const items = [
      { label: '标清 480p', sub: '（640×480）', val: '480P' },
      { label: '超清 720p', sub: '（1280×720）', val: '720P' },
      { label: '高清 1080p', sub: '（1920×1080）', val: '1080P' },
    ]
    return (
      <ScrollView scrollX className="w-full whitespace-nowrap">
        <View className="flex items-center w-full">
          {items.map((it) => {
            const active = value === it.val
            return (
              <View
                key={it.val}
                className={`${ITEM_BASE} ${ITEM_BG} h-[65rpx] px-[21rpx]`}
                style={{ borderColor: active ? 'var(--color-primary)' : 'var(--color-foreground)' }}
                onClick={() => selectVideo(it.val)}
              >
                <Text
                  className="text-[29rpx]"
                  style={{ color: active ? 'var(--color-primary)' : 'var(--color-foreground)' }}
                >
                  {it.label}
                </Text>
                <Text className="text-[21rpx] text-muted-foreground ml-1 mt-[3rpx]">{it.sub}</Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
    )
  }

  // ===== type='voice':音色选择 =====
  if (type === 'voice') {
    return (
      <ScrollView scrollX className="w-full whitespace-nowrap">
        <View className="flex items-center w-full">
          {options.map((item, index) => {
            const name = isObject(item) ? item.name || '' : String(item)
            const active = value === index
            return (
              <View
                key={index}
                className={`${ITEM_BASE} ${ITEM_BG}`}
                onClick={() => select(item, index)}
              >
                <Text
                  className="text-[29rpx] leading-[50rpx]"
                  style={{ color: active ? 'var(--color-primary)' : 'var(--color-foreground)' }}
                >
                  {name}
                </Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
    )
  }

  // ===== type='ratio':二级选择(尺寸 → 比例) =====
  if (type === 'ratio') {
    return (
      <View className="w-full">
        <ScrollView scrollX className="w-full whitespace-nowrap">
          {!selectedSize ? (
            <View className="flex items-center w-full">
              {options.map((item, index) => {
                const obj = item as Record<string, unknown>
                const label = firstKey(obj)
                const active = selectedSizeIndex === index
                return (
                  <View
                    key={index}
                    className={`${ITEM_BASE} ${ITEM_BG}`}
                    style={{ borderColor: active ? 'var(--color-primary)' : 'var(--color-foreground)' }}
                    onClick={() => selectSize(obj, index)}
                  >
                    <Text
                      className="text-[29rpx] leading-[50rpx]"
                      style={{ color: active ? 'var(--color-primary)' : 'var(--color-foreground)' }}
                    >
                      {label}
                    </Text>
                  </View>
                )
              })}
            </View>
          ) : (
            <View className="flex items-center w-full">
              <View
                className={`${ITEM_BASE} border-muted-foreground`}
                onClick={resetRatioSelection}
              >
                <Text className="text-[29rpx] leading-[50rpx] text-muted-foreground">← 返回</Text>
              </View>
              <View
                className={`${ITEM_BASE} selecter-size-label`}
              >
                <Text
                  className="text-[29rpx] leading-[50rpx] font-bold"
                  style={{ color: 'var(--color-primary)' }}
                >
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
                    className={`${ITEM_BASE} ${ITEM_BG}`}
                    style={{ borderColor: active ? 'var(--color-primary)' : 'var(--color-foreground)' }}
                    onClick={() => selectRatio(item, index)}
                  >
                    <Text
                      className="text-[29rpx] leading-[50rpx]"
                      style={{ color: active ? 'var(--color-primary)' : 'var(--color-foreground)' }}
                    >
                      {ratioKey} ({resolution})
                    </Text>
                  </View>
                )
              })}
            </View>
          )}
        </ScrollView>
        {selectedRatio && (
          <View
            className="w-full px-[21rpx] py-[13rpx] mt-[21rpx] rounded-[10rpx] selecter-selected-value"
          >
            <Text className="text-[31rpx] font-bold" style={{ color: 'var(--color-primary)' }}>
              已选择: {firstKey(selectedSize)} - {firstKey(selectedRatio)} (
              {(selectedRatio as Record<string, string>)[firstKey(selectedRatio)]})
            </Text>
          </View>
        )}
        {/* 占位避免 selectedRatio 为 null 时 TS 报错 */}
        {!selectedRatio && null}
      </View>
    )
  }

  // ===== 默认:普通数组或对象数组 =====
  return (
    <ScrollView scrollX className="w-full whitespace-nowrap">
      <View className="flex items-center w-full">
        {options.map((item, index) => {
          const label = isObject(item) ? item.desc || '' : String(item)
          const active = value === index
          return (
            <View
              key={index}
              className={`${ITEM_BASE} ${ITEM_BG}`}
              onClick={() => select(item, index)}
            >
              <Text
                className="text-[29rpx] leading-[50rpx]"
                style={{ color: active ? 'var(--color-primary)' : 'var(--color-foreground)' }}
              >
                {label}
              </Text>
            </View>
          )
        })}
      </View>
    </ScrollView>
  )
}
