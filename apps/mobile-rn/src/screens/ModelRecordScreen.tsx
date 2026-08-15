import { useState } from 'react'
import { View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ModelRecordScreen as SharedModelRecordScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import ImagePreviewModal from '../components/ImagePreviewModal'
import type { RootStackParamList } from '../navigation/RootNavigator'
/* eslint-disable @typescript-eslint/no-require-imports */
const RECORD_IMAGES: number[] = [
  require('../../assets/images/common/modelRecord1.png'),
  require('../../assets/images/common/modelRecord2.png'),
  require('../../assets/images/common/modelRecord3.png'),
  require('../../assets/images/common/modelRecord4.png'),
]
/* eslint-enable @typescript-eslint/no-require-imports */

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

// mobile-rn 端暂无 settings.modelRecord 翻译 key(对齐 .vue 硬编码中文),key 就绪后自动切换
const TITLE_KEY = 'settings.modelRecord'

export function ModelRecordScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const tTitle = t(TITLE_KEY)
  const title = tTitle === TITLE_KEY ? '模型备案' : tTitle
  const [previewIndex, setPreviewIndex] = useState<number>(-1)

  return (
    <View style={{ flex: 1 }}>
      <SharedModelRecordScreen
        t={t}
        title={title}
        onBack={() => navigation.goBack()}
        images={RECORD_IMAGES}
        previewIndex={previewIndex}
        onPreviewIndexChange={setPreviewIndex}
      />
      <ImagePreviewModal
        visible={previewIndex >= 0}
        source={previewIndex >= 0 ? (RECORD_IMAGES[previewIndex] ?? null) : null}
        onClose={() => setPreviewIndex(-1)}
      />
    </View>
  )
}

export default ModelRecordScreen
