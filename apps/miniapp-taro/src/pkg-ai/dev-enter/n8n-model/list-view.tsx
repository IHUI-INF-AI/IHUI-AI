// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, useTt } from '@/i18n'
import { View, Text } from '@tarojs/components'
import { FocusInput } from '@/components/FocusField'
import WorkflowCard, { normalizeWorkflow, type WorkflowCardItem } from './workflow-card'

interface N8nListViewProps {
  list: Record<string, unknown>[]
  keyword: string
  loading: boolean
  onKeywordChange: (value: string) => void
  onCreate: () => void
  onOpen: (item: WorkflowCardItem) => void
  onToggle: (item: WorkflowCardItem) => void
  onEdit: (item: WorkflowCardItem) => void
}

/** 列表视图:对齐 RN N8nModelScreen 的 header / searchRow / FlatList 三段 */
export default function N8nListView({
  list,
  keyword,
  loading,
  onKeywordChange,
  onCreate,
  onOpen,
  onToggle,
  onEdit,
}: N8nListViewProps) {
  const { t } = useI18n()
  const tt = useTt()
  // 搜索在本地过滤(名称 + 描述,大小写不敏感),与共享屏 keyword 语义一致
  const keywordLower = keyword.trim().toLowerCase()
  const visible = keywordLower
    ? list.filter((it) =>
        `${String(it.name ?? it.title ?? '')} ${String(it.description ?? '')}`
          .toLowerCase()
          .includes(keywordLower),
      )
    : list

  return (
    <>
      <View className="nm-header">
        <Text className="nm-title">{t('n8nModel.title')}</Text>
        <Text className="nm-create-btn" onClick={onCreate}>
          {tt('devEnter.n8nModel.create', '新建')}
        </Text>
      </View>
      <View className="px-[20rpx]">
        <FocusInput
          className="nm-input"
          placeholderClass="text-[var(--color-text-tertiary)]"
          value={keyword}
          placeholder={t('n8nModel.searchPlaceholder')}
          onInput={(e) => onKeywordChange(e.detail.value)}
        />
      </View>
      <View className="nm-content">
        {loading ? (
          <Text className="nm-empty">{t('common.loading')}</Text>
        ) : visible.length ? (
          visible.map((item, index) => {
            const card = normalizeWorkflow(item)
            return (
              <WorkflowCard
                key={card.id || card.name || String(index)}
                item={card}
                defaultName={t('devEnter.n8nModel.defaultName')}
                onOpen={onOpen}
                onToggle={onToggle}
                onEdit={onEdit}
              />
            )
          })
        ) : (
          <Text className="nm-empty">{t('devEnter.n8nModel.empty')}</Text>
        )}
      </View>
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
