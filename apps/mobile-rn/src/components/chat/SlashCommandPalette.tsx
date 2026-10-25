// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D117:斜杠命令面板。容器/视觉对齐 AgentSelector.tsx(modalMask + listDialogContent
// + header + 关闭),纯受控渲染:候选由 props 传入,选中只回调,零副作用。

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  BookOpen,
  CircleHelp,
  Code,
  Cpu,
  Eraser,
  FileText,
  Info,
  Languages,
  MessageSquarePlus,
  Mic,
  Minimize2,
  Newspaper,
  PenLine,
  X,
} from 'lucide-react-native'
import { tokens } from '../../theme/active-tokens'
import { rnRadius, rnType } from '@ihui/design-tokens'
import { rpx } from '../../utils/rpx'
import type { SlashCommand } from '../../lib/slash-commands'

/** 图标名 → 组件(与 SlashCommand.icon 字符串一一对应;未登记的名字不渲染图标) */
const SLASH_ICONS: Record<string, typeof Cpu> = {
  MessageSquarePlus,
  Eraser,
  Cpu,
  CircleHelp,
  Minimize2,
  Info,
  FileText,
  Languages,
  BookOpen,
  Code,
  PenLine,
  Newspaper,
  Mic,
}

const styles = StyleSheet.create({
  // ── 列表弹窗(与 AgentSelector / VoicePanel 同一容器档) ──
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
    fontSize: rnType.strong.size,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  listDialogClose: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── D117 命令面板内容 ──
  queryRow: {
    paddingHorizontal: rpx(32),
    paddingBottom: rpx(8),
  },
  queryText: {
    fontSize: rnType.label.size,
    color: tokens.text.tertiary,
  },
  list: {
    flexGrow: 0,
  },
  itemSlot: {
    marginHorizontal: rpx(32),
    marginBottom: rpx(8),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(16),
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(20),
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.muted,
  },
  itemHighlighted: {
    backgroundColor: tokens.surface.muted,
    borderWidth: 1,
    borderColor: tokens.brandAccent.deep,
  },
  itemPressed: {
    opacity: 0.85,
  },
  itemTextCol: {
    flex: 1,
    gap: rpx(4),
  },
  itemTitle: {
    fontSize: rnType.strong.size,
    color: tokens.text.primary,
  },
  itemDesc: {
    fontSize: rnType.label.size,
    color: tokens.text.secondary,
  },
  itemTrigger: {
    fontSize: rnType.label.size,
    color: tokens.text.tertiary,
  },
  emptyWrap: {
    paddingVertical: rpx(64),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: rnType.body.size,
    color: tokens.text.secondary,
  },
})

interface SlashCommandPaletteProps {
  /** 弹窗可见性(对齐 AgentSelector visible) */
  visible: boolean
  /** 当前过滤词(输入框文本,面板副标题展示用) */
  query: string
  /** 候选命令(调用方按 matchSlashCommands / resolveSlashCommands 结果给出) */
  commands: readonly SlashCommand[]
  /** i18n 取词(标题与空态走词包,端内零硬编码中文) */
  t: (key: string, params?: Record<string, string | number>) => string
  /** 选中命令回调(对齐 AgentSelector onSelect) */
  onSelect: (cmd: SlashCommand) => void
  /** 关闭弹窗(对齐 AgentSelector onClose) */
  onClose: () => void
}

/**
 * 斜杠命令面板:候选列表(title + description + trigger),第一项高亮,空态「无匹配命令」。
 */
export function SlashCommandPalette({
  visible,
  query,
  commands,
  t,
  onSelect,
  onClose,
}: SlashCommandPaletteProps) {
  if (!visible) return null
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalMask} onPress={onClose}>
        <Pressable style={styles.listDialogContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.listDialogHeader}>
            <Text style={styles.listDialogTitle}>{t('slashCmd.paletteTitle')}</Text>
            <Pressable hitSlop={8} onPress={onClose} style={styles.listDialogClose}>
              <X size={20} color={tokens.text.primary} />
            </Pressable>
          </View>
          {query !== '' ? (
            <View style={styles.queryRow}>
              <Text style={styles.queryText} numberOfLines={1}>
                {query}
              </Text>
            </View>
          ) : null}
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {commands.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>{t('slashCmd.paletteEmpty')}</Text>
              </View>
            ) : (
              commands.map((cmd, index) => {
                const Icon = cmd.icon === undefined ? undefined : SLASH_ICONS[cmd.icon]
                return (
                  // 按压态不写成函数形态的 style(Pressable 被 cssInterop 注册过,函数声明
                  // 会被展开成空对象)—— 外层裸 Pressable 只承接点击与无障碍语义,可视盒落子 View。
                  <Pressable
                    key={cmd.id}
                    onPress={() => onSelect(cmd)}
                    style={styles.itemSlot}
                    accessibilityRole="button"
                    accessibilityLabel={cmd.title}
                  >
                    {({ pressed }) => (
                      <View
                        style={[
                          styles.item,
                          index === 0 ? styles.itemHighlighted : null,
                          pressed ? styles.itemPressed : null,
                        ]}
                      >
                        {Icon === undefined ? null : (
                          <Icon size={18} color={tokens.text.secondary} />
                        )}
                        <View style={styles.itemTextCol}>
                          <Text style={styles.itemTitle} numberOfLines={1}>
                            {cmd.title}
                          </Text>
                          {cmd.description === undefined ? null : (
                            <Text style={styles.itemDesc} numberOfLines={2}>
                              {cmd.description}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.itemTrigger}>{cmd.trigger}</Text>
                      </View>
                    )}
                  </Pressable>
                )
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
