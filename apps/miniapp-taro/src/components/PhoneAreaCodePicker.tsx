import { View, Text, ScrollView } from '@tarojs/components'
import { useState, type ReactElement } from 'react'

/**
 * 手机区号选择器共享组件 — 对齐 zhs_app-ZZ login.vue 的 xiaicc + nation-box
 * 6 国下拉(+86/+1/+886/+852/+82/+81),下拉背景 linear-gradient(180deg, #EEF4FF 0%, #409EFF 100%)
 * 用 Fragment 渲染 xiaicc + nation-box 兄弟节点,避免 nation-box 点击冒泡到 xiaicc 的 toggle
 * 样式由各页面 CSS 定义 .xiaicc / .nation-box 等类名(支持各页差异)
 */

export interface PhoneAreaCodePickerProps {
  /** 当前区号,如 "+86" */
  value: string
  /** 选择区号回调 */
  onChange: (code: string) => void
  /** 父级输入框是否聚焦(影响右边框颜色) */
  focused?: boolean
}

interface NationItem {
  title: string
  content: string
  id: number
}

const NATION_DATA: NationItem[] = [
  { title: '中国', content: '+86', id: 1 },
  { title: '美国', content: '+1', id: 2 },
  { title: '台湾', content: '+886', id: 3 },
  { title: '香港', content: '+852', id: 4 },
  { title: '韩国', content: '+82', id: 5 },
  { title: '日本', content: '+81', id: 6 },
]

export default function PhoneAreaCodePicker({
  value,
  onChange,
  focused = false,
}: PhoneAreaCodePickerProps): ReactElement {
  const [nationShow, setNationShow] = useState(false)

  function selectnati(code: string): void {
    onChange(code)
    setNationShow(false)
  }

  return (
    <>
      <View
        className={`xiaicc ${focused ? 'xiaicc-focused' : ''}`}
        onClick={() => setNationShow((v) => !v)}
      >
        <Text className="input-area-code">{value}</Text>
        <View className="xiaicc-img" />
      </View>
      {nationShow ? (
        <View className="nation-box" catchMove>
          <View className="nation-boo">
            <ScrollView scrollY style={{ height: '280rpx' }}>
              {NATION_DATA.map((item) => (
                <View className="nationInfo" key={item.id}>
                  <View
                    className="nation-info1"
                    onClick={() => selectnati(item.content)}
                  >
                    <Text className="nation-name">{item.title}</Text>
                    <Text className="nation-code">{item.content}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </>
  )
}
