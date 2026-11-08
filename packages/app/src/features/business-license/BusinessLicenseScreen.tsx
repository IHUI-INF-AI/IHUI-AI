// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useState, useMemo } from 'react'
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageLoadEventData,
  type NativeSyntheticEvent,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { BusinessLicenseScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'

/** 营业执照/Props 类型 re-export(单一来源 @ihui/types) */
export type { BusinessLicenseScreenProps }

/**
 * 与小程序 pkg-about/about/business-license 同一组工商信息(值按可核事实对齐,标签走 i18n)。
 *
 * 统一社会信用代码与登记机关仓内没有真实值(营业执照原件在网盘),不展示形似占位的假值。
 * 待补:原件上的信用代码与登记机关,见 docs/engineering/icp-filing-single-source-2026-11-08.md。
 */
const LICENSE_ROWS: { labelKey: string; value: string }[] = [
  { labelKey: 'businessLicense.label1', value: '吉林省爱智汇人工智能科技有限公司' },
  { labelKey: 'businessLicense.label2', value: '有限责任公司' },
  { labelKey: 'businessLicense.label3', value: '1000万元人民币' },
  { labelKey: 'businessLicense.label4', value: '2023-06-15' },
  { labelKey: 'businessLicense.label5', value: '2023-06-15 至 长期' },
]

/**
 * 营业执照共享屏 — 平台无关 UI 组件
 *
 * 平台无关:负责渲染 header(返回 + 标题) + 营业执照图片(支持 aspectRatio 自适应高度)。
 * 平台特定(导航/预览模态框)由 wrapper 通过 props 注入。
 */
export function BusinessLicenseScreen({
  t,
  title,
  onBack,
  imageSource,
  onPreviewVisibleChange,
  colorScheme = 'light',
}: BusinessLicenseScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [aspect, setAspect] = useState<number | undefined>(undefined)

  const handleImageLoad = (e: NativeSyntheticEvent<ImageLoadEventData>) => {
    const { width, height } = e.nativeEvent.source
    if (width > 0 && height > 0) {
      setAspect(width / height)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => onPreviewVisibleChange(true)}>
            <Image
              source={imageSource}
              style={[styles.imageBase, aspect ? { aspectRatio: aspect } : styles.imageFallback]}
              resizeMode="contain"
              onLoad={handleImageLoad}
            />
          </TouchableOpacity>
        </View>

        <View style={[styles.card, styles.tableCard]}>
          {LICENSE_ROWS.map(({ labelKey, value }) => (
            <View key={labelKey} style={styles.row}>
              <Text style={styles.rowLabel}>{t(labelKey)}</Text>
              <Text style={styles.rowValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.scopeTitle}>{t('businessLicense.scopeTitle')}</Text>
          <Text style={styles.scopeText}>{t('businessLicense.scopeValue')}</Text>
        </View>

        <Text style={styles.footer}>{t('businessLicense.footer')}</Text>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.muted },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    content: { padding: rnSpacing.md, paddingBottom: rnSpacing['2xl'], gap: rnSpacing.md },
    card: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      overflow: 'hidden',
      padding: rnSpacing.md,
    },
    tableCard: { paddingVertical: rnSpacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: rnSpacing.md,
      paddingVertical: rnSpacing.md,
    },
    rowLabel: { fontSize: rnType.body.size, color: tk.text.tertiary, flexShrink: 0 },
    rowValue: { fontSize: rnType.body.size, color: tk.text.primary, textAlign: 'right', flex: 1 },
    scopeTitle: {
      fontSize: rnType.body.size,
      fontWeight: '500',
      color: tk.text.primary,
      marginBottom: rnSpacing.sm,
    },
    scopeText: {
      fontSize: rnType.body.size,
      color: tk.text.secondary,
      lineHeight: rnType.strong.lineHeight,
    },
    footer: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
      lineHeight: rnType.body.lineHeight,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    imageBase: {
      width: '100%',
      borderRadius: rnRadius.sm,
    },
    imageFallback: {
      height: 260,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
