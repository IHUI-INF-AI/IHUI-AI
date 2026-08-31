// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  type ImageStyle,
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
    cycle: string
    cycleUnit: string
    types: string
    categories: string
    closingTime: string
    imgs: string
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
  const [picker, setPicker] = useState<'cycle' | 'cycleUnit' | 'types' | 'categories' | null>(null)
  const imageUrls = form.imgs
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)

  const pickerOptions =
    picker === 'cycle'
      ? ['1', '2', '3', '5', '7', '10']
      : picker === 'cycleUnit'
        ? ['日', '周', '月', '年']
        : picker === 'types'
          ? ['开发', '设计', '运营', '内容']
          : ['电商', '教育', '营销', '工具']

  const pickerTitle =
    picker === 'cycle'
      ? '开发周期'
      : picker === 'cycleUnit'
        ? '周期单位'
        : picker === 'types'
          ? '需求类型'
          : '需求分类'

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

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>图片（逗号分隔 URL）</Text>
          <TextInput
            style={styles.input}
            value={form.imgs}
            onChangeText={(v) => onFieldChange('imgs', v)}
            placeholder="可选，最多 5 张"
            placeholderTextColor={tk.text.tertiary}
            autoCapitalize="none"
          />
          {imageUrls.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imageRow}
            >
              {imageUrls.slice(0, 5).map((url, index) => (
                <Image key={`${url}-${index}`} source={{ uri: url }} style={styles.imagePreview} />
              ))}
            </ScrollView>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            任务截止时间<Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={form.closingTime}
            onChangeText={(v) => onFieldChange('closingTime', v)}
            placeholder="例如 2026-12-31T23:59:59.000Z"
            placeholderTextColor={tk.text.tertiary}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>开发周期</Text>
          <View style={styles.priceRow}>
            <Pressable style={[styles.input, styles.priceInput]} onPress={() => setPicker('cycle')}>
              <Text style={styles.pickerText}>{form.cycle || '周期数'}</Text>
            </Pressable>
            <Pressable
              style={[styles.input, styles.priceInput]}
              onPress={() => setPicker('cycleUnit')}
            >
              <Text style={styles.pickerText}>{form.cycleUnit || '周 / 月 / 日'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>类型与分类</Text>
          <Pressable style={styles.input} onPress={() => setPicker('types')}>
            <Text style={styles.pickerText}>{form.types || '选择需求类型'}</Text>
          </Pressable>
          <Pressable style={styles.input} onPress={() => setPicker('categories')}>
            <Text style={styles.pickerText}>{form.categories || '选择需求分类'}</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed]}
          onPress={onSubmit}
        >
          <Text style={styles.submitBtnText}>{submitting ? '提交中...' : '提交需求'}</Text>
        </Pressable>
      </ScrollView>
      <Modal
        visible={picker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.pickerSheet} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.pickerTitle}>{pickerTitle}</Text>
            {pickerOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.pickerOption}
                onPress={() => {
                  if (picker) onFieldChange(picker, option)
                  setPicker(null)
                }}
              >
                <Text style={styles.pickerOptionText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
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
      backgroundColor: tk.surface.muted,
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
    imageRow: { gap: 8, paddingVertical: 4 } as ViewStyle,
    imagePreview: { width: 72, height: 72, borderRadius: 8 } as ImageStyle,
    pickerText: { fontSize: 16, color: tk.text.primary } as TextStyle,
    modalBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.35)',
    } as ViewStyle,
    pickerSheet: {
      backgroundColor: tk.surface.bg,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 28,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
    } as ViewStyle,
    pickerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: 8,
    } as TextStyle,
    pickerOption: {
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: tk.border.light,
    } as ViewStyle,
    pickerOptionText: { fontSize: 16, color: tk.text.primary } as TextStyle,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
