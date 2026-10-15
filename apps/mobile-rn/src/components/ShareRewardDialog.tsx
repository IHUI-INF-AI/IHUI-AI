// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ShareRewardDialog 分享领智汇值奖励弹窗(HomeScreen / ChatScreen 共享组件)
 *
 * 2026-10-15 深度重构(原两屏各持一份"标题+灰字+双按钮"弹层,视觉平淡):
 * - Hero 仪式感:顶部 brandAccent 径向光晕 + vip 金渐变圆角方章(Gift 徽章,
 *   光环/章面/内环/高光全走 Svg 属性且 rx 引用 rnRadius 档位 —— 门 11 禁容器纯圆、
 *   门 77 禁 SVG rx 字面量),奖励数字 "+N 智汇值"作视觉焦点
 * - 权益结构化:原整段灰说明拆成两条权益行(surface.muted 行底,对齐
 *   IntroducePopup benefitItem 房规),底部保留兑换用途 footnote
 * - 按钮体系:高 40 / rnRadius.xl;主钮 brand.cta + ctaForeground + 发丝边 + 投影
 *   (品牌 CTA 唯一写法,AGENTS §4);次钮文字钮;按压态走「外框拿盒与布局,
 *   面层只拿 pressed」形态(守门 131:Pressable 注册过 cssInterop,
 *   函数形态 style 会被展开成空对象静默消失)
 * - 关闭 X 收进右上角;次操作降级文字钮(text.secondary,少盒子感),缺省不渲染
 * - 入场"左右翻转 360°"动效:核心 Animated timing(cubic-out 800ms)驱动
 *   rotateY 0°→360° 绕纵轴整圈翻入(perspective 1000 供纵深),伴随缩放
 *   0.7→1 与淡入,每次弹出重放;RN Modal 自带动画只有 fade,
 *   翻转缩放必须自建(零新依赖)
 *
 * 渲染容器:RN Modal(transparent + fade)。历史病理(原 HomeScreen 分享弹层注释):
 * RN Web 上 Modal 内 flex:1 依赖原生 measure 常拿 0 高度 → 卡片不显示只剩遮罩。
 * 本组件除遮罩 flex:1(与各屏既有 modalMask 同款、已验证形态)外,卡片内容全部
 * 固定尺寸 + 内在高度,与 HomeScreen 二维码弹窗同款安全形态。
 * 所有颜色取自 design-tokens;半透明感用 fillOpacity/opacity 表达,不硬编码 rgba;
 * 圆角一律 rnRadius 档位(守门 77),不写死数字。
 */
import { useEffect, useRef } from 'react'
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg'
import { Gift, Sparkles, UserPlus, X } from 'lucide-react-native'
import { rnRadius } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'

// ── 尺寸常量(对齐 IntroducePopup 命名常量惯例) ──
/** 卡片水平内边距 */
const CARD_PADDING_H = 20
/** 卡片顶部内边距(Hero 区上方呼吸空间) */
const CARD_PADDING_TOP = 32
/** 卡片底部内边距 */
const CARD_PADDING_BOTTOM = 20
/** 顶部光晕装饰层高度 */
const GLOW_HEIGHT = 150
/** 徽章画布边长(含四周光环) */
const COIN_SIZE = 88
/** 金色徽章边长(画布内居中的圆角方章) */
const BADGE_SIZE = 64
/** 主/次按钮高度(对齐 IntroducePopup BUTTON_HEIGHT) */
const BUTTON_HEIGHT = 40
const BUTTON_FONT_SIZE = 15
const TITLE_FONT_SIZE = 18
const REWARD_FONT_SIZE = 28
const BENEFIT_FONT_SIZE = 13
const FOOTNOTE_FONT_SIZE = 11

export interface ShareRewardDialogProps {
  /** 显隐(受控) */
  visible: boolean
  /** 首次分享奖励面额(展示用;领取结果以后端返回为准) */
  reward: number
  /** 领取奖励(主 CTA) */
  onClaim: () => void
  /** 关闭(X / 遮罩 / Android 返回键) */
  onClose: () => void
  /** 次操作文案(缺省不渲染次钮;Home="稍后再说" / Chat="立即分享邀请好友") */
  secondaryLabel?: string
  /** 次操作回调(缺省时退化为 onClose) */
  onSecondaryPress?: () => void
}

/** 权益行(行底 surface.muted + 图标 + 文案,对齐 IntroducePopup benefitItem 房规) */
function BenefitRow(props: { icon: React.ReactNode; text: string }): React.JSX.Element {
  return (
    <View style={styles.benefitItem}>
      {props.icon}
      <Text style={styles.benefitText}>{props.text}</Text>
    </View>
  )
}

export function ShareRewardDialog(props: ShareRewardDialogProps): React.JSX.Element | null {
  const { visible, reward, onClaim, onClose, secondaryLabel, onSecondaryPress } = props

  // ── 入场"左右翻转 360°"动效:rotateY 绕纵轴整圈翻入 ──
  // timing(cubic-out 800ms)匀减速完成 0°→360° 翻转,伴随缩放 0.7→1 与淡入;
  // perspective 1000 给 rotateY 提供纵深(缺失时 web 上翻转会呈压扁畸变);
  // 落点恰为 360°(与 0° 同形),干净收势不回摆;每次 visible→true 重放
  const progress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!visible) return
    progress.setValue(0)
    Animated.timing(progress, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [visible, progress])
  const cardScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] })
  const cardFlip = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const cardOpacity = progress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 1, 1],
  })

  if (!visible) return null

  const handleSecondary = (): void => {
    if (onSecondaryPress) onSecondaryPress()
    else onClose()
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* 遮罩点击关闭:与卡片兄弟共存(对齐 IntroducePopup absoluteFill 形态) */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="点击关闭"
        />
        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [{ perspective: 1000 }, { scale: cardScale }, { rotateY: cardFlip }],
            },
          ]}
        >
          {/* 顶部径向光晕(brandAccent,营造"开箱"氛围;压在卡片圆角内) */}
          <Svg width="100%" height={GLOW_HEIGHT} style={styles.glow} pointerEvents="none">
            <Defs>
              <RadialGradient id="srd-glow" cx="50%" cy="0%" r="90%">
                <Stop offset="0%" stopColor={tokens.brandAccent.gradFrom} stopOpacity="0.32" />
                <Stop offset="55%" stopColor={tokens.brandAccent.gradFrom} stopOpacity="0.1" />
                <Stop offset="100%" stopColor={tokens.brandAccent.gradFrom} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height={GLOW_HEIGHT} fill="url(#srd-glow)" />
          </Svg>

          {/* 关闭 */}
          <Pressable
            hitSlop={10}
            onPress={onClose}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="关闭"
          >
            <X size={18} color={tokens.text.tertiary} />
          </Pressable>

          {/* Hero:金渐变奖励徽章(圆角方章,rx 引用 rnRadius 档位 —— 门 11 禁容器纯圆、
           *  门 77 禁 SVG rx 字面量;光环/章面/内环/高光全在 Svg 内,图标 absolute inset 0 居中) */}
          <View style={styles.coinWrap}>
            <Svg width={COIN_SIZE} height={COIN_SIZE}>
              <Defs>
                <RadialGradient id="srd-halo" cx="50%" cy="50%" r="50%">
                  <Stop offset="55%" stopColor={tokens.brandAccent.gradFrom} stopOpacity="0" />
                  <Stop offset="100%" stopColor={tokens.brandAccent.gradFrom} stopOpacity="0.32" />
                </RadialGradient>
                <LinearGradient id="srd-coin" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={tokens.vip.gold} />
                  <Stop offset="1" stopColor={tokens.vip.goldEnd} />
                </LinearGradient>
              </Defs>
              <Rect
                width={COIN_SIZE}
                height={COIN_SIZE}
                rx={rnRadius['2xl']}
                fill="url(#srd-halo)"
              />
              <Rect
                x={(COIN_SIZE - BADGE_SIZE) / 2}
                y={(COIN_SIZE - BADGE_SIZE) / 2}
                width={BADGE_SIZE}
                height={BADGE_SIZE}
                rx={rnRadius['2xl']}
                fill="url(#srd-coin)"
              />
              {/* 内环:徽章双框质感 */}
              <Rect
                x={(COIN_SIZE - BADGE_SIZE) / 2 + 6}
                y={(COIN_SIZE - BADGE_SIZE) / 2 + 6}
                width={BADGE_SIZE - 12}
                height={BADGE_SIZE - 12}
                rx={rnRadius.xl}
                fill="none"
                stroke={tokens.vip.goldEnd}
                strokeOpacity={0.55}
                strokeWidth={1.5}
              />
              {/* 左上高光 */}
              <Rect
                x={COIN_SIZE / 2 - 14}
                y={COIN_SIZE / 2 - 19}
                width={11}
                height={11}
                rx={rnRadius.sm}
                fill={tokens.gray[50]}
                fillOpacity={0.45}
              />
            </Svg>
            <View style={styles.coinIcon} pointerEvents="none">
              <Gift size={26} color={tokens.gray[900]} strokeWidth={2.2} />
            </View>
            {/* 金色星芒点缀(右上角,强化"奖励"语义) */}
            <View style={styles.sparkTopRight} pointerEvents="none">
              <Sparkles size={16} color={tokens.vip.gold} />
            </View>
          </View>

          <Text style={styles.rewardNum}>
            +{reward}
            <Text style={styles.rewardUnit}> 智汇值</Text>
          </Text>
          <Text style={styles.title}>分享领智汇值</Text>

          {/* 权益行(原整段说明结构化) */}
          <View style={styles.benefits}>
            <BenefitRow
              icon={<Sparkles size={15} color={tokens.brandAccent.deep} />}
              text={`首次分享成功,获得 ${reward} 智汇值奖励`}
            />
            <BenefitRow
              icon={<UserPlus size={15} color={tokens.brandAccent.deep} />}
              text="邀请好友加入智汇AI社区,注册成功后双方均可再获智汇值"
            />
          </View>
          <Text style={styles.footnote}>智汇值可用于兑换模型算力、会员权益等</Text>

          {/* 主 CTA:brand.cta 实底(IntroducePopup primaryButton 房规;
           *  按压态走「外框拿盒,面层拿 pressed」形态,守门 131) */}
          <Pressable
            style={styles.primaryButton}
            onPress={onClaim}
            accessibilityRole="button"
            accessibilityLabel={`领取 ${reward} 智汇值`}
          >
            {({ pressed }) => (
              <View style={[styles.buttonFace, pressed ? styles.buttonPressed : null]}>
                <Text style={styles.primaryButtonText} allowFontScaling={false}>
                  领取 {reward} 智汇值
                </Text>
              </View>
            )}
          </Pressable>

          {/* 次操作:降级为文字钮(text.secondary 常亮可见;少一个盒子,卡片更轻) */}
          {secondaryLabel ? (
            <Pressable
              style={styles.secondaryButton}
              onPress={handleSecondary}
              accessibilityRole="button"
              accessibilityLabel={secondaryLabel}
            >
              {({ pressed }) => (
                <View style={[styles.secondaryFace, pressed ? styles.buttonPressed : null]}>
                  <Text style={styles.secondaryButtonText} allowFontScaling={false}>
                    {secondaryLabel}
                  </Text>
                </View>
              )}
            </Pressable>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: tokens.overlay.modal,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  card: {
    width: '86%',
    maxWidth: 360,
    borderRadius: rnRadius.xl,
    backgroundColor: tokens.surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.light,
    paddingHorizontal: CARD_PADDING_H,
    paddingTop: CARD_PADDING_TOP,
    paddingBottom: CARD_PADDING_BOTTOM,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: tokens.gray.black,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 16,
  } as ViewStyle,
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
  } as ViewStyle,
  close: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  coinWrap: {
    width: COIN_SIZE,
    height: COIN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  } as ViewStyle,
  /** 图标盖在 Svg 币面上:inset 0 + 双向居中,保证与币面严格同心 */
  coinIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  rewardNum: {
    fontSize: REWARD_FONT_SIZE,
    lineHeight: REWARD_FONT_SIZE + 8,
    fontWeight: '800',
    color: tokens.text.primary,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  } as TextStyle,
  rewardUnit: {
    fontSize: 14,
    lineHeight: REWARD_FONT_SIZE + 8,
    fontWeight: '500',
    color: tokens.text.secondary,
  } as TextStyle,
  title: {
    fontSize: TITLE_FONT_SIZE,
    lineHeight: TITLE_FONT_SIZE + 6,
    fontWeight: '700',
    color: tokens.text.primary,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 14,
  } as TextStyle,
  benefits: {
    alignSelf: 'stretch',
    gap: 8,
    marginBottom: 10,
  } as ViewStyle,
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  } as ViewStyle,
  benefitText: {
    flex: 1,
    fontSize: BENEFIT_FONT_SIZE,
    lineHeight: BENEFIT_FONT_SIZE + 6,
    color: tokens.text.medium,
  } as TextStyle,
  footnote: {
    fontSize: FOOTNOTE_FONT_SIZE,
    lineHeight: FOOTNOTE_FONT_SIZE + 4,
    color: tokens.text.tertiary,
    textAlign: 'center',
    marginBottom: 16,
  } as TextStyle,
  primaryButton: {
    alignSelf: 'stretch',
    height: BUTTON_HEIGHT,
    borderRadius: rnRadius.sm, // 角色档 control=sm(守门 150;存量 IntroducePopup.xl 有锚点赦免,新代码必须走档)
    backgroundColor: tokens.brand.cta,
    borderWidth: 1,
    borderColor: tokens.border.light,
    shadowColor: tokens.gray.black,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  } as ViewStyle,
  secondaryButton: {
    alignSelf: 'stretch',
    marginTop: 2,
    paddingVertical: 9,
    paddingHorizontal: 20,
    alignItems: 'center',
  } as ViewStyle,
  /** 文字钮面层(守门 131:外框拿盒,面层拿 pressed) */
  secondaryFace: {
    width: '100%',
    alignItems: 'center',
  } as ViewStyle,
  /** 面层:撑满外框内容盒,承载按压态(守门 131 形态) */
  buttonFace: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rnRadius.sm, // 与外盒同档(面层超出盒圆角会穿帮)
  } as ViewStyle,
  buttonPressed: {
    opacity: 0.7,
  } as ViewStyle,
  primaryButtonText: {
    fontSize: BUTTON_FONT_SIZE,
    lineHeight: BUTTON_FONT_SIZE + 2,
    color: tokens.brand.ctaForeground,
    fontWeight: '600',
  } as TextStyle,
  secondaryButtonText: {
    fontSize: 14,
    lineHeight: 20,
    color: tokens.text.secondary,
    fontWeight: '500',
  } as TextStyle,
  /** 徽章右上角星芒(金,呼应奖励语义) */
  sparkTopRight: {
    position: 'absolute',
    top: 2,
    right: 6,
  } as ViewStyle,
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
