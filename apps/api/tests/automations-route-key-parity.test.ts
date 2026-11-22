// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-1058624:automations 路由层与协议层用同一套任务键判据。
 *
 * 本票要证三件事:
 * 1) 反例的 400 **点名拒绝类别**:`foo:1` 说"未知前缀"、`issue:abc` 说"序号非数字",
 *    不再是笼统的"格式错"(此前路由层自带 `/^[\w.-]+:[\w.-]+$/`,两类坏键都能过路由校验,
 *    却在协议层被拒 ⇒ 错误从「400 明确拒绝」退化成「跑起来才炸」);
 * 2) 正例(合法键)照常放行,不误伤;
 * 3) 蕴含关系:路由层接受 ⇒ 协议层必接受(两层判据同源,不再有"过得了路由过不了协议"的缝)。
 */
import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'

import { repairAdminRoutes } from '../src/routes/automations.js'
import { parseScanItemKey, describeScanItemKeyIssue } from '../src/services/automations/index.js'
import type { AutomationRepairService } from '../src/services/automation-repair-service.js'
import type { RepairTaskRecord } from '@ihui/types'

function fakeService(): AutomationRepairService {
  const task: RepairTaskRecord = {
    key: 'issue:42',
    source: 'issue',
    repo: 'o/r',
    title: 't',
    goal: 'g',
    url: null,
    issueNumber: 42,
    state: 'pending',
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [],
  }
  return {
    repo: 'o/r',
    async ingestPending() {
      return 0
    },
    async claim() {
      return { ok: false, reason: 'not_found' }
    },
    async runNext() {
      return null
    },
    async runCycle() {
      return { ingested: 0, results: [] }
    },
    // 所有合法键一律"查无此任务" ⇒ 放行的证据统一是 404(而不是 200),
    // 这样断言"过没过路由校验"不受注入数据影响。
    listTasks: () => [task],
    getTask: () => null,
  }
}

async function build() {
  const app = Fastify()
  await app.register(repairAdminRoutes, {
    service: fakeService(),
    guard: async () => undefined,
  })
  await app.ready()
  return app
}

/** 打一个详情路由,返回状态码与错误 message。 */
async function probe(app: Awaited<ReturnType<typeof build>>, key: string) {
  const r = await app.inject({ method: 'GET', url: `/repair/tasks/${key}` })
  return {
    status: r.statusCode,
    message: (() => {
      try {
        return JSON.parse(r.body).message as string
      } catch {
        return ''
      }
    })(),
  }
}

describe('G-1058624 反例:400 必须点名拒绝类别(不是笼统格式错)', () => {
  it('foo:1 ⇒ 400 且点名"未知前缀"', async () => {
    const app = await build()
    const got = await probe(app, 'foo:1')
    expect(got.status).toBe(400)
    expect(got.message).toContain('未知前缀')
    // 明确不是笼统一句:旧措辞是"任务键形如 source:number"
    expect(got.message).not.toContain('任务键形如')
    await app.close()
  })

  it('issue:abc ⇒ 400 且点名"序号非数字"', async () => {
    const app = await build()
    const got = await probe(app, 'issue:abc')
    expect(got.status).toBe(400)
    expect(got.message).toContain('序号非数字')
    expect(got.message).not.toContain('任务键形如')
    await app.close()
  })

  it('两类坏键的拒绝原因互不串台(别都归成同一句笼统话)', async () => {
    const app = await build()
    const unknown = await probe(app, 'foo:1')
    const nonNumeric = await probe(app, 'issue:abc')
    expect(unknown.message).not.toBe(nonNumeric.message)
    await app.close()
  })

  it('其余旧有坏形态仍一律 400(段数/缺冒号/空段),不得因为换了实现而漏放', async () => {
    const app = await build()
    for (const key of ['nocolonkey', 'a:b:c', 'issue:1x', 'Issue:1', 'issue:1.5']) {
      const got = await probe(app, key)
      expect(got.status, `${key} 必须 400`).toBe(400)
    }
    await app.close()
  })
})

describe('G-1058624 正例:合法键不被误伤(放行 ⇒ 打到服务层得 404)', () => {
  it('三个合法前缀的键全部放行', async () => {
    const app = await build()
    for (const key of ['issue:1', 'issue:42', 'code-scanning:45', 'workflow-run:6789']) {
      const got = await probe(app, key)
      // 注入服务对任何键都返回 null ⇒ 放行落到 404;若被路由层误拒则会是 400
      expect(got.status, `${key} 必须放行,实际 ${got.status} ${got.message}`).toBe(404)
    }
    await app.close()
  })
})

describe('G-1058624 蕴含关系:路由层接受 ⇒ 协议层必接受', () => {
  // 这条是本票的靶心:只要路由层还比协议层宽松,这里就红。
  const CORPUS = [
    'issue:1',
    'issue:42',
    'issue:0',
    'code-scanning:45',
    'workflow-run:6789',
    'workflow-run:9007199254740993',
    // 旧路由层正则会放行、协议层会拒的坏键
    'foo:1',
    'issue:abc',
    'bar:999',
    'issue:1.5',
    'issue:-1',
    'Issue:1',
    'a:b:c',
    'nocolonkey',
    'issue:',
    ':1',
    'github:1',
    'pull-request:7',
  ]

  it('逐条打路由:凡路由层未以 400 拒绝的键,协议层 parseScanItemKey 必返回非 null', async () => {
    const app = await build()
    for (const key of CORPUS) {
      const got = await probe(app, key)
      if (got.status === 400) continue // 路由层拒了,蕴含式对此条无要求
      expect(
        parseScanItemKey(key),
        `路由层放行了 ${key}(状态 ${got.status}),协议层却拒收 ⇒ 两层判据不一致`,
      ).not.toBeNull()
    }
    await app.close()
  })

  it('反向不成立也不许被当成漏洞:协议层拒的键,路由层必须 400(不得更宽松)', async () => {
    const app = await build()
    for (const key of CORPUS) {
      if (parseScanItemKey(key) !== null) continue
      const got = await probe(app, key)
      expect(got.status, `协议层拒了 ${key},路由层却放行(状态 ${got.status})`).toBe(400)
      expect(got.message.length, `${key} 的 400 必须带原因,不能是空话`).toBeGreaterThan(0)
    }
    await app.close()
  })

  it('describeScanItemKeyIssue 与 parseScanItemKey 的判据是同一份(逐条对齐)', () => {
    // 两者共用 parseScanItemKeyDetailed:通过 ⇔ 通过,不通过 ⇔ 给出原因
    for (const key of CORPUS) {
      const issue = describeScanItemKeyIssue(key)
      const parsed = parseScanItemKey(key)
      expect(issue === null, `${key}:describe=${issue} 与 parse 判定不一致`).toBe(
        parsed !== null,
      )
      if (issue !== null) expect(issue.length).toBeGreaterThan(0)
    }
  })
})
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠