// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text, Pressable, ScrollView } from 'react-native'
import { rnGeometry, rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import { Check, X } from 'lucide-react-native'
import { useAgentRuntime, toolDisplayKey, permissionDecisionWord } from '@ihui/shared'
// D111:审批面板的档名与首屏交代行同源取词(permissionTierWordKeys → @ihui/types 唯一真源),
// 认不出的档位落 unknown,绝不静默显示成 default。
import { permissionTierWordKeys } from '@ihui/shared/chat'
import { Input, Loading } from '@ihui/ui-native'
import type { AgentRuntimePanelProps } from '@ihui/types'
export type { AgentRuntimePanelLabels, AgentRuntimePanelProps } from '@ihui/types'

import { getTokens } from '../../theme/tokens'

/** Tailwind 默认调色板的字面值(与端内既有 className 逐值同色,不做近似换色)。
 *  red500(#ef4444) 已并入派生令牌 danger.DEFAULT(rnDarkTokens.danger.DEFAULT ← --color-danger),
 *  改用 tk.danger.DEFAULT 跟随主题、消除第二真相(门 93 R8 回归修复)。 */
const PALETTE = {
  white: '#FFFFFF',
  orange500: '#f97316',
  amber200: '#fde68a',
} as const

/** `leading-relaxed` = 1.625(无单位)→ 行高 = 字号 × 1.625,与 Tailwind 同算法 */
const LEADING_RELAXED = 1.625

/**
 * Agent 运行时面板 —— 共享层唯一实现(RN + 小程序同源消费)。
 *
 * 零平台 API 约定:
 *  - 不读写存储、不导航、不调平台路由;所有端侧能力一律由调用端注入。
 *  - 本面板本身不需要存储/导航(状态全在 `useAgentRuntime` 内存态),因此**没有**加
 *    `kv`/`onNavigate` 这类无消费者的 prop —— 避免"只有一端传"的空槽。
 *  - 文案全部由端侧解析后传入(labels + t),共享层不 import 任何端 i18n。
 *
 * RN 等价性:每个节点的 className 原样保留(端内 NativeWind 语义不变),
 * 同时补一份等值 StyleSheet —— 小程序端各端 className 工具类不生成,
 * 由这份数值承接几何,两端同一份取值。
 */
export function AgentRuntimePanel({
  sessionId: initialSessionId,
  labels,
  t,
  colorScheme = 'light',
}: AgentRuntimePanelProps) {
  const tk = getTokens(colorScheme)
  const {
    status,
    input,
    setInput,
    sessionId,
    plan,
    output,
    error,
    permission,
    handleSend,
    handleStop,
    handleClear,
  } = useAgentRuntime(initialSessionId)

  // 界面禁止直显英文工具码名:内置工具映射为本地化功能名,插件/MCP 动态名回落原样
  const permToolKey = permission?.toolName ? toolDisplayKey(permission.toolName) : null
  const permToolLabel = permission?.toolName
    ? permToolKey
      ? t(`taskStatus.${permToolKey}`)
      : permission.toolName
    : 'unknown'

  // 根上必须带卡片圆角：小程序侧的根走卡片角色档，而本屏此前整份文件没有任何圆角，
  // 于是同一块运行时面板在一端是圆角卡、另一端是方角块。
  // 这里刻意写**角色名**而不是档位名：角色门在文件没有任何身份声明时会退回"按文件名推角色"，
  // 而 AgentRuntimePanel 这个名字推出来的是面板档，会与对端(自称卡片)不同值 —— 两端必须同一身份同一档。
  // (刻意不在这条注释里写档位名与数值：对账门的提取式会读注释文本。)
  return (
    <View
      className="flex-1"
      style={{
        backgroundColor: tk.surface.card,
        borderRadius: rnRadiusFor.card,
        flex: 1,
      }}
    >
      <View
        className="flex-row items-center px-3 py-2"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: rnSpacing.md,
          paddingVertical: rnSpacing.sm,
        }}
      >
        <Text
          className="text-sm font-semibold"
          style={{
            color: tk.text.secondary,
            fontSize: rnType.body.size,
            lineHeight: rnType.body.lineHeight,
            fontWeight: '600',
          }}
        >
          {labels.title}
        </Text>
        {sessionId ? (
          <Text
            className="ml-2 text-xs"
            style={{
              color: tk.text.tertiary,
              fontSize: rnType.label.size,
              lineHeight: rnType.label.lineHeight,
              marginLeft: rnSpacing.sm,
            }}
            numberOfLines={1}
          >
            #{sessionId.slice(0, 8)}
          </Text>
        ) : null}
        {status === 'running' ? <Loading size="sm" style={{ marginLeft: rnSpacing.sm }} /> : null}
        {status === 'completed' ? <Check size={12} color={tk.success.deep} /> : null}
        {status === 'failed' ? <X size={12} color={tk.danger.bright} /> : null}
        <View className="flex-1" style={{ flex: 1 }} />
        <Pressable
          onPress={handleClear}
          disabled={status === 'running'}
          className="rounded-md px-2 py-1 active:opacity-60"
          style={{
            backgroundColor: tk.surface.muted,
            borderRadius: rnRadius.md,
            paddingHorizontal: rnSpacing.sm,
            paddingVertical: rnSpacing.xs,
          }}
        >
          <Text
            className="text-xs"
            style={{
              color: tk.text.tertiary,
              fontSize: rnType.label.size,
              lineHeight: rnType.label.lineHeight,
            }}
          >
            {labels.clear}
          </Text>
        </Pressable>
      </View>

      {/* minHeight 与小程序同档(120):短内容时面板不塌成一条,两端同形;
          maxHeight 走 geometry.runtimePanelScrollMaxHeight,两端同值无分支 —— 两端父级都是
          随内容撑开的流式布局(RN 分享屏外层 ScrollView / 小程序页根 min-h-screen),
          不封顶时记录一长就把输入行顶出首屏 */}
      <ScrollView
        className="flex-1 px-3 py-3"
        style={{
          minHeight: 120,
          maxHeight: rnGeometry.runtimePanelScrollMaxHeight,
          flex: 1,
          paddingHorizontal: rnSpacing.md,
          paddingVertical: rnSpacing.md,
        }}
      >
        {plan ? (
          <View
            className="mb-3 rounded-md border p-3"
            style={{
              borderColor: tk.border.light,
              backgroundColor: tk.surface.muted,
              marginBottom: rnSpacing.md,
              borderRadius: rnRadius.md,
              borderWidth: 1,
              padding: rnSpacing.md,
            }}
          >
            <Text
              className="mb-1.5 text-xs font-medium"
              style={{
                color: tk.text.tertiary,
                fontSize: rnType.label.size,
                lineHeight: rnType.label.lineHeight,
                fontWeight: '500',
                marginBottom: rnSpacing['xs-loose'],
              }}
            >
              {labels.plan}
            </Text>
            <Text
              className="text-xs leading-relaxed"
              style={{
                color: tk.text.secondary,
                fontSize: rnType.label.size,
                lineHeight: rnType.label.size * LEADING_RELAXED,
              }}
            >
              {plan}
            </Text>
          </View>
        ) : null}

        {permission ? (
          <View
            className="mb-3 rounded-md border border-amber-200 p-3"
            style={{
              backgroundColor: tk.warning.amberLight,
              marginBottom: rnSpacing.md,
              borderRadius: rnRadius.md,
              borderWidth: 1,
              borderColor: PALETTE.amber200,
              padding: rnSpacing.md,
            }}
          >
            <Text
              className="mb-1.5 text-xs font-medium"
              style={{
                color: tk.warning.amberText,
                fontSize: rnType.label.size,
                lineHeight: rnType.label.lineHeight,
                fontWeight: '500',
                marginBottom: rnSpacing['xs-loose'],
              }}
            >
              {labels.permission}:{' '}
              {permissionDecisionWord(permission.decision, (k) => t(`stepDecision.${k}`))}
            </Text>
            <Text
              className="text-xs"
              style={{
                color: tk.text.secondary,
                fontSize: rnType.label.size,
                lineHeight: rnType.label.lineHeight,
              }}
            >
              {labels.permissionTool}: {permToolLabel} · {labels.permissionLevel}:{' '}
              {permission.dangerLevel ?? 'read'} · {labels.permissionMode}:{' '}
              {t(permissionTierWordKeys(permission.mode).title)}
            </Text>
          </View>
        ) : null}

        {output ? (
          <View className="mb-3" style={{ marginBottom: rnSpacing.md }}>
            <Text
              className="mb-1.5 text-xs font-medium"
              style={{
                color: tk.text.tertiary,
                fontSize: rnType.label.size,
                lineHeight: rnType.label.lineHeight,
                fontWeight: '500',
                marginBottom: rnSpacing['xs-loose'],
              }}
            >
              {labels.output}
            </Text>
            <Text
              className="text-sm leading-relaxed"
              style={{
                color: tk.text.secondary,
                fontSize: rnType.body.size,
                lineHeight: rnType.body.size * LEADING_RELAXED,
              }}
            >
              {output}
            </Text>
          </View>
        ) : null}

        {error ? (
          <View
            className="mb-3 rounded-md border p-3"
            style={{
              borderColor: tk.danger.light,
              backgroundColor: tk.error.bg,
              marginBottom: rnSpacing.md,
              borderRadius: rnRadius.md,
              borderWidth: 1,
              padding: rnSpacing.md,
            }}
          >
            <Text
              className="mb-1 text-xs font-medium"
              style={{
                color: tk.error.text,
                fontSize: rnType.label.size,
                lineHeight: rnType.label.lineHeight,
                fontWeight: '500',
                marginBottom: rnSpacing.xs,
              }}
            >
              {labels.error}
            </Text>
            <Text
              className="text-xs"
              style={{
                color: tk.error.text,
                fontSize: rnType.label.size,
                lineHeight: rnType.label.lineHeight,
              }}
            >
              {error}
            </Text>
          </View>
        ) : null}

        {!plan && !output && !error && !permission ? (
          <View
            className="items-center py-8"
            style={{ alignItems: 'center', paddingVertical: rnSpacing['3xl'] }}
          >
            <Text
              className="text-sm"
              style={{
                color: tk.text.tertiary,
                fontSize: rnType.body.size,
                lineHeight: rnType.body.lineHeight,
              }}
            >
              {labels.empty}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View className="p-3" style={{ padding: rnSpacing.md }}>
        <View
          className="flex-row items-end"
          style={{ flexDirection: 'row', alignItems: 'flex-end' }}
        >
          <Input
            value={input}
            onChangeText={setInput}
            placeholder={labels.placeholder}
            editable={status !== 'running'}
            multiline
            className="h-auto min-h-[120px] min-h-[60px] flex-1 rounded-sm border p-2 text-sm"
            style={{
              borderColor: tk.border.light,
              backgroundColor: tk.surface.card,
              color: tk.text.primary,
              flex: 1,
              minHeight: 60,
              borderRadius: rnRadius.sm,
              borderWidth: 1,
              padding: rnSpacing.sm,
              fontSize: rnType.body.size,
              lineHeight: rnType.body.lineHeight,
            }}
          />
          {status === 'running' ? (
            <Pressable
              onPress={handleStop}
              className="ml-2 h-9 items-center justify-center rounded-md bg-red-500 px-3 active:opacity-60"
              style={{
                marginLeft: rnSpacing.sm,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: rnRadius.md,
                backgroundColor: tk.danger.DEFAULT,
                paddingHorizontal: rnSpacing.md,
              }}
            >
              <Text
                className="text-xs text-white"
                style={{
                  color: PALETTE.white,
                  fontSize: rnType.label.size,
                  lineHeight: rnType.label.lineHeight,
                }}
              >
                {labels.stop}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleSend}
              disabled={!input.trim()}
              className="ml-2 h-9 items-center justify-center rounded-md bg-orange-500 px-3 disabled:opacity-40 active:opacity-60"
              style={{
                marginLeft: rnSpacing.sm,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: rnRadius.md,
                backgroundColor: PALETTE.orange500,
                paddingHorizontal: rnSpacing.md,
                opacity: input.trim() ? 1 : 0.4,
              }}
            >
              <Text
                className="text-xs text-white"
                style={{
                  color: PALETTE.white,
                  fontSize: rnType.label.size,
                  lineHeight: rnType.label.lineHeight,
                }}
              >
                {labels.send}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  )
}

export default AgentRuntimePanel
