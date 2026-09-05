// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 分享领智汇值弹窗(mobile-rn 端共享组件)
 *
 * 用途:首次分享奖励引导。由 HomeScreen(进页自动检查)与 ChatScreen(分享成功后检查)共用。
 *
 * 设计说明(2026-09-05 重做,替换原白底 + 双黑按钮方案):
 * - 宽度封顶 380:原实现 width:'84%',桌面端(1402px)会撑到 1177px 横穿屏幕,现改为
 *   width:'100%' + maxWidth,在移动端铺满、桌面端居中收敛。
 * - 编辑设计:黑金 masthead + 大号奖励数字 + 细规则线,弱化居中对称的"弹窗感"。
 * - 按钮层级:主按钮为唯一深色实心块;次按钮改为文字 + 细线,不再继承主按钮背景色
 *   (原 shareBtnSecondary 只设 marginTop,继承了黑色背景,导致两个黑块堆叠)。
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Gift, Share2, X } from 'lucide-react-native'

export interface ShareValueModalProps {
  visible: boolean
  rewardPoints: number
  onClaim: () => void
  onClose: () => void
  /** 次按钮动作:分享邀请。未传时次按钮不渲染,避免语义错位。 */
  onShare?: () => void
}

const CARD_MAX_WIDTH = 380

export function ShareValueModal({
  visible,
  rewardPoints,
  onClaim,
  onClose,
  onShare,
}: ShareValueModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.mask}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="点击关闭"
        />
        <View style={styles.center}>
          <View style={styles.card}>
            {/* 关闭(卡片右上,弱化存在) */}
            <Pressable
              hitSlop={8}
              onPress={onClose}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="关闭"
            >
              <X size={14} color={tokens.text.tertiary} />
            </Pressable>

            {/* Masthead:黑金页眉 + 奖励数字 */}
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <View style={styles.eyebrowRow}>
                  <Text style={styles.eyebrowMark}>“</Text>
                  <Text style={styles.eyebrow}>{'FIRST SHARE · 首次分享礼遇'}</Text>
                </View>
                <Gift size={16} color={tokens.vip.gold} strokeWidth={1.5} />
              </View>
              <Text style={styles.rewardNumber}>{rewardPoints}</Text>
              <View style={styles.unitRow}>
                <Text style={styles.unit}>智汇值</Text>
                <View style={styles.rule} />
              </View>
            </View>

            {/* Body */}
            <Text style={styles.title}>分享领智汇值</Text>
            <Text style={styles.desc}>
              首次分享成功,获得 <Text style={styles.descAccent}>{rewardPoints}</Text>{' '}
              智汇值奖励;邀请好友加入智汇AI社区,好友注册成功后双方均可再获智汇值。智汇值可用于兑换模型算力、会员权益等。
            </Text>

            {/* Actions */}
            <Pressable
              onPress={onClaim}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={`领取 ${rewardPoints} 智汇值`}
            >
              <Text style={styles.primaryBtnText}>领取 {rewardPoints} 智汇值</Text>
            </Pressable>
            {onShare && (
              <Pressable
                onPress={onShare}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  pressed && { backgroundColor: tokens.surface.muted },
                ]}
                accessibilityRole="button"
                accessibilityLabel="立即分享邀请好友"
              >
                <Text style={styles.secondaryBtnText}>立即分享邀请好友</Text>
                <Share2 size={13} color={tokens.text.secondary} />
              </Pressable>
            )}
            <Text style={styles.footer}>奖励领取后自动计入账户 · 每人限领一次</Text>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    backgroundColor: tokens.overlay.modal,
    position: 'relative',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    backgroundColor: tokens.surface.light,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  close: {
    position: 'absolute',
    top: 12,
    right: 10,
    padding: 6,
    zIndex: 2,
  },
  // ── Masthead ──
  header: {
    backgroundColor: tokens.gray['900'],
    padding: 20,
    paddingRight: 48,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrowRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingRight: 12,
  },
  eyebrowMark: {
    color: tokens.vip.gold,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 14,
    marginRight: 4,
  },
  eyebrow: {
    color: tokens.gray['300'],
    fontSize: 9.5,
    fontWeight: '600',
    lineHeight: 14,
    letterSpacing: 1.4,
  },
  rewardNumber: {
    color: tokens.vip.gold,
    fontSize: 64,
    fontWeight: '800',
    lineHeight: 68,
    letterSpacing: -1.5,
    marginTop: 4,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  unit: {
    color: tokens.surface.light,
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: tokens.gray['700'],
    marginHorizontal: 12,
  },
  // ── Body ──
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: tokens.text.primary,
    lineHeight: 30,
    letterSpacing: -0.4,
    marginHorizontal: 20,
    marginTop: 22,
  },
  desc: {
    fontSize: 12.5,
    lineHeight: 20,
    color: tokens.text.secondary,
    marginHorizontal: 20,
    marginTop: 10,
  },
  descAccent: {
    color: tokens.text.primary,
    fontWeight: '700',
  },
  // ── Actions ──
  primaryBtn: {
    backgroundColor: tokens.brand.DEFAULT,
    paddingVertical: 14,
    borderRadius: 10,
    marginHorizontal: 20,
    marginTop: 22,
    alignItems: 'center',
  },
  primaryBtnPressed: {
    backgroundColor: tokens.gray['700'],
  },
  primaryBtnText: {
    color: tokens.surface.light,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: tokens.surface.light,
    borderWidth: 1,
    borderColor: tokens.border.light,
    paddingVertical: 12,
    borderRadius: 10,
    marginHorizontal: 20,
    marginTop: 10,
  },
  secondaryBtnText: {
    color: tokens.text.secondary,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  footer: {
    fontSize: 10,
    lineHeight: 15,
    color: tokens.text.tertiary,
    textAlign: 'center',
    letterSpacing: 0.3,
    marginTop: 16,
    marginBottom: 18,
  },
})
