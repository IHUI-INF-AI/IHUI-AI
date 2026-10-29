// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { MessageSquare } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'

/**
 * 私信会话列表共享屏 —— 承载 web /letters 左侧栏(同口径:昵称搜索 300ms 防抖、
 * 15s 自动刷新、未读点=对方发来且未读、最新一条摘要)。web 双栏布局在移动端拆为
 * 「列表屏 + 会话屏」两屏,点会话由薄壳 push LetterChat 路由。
 * 平台无关:GET /api/private-letters/members 取数与防抖/轮询节奏由薄壳驱动。
 */
export interface LetterConversationRow {
  counterpartId: string
  counterpartName: string
  /** 最新消息摘要(后端逐字内容,过长由 numberOfLines 截断) */
  preview: string
  /** 薄壳按 web helpers.ts 同参格式化(zh-CN,MM/DD HH:mm) */
  timeText: string
  unread: boolean
}

export interface LettersScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(与 web useAuthGate 同口径) */
  loginRequiredText: string
  keyword: string
  onKeywordChange: (value: string) => void
  loading: boolean
  error: string | null
  rows: LetterConversationRow[]
  onPressConversation: (counterpartId: string, counterpartName: string) => void
}

export function LettersScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  keyword,
  onKeywordChange,
  loading,
  error,
  rows,
  onPressConversation,
}: LettersScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('lettersPage.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('lettersPage.title')}</Text>
      </View>
      <Text style={styles.subtitle}>{t('lettersPage.subtitle')}</Text>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : (
        <>
          <View style={styles.searchBox}>
            <TextField
              colorScheme={colorScheme}
              style={styles.searchInput}
              value={keyword}
              onChangeText={onKeywordChange}
              placeholder={t('lettersPage.searchPlaceholder')}
              placeholderTextColor={tk.text.tertiary}
              returnKeyType="search"
            />
          </View>

          {loading ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
              <Text style={styles.muted}>{t('lettersPage.loading')}</Text>
            </View>
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : rows.length === 0 ? (
            <View style={styles.centerBlock}>
              <MessageSquare size={30} color={tk.text.tertiary} />
              <Text style={styles.muted}>{t('lettersPage.empty')}</Text>
            </View>
          ) : (
            <FlatList<LetterConversationRow>
              data={rows}
              keyExtractor={(item) => item.counterpartId}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => onPressConversation(item.counterpartId, item.counterpartName)}
                >
                  <View style={styles.avatarBox}>
                    <Text style={styles.avatarText}>
                      {(item.counterpartName || '?').slice(0, 1)}
                    </Text>
                    {item.unread ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <View style={styles.rowMain}>
                    <View style={styles.rowTopLine}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {item.counterpartName}
                      </Text>
                      <Text style={styles.rowTime}>{item.timeText}</Text>
                    </View>
                    <Text style={styles.rowPreview} numberOfLines={1}>
                      {item.preview}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </>
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
    title: { flex: 1, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.text.secondary },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    searchBox: { marginTop: rnSpacing.md },
    searchInput: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 10,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.inputBg,
    },
    centerBlock: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    error: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    listContent: { paddingTop: rnSpacing.sm, paddingBottom: 24 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      paddingVertical: rnSpacing.md,
    },
    avatarBox: {
      width: 36,
      height: 36,
      borderRadius: rnRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    },
    avatarText: { fontSize: rnType.label.size, fontWeight: '500', color: tk.text.secondary },
    unreadDot: {
      position: 'absolute',
      top: -1,
      right: -1,
      width: 10,
      height: 10,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.danger.DEFAULT,
    },
    rowMain: { flex: 1, gap: 2 },
    rowTopLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    rowName: { flex: 1, fontSize: rnType.body.size, fontWeight: '500', color: tk.text.primary },
    rowTime: { fontSize: 11, color: tk.text.tertiary, flexShrink: 0 },
    rowPreview: { fontSize: rnType.label.size, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
