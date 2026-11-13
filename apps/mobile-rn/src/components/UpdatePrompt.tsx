// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OTA 更新提示卡(2026-10-27 立,与 web 端同一版式)。
 *
 * 视觉单一真相源 = web 的 components/common/UpdateNoticeCard.tsx:
 *   RefreshCw 图标(brand) + 「有新版本可用」+「刷新页面以获取最新版本」+ [更新] cta + 关闭 X。
 * 文案单一真相源 = packages/i18n 的 appUpdate 命名空间(与 web 逐字同值,有结构锁测试钉住)。
 *
 * 职责边界:本组件**只负责呈现**,检查/下载/重启全在 lib/ota-update.ts 的状态机里
 * (设置页的「检查更新」调的是同一个入口,所以那边查到的更新这里立刻能看到卡片)。
 * 只在 ready 时弹:静默检查 → 静默下载 → 就绪才打扰用户,点[更新]立即重启生效。
 */

import * as React from 'react'
import { ActivityIndicator, Animated, AppState, StyleSheet, Text, View } from 'react-native'
import { RefreshCw, X } from 'lucide-react-native'
import { ELEVATION_STEPS, rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { useI18n } from '../i18n'
import { appAlert } from './BottomPops'
import {
  applyOtaUpdate,
  checkOtaUpdate,
  dismissOtaPrompt,
  runningBundle,
  shouldAutoRecheck,
  useOtaUpdate,
} from '../lib/ota-update'
import {
  checkApkUpdate,
  onApkAppForeground,
  shouldAutoRecheckApk,
  useApkUpdate,
} from '../lib/apk-update'
import { tryAutoApplyApk } from '../lib/auto-install'
import { AutoInstallGuide } from './AutoInstallGuide'
import { ApkUpdatePromptView, isApkPromptVisible } from './ApkUpdatePrompt'
import { Tappable } from '@ihui/ui-native'

/** 挂载后延迟检查的毫秒数:首屏资源/请求优先,更新检查让路。 */
const CHECK_DELAY_MS = 3000
/** 回到前台补查的最小间隔:切一次前台就查一次太吵,expo-updates 也没必要。 */
const RECHECK_MIN_INTERVAL_MS = 30 * 60 * 1000

export function UpdatePrompt(): React.JSX.Element | null {
  const { t } = useI18n()
  const { state, dismissed, downloadProgress: progress, mandatory } = useOtaUpdate()
  // 整包(APK)通道的状态;与 OTA 是两份独立 store,由下面的渲染顺序决定谁占浮层
  const apk = useApkUpdate()

  // APK 卡的挂载保持:isApkPromptVisible 变 false(关闭/状态推进)后,APK 卡要播完滑出动画才能卸载,
  // 否则看不到"滑回去"。apkRender 在可见时为 true、退场结束(onExited)才置 false(与 OTA 卡的 render 对称)。
  const [apkRender, setApkRender] = React.useState(isApkPromptVisible(apk))
  const handleApkExited = React.useCallback(() => setApkRender(false), [])
  React.useEffect(() => {
    // 与 isApkPromptVisible 同判据但内联,避免把整个 apk 对象塞进依赖数组(exhaustive-deps)
    const visible =
      apk.state === 'available' || apk.state === 'downloading' || apk.state === 'installing'
    if (visible && !apk.dismissed) setApkRender(true)
  }, [apk.state, apk.dismissed])

  React.useEffect(() => {
    const timer = setTimeout(() => {
      void checkOtaUpdate()
      // 整包:查到就自动开始下载并拉起安装器(2026-11-05「完全自动」)。
      // 下载体积较大,节流与"OTA 已就绪则不整包"的判断在 lib/auto-install.ts 统一收口。
      void checkApkUpdate().then(() => {
        void tryAutoApplyApk()
      })
    }, CHECK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  // 冷启动只查一次是不够的:app 长期挂在后台,OTA 推了也不会被看见。
  // 回到前台且距上次检查超过 30 分钟就补查一次(已有 ready 在等用户时跳过,见 shouldAutoRecheck)。
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return
      // 从系统安装器返回(取消/解析失败):把无结果的 installing 复位成可重试,
      // 别让首页那张「正在打开安装程序…」一直转圈(2026-11-11 真机事故)
      onApkAppForeground()
      // 两条通道各自判"该不该补查":OTA 看 ready/下载中,APK 看是否已有可点卡片
      if (shouldAutoRecheck(RECHECK_MIN_INTERVAL_MS)) void checkOtaUpdate()
      if (shouldAutoRecheckApk(RECHECK_MIN_INTERVAL_MS)) {
        void checkApkUpdate().then(() => {
          void tryAutoApplyApk()
        })
      }
    })
    return () => sub.remove()
  }, [])

  // 点击后到 reload 之间必须先让遮罩真正画出来(2026-10-27 机主「点完更新直接跳到灰屏页」):
  // reloadAsync 会当场拆掉当前 JS 面,不等这一拍用户看到的就是"点完就消失",而不是"正在更新"。
  const [starting, setStarting] = React.useState(false)

  const handleUpdate = React.useCallback(async () => {
    setStarting(true)
    await new Promise<void>((resolve) => setTimeout(resolve, 600))
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

  // 顶部下滑横幅(2026-11-13 改):原实现是 bottom:18% 浮层、无滑入动画,机主反馈"应该在顶部滑下来挂住"。
  // 这里把定位改到顶部,并用 Animated 做下滑入场 / 上滑退场。render 控制挂载:退场动画结束前不卸载,
  // 否则 dismissed 一变 true 卡片会瞬间消失,看不到"滑回去"。
  const shouldShow = (state === 'ready' || downloading) && !dismissed
  const [render, setRender] = React.useState(shouldShow)
  // 初始即置于屏幕外上方:首帧就不会在屏幕内闪一下,再滑入挂住
  const slideAnim = React.useRef(new Animated.Value(-320)).current
  const cardH = React.useRef(0)
  React.useEffect(() => {
    if (shouldShow) setRender(true)
  }, [shouldShow])
  React.useEffect(() => {
    if (!render) return
    const off = -(cardH.current || 320)
    if (shouldShow) {
      slideAnim.setValue(off)
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start()
    } else {
      Animated.timing(slideAnim, { toValue: off, duration: 200, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) setRender(false)
        },
      )
    }
  }, [render, shouldShow, slideAnim])

  // 重启窗口(2026-10-27 机主实拍「点完更新直接调到灰屏页,一直不动」):
  // 进程重启前有一段空白,没有任何反馈 ⇒ 被当成卡死。改成整幅「正在重启…」遮罩,
  // 点下去必须有反应,直到新包接管(常驻上限见 ota-update 的 reload 看门狗)。
  if (applying) {
    return (
      <View
        style={styles.applyingOverlay}
        accessibilityRole="alert"
        accessibilityLabel={t('appUpdate.installing')}
      >
        <View style={styles.applyingCard}>
          <ActivityIndicator color={tokens.brandAccent.deep} />
          <Text style={styles.applyingText}>{t('appUpdate.installing')}</Text>
        </View>
      </View>
    )
  }

  // 整包更新优先于热更(2026-11-04):APK 能带新的原生面,热更只能改 JS。
  // 两者**互斥显示** —— 同一处浮层位置不能叠两张卡(见 components/ApkUpdatePrompt.tsx 头注)。
  // apkRender 保持挂载:退场滑出动画播放期间仍渲染,结束后由 onExited 解除(与 OTA 卡的 render 对称)。
  if (apkRender || isApkPromptVisible(apk)) {
    return <ApkUpdatePromptView apk={apk} onExited={handleApkExited} />
  }

  // 服务端下发的强制更新(RN 服务端开关驱动,2026-11-13 立):非关闭全屏阻塞。
  // 默认 mandatory=false 永远走上面的顶部横幅(可关闭);仅当后端把本次更新标记为 mandatory,
  // 才升级为盖满窗口的阻塞层 —— 没有关闭 X、[更新] 是唯一出口,用户不能绕过强制生效。
  // 行为零副作用:不接后端的项目 mandatory 恒为 false,这里分支永不进入。
  // (仅当 ready 才阻塞;downloading 阶段仍用上面的顶部横幅带读条,避免下载途中就把人卡死。)
  if (mandatory && state === 'ready') {
    return (
      <View
        style={styles.mandatoryOverlay}
        accessibilityRole="alert"
        accessibilityLabel={t('appUpdate.title')}
      >
        <View style={styles.mandatoryCard}>
          <View style={styles.iconBadge}>
            <RefreshCw size={28} color={tokens.brandAccent.deep} />
          </View>
          <Text style={styles.mandatoryTitle}>{t('appUpdate.title')}</Text>
          <Text style={styles.mandatoryBody}>{t('appUpdate.readyBody')}</Text>
          <Tappable
            onPress={() => void handleUpdate()}
            style={styles.actionBtn}
            pressedStyle={styles.actionBtnPressed}
            accessibilityRole="button"
            accessibilityLabel={t('appUpdate.action')}
          >
            <Text style={styles.actionText}>{t('appUpdate.action')}</Text>
          </Tappable>
        </View>
      </View>
    )
  }

  // 没有更新卡占浮层时,提醒一次"开启自动安装"(一次性动作,开了之后整条链才真正 0 点击)
  if (state !== 'ready' && !downloading) return <AutoInstallGuide />

  // 退场动画播放期间 render 仍为 true,待滑出结束才卸载;此处据此放行 OTA 卡
  if (!render) return null

  // 当前跑的是哪个包(内置/热更 + 短 id):更新前后各看一眼,「生效没生效」不再靠猜
  const rb = runningBundle()
  const bundleLabel =
    rb.kind === 'ota' && rb.id
      ? `${t('appUpdate.bundleOta')} ${rb.id.slice(0, 8)}`
      : t('appUpdate.bundleEmbedded')

  /**
   * 版式(2026-10-27 二稿,机主反馈「更新两个字看不清、跟背景色一样、太难看了」):
   * 旧稿把图标/文字/按钮平铺成一行,按钮只靠 brand.cta 裸色块区分,卡片与页面又同是 surface 档
   * ⇒ 在浅色页上整块糊成一片。新稿给出明确层级:
   *   ① 图标收进强调档圆角底(视觉锚点)  ② 标题/正文分行,字号拉开
   *   ③ 按钮独立成行、加高加宽 + 描边 + 投影(可点区域 ≥ 32dp)  ④ 包身份收进浅底胶囊
   *   ⑤ 关闭钮做成独立圆角块(命中区不再只是一个 18px 的 X)
   * 配色仍全部取 token:品牌实底只出现在主钮(`brand.cta` ↔ `brand.ctaForeground` 成对)。
   */
  return (
    <Animated.View
      style={[styles.card, { transform: [{ translateY: slideAnim }] }]}
      onLayout={(e) => {
        cardH.current = e.nativeEvent.layout.height
      }}
      accessibilityRole="alert"
      accessibilityLabel={t('appUpdate.title')}
    >
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
        <Tappable
          onPress={dismissOtaPrompt}
          hitSlop={10}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel={t('appUpdate.close')}
        >
          <X size={16} color={tokens.text.secondary} />
        </Tappable>
      </View>
      {downloading ? (
        <View style={styles.track}>
          <View style={[styles.trackBar, { width: `${progress}%` }]} />
        </View>
      ) : null}
      <View style={styles.footer}>
        <View style={styles.bundlePill}>
          <Text style={styles.bundleTag} numberOfLines={1}>
            {t('appUpdate.currentBundle', { bundle: bundleLabel })}
          </Text>
        </View>
        {downloading ? null : (
          <Tappable
            onPress={() => void handleUpdate()}
            style={styles.actionBtn}
            pressedStyle={styles.actionBtnPressed}
            accessibilityRole="button"
            accessibilityLabel={t('appUpdate.action')}
          >
            <Text style={styles.actionText}>{t('appUpdate.action')}</Text>
          </Tappable>
        )}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: rnSpacing.sm,
    left: rnSpacing.lg,
    right: rnSpacing.lg,
    // 2026-11-13:从 bottom:18% 浮层改为顶部横幅 —— 机主期望"从顶部滑下来挂住"。
    // 顶部绝对定位相对 App.tsx 的 SafeAreaView(edges=['top']),top 已是状态栏下沿,无需再加 safe area。
    // 滑入/滑出动画由组件内的 Animated translateY 驱动(初始在屏幕外上方,滑到 0 挂住)。
    gap: rnSpacing.md,
    padding: rnSpacing.lg,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    // 描边取中档而不是浅档:卡片与页面同属 surface 族,浅档在真机上几乎看不见边界
    borderColor: tokens.border.medium,
    // 抬升档:让卡片从页面里"浮"出来(web shadow-lg 的 RN 对位)→ 档位 lg
    ...ELEVATION_STEPS.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.md },
  // 图标底:强调档浅底 + 深档图标(两主题都成对可见),给卡片一个视觉锚点
  iconBadge: {
    width: rnSpacing.xl * 2,
    height: rnSpacing.xl * 2,
    borderRadius: rnRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.brandAccent.light,
  },
  titleWrap: { flex: 1, minWidth: 0, gap: rnSpacing['2xs'] },
  title: { color: tokens.text.primary, fontSize: rnType.strong.size, fontWeight: '600' },
  body: { color: tokens.text.secondary, fontSize: rnType.label.size },
  // 关闭钮:独立圆角块(原来只有一枚 18px 的 X,可点面太小也不成块)
  closeBtn: {
    width: rnSpacing.xl + rnSpacing.sm,
    height: rnSpacing.xl + rnSpacing.sm,
    borderRadius: rnRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.muted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rnSpacing.sm,
  },
  // 包身份胶囊:浅底 + 正文字档,不再用 tertiary 小字直接压在卡面上(旧稿最淡的一行)
  bundlePill: {
    flexShrink: 1,
    paddingHorizontal: rnSpacing.sm,
    paddingVertical: rnSpacing.xs,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.surface.muted,
  },
  bundleTag: { color: tokens.text.secondary, fontSize: rnType.caption.size },
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
  // 主钮:品牌实底 + 同档前景(亮=黑底白字,暗=白底黑字),加高到 32dp 并补描边 + 投影
  actionBtn: {
    flexShrink: 0,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rnSpacing.lg,
    paddingVertical: rnSpacing.sm,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brand.cta,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.medium,
    // 投影:主行动按钮(小控件)→ 档位 sm
    ...ELEVATION_STEPS.sm,
  },
  actionBtnPressed: { opacity: 0.85 },
  actionText: {
    color: tokens.brand.ctaForeground,
    fontSize: rnType.bodySm.size,
    fontWeight: '600',
  },
  // 重启遮罩:盖满窗口,中途不再出现"无内容的灰屏"
  applyingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.overlay.loading,
  },
  applyingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rnSpacing.md,
    paddingHorizontal: rnSpacing.xl,
    paddingVertical: rnSpacing.md,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.medium,
    // 投影:重启遮罩上的提示卡 → 档位 lg
    ...ELEVATION_STEPS.lg,
  },
  applyingText: { color: tokens.text.primary, fontSize: rnType.body.size, fontWeight: '500' },
  // 强制更新全屏阻塞(服务端 mandatory 开关驱动):盖满窗口、无关闭钮、[更新] 是唯一出口
  mandatoryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.overlay.loading,
    padding: rnSpacing.lg,
  },
  mandatoryCard: {
    width: '100%',
    maxWidth: 360,
    gap: rnSpacing.lg,
    alignItems: 'center',
    padding: rnSpacing.xl,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.medium,
    // 投影:强制阻塞卡片 → 档位 lg
    ...ELEVATION_STEPS.lg,
  },
  mandatoryTitle: {
    color: tokens.text.primary,
    fontSize: rnType.strong.size,
    fontWeight: '700',
    textAlign: 'center',
  },
  mandatoryBody: {
    color: tokens.text.secondary,
    fontSize: rnType.body.size,
    textAlign: 'center',
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
