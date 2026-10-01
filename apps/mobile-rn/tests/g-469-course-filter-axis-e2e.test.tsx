// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-469 端到端证明:课程筛选屏「选了轴 → 请求参数 → 返回集合 → 渲染出的行」
//
// 票面登记的是"没被端到端证明的那一格"。既有 `course-filter-endpoint.test.ts` 证的是
// **纯函数那一层**(buildCourseFilterQuery 能把档位写成键名、键名在 lessonsQuerySchema 里),
// `apps/api/tests/learn/published-lessons-filter-axes.test.ts` 证的是**服务端谓词**。
// 中间那一格从来没人证:按下档 → 真的换了一次请求 → 请求里真的带上那根轴 →
// 返回集合真的被收窄 → **屏幕上剩下的行真的变了**。
// 所以本文件渲染的是真件:
//   · 屏 = apps/mobile-rn/src/screens/CourseFilterScreen.tsx(轴状态与取数都在这里)
//   · 共享展示件 = packages/app/src/features/course-filter/CourseFilterScreen.tsx
//     —— vitest.config.ts 把 '@ihui/rn-app' 指到 tests/__mocks__/ihui-rn-app.ts,而那份静态
//     替身**根本没有** CourseFilterScreen(实测零命中)。不转指真实实现的话,拿到的会是
//     undefined,渲染直接炸;转指之后断言才落在真渲染路径上。
//   · 分页 hook = packages/shared/src/hooks/use-paginated-list.ts 那一份实现
//     —— 别名 '@ihui/shared/hooks' 指的是 tests/__mocks__/ihui-shared-hooks.ts 的**手抄副本**
//     (§22c 记过的"测的是替身"那一型)。本文件末有一条身份断言,证明用的不是副本。
//   · 网络 = 真实 getLearnCourses + 真实 buildQs + 真实 fetchApi,只在 transport 注入口
//     (api-client 唯一的 DI 出口 setTransport)换成一台**按服务端语义收窄**的假服务。
//     这样"参数进没进 URL"这一环是跑出来的,不是读代码读出来的。
//
// 反向对照是硬要求:只断言"选了以后仍然渲染出 N 行"什么也没证明,所以每根轴都另有
// 一档取值 / reset 一条路径,断言**结果集不同**(逐 id 比,不是比数量)。

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'

/** 每一次真实出站请求的完整 URL(由 transport 注入点记录) */
const outboundUrls: string[] = []

// ─── 屏的外部依赖:只 mock 平台/宿主边界,不 mock 任何被测逻辑 ───────────────────
vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))
vi.mock('../src/i18n', () => {
  const t = (key: string) => key
  return { useI18n: () => ({ t }) }
})
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: vi.fn(), navigate: vi.fn() }),
}))
vi.mock('@react-navigation/native-stack', () => ({}))

// 真件转发(见文件头两条理由:静态替身缺这个导出 / 副本会冒充实现)
vi.mock('@ihui/rn-app', async () => {
  const shared = await import(
    '../../../packages/app/src/features/course-filter/CourseFilterScreen'
  )
  return { CourseFilterScreen: shared.CourseFilterScreen }
})
vi.mock('../src/hooks', async () => {
  const real = await import('../../../packages/shared/src/hooks/use-paginated-list')
  return { usePaginatedList: real.usePaginatedList }
})

// ─── 假服务:镜像 apps/api/src/db/learn-queries.ts 的 lessonFilterConditions ──────
// free 的唯一判据是 isFree=true ∨ price ≤ 0(服务端 lessonFreeCondition 那一份语义);
// paid 取它的 NOT。未知键一律忽略 —— 这正是"端内拼错键名 ⇒ 服务端静默不筛"的形态,
// 所以夹具必须能把那一格错也照出来,而不是替客户端兜住。
interface FakeLessonRow {
  id: string
  title: string
  price: string
  isFree: boolean
  difficulty: string | null
  categoryId: string | null
  categoryName: string | null
  instructor: string
  isPublished: boolean
  status: number
}

const CORPUS: FakeLessonRow[] = [
  {
    id: 'g469-1',
    title: 'G469_FREE_BEGINNER',
    price: '0.00',
    isFree: true,
    difficulty: 'beginner',
    categoryId: 'c-1',
    categoryName: 'A',
    instructor: 'T1',
    isPublished: true,
    status: 1,
  },
  {
    id: 'g469-2',
    title: 'G469_PAID_ADVANCED',
    price: '99.00',
    isFree: false,
    difficulty: 'advanced',
    categoryId: 'c-1',
    categoryName: 'A',
    instructor: 'T2',
    isPublished: true,
    status: 1,
  },
  {
    id: 'g469-3',
    title: 'G469_PAID_BEGINNER',
    price: '199.50',
    isFree: false,
    difficulty: 'beginner',
    categoryId: 'c-2',
    categoryName: 'B',
    instructor: 'T3',
    isPublished: true,
    status: 1,
  },
  {
    id: 'g469-4',
    title: 'G469_FREE_ADVANCED',
    price: '0.00',
    isFree: false,
    difficulty: 'advanced',
    categoryId: 'c-2',
    categoryName: 'B',
    instructor: 'T4',
    isPublished: true,
    status: 1,
  },
  {
    id: 'g469-5',
    title: 'G469_PAID_UNMARKED',
    price: '59.00',
    isFree: false,
    difficulty: null,
    categoryId: 'c-1',
    categoryName: 'A',
    instructor: 'T5',
    isPublished: true,
    status: 1,
  },
]

const isFreeRow = (r: FakeLessonRow) => r.isFree || Number(r.price) <= 0

function fakeLessonsPayload(search: URLSearchParams) {
  let rows = CORPUS.filter((r) => r.isPublished && r.status === 1)
  const categoryId = search.get('categoryId')
  const difficulty = search.get('difficulty')
  const price = search.get('price')
  const searchWord = search.get('search')
  if (categoryId) rows = rows.filter((r) => r.categoryId === categoryId)
  if (difficulty) rows = rows.filter((r) => r.difficulty === difficulty)
  if (price === 'free') rows = rows.filter(isFreeRow)
  else if (price === 'paid') rows = rows.filter((r) => !isFreeRow(r))
  if (searchWord) rows = rows.filter((r) => r.title.toLowerCase().includes(searchWord.toLowerCase()))
  const total = rows.length
  const page = Number(search.get('page') ?? '1')
  const pageSize = Number(search.get('pageSize') ?? '20')
  const list = rows.slice((page - 1) * pageSize, page * pageSize)
  return { code: 0, message: 'ok', data: { list, total, page, pageSize } }
}

const transport = vi.fn(async (url: string) => {
  outboundUrls.push(url)
  const parsed = new URL(url, 'http://api.test.local')
  const isCategories = parsed.pathname.endsWith('/learn/categories')
  const data = isCategories
    ? { list: [{ id: 'c-1', name: '分类一', pid: null, sort: 1, status: 1, createdAt: '' }] }
    : fakeLessonsPayload(parsed.searchParams)
  const payload = isCategories ? { code: 0, message: 'ok', data } : data
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }
})

/** 第 n 次(1 起)取数请求的查询参数;越界返回 null */

/** 全部 lessons 请求的查询串(按发出顺序);判据一律基于"这个动作引发的那一条",不是猜条数 */
function lessonQueries(): URLSearchParams[] {
  return outboundUrls
    .filter((u) => u.includes('/learn/lessons'))
    .map((u) => new URL(u, 'http://api.test.local').searchParams)
}

/** 最后一条 lessons 请求;一条都没有 ⇒ null(调用方必须自己断言非空,不许用 ! 蒙) */
function lastLessonQuery(): URLSearchParams | null {
  const all = lessonQueries()
  const last = all[all.length - 1]
  return last ?? null
}

function queryOf(nth: number): URLSearchParams | null {
  const lessonUrls = outboundUrls.filter((u) => u.includes('/learn/lessons'))
  const hit = lessonUrls[nth - 1]
  return hit ? new URL(hit, 'http://api.test.local').searchParams : null
}

/** 渲染出的行 = 屏幕上真实存在的标题文本集合(不读桩的返回值) */
function renderedTitles(container: HTMLElement): string[] {
  return CORPUS.filter((r) =>
    Array.from(container.querySelectorAll('*')).some(
      (el) => el.childElementCount === 0 && el.textContent === r.title,
    ),
  ).map((r) => r.title)
}

async function pressChip(container: HTMLElement, text: string) {
  const el = Array.from(container.querySelectorAll('*')).find(
    (node) => node.childElementCount === 0 && node.textContent === text,
  )
  if (!el) throw new Error(`屏幕上找不到可点档位: ${text}`)
  fireEvent.click(el)
  await waitFor(() => expect(el.closest('button')).not.toBeNull())
}

describe('G-469 课程筛选屏:选轴 → 请求 → 收窄 → 渲染 的端到端', () => {
  beforeEach(async () => {
    outboundUrls.length = 0
    transport.mockClear()
    const api = await import('@ihui/api-client')
    api.setTransport(transport as unknown as Parameters<typeof api.setTransport>[0])
    // 设备指纹采集是端侧注入项,与本票无关;给一个恒空的 provider 免得真去摸 AsyncStorage
    api.setDeviceFingerprintProvider({ get: async () => null } as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('渲染路径用的是真实分页 hook,不是端内手抄副本(真件身份由 DOM 用例承担)', async () => {
    const realHook = await import('../../../packages/shared/src/hooks/use-paginated-list')
    const stubHook = await import('./__mocks__/ihui-shared-hooks')
    const barrel = await import('../src/hooks')
    // 刻意**不**写"端内替身的 CourseFilterScreen 与共享屏不是同一个函数"这类身份断言:
    // vi.mock 的注册按**解析后的文件路径**生效,测试里再 import `./__mocks__/ihui-rn-app`
    // 拿到的是本文件自己转发真件的那份结果 ⇒ 两者是同一个函数,这条锁根本写不出来
    // (留着就是一条恒红用例,而恒红用例与恒绿断言同样没用)。
    // 也不按相对路径去 import `packages/app/.../CourseFilterScreen` 做 typeof 检查:
    // 那条路径与别名解析出的**不是同一个模块实例**(且本仓 RN 侧冷 transform 实测 >10s,
    // 直接把本用例拖成超时红)—— "渲染的是真件"由 DOM 用例取证:端内替身只把 props 推进数组、
    // 渲染空 div,产不出 `courseFilter.price_paid` 这类档位文案与行标题,那才是能落地的身份证据。
    expect(barrel.usePaginatedList).toBe(realHook.usePaginatedList)
    expect(barrel.usePaginatedList).not.toBe(stubHook.usePaginatedList)
  })

  it('未选任何轴时首屏不下传 price / difficulty(反向对照的基线)', async () => {
    const { CourseFilterScreen } = await import('../src/screens/CourseFilterScreen')
    const { container } = render(React.createElement(CourseFilterScreen))
    await waitFor(() => expect(renderedTitles(container)).toHaveLength(5))
    // 真渲染的证据:档位文案来自真实共享屏的 i18n 键(端内静态替身只会打 data-testid)
    expect(container.textContent).toContain('courseFilter.price_paid')
    expect(container.textContent).toContain('courseFilter.difficulty_advanced')
    const q = queryOf(1)
    expect(q, '首屏必须有一次真实取数').not.toBeNull()
    expect(q!.get('price')).toBeNull()
    expect(q!.get('difficulty')).toBeNull()
  })

  it('选「付费」并应用:请求真的带 price=paid,渲染的行只剩付费的 3 行', async () => {
    const { CourseFilterScreen } = await import('../src/screens/CourseFilterScreen')
    const { container } = render(React.createElement(CourseFilterScreen))
    await waitFor(() => expect(renderedTitles(container)).toHaveLength(5))
    const before = outboundUrls.length

    await pressChip(container, 'courseFilter.price_paid')
    await pressChip(container, 'courseFilter.apply')

    await waitFor(() => expect(outboundUrls.length).toBeGreaterThan(before))
    const q = lastLessonQuery()
    expect(q!.get('price')).toBe('paid')
    await waitFor(() =>
      expect([...renderedTitles(container)].sort()).toEqual(
        ['G469_PAID_ADVANCED', 'G469_PAID_BEGINNER', 'G469_PAID_UNMARKED'].sort(),
      ),
    )
    // 被收窄掉的行必须真的从渲染结果里消失(不是"还在,只是数了个 3")
    expect(renderedTitles(container)).not.toContain('G469_FREE_BEGINNER')
    expect(renderedTitles(container)).not.toContain('G469_FREE_ADVANCED')
  })

  it('反向对照一:改点「免费」是另一组行,与付费结果集不同(不是恒渲染 N 行)', async () => {
    const { CourseFilterScreen } = await import('../src/screens/CourseFilterScreen')
    const { container } = render(React.createElement(CourseFilterScreen))
    await waitFor(() => expect(renderedTitles(container)).toHaveLength(5))

    await pressChip(container, 'courseFilter.price_paid')
    await pressChip(container, 'courseFilter.apply')
    await waitFor(() => expect(renderedTitles(container)).toHaveLength(3))
    const paidSet = [...renderedTitles(container)].sort()

    await pressChip(container, 'courseFilter.price_free')
    await pressChip(container, 'courseFilter.apply')
    await waitFor(() => expect(renderedTitles(container)).toHaveLength(2))
    const freeSet = [...renderedTitles(container)].sort()

    expect(lastLessonQuery()!.get('price')).toBe('free')
    expect(freeSet).toEqual(['G469_FREE_ADVANCED', 'G469_FREE_BEGINNER'].sort())
    expect(freeSet).not.toEqual(paidSet)
    // 两档合起来正好是全量,说明收窄是真的分区,不是随机少几行
    expect([...new Set([...paidSet, ...freeSet])].sort()).toEqual(
      CORPUS.map((r) => r.title).sort(),
    )
  })

  it('反向对照二:难度轴换 beginner → advanced,两次结果集逐 id 不同', async () => {
    const { CourseFilterScreen } = await import('../src/screens/CourseFilterScreen')
    const { container } = render(React.createElement(CourseFilterScreen))
    await waitFor(() => expect(renderedTitles(container)).toHaveLength(5))

    await pressChip(container, 'courseFilter.difficulty_beginner')
    await pressChip(container, 'courseFilter.apply')
    await waitFor(() => expect(renderedTitles(container)).toHaveLength(2))
    expect(lastLessonQuery()!.get('difficulty')).toBe('beginner')
    const beginnerSet = [...renderedTitles(container)].sort()
    expect(beginnerSet).toEqual(['G469_FREE_BEGINNER', 'G469_PAID_BEGINNER'].sort())

    await pressChip(container, 'courseFilter.difficulty_advanced')
    await pressChip(container, 'courseFilter.apply')
    await waitFor(() => expect(renderedTitles(container)).toHaveLength(2))
    expect(lastLessonQuery()!.get('difficulty')).toBe('advanced')
    const advancedSet = [...renderedTitles(container)].sort()
    expect(advancedSet).toEqual(['G469_FREE_ADVANCED', 'G469_PAID_ADVANCED'].sort())
    expect(advancedSet).not.toEqual(beginnerSet)
    // 未标注(NULL)的行不该被任何难度档捞到 —— 这是服务端语义,也是"如实"那一档
    expect(advancedSet).not.toContain('G469_PAID_UNMARKED')
    expect(beginnerSet).not.toContain('G469_PAID_UNMARKED')
  })

  it('两根轴能同时生效:URL 里 price 与 difficulty 都在,渲染只剩交集那 1 行', async () => {
    const { CourseFilterScreen } = await import('../src/screens/CourseFilterScreen')
    const { container } = render(React.createElement(CourseFilterScreen))
    await waitFor(() => expect(renderedTitles(container)).toHaveLength(5))

    await pressChip(container, 'courseFilter.price_paid')
    await pressChip(container, 'courseFilter.difficulty_advanced')
    await pressChip(container, 'courseFilter.apply')

    await waitFor(() => expect(renderedTitles(container)).toEqual(['G469_PAID_ADVANCED']))
    const q = lastLessonQuery()
    // 吞参数形态的探针:任一轴在 URL 里消失,上一行的交集断言就会因为"只按一根轴筛"而多出行
    expect(q!.get('price')).toBe('paid')
    expect(q!.get('difficulty')).toBe('advanced')
  })

  it('草稿档不触发请求:只点轴不点应用时,不发新请求、行也不变', async () => {
    const { CourseFilterScreen } = await import('../src/screens/CourseFilterScreen')
    const { container } = render(React.createElement(CourseFilterScreen))
    await waitFor(() => expect(renderedTitles(container)).toHaveLength(5))
    const before = outboundUrls.length

    await pressChip(container, 'courseFilter.price_paid')
    await new Promise((r) => setTimeout(r, 30))

    expect(outboundUrls.length).toBe(before)
    expect(renderedTitles(container)).toHaveLength(5)
    expect(queryOf(1)!.get('price')).toBeNull()
  })

  it('reset 之后回到全量,且请求不再带任何轴(证明"收窄"是可逆的)', async () => {
    const { CourseFilterScreen } = await import('../src/screens/CourseFilterScreen')
    const { container } = render(React.createElement(CourseFilterScreen))
    await waitFor(() => expect(renderedTitles(container)).toHaveLength(5))

    await pressChip(container, 'courseFilter.difficulty_advanced')
    await pressChip(container, 'courseFilter.apply')
    await waitFor(() => expect(renderedTitles(container)).toHaveLength(2))

    await pressChip(container, 'courseFilter.reset')
    await waitFor(() => expect(renderedTitles(container)).toHaveLength(5))
    const q = lastLessonQuery()
    expect(q!.get('difficulty')).toBeNull()
    expect(q!.get('price')).toBeNull()
  })

  it('夹具自身有牙:未知键名被"服务端"静默忽略 ⇒ 端内拼错键会被本文件照出来', async () => {
    const api = await import('@ihui/api-client')
    const before = outboundUrls.length
    // 故意用一个服务端不认的键(diffucilty)问"进阶" —— 若假服务不剥未知键,这条会返回 2 行
    const res = await api.fetchApi<{ list: FakeLessonRow[] }>('/api/learn/lessons?diffucilty=advanced')
    expect(outboundUrls.length).toBeGreaterThan(before)
    // `expect(res.success).toBe(true)` **不做类型收窄**(ApiResult 是可判别联合),
    // 直接读 res.data 是 TS2339;要收窄就得真的分支一次 —— 失败时把 error 原文抛出来,
    // 让"假服务端返回失败"这种夹具崩坏表现为可读的失败而不是一句 undefined。
    if (!res.success) throw new Error(`假服务端不该拒绝未知键请求:${res.error}`)
    expect(res.data.list.length).toBe(CORPUS.length)
    // 同一台假服务、拼对的键 ⇒ 真的收窄。两支对照缺一,上一支就只是"什么都没发生"
    const okRes = await api.fetchApi<{ list: FakeLessonRow[] }>('/api/learn/lessons?difficulty=advanced')
    if (!okRes.success) throw new Error(`假服务端不该拒绝合法请求:${okRes.error}`)
    expect(okRes.data.list.length).toBe(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
