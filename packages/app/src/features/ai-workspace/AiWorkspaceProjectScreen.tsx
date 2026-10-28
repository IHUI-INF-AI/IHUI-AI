// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import {
  Calendar,
  CheckCircle2,
  FileText,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type {
  AiWorkspaceConvertResult,
  AiWorkspaceFile,
  AiWorkspaceMember,
  AiWorkspaceProject,
  AiWorkspaceProjectScreenProps,
  AiWorkspaceTask,
} from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

export type {
  AiWorkspaceConvertResult,
  AiWorkspaceFile,
  AiWorkspaceMember,
  AiWorkspaceProject,
  AiWorkspaceProjectScreenProps,
  AiWorkspaceTask,
}

/** ISO → `YYYY-MM-DD`（与 KnowledgeEntryReadingScreen 的 formatDate 同口径，RN 端统一短日期） */
function formatDate(value?: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 字节 → 人类可读（web FileList 显示格式化后的大小，这里同口径，>1MB 保留一位小数） */
function formatSize(bytes?: number | null): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * AiWorkspaceProjectScreen AI 工作台项目详情屏（共享层）
 *
 * 2026-10-28 补屏立，承载 web `/workspace/[id]`
 * （apps/web/app/(main)/workspace/[id]/PageClient.tsx）：
 * - 结构：顶栏（返回 / 标题）→ 项目头（名称 + 描述 + 文件数/成员数/更新时间）
 *   → 成员卡 → 任务卡 → 文件卡（上传 / 逐行转 Markdown、删除）→ 转换结果卡
 * - 平台无关：取数、上传选择器、二次确认、转换结果的生命周期全在 wrapper；
 *   本屏只吃 props + 触发回调（与 AgentEditScreen 同一「受控屏幕」口径）
 * - 成员 / 任务后端无端点（见 @ihui/types/ai-workspace.ts 头注）：数组为空即渲染空态，
 *   绝不拿 web 的 `AI_MOCK` 假任务充数
 * - 文件下载：web 走 blob + a[download]，RN 需落盘后再分享，本屏不承诺下载能力，
 *   只保留上传 / 删除 / 转 Markdown 三个真有人调的动作
 * - 样式：getTokens(colorScheme) 语义 token，零 hex，间距走 rnSpacing/rnType/rnRadius
 * - i18n：`aiWorkspace.*` 新增 + 复用 `common.back` / `common.retry` / `common.delete` / `common.close`
 */
export function AiWorkspaceProjectScreen({
  t,
  project,
  members = [],
  tasks = [],
  files = [],
  loading,
  error,
  filesLoading = false,
  filesError = '',
  uploading = false,
  uploadError = '',
  deleteError = '',
  removingFileId = null,
  convertingFileId = null,
  convertError = '',
  convertResult = null,
  onBack,
  onRetry,
  onRetryFiles,
  onUpload,
  onRemove,
  onConvert,
  onCloseConvertResult,
  colorScheme = 'light',
}: AiWorkspaceProjectScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const header = (
    <View style={styles.headerBar}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('aiWorkspace.title')}</Text>
      {/* 右侧占位：与左侧返回键等宽，标题才是真居中而不是被按钮挤偏 */}
      <View style={styles.headerSpacer} />
    </View>
  )

  if (loading && !project) {
    return (
      <View style={styles.container}>
        {header}
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error && !project) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  if (!project) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState
          message={t('aiWorkspace.notFound')}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  const fileCount = project.fileCount ?? files.length
  const memberCount = project.memberCount ?? members.length

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 项目头 —— 对齐 web ProjectHeader（名称 + 描述，描述空则回退到「项目描述」） */}
        <View style={styles.projectCard}>
          <Text style={styles.projectName}>{project.name}</Text>
          <Text style={styles.projectDesc}>
            {project.description || t('aiWorkspace.noDescription')}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaInline}>
              <FileText size={13} color={tk.text.tertiary} strokeWidth={2} />
              <Text style={styles.metaText}>
                {t('aiWorkspace.fileCount', { count: fileCount })}
              </Text>
            </View>
            <View style={styles.metaInline}>
              <Users size={13} color={tk.text.tertiary} strokeWidth={2} />
              <Text style={styles.metaText}>
                {t('aiWorkspace.memberCount', { count: memberCount })}
              </Text>
            </View>
            <View style={styles.metaInline}>
              <Calendar size={13} color={tk.text.tertiary} strokeWidth={2} />
              <Text style={styles.metaText}>{formatDate(project.updatedAt)}</Text>
            </View>
          </View>
        </View>

        {/* 成员 —— 后端无端点，空数组即空态；不编造成员 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <Users size={15} color={tk.text.secondary} strokeWidth={2} />
            <Text style={styles.sectionTitle}>{t('aiWorkspace.members')}</Text>
            <Text style={styles.sectionCount}>({members.length})</Text>
          </View>
          {members.length === 0 ? (
            <Text style={styles.emptyText}>{t('aiWorkspace.emptyMembers')}</Text>
          ) : (
            members.map((member: AiWorkspaceMember) => (
              <View key={member.id} style={styles.row}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {member.name || member.id}
                </Text>
                {member.role ? <Text style={styles.rowMeta}>{member.role}</Text> : null}
              </View>
            ))
          )}
        </View>

        {/* 任务 —— 同上，web 的任务清单是页面内 mock，这里只认宿主注入的真数据 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <CheckCircle2 size={15} color={tk.text.secondary} strokeWidth={2} />
            <Text style={styles.sectionTitle}>{t('aiWorkspace.tasks')}</Text>
            <Text style={styles.sectionCount}>({tasks.length})</Text>
          </View>
          {tasks.length === 0 ? (
            <Text style={styles.emptyText}>{t('aiWorkspace.emptyTasks')}</Text>
          ) : (
            tasks.map((task: AiWorkspaceTask) => (
              <View key={task.id} style={styles.row}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {task.title || task.id}
                </Text>
                <View style={styles.rowBadges}>
                  {task.status ? <Text style={styles.badge}>{task.status}</Text> : null}
                  {task.priority ? <Text style={styles.badge}>{task.priority}</Text> : null}
                  {task.assignee ? <Text style={styles.rowMeta}>{task.assignee}</Text> : null}
                </View>
              </View>
            ))
          )}
        </View>

        {/* 文件 —— web FilesSection：上传区 + 错误行 + 文件列表（转 Markdown / 删除） */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <FileText size={15} color={tk.text.secondary} strokeWidth={2} />
            <Text style={styles.sectionTitle}>{t('aiWorkspace.files')}</Text>
            <Text style={styles.sectionCount}>({files.length})</Text>
          </View>

          {onUpload ? (
            <TouchableOpacity
              style={[styles.uploadBtn, uploading ? styles.btnDisabled : null]}
              onPress={onUpload}
              disabled={uploading}
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <Upload size={15} color={tk.brand.ctaForeground} strokeWidth={2} />
              <Text style={styles.uploadBtnText}>
                {uploading ? t('aiWorkspace.uploading') : t('aiWorkspace.upload')}
              </Text>
            </TouchableOpacity>
          ) : null}

          {uploadError ? <Text style={styles.errorText}>{uploadError}</Text> : null}
          {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
          {convertError ? <Text style={styles.errorText}>{convertError}</Text> : null}

          {filesError ? (
            <View style={styles.filesErrorBox}>
              <Text style={styles.errorText}>{filesError}</Text>
              {onRetryFiles ? (
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={onRetryFiles}
                  accessibilityRole="button"
                  activeOpacity={0.7}
                >
                  <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : filesLoading ? (
            <Text style={styles.emptyText}>{t('common.loading')}</Text>
          ) : files.length === 0 ? (
            <Text style={styles.emptyText}>{t('aiWorkspace.emptyFiles')}</Text>
          ) : (
            files.map((file: AiWorkspaceFile) => {
              const converting = convertingFileId === file.id
              const removing = removingFileId === file.id
              const busy = converting || removing
              return (
                <View key={file.id} style={styles.fileRow}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {file.name || file.id}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {formatSize(file.size)} · {formatDate(file.createdAt)}
                  </Text>
                  <View style={styles.fileActions}>
                    {onConvert ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, busy ? styles.btnDisabled : null]}
                        onPress={() => onConvert(file)}
                        disabled={busy}
                        accessibilityRole="button"
                        activeOpacity={0.7}
                      >
                        <Sparkles size={13} color={tk.text.secondary} strokeWidth={2} />
                        <Text style={styles.actionBtnText}>
                          {converting
                            ? t('aiWorkspace.converting')
                            : t('aiWorkspace.convertToMarkdown')}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    {onRemove ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, busy ? styles.btnDisabled : null]}
                        onPress={() => onRemove(file)}
                        disabled={busy}
                        accessibilityRole="button"
                        activeOpacity={0.7}
                      >
                        <Trash2 size={13} color={tk.error.text} strokeWidth={2} />
                        <Text style={[styles.actionBtnText, styles.actionBtnDanger]}>
                          {removing ? t('aiWorkspace.removing') : t('common.delete')}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              )
            })
          )}
        </View>

        {/* 转换结果 —— web 用弹窗（MarkdownResultDialog），RN 落到同屏卡片，长按可复制 */}
        {convertResult ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHead}>
              <Sparkles size={15} color={tk.text.secondary} strokeWidth={2} />
              <Text style={styles.sectionTitle} numberOfLines={1}>
                {t('aiWorkspace.convertResult')}
              </Text>
              {onCloseConvertResult ? (
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onCloseConvertResult}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                  activeOpacity={0.7}
                >
                  <X size={15} color={tk.text.secondary} strokeWidth={2} />
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.convertFileName} numberOfLines={1}>
              {convertResult.fileName}
            </Text>
            <Text style={styles.convertBody} selectable>
              {convertResult.markdown || t('aiWorkspace.convertEmpty')}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    /* 顶部导航行 */
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.sm,
    },
    headerTitle: {
      fontSize: rnType.title.size,
      fontWeight: '500',
      color: tk.text.primary,
    },
    headerSpacer: {
      width: 32,
    },
    scroll: {
      paddingHorizontal: rnSpacing.lg,
      paddingBottom: rnSpacing['3xl'],
    },
    /* 项目头 */
    projectCard: {
      padding: rnSpacing.md,
      gap: rnSpacing.xs,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    projectName: {
      fontSize: rnType.heading.size,
      fontWeight: '700',
      color: tk.text.primary,
    },
    projectDesc: {
      fontSize: rnType.label.size,
      lineHeight: 19,
      color: tk.text.secondary,
    },
    metaRow: {
      marginTop: rnSpacing.xs,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: rnSpacing.md,
    },
    metaInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    metaText: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    /* 通用卡片区 */
    sectionCard: {
      marginTop: rnSpacing.md,
      padding: rnSpacing.md,
      gap: rnSpacing.sm,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    sectionTitle: {
      flexShrink: 1,
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    sectionCount: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    emptyText: {
      fontSize: rnType.label.size,
      color: tk.text.tertiary,
    },
    row: {
      gap: rnSpacing.xs,
      /* 行间分隔靠间距,不用单边描边(AGENTS §4 禁分割线) */
      paddingTop: rnSpacing.sm,
    },
    rowTitle: {
      fontSize: rnType.label.size,
      fontWeight: '500',
      color: tk.text.primary,
    },
    rowMeta: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    rowBadges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    badge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 1,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.light,
      fontSize: rnType.caption.size,
      color: tk.brandAccent.deep,
    },
    /* 上传 */
    uploadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      minHeight: 40,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
    },
    uploadBtnText: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
    btnDisabled: {
      opacity: 0.5,
    },
    /* 错误 / 重试 */
    errorText: {
      fontSize: rnType.caption.size,
      lineHeight: 17,
      color: tk.error.text,
    },
    filesErrorBox: {
      gap: rnSpacing.sm,
    },
    retryBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
    },
    retryBtnText: {
      fontSize: rnType.caption.size,
      color: tk.text.primary,
    },
    /* 文件行 */
    fileRow: {
      gap: rnSpacing.xs,
      /* 同上:间距代替行间线 */
      paddingTop: rnSpacing.md,
    },
    fileActions: {
      marginTop: rnSpacing.xs,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      minHeight: 32,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
    },
    actionBtnText: {
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    actionBtnDanger: {
      color: tk.error.text,
    },
    /* 转换结果 */
    closeBtn: {
      marginLeft: 'auto',
      padding: rnSpacing.xs,
    },
    convertFileName: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    convertBody: {
      fontSize: rnType.label.size,
      lineHeight: 21,
      color: tk.text.primary,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
