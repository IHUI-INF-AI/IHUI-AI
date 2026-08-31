// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useState, useMemo } from 'react'
import { useI18n, useTt, type TtFn } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'
import type { ModelUsageCategory } from '@ihui/shared/constants'
import type { LlmModel } from '@/api'
import type { ModelType } from './ModelTypeButton'
// 原项目 ModelList.vue 静态图标(本地副本 import,对齐 zhs_app-ZZ)
import mianLabelIcon from '@/assets/remote/images/default/mian_label.png'
import selectedModelIcon from '@/assets/remote/images/selected_model.png'
import rankoneIcon from '@/assets/remote/images/default/rankone.png'
import { rpx } from '@/utils/rpx'
import {
  categoryLabel as categoryLabelOf,
  categoryOf,
  collapseLabel,
  expandLabel,
  historyLabel,
  splitModelCatalog,
} from '@/utils/model-catalog'

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

const TYPE_LABELS = (tt: TtFn): Record<string, string> => ({
  talk: tt('ModelList.d1', '对话'),
  image: tt('modelPlaza.tabImage', '图像'),
  video: tt('aigc.list.catVideo', '视频'),
  audio: tt('aigc.list.catAudio', '音频'),
  videoa: tt('ai.chatMessageItem.digitalHuman', '数字人'),
  other: tt('ModelList.d2', '全能'),
})

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
  const { locale } = useI18n()
  const [historyExpanded, setHistoryExpanded] = useState(false)

  // 默认列表只保留"最新 + 对话类",其余全部收进历史模型折叠区(判定在后端,
  // 分组在 packages/shared,此处只做装配 — 见 utils/model-catalog.ts)
  const split = useMemo(() => splitModelCatalog(models), [models])
  // 当前选中项落在折叠区时自动展开,避免用户看不到自己选中的模型
  const selectedInArchived = useMemo(
    () => split.archived.some((g) => g.items.some((m) => m.id === selectedId)),
    [split.archived, selectedId],
  )
  const showArchived = historyExpanded || selectedInArchived

  const categoryLabel = (category: ModelUsageCategory): string => categoryLabelOf(category, locale)

  if (variant === 'popup') {
    // ===== popup 模式:对齐原项目 ModelList.vue(分类弹出列表 + slideUp 动画)=====
    if (loading) {
      return (
        <View style={{ padding: '10rpx 0 0' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <View
              key={i}
              className="flex items-center"
              style={{
                height: rpx(80),
                margin: '5rpx 0',
                padding: '0 15rpx',
                background: 'var(--color-muted)',
                borderRadius: rpx(15),
              }}
            >
              <View
                style={{
                  width: rpx(40),
                  height: rpx(40),
                  borderRadius: rpx(8),
                  background: 'var(--color-border)',
                }}
              />
              <View
                className="ml-[10rpx]"
                style={{
                  width: rpx(160),
                  height: rpx(16),
                  background: 'var(--color-border)',
                  borderRadius: rpx(4),
                }}
              />
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
          borderRadius: rpx(15),
          padding: '10rpx 0 0',
        }}
      >
        {/* 分类标题(对齐原项目 .title,display:none 在原项目但保留为视觉锚点)*/}
        {currentType && TYPE_LABELS(tt)[currentType] ? (
          <View style={{ padding: '0 15rpx', height: rpx(40), display: 'none' }}>
            <Text style={{ fontSize: rpx(24), fontWeight: 600 }}>
              {TYPE_LABELS(tt)[currentType]}
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
              {/* image_logo + chu-icon:对齐原项目 /static/images/default/mian_label.png */}
              <Image
                src={mianLabelIcon}
                mode="widthFix"
                style={{ width: rpx(40), height: rpx(40), borderRadius: rpx(8) }}
              />
              <Text
                className="ml-[10rpx]"
                style={{
                  fontSize: rpx(28),
                  color: 'var(--color-foreground)',
                  fontWeight: agentActive ? 'bold' : 'normal',
                }}
              >
                {tt('ModelList.text1', 'Agent模式')}
              </Text>
              {/* chu-power 徽章:对齐原项目 mian_label.png */}
              <Image
                src={mianLabelIcon}
                mode="widthFix"
                style={{ width: rpx(40), height: rpx(40), marginLeft: rpx(10) }}
              />
            </View>
            {agentActive ? (
              <View
                className="flex items-center justify-center"
                style={{
                  width: rpx(32),
                  height: rpx(32),
                  borderRadius: '50%',
                  background: 'var(--color-foreground)',
                }}
              >
                {/* selected-icon:对齐原项目 /static/images/selected_model.png 80rpx×80rpx */}
                <Image
                  src={selectedModelIcon}
                  mode="widthFix"
                  style={{ width: rpx(80), height: rpx(80) }}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {/* 默认模型列表项:只展示"最新 + 对话类" */}
        {split.primary.map((model, index) => {
          const selected = model.id === selectedId
          return (
            <View
              key={model.id}
              className={cn('ai-chu-row ai-slide-up', selected && 'ai-chu-row-active')}
              style={{ animationDelay: `${index * 0.08}s` }}
              onClick={() => onSelect?.(model)}
            >
              <View className="flex items-center">
                {/* 模型 logo:对齐原项目 image_logo + chu-icon 40rpx 圆角 8rpx
                    原项目用 :src="item.img"(动态),LlmModel 无 img 字段,保留首字母占位 */}
                <View
                  className="flex items-center justify-center"
                  style={{
                    width: rpx(40),
                    height: rpx(40),
                    borderRadius: rpx(8),
                    background: 'var(--color-muted)',
                  }}
                >
                  <Text style={{ fontSize: rpx(20), color: 'var(--color-muted-foreground)' }}>
                    {model.name.charAt(0)}
                  </Text>
                </View>
                {/* 模型名:对齐原项目 .chu-text 28rpx color #333 */}
                <Text
                  className="ml-[10rpx]"
                  style={{
                    fontSize: rpx(28),
                    color: 'var(--color-foreground)',
                    fontWeight: selected ? 'bold' : 'normal',
                  }}
                >
                  {model.name}
                </Text>
                {/* chu-power 排名第一徽章:对齐原项目 rankone.png(index === 0)*/}
                {index === 0 ? (
                  <Image
                    src={rankoneIcon}
                    mode="widthFix"
                    style={{ width: rpx(40), height: rpx(40), marginLeft: rpx(10) }}
                  />
                ) : null}
                {/* chu-power 徽章:对齐原项目 mian_label.png(始终显示)*/}
                <Image
                  src={mianLabelIcon}
                  mode="widthFix"
                  style={{ width: rpx(40), height: rpx(40), marginLeft: rpx(10) }}
                />
              </View>
              {/* 用途分类标注 + 选中态(对齐原项目 .selected-icon 32rpx + selected_model.png) */}
              <View className="flex items-center">
                <Text
                  style={{
                    fontSize: rpx(20),
                    color: 'var(--color-muted-foreground)',
                    marginRight: rpx(12),
                  }}
                >
                  {categoryLabel(categoryOf(model))}
                </Text>
                {selected ? (
                  <View
                    className="flex items-center justify-center"
                    style={{
                      width: rpx(32),
                      height: rpx(32),
                      borderRadius: rpx(16),
                      background: 'var(--color-foreground)',
                    }}
                  >
                    <Image
                      src={selectedModelIcon}
                      mode="widthFix"
                      style={{ width: rpx(80), height: rpx(80) }}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          )
        })}

        {/* ===== 历史模型折叠区(默认收起,点按钮才展开) ===== */}
        {split.archivedCount > 0 ? (
          <View
            className="ai-chu-row"
            style={{ background: 'var(--color-muted)', marginTop: rpx(10) }}
            onClick={() => setHistoryExpanded((v) => !v)}
          >
            <Text style={{ fontSize: rpx(26), color: 'var(--color-foreground)' }}>
              {`${historyLabel(locale)} (${split.archivedCount})`}
            </Text>
            <Text style={{ fontSize: rpx(24), color: 'var(--color-muted-foreground)' }}>
              {showArchived ? collapseLabel(locale) : expandLabel(locale)}
            </Text>
          </View>
        ) : null}

        {showArchived
          ? split.archived.map((group) => (
              <View key={`archived-${group.category}`}>
                {/* 分组标题:用途分类 + 数量(用间距分隔,不用 border 分割线)*/}
                <View style={{ padding: '16rpx 24rpx 4rpx' }}>
                  <Text style={{ fontSize: rpx(22), color: 'var(--color-muted-foreground)' }}>
                    {`${categoryLabel(group.category)} · ${group.items.length}`}
                  </Text>
                </View>
                {group.items.map((model) => {
                  const selected = model.id === selectedId
                  return (
                    <View
                      key={model.id}
                      className={cn('ai-chu-row', selected && 'ai-chu-row-active')}
                      onClick={() => onSelect?.(model)}
                    >
                      <View className="flex items-center">
                        <View
                          className="flex items-center justify-center"
                          style={{
                            width: rpx(40),
                            height: rpx(40),
                            borderRadius: rpx(8),
                            background: 'var(--color-muted)',
                          }}
                        >
                          <Text
                            style={{ fontSize: rpx(20), color: 'var(--color-muted-foreground)' }}
                          >
                            {model.name.charAt(0)}
                          </Text>
                        </View>
                        <Text
                          className="ml-[10rpx]"
                          style={{
                            fontSize: rpx(26),
                            color: 'var(--color-foreground)',
                            fontWeight: selected ? 'bold' : 'normal',
                          }}
                        >
                          {model.name}
                        </Text>
                      </View>
                      <View className="flex items-center">
                        <Text
                          style={{
                            fontSize: rpx(20),
                            color: 'var(--color-muted-foreground)',
                            marginRight: rpx(12),
                          }}
                        >
                          {categoryLabel(group.category)}
                        </Text>
                        {selected ? (
                          <View
                            className="flex items-center justify-center"
                            style={{
                              width: rpx(32),
                              height: rpx(32),
                              borderRadius: rpx(16),
                              background: 'var(--color-foreground)',
                            }}
                          >
                            <Image
                              src={selectedModelIcon}
                              mode="widthFix"
                              style={{ width: rpx(80), height: rpx(80) }}
                            />
                          </View>
                        ) : null}
                      </View>
                    </View>
                  )
                })}
              </View>
            ))
          : null}
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
      {/* 默认列表:只展示"最新 + 对话类" */}
      {split.primary.map((model) => {
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
              <Text className="text-sm font-medium text-muted-foreground">
                {model.name.charAt(0)}
              </Text>
            </View>
            <View className="flex-1 min-w-0">
              <View className="flex items-center">
                <Text className="text-sm font-medium text-foreground truncate">{model.name}</Text>
                {selected && <Text className="ml-2 text-xs text-primary">✓</Text>}
              </View>
              <Text className="text-xs text-muted-foreground truncate">{model.provider}</Text>
            </View>
            <Text className="ml-2 text-xs text-muted-foreground shrink-0">
              {categoryLabel(categoryOf(model))}
            </Text>
          </View>
        )
      })}

      {/* ===== 历史模型折叠区(默认收起) ===== */}
      {split.archivedCount > 0 ? (
        <View
          className="flex items-center justify-between px-3 py-2.5 mb-2 rounded-lg bg-muted"
          onClick={() => setHistoryExpanded((v) => !v)}
        >
          <Text className="text-sm text-foreground">
            {`${historyLabel(locale)} (${split.archivedCount})`}
          </Text>
          {/* 开合指示用文字而非图标字形:项目守门(11h)禁止在 UI 图标位使用
              emoji / 符号字符做图标,小程序端也没有 lucide 可用,故用中文状态词 */}
          <Text className="text-sm text-muted-foreground">
            {showArchived ? collapseLabel(locale) : expandLabel(locale)}
          </Text>
        </View>
      ) : null}

      {showArchived
        ? split.archived.map((group) => (
            <View key={`archived-${group.category}`} className="mb-2">
              <View className="px-3 pt-2 pb-1">
                <Text className="text-xs text-muted-foreground">
                  {`${categoryLabel(group.category)} · ${group.items.length}`}
                </Text>
              </View>
              {group.items.map((model) => {
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
                      <Text className="text-sm font-medium text-muted-foreground">
                        {model.name.charAt(0)}
                      </Text>
                    </View>
                    <View className="flex-1 min-w-0">
                      <View className="flex items-center">
                        <Text className="text-sm font-medium text-foreground truncate">
                          {model.name}
                        </Text>
                        {selected && <Text className="ml-2 text-xs text-primary">✓</Text>}
                      </View>
                      <Text className="text-xs text-muted-foreground truncate">
                        {model.provider}
                      </Text>
                    </View>
                    <Text className="ml-2 text-xs text-muted-foreground shrink-0">
                      {categoryLabel(group.category)}
                    </Text>
                  </View>
                )
              })}
            </View>
          ))
        : null}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
