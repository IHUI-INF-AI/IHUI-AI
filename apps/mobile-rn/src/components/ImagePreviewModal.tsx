// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ImagePreviewModal 全屏图片预览(mobile-rn 端)
 *
 * 共享组件:抽取自 ModelRecordScreen / BusinessLicenseScreen 两处近复制的单图全屏预览 Modal。
 * - 透明 fade Modal + 半透明黑色遮罩,点击遮罩或关闭按钮即关闭
 * - 右上角 X 关闭按钮(lucide-react-native),hitSlop 8 提升可点性
 * - source 支持 ImageSourcePropType:兼容本地 require()(number)与远程 { uri: string }
 * - visible=false 时仍渲染 Modal 以保留 fade 淡出动画;source 为空时 Image 条件渲染
 *
 * D64② 接线(2026-09-25,H18 跨端一致):翻页/计数/缩放/保存复制成败的**判据**一律走
 * 共享真相源 `@ihui/shared/chat/element-pack`(zoomStep / pageImage / imageCounterView /
 * imageTransferView),端内不写第二份档位表或钳制逻辑。保存复制的**动作**由调用方经
 * `onTransfer` 注入(平台特有:落相册/剪贴板依赖原生权限,归宿主),本组件只按
 * imageTransferView 显式渲染成/败,失败不静默吞。
 */
import { useEffect, useState } from 'react'
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native'
import { ChevronLeft, ChevronRight, Copy, Download, Minus, Plus, X } from 'lucide-react-native'
import {
  ELEMENT_PACK_NAMESPACE,
  imageCounterView,
  imageTransferView,
  pageImage,
  zoomStep,
  type ImageTransferKind,
  type ImageTransferResult,
} from '@ihui/shared/chat/element-pack'
import { tokens } from '../theme/active-tokens'
import { useI18n } from '../i18n'

/** 悬浮控件前景(黑遮罩上取亮色前景;非品牌实底 CTA,不走成对档) */
const HUD_COLOR = tokens.surface.light

export interface ImagePreviewModalProps {
  visible: boolean
  source: ImageSourcePropType | null
  onClose: () => void
  /** 多图预览(传了则启用翻页+计数;省略时退化为 source 单图,现网行为不变) */
  sources?: readonly ImageSourcePropType[]
  /** 初始索引(0 基,经 pageImage 钳制) */
  initialIndex?: number
  /**
   * 保存/复制动作注入点(宿主实现落相册/写剪贴板);
   * 返回成败判定,组件据此渲染 imageTransferView 显式文案,不静默吞失败。
   */
  onTransfer?: (kind: ImageTransferKind) => Promise<ImageTransferResult>
}

export default function ImagePreviewModal({
  visible,
  source,
  onClose,
  sources,
  initialIndex = 0,
  onTransfer,
}: ImagePreviewModalProps) {
  const { t } = useI18n()
  const list: readonly ImageSourcePropType[] =
    sources && sources.length > 0 ? sources : source ? [source] : []
  const total = list.length
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [toastKey, setToastKey] = useState<string | null>(null)

  // 打开时复位:索引取 initialIndex 经钳制,缩放回 1,提示清空
  useEffect(() => {
    if (visible) {
      setIndex(pageImage(initialIndex, total) ?? 0)
      setZoom(1)
      setToastKey(null)
    }
  }, [visible, initialIndex, total])

  // 成败提示 2.2s 自动消失(成败都要显式,但常驻会挡图)
  useEffect(() => {
    if (!toastKey) return
    const timer = setTimeout(() => setToastKey(null), 2200)
    return () => clearTimeout(timer)
  }, [toastKey])

  const current = list[index]
  const counter = imageCounterView(index, total)
  const multi = total > 1

  const go = (delta: number) => setIndex((i) => pageImage(i + delta, total, { wrap: true }) ?? i)

  const transfer = async (kind: ImageTransferKind) => {
    if (!onTransfer) return
    let result: ImageTransferResult
    try {
      result = await onTransfer(kind)
    } catch {
      // 宿主动作抛错按失败显式呈现,不吞
      result = 'failed'
    }
    setToastKey(imageTransferView(kind, result))
  }

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
            <X size={30} color={HUD_COLOR} />
          </Pressable>
        </View>
        <View style={styles.imageWrap}>
          {current ? (
            <Image
              source={current}
              style={[styles.image, { transform: [{ scale: zoom }] }]}
              resizeMode="contain"
              pointerEvents="none"
            />
          ) : null}
        </View>
        <View style={styles.bottomBar}>
          {toastKey ? (
            <Text style={styles.hudText}>{t(`${ELEMENT_PACK_NAMESPACE}.${toastKey}`)}</Text>
          ) : null}
          {multi && counter ? (
            <Text style={styles.hudText}>
              {t(`${ELEMENT_PACK_NAMESPACE}.${counter.labelKey}`, counter.values)}
            </Text>
          ) : null}
          <View style={styles.row}>
            {multi ? (
              <>
                <Pressable onPress={() => go(-1)} hitSlop={10} accessibilityRole="button">
                  <ChevronLeft size={26} color={HUD_COLOR} />
                </Pressable>
                <Pressable onPress={() => go(1)} hitSlop={10} accessibilityRole="button">
                  <ChevronRight size={26} color={HUD_COLOR} />
                </Pressable>
              </>
            ) : null}
            <Pressable
              onPress={() => setZoom((z) => zoomStep(z, 'out'))}
              hitSlop={10}
              accessibilityRole="button"
            >
              <Minus size={22} color={HUD_COLOR} />
            </Pressable>
            <Text style={styles.hudText}>{`${Math.round(zoom * 100)}%`}</Text>
            <Pressable
              onPress={() => setZoom((z) => zoomStep(z, 'in'))}
              hitSlop={10}
              accessibilityRole="button"
            >
              <Plus size={22} color={HUD_COLOR} />
            </Pressable>
            {onTransfer ? (
              <>
                <Pressable
                  onPress={() => void transfer('save')}
                  hitSlop={10}
                  accessibilityRole="button"
                >
                  <Download size={22} color={HUD_COLOR} />
                </Pressable>
                <Pressable
                  onPress={() => void transfer('copy')}
                  hitSlop={10}
                  accessibilityRole="button"
                >
                  <Copy size={22} color={HUD_COLOR} />
                </Pressable>
              </>
            ) : null}
          </View>
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
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  hudText: {
    color: HUD_COLOR,
    fontSize: 13,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
