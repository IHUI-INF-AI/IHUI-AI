import { useState, useMemo } from 'react'
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, type ImageLoadEventData, type NativeSyntheticEvent } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { BusinessLicenseScreenProps } from '../../types'

/** 营业执照/Props 类型 re-export(单一来源 @ihui/types) */
export type { BusinessLicenseScreenProps }

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
  previewVisible,
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
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    content: { padding: 12, paddingBottom: 24 },
    card: {
      backgroundColor: tk.surface.light,
      borderRadius: 8,
      overflow: 'hidden',
      padding: 12,
    },
    imageBase: {
      width: '100%',
      borderRadius: 4,
    },
    imageFallback: {
      height: 260,
    },
  })
}
