// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 纯抽取:从 ChatScreen 抽出底部输入条(D120 预算 / D123 意图)。零行为/视觉变更。
// D117:斜杠命令入口 —— 在 BottomActionBar **之外**挂「/」触发按钮 + SlashCommandPalette
// (两个新 prop 全可选;不传时渲染与抽取前逐字一致)。

import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Slash } from 'lucide-react-native'
import { BottomActionBar, type BottomActionBarProps } from '../../components/BottomActionBar'
import { tokens } from '../../theme/active-tokens'
import { rnGeometry, rnRadius } from '@ihui/design-tokens'
import { rpx } from '../../utils/rpx'
import { useI18n } from '../../i18n'
import {
  matchSlashCommands,
  resolveSlashCommands,
  type SlashCommand,
} from '../../lib/slash-commands'
import { SlashCommandPalette } from './SlashCommandPalette'

/**
 * 触发钮底距(相对屏底,safe-area 之外另加):输入条容器是 absolute bottom:0,
 * 收拢态内容高 = paddingTop 4 + 模型条 28 + gap 8 + 输入行 44 + paddingBottom 4 = 88,
 * 故 92 落在输入条顶沿之上 4,不与模型条配置钮 / 发送钮抢位。
 */
const SLASH_FAB_BOTTOM = 92

const styles = StyleSheet.create({
  slashFab: {
    position: 'absolute',
    right: rpx(24),
    width: rnGeometry.controlBox,
    height: rnGeometry.controlBox,
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
})

export interface ChatInputBarProps extends BottomActionBarProps {
  /** 点「/」触发钮(上层可用于埋点/自行开面板;组件内同时自开 palette) */
  onOpenSlashCommands?: () => void
  /** palette 选中命令回调(真实动作由上层按 cmd.id 接线) */
  onSlashCommand?: (cmd: SlashCommand) => void
  /** D43 票③ RN 会话屏挂载位(2026-10-23):调用方传入 <VoiceNote/>(触发钮+面板自含),
   *  渲染在输入条上方悬浮位;与「/」FAB 同档几何、自动让位。不传不渲染(契约同 D117 可选 prop)。 */
  voiceNoteNode?: ReactNode
}

/**
 * 底部输入条(对齐 Uniapp 输入区 + 功能开关 chip 行)。
 * 纯透传 BottomActionBar 的全部 props,不做任何渲染/逻辑改造 —— 预算(D120)、
 * 意图(D123)等后续票面在 BottomActionBar 内部演进,本组件仅作为 ChatScreen 的装配点。
 * D117 追加:onOpenSlashCommands 提供时,在其外侧渲染「/」触发钮并自管命令面板。
 */
export function ChatInputBar(props: ChatInputBarProps) {
  const { prompt, onOpenSlashCommands, onSlashCommand, voiceNoteNode } = props
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const [paletteVisible, setPaletteVisible] = useState(false)
  // palette 查询词:初始 '',打开瞬间用输入框当前文本播种(输入框文本即过滤词)。
  const [query, setQuery] = useState('')

  // 命令表:注册表只登记 i18n 键,本地化在装配点做一次(文案要打在本地化面上,
  // 否则中文用户按「总结」筛不出 /summary)。
  const commands = useMemo(() => resolveSlashCommands(t), [t])

  // 候选命令:以 '/' 开头按输入过滤,否则整表(按钮打开且输入框无 '/' 时看全量)。
  const candidates: readonly SlashCommand[] = query.startsWith('/')
    ? matchSlashCommands(query, commands)
    : commands

  const openPalette = () => {
    setQuery(prompt ?? '')
    setPaletteVisible(true)
    onOpenSlashCommands?.()
  }

  return (
    <>
      <BottomActionBar {...props} />
      {onOpenSlashCommands === undefined ? null : (
        <Pressable
          style={[styles.slashFab, { bottom: insets.bottom + SLASH_FAB_BOTTOM }]}
          onPress={openPalette}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={t('slashCmd.paletteTitle')}
        >
          <Slash size={rnGeometry.controlGlyph} color={tokens.text.secondary} />
        </Pressable>
      )}
      {voiceNoteNode ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.slashFab,
            {
              bottom: insets.bottom + SLASH_FAB_BOTTOM,
              // 与「/」FAB 同排;「/」在场时自动左移让位,不在场时占同一档右距
              right: rpx(24) + (onOpenSlashCommands === undefined ? 0 : rnGeometry.controlBox + 4),
              // 复用 slashFab 的 36×36 盒:触发钮自身只有 16px 图标 + padding,不居中会贴左上
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          {voiceNoteNode}
        </View>
      ) : null}
      <SlashCommandPalette
        visible={paletteVisible}
        query={query}
        commands={candidates}
        t={t}
        onSelect={(cmd) => {
          setPaletteVisible(false)
          onSlashCommand?.(cmd)
        }}
        onClose={() => setPaletteVisible(false)}
      />
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
