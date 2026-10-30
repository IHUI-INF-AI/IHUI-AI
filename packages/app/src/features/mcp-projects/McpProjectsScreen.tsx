// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MCP 项目共享屏 —— 承载 web /mcp-projects(GET /api/ai/mcp/resources)。
 *
 * web 页(apps/web/app/(main)/mcp-projects/PageClient.tsx:33-75)是 5 个 Tab:
 * servers / tools / resources / prompts / usage。RN 本次承载其中有现成后端契约且形状自洽的
 * **resources** 一档(ai-frontend-routes.ts:308-330 → success(McpResource[]));
 * 其余四档未承载,原因如实登记在 manifest ledger:servers 档后端返回 mcpServers 表行、
 * 与 web 期望形状不一致;tools/prompts/usage 的 web 组件各自另有调用面,本次不扩。
 * 因此本屏只渲染资源列表,不渲染 Tab 切换与「添加服务器」等无落点入口。
 *
 * 平台无关:取数 / 登录门 / 内容截断全部由薄壳注入,本文件只渲染与三态。
 */
import { useMemo } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Boxes } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'mcpProjectsPage'

export interface McpResourceRowView {
  uri: string
  name: string
  mimeType: string
  /** 内容预览(薄壳截断后的纯文本,空表示无内容) */
  preview: string
}

export interface McpProjectsScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  loginRequiredText: string
  loading: boolean
  error: string | null
  rows: McpResourceRowView[]
  onRefresh: () => void
}

export function McpProjectsScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  rows,
  onRefresh,
}: McpProjectsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <Boxes size={20} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          </View>
          <Text style={styles.subtitle}>{t(`${NS}.subtitle`)}</Text>
        </View>
      </View>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error || t('common.loadFailed')}</Text>
      ) : rows.length === 0 ? (
        <View style={styles.centerBlock}>
          <Boxes size={30} color={tk.text.tertiary} />
          <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.uri}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name || '-'}
                </Text>
                {item.mimeType ? (
                  <View style={styles.chip}>
                    <Text style={styles.chipText} numberOfLines={1}>
                      {item.mimeType}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.uri} numberOfLines={1}>
                {t(`${NS}.uri`)}: {item.uri}
              </Text>
              <Text style={item.preview ? styles.preview : styles.muted} numberOfLines={6}>
                {item.preview || t(`${NS}.empty`)}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 2, fontSize: rnType.caption.size, color: tk.text.secondary },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    error: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    list: { flex: 1, marginTop: rnSpacing.md },
    listContent: { paddingBottom: rnSpacing['2xl'] },
    card: {
      gap: rnSpacing.sm,
      marginBottom: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    cardTitle: { flex: 1, fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    chip: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      maxWidth: '50%',
    },
    chipText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    uri: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    preview: { fontSize: rnType.label.size, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
