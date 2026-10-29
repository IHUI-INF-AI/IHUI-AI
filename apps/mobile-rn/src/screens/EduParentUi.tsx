// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 家长端(edu/parent)共享排版件:页面骨架样式 + 空态/错误态。
 *
 * 为什么单独立一份:首页(`EduParentScreen`)、聚合账单(`EduParentBillsView`)、
 * 账单卡(`EduParentBillsCard`)三处都要"卡片 + 两端对齐读数行",各写一份必然漂移
 * (本仓已因"同一件事两处各写一遍"出过欠费口径事故)。样式表因此只在这里生成。
 *
 * 布局约束(守门 241 / docs/UI_GUIDELINES.md §13.4):
 * 读数行一律 `space-between`,读数文本 `flexShrink: 0`(行宽不够时不先压数字);
 * 标签侧 `flexShrink: 1` 让位。
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '@ihui/rn-app'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

export type ParentT = (key: string, params?: Record<string, string | number>) => string
export type ParentStyles = ReturnType<typeof createParentStyles>

export function createParentStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { ...rnType.heading, color: tk.text.primary },
    tabBar: { paddingHorizontal: rnSpacing.lg, paddingBottom: rnSpacing.md },
    body: { padding: rnSpacing.lg, gap: rnSpacing.md },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: rnSpacing.lg,
      gap: rnSpacing.sm,
    },
    card: {
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      padding: rnSpacing.lg,
      gap: rnSpacing.sm,
    },
    pressed: { opacity: 0.8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    rowLabel: { flexShrink: 1, fontSize: rnType.label.size, color: tk.text.tertiary },
    rowValue: {
      flexShrink: 0,
      ...rnType.body,
      color: tk.text.primary,
      fontVariant: ['tabular-nums'],
    },
    strong: { flexShrink: 1, ...rnType.body, fontWeight: '600', color: tk.text.primary },
    strongValue: {
      flexShrink: 0,
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tk.text.tertiary,
      fontVariant: ['tabular-nums'],
    },
    subNote: { fontSize: rnType.label.size, color: tk.text.tertiary, textAlign: 'center' },
    dangerNote: { fontSize: rnType.label.size, color: tk.danger.DEFAULT, textAlign: 'center' },
    retryBtn: {
      height: 36,
      paddingHorizontal: rnSpacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
    },
    retryText: { fontSize: rnType.body.size, color: tk.text.primary },
  })
}

/**
 * 空态 / 错误态:共享四件套(`EmptyState`/`ErrorState`)只导到 `@ihui/rn-app` 的
 * `./components` barrel,未从包入口 re-export(见 packages/app/src/index.ts),包 exports
 * 也只放行 "." ⇒ 端内不能深路径导入。此处只做最小展示,不 export 与共享层同名的符号。
 */
export function EduParentStateView({
  t,
  colorScheme,
  message,
  onRetry,
  tone = 'muted',
}: {
  t: ParentT
  colorScheme: AppThemeMode
  message: string
  onRetry?: () => void
  tone?: 'muted' | 'danger'
}) {
  const styles = createParentStyles(getTokens(colorScheme))
  return (
    <View style={styles.center}>
      <Text style={tone === 'danger' ? styles.dangerNote : styles.subNote}>{message}</Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
