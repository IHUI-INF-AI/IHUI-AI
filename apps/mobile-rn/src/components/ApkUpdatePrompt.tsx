// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * APK 整包更新提示卡(2026-11-04 立,机主:「程序内推更新按钮 下载更新自动拉起安装」)。
 *
 * 与 OTA 提示卡(components/UpdatePrompt.tsx)的关系:同一处浮层位置、同一套版式语言,
 * 但**优先级更高** —— 整包能带新的原生能力,而热更只能改 JS。两卡互斥由 UpdatePrompt 决定
 * (见那边的渲染顺序),本文件只管 APK 这一档怎么画。
 *
 * 为什么不把两者塞进同一个组件:OTA 那张卡已经因为「点完更新灰屏」「读条不可见」被机主
 * 连打两轮,把 APK 的逻辑并进去等于让 APK 的新状态去干扰一条已经调稳的链路。这里只新增
 * 文件,不动 OTA 的既有分支。
 *
 * 交互只有三条,且都如实反映状态机(lib/apk-update.ts 是唯一真值):
 *   available    → [下载并安装] / [前往下载](能力缺失时)+ [关闭]
 *   downloading  → 读条 + 百分比 + [取消](绝不假装下载完)
 *   installing   → 转圈 + 「正在打开安装程序…」(应用内)或「已交给浏览器」(降级)
 */

import * as React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Download, X } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { useI18n } from '../i18n'
import { Tappable } from '@ihui/ui-native'
import {
  applyApkUpdate,
  cancelApkDownload,
  canInstallInApp,
  dismissApkPrompt,
  type ApkStore,
} from '../lib/apk-update'

/** 只有查到更新、或正在下载/安装时才该占住浮层;up-to-date/error 一律静默。 */
export function isApkPromptVisible(apk: ApkStore): boolean {
  if (apk.dismissed) return false
  return apk.state === 'available' || apk.state === 'downloading' || apk.state === 'installing'
}

/**
 * 字节数按 1024 进制折算(MB 而不是 MiB:用户只认 MB)。
 * 单位不翻译 —— MB/KB 在五语里同形,翻译反而会让读数与系统下载器对不上。
 */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** 剩余时间:mm:ss。超过 1 小时给 h:mm:ss。取整到秒,不假装比这更准。 */
function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--'
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function ApkUpdatePromptView({ apk }: { apk: ApkStore }): React.JSX.Element | null {
  const { t } = useI18n()
  if (!isApkPromptVisible(apk)) return null

  const downloading = apk.state === 'downloading'
  const installing = apk.state === 'installing'
  // 能力探测每次都现读:原生模块有没有随包进来,决定按钮写「下载并安装」还是「前往下载」。
  // 不缓存 —— 缓存会让"这次明明能直装"仍显示浏览器文案(二者体验差别很大)。
  const inApp = canInstallInApp()

  const title = apk.latestVersion
    ? t('appUpdate.apkTitle', { version: apk.latestVersion })
    : t('appUpdate.title')
  const body = downloading
    ? t('appUpdate.apkDownloading', { progress: String(apk.progress) })
    : installing
      ? apk.installMode === 'browser'
        ? t('appUpdate.apkBrowserOpening')
        : t('appUpdate.apkInstalling')
      : apk.latestVersion
        ? t('appUpdate.apkBody', {
            current: apk.currentVersion,
            latest: apk.latestVersion,
          })
        : t('appUpdate.readyBody')

  return (
    <View style={styles.card} accessibilityRole="alert" accessibilityLabel={title}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          {installing ? (
            <ActivityIndicator size="small" color={tokens.brandAccent.deep} />
          ) : (
            <Download size={16} color={tokens.brandAccent.deep} />
          )}
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
        {/* 下载/安装进行中不给关闭:关掉后用户看不到进度,下一次进前台又冒出来,像"关不掉" */}
        {downloading || installing ? null : (
          <Tappable
            onPress={dismissApkPrompt}
            hitSlop={10}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel={t('appUpdate.close')}
          >
            <X size={16} color={tokens.text.secondary} />
          </Tappable>
        )}
      </View>

      {downloading ? (
        <View style={styles.track}>
          <View style={[styles.trackBar, { width: `${apk.progress}%` }]} />
        </View>
      ) : null}

      {/* 速率与剩余时间是"几十 B/s 到底有没有在动"的正面回答:
          没有它,用户只能看着百分比发呆;有了它,慢是慢、但一眼看得出还在下。
          速率取 4 秒滚动窗口,首片到货前记 0 ⇒ 此时只显示已下/总量,不显示假的 "--:--"。 */}
      {downloading ? (
        <Text style={styles.stats} numberOfLines={1}>
          {`${formatBytes(apk.downloadedBytes)} / ${formatBytes(apk.totalBytes)}`}
          {apk.bytesPerSecond > 0
            ? ` · ${formatBytes(apk.bytesPerSecond)}/s · ${t('appUpdate.apkEta', {
                eta: formatEta(
                  (apk.totalBytes - apk.downloadedBytes) / Math.max(1, apk.bytesPerSecond),
                ),
              })}`
            : ''}
          {apk.connections > 1 ? ` · ${apk.connections}` : ''}
        </Text>
      ) : null}

      {/* 更新说明:服务端有就贴出来,没有就不占高度 */}
      {!downloading && !installing && apk.releaseNotes ? (
        <View style={styles.notesBox}>
          <Text style={styles.notesText} numberOfLines={4}>
            {apk.releaseNotes}
          </Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.hint} numberOfLines={2}>
          {installing ? '' : t('appUpdate.apkHint')}
        </Text>
        {downloading ? (
          <Tappable
            onPress={() => void cancelApkDownload()}
            style={styles.ghostBtn}
            pressedStyle={styles.btnPressed}
            accessibilityRole="button"
            accessibilityLabel={t('appUpdate.apkCancel')}
          >
            <Text style={styles.ghostText}>{t('appUpdate.apkCancel')}</Text>
          </Tappable>
        ) : installing ? null : (
          <Tappable
            onPress={() => void applyApkUpdate()}
            style={styles.actionBtn}
            pressedStyle={styles.btnPressed}
            accessibilityRole="button"
            accessibilityLabel={inApp ? t('appUpdate.apkAction') : t('appUpdate.apkActionBrowser')}
          >
            <Text style={styles.actionText}>
              {inApp ? t('appUpdate.apkAction') : t('appUpdate.apkActionBrowser')}
            </Text>
          </Tappable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // 位置/层级与 OTA 卡完全一致(两者互斥,不会同屏出现):见 UpdatePrompt.tsx 的渲染顺序
  card: {
    position: 'absolute',
    left: rnSpacing.lg,
    right: rnSpacing.lg,
    bottom: '18%',
    gap: rnSpacing.md,
    padding: rnSpacing.lg,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.medium,
    shadowColor: tokens.gray.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.md },
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
  closeBtn: {
    width: rnSpacing.xl + rnSpacing.sm,
    height: rnSpacing.xl + rnSpacing.sm,
    borderRadius: rnRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.muted,
  },
  track: {
    height: 4,
    borderRadius: rnRadius.xs,
    backgroundColor: tokens.surface.muted,
    overflow: 'hidden',
  },
  trackBar: {
    height: '100%',
    borderRadius: rnRadius.xs,
    backgroundColor: tokens.brandAccent.deep,
  },
  stats: {
    marginTop: rnSpacing.xs,
    color: tokens.text.tertiary,
    fontSize: rnType.caption.size,
  },
  notesBox: {
    paddingHorizontal: rnSpacing.sm,
    paddingVertical: rnSpacing.xs,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.surface.muted,
  },
  notesText: { color: tokens.text.secondary, fontSize: rnType.caption.size, lineHeight: 18 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rnSpacing.sm,
  },
  hint: { flex: 1, minWidth: 0, color: tokens.text.tertiary, fontSize: rnType.caption.size },
  ghostBtn: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rnSpacing.lg,
    paddingVertical: rnSpacing.sm,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.medium,
  },
  ghostText: { color: tokens.text.secondary, fontSize: rnType.bodySm.size, fontWeight: '600' },
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
    shadowColor: tokens.gray.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  actionText: { color: tokens.brand.ctaForeground, fontSize: rnType.bodySm.size, fontWeight: '600' },
  btnPressed: { opacity: 0.85 },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
