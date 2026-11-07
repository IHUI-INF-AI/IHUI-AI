// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SOURCE_EVENT_ROUTES,
  githubDeliveryEventId,
  imStableEventId,
  normalizeGithubWebhook,
  normalizeImWebhook,
  normalizePollItem,
  parseSourceEventRoutes,
  pollStableEventId,
  selectSourceEventRoute,
  toIncomingTrigger,
} from './source-events'

const OWNER = 'user-uuid-owner'

function prPayload(overrides: Record<string, unknown> = {}) {
  return {
    repository: { full_name: 'ihui-ai/IHUI-AI' },
    sender: { login: 'alice' },
    requested_reviewer: { login: 'lichunchuan' },
    pull_request: {
      number: 42,
      title: 'feat: event sources',
      html_url: 'https://github.com/ihui-ai/IHUI-AI/pull/42',
      updated_at: '2026-11-07T10:00:00Z',
    },
    ...overrides,
  }
}

describe('GitHub webhook 归一化', () => {
  it('review_requested 命中机主登录名 ⇒ explicit 直接接单', () => {
    const result = normalizeGithubWebhook({
      deliveryId: 'delivery-1',
      event: 'pull_request',
      action: 'review_requested',
      payload: prPayload(),
      repo: 'ihui-ai/IHUI-AI',
      ownerUserId: OWNER,
      ownerLogins: ['lichunchuan'],
    })
    expect(result.accepted).toBe(true)
    if (!result.accepted) return
    expect(result.event.route.ruleId).toBe('github.pr.review')
    expect(result.event.route.domain).toBe('code-review')
    expect(result.event.addressed).toBe(true)
    expect(result.event.fromBot).toBe(false)
    expect(result.event.eventId).toBe('github:delivery-1')
    expect(result.event.threadId).toBe('github:ihui-ai/IHUI-AI:pull_request:42')
    expect(result.event.text).toBe(
      '[code-review] github.pr.review: ihui-ai/IHUI-AI pull_request/review_requested #42: feat: event sources by @alice',
    )
  })

  it('pull_request opened 是机器事件 ⇒ inferred 只记账', () => {
    const result = normalizeGithubWebhook({
      deliveryId: 'delivery-2',
      event: 'pull_request',
      action: 'opened',
      payload: prPayload(),
      repo: 'ihui-ai/IHUI-AI',
      ownerUserId: OWNER,
      ownerLogins: ['lichunchuan'],
    })
    expect(result.accepted).toBe(true)
    if (!result.accepted) return
    expect(result.event.route.ruleId).toBe('github.pr.opened')
    expect(result.event.addressed).toBe(false)
    expect(result.event.fromBot).toBe(true)
  })

  it('issue_comment 未点名 ⇒ mention_required,不进引擎', () => {
    const result = normalizeGithubWebhook({
      deliveryId: 'delivery-3',
      event: 'issue_comment',
      action: 'created',
      payload: {
        repository: { full_name: 'ihui-ai/IHUI-AI' },
        sender: { login: 'bob' },
        issue: { number: 7, title: 'bug', html_url: 'https://x/7', updated_at: 't' },
        comment: { body: 'looks fine', html_url: 'https://x/7#c1', user: { login: 'bob' } },
      },
      repo: 'ihui-ai/IHUI-AI',
      ownerUserId: OWNER,
      ownerLogins: ['lichunchuan'],
    })
    expect(result.accepted).toBe(false)
    if (result.accepted) return
    expect(result.reason).toBe('mention_required')
  })

  it('issue_comment @机主 ⇒ explicit', () => {
    const result = normalizeGithubWebhook({
      deliveryId: 'delivery-4',
      event: 'issue_comment',
      action: 'created',
      payload: {
        repository: { full_name: 'ihui-ai/IHUI-AI' },
        sender: { login: 'bob' },
        issue: { number: 7, title: 'bug', html_url: 'https://x/7', updated_at: 't' },
        comment: {
          body: '@LiChunchuan 请看一下',
          html_url: 'https://x/7#c1',
          user: { login: 'bob' },
        },
      },
      repo: 'ihui-ai/IHUI-AI',
      ownerUserId: OWNER,
      ownerLogins: ['lichunchuan'],
    })
    expect(result.accepted).toBe(true)
    if (!result.accepted) return
    expect(result.event.route.ruleId).toBe('github.comment.mention')
    expect(result.event.addressed).toBe(true)
  })

  it('未映射事件 ⇒ unmapped_event,不猜规则', () => {
    const result = normalizeGithubWebhook({
      deliveryId: 'delivery-5',
      event: 'ping',
      action: null,
      payload: { repository: { full_name: 'ihui-ai/IHUI-AI' }, zen: 'Keep it simple' },
      repo: 'ihui-ai/IHUI-AI',
      ownerUserId: OWNER,
      ownerLogins: ['lichunchuan'],
    })
    expect(result.accepted).toBe(false)
    if (result.accepted) return
    expect(result.reason).toBe('unmapped_event')
  })

  it('workflow_run 成功不投递,失败投递', () => {
    const base = {
      repository: { full_name: 'ihui-ai/IHUI-AI' },
      sender: { login: 'github-actions[bot]' },
      workflow_run: {
        id: 900,
        name: 'CI',
        conclusion: 'success',
        html_url: 'https://x/run/900',
        updated_at: 't',
      },
    }
    const ok = normalizeGithubWebhook({
      deliveryId: 'delivery-6',
      event: 'workflow_run',
      action: 'completed',
      payload: base,
      repo: 'ihui-ai/IHUI-AI',
      ownerUserId: OWNER,
      ownerLogins: [],
    })
    expect(ok.accepted).toBe(false)
    if (!ok.accepted) expect(ok.reason).toBe('not_failure')

    const fail = normalizeGithubWebhook({
      deliveryId: 'delivery-7',
      event: 'workflow_run',
      action: 'completed',
      payload: { ...base, workflow_run: { ...base.workflow_run, conclusion: 'failure' } },
      repo: 'ihui-ai/IHUI-AI',
      ownerUserId: OWNER,
      ownerLogins: [],
    })
    expect(fail.accepted).toBe(true)
    if (fail.accepted) expect(fail.event.route.ruleId).toBe('github.ci.repair')
  })

  it('同一 delivery 重复归一 ⇒ 同一 eventId(去重交给引擎)', () => {
    const input = {
      deliveryId: 'delivery-repeat',
      event: 'pull_request',
      action: 'opened',
      payload: prPayload(),
      repo: 'ihui-ai/IHUI-AI',
      ownerUserId: OWNER,
      ownerLogins: ['lichunchuan'],
    }
    const a = normalizeGithubWebhook(input)
    const b = normalizeGithubWebhook(input)
    expect(a.accepted && b.accepted).toBe(true)
    if (!a.accepted || !b.accepted) return
    expect(a.event.eventId).toBe(b.event.eventId)
  })
})

describe('IM 回调归一化', () => {
  it('@机器人 ⇒ explicit;机主账号映射为 owner,非机主账号保留真实发送者', () => {
    const owner = normalizeImWebhook({
      platform: 'feishu',
      ownerUserId: OWNER,
      messageId: 'm-1',
      chatId: 'c-1',
      senderId: 'ou-owner',
      text: '帮我看下 CI',
      mentioned: true,
      ownerAccounts: ['ou-owner'],
    })
    expect(owner.accepted).toBe(true)
    if (!owner.accepted) return
    expect(owner.event.route.ruleId).toBe('im.message.mention')
    expect(owner.event.addressed).toBe(true)
    expect(owner.event.actorId).toBe(OWNER)

    const stranger = normalizeImWebhook({
      platform: 'feishu',
      ownerUserId: OWNER,
      messageId: 'm-2',
      chatId: 'c-1',
      senderId: 'ou-stranger',
      text: '帮我看下 CI',
      mentioned: true,
      ownerAccounts: ['ou-owner'],
    })
    expect(stranger.accepted).toBe(true)
    if (!stranger.accepted) return
    expect(stranger.event.actorId).toBe('ou-stranger')
  })

  it('未 @ ⇒ 走 inferred 兜底,不给别人开工单', () => {
    const result = normalizeImWebhook({
      platform: 'feishu',
      ownerUserId: OWNER,
      messageId: 'm-3',
      chatId: 'c-2',
      senderId: 'ou-owner',
      text: '普通讨论',
      mentioned: false,
      ownerAccounts: ['ou-owner'],
    })
    expect(result.accepted).toBe(true)
    if (!result.accepted) return
    expect(result.event.route.ruleId).toBe('im.message.inbox')
    expect(result.event.addressed).toBe(false)
    expect(result.event.fromBot).toBe(true)
  })

  it('缺消息 id ⇒ missing_event_id(fail-closed)', () => {
    const result = normalizeImWebhook({
      platform: 'feishu',
      ownerUserId: OWNER,
      messageId: '',
      chatId: 'c-2',
      senderId: 'ou-owner',
      text: 'x',
      mentioned: true,
      ownerAccounts: ['ou-owner'],
    })
    expect(result.accepted).toBe(false)
    if (result.accepted) return
    expect(result.reason).toBe('missing_event_id')
  })
})

describe('轮询条目归一化', () => {
  it('扫描键稳定 ⇒ 同一条目每轮同 eventId,重复由引擎判 duplicate', () => {
    const input = {
      source: 'issue' as const,
      key: 'issue:88',
      title: 'repair me',
      url: 'https://x/88',
      repo: 'ihui-ai/IHUI-AI',
      ownerUserId: OWNER,
    }
    const a = normalizePollItem(input)
    const b = normalizePollItem(input)
    expect(a.accepted && b.accepted).toBe(true)
    if (!a.accepted || !b.accepted) return
    expect(a.event.eventId).toBe('poll:ihui-ai/IHUI-AI:issue:88')
    expect(b.event.eventId).toBe(a.event.eventId)
    expect(a.event.route.ruleId).toBe('poll.issue.repair')
  })

  it('未知轮询源 ⇒ unmapped_event', () => {
    const result = normalizePollItem({
      source: 'workflow-run' as const,
      key: 'run:1',
      title: 'CI',
      repo: 'ihui-ai/IHUI-AI',
      ownerUserId: OWNER,
      routes: [],
    })
    expect(result.accepted).toBe(false)
    if (result.accepted) return
    expect(result.reason).toBe('unmapped_event')
  })
})

describe('映射配置单一真源', () => {
  it('默认表覆盖三种来源', () => {
    expect(new Set(DEFAULT_SOURCE_EVENT_ROUTES.map((r) => r.source))).toEqual(
      new Set(['github-webhook', 'im-callback', 'poll']),
    )
  })

  it('env 覆盖整表替换且精确 action 优先', () => {
    const routes = parseSourceEventRoutes(
      JSON.stringify([
        {
          source: 'github-webhook',
          event: 'issues',
          ruleId: 'custom.issue',
          domain: 'custom',
          strength: 'inferred',
        },
      ]),
    )
    expect(routes).toHaveLength(1)
    const picked = selectSourceEventRoute(routes, {
      source: 'github-webhook',
      event: 'issues',
      action: 'opened',
      mentioned: false,
    })
    expect(picked?.ruleId).toBe('custom.issue')
  })

  it('非法配置抛错(fail-closed),不静默降级', () => {
    expect(() => parseSourceEventRoutes('{')).toThrow()
    expect(() => parseSourceEventRoutes(JSON.stringify([{ source: 'email' }]))).toThrow()
    expect(() =>
      parseSourceEventRoutes(
        JSON.stringify([
          { source: 'poll', event: 'issue', ruleId: 'r', domain: 'd', strength: 'maybe' },
        ]),
      ),
    ).toThrow()
  })
})

describe('toIncomingTrigger 唯一拼装点', () => {
  it('字段一一对应', () => {
    const result = normalizePollItem({
      source: 'issue' as const,
      key: 'issue:1',
      title: 'x',
      repo: 'o/r',
      ownerUserId: OWNER,
    })
    expect(result.accepted).toBe(true)
    if (!result.accepted) return
    const trigger = toIncomingTrigger(result.event, 'poll:github:o/r')
    expect(trigger).toMatchObject({
      id: 'poll:o/r:issue:1',
      sourceId: 'poll:github:o/r',
      threadId: 'poll:o/r:issue:1',
      actorId: OWNER,
      addressed: false,
      fromBot: true,
    })
    expect(trigger.text.startsWith('[issue-repair] poll.issue.repair:')).toBe(true)
  })
})

describe('幂等键按来源写死', () => {
  it('每个来源各有一个键函数,空键 fail-closed', () => {
    expect(githubDeliveryEventId(' d-1 ')).toBe('github:d-1')
    expect(githubDeliveryEventId('')).toBeNull()
    expect(imStableEventId('feishu', 'm-1')).toBe('im:feishu:m-1')
    expect(imStableEventId('', 'm-1')).toBeNull()
    expect(pollStableEventId('ihui-ai/IHUI-AI', ' issue:1 ')).toBe('poll:ihui-ai/IHUI-AI:issue:1')
    expect(pollStableEventId('ihui-ai/IHUI-AI', '')).toBeNull()
  })
})

describe('触发元数据', () => {
  it('GitHub 归一化携带时间/地址/渠道/来源元数据', () => {
    const result = normalizeGithubWebhook({
      deliveryId: 'delivery-meta',
      event: 'pull_request',
      action: 'opened',
      payload: prPayload(),
      repo: 'ihui-ai/IHUI-AI',
      ownerUserId: OWNER,
      ownerLogins: ['lichunchuan'],
    })
    expect(result.accepted).toBe(true)
    if (!result.accepted) return
    expect(result.event.at).toBe('2026-11-07T10:00:00Z')
    expect(result.event.url).toBe('https://github.com/ihui-ai/IHUI-AI/pull/42')
    expect(result.event.channel).toEqual({
      threadId: 'github:ihui-ai/IHUI-AI:pull_request:42',
      url: 'https://github.com/ihui-ai/IHUI-AI',
    })
    expect(result.event.meta).toMatchObject({
      source: 'github-webhook',
      deliveryId: 'delivery-meta',
      repo: 'ihui-ai/IHUI-AI',
      kind: 'pull_request',
      number: '42',
    })
    const trigger = toIncomingTrigger(result.event, 'github-webhook')
    expect(trigger).toMatchObject({
      id: 'github:delivery-meta',
      at: '2026-11-07T10:00:00Z',
      url: 'https://github.com/ihui-ai/IHUI-AI/pull/42',
      channel: { threadId: 'github:ihui-ai/IHUI-AI:pull_request:42' },
    })
  })

  it('IM / 轮询没有上游时间时补 ISO 时刻,并带来源元数据', () => {
    const im = normalizeImWebhook({
      platform: 'feishu',
      ownerUserId: OWNER,
      messageId: 'm-meta',
      chatId: 'c-meta',
      senderId: 'ou-owner',
      text: 'x',
      mentioned: false,
      ownerAccounts: ['ou-owner'],
    })
    expect(im.accepted).toBe(true)
    if (!im.accepted) return
    expect(Number.isNaN(Date.parse(im.event.at))).toBe(false)
    expect(im.event.meta).toMatchObject({
      source: 'im-callback',
      platform: 'feishu',
      messageId: 'm-meta',
    })

    const poll = normalizePollItem({
      source: 'code-scanning',
      key: 'alert:3',
      title: 'xss',
      url: 'https://x/3',
      repo: 'ihui-ai/IHUI-AI',
      ownerUserId: OWNER,
    })
    expect(poll.accepted).toBe(true)
    if (!poll.accepted) return
    expect(Number.isNaN(Date.parse(poll.event.at))).toBe(false)
    expect(poll.event.url).toBe('https://x/3')
    expect(poll.event.meta).toMatchObject({
      source: 'poll',
      repo: 'ihui-ai/IHUI-AI',
      key: 'alert:3',
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
