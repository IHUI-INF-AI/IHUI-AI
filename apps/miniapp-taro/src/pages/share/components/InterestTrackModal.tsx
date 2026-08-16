import { View, Text, ScrollView } from '@tarojs/components'
import { useState } from 'react'
import { rpx } from '@/utils/rpx'

/**
 * InterestTrackModal 兴趣赛道选择弹窗
 *
 * 对齐原项目 Interest-track-modal.vue(备用组件,原项目 share/index.vue 未实际 import)。
 * 底部弹出式多选弹窗,首次进入 share 页时显示(由 share/index.tsx 通过 storage 控制)。
 */

export interface TrackItem {
  id: string | number
  name: string
  desc?: string
  icon?: string
  selected?: boolean
}

export interface InterestTrackModalProps {
  visible?: boolean
  tracks?: TrackItem[]
  title?: string
  onConfirm?: (selectedTracks: TrackItem[]) => void
  onClose?: () => void
}

const DEFAULT_TRACKS: TrackItem[] = [
  { id: 'ai', name: 'AI 人工智能', desc: 'AI 模型、智能体、自动化' },
  { id: 'web3', name: 'Web3 区块链', desc: '区块链、加密货币、NFT' },
  { id: 'saas', name: 'SaaS 企业服务', desc: '企业软件、效率工具' },
  { id: 'ecommerce', name: '电商直播', desc: '直播带货、社交电商' },
  { id: 'education', name: '教育培训', desc: '在线教育、职业培训' },
  { id: 'content', name: '内容创作', desc: '自媒体、短视频、写作' },
  { id: 'design', name: '设计创意', desc: 'UI/UX、平面、3D' },
  { id: 'marketing', name: '营销推广', desc: '品牌、增长、SEO' },
]

export default function InterestTrackModal({
  visible = false,
  tracks = DEFAULT_TRACKS,
  title = '选择您感兴趣的赛道',
  onConfirm,
  onClose,
}: InterestTrackModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())

  if (!visible) return null

  const toggleTrack = (track: TrackItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(track.id)) {
        next.delete(track.id)
      } else {
        next.add(track.id)
      }
      return next
    })
  }

  const handleConfirm = () => {
    const selected = tracks.filter((t) => selectedIds.has(t.id))
    onConfirm?.(selected)
  }

  return (
    <View
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 3000,
        display: 'flex',
        alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
        }}
      />
      <View
        style={{
          position: 'relative',
          width: '100%',
          background: 'var(--color-card)',
          borderRadius: `${rpx(32)} ${rpx(32)} 0 0`,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <View style={{ padding: `${rpx(32)} ${rpx(32)} ${rpx(16)}` }}>
          <Text
            style={{
              fontSize: rpx(34),
              fontWeight: 'bold',
              color: 'var(--color-foreground)',
              display: 'block',
              textAlign: 'center',
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: rpx(24),
              color: 'var(--color-muted-foreground)',
              display: 'block',
              textAlign: 'center',
              marginTop: rpx(8),
            }}
          >
            选择感兴趣的赛道,获取个性化推荐
          </Text>
        </View>

        {/* 赛道列表 */}
        <ScrollView scrollY style={{ flex: 1, padding: `${rpx(16)} ${rpx(32)}` }}>
          <View style={{ display: 'flex', flexWrap: 'wrap', gap: rpx(16) }}>
            {tracks.map((track) => {
              const isSelected = selectedIds.has(track.id)
              return (
                <View
                  key={track.id}
                  style={{
                    width: `calc(50% - ${rpx(8)})`,
                    padding: rpx(20),
                    borderRadius: rpx(16),
                    borderWidth: rpx(2),
                    borderStyle: 'solid',
                    borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                    background: isSelected ? 'var(--color-primary)' : 'var(--color-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: rpx(6),
                  }}
                  onClick={() => toggleTrack(track)}
                >
                  <Text
                    style={{
                      fontSize: rpx(28),
                      fontWeight: 500,
                      color: isSelected ? '#fff' : 'var(--color-foreground)',
                    }}
                  >
                    {track.name}
                  </Text>
                  {track.desc ? (
                    <Text
                      style={{
                        fontSize: rpx(22),
                        color: isSelected
                          ? 'rgba(255,255,255,0.8)'
                          : 'var(--color-muted-foreground)',
                      }}
                    >
                      {track.desc}
                    </Text>
                  ) : null}
                </View>
              )
            })}
          </View>
        </ScrollView>

        {/* 底部按钮 */}
        <View
          style={{ padding: `${rpx(16)} ${rpx(32)} ${rpx(32)}`, display: 'flex', gap: rpx(16) }}
        >
          <View
            style={{
              flex: 1,
              padding: `${rpx(20)} 0`,
              borderRadius: rpx(12),
              background: 'var(--color-muted)',
              textAlign: 'center',
            }}
            onClick={onClose}
          >
            <Text style={{ fontSize: rpx(28), color: 'var(--color-muted-foreground)' }}>跳过</Text>
          </View>
          <View
            style={{
              flex: 1,
              padding: `${rpx(20)} 0`,
              borderRadius: rpx(12),
              background: 'var(--color-primary)',
              textAlign: 'center',
            }}
            onClick={handleConfirm}
          >
            <Text style={{ fontSize: rpx(28), color: '#fff', fontWeight: 500 }}>
              确认选择{selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}
