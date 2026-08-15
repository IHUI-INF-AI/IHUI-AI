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
import type { ModelRecordScreenProps } from '../../types'

/** 模型备案/Props 类型 re-export(单一来源 @ihui/types) */
export type { ModelRecordScreenProps }

/**
 * 模型备案共享屏 — 平台无关 UI 组件
 *
 * 平台无关:负责渲染 header(返回 + 标题) + 多张模型备案图片(支持 aspectRatio 自适应高度)。
 * 平台特定(导航/预览模态框)由 wrapper 通过 props 注入。
 */
export function ModelRecordScreen({
  t,
  title,
  onBack,
  images,
  onPreviewIndexChange,
  colorScheme = 'light',
}: ModelRecordScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [aspects, setAspects] = useState<Record<number, number>>({})

  const handleImageLoad = (index: number) => (e: NativeSyntheticEvent<ImageLoadEventData>) => {
    const { width, height } = e.nativeEvent.source
    if (width > 0 && height > 0) {
      const ratio = width / height
      setAspects((prev) => (prev[index] === ratio ? prev : { ...prev, [index]: ratio }))
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
          {images.map((src: React.ComponentProps<typeof Image>['source'], index: number) => (
            <TouchableOpacity
              key={index}
              activeOpacity={0.9}
              style={index === images.length - 1 ? styles.imageWrapLast : styles.imageWrap}
              onPress={() => onPreviewIndexChange(index)}
            >
              <Image
                source={src}
                style={[
                  styles.imageBase,
                  aspects[index] ? { aspectRatio: aspects[index] } : styles.imageFallback,
                ]}
                resizeMode="contain"
                onLoad={handleImageLoad(index)}
              />
            </TouchableOpacity>
          ))}
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
    imageWrap: {
      marginBottom: 12,
    },
    imageWrapLast: {
      marginBottom: 0,
    },
    imageBase: {
      width: '100%',
      borderRadius: 4,
    },
    imageFallback: {
      height: 220,
    },
  })
}
