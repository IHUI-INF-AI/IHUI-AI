import { View, Text, ScrollView, Input, Image } from '@tarojs/components'
import { useState, useEffect, useCallback } from 'react'
import type { TitleSwitchTypeBarItem, TitleSwitchTypeBarProps } from '@ihui/types'

// 共享类型 TitleSwitchTypeBarItem / TitleSwitchTypeBarProps 已下沉到 packages/types,两端复用。
// 重新导出以维持本模块公开 API(原文件 export 这些类型)。
export type { TitleSwitchTypeBarItem, TitleSwitchTypeBarProps }

const DEFAULT_TABS: TitleSwitchTypeBarItem[] = [
  { id: '1', name: '文案' },
  { id: '2', name: '图片' },
  { id: '3', name: '视频' },
]

/**
 * 类型栏标题切换(对标旧项目 title-switch/type_bar.vue)
 * - 横向滚动多选标签(可选"全部"开关 + "自定义"添加弹窗)
 * - 选中项触发 onChange(ids[])
 *
 * 注:旧项目 mounted 时调用 `category('0')` 拉取后端分类。
 * 新项目无等价 API,这里保留默认列表 + 占位 fetchCategory 钩子,
 * 父组件可通过 props.mainList 注入(本组件未对外暴露以免超出范围)。
 */
export default function TitleSwitchTypeBar({
  showAll = false,
  customize = false,
  onChange,
}: TitleSwitchTypeBarProps) {
  const [tabList, setTabList] = useState<TitleSwitchTypeBarItem[]>(DEFAULT_TABS)
  const [tabValue, setTabValue] = useState<TitleSwitchTypeBarItem[]>([])
  const [all, setAll] = useState(true)
  const [addType, setAddType] = useState(false)
  const [value, setValue] = useState('')

  useEffect(() => {
    if (tabValue.length > 0 && showAll) setAll(false)
    if (tabValue.length === 0) setAll(true)
    onChange?.(tabValue.map((i) => i.id))
  }, [tabValue, showAll, onChange])

  const select = useCallback((item: TitleSwitchTypeBarItem) => {
    setTabValue((prev) => {
      const idx = prev.findIndex((it) => it.id === item.id)
      if (idx >= 0) return prev.filter((_, i) => i !== idx)
      return [...prev, item]
    })
  }, [])

  const selectAllTab = useCallback(() => {
    setAll((a) => {
      const next = !a
      if (next) setTabValue([])
      return next
    })
  }, [])

  const add = useCallback(() => {
    if (value) {
      const item: TitleSwitchTypeBarItem = {
        id: value,
        name: value,
        type: 'type',
        field1: '/static/images/qzdy_20250816161419A289.png',
        butUrl: '/static/images/szdy_20250816161421A290.png',
      }
      setTabList((prev) => [item, ...prev])
      setTabValue((prev) => [...prev, item])
    }
    setAddType(false)
    setValue('')
  }, [value])

  return (
    <ScrollView scrollX className="w-full">
      <View className="flex items-center box-border w-full py-[36rpx] pl-[20rpx]">
        {showAll ? (
          <View
            className={`flex items-center justify-center h-[88rpx] px-[16rpx] rounded-[16rpx] font-bold text-[52rpx] mr-[32rpx] whitespace-nowrap ${
              all
                ? 'text-black bg-[rgba(205,208,255,0.6)] shadow-[0_0_2px_0_rgba(0,0,0,0.3)]'
                : 'text-[rgba(0,0,0,0.3)]'
            }`}
            onClick={selectAllTab}
          >
            <Image
              className="w-[92rpx] h-[92rpx] mr-[8rpx]"
              src={
                all
                  ? '/static/images/sqb_20250816161049A277.png'
                  : '/static/images/qqb_20250816161046A276.png'
              }
            />
            <Text>全部</Text>
          </View>
        ) : null}
        {/* TODO: custom color: #e0e8ff 选中标签浅蓝边框,无对应 token,保留原值 */}
        {tabList.map((item) => {
          const selected = tabValue.some((it) => it.id === item.id)
          return (
            <View
              key={item.id}
              className={`flex items-center justify-center h-[88rpx] px-[16rpx] rounded-[16rpx] font-bold text-[52rpx] mr-[32rpx] whitespace-nowrap ${
                selected
                  ? 'text-black bg-[rgba(248,249,252,0.65)] border border-[#e0e8ff] shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
                  : 'text-[rgba(0,0,0,0.3)]'
              }`}
              onClick={() => select(item)}
            >
              {selected && item.butUrl ? (
                <Image className="w-[92rpx] h-[92rpx] mr-[8rpx]" src={item.butUrl} />
              ) : item.field1 ? (
                <Image className="w-[92rpx] h-[92rpx] mr-[8rpx]" src={item.field1} />
              ) : null}
              <Text>{item.name}</Text>
            </View>
          )
        })}
        {customize ? (
          <View
            className={`flex items-center justify-center h-[88rpx] px-[16rpx] rounded-[16rpx] font-bold text-[52rpx] mr-[32rpx] whitespace-nowrap ${
              addType
                ? 'text-black bg-[rgba(205,208,255,0.6)] shadow-[0_0_2px_0_rgba(0,0,0,0.3)]'
                : 'text-[rgba(0,0,0,0.3)]'
            }`}
            onClick={() => setAddType(true)}
          >
            <Image
              className="w-[92rpx] h-[92rpx] mr-[8rpx]"
              src="/static/images/szdy_20250816161421A290.png"
            />
            <Text>自定义</Text>
          </View>
        ) : null}
      </View>
      {addType ? (
        <View
          className="fixed inset-0 z-[990] bg-[rgba(0,0,0,0.3)]"
          onClick={() => setAddType(false)}
        />
      ) : null}
      {addType ? (
        <View className="fixed inset-0 m-auto z-[996] w-[854rpx] h-[606rpx] rounded-[40rpx] bg-white border border-border box-border flex flex-col items-center justify-center">
          <Text className="text-[48rpx] font-bold text-foreground mb-[100rpx]">
            请设置自定义种类
          </Text>
          <Input
            className="w-[642rpx] h-[98rpx] border border-border rounded-[16rpx] mb-[100rpx] text-[40rpx] text-muted-foreground px-[24rpx]"
            type="text"
            maxlength={4}
            placeholder="请输入种类"
            value={value}
            onInput={(e) => setValue(e.detail.value)}
          />
          <View
            className="w-[200rpx] h-[96rpx] flex items-center justify-center text-[48rpx] font-bold text-black bg-[rgba(205,208,255,0.6)] rounded-[16rpx]"
            onClick={add}
          >
            <Text>确定</Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
  )
}
