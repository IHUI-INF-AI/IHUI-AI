// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D135 补齐(2026-11-14)RN AI 提问卡交互腿 —— 判定层走 @ihui/shared/chat/question-response
// (web 同一份,已由该模块单测覆盖);本套件只钉 RN 侧编排:
//   1. 单选防重:双击只发一次阻塞式请求
//   2. 阻塞式 accepted → 终态(answered),不新增用户消息、不发起新一轮
//   3. 404 → legacy 回退 sendLegacyAnswer(不新增用户消息,把答复交宿主续流)
//   4. 撤回:阻塞式走 withdraw;legacy 只摘卡不产用户消息
//   5. 多选按勾选收集全部 optionId;自由输入并入 customText
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const postJson = vi.fn()
vi.mock('@ihui/api-client', () => ({
  fetchAiServiceJson: (...args: unknown[]) => postJson(...args),
}))

// 用 vi.mock 替身 useI18n(与 workbuddy-task-section 样板同法),避免依赖 AsyncStorage 异步初始化。
// t 直返词包 zh-CN 值 —— 用例断言的就是这些值,值漂开会由断言失败暴露(正是想要的锁)。
vi.mock('../../../i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string>) => {
      const pack: Record<string, string> = {
        'ai.pane.question.title': 'AI 提问',
        'ai.pane.question.withdraw': '跳过',
        'ai.pane.question.submit': '提交',
        'ai.pane.question.submitting': '提交中…',
        'ai.pane.question.statusAnswered': '已回答',
        'ai.pane.question.statusWithdrawn': '已跳过',
        'ai.pane.question.statusTimeout': '已超时',
        'ai.pane.question.customPlaceholder': '或自行输入…',
        'ai.pane.question.responseFailed': '提交失败，请重试',
      }
      const base = pack[key] ?? key
      if (!vars) return base
      return base.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m)
    },
    locale: 'zh-CN',
    setLocale: async () => {},
  }),
}))

import { useQuestionQueue } from '../QuestionSheet'

/** 把 useQuestionQueue 的 host 暴露成可渲染组件(RN 屏内由 ChatScreen 渲染 host)。
 *  onQuestion 是 streamChat 的事件回调(不在 render body 调),故 harness 用 useEffect 模拟
 *  "帧到达" —— 直接在 render body 调 setState 会触发 React 无限渲染保护。 */
function Harness({
  sendLegacyAnswer,
  frame,
}: {
  sendLegacyAnswer: (answer: string) => Promise<void>
  frame: Parameters<ReturnType<typeof useQuestionQueue>['onQuestion']>[0]
}) {
  const queue = useQuestionQueue({ sendLegacyAnswer })
  useEffect(() => {
    queue.onQuestion(frame)
  }, [frame, queue.onQuestion])
  return <>{queue.host}</>
}

const singleFrame = {
  questionId: 'q-1',
  prompt: '选一个继续',
  options: [
    { id: 'a', label: '选项 A' },
    { id: 'b', label: '选项 B' },
  ],
  allowCustom: false,
  allowMultiple: false,
}

// 走阻塞式答复的用例(accepted→answered / 404→legacy 回退 / withdraw / 多选)必须带 sessionId:
// 实现契约是「无 sessionId = 阻塞式不可用,如实走旧链路」,无 sessionId 的帧永远到不了阻塞式
// 终态。无 sessionId 那条腿由下方「无 sessionId 的帧」用例单测(它才该用无 sessionId 的 singleFrame)。
const blockingFrame = {
  ...singleFrame,
  sessionId: 'sess-1',
}

const localeText = {
  submit: '提交',
  withdraw: '跳过',
  answered: '已回答',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useQuestionQueue / 单选与防重', () => {
  it('单选提交只发一次:双击第二发被吞,accepted 后进已回答只读态', async () => {
    postJson.mockResolvedValue({
      success: true,
      status: 200,
      data: { accepted: true, status: 'answered', duplicate: false },
    })
    render(<Harness sendLegacyAnswer={vi.fn()} frame={blockingFrame} />)

    // 选 B 再提交
    fireEvent.click(screen.getByText('选项 B'))
    const submit = screen.getByText(localeText.submit)
    await waitFor(() => fireEvent.click(submit))

    await waitFor(() => expect(screen.getByText(localeText.answered)).toBeTruthy())
    // 双击第二发被吞:只有一次 POST
    expect(postJson).toHaveBeenCalledTimes(1)
    // legacy 回退未触发(阻塞式认下)
    expect(postJson).toHaveBeenCalledTimes(1)
    const [path, init] = postJson.mock.calls[0] as unknown as [string, { body: string }]
    expect(path).toContain('/question-response')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ questionId: 'q-1', action: 'answer', selectedOptionIds: ['b'] })
  })
})

describe('useQuestionQueue / 阻塞式 vs legacy 回退', () => {
  it('404 → legacy:把答复文本交 sendLegacyAnswer,不新增用户消息、不发 POST 第二次', async () => {
    postJson.mockResolvedValue({ success: false, status: 404, error: 'not found' })
    const sendLegacyAnswer = vi.fn().mockResolvedValue(undefined)
    render(<Harness sendLegacyAnswer={sendLegacyAnswer} frame={blockingFrame} />)

    fireEvent.click(screen.getByText('选项 A'))
    await waitFor(() => fireEvent.click(screen.getByText(localeText.submit)))

    await waitFor(() => expect(sendLegacyAnswer).toHaveBeenCalledTimes(1))
    expect(sendLegacyAnswer).toHaveBeenCalledWith('选项 A')
    // 卡片已随 legacy 摘除(不再显示 prompt)
    await waitFor(() => expect(screen.queryByText('选一个继续')).toBeNull())
  })

  it('撤回:阻塞式走 withdraw(空 selectedOptionIds),置已跳过', async () => {
    postJson.mockResolvedValue({
      success: true,
      status: 200,
      data: { accepted: true, status: 'withdrawn' },
    })
    render(<Harness sendLegacyAnswer={vi.fn()} frame={blockingFrame} />)

    await waitFor(() => fireEvent.click(screen.getByText(localeText.withdraw)))

    await waitFor(() => expect(screen.getByText('已跳过')).toBeTruthy())
    const [, init] = postJson.mock.calls[0] as unknown as [string, { body: string }]
    expect(JSON.parse(init.body)).toMatchObject({
      questionId: 'q-1',
      action: 'withdraw',
      selectedOptionIds: [],
    })
  })

  it('无 sessionId 的帧 → 直接 legacy,不发任何 POST', async () => {
    const sendLegacyAnswer = vi.fn().mockResolvedValue(undefined)
    // 帧不带 sessionId(singleFrame 默认无),走旧链路
    render(<Harness sendLegacyAnswer={sendLegacyAnswer} frame={singleFrame} />)

    fireEvent.click(screen.getByText('选项 A'))
    await waitFor(() => fireEvent.click(screen.getByText(localeText.submit)))

    await waitFor(() => expect(sendLegacyAnswer).toHaveBeenCalledTimes(1))
    expect(postJson).not.toHaveBeenCalled()
  })
})

describe('useQuestionQueue / 多选与自由输入', () => {
  it('多选按勾选收集全部 optionId,自由输入并入 customText', async () => {
    postJson.mockResolvedValue({
      success: true,
      status: 200,
      data: { accepted: true, status: 'answered', duplicate: false },
    })
    const multiFrame = {
      questionId: 'q-2',
      prompt: '可多选',
      options: [
        { id: 'x', label: 'X' },
        { id: 'y', label: 'Y' },
      ],
      allowCustom: true,
      allowMultiple: true,
      sessionId: 'sess-1',
    }
    render(<Harness sendLegacyAnswer={vi.fn()} frame={multiFrame} />)

    fireEvent.click(screen.getByText('X'))
    fireEvent.click(screen.getByText('Y'))
    const input = document.querySelector('textarea') as HTMLTextAreaElement | null
    if (input) {
      fireEvent.change(input, { target: { value: ' 补充说明 ' } })
    }
    await waitFor(() => fireEvent.click(screen.getByText(localeText.submit)))

    await waitFor(() => expect(screen.getByText(localeText.answered)).toBeTruthy())
    const [, init] = postJson.mock.calls[0] as unknown as [string, { body: string }]
    const body = JSON.parse(init.body)
    expect(body.selectedOptionIds).toEqual(['x', 'y'])
    if (input) expect(body.customText).toBe('补充说明')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
