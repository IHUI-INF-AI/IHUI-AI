// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnRadiusFor, rnSpacing } from '@ihui/design-tokens'

import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { TextField } from '../../components/TextField'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AIMultimodalScreenProps, AiMultimodalMode } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState } from '../../components/ScreenStates'

/** AI 多模态对话共享屏 — props 注入式跨端组件(纯 UI,wrapper 保留 API 调用) */
export type { AIMultimodalScreenProps }

const MODE_KEYS: AiMultimodalMode[] = ['text', 'image', 'audio']

function modeLabelKey(m: AiMultimodalMode): string {
  return m === 'text'
    ? 'aiMultimodal.textMode'
    : m === 'image'
      ? 'aiMultimodal.imageMode'
      : 'aiMultimodal.audioMode'
}

export function AIMultimodalScreen({
  t,
  userName,
  mode,
  models,
  model,
  messages,
  input,
  loading,
  error,
  onModeChange,
  onModelChange,
  onInputChange,
  onSend,
  onClear,
  onBack,
  colorScheme = 'light',
}: AIMultimodalScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const canSend = input.trim().length > 0 && !loading

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('aiMultimodal.title')}</Text>
        <Text style={styles.subtitle}>{t('aiMultimodal.subtitle')}</Text>
        {userName ? <Text style={styles.userText}>{userName}</Text> : null}
      </View>

      <View style={styles.modeRow}>
        {MODE_KEYS.map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
            onPress={() => onModeChange(m)}
          >
            <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
              {t(modeLabelKey(m))}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.modelRow}>
        <Text style={styles.modelLabel}>{t('aiMultimodal.switchModel')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {models.length === 0 ? (
            <Text style={styles.modelEmpty}>{t('aiMultimodal.noModels')}</Text>
          ) : (
            models.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modelChip, model === m && styles.modelChipActive]}
                onPress={() => onModelChange(m)}
              >
                <Text style={[styles.modelChipText, model === m && styles.modelChipTextActive]}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      <FlatList
        style={styles.list}
        data={messages}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <EmptyState title={t('aiMultimodal.empty')} colorScheme={colorScheme} />
        }
        renderItem={({ item }) => (
          <View
            style={[styles.msgBubble, item.role === 'user' ? styles.msgUser : styles.msgAssistant]}
          >
            <Text style={styles.msgRole}>{item.role === 'user' ? userName || 'me' : 'AI'}</Text>
            <Text style={styles.msgContent}>{item.content}</Text>
          </View>
        )}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.inputRow}>
        <TextField
          colorScheme={colorScheme}
          style={styles.input}
          value={input}
          onChangeText={onInputChange}
          placeholder={t('aiMultimodal.inputPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={!canSend}
        >
          {loading ? (
            <ActivityIndicator color={tk.surface.light} size="small" />
          ) : (
            <Text style={styles.sendText}>{t('aiMultimodal.send')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearBtn} onPress={onClear}>
          <Text style={styles.clearText}>{t('aiMultimodal.clear')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: rnSpacing['sm-loose'], paddingBottom: rnSpacing.sm },
    title: { marginTop: rnSpacing.sm, fontSize: 24, fontWeight: '700', color: tk.text.primary },
    subtitle: { marginTop: rnSpacing.sm, fontSize: 14, color: tk.text.secondary },
    userText: { marginTop: rnSpacing.sm, fontSize: 11, color: tk.text.tertiary },
    modeRow: {
      flexDirection: 'row',
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.sm,
      gap: rnSpacing.sm,
    },
    modeBtn: {
      flex: 1,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.card,
    },
    modeBtnActive: { backgroundColor: tk.brand.cta },
    modeBtnText: { textAlign: 'center', fontSize: 14, color: tk.text.medium },
    modeBtnTextActive: { color: tk.surface.light, fontWeight: '600' },
    modelRow: { paddingHorizontal: rnSpacing['sm-loose'], paddingBottom: rnSpacing.sm },
    modelLabel: { fontSize: 14, color: tk.text.secondary, marginBottom: rnSpacing.sm },
    modelEmpty: { fontSize: 14, color: tk.text.tertiary, paddingVertical: rnSpacing['xs-loose'] },
    modelChip: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing['xs-loose'],
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.card,
      marginRight: rnSpacing.sm,
    },
    modelChipActive: { backgroundColor: tk.brand.cta },
    modelChipText: { fontSize: 14, color: tk.text.medium },
    modelChipTextActive: { color: tk.surface.light },
    list: { flex: 1, paddingHorizontal: rnSpacing['sm-loose'] },
    msgBubble: {
      padding: rnSpacing['sm-loose'],
      borderRadius: rnRadiusFor.bubble,
      marginBottom: rnSpacing.sm,
      maxWidth: '85%',
    },
    msgUser: { backgroundColor: tk.success.lighter, alignSelf: 'flex-end' },
    msgAssistant: { backgroundColor: tk.surface.card, alignSelf: 'flex-start' },
    msgRole: { fontSize: 11, color: tk.text.secondary, marginBottom: rnSpacing.sm },
    msgContent: { fontSize: 16, color: tk.text.primary },
    errorText: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.xs,
      fontSize: 14,
      color: tk.danger.DEFAULT,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.sm,
      gap: rnSpacing.sm,
    },
    input: {
      flex: 1,
      minHeight: 50,
      maxHeight: 100,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 16,
      color: tk.text.primary,
      textAlignVertical: 'top',
      backgroundColor: tk.surface.muted,
    },
    sendBtn: {
      paddingHorizontal: rnSpacing.lg,
      height: 50,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { backgroundColor: tk.text.tertiary },
    sendText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
    clearBtn: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing['sm-loose'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.card,
    },
    clearText: { color: tk.text.medium, fontSize: 14 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
