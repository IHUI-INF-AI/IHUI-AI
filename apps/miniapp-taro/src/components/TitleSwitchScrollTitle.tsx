import { View, Swiper, SwiperItem } from '@tarojs/components'
import { useState, useCallback, useEffect } from 'react'

export interface TitleSwitchScrollSubItem {
  name: string
}

export interface TitleSwitchScrollMainItem {
  name: string
  children?: TitleSwitchScrollSubItem[]
}

export interface TitleSwitchScrollTitleProps {
  mainList?: TitleSwitchScrollMainItem[]
  mainSwiperMargin?: string
  subSwiperMargin?: string
  onChange?: (sub: TitleSwitchScrollSubItem) => void
}

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

  const mainChange = useCallback((e: { detail: { current: number } }) => {
    const idx = e.detail.current
    setCurrent(idx)
    setSubList(mainList[idx]?.children || [])
    setSubSelected(null)
  }, [mainList])

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
    <View className="w-full rounded-b-[15px] bg-white pb-[12px] shadow-[0_4px_2px_-4px_rgba(0,0,0,0.3)]">
      <View className="w-full px-[28px] box-border mb-[18px]">
        <View className="text-[30px] font-bold tracking-[0.08em] text-black">主赛道:</View>
        <Swiper
          circular
          duration={500}
          previousMargin={mainSwiperMargin}
          nextMargin={mainSwiperMargin}
          current={current}
          onChange={mainChange}
          className="w-[calc(100vw-60px)] box-border h-[60px]"
        >
          {mainList.map((item, index) => (
            <SwiperItem
              key={index}
              className={`flex items-center justify-center h-[46px] mr-[30px] box-border rounded-[6px] whitespace-nowrap text-[24px] text-black ${
                current === index
                  ? 'font-bold text-[#7361FF] border-[7px] border-transparent'
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
        <View className="w-full px-[28px] box-border mb-[18px]">
          <View className="text-[30px] font-bold tracking-[0.08em] text-black">子赛道:</View>
          <Swiper
            circular
            duration={500}
            previousMargin={subSwiperMargin}
            nextMargin={subSwiperMargin}
            current={subSelected ?? 0}
            onChange={subChange}
            className="w-[calc(100vw-60px)] box-border h-[60px]"
          >
            {subList.map((item, index) => (
              <SwiperItem
                key={index}
                className={`flex items-center justify-center h-[46px] mr-[30px] box-border rounded-[6px] whitespace-nowrap text-[24px] text-black ${
                  subSelected === index
                    ? 'font-bold text-[#7361FF] border-[7px] border-transparent'
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
