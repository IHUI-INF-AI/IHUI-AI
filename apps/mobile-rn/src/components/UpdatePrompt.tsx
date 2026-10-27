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
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native'
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

  // 当前跑的是哪个包(内置/热更 + 短 id):更新前后各看一眼,「生效没生效」不再靠猜
  const rb = runningBundle()
  const bundleLabel =
    rb.kind === 'ota' && rb.id
      ? `${t('appUpdate.bundleOta')} ${rb.id.slice(0, 8)}`
      : t('appUpdate.bundleEmbedded')

  return (
    <View style={styles.card} accessibilityRole="alert" accessibilityLabel={t('appUpdate.title')}>
      <RefreshCw size={20} color={tokens.brand.DEFAULT} style={styles.icon} />
      <View style={styles.textWrap}>
        <Text style={styles.title}>
          {downloading ? t('appUpdate.downloading') : t('appUpdate.title')}
        </Text>
        <Text style={styles.body}>
          {downloading ? `${t('appUpdate.downloading')} ${progress}%` : t('appUpdate.body')}
        </Text>
        {downloading ? (
          <View style={styles.track}>
            <View style={[styles.trackBar, { width: `${progress}%` }]} />
          </View>
        ) : null}
        <Text style={styles.bundleTag}>
          {t('appUpdate.currentBundle', { bundle: bundleLabel })}
        </Text>
      </View>
      {downloading ? null : (
        <Pressable
          onPress={() => void handleUpdate()}
          disabled={applying}
          style={({ pressed }) => [
            styles.actionBtn,
            pressed && styles.actionBtnPressed,
            applying && styles.actionBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('appUpdate.action')}
        >
          <Text style={styles.actionText}>
            {applying ? t('appUpdate.installing') : t('appUpdate.action')}
          </Text>
        </Pressable>
      )}
      <Pressable
        onPress={dismissOtaPrompt}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('appUpdate.close')}
      >
        <X size={18} color={tokens.text.secondary} />
      </Pressable>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: rnSpacing.md,
    padding: rnSpacing.lg,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.gray[200],
    // web 原型 shadow-sm 的 RN 等效
    shadowColor: tokens.gray.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  icon: { flexShrink: 0 },
  textWrap: { flex: 1, minWidth: 0, gap: 2 },
  // 下载读条:细轨道 + 品牌实底,宽度随 store.downloadProgress(0-100)走
  track: {
    height: 3,
    borderRadius: rnRadius.xs,
    backgroundColor: tokens.gray[200],
    marginTop: 4,
    overflow: 'hidden',
  },
  trackBar: {
    height: '100%',
    borderRadius: rnRadius.xs,
    backgroundColor: tokens.brand.cta,
  },
  // 当前包身份小字:更新前「内置包」,更新后「热更 xxxxxxxx」,前后一对照就知道生效没生效
  bundleTag: { color: tokens.text.tertiary, fontSize: 11, marginTop: 2 },
  title: { color: tokens.text.primary, fontSize: 14, fontWeight: '500' },
  body: { color: tokens.text.secondary, fontSize: 12 },
  actionBtn: {
    flexShrink: 0,
    paddingHorizontal: rnSpacing.lg,
    paddingVertical: 6,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brand.cta,
  },
  actionBtnPressed: { opacity: 0.9 },
  actionText: { color: tokens.brand.ctaForeground, fontSize: 12, fontWeight: '500' },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
