/**
 * BusinessLicenseScreen 营业执照页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/settings/business-license.vue:
 * - 顶部 NavBar(标题「营业执照」+ 返回)
 * - 内容区:卡片内展示营业执照图片,点击全屏预览(对齐 uni.previewImage)
 * - 图片 mode="widthFix" 对齐:onLoad 读取 natural width/height → aspectRatio,
 *   无固定高度 letterbox,完整复刻 Uniapp widthFix 自适应高度行为
 * - 间距逐项对齐(rpx→dp,750rpx 制):
 *   content padding 24rpx/24rpx/48rpx → 12/12/24;paddingBottom 之前 32→24
 *   license-wrap border-radius 16rpx → 8;padding 24rpx → 12
 *   license-image border-radius 8rpx → 4
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

// mobile-rn 端暂无 settings.businessLicense 翻译 key(对齐 .vue 硬编码中文),key 就绪后自动切换
const TITLE_KEY = 'settings.businessLicense'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LICENSE_IMAGE = require('../../assets/images/common/yyzz.jpg')

export function BusinessLicenseScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const tTitle = t(TITLE_KEY)
  const title = tTitle === TITLE_KEY ? '营业执照' : tTitle
  const [previewVisible, setPreviewVisible] = useState(false)
  // 营业执照 natural aspectRatio(widthFix 自适应高度)
  const [aspect, setAspect] = useState<number | undefined>(undefined)

  const handleImageLoad = (e: NativeSyntheticEvent<ImageLoadEventData>) => {
    const { width, height } = e.nativeEvent.source
    if (width > 0 && height > 0) {
      setAspect(width / height)
    }
  }

  return (
    <View style={styles.container}>
      <NavBar title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => setPreviewVisible(true)}>
            <Image
              source={LICENSE_IMAGE}
              style={[styles.imageBase, aspect ? { aspectRatio: aspect } : styles.imageFallback]}
              resizeMode="contain"
              onLoad={handleImageLoad}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ImagePreviewModal
        visible={previewVisible}
        source={LICENSE_IMAGE}
        onClose={() => setPreviewVisible(false)}
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
  // widthFix 基础样式:width 100% + 8rpx → 4dp 圆角
  imageBase: {
    width: '100%',
    borderRadius: 4,
  },
  // onLoad 触发前的占位高度(避免首次渲染高度 0 闪烁;加载后切换 aspectRatio)
  imageFallback: {
    height: 260,
  },
})

export default BusinessLicenseScreen
