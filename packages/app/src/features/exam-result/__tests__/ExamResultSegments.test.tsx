// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 成绩四格 / 题目回顾两段抽为共享段后的渲染回归:
// ① 四格逐项渲染;② 回顾条目字段渲染 + 错题计数行;
// ③ 阴性对照:摘 items[i] 后按该格查找必红、摘 myAnswer 后按答案字符串查找必红、
//    不给 wrongTitle 时错题计数行必不出现(web 详情列表形态)。
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ExamResultStats } from '../ExamResultStats'
import { ReviewList } from '../ReviewList'
import type { ExamResultStatItem, ExamReviewListProps } from '@ihui/types'

const stats: ExamResultStatItem[] = [
  { key: 'correct', label: '答对', value: '8 题', tone: 'correct' },
  { key: 'wrong', label: '答错', value: '2 题', tone: 'wrong' },
  { key: 'unanswered', label: '未答', value: '0 题', tone: 'muted' },
  { key: 'duration', label: '用时', value: '12 分钟', tone: 'neutral' },
]

const labels: ExamReviewListProps['labels'] = {
  correct: '正确',
  wrong: '错误',
  yourAnswer: '你的答案:',
  correctAnswer: '正确答案:',
  analysis: '解析:',
  score: (n) => `${n} 分`,
  questionIndex: (n) => `第 ${n} 题`,
}

const reviewProps: ExamReviewListProps = {
  title: '题目回顾',
  labels,
  wrongTitle: '错题',
  emptyText: '暂无题目回顾',
  items: [
    {
      id: 'q1',
      title: '第一题的题干',
      isCorrect: false,
      score: 0,
      myAnswer: '唯一错误答案B',
      correctAnswer: '唯一正确答案A',
      analysis: '唯一解析文本',
    },
    { id: 'q2', title: '第二题的题干', isCorrect: true, score: 5, myAnswer: '唯一答案C' },
  ],
}

afterEach(cleanup)

const testColorScheme: 'light' | 'dark' = 'light'

describe('ExamResultStats 共享段', () => {
  it('四格 label/value 全部渲染', () => {
    render(<ExamResultStats items={stats} colorScheme={testColorScheme} />)
    for (const it of stats) {
      expect(screen.getByText(it.label)).toBeTruthy()
      expect(screen.getByText(it.value)).toBeTruthy()
    }
  })

  it('阴性对照:摘掉 duration 格后按「用时」查找必须红', () => {
    render(
      <ExamResultStats
        items={stats.filter((it) => it.key !== 'duration')}
        colorScheme={testColorScheme}
      />,
    )
    expect(screen.queryByText('用时')).toBeNull()
    expect(() => screen.getByText('用时')).toThrow()
  })
})

describe('ReviewList 共享段', () => {
  it('标题/错题计数/题干/答案/解析/分值全部渲染', () => {
    render(<ReviewList {...reviewProps} colorScheme={testColorScheme} />)
    expect(screen.getByText('题目回顾')).toBeTruthy()
    expect(screen.getByText('错题')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('第一题的题干')).toBeTruthy()
    expect(screen.getByText(/唯一错误答案B/)).toBeTruthy()
    expect(screen.getByText(/唯一正确答案A/)).toBeTruthy()
    expect(screen.getByText(/唯一解析文本/)).toBeTruthy()
    expect(screen.getByText('第 1 题')).toBeTruthy()
    expect(screen.getByText('0 分')).toBeTruthy()
  })

  it('阴性对照:摘掉 myAnswer 后按该答案字符串查找必须红', () => {
    const first = { ...reviewProps.items[0] }
    delete (first as { myAnswer?: string }).myAnswer
    render(<ReviewList {...reviewProps} items={[first]} colorScheme={testColorScheme} />)
    expect(screen.queryByText(/唯一错误答案B/)).toBeNull()
    expect(() => screen.getByText(/唯一错误答案B/)).toThrow()
  })

  it('阴性对照:不给 wrongTitle 时错题计数行不得出现(web 形态)', () => {
    render(<ReviewList {...reviewProps} wrongTitle={undefined} colorScheme={testColorScheme} />)
    expect(screen.queryByText('错题')).toBeNull()
    expect(() => screen.getByText('错题')).toThrow()
  })
})
