import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AIMultimodalScreenProps, AiMultimodalMode } from '../../types'

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
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
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
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('aiMultimodal.empty')}</Text>
          </View>
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
        <TextInput
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
    header: { paddingHorizontal: 10, paddingTop: 48, paddingBottom: 8 },
    backText: { fontSize: 16, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 24, fontWeight: '700', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    userText: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
    modeRow: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
    modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: tk.surface.card },
    modeBtnActive: { backgroundColor: tk.brand.DEFAULT },
    modeBtnText: { textAlign: 'center', fontSize: 14, color: tk.text.medium },
    modeBtnTextActive: { color: tk.surface.light, fontWeight: '600' },
    modelRow: { paddingHorizontal: 10, paddingBottom: 8 },
    modelLabel: { fontSize: 14, color: tk.text.secondary, marginBottom: 8 },
    modelEmpty: { fontSize: 14, color: tk.text.tertiary, paddingVertical: 6 },
    modelChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
      marginRight: 8,
    },
    modelChipActive: { backgroundColor: tk.brand.DEFAULT },
    modelChipText: { fontSize: 14, color: tk.text.medium },
    modelChipTextActive: { color: tk.surface.light },
    list: { flex: 1, paddingHorizontal: 10 },
    empty: { paddingVertical: 40, alignItems: 'center' },
    emptyText: { fontSize: 14, color: tk.text.tertiary },
    msgBubble: { padding: 10, borderRadius: 12, marginBottom: 8, maxWidth: '85%' },
    msgUser: { backgroundColor: tk.success.lighter, alignSelf: 'flex-end' },
    msgAssistant: { backgroundColor: tk.surface.card, alignSelf: 'flex-start' },
    msgRole: { fontSize: 11, color: tk.text.secondary, marginBottom: 8 },
    msgContent: { fontSize: 16, color: tk.text.primary },
    errorText: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      fontSize: 14,
      color: tk.danger.DEFAULT,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 8,
      borderTopColor: tk.border.light,
      borderTopWidth: 1,
    },
    input: {
      flex: 1,
      minHeight: 50,
      maxHeight: 100,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 16,
      color: tk.text.primary,
      textAlignVertical: 'top',
      backgroundColor: '#f5f5f5',
    },
    sendBtn: {
      paddingHorizontal: 16,
      height: 50,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { backgroundColor: tk.text.tertiary },
    sendText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
    clearBtn: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
    },
    clearText: { color: tk.text.medium, fontSize: 14 },
  })
}
