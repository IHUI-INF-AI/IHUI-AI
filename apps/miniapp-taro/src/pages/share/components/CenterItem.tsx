import { View, Text, Image } from '@tarojs/components'
import { rpx } from '@/utils/rpx'

/**
 * CenterItem 盒子卡片组件
 *
 * 对齐原项目 center-item/index.vue:
 * - 卡片(封面图 + 商家 + 标题 + 分类 + 浏览数)
 * - 数据源 information.all_data / aiData.all_data
 */

export interface CenterItemData {
  id: string | number
  title: string
  coverUrl?: string
  merchantName?: string
  merchantLogo?: string
  categoryName?: string
  views?: number
}

export interface CenterItemProps {
  items: CenterItemData[]
  onItemClick?: (item: CenterItemData) => void
}

export default function CenterItem({ items, onItemClick }: CenterItemProps) {
  if (!items.length) return null
  return (
    <View
      className="center-item-wrap"
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
        推荐卡片
      </Text>
      <View
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: rpx(16),
        }}
      >
        {items.map((item) => (
          <View
            key={item.id}
            className="center-item-card"
            style={{
              width: 'calc(50% - 8rpx)',
              borderRadius: rpx(20),
              overflow: 'hidden',
              background: 'var(--color-card)',
              boxShadow: '0 2rpx 8rpx rgba(0,0,0,0.05)',
            }}
            onClick={() => onItemClick?.(item)}
          >
            {item.coverUrl ? (
              <Image
                src={item.coverUrl}
                mode="aspectFill"
                style={{ width: '100%', height: rpx(200) }}
              />
            ) : null}
            <View style={{ padding: rpx(16) }}>
              {item.merchantName ? (
                <View
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: rpx(8),
                  }}
                >
                  {item.merchantLogo ? (
                    <Image
                      src={item.merchantLogo}
                      mode="aspectFit"
                      style={{
                        width: rpx(40),
                        height: rpx(40),
                        borderRadius: '50%',
                        marginRight: rpx(8),
                      }}
                    />
                  ) : null}
                  <Text
                    style={{
                      fontSize: rpx(22),
                      color: 'var(--color-muted-foreground)',
                    }}
                  >
                    {item.merchantName}
                  </Text>
                </View>
              ) : null}
              <Text
                style={{
                  fontSize: rpx(26),
                  fontWeight: '500',
                  color: 'var(--color-foreground)',
                  display: 'block',
                  marginBottom: rpx(6),
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.title}
              </Text>
              <View
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                {item.categoryName ? (
                  <Text
                    style={{
                      fontSize: rpx(20),
                      color: 'var(--color-muted-foreground)',
                    }}
                  >
                    {item.categoryName}
                  </Text>
                ) : null}
                {typeof item.views === 'number' ? (
                  <Text
                    style={{
                      fontSize: rpx(20),
                      color: 'var(--color-muted-foreground)',
                    }}
                  >
                    {item.views} 浏览
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
