import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

export interface SetNeedScreenProps {
  t: TFunction
  form: {
    title: string
    description: string
    lowestPrice: string
    peakPrice: string
    contact: string
  }
  submitting: boolean
  onFieldChange: (field: string, value: string) => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

const TITLE_MAX = 50

export function SetNeedScreen({
  form,
  submitting,
  onFieldChange,
  onSubmit,
  onBack,
  colorScheme = 'light',
}: SetNeedScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>设置需求</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            需求标题<Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={form.title}
            onChangeText={(v) => onFieldChange('title', v)}
            placeholder="一句话描述你的需求"
            placeholderTextColor={tk.text.tertiary}
            maxLength={TITLE_MAX}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            需求描述<Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={form.description}
            onChangeText={(v) => onFieldChange('description', v)}
            placeholder="详细说明需求背景、功能点、交付要求等(至少 10 字)"
            placeholderTextColor={tk.text.tertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            预算区间(元)<Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.priceRow}>
            <TextInput
              style={[styles.input, styles.priceInput]}
              value={form.lowestPrice}
              onChangeText={(v) => onFieldChange('lowestPrice', v)}
              placeholder="起步价"
              placeholderTextColor={tk.text.tertiary}
              keyboardType="numeric"
            />
            <Text style={styles.priceDash}>~</Text>
            <TextInput
              style={[styles.input, styles.priceInput]}
              value={form.peakPrice}
              onChangeText={(v) => onFieldChange('peakPrice', v)}
              placeholder="最高价"
              placeholderTextColor={tk.text.tertiary}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            联系方式<Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={form.contact}
            onChangeText={(v) => onFieldChange('contact', v)}
            placeholder="手机号 / 微信号 / 邮箱"
            placeholderTextColor={tk.text.tertiary}
            autoCapitalize="none"
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed]}
          onPress={onSubmit}
        >
          <Text style={styles.submitBtnText}>{submitting ? '提交中...' : '提交需求'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium } as TextStyle,
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary } as TextStyle,
    scrollContent: { paddingHorizontal: 10, paddingVertical: 12, gap: 8 } as ViewStyle,
    fieldGroup: { gap: 8 } as ViewStyle,
    label: { fontSize: 16, fontWeight: '600', color: tk.text.primary } as TextStyle,
    required: { fontSize: 16, color: tk.danger.DEFAULT } as TextStyle,
    input: {
      backgroundColor: '#f5f5f5',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 14,
      fontSize: 16,
      color: tk.text.primary,
    } as TextStyle,
    textarea: { minHeight: 96, paddingTop: 12 } as TextStyle,
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 } as ViewStyle,
    priceInput: { flex: 1 } as TextStyle,
    priceDash: { fontSize: 16, color: tk.text.tertiary } as TextStyle,
    submitBtn: {
      backgroundColor: tk.brand.DEFAULT,
      borderRadius: 12,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 16,
    } as ViewStyle,
    submitBtnPressed: { opacity: 0.85 } as ViewStyle,
    submitBtnText: { fontSize: 16, fontWeight: '600', color: tk.surface.light } as TextStyle,
  })
}
