// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D152(2026-09-29 立,用户拍板「服务化,但存会话元数据、不建新表」)的 web 消费端装车证明。
//
// 这一票的端消费面要钉住四件事,各证一件:
//   ① **下行帧进缓存**:收到 `goal_updated` ⇒ store 的值真的变了,且**当前挂载的 GoalCard**
//      渲染出那一档的文案。文案断言走**真语包**(`packages/i18n/messages/{shared,web}/zh-CN.json`
//      深合并,与 apps/web/src/i18n/request.ts 同一口径)—— 用假 t() 只能证明"组件念了个键",
//      证不出"那两枚新键真的在五语言里";
//   ② **cleared 单帧即清空,且幂等**(拍板:不建 goal_cleared 第二帧,清除由 status 承载);
//   ③ **端内没有第二份六态字面量**:判**结构**(goal.ts 里 `GoalStatus` 必须是 @ihui/types 的
//      别名、六档校验必须走 `GOAL_STATUSES.includes`),不判裸子串 —— 裸筛 `'active'` 会把
//      合法的值赋值也算成副本,那种判据只会逼人把代码写得更绕;
//   ④ **接线**:send-message.ts 的 streamChat options 里 `onGoalUpdate` 必须是**代码行**
//      且其函数体真的调用 `applyServerGoal(`。把那一行删掉或整块注释掉,本用例必红 ——
//      只测 store 与组件证不出"帧真的有人接"(守门 64/70/81/115/138 反复记过的同一型)。
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

// 遮罩只有一份实现(§22c「两处算同一件事必漂移」);本行是测试面取用工具层,不是生产依赖边。
// 正解 = 给"测试支持层"在策略表建档并降到 apps 之下
// arch-exempt: 判据面必须与被审门共用同一份遮罩实现,否则"整块注释掉的接线"会被读成已装车 until 2026-12-28
import { maskComments } from '../../../../../../scripts/lib/code-mask.mjs'

const here = dirname(fileURLToPath(import.meta.url))
// __tests__ → ai → components → src → web → apps → 仓库根(6 层)
const repoRoot = resolve(here, '../../../../../../')
const readPack = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(repoRoot, 'packages/i18n/messages', name), 'utf8')) as Record<
    string,
    unknown
  >
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
/** 与 @ihui/i18n mergeMessages 同语义:web 端覆盖 shared */
const mergePack = (
  base: Record<string, unknown>,
  over: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(over)) {
    const b = out[k]
    out[k] = isRecord(b) && isRecord(v) ? mergePack(b, v) : v
  }
  return out
}
const PACK = mergePack(readPack('shared/zh-CN.json'), readPack('web/zh-CN.json'))
const lookup = (ns: string, key: string): unknown =>
  [...ns.split('.'), ...key.split('.')].reduce<unknown>(
    (node, part) =>
      node && typeof node === 'object' && !Array.isArray(node)
        ? (node as Record<string, unknown>)[part]
        : undefined,
    PACK,
  )

vi.mock('next-intl', () => ({
  useTranslations:
    (ns: string) =>
    (key: string): string => {
      const raw = lookup(ns, key)
      // 缺键必须喊出来:"词包没这条"与"组件没渲染"是两种病,混起来就只能靠猜
      return typeof raw === 'string' && raw !== '' ? raw : `MISSING:${ns}.${key}`
    },
  useLocale: () => 'zh-CN',
}))

vi.mock('@/components/common', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))
// GoalCard 只在自动续跑那一支写 chat store;隔离重依赖
vi.mock('@/stores/chat', () => ({
  useChatStore: { setState: vi.fn(), getState: vi.fn() },
}))

import { GOAL_STATUSES, GOAL_WIRE_STATUSES, WORKSPACE_AGENT_TASK_STATUSES } from '@ihui/types'
import type { GoalUpdateEvent } from '@ihui/api-client'
import { GoalCard } from '../goal-card'
import { useGoalStore } from '@/stores/goal'

// here = apps/web/src/components/ai/__tests__ ⇒ 上溯三层才到 src(写错一层就是 ENOENT,红在探针自己而非被审代码)
const SEND_MESSAGE_SRC = resolve(here, '../../../hooks/use-chat/send-message.ts')
const GOAL_STORE_SRC = resolve(here, '../../../stores/goal.ts')

/** 代码面(注释被等长空格替换 ⇒ 行号与原文一致,按行定位仍指向那一行) */
function codeFace(srcPath: string): string[] {
  return (maskComments(readFileSync(srcPath, 'utf8')) as string).split('\n')
}

/** 造一帧下行载荷:sessionId 恒在(端点路径里就带 {session_id}),缺省字段按用例补 */
function frame(over: Partial<GoalUpdateEvent> & Pick<GoalUpdateEvent, 'status'>): GoalUpdateEvent {
  return { sessionId: 'conv-7', ...over }
}

afterEach(() => {
  cleanup()
  useGoalStore.setState({ goal: null, expanded: true })
})

describe('D152 ① 下行帧进缓存并上屏', () => {
  it('goal_updated(usageLimited) ⇒ store 换成那一档,GoalCard 渲染真语包的「额度受限」', () => {
    useGoalStore.getState().setGoal('把发布链路做完')
    useGoalStore
      .getState()
      .applyServerGoal(
        frame({ status: 'usageLimited', objective: '把发布链路做完', elapsedMs: 61_000 }),
      )
    expect(useGoalStore.getState().goal?.status).toBe('usageLimited')
    expect(useGoalStore.getState().goal?.elapsedMs).toBe(61_000)
    const { container } = render(<GoalCard />)
    expect(
      container.querySelector<HTMLElement>('[data-testid="goal-status-badge"]')?.textContent,
    ).toBe('额度受限')
    expect(container.textContent ?? '').not.toContain('MISSING:')
  })

  it('goal_updated(budgetLimited) ⇒ 渲染「预算受限」(六档里最后两档都真被接住,不是只扩了类型)', () => {
    useGoalStore.getState().setGoal('把发布链路做完')
    useGoalStore.getState().applyServerGoal(frame({ status: 'budgetLimited' }))
    const { container } = render(<GoalCard />)
    expect(
      container.querySelector<HTMLElement>('[data-testid="goal-status-badge"]')?.textContent,
    ).toBe('预算受限')
  })

  it('别的端先 /goal:本端**没有本地目标**时按帧新建(票面验收①"不刷新即见目标")', () => {
    useGoalStore
      .getState()
      .applyServerGoal(
        frame({ status: 'active', objective: '另一端设的目标', updatedAt: 1_700_000_000 }),
      )
    const g = useGoalStore.getState().goal
    expect(g?.text).toBe('另一端设的目标')
    expect(g?.status).toBe('active')
    // 服务端 updatedAt 是 epoch **秒**;不换算会得到 1970 年的时间戳,耗时条随之算出天文数字
    expect(g?.updatedAt).toBe(1_700_000_000_000)
    expect(g?.createdAt).toBe(1_700_000_000_000)
  })

  it('未知档 ⇒ 一律不改缓存(绝不把"没认出来"写成"看见了")', () => {
    useGoalStore.getState().setGoal('原目标')
    const before = useGoalStore.getState().goal
    useGoalStore
      .getState()
      .applyServerGoal(frame({ status: 'impossibleStatus' as GoalUpdateEvent['status'] }))
    expect(useGoalStore.getState().goal).toEqual(before)
  })

  it('pause/resume 帧不带 objective ⇒ 保留本地文本,不得抹成空串', () => {
    useGoalStore.getState().setGoal('不能被抹掉的目标')
    useGoalStore.getState().applyServerGoal(frame({ status: 'paused' }))
    const g = useGoalStore.getState().goal
    expect(g?.text).toBe('不能被抹掉的目标')
    expect(g?.status).toBe('paused')
  })
})

describe('D152 ② cleared 单帧即清空(幂等)', () => {
  it('status:cleared ⇒ goal 变 null;再来一帧 cleared 仍是 null', () => {
    useGoalStore.getState().setGoal('要被清掉的目标')
    useGoalStore.getState().applyServerGoal(frame({ status: 'cleared' }))
    expect(useGoalStore.getState().goal).toBeNull()
    useGoalStore.getState().applyServerGoal(frame({ status: 'cleared' }))
    expect(useGoalStore.getState().goal).toBeNull()
    const { container } = render(<GoalCard />)
    expect(container.querySelector('[data-testid="goal-card-empty"]')).not.toBeNull()
  })
})

describe('D152 ③ 端内没有第二份六态字面量(判结构,不判裸子串)', () => {
  const storeLines = codeFace(GOAL_STORE_SRC)
  const joined = storeLines.join('\n')

  it('GoalStatus 是 @ihui/types 的**别名**,不是本端重写的引号联合', () => {
    expect(joined).toMatch(/from '@ihui\/types'/)
    const decl = storeLines.find((l) => /export type GoalStatus\s*=/.test(l))
    expect(decl).toBeDefined()
    // 别名形态:等号右边是一个标识符,不是 `'active' | …` 那种清单
    expect((decl ?? '').trim()).toMatch(/^export type GoalStatus = [A-Za-z_$][\w$]*$/)
  })

  it('反向锁:本文件不得再出现把六档逐个引号并起来的第二份清单', () => {
    const six = [...GOAL_STATUSES]
    const union = six.map((s) => `'${s}'`).join(' | ')
    expect(joined).not.toContain(union)
    // 也不得以数组形式再抄一份(判据用的是同一份 GOAL_STATUSES)
    expect(joined).not.toContain(`[${six.map((s) => `'${s}'`).join(', ')}]`)
  })

  it('六档的运行期校验走 GOAL_STATUSES.includes,不写 switch 白名单', () => {
    expect(joined).toMatch(/GOAL_STATUSES\.includes\(/)
  })
})

describe('D152 ④ 接线:send-message.ts 真的把 onGoalUpdate 接进 streamChat', () => {
  const lines = codeFace(SEND_MESSAGE_SRC)

  it('代码面存在 onGoalUpdate 属性行(删掉或整块注释掉 ⇒ 本用例必红)', () => {
    expect(lines.some((l) => /^\s+onGoalUpdate:/.test(l))).toBe(true)
  })

  it('该回调体内真的调用 applyServerGoal(接线不是空壳),并先判会话归属', () => {
    const startAt = lines.findIndex((l) => /^\s+onGoalUpdate:/.test(l))
    expect(startAt).toBeGreaterThanOrEqual(0)
    const indent = /^\s*/.exec(lines[startAt]!)![0].length
    const body: string[] = []
    for (let i = startAt; i < lines.length; i += 1) {
      const line = lines[i]!
      const cur = /^\s*/.exec(line)![0].length
      if (i > startAt && cur <= indent && /^\s*[A-Za-z_$][\w$]*:/.test(line)) break
      body.push(line)
    }
    expect(body.some((l) => l.includes('applyServerGoal('))).toBe(true)
    // 切会话时不得把上一会话的目标写进这一会话的缓存(与流内其它回调同一判序)
    expect(body.some((l) => l.includes('conversationId'))).toBe(true)
  })
})

describe('D152 六档词汇的域边界(AGENTS §30:goal 是第三个域,不得并集)', () => {
  it('落库六档 / 线格式第七值 / workspace 任务态三者各是独立清单', () => {
    expect(GOAL_STATUSES).toHaveLength(6)
    // cleared 是**线格式**的判别值,不是第七种落库状态(库里清除 = 整键消失)
    expect(GOAL_WIRE_STATUSES).toContain('cleared')
    expect(GOAL_STATUSES).not.toContain('cleared')
    // 与 workspace 任务态(running/completed/…)不相交:并进去就是改两套对外契约
    const overlap = WORKSPACE_AGENT_TASK_STATUSES.filter((s) =>
      (GOAL_STATUSES as readonly string[]).includes(s),
    )
    expect(overlap).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
