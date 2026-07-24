import { View, Text, ScrollView, Input, Image } from '@tarojs/components'
import { useState, useEffect, useCallback } from 'react'

export interface TitleSwitchTypeBarItem {
  id: string
  name: string
  butUrl?: string
  field1?: string
  type?: string
}

export interface TitleSwitchTypeBarProps {
  showAll?: boolean
  customize?: boolean
  onChange?: (ids: string[]) => void
}

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
      <View className="flex items-center box-border w-full py-[18px] pl-[10px]">
        {showAll ? (
          <View
            className={`flex items-center justify-center h-[44px] px-[8px] rounded-[8px] font-bold text-[26px] mr-[16px] whitespace-nowrap ${
              all ? 'text-black bg-[rgba(205,208,255,0.6)] shadow-[0_0_2px_0_rgba(0,0,0,0.3)]' : 'text-[rgba(0,0,0,0.3)]'
            }`}
            onClick={selectAllTab}
          >
            <Image
              className="w-[46px] h-[46px] mr-[4px]"
              src={all ? '/static/images/sqb_20250816161049A277.png' : '/static/images/qqb_20250816161046A276.png'}
            />
            <Text>全部</Text>
          </View>
        ) : null}
        {tabList.map((item) => {
          const selected = tabValue.some((it) => it.id === item.id)
          return (
            <View
              key={item.id}
              className={`flex items-center justify-center h-[44px] px-[8px] rounded-[8px] font-bold text-[26px] mr-[16px] whitespace-nowrap ${
                selected
                  ? 'text-black bg-[rgba(248,249,252,0.65)] border border-[#e0e8ff] shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
                  : 'text-[rgba(0,0,0,0.3)]'
              }`}
              onClick={() => select(item)}
            >
              {selected && item.butUrl ? (
                <Image className="w-[46px] h-[46px] mr-[4px]" src={item.butUrl} />
              ) : item.field1 ? (
                <Image className="w-[46px] h-[46px] mr-[4px]" src={item.field1} />
              ) : null}
              <Text>{item.name}</Text>
            </View>
          )
        })}
        {customize ? (
          <View
            className={`flex items-center justify-center h-[44px] px-[8px] rounded-[8px] font-bold text-[26px] mr-[16px] whitespace-nowrap ${
              addType
                ? 'text-black bg-[rgba(205,208,255,0.6)] shadow-[0_0_2px_0_rgba(0,0,0,0.3)]'
                : 'text-[rgba(0,0,0,0.3)]'
            }`}
            onClick={() => setAddType(true)}
          >
            <Image className="w-[46px] h-[46px] mr-[4px]" src="/static/images/szdy_20250816161421A290.png" />
            <Text>自定义</Text>
          </View>
        ) : null}
      </View>
      {addType ? (
        <View className="fixed inset-0 z-[990] bg-[rgba(0,0,0,0.3)]" onClick={() => setAddType(false)} />
      ) : null}
      {addType ? (
        <View className="fixed inset-0 m-auto z-[996] w-[427px] h-[303px] rounded-[20px] bg-white border border-[#DADADA] box-border flex flex-col items-center justify-center">
          <Text className="text-[24px] font-bold text-[#3D3D3D] mb-[50px]">请设置自定义种类</Text>
          <Input
            className="w-[321px] h-[49px] border border-[#979797] rounded-[8px] mb-[50px] text-[20px] text-[#979797] px-[12px]"
            type="text"
            maxlength={4}
            placeholder="请输入种类"
            value={value}
            onInput={(e) => setValue(e.detail.value)}
          />
          <View
            className="w-[100px] h-[48px] flex items-center justify-center text-[24px] font-bold text-black bg-[rgba(205,208,255,0.6)] rounded-[8px]"
            onClick={add}
          >
            <Text>确定</Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
  )
}
