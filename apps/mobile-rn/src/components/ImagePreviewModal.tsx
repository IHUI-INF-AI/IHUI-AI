/**
 * ImagePreviewModal 全屏图片预览(mobile-rn 端)
 *
 * 共享组件:抽取自 ModelRecordScreen / BusinessLicenseScreen 两处近复制的单图全屏预览 Modal。
 * - 透明 fade Modal + 半透明黑色遮罩,点击遮罩或关闭按钮即关闭
 * - 右上角 X 关闭按钮(lucide-react-native),hitSlop 8 提升可点性
 * - source 支持 ImageSourcePropType:兼容本地 require()(number)与远程 { uri: string }
 * - visible=false 时仍渲染 Modal 以保留 fade 淡出动画;source 为空时 Image 条件渲染
 */
import { Image, Modal, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native'
import { X } from 'lucide-react-native'

export interface ImagePreviewModalProps {
  visible: boolean
  source: ImageSourcePropType | null
  onClose: () => void
}

export default function ImagePreviewModal({ visible, source, onClose }: ImagePreviewModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.closeBtn}>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="关闭"
          >
            <X size={30} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.imageWrap}>
          {source ? <Image source={source} style={styles.image} resizeMode="contain" /> : null}
        </View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  closeBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
  },
  imageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
})
