/**
 * BusinessLicenseScreen 营业执照页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/settings/business-license.vue:
 * - 顶部 NavBar(标题「营业执照」+ 返回)
 * - 内容区:卡片内展示营业执照图片,点击全屏预览(对齐 uni.previewImage)
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

  return (
    <View style={styles.container}>
      <NavBar title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => setPreviewVisible(true)}>
            <Image source={LICENSE_IMAGE} style={styles.image} resizeMode="contain" />
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
  image: {
    width: '100%',
    height: 260,
    borderRadius: 4,
  },
})

export default BusinessLicenseScreen
