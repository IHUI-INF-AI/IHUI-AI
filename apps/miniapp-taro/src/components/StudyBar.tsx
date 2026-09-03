// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text } from '@tarojs/components'
import { useState, type CSSProperties } from 'react'

export interface StudyBarItem {
  id: number
  name: string
}

export interface StudyBarProps {
  barList: StudyBarItem[]
  onChange?: (item: StudyBarItem) => void
  className?: string
}

const styles: Record<string, CSSProperties> = {
  headBar: {
    width: '100%',
    boxSizing: 'border-box',
    marginBottom: '18rpx',
  },
  colorBg: {
    padding: '2rpx',
    borderRadius: '15rpx',
    overflow: 'hidden',
    width: '100%',
  },
  colorCont: {
    width: '100%',
    backgroundColor: 'var(--color-muted)',
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    borderRadius: '16rpx',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4rpx 0',
    border: '1px solid var(--color-border)',
  },
  barItem: {
    flex: 1,
    margin: '0 6rpx',
    height: '52rpx',
    borderRadius: '15rpx',
    color: 'var(--color-muted-foreground)',
    fontSize: '28rpx',
    fontWeight: 'normal',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as CSSProperties,
  barItemSelect: {
    flex: 1,
    margin: '0 6rpx',
    height: '52rpx',
    borderRadius: '15rpx',
    color: 'var(--color-foreground)',
    fontSize: '28rpx',
    fontWeight: 'bold',
    background: 'var(--color-card)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as CSSProperties,
}

/**
 * StudyBar 组件 — 对齐原项目 components/study/bar.vue
 * 水平标签栏，选中项高亮背景，点击切换。
 */
export default function StudyBar({ barList, onChange, className = '' }: StudyBarProps) {
  const [selectIndex, setSelectIndex] = useState(0)

  function handleSelect(item: StudyBarItem, index: number) {
    setSelectIndex(index)
    onChange?.(item)
  }

  return (
    <View style={styles.headBar} className={className}>
      <View style={styles.colorBg}>
        <View style={styles.colorCont}>
          {barList.map((item, index) => (
            <View
              key={item.id}
              style={selectIndex === index ? styles.barItemSelect : styles.barItem}
              onClick={() => handleSelect(item, index)}
            >
              <Text>{item.name}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
