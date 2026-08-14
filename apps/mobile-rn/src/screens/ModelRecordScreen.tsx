/**
 * ModelRecordScreen 模型备案页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/settings/model-record.vue:
 * - 顶部 NavBar(标题「模型备案」+ 返回)
 * - 内容区:卡片内展示 4 张模型备案图片,点击全屏预览(对齐 uni.previewImage)
 * - 浅色优雅风,rnLightTokens;圆角守门;无分割线
 */
import { useState } from 'react'
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { rnLightTokens as tk } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import ImagePreviewModal from '../components/ImagePreviewModal'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

// mobile-rn 端暂无 settings.modelRecord 翻译 key(对齐 .vue 硬编码中文),key 就绪后自动切换
const TITLE_KEY = 'settings.modelRecord'

/* eslint-disable @typescript-eslint/no-require-imports */
const RECORD_IMAGES: number[] = [
  require('../../assets/images/common/modelRecord1.png'),
  require('../../assets/images/common/modelRecord2.png'),
  require('../../assets/images/common/modelRecord3.png'),
  require('../../assets/images/common/modelRecord4.png'),
]
/* eslint-enable @typescript-eslint/no-require-imports */

export function ModelRecordScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const tTitle = t(TITLE_KEY)
  const title = tTitle === TITLE_KEY ? '模型备案' : tTitle
  const [previewIndex, setPreviewIndex] = useState<number>(-1)

  return (
    <View style={styles.container}>
      <NavBar title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {RECORD_IMAGES.map((src, index) => (
            <TouchableOpacity
              key={index}
              activeOpacity={0.9}
              style={index === RECORD_IMAGES.length - 1 ? styles.imageWrapLast : styles.imageWrap}
              onPress={() => setPreviewIndex(index)}
            >
              <Image source={src} style={styles.image} resizeMode="contain" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ImagePreviewModal
        visible={previewIndex >= 0}
        source={previewIndex >= 0 ? (RECORD_IMAGES[previewIndex] ?? null) : null}
        onClose={() => setPreviewIndex(-1)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tk.surface.muted,
  },
  content: {
    padding: 12,
    paddingBottom: 32,
  },
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
  image: {
    width: '100%',
    height: 240,
    borderRadius: 4,
  },
})

export default ModelRecordScreen
