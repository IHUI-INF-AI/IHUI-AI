// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  AGENT_STATUS_LITERALS,
  BACKGROUND_TASK_STATES,
  FEEDBACK_SURVEY_STATE,
  HEATMAP_BUCKETS,
  HEATMAP_VIEW_MODES,
  IMAGE_ZOOM_STEPS,
  SURVEY_ANSWERS,
  SURVEY_SCALES,
  backgroundTaskView,
  dayDetailView,
  elementPackKey,
  feedbackSurveyPayload,
  fromAgentStatus,
  heatmapBucket,
  heatmapBucketTone,
  heatmapLegendKey,
  imageCounterView,
  imageTransferView,
  isBackgroundTaskState,
  isSurveyAnswer,
  isSurveyScale,
  pageImage,
  scaleLabelKey,
  shouldShowSurvey,
  surveyAnswerKey,
  thinkingTitleView,
  zoomStep,
} from '../element-pack'

// ---------------------------------------------------------------------------
// ③ 思考卡双态标题
// ---------------------------------------------------------------------------

describe('D64 ③ thinkingTitleView 双态', () => {
  it('有思考 → thinking 键(现状单态,不回退)', () => {
    const view = thinkingTitleView(true, 3)
    expect(view).not.toBeNull()
    expect(view?.variant).toBe('thinking')
    expect(view?.titleKey).toBe('thinkingTitle')
    expect(view?.values).toBeUndefined()
  })

  it('无思考有引用 → 「使用了 {count} 个引用」同族键,带插值', () => {
    const view = thinkingTitleView(false, 3)
    expect(view?.variant).toBe('refs')
    expect(view?.titleKey).toBe('thinkingRefsTitle')
    expect(view?.values).toEqual({ count: 3 })
  })

  it('两者皆无 → null(调用方不渲染);负数/非有限引用数同样 null', () => {
    expect(thinkingTitleView(false)).toBeNull()
    expect(thinkingTitleView(false, 0)).toBeNull()
    expect(thinkingTitleView(false, -2)).toBeNull()
    expect(thinkingTitleView(false, Number.NaN)).toBeNull()
    expect(thinkingTitleView(false, Number.POSITIVE_INFINITY)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// ④ 后台子任务八态 + 停止失败
// ---------------------------------------------------------------------------

describe('D64 ④ backgroundTaskView 八态穷尽', () => {
  it('八态逐个派发,titleKey 与 state 一一对应(穷尽,零 default 由编译期锁死)', () => {
    expect(BACKGROUND_TASK_STATES).toHaveLength(8)
    for (const state of BACKGROUND_TASK_STATES) {
      const view = backgroundTaskView(state)
      expect(view.titleKey, state).toBe(`state.${state}`)
      expect(view.state).toBe(state)
    }
  })

  it('stopFailed 必须显式渲染:danger + 显式 hint + 重试停止入口(不得静默吞)', () => {
    const view = backgroundTaskView('stopFailed')
    expect(view.tone).toBe('danger')
    expect(view.hintKey).toBe('hint.stopFailed')
    expect(view.action).toBe('retryStop')
    expect(view.busy).toBe(true)
    expect(view.terminal).toBe(false)
  })

  it('各态动作分布:pending/running 可停;stopping 无动作;failed/timeout 可重试;终态 cancelled/completed 无动作', () => {
    expect(backgroundTaskView('pending').action).toBe('stop')
    expect(backgroundTaskView('running').action).toBe('stop')
    expect(backgroundTaskView('stopping').action).toBe('none')
    expect(backgroundTaskView('completed').action).toBe('none')
    expect(backgroundTaskView('failed').action).toBe('retry')
    expect(backgroundTaskView('cancelled').action).toBe('none')
    expect(backgroundTaskView('timeout').action).toBe('retry')
  })

  it('busy / terminal 判据:四个进行态 busy=true;四个终态 terminal=true', () => {
    for (const state of BACKGROUND_TASK_STATES) {
      const view = backgroundTaskView(state)
      const isBusy = ['pending', 'running', 'stopping', 'stopFailed'].includes(state)
      expect(view.busy, state).toBe(isBusy)
      expect(view.terminal, state).toBe(!isBusy)
    }
  })

  it('AgentStatus 十态全部可归并(穷尽),运行细分阶段归并 running', () => {
    expect(AGENT_STATUS_LITERALS).toHaveLength(10)
    expect(fromAgentStatus('idle')).toBe('pending')
    expect(fromAgentStatus('pending')).toBe('pending')
    for (const s of ['thinking', 'acting', 'reflecting', 'waiting', 'running'] as const) {
      expect(fromAgentStatus(s), s).toBe('running')
    }
    expect(fromAgentStatus('completed')).toBe('completed')
    expect(fromAgentStatus('failed')).toBe('failed')
    expect(fromAgentStatus('cancelled')).toBe('cancelled')
  })

  it('isBackgroundTaskState 类型守卫', () => {
    expect(isBackgroundTaskState('stopFailed')).toBe(true)
    expect(isBackgroundTaskState('nope')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ⑤ 反馈问卷化
// ---------------------------------------------------------------------------

describe('D64 ⑤ 反馈问卷判据', () => {
  it('正例:没答过 ∧ 没问过 ∧ 非失败轮次 → true', () => {
    expect(
      shouldShowSurvey({ alreadyAnswered: false, alreadyAskedInSession: false, turnFailed: false }),
    ).toBe(true)
  })

  it('反例:已答过 / 已问过 / 失败轮次 → 均 false(每会话至多一次,失败不弹)', () => {
    const base = { alreadyAskedInSession: false, turnFailed: false, alreadyAnswered: false }
    expect(shouldShowSurvey({ ...base, alreadyAnswered: true })).toBe(false)
    expect(shouldShowSurvey({ ...base, alreadyAskedInSession: true })).toBe(false)
    expect(shouldShowSurvey({ ...base, turnFailed: true })).toBe(false)
    expect(
      shouldShowSurvey({
        ...base,
        alreadyAnswered: true,
        alreadyAskedInSession: true,
        turnFailed: true,
      }),
    ).toBe(false)
  })

  it('scaleLabelKey 五档穷尽;越界由 isSurveyScale 拦截', () => {
    for (const n of SURVEY_SCALES) {
      expect(scaleLabelKey(n), n).toBe(`feedbackSurvey.scale.${n}`)
    }
    expect(isSurveyScale(0)).toBe(false)
    expect(isSurveyScale(6)).toBe(false)
    expect(isSurveyScale(3.5)).toBe(false)
    expect(isSurveyScale(5)).toBe(true)
  })

  it('三段结构描述表:question / 5 档 scale / comment / 动作键全齐', () => {
    expect(FEEDBACK_SURVEY_STATE.questionKey).toBe('feedbackSurvey.question')
    expect(FEEDBACK_SURVEY_STATE.scaleKeys).toHaveLength(5)
    expect(FEEDBACK_SURVEY_STATE.scaleKeys[0]).toBe('feedbackSurvey.scale.1')
    expect(FEEDBACK_SURVEY_STATE.commentKey).toBe('feedbackSurvey.commentPlaceholder')
    expect(FEEDBACK_SURVEY_STATE.submitKey).toBe('feedbackSurvey.submit')
    expect(FEEDBACK_SURVEY_STATE.dismissKey).toBe('feedbackSurvey.dismiss')
    expect(FEEDBACK_SURVEY_STATE.submittedKey).toBe('feedbackSurvey.submitted')
  })
})

// ---------------------------------------------------------------------------
// ① Credits 热力图
// ---------------------------------------------------------------------------

describe('D64 ① heatmapBucket 桶级四档', () => {
  it('0 / 负数 / 非有限 → zero', () => {
    expect(heatmapBucket(0)).toBe('zero')
    expect(heatmapBucket(-1)).toBe('zero')
    expect(heatmapBucket(Number.NaN)).toBe('zero')
    expect(heatmapBucket(Number.POSITIVE_INFINITY)).toBe('zero')
  })

  it('缺省阈值:low=(0,5) mid=[5,20) high=≥20', () => {
    expect(heatmapBucket(1)).toBe('low')
    expect(heatmapBucket(4)).toBe('low')
    expect(heatmapBucket(5)).toBe('mid')
    expect(heatmapBucket(19)).toBe('mid')
    expect(heatmapBucket(20)).toBe('high')
    expect(heatmapBucket(1000)).toBe('high')
  })

  it('阈值可配;非法阈值回落缺省(坏配置不炸渲染)', () => {
    expect(heatmapBucket(1, { mid: 3, high: 4 })).toBe('low')
    expect(heatmapBucket(3, { mid: 3, high: 4 })).toBe('mid')
    expect(heatmapBucket(4, { mid: 3, high: 4 })).toBe('high')
    // 非法(mid≤0 / mid≥high / 非有限)→ 回落缺省 {mid:5,high:20},count=2 落 low
    expect(heatmapBucket(2, { mid: 0, high: 4 })).toBe('low')
    expect(heatmapBucket(2, { mid: 4, high: 4 })).toBe('low')
    expect(heatmapBucket(2, { mid: Number.NaN, high: 4 })).toBe('low')
  })

  it('桶 → tone 穷尽四档;图例键一一对应', () => {
    expect(HEATMAP_BUCKETS).toHaveLength(4)
    expect(heatmapBucketTone('zero')).toBe('neutral')
    expect(heatmapBucketTone('low')).toBe('info')
    expect(heatmapBucketTone('mid')).toBe('warning')
    expect(heatmapBucketTone('high')).toBe('danger')
    for (const b of HEATMAP_BUCKETS) expect(heatmapLegendKey(b)).toBe(`legend.${b}`)
  })

  it('dayDetailView 单日下钻:dateKey 空 → null;正常给桶 + tone + 插值', () => {
    expect(dayDetailView('', 3)).toBeNull()
    const detail = dayDetailView('2026-09-24', 3)
    expect(detail?.dateKey).toBe('2026-09-24')
    expect(detail?.bucket).toBe('low')
    expect(detail?.tone).toBe('info')
    expect(detail?.titleKey).toBe('dayTitle')
    expect(detail?.values).toEqual({ date: '2026-09-24' })
    expect(dayDetailView('2026-09-24', 99)?.bucket).toBe('high')
  })
})

// ---------------------------------------------------------------------------
// ② 图片预览翻页 / 缩放
// ---------------------------------------------------------------------------

describe('D64 ② pageImage 翻页与 zoomStep 缩放', () => {
  it('total 非法 → null(无图可翻)', () => {
    expect(pageImage(0, 0)).toBeNull()
    expect(pageImage(0, -3)).toBeNull()
    expect(pageImage(0, Number.NaN)).toBeNull()
  })

  it('越界钳制:index<0 → 0;index>last → last', () => {
    expect(pageImage(-1, 5)).toBe(0)
    expect(pageImage(99, 5)).toBe(4)
    expect(pageImage(2, 5)).toBe(2)
  })

  it('wrap 循环:末张回首张,首张上步回末张', () => {
    expect(pageImage(5, 5, { wrap: true })).toBe(0)
    expect(pageImage(-1, 5, { wrap: true })).toBe(4)
    expect(pageImage(7, 5, { wrap: true })).toBe(2)
  })

  it('imageCounterView 计数为 1 基;非法 → null', () => {
    expect(imageCounterView(0, 5)?.values).toEqual({ index: 1, total: 5 })
    expect(imageCounterView(4, 5)?.values).toEqual({ index: 5, total: 5 })
    expect(imageCounterView(0, 0)).toBeNull()
    expect(imageCounterView(0, 5)?.labelKey).toBe('imagePreview.counter')
  })

  it('zoomStep 档位穷尽进退;端点钳制不循环', () => {
    expect(IMAGE_ZOOM_STEPS.length).toBeGreaterThan(1)
    expect(IMAGE_ZOOM_STEPS).toEqual([...IMAGE_ZOOM_STEPS].sort((a, b) => a - b))
    expect(zoomStep(1, 'in')).toBe(1.25)
    expect(zoomStep(1, 'out')).toBe(0.75)
    expect(zoomStep(2, 'in')).toBe(2)
    expect(zoomStep(0.5, 'out')).toBe(0.5)
    expect(zoomStep(1.1, 'in')).toBe(1.25)
    expect(zoomStep(1.1, 'out')).toBe(1)
    expect(zoomStep(Number.NaN, 'in')).toBe(0.5)
    expect(zoomStep(Number.NaN, 'out')).toBe(2)
  })

  it('保存 / 复制成败键穷尽(kind × result 四组合)', () => {
    expect(imageTransferView('save', 'success')).toBe('imagePreview.saveSuccess')
    expect(imageTransferView('save', 'failed')).toBe('imagePreview.saveFailed')
    expect(imageTransferView('copy', 'success')).toBe('imagePreview.copySuccess')
    expect(imageTransferView('copy', 'failed')).toBe('imagePreview.copyFailed')
  })
})

// ---------------------------------------------------------------------------
// 键名生成器
// ---------------------------------------------------------------------------

describe('D64 键名生成器', () => {
  it('elementPackKey 统一前缀', () => {
    expect(elementPackKey('heatmap.title')).toBe('ai.pane.elementPack.heatmap.title')
    expect(elementPackKey('feedbackSurvey.question')).toBe(
      'ai.pane.elementPack.feedbackSurvey.question',
    )
  })
})

// ---------------------------------------------------------------------------
// ⑤ 三选答复 + 落库载荷(问卷卡渲染的正是这一组,端内不得另列选项集)
// ---------------------------------------------------------------------------

describe('D64 ⑤ 三选答复与落库载荷', () => {
  it('三选穷尽:answer → 键一一对应;守卫拒未知值', () => {
    expect(SURVEY_ANSWERS).toEqual(['solved', 'partial', 'notSolved'])
    expect(surveyAnswerKey('solved')).toBe('feedbackSurvey.answer.solved')
    expect(surveyAnswerKey('partial')).toBe('feedbackSurvey.answer.partial')
    expect(surveyAnswerKey('notSolved')).toBe('feedbackSurvey.answer.notSolved')
    expect(isSurveyAnswer('solved')).toBe(true)
    expect(isSurveyAnswer('like')).toBe(false)
  })

  it('载荷判定:messageId 空 → null;skip 强制 answer=null;空白评论归 null', () => {
    expect(feedbackSurveyPayload({ messageId: '  ', answer: 'solved' })).toBeNull()
    const skip = feedbackSurveyPayload({ messageId: 'm1', answer: 'solved', skipped: true })
    expect(skip).toEqual({ messageId: 'm1', answer: null, comment: null, skipped: true })
    const answered = feedbackSurveyPayload({ messageId: ' m2 ', answer: 'partial', comment: '   ' })
    expect(answered?.comment).toBeNull()
    expect(answered?.messageId).toBe('m2')
    expect(
      feedbackSurveyPayload({ messageId: 'm3', answer: 'notSolved', comment: '没给文件路径' })
        ?.comment,
    ).toBe('没给文件路径')
  })
})

// ---------------------------------------------------------------------------
// ① 视图模式集(热力图卡切档只认这个联合)
// ---------------------------------------------------------------------------

describe('D64 ① HEATMAP_VIEW_MODES', () => {
  it('两档定档:热力 / 会话明细,无第三态(卡上的 tab 只由此生成)', () => {
    expect(HEATMAP_VIEW_MODES).toEqual(['sessions', 'heatmap'])
    expect(new Set(HEATMAP_VIEW_MODES).size).toBe(HEATMAP_VIEW_MODES.length)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
