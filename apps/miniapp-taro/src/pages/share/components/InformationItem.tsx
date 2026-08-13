import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { rpx } from '@/utils/rpx'

/**
 * InformationItem 时间轴资讯卡片组件
 *
 * 对齐原项目 information-item/index.vue:
 * - 左侧时间轴(竖线 + 圆点)
 * - 右侧卡片(标题 + 内容 + 来源 + 浏览数 + 复制/分享按钮)
 */

export interface InformationItemData {
  id: string | number
  title: string
  content?: string
  /** 日期分组标题,如 "2026-08-13" */
  date?: string
  /** 来源 */
  source?: string
  /** 浏览数 */
  views?: number
  coverUrl?: string
}

export interface InformationItemProps {
  item: InformationItemData
  /** 是否显示时间轴竖线(每组第一项可不显示) */
  showTimeline?: boolean
  onClick?: (item: InformationItemData) => void
  onCopy?: (item: InformationItemData) => void
  onShare?: (item: InformationItemData) => void
}

const TIMELINE_COLOR = 'var(--color-brand-purple-soft, #9A99F3)'

export default function InformationItem({
  item,
  showTimeline = true,
  onClick,
  onCopy,
  onShare,
}: InformationItemProps) {
  const handleCopyClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    Taro.setClipboardData({
      data: `${item.title}\n${item.content || ''}`,
      success: () => Taro.showToast({ title: '已复制', icon: 'success' }),
      fail: () => Taro.showToast({ title: '复制失败', icon: 'none' }),
    })
    onCopy?.(item)
  }

  const handleShareClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    Taro.showShareMenu({
      withShareTicket: true,
    }).catch(() => {})
    onShare?.(item)
  }

  return (
    <View style={{ display: 'flex', flexDirection: 'row' }}>
      {showTimeline ? (
        <View
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginRight: rpx(16),
            paddingTop: rpx(8),
          }}
        >
          <View
            style={{
              width: rpx(16),
              height: rpx(16),
              borderRadius: '50%',
              background: TIMELINE_COLOR,
            }}
          />
          <View
            style={{
              flex: 1,
              width: 0,
              borderLeft: `${rpx(2)} dashed ${TIMELINE_COLOR}`,
            }}
          />
        </View>
      ) : null}
      <View
        style={{
          flex: 1,
          padding: rpx(10),
          marginBottom: rpx(25),
          borderRadius: rpx(20),
          background: 'var(--color-card)',
        }}
        onClick={() => onClick?.(item)}
      >
        {item.date ? (
          <Text
            style={{
              fontSize: rpx(26),
              color: TIMELINE_COLOR,
              display: 'block',
              marginBottom: rpx(8),
            }}
          >
            {item.date}
          </Text>
        ) : null}
        <Text
          style={{
            fontSize: rpx(28),
            fontWeight: 'bold',
            color: 'var(--color-foreground)',
            display: 'block',
            marginBottom: rpx(6),
          }}
        >
          {item.title}
        </Text>
        {item.content ? (
          <Text
            style={{
              fontSize: rpx(26),
              color: 'var(--color-muted-foreground)',
              lineHeight: 1.6,
              display: 'block',
            }}
          >
            {item.content}
          </Text>
        ) : null}
        <View
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: rpx(10),
          }}
        >
          <View style={{ display: 'flex', flexDirection: 'row', gap: rpx(8) }}>
            {item.source ? (
              <Text
                style={{
                  fontSize: rpx(22),
                  color: 'var(--color-muted-foreground)',
                }}
              >
                {item.source}
              </Text>
            ) : null}
            {typeof item.views === 'number' ? (
              <Text
                style={{
                  fontSize: rpx(22),
                  color: 'var(--color-muted-foreground)',
                }}
              >
                {item.views} 浏览
              </Text>
            ) : null}
          </View>
          <View style={{ display: 'flex', flexDirection: 'row', gap: rpx(16) }}>
            <Text
              style={{
                fontSize: rpx(22),
                color: 'var(--color-muted-foreground)',
              }}
              onClick={handleCopyClick}
            >
              📋
            </Text>
            <Text
              style={{
                fontSize: rpx(22),
                color: 'var(--color-muted-foreground)',
              }}
              onClick={handleShareClick}
            >
              🔗
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}
