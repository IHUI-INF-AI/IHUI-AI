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
  runningBundle,
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

  const handleUpdate = React.useCallback(async () => {
    const ok = await applyOtaUpdate()
    // 失败不静默:卡片已回到 ready(可再点一次重试),但必须如实告诉用户刚才没成功
    if (!ok) appAlert(t('appUpdate.error'), t('appUpdate.errorDesc'))
  }, [t])

  // installing 也要继续显示:点了更新到进程重启之间有一段窗口,卡片突然消失会让人以为没反应;
  // downloading 同理:静默检查开始下载后立刻出卡片 + 读条,别让用户对着黑盒等(对齐
  // 应用商店式「下载读条 → 安装」的可见链路,机主 2026-10-27 反馈「不像 web 一样有读条」)。
  const applying = state === 'installing'
  const downloading = state === 'downloading'
  if ((state !== 'ready' && !applying && !downloading) || dismissed) return null

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
    <View style={styles.card} accessibilityRole="alert" accessibilityLabel={t('appUpdate.title')}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <RefreshCw size={16} color={tokens.brandAccent.deep} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{t('appUpdate.title')}</Text>
          <Text style={styles.body}>
            {downloading ? `${t('appUpdate.downloading')} ${progress}%` : t('appUpdate.body')}
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
      ) : null}
      <View style={styles.footer}>
        <View style={styles.bundlePill}>
          <Text style={styles.bundleTag} numberOfLines={1}>
            {t('appUpdate.currentBundle', { bundle: bundleLabel })}
          </Text>
        </View>
        {downloading ? null : (
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
  bundleTag: { color: tokens.text.secondary, fontSize: 11 },
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
    borderRadius: rnRadius.md,
    backgroundColor: tokens.brand.cta,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.medium,
    shadowColor: tokens.gray.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  actionBtnPressed: { opacity: 0.85 },
  actionText: { color: tokens.brand.ctaForeground, fontSize: 13, fontWeight: '600' },
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
  applyingText: { color: tokens.text.primary, fontSize: 14, fontWeight: '500' },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
