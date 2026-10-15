// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ShareSheet 分享面板弹窗(微信好友 / 朋友圈 / 复制链接,底部滑出)
 *
 * 2026-10-15 新增:导航栏「分享」按钮原为跳我的页(对齐 Uniapp share-image →
 * goToMyPage 的历史决策),按产品要求改为弹出微信分享面板。
 *
 * - 平台行为:Android/iOS 走 react-native-wechat-lib 真实分享(shareWebPageToSession /
 *   shareWebPageToTimeline,见 lib/wechat.ts);web 预览端微信 SDK 不可用
 *   (lib/wechat.web.ts stub),微信两项诚实降级为「复制链接 + 提示」,绝不假装成功
 * - 复制链接全平台真实可用(Clipboard)
 * - 取消分享(USER_CANCEL)静默,对齐微信授权登录的静默约定
 * - 形态:底部滑出 action sheet(Modal slide);圆角守门(顶部 xl = panel 档,
 *   图标块 lg);按压态「外框拿盒,面层拿 pressed」(守门 131);全 token,无硬编码
 * - 渲染容器同 ShareRewardDialog:除遮罩 flex:1 外内容全部内在高度(RN Web Modal 安全形态)
 */
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { Link2, MessageCircle, Users } from 'lucide-react-native'
import { rnRadius } from '@ihui/design-tokens'
import { shareWebPageToSession, shareWebPageToTimeline } from '../lib/wechat'
import { tokens } from '../theme/active-tokens'

/** 图标块边长 */
const ICON_TILE = 56
/** 取消按钮高度(对齐 house 按钮体系 40) */
const CANCEL_HEIGHT = 40
const LABEL_FONT_SIZE = 12
const TITLE_FONT_SIZE = 15

export interface ShareSheetProps {
  /** 显隐(受控) */
  visible: boolean
  /** 关闭(遮罩 / 取消 / Android 返回键) */
  onClose: () => void
  /** 分享落地页(缺省官网首页) */
  shareUrl?: string
  /** 分享卡片标题 */
  shareTitle?: string
  /** 分享卡片描述 */
  shareDescription?: string
  /** 轻提示通道(由宿主屏接 showToast;type 直接透传) */
  onNotify?: (type: 'success' | 'error' | 'info', message: string) => void
}

export function ShareSheet(props: ShareSheetProps): React.JSX.Element | null {
  const { visible, onClose, shareUrl, shareTitle, shareDescription, onNotify } = props
  if (!visible) return null

  const url = shareUrl ?? 'https://aizhs.top'
  const title = shareTitle ?? '智汇AI社区'
  const description = shareDescription ?? '来智汇AI社区,一起玩转 AI'

  /** 动作收口:通知 + 关面板(选完即收,微信系 action sheet 惯例) */
  const finishWith = (type: 'success' | 'error' | 'info', message: string): void => {
    onNotify?.(type, message)
    onClose()
  }

  /** 写剪贴板:主路径 RN Clipboard(await 接住 web 端内部异步写的拒绝);
   *  被安全策略拦(NotAllowedError)时降级 execCommand(临时 textarea 兜底) */
  const copyText = async (): Promise<boolean> => {
    try {
      await Clipboard.setString(url)
      return true
    } catch {
      // fallthrough 到 web 兜底
    }
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const ta = document.createElement('textarea')
        ta.value = url
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        return ok
      } catch {
        return false
      }
    }
    return false
  }

  /** 复制链接(可选携带降级原因,如"微信 SDK 不支持 web 平台") */
  const copyLink = async (reason?: string): Promise<void> => {
    const ok = await copyText()
    if (ok)
      finishWith('success', reason ? `已复制链接,请在微信中粘贴分享(${reason})` : '链接已复制')
    else finishWith('error', `复制失败,请手动访问 ${url}`)
  }

  /** 微信分享统一入口:SDK 不可用或分享失败时诚实降级为复制链接;取消静默收口 */
  const shareToWechat = async (target: 'session' | 'timeline'): Promise<void> => {
    try {
      if (target === 'session') {
        await shareWebPageToSession({ title, description, webpageUrl: url })
      } else {
        await shareWebPageToTimeline({ title, description, webpageUrl: url })
      }
      finishWith('success', target === 'session' ? '已分享给微信好友' : '已分享到朋友圈')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (message === 'USER_CANCEL') {
        onClose()
        return
      }
      await copyLink(message)
    }
  }

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.mask}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="点击关闭分享面板"
        />
        <View style={styles.sheet}>
          <Text style={styles.title}>分享到</Text>
          <View style={styles.row}>
            {/* 微信好友 */}
            <Pressable
              style={styles.option}
              onPress={() => void shareToWechat('session')}
              accessibilityRole="button"
              accessibilityLabel="分享到微信好友"
            >
              {({ pressed }) => (
                <View style={[styles.optionFace, pressed ? styles.pressed : null]}>
                  <View style={styles.iconTile}>
                    <MessageCircle size={24} color={tokens.success.DEFAULT} />
                  </View>
                  <Text style={styles.optionLabel}>微信好友</Text>
                </View>
              )}
            </Pressable>
            {/* 朋友圈 */}
            <Pressable
              style={styles.option}
              onPress={() => void shareToWechat('timeline')}
              accessibilityRole="button"
              accessibilityLabel="分享到朋友圈"
            >
              {({ pressed }) => (
                <View style={[styles.optionFace, pressed ? styles.pressed : null]}>
                  <View style={styles.iconTile}>
                    <Users size={24} color={tokens.success.DEFAULT} />
                  </View>
                  <Text style={styles.optionLabel}>朋友圈</Text>
                </View>
              )}
            </Pressable>
            {/* 复制链接 */}
            <Pressable
              style={styles.option}
              onPress={() => void copyLink()}
              accessibilityRole="button"
              accessibilityLabel="复制分享链接"
            >
              {({ pressed }) => (
                <View style={[styles.optionFace, pressed ? styles.pressed : null]}>
                  <View style={styles.iconTile}>
                    <Link2 size={24} color={tokens.text.primary} />
                  </View>
                  <Text style={styles.optionLabel}>复制链接</Text>
                </View>
              )}
            </Pressable>
          </View>
          {/* 取消 */}
          <Pressable
            style={styles.cancelButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="取消分享"
          >
            {({ pressed }) => (
              <View style={[styles.cancelFace, pressed ? styles.pressed : null]}>
                <Text style={styles.cancelText}>取消</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    backgroundColor: tokens.overlay.modal,
    justifyContent: 'flex-end',
  } as ViewStyle,
  sheet: {
    backgroundColor: tokens.surface.card,
    borderTopLeftRadius: rnRadius.xl,
    borderTopRightRadius: rnRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: tokens.border.light,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
  } as ViewStyle,
  title: {
    fontSize: TITLE_FONT_SIZE,
    lineHeight: TITLE_FONT_SIZE + 4,
    fontWeight: '600',
    color: tokens.text.secondary,
    textAlign: 'center',
    marginBottom: 18,
  } as TextStyle,
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  } as ViewStyle,
  option: {
    flex: 1,
    alignItems: 'center',
  } as ViewStyle,
  /** 面层(守门 131:外框拿盒,面层拿 pressed) */
  optionFace: {
    alignItems: 'center',
    gap: 8,
  } as ViewStyle,
  pressed: { opacity: 0.6 } as ViewStyle,
  iconTile: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  optionLabel: {
    fontSize: LABEL_FONT_SIZE,
    lineHeight: LABEL_FONT_SIZE + 4,
    color: tokens.text.secondary,
  } as TextStyle,
  cancelButton: {
    alignSelf: 'stretch',
    height: CANCEL_HEIGHT,
    borderRadius: rnRadius.sm, // 角色档 control=sm(守门 150)
    backgroundColor: tokens.surface.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.light,
  } as ViewStyle,
  cancelFace: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rnRadius.sm, // 与外盒同档
  } as ViewStyle,
  cancelText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: tokens.text.primary,
  } as TextStyle,
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
