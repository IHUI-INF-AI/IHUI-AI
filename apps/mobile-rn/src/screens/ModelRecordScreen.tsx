/**
 * ModelRecordScreen 模型备案页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/settings/model-record.vue:
 * - 顶部 NavBar(标题「模型备案」+ 返回)
 * - 内容区:卡片内展示 4 张模型备案图片,点击全屏预览(对齐 uni.previewImage)
 * - 图片 mode="widthFix" 对齐:onLoad 读取 natural width/height → aspectRatio,
 *   无固定高度 letterbox,完整复刻 Uniapp widthFix 自适应高度行为
 * - 间距逐项对齐(rpx→dp,750rpx 制):
 *   content padding 24rpx/24rpx/48rpx → 12/12/24;paddingBottom 之前 32→24
 *   card border-radius 16rpx → 8;padding 24rpx → 12
 *   image border-radius 8rpx → 4;margin-bottom 24rpx → 12(末项 0)
 * - 浅色优雅风,rnLightTokens;圆角守门;无分割线
 */
import { useState } from 'react'
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type ImageLoadEventData,
  type NativeSyntheticEvent,
} from 'react-native'
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
  // 各图片 natural aspectRatio(widthFix 自适应高度;key 为图片 index)
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
              <Image
                source={src}
                style={[styles.imageBase, aspects[index] ? { aspectRatio: aspects[index] } : styles.imageFallback]}
                resizeMode="contain"
                onLoad={handleImageLoad(index)}
              />
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
  // 24rpx 24rpx 48rpx → 12/12/24(48rpx = 24dp,之前误用 32)
  content: {
    padding: 12,
    paddingBottom: 24,
  },
  // 16rpx → 8dp,24rpx padding → 12dp
  card: {
    backgroundColor: tk.surface.light,
    borderRadius: 8,
    overflow: 'hidden',
    padding: 12,
  },
  // 24rpx → 12dp
  imageWrap: {
    marginBottom: 12,
  },
  imageWrapLast: {
    marginBottom: 0,
  },
  // widthFix 基础样式:width 100% + 8rpx → 4dp 圆角
  imageBase: {
    width: '100%',
    borderRadius: 4,
  },
  // onLoad 触发前的占位高度(避免首次渲染高度 0 闪烁;加载后切换 aspectRatio)
  imageFallback: {
    height: 220,
  },
})

export default ModelRecordScreen
