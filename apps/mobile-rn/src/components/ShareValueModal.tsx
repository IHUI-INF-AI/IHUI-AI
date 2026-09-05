// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

// 分享领智汇值弹窗(对齐 Uniapp ai_index share-points-popup,2026-09-05 重设计:
// 黑金杂志感页眉 + 大号奖励数字,替代旧内联 Modal;RN Web 下不使用 <Modal>,
// 用 absoluteFill View 覆盖层实现,规避 RNW Modal height-collapse 问题)

import { Gift, Share2, X } from 'lucide-react-native'
import { StyleSheet, Text, View, Pressable } from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

interface ShareValueModalProps {
  visible: boolean
  rewardPoints: number
  onClaim: () => void
  onClose: () => void
  /** 可选:立即分享回调(不传则隐藏次按钮) */
  onShare?: () => void
}

export function ShareValueModal({ visible, rewardPoints, onClaim, onClose, onShare }: ShareValueModalProps) {
  if (!visible) return null
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 遮罩层:点击关闭 */}
      <Pressable style={styles.mask} onPress={onClose} accessibilityRole="button" accessibilityLabel="点击关闭" />
      {/* 内容层:居中卡片 */}
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          {/* 关闭按钮右上角 */}
          <Pressable hitSlop={8} onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="关闭">
            <X size={14} color={tokens.text.tertiary} />
          </Pressable>
          {/* Masthead:黑金页眉 */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.eyebrowRow}>
                <Text style={styles.eyebrowMark}>{'“'}</Text>
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
            首次分享成功,获得{' '}
            <Text style={styles.descAccent}>{rewardPoints}</Text> 智汇值奖励;邀请好友加入智汇AI社区,好友注册成功后双方均可再获智汇值。
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
              style={({ pressed }) => [styles.secondaryBtn, pressed && { backgroundColor: tokens.surface.muted }]}
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
  )
}

const styles = StyleSheet.create({
  mask: {
    ...StyleSheet.absoluteFill,
    backgroundColor: tokens.overlay.modal,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: tokens.surface.light,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  close: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyebrowMark: {
    color: tokens.vip.gold,
    fontSize: 18,
    lineHeight: 20,
    fontStyle: 'italic',
    marginRight: 4,
  },
  eyebrow: {
    color: tokens.vip.gold,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '500',
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
    marginTop: 2,
  },
  unit: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    letterSpacing: 4,
    marginRight: 10,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.text.primary,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  desc: {
    fontSize: 12.5,
    lineHeight: 20,
    color: tokens.text.secondary,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  descAccent: {
    color: tokens.brand.DEFAULT,
    fontWeight: '700',
  },
  primaryBtn: {
    marginHorizontal: 20,
    marginTop: 18,
    height: 44,
    borderRadius: 8,
    backgroundColor: tokens.gray['900'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnPressed: {
    opacity: 0.85,
  },
  primaryBtnText: {
    color: tokens.vip.gold,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  secondaryBtn: {
    marginHorizontal: 20,
    marginTop: 10,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border.light,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryBtnText: {
    color: tokens.text.secondary,
    fontSize: 13,
  },
  footer: {
    fontSize: 10.5,
    color: tokens.text.tertiary,
    textAlign: 'center',
    paddingVertical: 14,
  },
})
