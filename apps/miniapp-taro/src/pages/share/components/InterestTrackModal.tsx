// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, t } from '@/i18n'
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
  { id: 'ai', name: t('shareInterestTrackModal.d1'), desc: t('shareInterestTrackModal.d2') },
  { id: 'web3', name: t('shareInterestTrackModal.d3'), desc: t('shareInterestTrackModal.d4') },
  { id: 'saas', name: t('shareInterestTrackModal.d5'), desc: t('shareInterestTrackModal.d6') },
  { id: 'ecommerce', name: t('shareInterestTrackModal.d7'), desc: t('shareInterestTrackModal.d8') },
  {
    id: 'education',
    name: t('shareInterestTrackModal.d9'),
    desc: t('shareInterestTrackModal.d10'),
  },
  { id: 'content', name: t('shareInterestTrackModal.d11'), desc: t('shareInterestTrackModal.d12') },
  { id: 'design', name: t('shareInterestTrackModal.d13'), desc: t('shareInterestTrackModal.d14') },
  {
    id: 'marketing',
    name: t('shareInterestTrackModal.d15'),
    desc: t('shareInterestTrackModal.d16'),
  },
]

export default function InterestTrackModal({
  visible = false,
  tracks = DEFAULT_TRACKS,
  title = t('shareInterestTrackModal.z1'),
  onConfirm,
  onClose,
}: InterestTrackModalProps) {
  const tt = useTt()
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
            {tt('tail.14', '选择感兴趣的赛道,获取个性化推荐')}
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
            <Text style={{ fontSize: rpx(28), color: 'var(--color-muted-foreground)' }}>
              {tt('shareInterestTrackModal.text1', '跳过')}
            </Text>
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
              {tt('tail.20', '确认选择{count}', {
                count: selectedIds.size > 0 ? `(${selectedIds.size})` : '',
              })}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
