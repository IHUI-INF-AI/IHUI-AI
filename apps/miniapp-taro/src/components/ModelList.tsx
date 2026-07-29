import { View, Text } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'
import { useTt } from '@/i18n'
import type { LlmModel } from '@/api'
import type { ModelType } from './ModelTypeButton'

export type ModelItem = LlmModel

/**
 * ModelList 模型列表
 *
 * 两种 variant:
 * - 'list'(默认,兼容旧调用):普通列表,显示 name + provider + 头像首字母
 * - 'popup'(首页专用):对齐原项目 ModelList.vue,分类弹出列表:
 *   - 6 类(talk/image/video/audio/videoa/other)按 ModelType 分组
 *   - Agent 模式选项(pitch === -1)
 *   - slideUp 入场动画(opacity + translateY 60rpx)
 *   - 选中态:border #000 + box-shadow + 加粗文字
 *   - 模型行:80rpx 高 + 15rpx 圆角 + 4rpx 边框 + 左侧 logo + 中间名称 + 右侧选中圆点
 */
export interface ModelListProps {
  models: ModelItem[]
  selectedId?: string | number
  onSelect?: (model: ModelItem) => void
  loading?: boolean
  /** 列表模式:'list' 普通 / 'popup' 弹出分类(首页专用)*/
  variant?: 'list' | 'popup'
  /** popup 模式:当前模型类型(用于决定渲染哪一类模型)*/
  currentType?: ModelType | ''
  /** popup 模式:Agent 模式是否选中 */
  agentActive?: boolean
  /** popup 模式:Agent 模式点击回调 */
  onAgentSelect?: () => void
}

const TYPE_LABELS: Record<string, string> = {
  talk: '对话',
  image: '图像',
  video: '视频',
  audio: '音频',
  videoa: '数字人',
  other: '全能',
}

export default function ModelList({
  models,
  selectedId,
  onSelect,
  loading = false,
  variant = 'list',
  currentType = '',
  agentActive = false,
  onAgentSelect,
}: ModelListProps) {
  const tt = useTt()

  if (variant === 'popup') {
    // ===== popup 模式:对齐原项目 ModelList.vue(分类弹出列表 + slideUp 动画)=====
    if (loading) {
      return (
        <View style={{ padding: '10rpx 0 0' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <View
              key={i}
              className="flex items-center"
              style={{ height: '80rpx', margin: '5rpx 0', padding: '0 15rpx', background: 'var(--color-muted)', borderRadius: '15rpx' }}
            >
              <View style={{ width: '40rpx', height: '40rpx', borderRadius: '8rpx', background: 'var(--color-border)' }} />
              <View className="ml-[10rpx]" style={{ width: '160rpx', height: '16rpx', background: 'var(--color-border)', borderRadius: '4rpx' }} />
            </View>
          ))}
        </View>
      )
    }

    if (!models.length) {
      return (
        <View className="flex items-center justify-center" style={{ padding: '40rpx 0' }}>
          <Text className="text-[24rpx] text-muted-foreground">
            {tt('model.empty', '暂无模型')}
          </Text>
        </View>
      )
    }

    return (
      <View
        className="flex flex-col"
        style={{
          background: 'transparent',
          borderRadius: '15rpx',
          padding: '10rpx 0 0',
        }}
      >
        {/* 分类标题(对齐原项目 .title,display:none 在原项目但保留为视觉锚点)*/}
        {currentType && TYPE_LABELS[currentType] ? (
          <View style={{ padding: '0 15rpx', height: '40rpx', display: 'none' }}>
            <Text style={{ fontSize: '24rpx', fontWeight: 600 }}>
              {TYPE_LABELS[currentType]}
            </Text>
          </View>
        ) : null}

        {/* Agent 模式选项(对齐原项目 chu-row pitch === -1)*/}
        {onAgentSelect ? (
          <View
            className={cn('ai-chu-row ai-slide-up', agentActive && 'ai-chu-row-active')}
            onClick={onAgentSelect}
          >
            <View className="flex items-center">
              <View className="flex items-center justify-center" style={{ width: '40rpx', height: '40rpx' }}>
                <Text style={{ fontSize: '28rpx' }}>🤖</Text>
              </View>
              <Text
                className="ml-[10rpx]"
                style={{
                  fontSize: '28rpx',
                  color: 'var(--color-foreground)',
                  fontWeight: agentActive ? 'bold' : 'normal',
                }}
              >
                Agent模式
              </Text>
            </View>
            {agentActive ? (
              <View
                className="flex items-center justify-center"
                style={{
                  width: '32rpx',
                  height: '32rpx',
                  borderRadius: '50%',
                  background: 'var(--color-foreground)',
                }}
              >
                <Text style={{ color: 'var(--color-card)', fontSize: '20rpx' }}>✓</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* 模型列表项 */}
        {models.map((model, index) => {
          const selected = model.id === selectedId
          return (
            <View
              key={model.id}
              className={cn('ai-chu-row ai-slide-up', selected && 'ai-chu-row-active')}
              style={{ animationDelay: `${index * 0.08}s` }}
              onClick={() => onSelect?.(model)}
            >
              <View className="flex items-center">
                {/* 模型 logo:对齐原项目 image_logo + chu-icon 40rpx 圆角 8rpx */}
                <View
                  className="flex items-center justify-center"
                  style={{
                    width: '40rpx',
                    height: '40rpx',
                    borderRadius: '8rpx',
                    background: 'var(--color-muted)',
                  }}
                >
                  <Text style={{ fontSize: '20rpx', color: 'var(--color-muted-foreground)' }}>
                    {model.name.charAt(0)}
                  </Text>
                </View>
                {/* 模型名:对齐原项目 .chu-text 28rpx color #333 */}
                <Text
                  className="ml-[10rpx]"
                  style={{
                    fontSize: '28rpx',
                    color: 'var(--color-foreground)',
                    fontWeight: selected ? 'bold' : 'normal',
                  }}
                >
                  {model.name}
                </Text>
              </View>
              {/* 选中态:对齐原项目 .selected-icon 32rpx 圆形黑色 */}
              {selected ? (
                <View
                  className="flex items-center justify-center"
                  style={{
                    width: '32rpx',
                    height: '32rpx',
                    borderRadius: '50%',
                    background: 'var(--color-foreground)',
                  }}
                >
                  <Text style={{ color: 'var(--color-card)', fontSize: '20rpx' }}>✓</Text>
                </View>
              ) : null}
            </View>
          )
        })}
      </View>
    )
  }

  // ===== 默认 'list' 模式:兼容 ChatDrawers 等旧调用 =====
  if (loading) {
    return (
      <View className="px-3 py-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} className="flex items-center py-3 animate-pulse">
            <View className="w-10 h-10 mr-3 rounded-lg bg-muted" />
            <View className="flex-1 space-y-2">
              <View className="h-3 w-1/3 rounded bg-muted" />
              <View className="h-2.5 w-2/3 rounded bg-muted" />
            </View>
          </View>
        ))}
      </View>
    )
  }

  if (!models.length) {
    return (
      <View className="flex items-center justify-center py-12">
        <Text className="text-sm text-muted-foreground">{tt('model.empty', '暂无模型')}</Text>
      </View>
    )
  }

  return (
    <View className="px-3 py-1">
      {models.map((model) => {
        const selected = model.id === selectedId
        return (
          <View
            key={model.id}
            className={`flex items-center py-2.5 px-3 mb-2 rounded-lg transition-colors ${
              selected ? 'bg-muted' : 'bg-card hover:bg-muted'
            }`}
            onClick={() => onSelect?.(model)}
          >
            <View className="flex items-center justify-center w-10 h-10 mr-3 rounded-lg bg-muted">
              <Text className="text-sm font-medium text-muted-foreground">{model.name.charAt(0)}</Text>
            </View>
            <View className="flex-1 min-w-0">
              <View className="flex items-center">
                <Text className="text-sm font-medium text-foreground truncate">{model.name}</Text>
                {selected && <Text className="ml-2 text-xs text-primary">✓</Text>}
              </View>
              <Text className="text-xs text-muted-foreground truncate">{model.provider}</Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}
