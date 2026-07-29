import { View, Text, ScrollView, Input, Image } from '@tarojs/components'
import { useState, useEffect, useCallback } from 'react'
import type { TitleSwitchTypeBarItem, TitleSwitchTypeBarProps } from '@ihui/types'
import './TitleSwitchTypeBar.css'

// 共享类型 TitleSwitchTypeBarItem / TitleSwitchTypeBarProps 已下沉到 packages/types,两端复用。
// 重新导出以维持本模块公开 API(原文件 export 这些类型)。
export type { TitleSwitchTypeBarItem, TitleSwitchTypeBarProps }

/**
 * 扩展 props:在共享 TitleSwitchTypeBarProps 基础上新增 multi/single 模式专用受控值与回调。
 * 不修改 packages/types(共享层),仅在本端局部扩展。
 */
export interface TitleSwitchTypeBarExtendedProps extends TitleSwitchTypeBarProps {
  /** multi 模式当前选中的 id 列表(受控) */
  selectedItems?: string[]
  /** multi 模式选中变化回调 */
  onMultiChange?: (ids: string[]) => void
  /** single 模式当前选中 id(受控,与 value 等价,优先级高于 value) */
  selectedValue?: string
  /** single 模式选中变化回调 */
  onSingleChange?: (id: string) => void
}

const DEFAULT_TABS: TitleSwitchTypeBarItem[] = [
  { id: '1', name: '文案' },
  { id: '2', name: '图片' },
  { id: '3', name: '视频' },
]

/**
 * 类型栏标题切换(对标旧项目 title-switch/type_bar.vue + single.vue)
 *
 * 双模式:
 * - mode='single'(默认,对齐 single.vue):单选,点击新项替换选中,点击已选项不变。
 *   受控值:selectedValue(优先)或 value(兼容);回调:onSingleChange + onChange。
 * - mode='multi'(对齐 tab.vue):多选 toggle,可选"全部"开关 + "自定义"添加弹窗。
 *   受控值:selectedItems;回调:onMultiChange + onChange。
 *
 * 视觉对齐:
 * - 间距/圆角/字体大小:height 44rpx、padding 0 8rpx、margin-right 6rpx、radius 8rpx、font-weight bold。
 * - 颜色:用 CSS 变量 var(--color-*),选中项主色高亮,未选中灰底。
 * - multi 选中态额外显示勾选图标。
 */
export default function TitleSwitchTypeBar({
  showAll = false,
  customize = false,
  mode = 'single',
  value,
  selectedValue,
  selectedItems,
  mainList,
  onChange,
  onMultiChange,
  onSingleChange,
}: TitleSwitchTypeBarExtendedProps) {
  const [tabList, setTabList] = useState<TitleSwitchTypeBarItem[]>(mainList ?? DEFAULT_TABS)
  const [tabValue, setTabValue] = useState<TitleSwitchTypeBarItem[]>([])
  const [addType, setAddType] = useState(false)
  const [customValue, setCustomValue] = useState('')

  // mainList 变化时同步
  useEffect(() => {
    if (mainList && mainList.length > 0) setTabList(mainList)
  }, [mainList])

  // single 模式:selectedValue 或 value 变化时同步选中项(不触发回调,避免循环)
  useEffect(() => {
    if (mode !== 'single') return
    const id = selectedValue ?? value
    if (!id) return
    const found = tabList.find((it) => it.id === id)
    if (found) {
      setTabValue((prev) =>
        prev.length === 1 && prev[0]?.id === found.id ? prev : [found],
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedValue, value, mode])

  // multi 模式:selectedItems 变化时同步选中项(不触发回调,避免循环)
  useEffect(() => {
    if (mode !== 'multi' || !selectedItems) return
    const items = selectedItems
      .map((id) => tabList.find((it) => it.id === id))
      .filter((it): it is TitleSwitchTypeBarItem => Boolean(it))
    setTabValue((prev) => {
      const sameIds =
        prev.length === items.length &&
        prev.every((it, i) => it.id === items[i]?.id)
      return sameIds ? prev : items
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems, mode])

  // 派发选中变化回调(仅在用户交互时调用,不在外部同步时调用)
  const dispatchChange = useCallback(
    (next: TitleSwitchTypeBarItem[]) => {
      const ids = next.map((i) => i.id)
      if (mode === 'single') {
        onSingleChange?.(ids[0] ?? '')
        onChange?.(ids)
      } else {
        onMultiChange?.(ids)
        onChange?.(ids)
      }
    },
    [mode, onChange, onMultiChange, onSingleChange],
  )

  const select = useCallback(
    (item: TitleSwitchTypeBarItem) => {
      const idx = tabValue.findIndex((it) => it.id === item.id)
      let next: TitleSwitchTypeBarItem[]
      if (mode === 'single') {
        // 单选模式:点击已选中项不变(对齐 single.vue),点击新项替换
        if (idx >= 0) return
        next = [item]
      } else {
        // 多选模式:toggle(对齐 tab.vue)
        if (idx >= 0) next = tabValue.filter((_, i) => i !== idx)
        else next = [...tabValue, item]
      }
      setTabValue(next)
      dispatchChange(next)
    },
    [tabValue, mode, dispatchChange],
  )

  // "全部"按钮:仅 multi 模式,点击清空选中
  const selectAllTab = useCallback(() => {
    if (tabValue.length === 0) return
    setTabValue([])
    dispatchChange([])
  }, [tabValue, dispatchChange])

  const add = useCallback(() => {
    if (customValue) {
      const item: TitleSwitchTypeBarItem = {
        id: customValue,
        name: customValue,
        type: 'type',
        field1: '/static/images/qzdy_20250816161419A289.png',
        butUrl: '/static/images/szdy_20250816161421A290.png',
      }
      setTabList((prev) => [item, ...prev])
      const next: TitleSwitchTypeBarItem[] =
        mode === 'single' ? [item] : [...tabValue, item]
      setTabValue(next)
      dispatchChange(next)
    }
    setAddType(false)
    setCustomValue('')
  }, [customValue, tabValue, mode, dispatchChange])

  // "全部"按钮激活态:multi 模式 + 无选中项
  const all = showAll && mode === 'multi' && tabValue.length === 0
  const isActive = (id: string): boolean => tabValue.some((it) => it.id === id)

  return (
    <ScrollView scrollX className="w-full">
      <View className="title-switch-type-bar__list">
        {/* "全部"按钮:仅 multi 模式 + showAll 显示 */}
        {showAll && mode === 'multi' ? (
          <View
            className={`title-switch-type-bar__item${all ? ' title-switch-type-bar__item--active' : ''}`}
            onClick={selectAllTab}
          >
            <Image
              className="title-switch-type-bar__icon"
              src={
                all
                  ? '/static/images/sqb_20250816161049A277.png'
                  : '/static/images/qqb_20250816161046A276.png'
              }
            />
            <Text>全部</Text>
          </View>
        ) : null}

        {tabList.map((item) => {
          const selected = isActive(item.id)
          return (
            <View
              key={item.id}
              className={`title-switch-type-bar__item${selected ? ' title-switch-type-bar__item--active' : ''}`}
              onClick={() => select(item)}
            >
              {selected && item.butUrl ? (
                <Image className="title-switch-type-bar__icon" src={item.butUrl} />
              ) : item.field1 ? (
                <Image className="title-switch-type-bar__icon" src={item.field1} />
              ) : null}
              <Text>{item.name}</Text>
              {/* multi 模式选中态:勾选图标 */}
              {mode === 'multi' && selected ? (
                <Text className="title-switch-type-bar__check">✓</Text>
              ) : null}
            </View>
          )
        })}

        {/* "自定义"按钮:仅 multi 模式 + customize 显示 */}
        {customize && mode === 'multi' ? (
          <View
            className={`title-switch-type-bar__item${addType ? ' title-switch-type-bar__item--active' : ''}`}
            onClick={() => setAddType(true)}
          >
            <Image
              className="title-switch-type-bar__icon"
              src="/static/images/szdy_20250816161421A290.png"
            />
            <Text>自定义</Text>
          </View>
        ) : null}
      </View>

      {/* 自定义弹窗遮罩 */}
      {addType ? (
        <View
          className="title-switch-type-bar__mask"
          onClick={() => setAddType(false)}
        />
      ) : null}

      {/* 自定义弹窗 */}
      {addType ? (
        <View className="title-switch-type-bar__modal">
          <Text className="title-switch-type-bar__modal-title">请设置自定义种类</Text>
          <Input
            className="title-switch-type-bar__modal-input"
            type="text"
            maxlength={4}
            placeholder="请输入种类"
            value={customValue}
            onInput={(e) => setCustomValue(e.detail.value)}
          />
          <View
            className="title-switch-type-bar__modal-btn"
            onClick={add}
          >
            <Text>确定</Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
  )
}
