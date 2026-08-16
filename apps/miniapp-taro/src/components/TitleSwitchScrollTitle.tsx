import { View, Swiper, SwiperItem } from '@tarojs/components'
import { useState, useCallback, useEffect } from 'react'
import type { TitleSwitchScrollTitleItem, TitleSwitchScrollTitleProps } from '@ihui/types'

// 共享类型 TitleSwitchScrollTitleItem(含递归 children) + TitleSwitchScrollTitleProps
// 已下沉到 packages/types,两端复用。
// 原本地拆分为 SubItem / MainItem 两个类型,现统一为共享递归类型,语义兼容。
// 保留本地别名以维持公开 API(原文件 export 这些类型)。
export type TitleSwitchScrollSubItem = TitleSwitchScrollTitleItem
export type TitleSwitchScrollMainItem = TitleSwitchScrollTitleItem
export type { TitleSwitchScrollTitleProps }

const DEFAULT_LIST: TitleSwitchScrollMainItem[] = [
  { name: '赛道一', children: [{ name: '子赛道 1-1' }, { name: '子赛道 1-2' }] },
  { name: '赛道二', children: [{ name: '子赛道 2-1' }] },
  { name: '赛道三', children: [{ name: '子赛道 3-1' }, { name: '子赛道 3-2' }] },
]

/**
 * 滚动标题切换(对标旧项目 title-switch/scroll_title.vue)
 * - 主赛道 swiper + 子赛道 swiper(circular)
 * - 点击主赛道项切换;点击子赛道项触发 onChange
 */
export default function TitleSwitchScrollTitle({
  mainList = DEFAULT_LIST,
  mainSwiperMargin = '240rpx',
  subSwiperMargin = '240rpx',
  onChange,
}: TitleSwitchScrollTitleProps) {
  const [current, setCurrent] = useState(0)
  const [subList, setSubList] = useState<TitleSwitchScrollSubItem[]>([])
  const [subSelected, setSubSelected] = useState<number | null>(null)

  useEffect(() => {
    const first = mainList[0]
    setSubList(first?.children || [])
  }, [mainList])

  const mainChange = useCallback(
    (e: { detail: { current: number } }) => {
      const idx = e.detail.current
      setCurrent(idx)
      setSubList(mainList[idx]?.children || [])
      setSubSelected(null)
    },
    [mainList],
  )

  const selectMain = useCallback(
    (idx: number) => {
      setCurrent(idx)
      setSubList(mainList[idx]?.children || [])
      setSubSelected(null)
    },
    [mainList],
  )

  const subChange = useCallback((e: { detail: { current: number } }) => {
    setSubSelected(e.detail.current)
  }, [])

  const selectSub = useCallback(
    (idx: number) => {
      setSubSelected(idx)
      const item = subList[idx]
      if (item) onChange?.(item)
    },
    [subList, onChange],
  )

  return (
    <View className="w-full rounded-b-[30rpx] bg-white pb-[24rpx] shadow-[0_4px_2px_-4px_rgba(0,0,0,0.3)]">
      <View className="w-full px-[56rpx] box-border mb-[36rpx]">
        <View className="text-[60rpx] font-bold tracking-[0.08em] text-black">主赛道:</View>
        <Swiper
          circular
          duration={500}
          previousMargin={mainSwiperMargin}
          nextMargin={mainSwiperMargin}
          current={current}
          onChange={mainChange}
          className="w-[calc(100vw-60px)] box-border h-[120rpx]"
        >
          {/* custom color: #7361FF 紫色品牌色,无对应 token,保留原值 */}
          {mainList.map((item, index) => (
            <SwiperItem
              key={index}
              className={`flex items-center justify-center h-[92rpx] mr-[60rpx] box-border rounded-[12rpx] whitespace-nowrap text-[48rpx] text-black ${
                current === index
                  ? 'font-bold text-[#7361FF] border-[14rpx] border-transparent'
                  : ''
              }`}
              onClick={() => selectMain(index)}
            >
              <View className="flex-none">{item.name}</View>
            </SwiperItem>
          ))}
        </Swiper>
      </View>
      {subList && subList.length > 0 ? (
        <View className="w-full px-[56rpx] box-border mb-[36rpx]">
          <View className="text-[60rpx] font-bold tracking-[0.08em] text-black">子赛道:</View>
          <Swiper
            circular
            duration={500}
            previousMargin={subSwiperMargin}
            nextMargin={subSwiperMargin}
            current={subSelected ?? 0}
            onChange={subChange}
            className="w-[calc(100vw-60px)] box-border h-[120rpx]"
          >

            {subList.map((item, index) => (
              <SwiperItem
                key={index}
                className={`flex items-center justify-center h-[92rpx] mr-[60rpx] box-border rounded-[12rpx] whitespace-nowrap text-[48rpx] text-black ${
                  subSelected === index
                    ? 'font-bold text-[#7361FF] border-[14rpx] border-transparent'
                    : ''
                }`}
                onClick={() => selectSub(index)}
              >
                <View className="flex-none">{item.name}</View>
              </SwiperItem>
            ))}
          </Swiper>
        </View>
      ) : null}
    </View>
  )
}
