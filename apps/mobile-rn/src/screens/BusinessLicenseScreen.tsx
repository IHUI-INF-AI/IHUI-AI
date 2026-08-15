import { useState } from 'react'
import { View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { BusinessLicenseScreen as SharedBusinessLicenseScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import ImagePreviewModal from '../components/ImagePreviewModal'
import type { RootStackParamList } from '../navigation/RootNavigator'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LICENSE_IMAGE = require('../../assets/images/common/yyzz.jpg')

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

// mobile-rn 端暂无 settings.businessLicense 翻译 key(对齐 .vue 硬编码中文),key 就绪后自动切换
const TITLE_KEY = 'settings.businessLicense'

export function BusinessLicenseScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const tTitle = t(TITLE_KEY)
  const title = tTitle === TITLE_KEY ? '营业执照' : tTitle
  const [previewVisible, setPreviewVisible] = useState(false)

  return (
    <View style={{ flex: 1 }}>
      <SharedBusinessLicenseScreen
        t={t}
        title={title}
        onBack={() => navigation.goBack()}
        imageSource={LICENSE_IMAGE}
        previewVisible={previewVisible}
        onPreviewVisibleChange={setPreviewVisible}
      />
      <ImagePreviewModal
        visible={previewVisible}
        source={LICENSE_IMAGE}
        onClose={() => setPreviewVisible(false)}
      />
    </View>
  )
}

export default BusinessLicenseScreen
