// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * IntroducePopup 介绍弹窗(mobile-rn 端)
 *
 * 合并历史 Uniapp introduce-popup 4 变体(index / indexs / levelIndex / privateAdvisory)
 * 为单一 RN 组件,用 variant prop 区分,文案默认对齐 Uniapp 各变体默认值。
 *
 * 对齐历史项目 introduce-popup/index.vue · indexs.vue · levelIndex.vue · privateAdvisory.vue:
 * - Modal 底部上滑弹层(对齐 Uniapp translateY + rotateX 动画),最高 80% 高度
 * - 顶部标题 + 可选副标题(content),中部权益列表(ScrollView),更多权益文案,版权,底部按钮
 * - 4 变体差异:index 基础单按钮 / indexs 双按钮 / levelIndex 等级权益+levelText / privateAdvisory 5 项权益
 * - 浅色优雅风,主题 token 入口;圆角守门(AGENTS.md §4,无 rounded-full);无分割线(gap 间距)
 */
import { t as tStatic } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { scaleText } from '@ihui/rn-app'
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { tokens } from '../theme/active-tokens'

import { ELEVATION_STEPS, rnRadius, rnSpacing } from '@ihui/design-tokens'

// 装饰图(拷贝自原 uniapp static/images,require 内联避免类型声明问题)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DECOR_HEADER_Y = require('../../assets/images/common/headertitley.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DECOR_HEADER_T = require('../../assets/images/common/headertitlet.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DECOR_LEFT = require('../../assets/images/common/huiyuanqy.jpg')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DECOR_QR = require('../../assets/images/common/saomaa.jpg')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DECOR_AVATAR_FALLBACK = require('../../assets/images/common/daixaodiming.png')

export type IntroducePopupVariant = 'index' | 'indexs' | 'levelIndex' | 'privateAdvisory'

export interface IntroducePopupProps {
  visible: boolean
  onClose: () => void
  variant: IntroducePopupVariant
  /** VIP 等级信息(levelIndex 用) */
  level?: number
  /** 标题(可选,默认用 variant 对应的 Uniapp 默认文案) */
  title?: string
  /** 内容(可选,作为副标题渲染于标题下方) */
  content?: string
  /** 列表文案(可选,覆盖 variant 默认权益列表;用于页面级说明如充值说明/常见问题) */
  benefits?: string[]
  /** 更多列表文案(可选,覆盖 variant 默认;传空串隐藏该行) */
  moreBenefits?: string
  /** 主按钮文案(可选,覆盖 variant 默认) */
  confirmText?: string
  /** 主按钮确认回调 */
  onConfirm?: () => void
  /** 用户头像 URL(可选,渲染于头像区;缺省用默认占位) */
  avatarUrl?: string
  /** 是否展示顶部装饰图(对齐原版 headertitley/headertitlet;默认 true) */
  showDecorations?: boolean
  /** 是否展示头像区(对齐原版 avatar-section;默认 true) */
  showAvatar?: boolean
}

type ButtonAction = 'confirm' | 'close'

interface ButtonConfig {
  /** i18n key(§19):按钮文案不再硬编码,由渲染处 tStatic(`introducePopup.${btn.key}`) 解析 */
  key: string
  primary: boolean
  action: ButtonAction
}

interface VariantConfig {
  /** i18n key 段名:渲染处 tStatic(`introducePopup.${seg}.title`) 解析 */
  seg: string
  benefits: string[]
  moreBenefits: string
  buttons: ButtonConfig[]
  levelText?: string
  /** 权益列表项间距(对齐 Uniapp 各变体不同 gap:indexs 12rpx≈6px, levelIndex 6rpx≈3px) */
  benefitGap?: number
}

const VARIANT_CONFIG: Record<IntroducePopupVariant, VariantConfig> = {
  index: {
    seg: 'index',
    benefits: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10'],
    moreBenefits: 'moreBenefits',
    buttons: [{ key: 'btnConfirm', primary: true, action: 'confirm' }],
    // 对齐 Uniapp index.vue padding 10rpx 0(≈5px)
    benefitGap: 5,
  },
  indexs: {
    seg: 'indexs',
    benefits: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10'],
    moreBenefits: 'moreBenefits',
    buttons: [
      { key: 'btnConfirm', primary: true, action: 'confirm' },
      { key: 'btnClose', primary: false, action: 'close' },
    ],
    // 对齐 Uniapp indexs.vue gap 12rpx(≈6px)
    benefitGap: 6,
  },
  levelIndex: {
    seg: 'levelIndex',
    benefits: ['lv1', 'lv2', 'lv3', 'lv4', 'lv5', 'lv6', 'lv7', 'lv8', 'lv9', 'lv10'],
    moreBenefits: '',
    levelText: 'levelText',
    buttons: [{ key: 'btnConfirm', primary: true, action: 'confirm' }],
    // 对齐 Uniapp levelIndex.vue gap 6rpx(≈3px)
    benefitGap: 3,
  },
  privateAdvisory: {
    seg: 'privateAdvisory',
    benefits: ['b1', 'b2', 'b3', 'b4', 'b5'],
    moreBenefits: '',
    buttons: [{ key: 'btnConfirm', primary: true, action: 'confirm' }],
    // 对齐 Uniapp privateAdvisory 默认间距 12rpx(≈6px)
    benefitGap: 6,
  },
}

const SHEET_MAX_HEIGHT_PERCENT = '80%'
const SHEET_PADDING_HORIZONTAL = 16
const SHEET_PADDING_VERTICAL = 20

const TITLE_FONT_SIZE = 18
const SUBTITLE_FONT_SIZE = 13
const LEVEL_BADGE_FONT_SIZE = 12
const LEVEL_TEXT_FONT_SIZE = 12
const BENEFIT_FONT_SIZE = 13
const MORE_FONT_SIZE = 12
const COPYRIGHT_FONT_SIZE = 10

// 对齐 Uniapp padding 8rpx(≈4px)
const BENEFIT_ITEM_PADDING = 4
const BENEFIT_GAP = 8

const BUTTON_HEIGHT = 40
const BUTTON_RADIUS = rnRadius.xl
const BUTTON_FONT_SIZE = 15

export function IntroducePopup({
  visible,
  onClose,
  variant,
  level,
  title,
  content,
  benefits,
  moreBenefits,
  confirmText,
  onConfirm,
  avatarUrl,
  showDecorations = true,
  showAvatar = true,
}: IntroducePopupProps) {
  const config = VARIANT_CONFIG[variant]
  // VARIANT_CONFIG 存的是 i18n key 后缀(§19),渲染处统一经 tStatic 解析;
  // 外部传入的 benefits / moreBenefits / title / confirmText props 已是成品字符串,不经解析。
  const listItems =
    benefits ?? config.benefits.map((k) => tStatic(`introducePopup.${config.seg}.${k}`))
  const moreBenefitsText =
    moreBenefits ??
    (config.moreBenefits ? tStatic(`introducePopup.${config.seg}.${config.moreBenefits}`) : '')
  const [closing, setClosing] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  // close 动作:对齐 Uniapp close() 延迟关闭动画;统一出口,避免重复 onClose 与卸载后 setState
  const scheduleClose = () => {
    if (closing) return
    setClosing(true)
    closeTimerRef.current = setTimeout(() => {
      setClosing(false)
      onClose()
    }, 200)
  }

  const handleButton = (action: ButtonAction) => {
    if (action === 'confirm') {
      onConfirm?.()
      return
    }
    scheduleClose()
  }

  const requestClose = scheduleClose

  const renderButtons = () => {
    const showLevelBadge = variant === 'levelIndex' && typeof level === 'number'

    return (
      <View style={styles.footer}>
        {showLevelBadge ? (
          <View style={styles.levelBadge}>
            <Text
              style={[styles.levelBadgeText, scaleText(styles.levelBadgeText)]}
              allowFontScaling={false}
            >
              {tStatic('uiText.currentLevel')}
              {level}
            </Text>
          </View>
        ) : null}
        <View style={styles.buttonRow}>
          {config.buttons.map((btn) => {
            const fallback = tStatic(`introducePopup.${config.seg}.${btn.key}`)
            const btnText = btn.primary && confirmText ? confirmText : fallback
            return (
              // 按压态不得写成「函数形态 style」挂在 Pressable 上:Pressable 注册过 cssInterop,
              // interop 对非数组声明执行「展开函数」得到空对象 ⇒ 整份内联 style 静默消失
              // (守门 131 那一型)。外框拿盒与布局,面层只拿 pressed。
              <Pressable
                key={btn.key}
                style={btn.primary ? styles.primaryButton : styles.secondaryButton}
                onPress={() => handleButton(btn.action)}
                accessibilityRole="button"
                accessibilityLabel={btnText}
              >
                {({ pressed }) => (
                  <View style={[styles.buttonFace, pressed ? styles.buttonPressed : null]}>
                    <Text
                      style={[
                        btn.primary ? styles.primaryButtonText : styles.secondaryButtonText,
                        scaleText(
                          btn.primary ? styles.primaryButtonText : styles.secondaryButtonText,
                        ),
                      ]}
                      allowFontScaling={false}
                    >
                      {btnText}
                    </Text>
                  </View>
                )}
              </Pressable>
            )
          })}
        </View>
      </View>
    )
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={requestClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={requestClose}
          accessibilityLabel={tStatic('introducePopup.closeA11y')}
        />
        <View style={styles.sheet}>
          {/* 顶部装饰图(对齐原版 headertitley + headertitlet 左右双图) */}
          {showDecorations ? (
            <View style={styles.decorRow}>
              <Image source={DECOR_HEADER_Y} style={styles.decorHeaderY} resizeMode="contain" />
              <Image source={DECOR_HEADER_T} style={styles.decorHeaderT} resizeMode="contain" />
            </View>
          ) : null}

          {/* 头像区(对齐原版 avatar-section-wrapper:左装饰 + 圆头像 + 身份徽标 + 右二维码) */}
          {showAvatar ? (
            <View style={styles.avatarRow}>
              <Image source={DECOR_LEFT} style={styles.decorLeft} resizeMode="contain" />
              <View style={styles.avatarWrapper}>
                <Image
                  source={DECOR_AVATAR_FALLBACK}
                  style={styles.avatarBadge}
                  resizeMode="contain"
                />
                <View style={styles.avatarCircle}>
                  <Image
                    source={avatarUrl ? { uri: avatarUrl } : DECOR_AVATAR_FALLBACK}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                </View>
              </View>
              <Image source={DECOR_QR} style={styles.decorQr} resizeMode="contain" />
            </View>
          ) : null}

          <Text style={styles.title} numberOfLines={2}>
            {title ?? tStatic(`introducePopup.${config.seg}.title`)}
          </Text>

          {content ? <Text style={styles.subtitle}>{content}</Text> : null}

          {variant === 'levelIndex' && config.levelText ? (
            <Text style={styles.levelText}>
              {tStatic(`introducePopup.${config.seg}.${config.levelText}`)}
            </Text>
          ) : null}

          <ScrollView
            style={styles.benefitsScroll}
            contentContainerStyle={[
              styles.benefitsContent,
              { gap: config.benefitGap ?? BENEFIT_GAP },
            ]}
          >
            {listItems.map((text, idx) => (
              <View key={idx} style={styles.benefitItem}>
                <Text
                  style={[styles.benefitNumber, scaleText(styles.benefitNumber)]}
                  allowFontScaling={false}
                >
                  {idx + 1}.
                </Text>
                <Text style={styles.benefitText}>{text}</Text>
              </View>
            ))}
          </ScrollView>

          {moreBenefitsText ? <Text style={styles.moreBenefits}>{moreBenefitsText}</Text> : null}

          <Text style={[styles.copyright, scaleText(styles.copyright)]} allowFontScaling={false}>
            COPYRIGHT © 2024 IKUIINE-AI ALL RIGHTS RESERVED.
          </Text>

          {renderButtons()}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: tokens.overlay.modal,
    justifyContent: 'flex-end',
  } as ViewStyle,
  sheet: {
    width: '100%',
    maxHeight: SHEET_MAX_HEIGHT_PERCENT,
    backgroundColor: tokens.surface.card,
    borderTopLeftRadius: rnRadius.xl,
    borderTopRightRadius: rnRadius.xl,
    paddingHorizontal: SHEET_PADDING_HORIZONTAL,
    paddingTop: SHEET_PADDING_VERTICAL,
    paddingBottom: SHEET_PADDING_VERTICAL,
    // 投影:模态底部弹层 → 档位 xl(原 -4/.18/16 + elevation 16)
    ...ELEVATION_STEPS.xl,
  } as ViewStyle,
  // ── 顶部装饰图(对齐原版 370x45rpx / 288x25.96rpx) ──
  decorRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  } as ViewStyle,
  decorHeaderY: {
    width: 185,
    height: 22,
  } as ImageStyle,
  decorHeaderT: {
    width: 144,
    height: 13,
  } as ImageStyle,
  // ── 头像区(对齐原版 avatar-section-wrapper) ──
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: rnSpacing['sm-loose'],
  } as ViewStyle,
  decorLeft: {
    width: 76,
    marginLeft: rnSpacing['2xl'],
  } as ImageStyle,
  avatarWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  avatarBadge: {
    position: 'absolute',
    top: -14,
    width: 77,
    zIndex: 2,
  } as ImageStyle,
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: rnRadius['2xl'],
    borderWidth: 1,
    // 强调描边取 brandAccent.deep(§4 描边档;同族先例 BottomPopup 弹窗描边、本文件权益高亮同档)
    borderColor: tokens.brandAccent.deep,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  } as ViewStyle,
  avatarImage: {
    width: 86,
    height: 86,
    borderRadius: rnRadius['2xl'],
  } as ImageStyle,
  decorQr: {
    width: 122,
  } as ImageStyle,
  title: {
    fontSize: TITLE_FONT_SIZE,
    lineHeight: TITLE_FONT_SIZE + 6,
    fontWeight: '700',
    color: tokens.text.primary,
    textAlign: 'center',
  } as TextStyle,
  subtitle: {
    marginTop: rnSpacing.sm,
    fontSize: SUBTITLE_FONT_SIZE,
    lineHeight: SUBTITLE_FONT_SIZE + 6,
    color: tokens.text.secondary,
    textAlign: 'center',
  } as TextStyle,
  levelText: {
    marginTop: rnSpacing.sm,
    fontSize: LEVEL_TEXT_FONT_SIZE,
    lineHeight: LEVEL_TEXT_FONT_SIZE + 6,
    color: tokens.brandAccent.deep,
  } as TextStyle,
  benefitsScroll: {
    flex: 1,
    marginTop: rnSpacing.md,
  } as ViewStyle,
  benefitsContent: {
    gap: BENEFIT_GAP,
    paddingBottom: rnSpacing.sm,
  } as ViewStyle,
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.lg,
    padding: BENEFIT_ITEM_PADDING,
  } as ViewStyle,
  benefitNumber: {
    fontWeight: '700',
    fontSize: BENEFIT_FONT_SIZE,
    lineHeight: BENEFIT_FONT_SIZE + 6,
    color: tokens.text.primary,
    marginRight: rnSpacing['xs-loose'],
  } as TextStyle,
  benefitText: {
    flex: 1,
    fontSize: BENEFIT_FONT_SIZE,
    lineHeight: BENEFIT_FONT_SIZE + 6,
    color: tokens.text.medium,
  } as TextStyle,
  moreBenefits: {
    marginTop: rnSpacing['sm-loose'],
    fontSize: MORE_FONT_SIZE,
    lineHeight: MORE_FONT_SIZE + 4,
    color: tokens.danger.deepText,
    textAlign: 'center',
  } as TextStyle,
  copyright: {
    marginTop: rnSpacing.sm,
    fontSize: COPYRIGHT_FONT_SIZE,
    lineHeight: COPYRIGHT_FONT_SIZE + 2,
    color: tokens.text.medium,
    textAlign: 'center',
  } as TextStyle,
  footer: {
    marginTop: rnSpacing.md,
  } as ViewStyle,
  levelBadge: {
    alignSelf: 'center',
    backgroundColor: tokens.brandAccent.light,
    borderRadius: rnRadius.md,
    paddingHorizontal: rnSpacing['sm-loose'],
    paddingVertical: rnSpacing.xs,
    marginBottom: rnSpacing['sm-loose'],
  } as ViewStyle,
  levelBadgeText: {
    fontSize: LEVEL_BADGE_FONT_SIZE,
    lineHeight: LEVEL_BADGE_FONT_SIZE + 2,
    color: tokens.brandAccent.deep,
    fontWeight: '600',
  } as TextStyle,
  buttonRow: {
    flexDirection: 'row',
    gap: rnSpacing.md,
  } as ViewStyle,
  // 面层:撑满外框内容盒,承载按压态(见 renderButtons 上方守门 131 说明)。
  buttonFace: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  primaryButton: {
    flex: 1,
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: tokens.brand.cta,
    borderWidth: 1,
    borderColor: tokens.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    // 投影:弹层内行动按钮 → 档位 md(原 2/.1/6 + elevation 3)
    ...ELEVATION_STEPS.md,
  } as ViewStyle,
  secondaryButton: {
    flex: 1,
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: tokens.gray[800],
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: BUTTON_FONT_SIZE,
    lineHeight: BUTTON_FONT_SIZE + 2,
    color: tokens.surface.light,
    fontWeight: '600',
  } as TextStyle,
})

export default IntroducePopup
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
