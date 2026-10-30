// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { FileText, FolderOpen, Trash2 } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'workspaceDetailPage'

/** 项目头部视图模型(名称/描述来自 GET /api/workspace/projects/:id) */
export interface WorkspaceProjectHeaderView {
  name: string
  description: string
  /** 薄壳按 web 同参 Intl 化后的更新时间文本 */
  updatedAtText: string
}

/** 文件行视图模型(大小/时间由薄壳格式化,本屏不做单位换算) */
export interface WorkspaceFileRowView {
  id: string
  name: string
  sizeText: string
  mimeType: string
  uploadedAtText: string
}

export interface WorkspaceDetailScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(与 web useAuthGate + AuthGatePrompt 同口径) */
  loginRequiredText: string
  loading: boolean
  error: string | null
  project: WorkspaceProjectHeaderView | null
  files: WorkspaceFileRowView[]
  /** 正在删除的文件 id(禁用该行按钮,防连点) */
  deletingId: string | null
  onDelete: (fileId: string) => void
  onRefresh: () => void
  /** 动作结果条(成功/失败文案由薄壳 t() 后注入),null = 不显示 */
  banner: { tone: 'success' | 'error'; text: string } | null
}

/**
 * 工作区项目详情共享屏 —— 承载 web `/workspace/[id]`。
 *
 * 端点(全部 apps/api 真实注册,apps/api/src/routes/workspace.ts;prefix `/api/workspace` 见 routes/index.ts:563):
 *  - GET    /api/workspace/projects/:id       → success({ project })  (workspace.ts:264-279)
 *  - GET    /api/workspace/projects/:id/files → success({ files })    (workspace.ts:335-351)
 *  - DELETE /api/workspace/files/:id          → success({ deleted })  (workspace.ts:653-690,软删除)
 *
 * 与 web 的承载范围差(如实登记,不造假按钮):
 *  - 承载:项目头(名称/描述/更新时间)、文件列表(文件名/大小/类型/上传时间)、删除文件、下拉刷新。
 *  - 未承载:上传(web 走 POST /projects/:id/files multipart,需 RN 文档选择器)、下载/预览
 *    (web 用 fetchRaw + createObjectURL,RN 无同型 blob 通道)、转 Markdown 弹窗
 *    (POST /api/files/:id/convert-markdown 存在但 web 弹窗为富交互)。
 *  - **不承载** AIWorkspaceTabs:该面板的数据全部是 `AI_MOCK` 静态样例
 *    (apps/web/app/(main)/workspace/[id]/helpers.ts:9-41 零后端),照搬到 RN 等于造假界面。
 * 平台无关:两个请求的并发/错误归并、时间与文件大小格式化、登录态全在薄壳。
 */
export function WorkspaceDetailScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  project,
  files,
  deletingId,
  onDelete,
  onRefresh,
  banner,
}: WorkspaceDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const { styles } = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <Text style={styles.title} numberOfLines={2}>
            {project?.name || t(`${NS}.title`)}
          </Text>
          <Text style={styles.muted} numberOfLines={2}>
            {project?.description || t(`${NS}.description`)}
          </Text>
          {project?.updatedAtText ? (
            <Text style={styles.muted}>{project.updatedAtText}</Text>
          ) : null}
        </View>
      </View>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          <View style={styles.sectionHead}>
            <FolderOpen size={16} color={tk.text.secondary} />
            <Text style={styles.sectionTitle}>{t(`${NS}.files`)}</Text>
            <Text style={styles.muted}>{`(${files.length})`}</Text>
          </View>

          {banner ? (
            <Text style={banner.tone === 'success' ? styles.bannerOk : styles.bannerErr}>
              {banner.text}
            </Text>
          ) : null}

          {files.length === 0 ? (
            <View style={styles.centerBlock}>
              <FileText size={30} color={tk.text.tertiary} />
              <Text style={styles.muted}>{t(`${NS}.emptyFiles`)}</Text>
            </View>
          ) : (
            <FlatList
              data={files}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <View style={styles.rowMain}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.muted} numberOfLines={1}>
                      {`${item.sizeText} · ${item.mimeType || '-'}`}
                    </Text>
                    <Text style={styles.muted}>{item.uploadedAtText}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.deleteBtn, deletingId === item.id && styles.btnDisabled]}
                    disabled={deletingId === item.id}
                    accessibilityLabel={t(`${NS}.deleteFile`)}
                    onPress={() => onDelete(item.id)}
                  >
                    <Trash2 size={16} color={tk.danger.DEFAULT} />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </>
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: rnSpacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1 },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    muted: { marginTop: 2, fontSize: rnType.caption.size, color: tk.text.secondary },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    error: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.lg,
    },
    sectionTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    bannerOk: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.success.deepText },
    bannerErr: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.danger.DEFAULT },
    list: { flex: 1, marginTop: rnSpacing.sm },
    listContent: { paddingBottom: rnSpacing['2xl'] },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginBottom: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    rowMain: { flex: 1 },
    fileName: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    deleteBtn: {
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    btnDisabled: { opacity: 0.5 },
  })

  return { styles }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
