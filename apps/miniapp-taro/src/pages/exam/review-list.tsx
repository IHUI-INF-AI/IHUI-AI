// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, Text } from '@tarojs/components'
import { EmptyState } from '@/components/ScreenStates.taro'

/** 题目回顾行(GET /exam/:id/review) */
export interface ReviewQuestion {
  id: string
  title: string
  type?: string
  myAnswer?: string
  correctAnswer?: string
  analysis?: string
  isCorrect: boolean
  score: number
}

/**
 * 题目回顾卡(对齐共享屏 ExamResultScreen:错题段 + 你的答案 / 正确答案 / 解析)。
 * 拆成同目录子模块只为守住单页 250 行;文案键与共享屏同源,不另造键。
 */
export function ReviewList({ reviews }: { reviews: ReviewQuestion[] }) {
  const tt = useTt()
  const wrongCount = reviews.filter((q) => !q.isCorrect).length

  return (
    <View className="exam-result-card">
      <Text className="exam-result-card-title">{tt('exam.result.reviewTitle', '题目回顾')}</Text>
      {reviews.length > 0 ? (
        <>
          {/* 错题计数行:与共享屏同判据(ExamResultScreen 的 `wrongQuestions.length > 0` 才出这一段),
              全对的卷子不再渲染出「错题 0」这种自相矛盾的文案 */}
          {wrongCount > 0 ? (
            <View className="exam-result-review-header">
              <Text className="exam-result-review-status wrong">
                {tt('examResult.wrongQuestions', '错题')}
              </Text>
              <Text className="exam-result-review-idx">{wrongCount}</Text>
            </View>
          ) : null}
          {reviews.map((q, idx) => (
            <View key={q.id || idx} className="exam-result-review-item">
              <View className="exam-result-review-header">
                <Text className="exam-result-review-idx">
                  {tt('exam.result.questionIdx', '第 {n} 题', { n: idx + 1 })}
                </Text>
                <Text className={`exam-result-review-status${q.isCorrect ? ' correct' : ' wrong'}`}>
                  {q.isCorrect
                    ? tt('exam.result.reviewCorrect', '正确')
                    : tt('exam.result.reviewWrong', '错误')}
                </Text>
                <Text className="exam-result-review-score">
                  {tt('exam.result.reviewScore', '{n} 分', { n: q.score })}
                </Text>
              </View>
              <Text className="exam-result-review-title">{q.title}</Text>
              {q.myAnswer ? (
                <View className="exam-result-review-row">
                  <Text className="exam-result-review-label">
                    {tt('examResult.yourAnswer', '你的答案')}:
                  </Text>
                  <Text
                    className={`exam-result-review-answer${q.isCorrect ? ' correct' : ' wrong'}`}
                  >
                    {q.myAnswer}
                  </Text>
                </View>
              ) : null}
              {q.correctAnswer ? (
                <View className="exam-result-review-row">
                  <Text className="exam-result-review-label">
                    {tt('examResult.correctAnswer', '正确答案')}:
                  </Text>
                  <Text className="exam-result-review-answer correct">{q.correctAnswer}</Text>
                </View>
              ) : null}
              {q.analysis ? (
                <View className="exam-result-review-analysis">
                  <Text className="exam-result-review-analysis-label">
                    {tt('exam.result.analysis', '解析')}
                  </Text>
                  <Text className="exam-result-review-analysis-text">{q.analysis}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </>
      ) : (
        <EmptyState title={tt('exam.result.noReview', '暂无题目回顾')} />
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
