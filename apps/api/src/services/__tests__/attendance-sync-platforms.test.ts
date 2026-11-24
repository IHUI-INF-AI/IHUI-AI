// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 平台射程与平台错误可读性(2026-11-17 立)。
 *
 * 实测背景:同一 `employee_no` 无法同时服务两个平台 —— 把钉钉 userid 当飞书工号传,
 * 飞书直接 `HTTP 400 / code=1220001 userIds all invalid`。所以:
 *   · 必须能把射程收窄到企业实际接入的平台(DB 白名单,改库热生效);
 *   · 平台 4xx 的错误消息必须带上平台自己的 code/msg,否则排障只能猜。
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { runAttendanceSyncJob } from '../attendance-sync-job.js'
import {
  createAttendanceSyncProviders,
  resetAttendanceSyncTokenCache,
} from '../attendance-sync-providers.js'
import { parseAttendanceSyncPlatforms } from '../attendance-sync-types.js'
import type { AttendanceSyncRepo } from '../attendance-sync-store.js'

const PLATFORMS_KEY = 'sync:attendance:platforms'

function repoWith(platforms: string | null | 'throw'): AttendanceSyncRepo {
  return {
    async findEmployeeByNo() {
      return { id: 'emp-1', departmentId: 'dept-1' }
    },
    async insertAttendanceIfAbsent() {
      return false
    },
    async readConfig(key) {
      if (key === 'sync:attendance:enabled') return 'true'
      if (key !== PLATFORMS_KEY) return null
      if (platforms === 'throw') throw new Error('db down')
      return platforms
    },
    async writeConfig() {
      /* no-op */
    },
  }
}

/** 两个平台都配了凭证、都返回空数据;只观察「谁被调用」。 */
const bothConfiguredEnv = {
  FEISHU_APP_ID: 'app',
  FEISHU_APP_SECRET: 'secret',
  DINGTALK_APPKEY: 'key',
  DINGTALK_APP_SECRET: 'secret',
} as NodeJS.ProcessEnv

function quietFetch(): typeof fetch {
  return (async (input: string | URL) => {
    const url = String(input)
    if (url.includes('tenant_access_token')) {
      return new Response(JSON.stringify({ code: 0, tenant_access_token: 't' }), { status: 200 })
    }
    if (url.includes('user_tasks')) {
      return new Response(JSON.stringify({ code: 0, data: { user_task_results: [] } }), {
        status: 200,
      })
    }
    if (url.includes('gettoken')) {
      return new Response(JSON.stringify({ errcode: 0, access_token: 't' }), { status: 200 })
    }
    return new Response(JSON.stringify({ errcode: 0, recordresult: [] }), { status: 200 })
  }) as typeof fetch
}

async function run(platforms: string | null | 'throw') {
  return runAttendanceSyncJob({
    env: bothConfiguredEnv,
    repo: repoWith(platforms),
    loadEmployeeNos: async () => ['E001'],
    userIdMap: { E001: 'u1' },
    writeLastRun: async () => undefined,
    alert: async () => undefined,
    fetchImpl: quietFetch(),
  })
}

describe('parseAttendanceSyncPlatforms', () => {
  it('未配置/空串 ⇒ null(全部平台)', () => {
    expect(parseAttendanceSyncPlatforms(null)).toBeNull()
    expect(parseAttendanceSyncPlatforms('   ')).toBeNull()
  })

  it('正常解析,大小写与空白容错', () => {
    expect(parseAttendanceSyncPlatforms(' DINGTALK , ,Feishu ')).toEqual(
      new Set(['dingtalk', 'feishu']),
    )
  })
})

describe('平台白名单(job 层)', () => {
  beforeEach(() => {
    resetAttendanceSyncTokenCache()
  })

  it('未配置白名单 ⇒ 两个平台都跑', async () => {
    const r = await run(null)
    expect(r.attempted).toBe(2)
  })

  it('白名单=dingtalk ⇒ 只跑钉钉(飞书不再被调用,也就不再产生 400 噪声)', async () => {
    const r = await run('dingtalk')
    expect(r.attempted).toBe(1)
  })

  it('读白名单抛错 ⇒ 不筛(失效方向为多跑一次,绝不静默少跑)', async () => {
    const r = await run('throw')
    expect(r.attempted).toBe(2)
  })
})

describe('平台错误可读性', () => {
  it('平台 4xx 的错误消息带上平台自己的 code/msg', async () => {
    resetAttendanceSyncTokenCache()
    const fetchImpl = (async (input: string | URL) => {
      const url = String(input)
      if (url.includes('tenant_access_token')) {
        return new Response(JSON.stringify({ code: 0, tenant_access_token: 't' }), { status: 200 })
      }
      return new Response(
        JSON.stringify({ code: 1220001, msg: 'userIds all invalid' }),
        { status: 400 },
      )
    }) as typeof fetch

    const providers = createAttendanceSyncProviders(
      { FEISHU_APP_ID: 'app', FEISHU_APP_SECRET: 'secret' } as NodeJS.ProcessEnv,
      fetchImpl,
    )
    const feishu = providers.find((p) => p.id === 'feishu')
    expect(feishu).toBeTruthy()
    await expect(
      feishu!.pullAttendance({ date: '2026-11-16', employeeNos: ['X1'], userIdMap: {} }),
    ).rejects.toThrow(/1220001/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
