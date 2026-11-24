// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { useTheme } from '@/hooks/use-theme'

import { ExamIntroScreen } from '@ihui/rn-app/features/exam-intro/ExamIntroScreen'

import type { PaperDetail } from './types'

interface Props {
  paper: PaperDetail
  isPending: boolean
  isError: boolean
  error: unknown
  onStart: () => void
}

/**
 * web 端「试卷介绍」适配器:真渲染共享屏 ExamIntroScreen(web + 小程序,不含 RN)。
 * 仅做取词/取数与 3 项统计映射;不向 web 新增参与/规则/历史段。
 */
export function ExamIntro({ paper, isPending, isError, error, onStart }: Props) {
  const t = useTranslations('exam')
  const router = useRouter()
  const { resolvedTheme } = useTheme()

  return (
    <ExamIntroScreen
      headerTitle={t('title')}
      title={paper.title}
      stats={[
        { label: t('questionCountLabel'), value: String(paper.questions.length) },
        { label: t('totalScore', { score: paper.totalScore }), value: String(paper.totalScore) },
        { label: t('duration', { minutes: paper.duration }), value: `${paper.duration}m` },
      ]}
      state="ready"
      loadingText={t('loading')}
      errorText={isError ? ((error as Error)?.message ?? '') : ''}
      retryText={t('back')}
      startText={t('startExam')}
      startingText={t('startExam')}
      starting={isPending}
      onStart={onStart}
      onRetry={onStart}
      onBack={() => router.push('/exam')}
      colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
    />
  )
}
