// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对标 Qoder 借鉴清单第 9/10 项的**接线**钉(不是纯逻辑钉 —— 纯逻辑住在 shared 与本仓 lib 的测试里)。
//
// 本文件钉的是"真被消费",因为本仓最高频失效型是"造好没装车":
// ① send-answer 的 ctx 缺 `streamErrorLabels` 时**逐字节等价于接线前**(既有 7 处 makeCtx 不受影响);
// ② 注入后:命名码走分类处置(标题换成该码词条、按钮按可重试性给或不给);
// ③ 准入跟踪器在发送前就落 meta(phase=tentative),响应头/增量把 phase 抬上去;
// ④ 失败收场且零证据 ⇒ unconfirmed(不是 admitted)。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC_DIR = join(__dirname, '..')

function readSource(rel: string): string {
  return readFileSync(join(SRC_DIR, rel), 'utf8')
}

describe('B 接线:send-answer 真消费分类处置(源码面形状锁)', () => {
  const src = readSource('send-answer.ts')

  it('导入了共享层判据与 web 呈现层', () => {
    expect(src).toContain("from '@ihui/shared/chat'")
    expect(src).toContain("from '@/lib/stream-error-view'")
  })

  it('onError 里真的调用了判据(经 dispositionOf 辅助,不是只 import)', () => {
    // buildStreamErrorView 的真实调用点住在 dispositionOf 里(它把"码 → 视图"收成一处,
    // 两个错误分支共用)。所以这里钉两件事:辅助函数存在 + onError 里真的用它。
    expect(src).toMatch(/const dispositionOf = \(info\?: \{ errorCode\?: string \}\)/)
    expect(src).toMatch(/buildStreamErrorView\(\{/)
    const onErrorAt = src.indexOf('onError: (errMsg, info)')
    const useAt = src.indexOf('const disposition = dispositionOf(info)')
    expect(onErrorAt).toBeGreaterThan(-1)
    expect(useAt).toBeGreaterThan(onErrorAt)
  })

  it('按钮按 retryable 给或不给(不是无差别挂重试)', () => {
    expect(src).toContain('disposition.retryable')
    expect(src).toContain('disposition.actionLabel')
  })

  it('relogin 档的按钮真的打开登录弹窗(而不是重发)', () => {
    expect(src).toMatch(/isAuth[\s\S]{0,200}open\('login'\)/)
  })
})

describe('A 接线:send-answer 真装车准入跟踪器(源码面形状锁)', () => {
  const src = readSource('send-answer.ts')

  it('发送前就建跟踪器并落 meta(phase 初始态可观测)', () => {
    expect(src).toMatch(/createSendAdmissionTracker\(\{\s*inputId: createInputId\(\)/)
    expect(src).toContain('flushAdmission()')
  })

  it('三个隐式证据点都接了(响应头 / 增量 / 收场)', () => {
    expect(src).toContain("noteEvidence('stream-open')")
    expect(src).toContain("noteEvidence('delta')")
    expect(src).toContain('admission.settle(')
  })

  it('收场判定用真实信号(有正文才算 answered)', () => {
    expect(src).toMatch(/firstContentTokenReceived[\s\S]{0,120}firstReasoningTokenReceived/)
    expect(src).toContain("'answered'")
    // 零证据的收场档由 tracker.settle 内部落 unconfirmed(判据住在 shared,本文件不复算)
    expect(src).toMatch(/admission\.settle\(/)
    expect(src).toContain("'aborted'")
  })

  it('只在 changed 时写盘(不制造每帧一次 store 写)', () => {
    expect(src).toContain('.changed) flushAdmission()')
  })
})

describe('ctx 面:streamErrorLabels 是可选格(不打断既有 7 处 makeCtx)', () => {
  const types = readSource('types.ts')
  const hook = readSource('../use-chat.ts')

  it('types.ts 里是可选字段', () => {
    expect(types).toMatch(/streamErrorLabels\?:/)
  })

  it('use-chat.ts 真的把 hook 产物塞进 ctx 并列为 useCallback 依赖', () => {
    expect(hook).toContain('const streamErrorLabels = useStreamErrorLabels()')
    expect(hook).toContain('streamErrorLabels,')
    expect(hook).toMatch(/sendAnswer = React\.useCallback\(createSendAnswer\(ctx, chatStore\), \[[\s\S]{0,80}streamErrorLabels/)
  })
})

describe('i18n:新命名空间与 chat 分离(不回写别人的在飞面)', () => {
  const SHARED_PACK = join(__dirname, '..', '..', '..', '..', '..', '..', 'packages/i18n/messages/shared')
  const WEB_PACK = join(__dirname, '..', '..', '..', '..', '..', '..', 'packages/i18n/messages/web')

  it('streamErrors 是 shared 包里的顶层命名空间,不在 chat 之下', () => {
    const pack = JSON.parse(readFileSync(join(SHARED_PACK, 'zh-CN.json'), 'utf8')) as Record<string, unknown>
    expect(pack['streamErrors']).toBeTypeOf('object')
    expect((pack['chat'] as Record<string, unknown>)['streamErrors']).toBeUndefined()
  })

  it('web 包与本票写入值逐字等值(两份并存只能同值,漂移即红)', () => {
    // 背景(2026-10-29 实测):web 五语言文件正被并行工作流整文件暂存,本票追加的键会被
    // 对方 `git add` 一起收进索引。于是同一份 streamErrors 可能同时出现在 shared 与 web 两包。
    // 端上 mergeMessages 是深合并(web 覆盖 shared),同值时行为一致;值一旦分叉就是漂移源。
    // 故这里把"两份必须逐字等值"钉成机器事实:任一包被单方面改写,本用例立刻红。
    const shared = JSON.parse(readFileSync(join(SHARED_PACK, 'zh-CN.json'), 'utf8')) as Record<
      string,
      unknown
    >
    const web = JSON.parse(readFileSync(join(WEB_PACK, 'zh-CN.json'), 'utf8')) as Record<string, unknown>
    if (web['streamErrors'] === undefined) return // 未出现第二份 ⇒ 天然满足
    expect(web['streamErrors']).toEqual(shared['streamErrors'])
  })

  it('本票的键名在 chat 子树下一律不可达(两包都查)', () => {
    const flatten = (o: Record<string, unknown> | undefined, p = ''): string[] => {
      if (!o) return []
      const out: string[] = []
      for (const [k, v] of Object.entries(o)) {
        const kp = p ? `${p}.${k}` : k
        if (v && typeof v === 'object' && !Array.isArray(v))
          out.push(...flatten(v as Record<string, unknown>, kp))
        else out.push(kp)
      }
      return out
    }
    const shared = JSON.parse(
      readFileSync(join(SHARED_PACK, 'zh-CN.json'), 'utf8'),
    ) as Record<string, unknown>
    const web = JSON.parse(readFileSync(join(WEB_PACK, 'zh-CN.json'), 'utf8')) as Record<string, unknown>
    const chatKeys = new Set([
      ...flatten(shared['chat'] as Record<string, unknown> | undefined),
      ...flatten(web['chat'] as Record<string, unknown> | undefined),
    ])
    const mine = flatten(shared['streamErrors'] as Record<string, unknown> | undefined)
    expect(mine.length).toBeGreaterThan(0)
    for (const k of mine) {
      expect(chatKeys.has(k), `chat 下不该出现 ${k}`).toBe(false)
      expect(chatKeys.has(`streamErrors.${k}`), `chat 下不该出现 streamErrors.${k}`).toBe(false)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
