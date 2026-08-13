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
    backgroundColor: '#eee',
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    borderRadius: '16rpx',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4rpx 0',
    border: '1px solid #eaeaea',
  },
  barItem: {
    flex: 1,
    margin: '0 6rpx',
    height: '52rpx',
    borderRadius: '15rpx',
    color: '#d8d8d8',
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
    color: '#3D3D3D',
    fontSize: '28rpx',
    fontWeight: 'bold',
    background: '#FFFFFF',
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