import { useCallback, useState } from 'react'
import { Alert, Keyboard } from 'react-native'
import { getCareerAdvice } from '@ihui/api-client'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  AiCareerScreen as SharedAiCareerScreen,
  AI_CAREER_QUESTIONS,
  AI_CAREER_REQUIRED_FIELDS,
  type AiCareerFieldKey,
  type AiCareerFormData,
} from '@ihui/rn-app'
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
  const navigation = useNavigation<Nav>()
  const { t } = useI18n()
  const [formData, setFormData] = useState<AiCareerFormData>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
    // 提交问卷并请求 AI 学业建议；结果当前通过成功提示反馈。
    const missing = AI_CAREER_REQUIRED_FIELDS.find((item) => !formData[item.field])
    if (missing) {
      const message = `请填写：${missing.name}`
      setError(message)
      Alert.alert(t('common.error'), message, [{ text: t('common.ok') }])
      return
    }
    setSubmitting(true)
    setError(null)
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
          const message = res.error || '提交失败，请稍后重试'
          setError(message)
          Alert.alert(t('common.error'), message, [{ text: t('common.ok') }])
          return
        }
        Alert.alert('提交成功', '问卷已提交，AI 学业建议生成后可在本页查看。', [
          { text: t('common.ok'), onPress: () => navigation.goBack() },
        ])
      } catch (err) {
        setError(err instanceof Error ? err.message : '提交失败，请稍后重试')
        Alert.alert(
          t('common.error'),
          err instanceof Error ? err.message : '提交失败，请稍后重试',
          [{ text: t('common.ok') }],
        )
      } finally {
        setSubmitting(false)
      }
    })()
  }, [formData, navigation, t])

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
    />
  )
}
