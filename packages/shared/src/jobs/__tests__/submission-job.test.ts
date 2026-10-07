// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'

import {
  dismissSubmissionJob,
  getSubmissionJob,
  registerSubmissionJob,
  subscribeSubmissionJobs,
} from '../submission-job'

/**
 * G-815964 判据,四组各一例 + 正反成对:
 *  - 注册/取/丢:快照在注册瞬间冻结(注册后再改原表单,快照还原样);jobId 全局唯一。
 *  - paused-log 拒绝丢弃(正):守卫有牙 —— 该态 dismiss 必须 false 且作业仍在,
 *    能按原 jobId 取回快照重开草稿;补完日志走完后作业仍能正常终态并删除。
 *  - success/error 可丢(反):终态必须真能删,否则注册表只进不出,成了泄漏。
 *  - subscribe 通知:句柄级与全局级两条监听面都要真的响,退订后真的哑。
 */

describe('注册 / 取 / 丢', () => {
  it('注册后按 jobId 取回 running 快照;注册后再改原表单,快照分毫不动', () => {
    const form = { title: '导出失败', images: ['a.png'] }
    const handle = registerSubmissionJob({ jobId: 'fb-1', form })

    expect(handle.jobId).toBe('fb-1')
    expect(getSubmissionJob('fb-1')).toEqual({
      jobId: 'fb-1',
      status: 'running',
      form: { title: '导出失败', images: ['a.png'] },
    })

    // 冻结的意义:提交瞬间的那份快照属于用户,不属于此刻的引用
    form.title = '改过的标题'
    form.images.push('b.png')
    const snapshot = getSubmissionJob('fb-1')
    expect(snapshot?.form).toEqual({ title: '导出失败', images: ['a.png'] })
    expect(Object.isFrozen(snapshot?.form)).toBe(true)

    // 不存在的 jobId ⇒ null("没有"不冒充任何状态)
    expect(getSubmissionJob('nope')).toBeNull()
    // jobId 全局唯一:复用 id 会孤儿化旧订阅者,拒绝静默覆盖
    expect(() => registerSubmissionJob({ jobId: 'fb-1', form: { title: 'x' } })).toThrowError(/fb-1/)
  })

  it('running 态 dismiss ⇒ 真删除;再丢同一个 id ⇒ false(不是二次成功)', () => {
    registerSubmissionJob({ jobId: 'fb-2', form: { title: 't' } })
    expect(dismissSubmissionJob('fb-2')).toBe(true)
    expect(getSubmissionJob('fb-2')).toBeNull()
    expect(dismissSubmissionJob('fb-2')).toBe(false)
    expect(dismissSubmissionJob('从未注册过')).toBe(false)
  })
})

describe('paused-log 拒绝丢弃(正反成对①:等待补日志的作业删不得)', () => {
  it('paused-log dismiss ⇒ false,作业仍在注册表、快照可按原 jobId 取回;补完后照常终态删除', () => {
    const handle = registerSubmissionJob({ jobId: 'fb-3', form: { title: '日志样本', content: '正文' } })
    handle.pauseLog()
    expect(getSubmissionJob('fb-3')?.status).toBe('paused-log')

    // 守卫有牙:模拟"关闭对话框"顺手清理 —— 必须删不动
    expect(dismissSubmissionJob('fb-3')).toBe(false)
    // 队列仍在:按原 jobId 能取回冻结的表单快照,草稿重开的原料一份不少
    expect(getSubmissionJob('fb-3')?.form).toEqual({ title: '日志样本', content: '正文' })

    // 用户补完日志 → 提交继续 → 终态;此后 dismiss 必须真删(守卫不护终态)
    handle.resume()
    expect(getSubmissionJob('fb-3')?.status).toBe('running')
    handle.succeed('fb-20261007-0001')
    expect(dismissSubmissionJob('fb-3')).toBe(true)
    expect(getSubmissionJob('fb-3')).toBeNull()
  })
})

describe('终态可丢(正反成对②:终态删不掉就是只进不出的泄漏)', () => {
  it('success 与 error 都 dismiss ⇒ true 且 get 变 null;error 快照带原因', () => {
    const ok = registerSubmissionJob({ jobId: 'fb-4', form: { title: '成了' } })
    ok.succeed()
    expect(getSubmissionJob('fb-4')?.status).toBe('success')
    expect('result' in (getSubmissionJob('fb-4') ?? {})).toBe(false)
    expect(dismissSubmissionJob('fb-4')).toBe(true)
    expect(getSubmissionJob('fb-4')).toBeNull()

    const bad = registerSubmissionJob({ jobId: 'fb-5', form: { title: '砸了' } })
    bad.fail('HTTP 500:上传服务不可用')
    const errorSnapshot = getSubmissionJob('fb-5')
    expect(errorSnapshot?.status).toBe('error')
    expect(errorSnapshot?.error).toBe('HTTP 500:上传服务不可用')
    expect(dismissSubmissionJob('fb-5')).toBe(true)
    expect(getSubmissionJob('fb-5')).toBeNull()
  })
})

describe('subscribe 通知', () => {
  it('句柄级监听随状态迁移收到通知并拿到新态;全局监听覆盖注册/迁移/丢弃,退订后不再响', () => {
    const jobListener = vi.fn()
    const globalListener = vi.fn()
    const unsubscribeGlobal = subscribeSubmissionJobs(globalListener)

    const handle = registerSubmissionJob({ jobId: 'fb-6', form: { title: 'n' } })
    expect(globalListener).toHaveBeenCalledTimes(1) // 注册也通知

    const unsubscribeJob = handle.subscribe(jobListener)

    handle.pauseLog()
    expect(jobListener).toHaveBeenCalledTimes(1)
    expect(handle.getState()?.status).toBe('paused-log')
    expect(globalListener).toHaveBeenCalledTimes(2)

    unsubscribeJob()
    unsubscribeGlobal()
    handle.fail('中断')
    expect(jobListener).toHaveBeenCalledTimes(1) // 退订后真哑
    expect(globalListener).toHaveBeenCalledTimes(2)

    // 丢弃也要让全局面知道(还挂着的 UI 该把这一行摘掉)
    const lateListener = vi.fn()
    const unsubscribeLate = subscribeSubmissionJobs(lateListener)
    expect(dismissSubmissionJob('fb-6')).toBe(true)
    expect(lateListener).toHaveBeenCalledTimes(1)
    unsubscribeLate()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
