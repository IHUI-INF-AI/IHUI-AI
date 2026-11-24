// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { appAlert } from '../components/BottomPops'
import { File, Paths } from '@/platform/fs'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { exportMyReport, exportMyReportJson, getMyReport } from '@ihui/api-client'
import type { StudentReport } from '@ihui/api-client'
import { StudentCenterScreen as SharedStudentCenterScreen } from '@ihui/rn-app'
import type { StudentQuickLinkKey, StudentReportFormat } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * RN 端「学生中心(学习报告)」薄壳 —— 渲染全部委托共享屏
 * `packages/app/src/features/student/StudentCenterScreen.tsx`,本文件只管平台侧:
 * 取数(GET /api/edu/my-report)、报告导出(POST /api/edu/my-report/export,复用
 * endpoints/edu.ts 既有封装)、快捷入口路由落点与主题取词。
 *
 * 导出与 web 同契约:json 走 exportMyReportJson;pdf/excel 走 exportMyReport 拿原生
 * Response,arrayBuffer 写入 expo File(与 ChatScreen TTS 落盘同型),成功后提示本地路径。
 */
export function StudentCenterScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<StudentReport | null>(null)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(
    async (isActive: () => boolean = () => true) => {
      setLoading(true)
      setError(null)
      try {
        const res = await getMyReport()
        if (!isActive()) return
        if (!res.success || !res.data) {
          setError(t('studentPage.fetchFailed'))
          setData(null)
          return
        }
        setData(res.data)
      } catch (err) {
        if (!isActive()) return
        console.warn('[StudentCenterScreen] load failed', err)
        setError(t('studentPage.fetchFailed'))
        setData(null)
      } finally {
        if (isActive()) setLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    let alive = true
    void load(() => alive)
    return () => {
      alive = false
    }
  }, [load])

  const handleExport = useCallback(
    async (format: StudentReportFormat) => {
      setExporting(true)
      try {
        let file: File
        if (format === 'json') {
          const res = await exportMyReportJson({ format })
          if (!res.success) throw new Error('export failed')
          const json = JSON.stringify(res.data ?? null, null, 2)
          file = new File(Paths.cache, `my-report-${Date.now()}.json`)
          file.write(json)
          if (!file.exists || file.textSync() !== json) throw new Error('write failed')
        } else {
          const resp = await exportMyReport({ format })
          if (!resp.ok) throw new Error('export failed')
          const bytes = new Uint8Array(await resp.arrayBuffer())
          const ext = format === 'pdf' ? 'pdf' : 'xlsx'
          file = new File(Paths.cache, `my-report-${Date.now()}.${ext}`)
          file.write(bytes)
          if (!file.exists || file.bytesSync().length !== bytes.length)
            throw new Error('write failed')
        }
        appAlert(t('studentPage.exportSuccess'), file.uri)
      } catch (err) {
        console.warn('[StudentCenterScreen] export failed', err)
        appAlert(t('studentPage.exportError'))
      } finally {
        setExporting(false)
      }
    },
    [t],
  )

  const handleQuickLink = useCallback(
    (key: StudentQuickLinkKey) => {
      switch (key) {
        case 'myLessons':
          navigation.navigate('MyLessons')
          break
        case 'myNotes':
          navigation.navigate('NoteList')
          break
        case 'myCertificates':
          navigation.navigate('CertList')
          break
        case 'wrongBook':
          navigation.navigate('WrongQuestions')
          break
        case 'offlineRecords':
          navigation.navigate('OfflineRecords')
          break
        case 'myPapers':
          navigation.navigate('MyPapers')
          break
      }
    },
    [navigation],
  )

  return (
    <SharedStudentCenterScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loading={loading}
      error={error}
      data={data ?? undefined}
      onRefresh={() => void load()}
      onExport={(format) => void handleExport(format)}
      exporting={exporting}
      onQuickLink={handleQuickLink}
    />
  )
}

export default StudentCenterScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
