// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { CategoryDropdown } from '../../components/category/CategoryDropdown'
import type { CategoryItem } from '../../components/category/types'
import type { TFunction } from '../../types'

import { rnRadius } from '@ihui/design-tokens'

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

/** 选项值即选中后写入字段的值,故 id 与 label 同值(与迁移前字符串数组逐字一致) */
function toItems(values: readonly string[]): readonly CategoryItem[] {
  return values.map((value) => ({ id: value, label: value }))
}

/**
 * 四个表单选择器的字段配置:key 即 onFieldChange 的 field,
 * title / placeholder / 选项集合与顺序均沿用迁移前的 pickerTitle / pickerOptions / 占位取词。
 */
const PICKERS = {
  cycle: {
    title: '开发周期',
    placeholder: '周期数',
    items: toItems(['1', '2', '3', '5', '7', '10']),
  },
  cycleUnit: {
    title: '周期单位',
    placeholder: '周 / 月 / 日',
    items: toItems(['日', '周', '月', '年']),
  },
  types: {
    title: '需求类型',
    placeholder: '选择需求类型',
    items: toItems(['开发', '设计', '运营', '内容']),
  },
  categories: {
    title: '需求分类',
    placeholder: '选择需求分类',
    items: toItems(['电商', '教育', '营销', '工具']),
  },
} as const

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
  const imageUrls = form.imgs
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)

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
            <CategoryDropdown
              style={styles.priceInput}
              items={PICKERS.cycle.items}
              selectedId={form.cycle || null}
              onSelect={(id) => onFieldChange('cycle', id)}
              colorScheme={colorScheme}
              placeholder={PICKERS.cycle.placeholder}
              panelTitle={PICKERS.cycle.title}
            />
            <CategoryDropdown
              style={styles.priceInput}
              items={PICKERS.cycleUnit.items}
              selectedId={form.cycleUnit || null}
              onSelect={(id) => onFieldChange('cycleUnit', id)}
              colorScheme={colorScheme}
              placeholder={PICKERS.cycleUnit.placeholder}
              panelTitle={PICKERS.cycleUnit.title}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>类型与分类</Text>
          <CategoryDropdown
            items={PICKERS.types.items}
            selectedId={form.types || null}
            onSelect={(id) => onFieldChange('types', id)}
            colorScheme={colorScheme}
            placeholder={PICKERS.types.placeholder}
            panelTitle={PICKERS.types.title}
          />
          <CategoryDropdown
            items={PICKERS.categories.items}
            selectedId={form.categories || null}
            onSelect={(id) => onFieldChange('categories', id)}
            colorScheme={colorScheme}
            placeholder={PICKERS.categories.placeholder}
            panelTitle={PICKERS.categories.title}
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
      borderRadius: rnRadius.xl,
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
    imagePreview: { width: 72, height: 72, borderRadius: rnRadius.lg } as ImageStyle,
    submitBtn: {
      backgroundColor: tk.brand.DEFAULT,
      borderRadius: rnRadius.xl,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 16,
    } as ViewStyle,
    submitBtnPressed: { opacity: 0.85 } as ViewStyle,
    submitBtnText: { fontSize: 16, fontWeight: '600', color: tk.surface.light } as TextStyle,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
