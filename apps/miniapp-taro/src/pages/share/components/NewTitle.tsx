import { View, Text } from '@tarojs/components'
import { rpx } from '@/utils/rpx'

/**
 * NewTitle 热门资讯列表组件
 *
 * 对齐原项目 new-title/index.vue:
 * - 圆点 + 标题列表
 * - 数据源 information.hot_data / aiData.hot_data
 */

export interface NewTitleItem {
  id: string | number
  title: string
}

export interface NewTitleProps {
  items: NewTitleItem[]
  onItemClick?: (item: NewTitleItem) => void
}

export default function NewTitle({ items, onItemClick }: NewTitleProps) {
  if (!items.length) return null
  return (
    <View
      className="new-title-wrap"
      style={{
        paddingTop: rpx(16),
        paddingBottom: rpx(16),
        paddingLeft: rpx(24),
        paddingRight: rpx(24),
      }}
    >
      <Text
        style={{
          fontSize: rpx(30),
          fontWeight: 'bold',
          color: 'var(--color-foreground)',
          marginBottom: rpx(16),
          display: 'block',
        }}
      >
        热门资讯
      </Text>
      {items.map((item) => (
        <View
          key={item.id}
          className="new-title-item"
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            height: rpx(60),
          }}
          onClick={() => onItemClick?.(item)}
        >
          <View
            style={{
              width: rpx(20),
              height: rpx(20),
              borderRadius: '50%',
              background: '#9f9f9f',
              marginRight: rpx(16),
              flexShrink: 0,
            }}
          />
          <Text
            style={{
              fontSize: rpx(28),
              color: 'var(--color-foreground)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {item.title}
          </Text>
        </View>
      ))}
    </View>
  )
}
