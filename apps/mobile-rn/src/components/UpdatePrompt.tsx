// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OTA 更新提示卡(2026-10-27 立,2026-10-28 三稿)。
 *
 * 视觉沿用 web 的 components/common/UpdateNoticeCard.tsx(图标 + 标题 + 正文 + 主钮 + 关闭),
 * 但**文案不再复用 web 的 body** —— web 是 PWA「刷新页面」,RN 是点按钮重启进程,
 * 让手机用户去"下拉刷新"是纯误导(机主 2026-10-28 当场否决)。RN 就绪态用自有的
 * appUpdate.readyBody,五语言独立维护;共用键的逐字一致性仍由 i18n 结构锁钉住。
 *
 * 职责边界:本组件**只负责呈现**,检查/下载/重启全在 lib/ota-update.ts 的状态机里
 * (设置页的「检查更新」调的是同一个入口,所以那边查到的更新这里立刻能看到卡片)。
 * 只在 ready 时弹:静默检查 → 静默下载 → 就绪才打扰用户,点[更新]立即重启生效。
 */

import * as React from 'react'
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native'
import { RefreshCw, X } from 'lucide-react-native'
import { rnRadius, rnSpacing } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { useI18n } from '../i18n'
import { appAlert } from './BottomPops'
import {
  applyOtaUpdate,
  checkOtaUpdate,
  dismissOtaPrompt,
  forceRestart,
  shouldAutoRecheck,
  useOtaUpdate,
} from '../lib/ota-update'

/** 挂载后延迟检查的毫秒数:首屏资源/请求优先,更新检查让路。 */
const CHECK_DELAY_MS = 3000
/** 回到前台补查的最小间隔:切一次前台就查一次太吵,expo-updates 也没必要。 */
const RECHECK_MIN_INTERVAL_MS = 30 * 60 * 1000

export function UpdatePrompt(): React.JSX.Element | null {
  const { t } = useI18n()
  const { state, dismissed, downloadProgress: progress } = useOtaUpdate()

  React.useEffect(() => {
    const timer = setTimeout(() => {
      void checkOtaUpdate()
    }, CHECK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  // 冷启动只查一次是不够的:app 长期挂在后台,OTA 推了也不会被看见。
  // 回到前台且距上次检查超过 30 分钟就补查一次(已有 ready 在等用户时跳过,见 shouldAutoRecheck)。
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return
      if (!shouldAutoRecheck(RECHECK_MIN_INTERVAL_MS)) return
      void checkOtaUpdate()
    })
    return () => sub.remove()
  }, [])

  // 点击后到 reload 之间必须先让遮罩真正画出来(2026-10-27 机主「点完更新直接跳到灰屏页」):
  // reloadAsync 会当场拆掉当前 JS 面,不等这一拍用户看到的就是"点完就消失",而不是"正在更新"。
  const [starting, setStarting] = React.useState(false)
  // 重启迟迟不回来(2026-10-28 机主「点了更新依旧灰屏 卡死 没任何反应」):10 秒还没
  // 落回 ready 就亮出「立即重启」原生兜底。reloadAsync 正常时进程早已重启,这枚按钮不会出现。
  const [slow, setSlow] = React.useState(false)

  React.useEffect(() => {
    if (!starting) {
      setSlow(false)
      return
    }
    const timer = setTimeout(() => setSlow(true), 10000)
    return () => clearTimeout(timer)
  }, [starting])

  const handleUpdate = React.useCallback(async () => {
    setStarting(true)
    await new Promise<void>((resolve) => setTimeout(resolve, 400))
    const ok = await applyOtaUpdate()
    // 失败不静默:卡片已回到 ready(可再点一次重试),但必须如实告诉用户刚才没成功
    if (!ok) {
      setStarting(false)
      appAlert(t('appUpdate.error'), t('appUpdate.errorDesc'))
    }
  }, [t])

  // installing 也要继续显示:点了更新到进程重启之间有一段窗口,卡片突然消失会让人以为没反应;
  // downloading 同理:静默检查开始下载后立刻出卡片 + 读条,别让用户对着黑盒等(对齐
  // 应用商店式「下载读条 → 安装」的可见链路,机主 2026-10-27 反馈「不像 web 一样有读条」)。
  const applying = state === 'installing' || starting
  const downloading = state === 'downloading'
  if ((state !== 'ready' && !applying && !downloading) || dismissed) return null

  // 重启窗口(2026-10-28 机主「点了更新依旧灰屏 卡死 没任何反应」):
  // 旧稿把整屏压成 overlay.loading(半透明灰),JS 一被拆掉就只剩一块灰,读作卡死。
  // 现在两层保障:
  //   ① 底色改成**不透明**的 surface.bg —— 任何时刻都不是"灰屏",而是与应用同色的重启页;
  //   ② 10 秒还没重启就亮出「立即重启」原生兜底(见 slow),给用户一条明确的出路。
  if (applying) {
    return (
      <View
        style={styles.applyingOverlay}
        accessibilityRole="alert"
        accessibilityLabel={t('appUpdate.installing')}
      >
        <View style={styles.applyingCard}>
          <ActivityIndicator size="large" color={tokens.brandAccent.deep} />
          <Text style={styles.applyingText}>{t('appUpdate.installing')}</Text>
          <Text style={styles.applyingHint}>{t('appUpdate.installingHint')}</Text>
          {slow ? (
            <Pressable
              onPress={forceRestart}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('appUpdate.restartNow')}
            >
              <Text style={styles.actionText}>{t('appUpdate.restartNow')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    )
  }

  /**
   * 版式(2026-10-28 三稿):
   * 机主连续否决了「就两个字那么难看」「更新两个字颜色没适配明暗主题」「凭什么提示用户去刷新页面」。
   * 三稿的取舍:
   *   ① 就绪态正文换成 RN 自己的 readyBody —— **不提刷新页面**,只说点按钮立即生效;
   *   ② 主钮改成整行大按钮(高 44dp、居中文字、品牌实底 + 成对前景),
   *      不再是一个缩在右下角的小色块 —— 明暗两套 token 下都是同档对比度;
   *   ③ 去掉「当前运行:内置包/热更」这枚技术胶囊 —— 用户不关心包身份,那是设置页的诊断信息。
   */
  return (
    <View style={styles.card} accessibilityRole="alert" accessibilityLabel={t('appUpdate.title')}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <RefreshCw size={16} color={tokens.brandAccent.deep} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{t('appUpdate.title')}</Text>
          <Text style={styles.body}>
            {downloading ? `${t('appUpdate.downloading')} ${progress}%` : t('appUpdate.readyBody')}
          </Text>
        </View>
        <Pressable
          onPress={dismissOtaPrompt}
          hitSlop={10}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel={t('appUpdate.close')}
        >
          <X size={16} color={tokens.text.secondary} />
        </Pressable>
      </View>
      {downloading ? (
        <View style={styles.track}>
          <View style={[styles.trackBar, { width: `${progress}%` }]} />
        </View>
      ) : (
        <Pressable
          onPress={() => void handleUpdate()}
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel={t('appUpdate.action')}
        >
          <Text style={styles.actionText}>{t('appUpdate.action')}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: rnSpacing.lg,
    right: rnSpacing.lg,
    // GlobalFloatBox(右下角浮窗)在 bottom 9%;提示卡片抬高避开
    bottom: '18%',
    gap: rnSpacing.md,
    padding: rnSpacing.lg,
    borderRadius: rnRadius.xl,
    backgroundColor: tokens.surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    // 描边取中档而不是浅档:卡片与页面同属 surface 族,浅档在真机上几乎看不见边界
    borderColor: tokens.border.medium,
    // 抬升档:让卡片从页面里"浮"出来(web shadow-lg 的 RN 等效)
    shadowColor: tokens.gray.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.md },
  // 图标底:强调档浅底 + 深档图标(两主题都成对可见),给卡片一个视觉锚点
  iconBadge: {
    width: rnSpacing.xl * 2,
    height: rnSpacing.xl * 2,
    borderRadius: rnRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.brandAccent.light,
  },
  titleWrap: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: tokens.text.primary, fontSize: 15, fontWeight: '600' },
  body: { color: tokens.text.secondary, fontSize: 12.5 },
  // 关闭钮:独立圆角块(原来只有一枚 18px 的 X,可点面太小也不成块)
  closeBtn: {
    width: rnSpacing.xl + rnSpacing.sm,
    height: rnSpacing.xl + rnSpacing.sm,
    borderRadius: rnRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.muted,
  },
  // 下载读条:细轨道 + 强调档实底,宽度随 store.downloadProgress(0-100)走
  track: {
    height: 4,
    borderRadius: rnRadius.xs,
    backgroundColor: tokens.surface.muted,
    overflow: 'hidden',
  },
  trackBar: {
    height: '100%',
    borderRadius: rnRadius.xs,
    // 进度条无文字载体,不构成品牌底×前景成对(R3);填充走强调档,与共享层
    // student-styles.progressFill 同一写法,品牌实底留给真正的操作钮(actionBtn)。
    backgroundColor: tokens.brandAccent.deep,
  },
  // 主钮(2026-10-28 三稿):整行大按钮。高 44dp、文字居中、品牌实底 + **成对**前景
  // (亮=黑底白字,暗=白底黑字),两套主题下对比度都锁死,不再出现"两个字糊在背景里"。
  actionBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rnSpacing.lg,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.brand.cta,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.medium,
  },
  actionBtnPressed: { opacity: 0.85 },
  actionText: { color: tokens.brand.ctaForeground, fontSize: 15, fontWeight: '600' },
  // 重启页(2026-10-28):**不透明**底色。旧稿的 overlay.loading 是半透明灰,
  // 一旦 JS 面被拆掉,底下没有内容,整屏就是一块灰 —— 用户读作"卡死"。
  applyingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.bg,
  },
  applyingCard: {
    width: '84%',
    alignItems: 'center',
    gap: rnSpacing.md,
    paddingHorizontal: rnSpacing.xl,
    paddingVertical: rnSpacing.xl,
    borderRadius: rnRadius.xl,
    backgroundColor: tokens.surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.medium,
    shadowColor: tokens.gray.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
  },
  applyingText: { color: tokens.text.primary, fontSize: 16, fontWeight: '600' },
  applyingHint: { color: tokens.text.secondary, fontSize: 13, textAlign: 'center' },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
