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
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
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
// G-853 平移判据的唯一出口 —— 与 web 端 `FilePreview.tsx` 同一份算式(§3:两处算同一件事
// 必须共用一份实现)。走子路径导入:`src/utils/index.ts` 那份 barrel 此刻被并行会话持有。
import { clampImagePreviewOffset, imagePreviewPanApplies } from '@ihui/shared/utils/image-preview-offset'
import { tokens } from '../theme/active-tokens'
import { useI18n } from '../i18n'

/** 盒尺寸(dp)。RN 的 onLayout / onLoad 给的都是这个量纲,与平移量同一坐标系。 */
export interface ImagePreviewBox {
  readonly width: number
  readonly height: number
}

/**
 * `resizeMode="contain"` 之后**真正画出来的**那块尺寸。
 *
 * 为什么端内要有这一步、而 web 没有:web 可以直接量 `img.getBoundingClientRect()`(含 transform),
 * RN 的 `onLayout` 只给**布局盒**(图片视图铺满外层盒),缩放后的绘制区拿不到 —— 这是取材方式的平台
 * 差异,不是两套算法。这里只把"自然尺寸 + 盒子"折成 contain 尺寸,越界判据仍整份交给共享层。
 * 任一维度量不到(≤0 / 非有限)一律回 0 尺寸 ⇒ 共享层判"不平移",不把未测读成可拖。
 */
export function containedImageBox(
  natural: ImagePreviewBox,
  box: ImagePreviewBox,
): ImagePreviewBox {
  const num = (value: number) => (Number.isFinite(value) ? value : 0)
  const w = num(natural.width)
  const h = num(natural.height)
  const bw = num(box.width)
  const bh = num(box.height)
  if (w <= 0 || h <= 0 || bw <= 0 || bh <= 0) return { width: 0, height: 0 }
  const fit = Math.min(bw / w, bh / h)
  return { width: w * fit, height: h * fit }
}


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

  // ---- G-853:放大后的平移(mobile-rn 侧)-------------------------------------------
  // 越界判据 = 共享层的 `clampImagePreviewOffset` / `imagePreviewPanApplies`,与 web 同一份。
  // RN **没有 pointer capture 这个 API**(它走 responder 系统,授权随触点结束自动归还),
  // 所以票面要求的"三个出口显式释放"在本端逐一对应成:onResponderRelease(松手)、
  // onResponderTerminate(RN 的 cancel 等价形态:被别的组件抢走 responder)、以及
  // 关闭/换图/改缩放时的复位(= web 的卸载出口)。少一个同样会留下"还在拖"的幽灵状态。
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [wrapBox, setWrapBox] = useState<ImagePreviewBox>({ width: 0, height: 0 })
  const [natural, setNatural] = useState<ImagePreviewBox>({ width: 0, height: 0 })
  const dragRef = useRef<{ x0: number; y0: number; ox: number; oy: number } | null>(null)

  /** 绘制区(contain 之后)× 缩放 ⇒ 喂给共享判据的"缩放后实际占用尺寸" */
  const drawn = containedImageBox(natural, wrapBox)
  const panGeometryAt = useCallback(
    (offsetX: number, offsetY: number) => ({
      offsetX,
      offsetY,
      scaledWidth: drawn.width * zoom,
      scaledHeight: drawn.height * zoom,
      viewportWidth: wrapBox.width,
      viewportHeight: wrapBox.height,
    }),
    [drawn.width, drawn.height, zoom, wrapBox.width, wrapBox.height],
  )
  /** 只有真的溢出了才把手势面打开 —— 未放大时 tap-to-close 现网行为一字不变 */
  const panApplies = imagePreviewPanApplies(panGeometryAt(0, 0))

  const handleGrant = (event: GestureResponderEvent) => {
    dragRef.current = {
      x0: event.nativeEvent.pageX,
      y0: event.nativeEvent.pageY,
      ox: offset.x,
      oy: offset.y,
    }
  }
  const handleMove = (event: GestureResponderEvent) => {
    const drag = dragRef.current
    if (!drag) return
    setOffset(
      clampImagePreviewOffset(
        panGeometryAt(drag.ox + (event.nativeEvent.pageX - drag.x0), drag.oy + (event.nativeEvent.pageY - drag.y0)),
      ),
    )
  }
  /** 两个出口共用:释放 = 清空拖拽起点,不平移量归零(归零会让人松手瞬间跳图) */
  const handleEnd = () => {
    dragRef.current = null
  }

  // 打开时复位:索引取 initialIndex 经钳制,缩放回 1,平移与拖拽起点清空,提示清空
  useEffect(() => {
    if (visible) {
      setIndex(pageImage(initialIndex, total) ?? 0)
      setZoom(1)
      setToastKey(null)
    }
    setOffset({ x: 0, y: 0 })
    dragRef.current = null
  }, [visible, initialIndex, total])

  // 换图 / 改缩放 ⇒ 平移复位并丢掉 responder 起点(尺寸一变,旧偏移就指向图外)
  useEffect(() => {
    setOffset({ x: 0, y: 0 })
    dragRef.current = null
  }, [index, zoom])

  // 换图后上一张的自然尺寸不再有效:清成 0 ⇒ 判据在量到新尺寸前判"不平移"
  useEffect(() => {
    setNatural({ width: 0, height: 0 })
  }, [index])


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
        {/*
          手势面只在本端真的溢出时才打开(pointerEvents 由共享判据给值):
          未放大时保持 "none",点击照常穿透到遮罩走关闭 —— 现网行为一字不变。
          transform 顺序 = translate 在前、scale 在后:矩阵为 T∘S,平移量因此是**视口 dp**
          而不是"缩放后的 dp",与共享判据的坐标系一致(端内不得再乘一次 zoom)。
        */}
        <View
          style={styles.imageWrap}
          pointerEvents={panApplies ? 'auto' : 'none'}
          onLayout={(event) =>
            setWrapBox({
              width: event.nativeEvent.layout.width,
              height: event.nativeEvent.layout.height,
            })
          }
          onStartShouldSetResponder={() => panApplies}
          onMoveShouldSetResponder={() => panApplies}
          onResponderGrant={handleGrant}
          onResponderMove={handleMove}
          onResponderRelease={handleEnd}
          onResponderTerminate={handleEnd}
        >
          {current ? (
            <Image
              source={current}
              style={[
                styles.image,
                { transform: [{ translateX: offset.x }, { translateY: offset.y }, { scale: zoom }] },
              ]}
              resizeMode="contain"
              onLoad={(event) =>
                setNatural({
                  width: event.nativeEvent.source?.width ?? 0,
                  height: event.nativeEvent.source?.height ?? 0,
                })
              }
              testID="image-preview-modal-image"
              accessibilityLabel="预览图片"
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
