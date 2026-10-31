// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 纯抽取:从 ChatScreen 抽出「选择 Agent」弹窗(D114)。零行为/视觉变更。

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Sparkles, X } from 'lucide-react-native'
import { tokens } from '../../theme/active-tokens'
import { rnGeometry, rnRadius } from '@ihui/design-tokens'
import { rpx } from '../../utils/rpx'
import AgentList, { type AgentListItem } from '../../components/AgentList'

const styles = StyleSheet.create({
  // ── 列表弹窗(ModelList / AgentList 共用容器) ──
  modalMask: {
    flex: 1,
    backgroundColor: tokens.overlay.modal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listDialogContent: {
    width: '88%',
    maxHeight: '70%',
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius.xl,
    overflow: 'hidden',
  },
  listDialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(20),
    backgroundColor: tokens.surface.card,
  },
  listDialogTitle: {
    fontSize: rnGeometry.textStrong,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  listDialogClose: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── 当前人格摘要区(D114:列表上方呈现选中 Agent 的人格/角色) ──
  personaWrap: {
    marginHorizontal: rpx(32),
    marginBottom: rpx(12),
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(20),
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.sm,
    gap: rpx(8),
  },
  personaLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
  },
  personaLabel: {
    fontSize: rnGeometry.textLabel,
    fontWeight: '600',
    color: tokens.brandAccent.deep,
  },
  personaName: {
    fontSize: rnGeometry.textBody,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  personaDesc: {
    fontSize: rnGeometry.textLabel,
    lineHeight: 18,
    color: tokens.text.secondary,
  },
  personaMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
  },
  personaMetaChip: {
    paddingHorizontal: rpx(12),
    paddingVertical: rpx(4),
    backgroundColor: tokens.brandAccent.light,
    borderRadius: rnRadius.md,
  },
  personaMetaText: {
    fontSize: rnGeometry.textCaption,
    color: tokens.brandAccent.deep,
  },
})

interface AgentSelectorProps {
  /** 弹窗可见性(对齐 ChatScreen agentListVisible) */
  visible: boolean
  /** 关闭弹窗(对齐 setAgentListVisible(false)) */
  onClose: () => void
  /** 待选 Agent 列表(对齐 agentListItems) */
  items: AgentListItem[]
  /** 选中 Agent 回调(对齐 handleAgentSelect) */
  onSelect: (id: string) => void
  /**
   * 当前选中 Agent id(可选)。原样透传给 <AgentList selectedId>,走组件原生选中高亮;
   * 同时在列表上方渲染「当前人格」摘要。不传 = 无高亮、无摘要区。
   */
  selectedAgentId?: string
  /**
   * 行副标题字段(可选,D114 补口)。原样透传给 <AgentList subtitleField>,
   * 让每行在 name 下渲染一行人格小字;不传 = 列表行保持既有单行结构。
   * 「当前人格」摘要区不受影响,仍走 description→prologue 回落。
   */
  subtitleField?: 'description' | 'prologue'
}

/**
 * Agent 选择器弹窗(对齐 Uniapp ai_index.vue 行 34 AgentList)。
 * 选中后由 ChatScreen 的 onSelect 负责跳转 AiAssistantN8n。
 */
export function AgentSelector({
  visible,
  onClose,
  items,
  onSelect,
  selectedAgentId,
  subtitleField,
}: AgentSelectorProps) {
  if (!visible) return null
  // 人格摘要只对「能定位到的选中项」渲染;未选中 / 未命中 / 无文案 ⇒ 整区不渲染(不留空盒子)。
  const personaItem = selectedAgentId
    ? items.find((item) => item.id === selectedAgentId)
    : undefined
  const personaText = personaItem?.description?.trim() || personaItem?.prologue?.trim() || ''
  const personaMeta = [personaItem?.category?.trim(), personaItem?.source?.trim()].filter(
    (v): v is string => v !== undefined && v !== '',
  )
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalMask} onPress={onClose}>
        <Pressable style={styles.listDialogContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.listDialogHeader}>
            <Text style={styles.listDialogTitle}>选择 Agent</Text>
            <Pressable hitSlop={8} onPress={onClose} style={styles.listDialogClose}>
              <X size={20} color={tokens.text.primary} />
            </Pressable>
          </View>
          {/* 当前人格:name + description(缺省回落 prologue);category/source 以胶囊补注 */}
          {personaItem && personaText ? (
            <View style={styles.personaWrap}>
              <View style={styles.personaLabelRow}>
                <Sparkles size={12} color={tokens.brandAccent.deep} />
                <Text style={styles.personaLabel}>当前人格</Text>
              </View>
              <Text style={styles.personaName} numberOfLines={1}>
                {personaItem.name}
              </Text>
              <Text style={styles.personaDesc} numberOfLines={3}>
                {personaText}
              </Text>
              {personaMeta.length > 0 ? (
                <View style={styles.personaMetaRow}>
                  {personaMeta.map((meta) => (
                    <View key={meta} style={styles.personaMetaChip}>
                      <Text style={styles.personaMetaText}>{meta}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
          {/* AgentList 是弹窗唯一弹性块(flex:1 内部滚动);固定 header 不被压缩
              (同 HomeScreen 模型弹窗 flexShrink 根治模式,2026-10-15) */}
          <AgentList
            style={{ flex: 1 }}
            items={items}
            onItemClick={onSelect}
            selectedId={selectedAgentId}
            subtitleField={subtitleField}
          />
        </Pressable>
      </Pressable>
    </Modal>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
