// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chu
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { Keyboard, Platform, Share } from 'react-native'
import { File, Paths } from 'expo-file-system'
import { appAlert } from '../components/BottomPops'
import { exportCareerReport, getCareerAdvice, type CareerReportFormat } from '@ihui/api-client'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  AiCareerScreen as SharedAiCareerScreen,
  AI_CAREER_QUESTIONS,
  AI_CAREER_REQUIRED_FIELDS,
  type AiCareerFieldKey,
  type AiCareerFormData,
} from '@ihui/rn-app'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>

/** 空表单初始值(只读常量,state 更新均为不可变替换) */
const EMPTY_FORM: AiCareerFormData = {
  school: '',
  classLevel: '',
  scoreRange: '',
  languageDifficulty: '',
  scienceCharacteristics: '',
  learningObstacle: '',
  hobbies: '',
  personality: '',
  extraTime: '',
  pressureTolerance: '',
  learningGoal: '',
  personalityTest1: '',
  personalityTest2: '',
  personalityTest3: '',
  personalityTest4: '',
  personalityTest5: '',
}

export default function AiCareerScreen() {
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<Nav>()
  const { t } = useI18n()
  const { user } = useAuth()
  const [formData, setFormData] = useState<AiCareerFormData>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState('')
  const [format, setFormat] = useState<CareerReportFormat>('pdf')
  const [exporting, setExporting] = useState(false)
  const exportRef = useRef<() => Promise<void>>(async () => {})

  const handleSelectOption = useCallback((key: AiCareerFieldKey, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }, [])

  const handleInputChange = useCallback((key: AiCareerFieldKey, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }, [])

  const handleSubmit = useCallback(() => {
    Keyboard.dismiss()
    // 提交问卷并请求 AI 学业建议；成功后保留正文，供报告区展示与导出。
    const missing = AI_CAREER_REQUIRED_FIELDS.find((item) => !formData[item.field])
    if (missing) {
      const message = t('career.fillField', { name: missing.name })
      setError(message)
      appAlert(t('common.error'), message, [{ text: t('common.ok') }])
      return
    }
    setSubmitting(true)
    setError(null)
    setResult('')
    void (async () => {
      try {
        const res = await getCareerAdvice({
          school: formData.school,
          classLevel: formData.classLevel,
          scoreRange: formData.scoreRange,
          languageDifficulty: formData.languageDifficulty,
          scienceCharacteristics: formData.scienceCharacteristics,
          learningObstacle: formData.learningObstacle,
          hobbies: formData.hobbies,
          target: formData.learningGoal,
        })
        setSubmitting(false)
        if (!res.success) {
          const message = res.error || t('career.submitFail')
          setError(message)
          appAlert(t('common.error'), message, [{ text: t('common.ok') }])
          return
        }
        setResult(res.data.content)
        appAlert(t('career.doneTitle'), t('career.doneBody'), [{ text: t('common.ok') }])
      } catch (err) {
        setError(err instanceof Error ? err.message : t('career.submitFail'))
        appAlert(t('common.error'), err instanceof Error ? err.message : t('career.submitFail'), [
          { text: t('common.ok') },
        ])
      } finally {
        setSubmitting(false)
      }
    })()
  }, [formData, t])

  /**
   * 导出 AI 生涯报告：
   * - 无报告正文 → 提示先生成，按钮本身已禁用；
   * - 未登录/401 → 提示登录并给「登录」入口，不静默失败；
   * - 其余失败（含网络错误）→ 失败提示 + 重试按钮；
   * - 端点返回 Response 二进制（PDF/Word/PPT，见 apps/api 路由）→ 写缓存目录后分享。
   * 未安装 expo-sharing：iOS 走 RN 内置 Share.share({ url })；Android 明确降级提示文件路径。
   */
  const handleExport = useCallback(async (): Promise<void> => {
    if (!result) {
      appAlert(t('career.exportEmptyHint'))
      return
    }
    if (!user) {
      appAlert(t('career.exportLoginRequired'), undefined, [
        { text: t('common.login'), onPress: () => navigation.navigate('Login') },
        { text: t('common.cancel'), style: 'cancel' },
      ])
      return
    }
    const retry = (): void => void exportRef.current()
    setExporting(true)
    try {
      const resp = await exportCareerReport({
        school: formData.school,
        classLevel: formData.classLevel,
        scoreRange: formData.scoreRange,
        languageDifficulty: formData.languageDifficulty,
        scienceCharacteristics: formData.scienceCharacteristics,
        learningObstacle: formData.learningObstacle,
        hobbies: formData.hobbies,
        target: formData.learningGoal,
        format,
        content: result,
      })
      if (!resp.ok) {
        if (resp.status === 401) {
          appAlert(t('career.exportLoginRequired'), undefined, [
            { text: t('common.login'), onPress: () => navigation.navigate('Login') },
            { text: t('common.cancel'), style: 'cancel' },
          ])
        } else {
          appAlert(t('studentPage.exportError'), undefined, [
            { text: t('common.retry'), onPress: retry },
            { text: t('common.cancel'), style: 'cancel' },
          ])
        }
        return
      }
      const bytes = new Uint8Array(await resp.arrayBuffer())
      const ext = format === 'pdf' ? 'pdf' : format === 'word' ? 'doc' : 'pptx'
      const file = new File(Paths.cache, `ai-career-report-${Date.now()}.${ext}`)
      file.write(bytes)
      if (Platform.OS === 'ios') {
        const shared = await Share.share({ url: file.uri })
        if (shared.action !== Share.dismissedAction) {
          appAlert(t('studentPage.exportSuccess'))
        }
      } else {
        // Android 无 expo-sharing / RN Share 不支持 url → 明确降级：告知文件已保存路径
        appAlert(t('studentPage.exportSuccess'), file.uri)
      }
    } catch {
      appAlert(t('studentPage.exportError'), undefined, [
        { text: t('common.retry'), onPress: retry },
        { text: t('common.cancel'), style: 'cancel' },
      ])
    } finally {
      setExporting(false)
    }
  }, [formData, format, navigation, result, t, user])
  exportRef.current = handleExport

  const handleExportPress = useCallback(() => {
    void handleExport()
  }, [handleExport])

  return (
    <SharedAiCareerScreen
      t={t}
      questions={AI_CAREER_QUESTIONS}
      formData={formData}
      error={error}
      submitting={submitting}
      onSelectOption={handleSelectOption}
      onInputChange={handleInputChange}
      onSubmit={handleSubmit}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
      result={result}
      format={format}
      onFormatChange={setFormat}
      onExport={handleExportPress}
      exporting={exporting}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
