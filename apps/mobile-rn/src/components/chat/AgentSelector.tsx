// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// 纯抽取:从 ChatScreen 抽出「选择 Agent」弹窗(D114)。零行为/视觉变更。

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { X } from 'lucide-react-native'
import { tokens } from '../../theme/active-tokens'
import { rnRadius } from '@ihui/design-tokens'
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
    fontSize: 15,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  listDialogClose: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
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
}

/**
 * Agent 选择器弹窗(对齐 Uniapp ai_index.vue 行 34 AgentList)。
 * 选中后由 ChatScreen 的 onSelect 负责跳转 AiAssistantN8n。
 */
export function AgentSelector({ visible, onClose, items, onSelect }: AgentSelectorProps) {
  if (!visible) return null
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
          {/* AgentList 是弹窗唯一弹性块(flex:1 内部滚动);固定 header 不被压缩
              (同 HomeScreen 模型弹窗 flexShrink 根治模式,2026-10-15) */}
          <AgentList style={{ flex: 1 }} items={items} onItemClick={onSelect} />
        </Pressable>
      </Pressable>
    </Modal>
  )
}
