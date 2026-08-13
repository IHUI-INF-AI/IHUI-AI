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
 * - 浅色优雅风,rnLightTokens;圆角守门(AGENTS.md §4,无 rounded-full);无分割线(gap 间距)
 */
import { useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

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
  /** 主按钮确认回调 */
  onConfirm?: () => void
}

type ButtonAction = 'confirm' | 'close'

interface ButtonConfig {
  text: string
  primary: boolean
  action: ButtonAction
}

interface VariantConfig {
  title: string
  benefits: string[]
  moreBenefits: string
  buttons: ButtonConfig[]
  levelText?: string
}

const VARIANT_CONFIG: Record<IntroducePopupVariant, VariantConfig> = {
  index: {
    title: '会员权益介绍',
    benefits: [
      '限时优惠 588 元,8 月 8 日恢复 1288 元',
      '赠送 800 万算力,爽用独家 Agent',
      '获得分销权益,用 AI 降本增效 100 倍赚米',
      '私人 AI 客服定制权,拥有只属于自己的私密 AI',
      '无限次查看垂类赛道每日整理资讯,远超他人认知',
      '创始人排队咨询资格,AI 创业项目获取资格',
      '多对一答疑陪跑:AI 教学 / 自媒体账号搭建 / AI+全域流量陪跑 / MCN 超级个人 IP 孵化权',
      '免费 AI 导航站,AI 服务成本价,不用再被割韭菜',
      '最新研发 Agentic 内测使用资格一个月',
      '升级系统增加算力充值 / 课程开通 / 服务开通折扣',
    ],
    moreBenefits: '............约 20 项权益, 且持续增加 ↑',
    buttons: [{ text: '去开通', primary: true, action: 'confirm' }],
  },
  indexs: {
    title: '操盘手权益介绍',
    benefits: [
      '享受大额分销资格,入驻社区服务商名列',
      '会员等级拉满,享受全部满级折扣等权益',
      '二级分销权益,快速扩张团队及收益,创办一人公司',
      '最新研发前沿 agentic 内测免费使用资格一年',
      '插队定制独家定制 agent 功能 8 折优惠',
      '创始人一对一随时答疑陪跑',
      'AI 深度认知课 / AI 专家一对一陪跑教学 / 升维课程 / 深度商业课 / 流量全链路打法课程 / 免费观看',
      'AI+垂类账号孵化优先陪跑机会 / 加入 MCN 机会',
      '公司总部入驻及线下学习实操机会',
      '插队 AI 分身 / AI 客服定制开通',
    ],
    moreBenefits: '............约 20 项权益, 且持续增加 ↑',
    buttons: [
      { text: '加入我们', primary: true, action: 'confirm' },
      { text: '再咨询一下', primary: false, action: 'close' },
    ],
  },
  levelIndex: {
    title: '会员等级权益',
    benefits: [
      '限时消费 588 开通会员,获赠 588 点成长值,达到 1 级:算法萌芽',
      '达到 1500 智汇力达到 2 级:数智启源,享受 588 点成长值,达到 9.8 折',
      '达到 3000 智汇力达到 3 级:模型初阶,享受 588 点成长值,达到 9.5 折',
      '达到 4500 智汇力达到 4 级:智探先驱,享受 588 点成长值,达到 9.2 折',
      '达到 6000 智汇力达到 5 级:算构初阶,享受 588 点成长值,达到 8.9 折',
      '达到 7500 智汇力达到 6 级:数据专家,享受 588 点成长值,达到 8.6 折',
      '达到 9000 智汇力达到 7 级:智垒中枢,享受 588 点成长值,达到 8.3 折',
      '达到 10500 智汇力达到 8 级:智能领航,享受 588 点成长值,达到 8 折',
      '达到 12000 智汇力达到 9 级:量子智脑,享受 588 点成长值,达到 7.7 折',
      '达到 18888 智汇力达到 10 级:超维先知,享受 588 点成长值,达到 7 折',
    ],
    moreBenefits: '',
    levelText:
      '0 级:智域访客,升级会员享受折扣包含全部课程 / 算力 / 自动化智能体 / 知识库 / 定制服务等,持续增加功能',
    buttons: [{ text: '去开通', primary: true, action: 'confirm' }],
  },
  privateAdvisory: {
    title: '私人顾问介绍',
    benefits: [
      '权益一:顶流人脉资源圈链接机会',
      '权益二:优质创业项目分享',
      '权益三:对接资本权益',
      '权益四:AI 圈技术大佬交流学习机会',
      '权益五:AI 开源技术共享',
    ],
    moreBenefits: '',
    buttons: [{ text: '加入我们', primary: true, action: 'confirm' }],
  },
}

const SHEET_MAX_HEIGHT_PERCENT = '80%'
const SHEET_RADIUS = 16
const SHEET_PADDING = 20

const TITLE_FONT_SIZE = 18
const SUBTITLE_FONT_SIZE = 13
const LEVEL_BADGE_FONT_SIZE = 12
const LEVEL_TEXT_FONT_SIZE = 12
const BENEFIT_FONT_SIZE = 13
const MORE_FONT_SIZE = 12
const COPYRIGHT_FONT_SIZE = 10

const BENEFIT_ITEM_RADIUS = 8
const BENEFIT_ITEM_PADDING = 10
const BENEFIT_GAP = 8

const BUTTON_HEIGHT = 44
const BUTTON_RADIUS = 8
const BUTTON_FONT_SIZE = 15

export function IntroducePopup({
  visible,
  onClose,
  variant,
  level,
  title,
  content,
  onConfirm,
}: IntroducePopupProps) {
  const config = VARIANT_CONFIG[variant]
  const [closing, setClosing] = useState(false)

  const handleButton = (action: ButtonAction) => {
    if (action === 'confirm') {
      onConfirm?.()
      return
    }
    // close 动作:对齐 Uniapp close() 延迟关闭动画
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 200)
  }

  const requestClose = () => {
    if (closing) return
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 200)
  }

  const renderButtons = () => {
    const showLevelBadge = variant === 'levelIndex' && typeof level === 'number'

    return (
      <View style={styles.footer}>
        {showLevelBadge ? (
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText} allowFontScaling={false}>
              当前等级 Lv.{level}
            </Text>
          </View>
        ) : null}
        <View style={styles.buttonRow}>
          {config.buttons.map((btn) => (
            <Pressable
              key={btn.text}
              style={({ pressed }) => [
                btn.primary ? styles.primaryButton : styles.secondaryButton,
                pressed ? styles.buttonPressed : null,
              ]}
              onPress={() => handleButton(btn.action)}
              accessibilityRole="button"
              accessibilityLabel={btn.text}
            >
              <Text
                style={btn.primary ? styles.primaryButtonText : styles.secondaryButtonText}
                allowFontScaling={false}
              >
                {btn.text}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    )
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={requestClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel="关闭介绍弹窗" />
        <View style={styles.sheet}>
          <Text style={styles.title} numberOfLines={2}>
            {title ?? config.title}
          </Text>

          {content ? <Text style={styles.subtitle}>{content}</Text> : null}

          {variant === 'levelIndex' && config.levelText ? (
            <Text style={styles.levelText}>{config.levelText}</Text>
          ) : null}

          <ScrollView style={styles.benefitsScroll} contentContainerStyle={styles.benefitsContent}>
            {config.benefits.map((text, idx) => (
              <View key={idx} style={styles.benefitItem}>
                <Text style={styles.benefitNumber} allowFontScaling={false}>
                  {idx + 1}.
                </Text>
                <Text style={styles.benefitText}>{text}</Text>
              </View>
            ))}
          </ScrollView>

          {config.moreBenefits ? <Text style={styles.moreBenefits}>{config.moreBenefits}</Text> : null}

          <Text style={styles.copyright} allowFontScaling={false}>
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
    backgroundColor: tokens.surface.light,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingHorizontal: SHEET_PADDING,
    paddingTop: SHEET_PADDING,
    paddingBottom: SHEET_PADDING,
    shadowColor: tokens.gray.black,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  } as ViewStyle,
  title: {
    fontSize: TITLE_FONT_SIZE,
    lineHeight: TITLE_FONT_SIZE + 6,
    fontWeight: '700',
    color: tokens.text.primary,
    textAlign: 'center',
  } as TextStyle,
  subtitle: {
    marginTop: 8,
    fontSize: SUBTITLE_FONT_SIZE,
    lineHeight: SUBTITLE_FONT_SIZE + 6,
    color: tokens.text.secondary,
    textAlign: 'center',
  } as TextStyle,
  levelText: {
    marginTop: 8,
    fontSize: LEVEL_TEXT_FONT_SIZE,
    lineHeight: LEVEL_TEXT_FONT_SIZE + 6,
    color: tokens.purple.DEFAULT,
  } as TextStyle,
  benefitsScroll: {
    flex: 1,
    marginTop: 12,
  } as ViewStyle,
  benefitsContent: {
    gap: BENEFIT_GAP,
    paddingBottom: 8,
  } as ViewStyle,
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: tokens.surface.muted,
    borderRadius: BENEFIT_ITEM_RADIUS,
    padding: BENEFIT_ITEM_PADDING,
  } as ViewStyle,
  benefitNumber: {
    fontWeight: '700',
    fontSize: BENEFIT_FONT_SIZE,
    lineHeight: BENEFIT_FONT_SIZE + 6,
    color: tokens.text.primary,
    marginRight: 6,
  } as TextStyle,
  benefitText: {
    flex: 1,
    fontSize: BENEFIT_FONT_SIZE,
    lineHeight: BENEFIT_FONT_SIZE + 6,
    color: tokens.text.medium,
  } as TextStyle,
  moreBenefits: {
    marginTop: 10,
    fontSize: MORE_FONT_SIZE,
    lineHeight: MORE_FONT_SIZE + 4,
    color: tokens.danger.DEFAULT,
    textAlign: 'center',
  } as TextStyle,
  copyright: {
    marginTop: 8,
    fontSize: COPYRIGHT_FONT_SIZE,
    lineHeight: COPYRIGHT_FONT_SIZE + 2,
    color: tokens.text.tertiary,
    textAlign: 'center',
  } as TextStyle,
  footer: {
    marginTop: 12,
  } as ViewStyle,
  levelBadge: {
    alignSelf: 'center',
    backgroundColor: tokens.purple.light,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  } as ViewStyle,
  levelBadgeText: {
    fontSize: LEVEL_BADGE_FONT_SIZE,
    lineHeight: LEVEL_BADGE_FONT_SIZE + 2,
    color: tokens.purple.DEFAULT,
    fontWeight: '600',
  } as TextStyle,
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  } as ViewStyle,
  primaryButton: {
    flex: 1,
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: tokens.surface.light,
    borderWidth: 1,
    borderColor: tokens.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.gray.black,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
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
    color: tokens.text.primary,
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
