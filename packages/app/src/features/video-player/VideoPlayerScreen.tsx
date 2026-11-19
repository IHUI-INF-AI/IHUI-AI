// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, type ReactNode } from 'react'
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Check, Heart, Share2, Star } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { VideoPlayerProgress, VideoPlayerScreenProps } from '../../types'

import { rnCssLight, rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
// G-815966:百分比裁剪走具名唯一出口,不在屏内手搓钳位
import { clampPercent } from '@ihui/shared/utils/clamp-percent'
import { usePublishShareIntent } from '@ihui/shared/share'
import { BackChevron } from '../../components/BackChevron'
import { ScreenSkeleton } from '../../components/ScreenStates'
import { assertRequiredPort } from '../../host/ports'

export type { VideoPlayerProgress, VideoPlayerScreenProps }

/**
 * 可选缺省端口(2026-11-15 小程序薄壳化)。
 * 全部可选:一个都不注入时,本屏渲染与 mobile-rn 观感与接入端口前逐节点一致。
 * 新增可视文案一律由端口带入(label / title / description),屏内不新增中文硬编码。
 */
export interface VideoPlayerPorts {
  /**
   * 首屏加载期间是否保留 header 与播放器区(只把正文区换成骨架)。
   * 缺省 false ⇒ 整屏骨架,RN 现状零变化;true ⇒ 播放器常驻、正文区出骨架
   * (播放器自身有 loading,端侧经 playerContent 注入)。
   */
  keepPlayerWhileLoading?: boolean
  /** 视频信息块;不传不渲染(标题由端侧带入,屏内不写死) */
  info?: {
    title: string
    description?: string
    teacher?: string
    duration?: string
    tags?: readonly string[]
    chapterCount?: number
    /** 讲师前缀文案(端侧已本地化,如「讲师」);给了就渲染 `{label}: {teacher}`,
     *  缺省仍用 `·` 与时长并列 —— RN 现状零变化 */
    teacherLabel?: string
    /** 时长前缀文案;同上,缺省维持 `·` 并列 */
    durationLabel?: string
    /** 章节数**已格式化**文案(如「共 12 节」,端侧拼好);仅 chapterCount 有值时渲染,
     *  缺省不渲染章节数 —— RN 现状零变化 */
    chapterCountLabel?: string
    /** 信息块右上分享入口;不传则不渲染该按钮 */
    onPressShare?: () => void
  }
  /**
   * 互动条(赞/藏/分享);不传不渲染。
   * labels 缺省 ⇒ 仅 count>0 出数字,计数为 0 只剩图标(RN 现状零变化);
   * 给了 ⇒ 计数为 0 时落到对应文案(计数>0 仍显示数字,与原页 LikeFavoriteShare 一致)。
   */
  actions?: {
    liked: boolean
    favorited: boolean
    likeCount?: number
    favoriteCount?: number
    shareCount?: number
    onLike: () => void
    onFavorite: () => void
    onShare: () => void
    /** 三个动作下方的文案,端侧已本地化(如「点赞」「收藏」「分享」) */
    labels?: { like?: string; favorite?: string; share?: string }
  }
  /** tab 区:档位文案由端侧给,正文整块由端侧渲染(目录/简介/评论各端不同) */
  tabs?: {
    options: readonly { key: string; label: string; count?: number }[]
    value: string
    onChange: (key: string) => void
    renderBody: (key: string) => ReactNode
  }
  /** 付费弹层;visible 为 false 时整块不挂载 */
  paySheet?: {
    visible: boolean
    title?: string
    description?: string
    actionLabel?: string
    onClose: () => void
    onPay: () => void
  }
  /** 单节进度口径:给了 percent 就按百分比画(小程序),否则沿用 completedLessons/totalLessons */
  progressPercent?: { percent: number; completed?: boolean; onMarkCompleted?: () => void }
  /**
   * 是否画自绘标题条(黑底返回 + 片名),缺省 true。
   * 小程序页有原生导航栏 ⇒ 那边传 false,否则同一屏顶着两条标题栏;片名本身在信息块里另有一份,
   * 砍掉这一条不丢信息(播放器本身也从 y=0 起画,标题条会让 16:9 播放器整体下沉一截)。
   */
  showHeader?: boolean
}

export type VideoPlayerScreenWithPortsProps = VideoPlayerScreenProps & {
  ports?: VideoPlayerPorts
}

/**
 * 视频播放器共享屏 — props 注入式跨端组件
 *
 * 平台无关:渲染 header(黑色)+ 播放器 slot + 信息块/互动条/进度/tab 区(均由端口驱动)
 * + 完成按钮;平台特定(实际视频播放组件/目录/评论)由 wrapper 通过 playerContent /
 * tabs.renderBody 注入。
 */
export function VideoPlayerScreen({
  t,
  title,
  videoUrl,
  progress,
  completed,
  completing,
  loading,
  error,
  onComplete,
  onBack,
  playerContent,
  colorScheme = 'light',
  onNavigate,
  ports,
}: VideoPlayerScreenWithPortsProps) {
  assertRequiredPort('onNavigate', onNavigate)
  const {
    info,
    actions,
    tabs,
    paySheet,
    progressPercent,
    keepPlayerWhileLoading,
  }: VideoPlayerPorts = ports ?? {}
  const showHeader = ports?.showHeader !== false

  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  // 原页只 Taro.showShareMenu 开了右上角菜单、未自定义正文 ⇒ 转壳后按同族(列表/详情族)口径发布
  // 应用级两枚文案,落点由宿主按本页 router 兜底;不发布就会让这一屏的卡与同族屏分裂成两种形态。
  usePublishShareIntent({
    title: t('share.appTitle'),
    timelineTitle: t('share.timelineTitle'),
  })

  /** 信息块元信息:讲师/时长是端侧已本地化的数据,屏内不拼中文标签(共享层无该词条)。
   *  端侧给了 teacherLabel/durationLabel 才加 `{label}: ` 前缀,否则沿用 `·` 并列(接入端口前口径);
   *  章节数同理:只有端侧给了已格式化文案才渲染,屏内不拼中文。 */
  const metaParts = [
    info?.teacher
      ? info.teacherLabel
        ? `${info.teacherLabel}: ${info.teacher}`
        : info.teacher
      : '',
    info?.duration
      ? info.durationLabel
        ? `${info.durationLabel}: ${info.duration}`
        : info.duration
      : '',
    info?.chapterCount && info.chapterCountLabel ? info.chapterCountLabel : '',
  ].filter(Boolean)
  const infoMeta = metaParts.join(' · ')
  /** 互动条文案:计数>0 仍显数字(与原页一致),为 0 才落到端侧文案;无文案则不出节点 */
  const renderActionText = (count?: number, label?: string) =>
    count && count > 0 ? (
      <Text style={styles.actionCount}>{count}</Text>
    ) : label ? (
      <Text style={styles.actionLabel}>{label}</Text>
    ) : null
  const ratio = progress ? progress.completedLessons / Math.max(progress.totalLessons, 1) : 0
  // 口径:端侧给了单节百分比就按它画,否则沿用已学节数/总节数(接入端口前的口径)
  const progressBarWidth = progressPercent
    ? clampPercent(progressPercent.percent)
    : Math.round(ratio * 100)
  // 进度区:端侧薄壳接端口时「有口径才画」(原页无章节不画这块);未接端口时与接入前一致 ——
  // 标题/完成钮常显,进度条与已学节数仅在 progress 存在时画。
  const showProgressArea = ports ? Boolean(progress || progressPercent) : true
  const showProgressBar = Boolean(progress || progressPercent)
  // 完成态口径:单节百分比端口给了 completed/onMarkCompleted 时优先,否则沿用原字段
  const isCompleted = progressPercent?.completed ?? completed
  const pressComplete = progressPercent?.onMarkCompleted ?? onComplete

  /** 播放器区:给了 playerContent 就由端侧接管;keepPlayerWhileLoading 时首屏加载也照常挂播放器
   *  (播放器自带 loading)。缺省端口时该表达式等价于 `Boolean(videoUrl)`,RN 现状零变化。 */
  const showPlayerSlot = Boolean(videoUrl) || Boolean(keepPlayerWhileLoading && loading)

  // 整屏骨架只在「未要求保留播放器」时用;否则播放器常驻,骨架下沉到正文区
  if (loading && !keepPlayerWhileLoading) {
    return (
      <View style={styles.container}>
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {showHeader ? (
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title ?? ''}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      ) : null}

      {showPlayerSlot ? (
        (playerContent ?? (
          <View style={styles.noUrlBox}>
            <Text style={styles.noUrlText}>{t('player.noUrl')}</Text>
          </View>
        ))
      ) : (
        <View style={styles.noUrlBox}>
          <Text style={styles.noUrlText}>{t('player.noUrl')}</Text>
          <Text style={styles.playerHint}>{t('course.player')}</Text>
        </View>
      )}

      <View style={styles.body}>
        {loading ? (
          // 只保留播放器时,骨架落在正文区(播放器常驻、正文待取数)
          <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
        ) : (
          <>
            {info ? (
              <View style={styles.infoCard}>
                <View style={styles.infoTitleRow}>
                  <Text style={styles.infoTitle} numberOfLines={2}>
                    {info.title}
                  </Text>
                  {info.onPressShare ? (
                    <TouchableOpacity
                      style={styles.infoShareBtn}
                      onPress={info.onPressShare}
                      accessibilityRole="button"
                    >
                      <Share2 size={18} color={tk.text.secondary} strokeWidth={2} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {infoMeta ? <Text style={styles.infoMeta}>{infoMeta}</Text> : null}
                {info.tags && info.tags.length > 0 ? (
                  <View style={styles.tagRow}>
                    {info.tags.map((tag) => (
                      <View key={tag} style={styles.tagChip}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {info.description ? <Text style={styles.infoDesc}>{info.description}</Text> : null}
              </View>
            ) : null}

            {actions ? (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={actions.onLike}
                  accessibilityRole="button"
                >
                  <Heart
                    size={20}
                    strokeWidth={2}
                    color={actions.liked ? tk.brand.DEFAULT : tk.text.tertiary}
                  />
                  {renderActionText(actions.likeCount, actions.labels?.like)}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={actions.onFavorite}
                  accessibilityRole="button"
                >
                  <Star
                    size={20}
                    strokeWidth={2}
                    color={actions.favorited ? tk.brand.DEFAULT : tk.text.tertiary}
                  />
                  {renderActionText(actions.favoriteCount, actions.labels?.favorite)}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={actions.onShare}
                  accessibilityRole="button"
                >
                  <Share2 size={20} strokeWidth={2} color={tk.text.tertiary} />
                  {renderActionText(actions.shareCount, actions.labels?.share)}
                </TouchableOpacity>
              </View>
            ) : null}

            {showProgressArea ? (
              <Text style={styles.progressTitle}>{t('course.progress')}</Text>
            ) : null}
            {showProgressBar ? (
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressBarWidth}%` }]} />
                </View>
                {progress ? (
                  <Text style={styles.progressText}>
                    {t('course.progressLessons', {
                      completed: progress.completedLessons,
                      total: progress.totalLessons,
                    })}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {showProgressArea ? (
              <View style={styles.completeWrap}>
                {isCompleted ? (
                  <View style={styles.completedBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Check size={16} color={tk.success.deepText} strokeWidth={2.5} />
                      <Text style={styles.completedText}>{t('course.completed')}</Text>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.completeBtn, completing && styles.completeBtnDisabled]}
                    onPress={pressComplete}
                    disabled={completing}
                  >
                    <Text style={styles.completeBtnText}>
                      {completing ? t('common.loading') : t('course.complete')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            {tabs ? (
              <View style={styles.tabsCard}>
                <View style={styles.tabRow}>
                  {tabs.options.map((option) => {
                    const active = option.key === tabs.value
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={styles.tabItem}
                        onPress={() => tabs.onChange(option.key)}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[styles.tabLabel, active && styles.tabLabelActive]}
                          numberOfLines={1}
                        >
                          {option.count && option.count > 0
                            ? `${option.label} ${option.count}`
                            : option.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                {/* 正文整块由端侧渲染(目录/简介/评论各端结构不同),本屏只提供容器 */}
                <View style={styles.tabBody}>{tabs.renderBody(tabs.value)}</View>
              </View>
            ) : null}
          </>
        )}
      </View>

      {paySheet?.visible ? (
        <Modal visible transparent animationType="fade" onRequestClose={paySheet.onClose}>
          <View style={styles.sheetBackdrop}>
            <TouchableOpacity
              style={styles.sheetBackdropFill}
              activeOpacity={1}
              onPress={paySheet.onClose}
              accessibilityRole="button"
            />
            <View style={styles.sheetCard}>
              {paySheet.title ? <Text style={styles.sheetTitle}>{paySheet.title}</Text> : null}
              {paySheet.description ? (
                <Text style={styles.sheetDesc}>{paySheet.description}</Text>
              ) : null}
              <TouchableOpacity
                style={styles.sheetPayBtn}
                onPress={paySheet.onPay}
                accessibilityRole="button"
              >
                <Text style={styles.sheetPayText}>{paySheet.actionLabel ?? ''}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.gray.black },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingBottom: rnSpacing.md,
      backgroundColor: tk.gray.black,
    },
    headerTitle: {
      flex: 1,
      fontSize: rnType.title.size,
      color: rnCssLight.white95,
      marginHorizontal: rnSpacing.md,
    },
    headerSpacer: { width: 40 },
    noUrlBox: {
      aspectRatio: 16 / 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.gray[900],
    },
    noUrlText: { fontSize: rnType.subtitle.size, color: tk.gray[400] },
    playerHint: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.gray[500] },
    body: { flex: 1, backgroundColor: tk.surface.light, padding: rnSpacing['md-loose'] },
    infoCard: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
    },
    infoTitleRow: { flexDirection: 'row', alignItems: 'flex-start' },
    infoTitle: {
      flex: 1,
      fontSize: rnType.subtitle.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    infoShareBtn: { marginLeft: rnSpacing.sm, padding: rnSpacing.xs },
    infoMeta: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.tertiary,
    },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: rnSpacing.sm },
    tagChip: {
      marginRight: rnSpacing.sm,
      marginBottom: rnSpacing.xs,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    tagText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    infoDesc: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.body.size,
      lineHeight: rnType.body.lineHeight,
      color: tk.text.secondary,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      marginTop: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
    },
    actionItem: { alignItems: 'center', justifyContent: 'center', minWidth: 56 },
    actionCount: {
      marginTop: rnSpacing.xs,
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    /** 动作文案(点赞/收藏/分享):与计数同档位,文案由端侧端口注入 */
    actionLabel: {
      marginTop: rnSpacing.xs,
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    tabsCard: {
      marginTop: rnSpacing.md,
      borderRadius: rnRadius.lg,
      overflow: 'hidden',
      backgroundColor: tk.surface.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
    },
    tabRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tk.border.light,
    },
    tabItem: { flex: 1, alignItems: 'center', paddingVertical: rnSpacing.md },
    tabLabel: { fontSize: rnType.body.size, color: tk.text.tertiary },
    tabLabelActive: { color: tk.text.primary, fontWeight: '600' },
    tabBody: { padding: rnSpacing.sm },
    sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: tk.overlay.modal },
    /**
     * 铺满父容器的绝对定位层。**不用 `StyleSheet.absoluteFillObject`**:它只挂在 RN 的具名导出上,
     * 本包按 `react-native` 的类型面取值时该属性不存在(tsc 报 TS2551),而运行时形状就是这四边 0。
     */
    sheetBackdropFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    sheetCard: {
      padding: rnSpacing['md-loose'],
      borderTopLeftRadius: rnRadius.lg,
      borderTopRightRadius: rnRadius.lg,
      backgroundColor: tk.surface.card,
    },
    sheetTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    sheetDesc: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.secondary,
    },
    sheetPayBtn: {
      marginTop: rnSpacing.lg,
      height: 50,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetPayText: { color: tk.brand.ctaForeground, fontSize: rnType.title.size, fontWeight: '600' },
    progressTitle: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    progressWrap: { marginTop: rnSpacing.sm },
    progressTrack: {
      height: 8,
      borderRadius: rnRadius.xl,
      overflow: 'hidden',
      backgroundColor: tk.surface.card,
    },
    progressFill: { height: 8, borderRadius: rnRadius.xl, backgroundColor: tk.success.DEFAULT },
    progressText: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.medium },
    errorText: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.danger.deepText },
    completeWrap: { marginTop: rnSpacing['2xl'] },
    completedBox: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.success.light,
    },
    completedText: { fontSize: rnType.title.size, color: tk.success.deepText },
    completeBtn: {
      height: 50,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.success.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    completeBtnDisabled: { backgroundColor: tk.text.secondary },
    completeBtnText: { color: tk.surface.light, fontSize: rnType.title.size, fontWeight: '600' },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
