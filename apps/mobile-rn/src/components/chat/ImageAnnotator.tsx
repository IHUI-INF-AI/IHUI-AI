import { useI18n } from '../../i18n'
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D124 截图/图片标注编辑器:全屏 Modal + 底图之上自由画笔 / 文字标记。
// 位图合成走 react-native-view-shot 离屏舞台:保存时对隐藏舞台 captureRef 出 png 临时文件,
// 作为 onSave 第二参(capturedUri)随结构化数据一起交出;合成失败不阻断保存,
// 降级为 onSave(data, undefined) 只回结构化数据(与 D42「浏览器 DOM 批注」互补:
// D42 批注的是可寻址 DOM 元素,本条批注的是一张位图,两者不可互替)。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { captureRef } from 'react-native-view-shot'
import { Check, PenLine, Trash2, Type, Undo2, X } from 'lucide-react-native'
import { TextField } from '@ihui/rn-app'
import { currentRnTheme, tokens } from '../../theme/active-tokens'
import { rnRadius } from '@ihui/design-tokens'
import { rpx } from '../../utils/rpx'

/** 画布内相邻采样点的最小位移(px):小于此位移不记点,抑制手抖产生密集垃圾点 */
const MIN_POINT_GAP = 2
/** 成笔下限:不足 2 点的笔画视为误触点,不进 strokes */
const MIN_STROKE_POINTS = 2
/** 单条文字标记长度上限 */
const MAX_TEXT_LENGTH = 40

/** 画笔颜色(全部取 tokens 既有语义色,明暗主题切换时自动翻面) */
const PEN_COLORS = [
  tokens.error.text,
  tokens.brandAccent.deep,
  tokens.success.deep,
  tokens.brand.cta,
] as const
/** 画笔粗细档(px) */
const PEN_WIDTHS = [rpx(5), rpx(9), rpx(15)] as const
/** 粗细档措辞(与 PEN_WIDTHS 一一对应) */
const PEN_WIDTH_LABELS = ['annot.penThin', 'annot.penMid', 'annot.penThick'] as const

/** 标注坐标:相对画布左上角(画布 = 底图 resizeMode="contain" 的显示盒)的 px 偏移 */
export interface AnnotationPoint {
  readonly x: number
  readonly y: number
}

/** 一条自由笔画 */
export interface AnnotationStroke {
  readonly points: readonly AnnotationPoint[]
  readonly color: string
  readonly width: number
}

/** 一处文字标记(锚点取落点左上角) */
export interface AnnotationText {
  readonly x: number
  readonly y: number
  readonly text: string
  readonly color: string
}

/**
 * 标注结果契约(D124 回传形状)。
 * 坐标一律为画布归一化前的 px 偏移;上层若需与原始位图对齐,按渲染时的 contain 缩放比换算即可。
 */
export interface AnnotationData {
  readonly strokes: readonly AnnotationStroke[]
  readonly texts?: readonly AnnotationText[]
}

export interface ImageAnnotatorProps {
  /** 编辑器可见性 */
  visible: boolean
  /** 待标注底图(uri:本地截图 / 相册 / 远端图均可) */
  imageUri: string
  /** 取消标注(等同 onRequestClose;不产出数据) */
  onCancel: () => void
  /**
   * 保存标注:第一参为结构化标注,第二参为离屏合成出的 png 临时文件 uri(可选)。
   * 合成失败时第二参为 undefined,调用方须兼容"只有结构化数据"的情况。
   */
  onSave: (data: AnnotationData, capturedUri?: string) => void
}

/** 工具模式:画笔 / 文字 */
type ToolMode = 'pen' | 'text'
/** 操作流水(撤销时据此判断回退的是笔画还是文字) */
type AnnotationOp = 'stroke' | 'text'

const styles = StyleSheet.create({
  // ── 全屏编辑器容器 ──
  root: {
    flex: 1,
    backgroundColor: tokens.surface.dark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(20),
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  headerClose: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── 画布:底图 + 标注层 + 手势层三层同盒叠放 ──
  canvasWrap: {
    flex: 1,
    marginHorizontal: rpx(24),
    borderRadius: rnRadius.lg,
    overflow: 'hidden',
    backgroundColor: tokens.surface.card,
  },
  // RN 类型面无 absoluteFillObject(仅 absoluteFill 且为注册样式不可展开) → 手写四向
  // (与 SearchOverlay.tsx 同一口径)
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  canvasImage: {
    flex: 1,
  },
  canvasText: {
    position: 'absolute',
    fontSize: 15,
    fontWeight: '600',
    maxWidth: '80%',
  },
  pendingDot: {
    position: 'absolute',
    width: rpx(16),
    height: rpx(16),
    marginLeft: rpx(-8),
    marginTop: rpx(-8),
    borderRadius: rnRadius.xs,
  },
  // ── 离屏合成舞台:与画布同尺寸,top:-9999 移出可视区但视图树照常渲染 ──
  // (opacity:0 也能截到,这里用移出屏外更直观;captureRef 对参与渲染的原生视图截图,
  // 与"是否在可视区内"无关,故该方式可靠)
  stageOffscreen: {
    position: 'absolute',
    top: -9999,
    left: 0,
    overflow: 'hidden',
    backgroundColor: tokens.surface.card,
  },
  // ── 工具栏 ──
  toolbar: {
    paddingHorizontal: rpx(32),
    paddingTop: rpx(20),
    paddingBottom: rpx(12),
    gap: rpx(16),
    backgroundColor: tokens.surface.card,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(16),
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(6),
    paddingHorizontal: rpx(20),
    paddingVertical: rpx(12),
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.muted,
  },
  toolBtnActive: {
    backgroundColor: tokens.brand.cta,
  },
  toolBtnDisabled: {
    opacity: 0.4,
  },
  toolBtnText: {
    fontSize: 13,
    color: tokens.text.primary,
  },
  toolBtnActiveText: {
    color: tokens.brand.ctaForeground,
  },
  // 颜色档:32px 圆点 + rnRadius['2xl'](16)正好成圆
  colorSwatch: {
    width: rpx(64),
    height: rpx(64),
    borderRadius: rnRadius['2xl'],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: tokens.brandAccent.deep,
  },
  // ── 文字标记输入行 ──
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(12),
  },
  textInput: {
    flex: 1,
    paddingHorizontal: rpx(20),
    paddingVertical: rpx(14),
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.muted,
    fontSize: 14,
    color: tokens.text.primary,
  },
  textInputBtn: {
    width: rpx(72),
    height: rpx(72),
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── 底部取消 / 保存 ──
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(24),
    paddingHorizontal: rpx(32),
    paddingTop: rpx(12),
    paddingBottom: rpx(32),
    backgroundColor: tokens.surface.card,
  },
  footerBtn: {
    flex: 1,
    height: 48,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnPrimary: {
    backgroundColor: tokens.brand.cta,
  },
  footerBtnDisabled: {
    opacity: 0.4,
  },
  footerBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: tokens.text.primary,
  },
  footerBtnPrimaryText: {
    color: tokens.brand.ctaForeground,
  },
  panelItemPressed: {
    opacity: 0.85,
  },
})

/** 点阵 → SVG path 的 d(折线;单点点不出线,调用方已按 MIN_STROKE_POINTS 兜底) */
function toPathD(points: readonly AnnotationPoint[]): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
}

/** 笔画集合 → SVG Path 列表(可视画布与离屏合成舞台共用同一渲染口径) */
function renderStrokePaths(strokes: readonly AnnotationStroke[]) {
  return strokes.map((stroke, i) => (
    <Path
      key={`stroke-${stroke.points.length}-${i}`}
      d={toPathD(stroke.points)}
      stroke={stroke.color}
      strokeWidth={stroke.width}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ))
}

/**
 * 图片标注编辑器(D124)。
 *
 * 手势约定:手势层只在画布盒内响应,落点与移动点一律以 locationX/locationY(已相对画布)
 * 取值并做边界判定 —— 越界的点直接丢弃(不夹取边缘),避免拖出画布时沿边生成假笔画;
 * 抬手时点数 < MIN_STROKE_POINTS 的笔画不入 strokes,单点误触不产生垃圾笔画。
 */
export function ImageAnnotator({ visible, imageUri, onCancel, onSave }: ImageAnnotatorProps) {
  const { t } = useI18n()
  const [strokes, setStrokes] = useState<readonly AnnotationStroke[]>([])
  const [texts, setTexts] = useState<readonly AnnotationText[]>([])
  const [opLog, setOpLog] = useState<readonly AnnotationOp[]>([])
  const [draft, setDraft] = useState<readonly AnnotationPoint[] | null>(null)
  const [color, setColor] = useState<string>(PEN_COLORS[0])
  const [widthIndex, setWidthIndex] = useState(0)
  const [mode, setMode] = useState<ToolMode>('pen')
  const [pendingText, setPendingText] = useState<AnnotationPoint | null>(null)
  const [textValue, setTextValue] = useState('')
  const [canvas, setCanvas] = useState({ width: 0, height: 0 })

  /** 当前画笔粗细(档位 → px;元组按下标取值在 noUncheckedIndexedAccess 下带 undefined,首档兜底) */
  const penWidth = PEN_WIDTHS[widthIndex] ?? PEN_WIDTHS[0]

  // 手势回调里要读"当前"取色/粗细/模式/画布尺寸:PanResponder 只建一次,故走 ref 镜像
  const colorRef = useRef(color)
  const widthRef = useRef(PEN_WIDTHS[0])
  const modeRef = useRef<ToolMode>(mode)
  const canvasRef = useRef(canvas)
  const draftRef = useRef<readonly AnnotationPoint[] | null>(null)

  useEffect(() => {
    colorRef.current = color
    widthRef.current = penWidth
    modeRef.current = mode
    canvasRef.current = canvas
  }, [color, penWidth, mode, canvas])

  // 每次打开都是一次干净的标注会话(关闭态不清,避免收起动画期间闪空)
  useEffect(() => {
    if (!visible) return
    setStrokes([])
    setTexts([])
    setOpLog([])
    setDraft(null)
    draftRef.current = null
    setPendingText(null)
    setTextValue('')
    setMode('pen')
  }, [visible])

  const updateDraft = useCallback((next: readonly AnnotationPoint[] | null) => {
    draftRef.current = next
    setDraft(next)
  }, [])

  /** 手势点 → 画布坐标;越界(或画布尚未布局)返回 null,该点整点丢弃 */
  const toCanvasPoint = useCallback((evt: GestureResponderEvent): AnnotationPoint | null => {
    const { locationX, locationY } = evt.nativeEvent
    const { width: w, height: h } = canvasRef.current
    if (w <= 0 || h <= 0) return null
    if (locationX < 0 || locationY < 0 || locationX > w || locationY > h) return null
    return { x: locationX, y: locationY }
  }, [])

  /** 抬手结算:够点数才成笔,否则整笔丢弃(误触不落数据) */
  const commitDraft = useCallback(() => {
    const points = draftRef.current
    updateDraft(null)
    if (!points || points.length < MIN_STROKE_POINTS) return
    setStrokes((prev) => [...prev, { points, color: colorRef.current, width: widthRef.current }])
    setOpLog((prev) => [...prev, 'stroke'])
  }, [updateDraft])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // 画布是静态图:按下即接管,不需要等移动判定;同时不让父容器抢走 responder
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => false,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          if (modeRef.current !== 'pen') return
          const point = toCanvasPoint(evt)
          if (point) updateDraft([point])
        },
        onPanResponderMove: (evt) => {
          if (modeRef.current !== 'pen') return
          const point = toCanvasPoint(evt)
          if (!point) return
          const prev = draftRef.current
          const last = prev && prev.length > 0 ? prev[prev.length - 1] : undefined
          if (!prev || !last) {
            updateDraft([point])
            return
          }
          if (Math.abs(point.x - last.x) + Math.abs(point.y - last.y) < MIN_POINT_GAP) return
          updateDraft([...prev, point])
        },
        onPanResponderRelease: (evt) => {
          if (modeRef.current === 'pen') {
            commitDraft()
            return
          }
          const point = toCanvasPoint(evt)
          if (!point) return
          setPendingText(point)
        },
        // 被系统打断(来电/手势取消)同样按抬手结算,不留悬空笔画
        onPanResponderTerminate: () => {
          commitDraft()
        },
      }),
    [commitDraft, toCanvasPoint, updateDraft],
  )

  const handleCanvasLayout = useCallback((evt: LayoutChangeEvent) => {
    const { width: w, height: h } = evt.nativeEvent.layout
    canvasRef.current = { width: w, height: h }
    setCanvas({ width: w, height: h })
  }, [])

  const undo = useCallback(() => {
    const last = opLog[opLog.length - 1]
    if (!last) return
    setOpLog((prev) => prev.slice(0, -1))
    if (last === 'stroke') setStrokes((prev) => prev.slice(0, -1))
    else setTexts((prev) => prev.slice(0, -1))
  }, [opLog])

  const clearAll = useCallback(() => {
    setStrokes([])
    setTexts([])
    setOpLog([])
    updateDraft(null)
    setPendingText(null)
    setTextValue('')
  }, [updateDraft])

  const cancelPendingText = useCallback(() => {
    setPendingText(null)
    setTextValue('')
  }, [])

  const confirmPendingText = useCallback(() => {
    const at = pendingText
    const value = textValue.trim()
    // 空文案直接收起输入行:不产出空 text 标记
    if (!at || !value) {
      cancelPendingText()
      return
    }
    setTexts((prev) => [...prev, { x: at.x, y: at.y, text: value, color: colorRef.current }])
    setOpLog((prev) => [...prev, 'text'])
    cancelPendingText()
  }, [cancelPendingText, pendingText, textValue])

  const hasContent = strokes.length > 0 || texts.length > 0

  /** 离屏合成舞台 ref:保存时由 captureRef 截为 png 临时文件 */
  const stageRef = useRef<View | null>(null)

  const handleSave = useCallback(() => {
    if (!hasContent) return
    const data: AnnotationData = { strokes, texts: texts.length > 0 ? texts : undefined }
    // 位图合成失败不阻断保存:降级为 onSave(data, undefined),与旧的纯结构化回传行为一致
    captureRef(stageRef, { format: 'png', quality: 1, result: 'tmpfile' })
      .then((uri) => onSave(data, uri || undefined))
      .catch(() => onSave(data, undefined))
  }, [hasContent, onSave, strokes, texts])

  if (!visible) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>标注图片</Text>
          <Pressable
            hitSlop={8}
            onPress={onCancel}
            style={styles.headerClose}
            accessibilityRole="button"
            accessibilityLabel={t('annot.closeA11y')}
          >
            <X size={20} color={tokens.text.primary} />
          </Pressable>
        </View>

        <View style={styles.canvasWrap} onLayout={handleCanvasLayout}>
          <Image
            source={{ uri: imageUri }}
            style={styles.canvasImage}
            resizeMode="contain"
            accessibilityLabel={t('annot.imageA11y')}
          />
          <Svg style={styles.absoluteFill} pointerEvents="none">
            {renderStrokePaths(strokes)}
            {draft && draft.length >= MIN_STROKE_POINTS ? (
              <Path
                d={toPathD(draft)}
                stroke={color}
                strokeWidth={penWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ) : null}
          </Svg>
          {texts.map((item, i) => (
            <Text
              key={`text-${i}`}
              style={[styles.canvasText, { left: item.x, top: item.y, color: item.color }]}
            >
              {item.text}
            </Text>
          ))}
          {pendingText ? (
            <View
              style={[
                styles.pendingDot,
                { left: pendingText.x, top: pendingText.y, backgroundColor: color },
              ]}
            />
          ) : null}
          <View style={styles.absoluteFill} collapsable={false} {...panResponder.panHandlers} />
        </View>

        {/* 离屏合成舞台:与可视画布同一份 strokes/texts state(单一真相,不复制数据),
            仅在量到画布尺寸后挂载,尺寸与画布完全一致,保证合成 png 与所见同构图。
            collapsable={false} 防 RN 把无手势纯布局节点折叠掉导致 ref 失效;
            只渲染已提交的笔画/文字,不含 draft 与 pendingDot(那是过程态)。 */}
        {canvas.width > 0 && canvas.height > 0 ? (
          <View
            ref={stageRef}
            collapsable={false}
            style={[styles.stageOffscreen, { width: canvas.width, height: canvas.height }]}
          >
            <Image
              source={{ uri: imageUri }}
              style={styles.canvasImage}
              resizeMode="contain"
              accessibilityLabel={t('annot.composeA11y')}
            />
            <Svg style={styles.absoluteFill} pointerEvents="none">
              {renderStrokePaths(strokes)}
            </Svg>
            {texts.map((item, i) => (
              <Text
                key={`stage-text-${i}`}
                style={[styles.canvasText, { left: item.x, top: item.y, color: item.color }]}
              >
                {item.text}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.toolbar}>
          <View style={styles.toolRow}>
            <Pressable
              onPress={() => setMode('pen')}
              style={[styles.toolBtn, mode === 'pen' && styles.toolBtnActive]}
              accessibilityRole="button"
              accessibilityLabel={t('annot.penToolA11y')}
            >
              <PenLine
                size={16}
                color={mode === 'pen' ? tokens.brand.ctaForeground : tokens.text.primary}
              />
              <Text style={[styles.toolBtnText, mode === 'pen' && styles.toolBtnActiveText]}>
                画笔
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('text')}
              style={[styles.toolBtn, mode === 'text' && styles.toolBtnActive]}
              accessibilityRole="button"
              accessibilityLabel={t('annot.textToolA11y')}
            >
              <Type
                size={16}
                color={mode === 'text' ? tokens.brand.ctaForeground : tokens.text.primary}
              />
              <Text style={[styles.toolBtnText, mode === 'text' && styles.toolBtnActiveText]}>
                文字
              </Text>
            </Pressable>
            <Pressable
              onPress={undo}
              disabled={opLog.length === 0}
              style={[styles.toolBtn, opLog.length === 0 && styles.toolBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('annot.undoA11y')}
            >
              <Undo2 size={16} color={tokens.text.primary} />
              <Text style={styles.toolBtnText}>撤销</Text>
            </Pressable>
            <Pressable
              onPress={clearAll}
              disabled={!hasContent}
              style={[styles.toolBtn, !hasContent && styles.toolBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('annot.clearA11y')}
            >
              <Trash2 size={16} color={tokens.text.primary} />
              <Text style={styles.toolBtnText}>清空</Text>
            </Pressable>
          </View>

          <View style={styles.toolRow}>
            {PEN_COLORS.map((swatch) => (
              <Pressable
                key={swatch}
                onPress={() => setColor(swatch)}
                style={styles.colorSwatch}
                accessibilityRole="button"
                accessibilityLabel={t('annot.colorA11y')}
              >
                {({ pressed }) => (
                  <View
                    style={[
                      styles.absoluteFill,
                      { backgroundColor: swatch, borderRadius: rnRadius['2xl'] },
                      color === swatch && styles.colorSwatchActive,
                      pressed && styles.panelItemPressed,
                    ]}
                  />
                )}
              </Pressable>
            ))}
          </View>

          <View style={styles.toolRow}>
            {PEN_WIDTHS.map((penWidth, i) => (
              <Pressable
                key={`width-${i}`}
                onPress={() => setWidthIndex(i)}
                style={[styles.toolBtn, widthIndex === i && styles.toolBtnActive]}
                accessibilityRole="button"
                accessibilityLabel={t('annot.penLabel', { v: t(PEN_WIDTH_LABELS[i]) })}
              >
                <Text style={[styles.toolBtnText, widthIndex === i && styles.toolBtnActiveText]}>
                  {t(PEN_WIDTH_LABELS[i])}
                </Text>
                <View
                  style={{
                    width: rpx(48),
                    height: penWidth,
                    borderRadius: rnRadius.xs,
                    backgroundColor: widthIndex === i ? tokens.brand.ctaForeground : color,
                  }}
                />
              </Pressable>
            ))}
          </View>

          {pendingText ? (
            <View style={styles.textInputRow}>
              <TextField
                colorScheme={currentRnTheme()}
                style={styles.textInput}
                value={textValue}
                onChangeText={setTextValue}
                placeholder={t('annot.markPh')}
                placeholderTextColor={tokens.text.tertiary}
                maxLength={MAX_TEXT_LENGTH}
                autoFocus
                onSubmitEditing={confirmPendingText}
                accessibilityLabel={t('annot.markInputA11y')}
              />
              <Pressable
                onPress={confirmPendingText}
                style={styles.textInputBtn}
                accessibilityRole="button"
                accessibilityLabel={t('annot.markAddA11y')}
              >
                <Check size={18} color={tokens.text.primary} />
              </Pressable>
              <Pressable
                onPress={cancelPendingText}
                style={styles.textInputBtn}
                accessibilityRole="button"
                accessibilityLabel={t('annot.markDropA11y')}
              >
                <X size={18} color={tokens.text.primary} />
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [styles.footerBtn, pressed && styles.panelItemPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Text style={styles.footerBtnText}>取消</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={!hasContent}
            style={({ pressed }) => [
              styles.footerBtn,
              styles.footerBtnPrimary,
              !hasContent && styles.footerBtnDisabled,
              pressed && styles.panelItemPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('annot.modelEditSaveA11y')}
          >
            <Text style={[styles.footerBtnText, styles.footerBtnPrimaryText]}>保存</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
