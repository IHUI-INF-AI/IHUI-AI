// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 报名域契约用例:`/exam/composition/signup/:sid` 的路径参数是**报名行主键**,不是 examId。
//
// 立据(逐条可在仓库里复核,不得凭记忆改):
//   - 后端三条 :sid 路由的 where 全是 `eq(examSignUp.id, Number(sid))`
//     apps/api/src/routes/exam.ts:1358(GET)/ :1448(PUT)/ :1465(DELETE);参数模式 :466
//   - `exam_sign_up.id` = `serial('id').primaryKey()`
//     packages/database/src/schema/relation-tables.ts:60
//   - GET /signup/my 与 POST /signup 的扁平返回里 `id` 就是那枚主键(`String(s.id)`)
//     apps/api/src/routes/exam.ts:1322-1328 / :1413-1419
//   - 唯一按 examId 走的是 POST 的**请求体**键 `eid`(同文件 :1367-1384)
// 三处必须同读同一枚 id:端点签名 ↔ 后端路由参数语义 ↔ 调用实参。
// 本文件同时钉住"扁平形状"与"整行形状"不是同一份(见用例 3),端内按错的形状取值
// 会得到 undefined 而不报错 —— 那正是这条契约最容易静默烂掉的地方。

import { afterEach, describe, expect, it } from 'vitest'

import { cancelSignUp, getMySignUps, getSignUp, saveSignUp } from '../src/endpoints/exam.js'
import { setTransport, type Transport } from '../src/transport.js'

/** 表里的一行(serial 主键 812 / 考试 101 / 会员编号 7 —— 三个 id 刻意互不相同) */
const SIGNUP_ROW = {
  id: 812,
  memberId: 7,
  examId: 101,
  status: 'pending',
  completedTime: null,
  createdAt: '2026-09-20T01:02:03.000Z',
  updatedAt: '2026-09-20T01:02:03.000Z',
}

/** GET /signup/my 的扁平返回形状(exam.ts:1322-1328 那份 map 的逐字复刻) */
const MY_SIGNUP_FLAT_ITEM = {
  id: String(SIGNUP_ROW.id),
  examId: String(SIGNUP_ROW.examId),
  userId: String(SIGNUP_ROW.memberId),
  status: SIGNUP_ROW.status,
  signedAt: SIGNUP_ROW.createdAt,
}

interface RecordedCall {
  url: string
  method?: string
  body?: unknown
}

function makeTransport(payload: unknown): { transport: Transport; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const transport: Transport = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body })
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => '',
      json: async () => ({ code: 0, data: payload }),
    }
  }
  return { transport, calls }
}

describe('exam signup 域:路径参数 :sid = 报名行主键(≠ examId)', () => {
  afterEach(() => {
    setTransport(undefined as unknown as Transport)
  })

  it('1) 夹具自检:主键 / examId / 会员编号三个值互不相同(否则后面的断言都没有牙)', () => {
    const ids = [MY_SIGNUP_FLAT_ITEM.id, MY_SIGNUP_FLAT_ITEM.examId, MY_SIGNUP_FLAT_ITEM.userId]
    expect(new Set(ids).size).toBe(3)
    expect(MY_SIGNUP_FLAT_ITEM.id).toBe('812')
  })

  it('2) 列表→撤报名的往返:实参必须取自 /signup/my 的 id,而不是 examId', async () => {
    const list = makeTransport({ list: [MY_SIGNUP_FLAT_ITEM], total: 1, page: 1, pageSize: 10 })
    setTransport(list.transport)
    const got = await getMySignUps({ page: 1, pageSize: 10 })
    expect(got.success).toBe(true)
    const row = got.data?.list[0]
    if (!row) throw new Error('夹具没被读回来:用例失去意义')

    const del = makeTransport({ ok: true })
    setTransport(del.transport)
    const res = await cancelSignUp(row.id)

    expect(del.calls[0]?.url).toBe('/api/exam/composition/signup/812')
    expect(del.calls[0]?.method).toBe('DELETE')
    expect(res.success).toBe(true)
    // 历史缺陷形态(把 examId 塞进 :sid)必须被这条点名 —— 它打到的是 101 那行,即另一场考试的报名
    expect(del.calls[0]?.url).not.toBe('/api/exam/composition/signup/101')
  })

  it('3) getSignUp:同一条 :sid 路由,返回体是 { signup: 整行 } 而非扁平 ExamSignUp', async () => {
    const { transport, calls } = makeTransport({ signup: SIGNUP_ROW })
    setTransport(transport)
    const res = await getSignUp('812')

    expect(calls[0]?.url).toBe('/api/exam/composition/signup/812')
    expect(res.success).toBe(true)
    expect(res.data?.signup.id).toBe(812)
    expect(res.data?.signup.examId).toBe(101)
    expect(res.data?.signup.memberId).toBe(7)
    // 详情路由没有做扁平化:这两列只存在于 /signup/my 的 map 里
    expect(res.data?.signup).not.toHaveProperty('userId')
    expect(res.data?.signup).not.toHaveProperty('signedAt')
  })

  it('4) 分岔的另一半:POST /signup 按 examId 走 body(键 eid),路径里没有 :sid', async () => {
    const { transport, calls } = makeTransport(MY_SIGNUP_FLAT_ITEM)
    setTransport(transport)
    const res = await saveSignUp('101')

    expect(calls[0]?.url).toBe('/api/exam/composition/signup')
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.body).toBe(JSON.stringify({ eid: '101' }))
    expect(res.success).toBe(true)
    // POST 的扁平返回里 id 同样是主键 —— 前端拿到响应即可直接用于后续 DELETE,无需二次查询
    expect(res.data?.id).toBe('812')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
