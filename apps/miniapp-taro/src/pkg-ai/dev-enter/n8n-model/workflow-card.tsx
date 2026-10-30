// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'

/** 列表行载荷来自 /workflows/n8n(字段可能缺),这里归一成展示形,不凭空造后端新字段。 */
export interface WorkflowCardItem {
  id: string
  name: string
  desc: string
  active: boolean
  calls: number
  updatedAt: string
}

function asText(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asCount(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** 原始行 → 卡片数据(active 是后端唯一可靠状态位,与 RN mapWorkflow 同口径) */
export function normalizeWorkflow(raw: Record<string, unknown>): WorkflowCardItem {
  return {
    id: asText(raw.id),
    name: asText(raw.name) || asText(raw.title),
    desc: asText(raw.description) || asText(raw.desc),
    active: raw.active === true,
    calls: asCount(raw.calls),
    updatedAt: asText(raw.updatedAt) || asText(raw.createTime),
  }
}

interface WorkflowCardProps {
  item: WorkflowCardItem
  defaultName: string
  onOpen: (item: WorkflowCardItem) => void
  onToggle: (item: WorkflowCardItem) => void
  onEdit: (item: WorkflowCardItem) => void
}

/**
 * 列表卡片:对齐 RN N8nModelScreen 的 cardHead(名称 + 状态徽章)/ cardDesc /
 * cardMeta(调用次数 + 更新时间)/ cardActions(启停 + 编辑)四段结构。
 */
export default function WorkflowCard({
  item,
  defaultName,
  onOpen,
  onToggle,
  onEdit,
}: WorkflowCardProps) {
  const { t } = useI18n()
  return (
    <View className="nm-list-item" onClick={() => onOpen(item)} hoverClass="opacity-60">
      <View className="flex items-center justify-between">
        <Text className="nm-list-name ihui-ellipsis flex-1">{item.name || defaultName}</Text>
        <Text
          className={`ml-[16rpx] shrink-0 rounded-md px-[12rpx] py-[6rpx] text-[length:22rpx] font-semibold ${
            item.active
              ? 'bg-[var(--color-success-light)] text-[color:var(--color-success)]'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {item.active ? t('n8nModel.running') : t('n8nModel.stopped')}
        </Text>
      </View>
      {item.desc ? <Text className="nm-list-desc text-ellipsis-2">{item.desc}</Text> : null}
      <View className="mt-[20rpx] flex flex-wrap items-center gap-[24rpx] text-[length:22rpx] text-[color:var(--color-text-tertiary)]">
        <Text>{t('n8nModel.calls', { count: item.calls })}</Text>
        {item.updatedAt ? <Text>{item.updatedAt}</Text> : null}
      </View>
      <View className="mt-[24rpx] flex items-center gap-[20rpx]">
        <View
          className={`flex h-[68rpx] items-center rounded-sm px-[20rpx] ${
            item.active ? 'bg-[var(--color-brand-accent)]' : 'bg-[var(--color-success)]'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            onToggle(item)
          }}
          hoverClass="opacity-60"
        >
          <Text
            className={`text-[length:28rpx] font-semibold ${
              item.active
                ? 'text-[color:var(--color-brand-accent-foreground)]'
                : 'text-[color:var(--color-success-foreground)]'
            }`}
          >
            {item.active ? t('n8nModel.actionStop') : t('n8nModel.actionStart')}
          </Text>
        </View>
        <View
          className="flex h-[68rpx] items-center rounded-lg border border-border px-[20rpx]"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(item)
          }}
          hoverClass="opacity-60"
        >
          <Text className="text-[length:28rpx] text-[color:var(--color-text-medium)]">
            {t('n8nModel.actionEdit')}
          </Text>
        </View>
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
