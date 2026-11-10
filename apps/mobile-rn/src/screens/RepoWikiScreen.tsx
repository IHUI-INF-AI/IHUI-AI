// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Repo Wiki 文档浏览屏 —— 与 web `/repo-wiki` 共用同一份渲染
 * (`@ihui/rn-app/features/repo-wiki/RepoWikiScreen`)。
 *
 * 壳只保留 RN 数据层与平台件:
 * - AsyncStorage 回填/落盘仓库名(对齐 Web 端持久化口径);
 * - appAlert 二次确认;NavBar/NavChrome;日期格式。
 * - generateHint:生成能力依赖浏览器 File System Access API,RN 无等价能力,
 *   提示留在宿主机如实说明(不进共享屏,不造单端 prop)。
 *
 * 端点形态:listRepoWiki / getRepoWikiDoc / deleteRepoWikiDoc 失败时 throw,
 * 统一 try/catch 取 e.message。
 */
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { RepoWikiScreen as SharedRepoWikiScreen } from '@ihui/rn-app'
import type { RepoWikiDocView } from '@ihui/rn-app/features/repo-wiki/RepoWikiScreen'
import {
  deleteRepoWikiDoc,
  getRepoWikiDoc,
  listRepoWiki,
} from '@ihui/api-client/endpoints/repo-wiki'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import { tokens } from '../theme/active-tokens'

import { rnSpacing, rnType } from '@ihui/design-tokens'
const REPO_NAME_KEY = 'ihui:repo-wiki:repoName'

/** ISO 时间 → `YYYY-MM-DD HH:mm`(不依赖 Intl,Hermes 各版本表现一致) */
function formatStamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function toView(doc: RepoWikiDocView): RepoWikiDocView {
  return {
    id: doc.id,
    title: doc.title,
    kind: doc.kind === 'module' ? 'module' : 'overview',
    modulePath: doc.modulePath ?? null,
    model: doc.model ?? null,
    fileCount: doc.fileCount,
    generatedAt: doc.generatedAt,
  }
}

export function RepoWikiScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [repoName, setRepoName] = useState('')
  const [docs, setDocs] = useState<RepoWikiDocView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const saved = await AsyncStorage.getItem(REPO_NAME_KEY)
      if (saved) setRepoName(saved)
    })()
  }, [])

  const load = useCallback(async () => {
    const name = repoName.trim()
    if (!name) return
    setError(null)
    setLoading(true)
    try {
      const rows = await listRepoWiki(name)
      setDocs(rows.map(toView))
    } catch (e) {
      setDocs([])
      setError(e instanceof Error ? e.message : t('repoWiki.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [repoName, t])

  const handleLoad = useCallback(async () => {
    const name = repoName.trim()
    if (!name) return
    void AsyncStorage.setItem(REPO_NAME_KEY, name).catch(() => {})
    await load()
  }, [load, repoName])

  const handleLoadDoc = useCallback(async (id: string) => {
    const full = await getRepoWikiDoc(id)
    return full.content
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    await deleteRepoWikiDoc(id)
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const handleConfirm = useCallback(
    (options: { title: string; message: string; destructive?: boolean }) =>
      new Promise<boolean>((resolve) => {
        appAlert(options.title, options.message, [
          { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
          {
            text: t('common.confirm'),
            style: options.destructive ? 'destructive' : 'default',
            onPress: () => resolve(true),
          },
        ])
      }),
    [t],
  )

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('repoWiki.title')} />
      </NavChrome>
      <View style={styles.hintBox}>
        <Text style={styles.hint}>{t('repoWiki.generateHint')}</Text>
      </View>
      <SharedRepoWikiScreen
        t={t}
        colorScheme={resolvedTheme}
        repoName={repoName}
        onChangeRepoName={setRepoName}
        docs={docs}
        loading={loading}
        error={error}
        formatDate={formatStamp}
        onLoad={handleLoad}
        onLoadDoc={handleLoadDoc}
        onDelete={handleDelete}
        onConfirm={handleConfirm}
        renderDetail={(content) => <Text style={styles.detail}>{content}</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hintBox: { paddingHorizontal: rnSpacing.md, paddingTop: rnSpacing.xs },
  hint: { fontSize: rnType.label.size, color: tokens.text.tertiary },
  detail: { fontSize: 13, lineHeight: 20, color: tokens.text.primary },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
