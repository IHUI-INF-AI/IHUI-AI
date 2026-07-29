import { useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { CourseQAAskScreen as SharedCourseQAAskScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function CourseQAAskScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [question, setQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const submit = async () => {
    if (!question.trim()) {
      setError(t('courseQAAsk.placeholder'))
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess(false)
    try {
      const res = await fetchApi('/course-qa', {
        method: 'POST',
        body: JSON.stringify({ question }),
      })
      if (!res.success) throw new Error()
      setSuccess(true)
      setQuestion('')
    } catch {
      setError(t('courseQAAsk.submitting'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SharedCourseQAAskScreen
      t={t}
      question={question}
      submitting={submitting}
      error={error}
      success={success}
      onQuestionChange={setQuestion}
      onSubmit={submit}
      onBack={() => navigation.goBack()}
    />
  )
}
