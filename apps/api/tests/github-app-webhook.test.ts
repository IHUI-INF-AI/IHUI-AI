// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { createHmac } from 'node:crypto'

import githubAppRoutes, {
  GITHUB_APP_EXPLICIT_ROUTES,
  HEALTH_PATH,
  INSTALLATIONS_PATH,
  WEBHOOK_PATH,
} from '../src/routes/github-app'
import { createDeliveryDeduper } from '../src/services/github-app/events'
import type {
  GithubApiRequest,
  GithubApiResponse,
  GithubTransport,
} from '../src/services/github-app/jwt'
import type { ReviewPrompt, TextCompletion } from '../src/services/github-app/pr-review'

const SECRET = 'whsec_unit_test'
const BASE = '/api/github-app'

interface Recorded extends GithubApiRequest {
  at: number
}

function makeTransport(replyFor: (req: GithubApiRequest) => GithubApiResponse) {
  const calls: Recorded[] = []
  const transport: GithubTransport = async (request) => {
    calls.push({ ...request, at: calls.length })
    return replyFor(request)
  }
  return { calls, transport }
}

const PR_FILES_REPLY: GithubApiResponse = {
  status: 200,
  body: [
    {
      filename: 'src/a.ts',
      status: 'modified',
      additions: 3,
      deletions: 1,
      changes: 4,
      patch: '@@ -1,3 +1,5 @@\n+const x = 1',
    },
  ],
}

const REVIEW_JSON = JSON.stringify({
  event: 'REQUEST_CHANGES',
  body: '总体结论:有一处空值未防护。',
  comments: [{ path: 'src/a.ts', line: 1, level: 'WARNING', body: '请补可选链' }],
})

/** GET 拿 diff、POST 提交 —— 大多数派发用例都要这个形状 */
function replyByMethod(req: GithubApiRequest): GithubApiResponse {
  return req.method === 'POST' ? { status: 201, body: { id: 777 } } : PR_FILES_REPLY
}

function buildApp({
  transport,
  textModel = null,
  webhookSecret = SECRET,
  deduper = createDeliveryDeduper(),
}: {
  transport?: GithubTransport
  textModel?: TextCompletion | null
  webhookSecret?: string | null
  deduper?: ReturnType<typeof createDeliveryDeduper>
} = {}): { server: FastifyInstance } {
  const server = Fastify({ logger: false })
  const holder = { server }
  void server.register(githubAppRoutes, {
    prefix: BASE,
    transport,
    textModel,
    webhookSecret,
    deduper,
    // 单测显式禁用持久层:不触碰真实 db 模块链(D15②);落库行为在 github-app-persistence.test.ts 覆盖
    store: null,
  })
  return holder
}

function sign(body: string, secret: string = SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`
}

function post(
  server: FastifyInstance,
  event: string,
  payload: unknown,
  delivery: string,
  secret: string = SECRET,
) {
  const body = JSON.stringify(payload)
  return server.inject({
    method: 'POST',
    url: `${BASE}${WEBHOOK_PATH}`,
    headers: {
      'content-type': 'application/json',
      'x-github-event': event,
      'x-github-delivery': delivery,
      'x-hub-signature-256': sign(body, secret),
    },
    payload: body,
  })
}

function pullRequestPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    action: 'opened',
    number: 7,
    pull_request: {
      number: 7,
      title: 'feat: 示例改动',
      state: 'open',
      draft: false,
      head: { ref: 'feature/x', sha: 'abc123' },
      base: { ref: 'main', sha: 'def456' },
      user: { login: 'dev' },
      body: '描述',
    },
    repository: { full_name: 'octo/demo', name: 'demo', owner: { login: 'octo' } },
    installation: { id: 9001 },
    ...overrides,
  }
}

function issueCommentPayload(
  commentBody: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    action: 'created',
    issue: {
      number: 7,
      title: 'feat: 示例改动',
      state: 'open',
      pull_request: { url: 'https://github.com/octo/demo/pull/7' },
    },
    comment: { id: 555, body: commentBody, user: { login: 'dev' } },
    repository: { full_name: 'octo/demo', name: 'demo' },
    installation: { id: 9001 },
    ...overrides,
  }
}

const textModelReturning =
  (text: string): TextCompletion =>
  async () =>
    text

describe('github-app webhook:鉴权面(fail-closed)', () => {
  it('路由清单只有显式固定路径,零参数段 / 零通配', async () => {
    const urls = GITHUB_APP_EXPLICIT_ROUTES.map((route) => route.url)
    expect(urls.sort()).toEqual([HEALTH_PATH, INSTALLATIONS_PATH, WEBHOOK_PATH].sort())
    for (const url of urls) expect(url).not.toMatch(/[:*]/)

    const { server } = buildApp({ transport: makeTransport(() => PR_FILES_REPLY).transport })
    await server.ready()
    const tree = server.printRoutes()
    expect(tree).toContain('webhook')
    expect(tree).toContain('health')
    expect(tree).not.toMatch(/:[A-Za-z_]/)
    expect(tree).not.toMatch(/\*/)
  })

  it('secret 未配置 → 503,绝不放行', async () => {
    const { server } = buildApp({
      webhookSecret: null,
      transport: makeTransport(() => PR_FILES_REPLY).transport,
    })
    await server.ready()
    const response = await post(server, 'ping', {}, 'd-unconfigured')
    expect(response.statusCode).toBe(503)
    expect(response.json()).toMatchObject({ code: 503, data: null })
  })

  it('缺签名头的未鉴权请求得到 4xx 而不是 500', async () => {
    const { calls, transport } = makeTransport(() => PR_FILES_REPLY)
    const { server } = buildApp({ transport })
    await server.ready()
    const body = JSON.stringify(pullRequestPayload())
    const response = await server.inject({
      method: 'POST',
      url: `${BASE}${WEBHOOK_PATH}`,
      headers: { 'content-type': 'application/json', 'x-github-event': 'pull_request' },
      payload: body,
    })
    expect(response.statusCode).toBe(401)
    expect(response.statusCode).toBeLessThan(500)
    expect(calls).toHaveLength(0)
    const payload = response.json() as { code: number; message: string; data: unknown }
    expect(payload.code).toBe(401)
    expect(payload).toHaveProperty('data', null)
    expect(JSON.stringify(payload)).not.toContain('whsec')
  })

  it.each([
    ['签名与 body 不符', 'sha256=' + 'a'.repeat(64)],
    ['头形态非法', 'sha1=deadbeef'],
  ])('%s → 401', async (_label, header) => {
    const { server } = buildApp({ transport: makeTransport(() => PR_FILES_REPLY).transport })
    await server.ready()
    const body = JSON.stringify(pullRequestPayload())
    const response = await server.inject({
      method: 'POST',
      url: `${BASE}${WEBHOOK_PATH}`,
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'pull_request',
        'x-github-delivery': 'd-bad-sig',
        'x-hub-signature-256': header,
      },
      payload: body,
    })
    expect(response.statusCode).toBe(401)
  })

  it('/health 不需要任何凭据即可访问,且只回布尔状态', async () => {
    const { server } = buildApp({ transport: makeTransport(() => PR_FILES_REPLY).transport })
    await server.ready()
    const response = await server.inject({ method: 'GET', url: `${BASE}${HEALTH_PATH}` })
    expect(response.statusCode).toBe(200)
    const data = (response.json() as { data: Record<string, unknown> }).data
    // /health 报的是**真实 env** 配置态(与路由内注入的测试 secret 无关),且只回布尔/清单
    expect(typeof data['webhookSecretConfigured']).toBe('boolean')
    expect(typeof data['appCredentialsConfigured']).toBe('boolean')
    expect(data['handledEvents']).toEqual(['ping', 'pull_request', 'issue_comment'])
    expect(data['explicitRoutes']).toEqual(expect.arrayContaining([WEBHOOK_PATH, HEALTH_PATH]))
    expect(response.body).not.toContain(SECRET)
    expect(response.body).not.toContain('PRIVATE KEY')
  })
})

describe('github-app webhook:事件派发', () => {
  let deduper: ReturnType<typeof createDeliveryDeduper>
  beforeEach(() => {
    deduper = createDeliveryDeduper()
  })

  it('白名单外事件 → accepted:false / unsupported_event', async () => {
    const { calls, transport } = makeTransport(() => PR_FILES_REPLY)
    const { server } = buildApp({ transport, deduper })
    await server.ready()
    const response = await post(server, 'workflow_run', { action: 'completed' }, 'd-unsupported')
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      code: 0,
      data: { accepted: false, reason: 'unsupported_event' },
    })
    expect(calls).toHaveLength(0)
  })

  it('事件体不合 schema → 400(不带病派发)', async () => {
    const { transport } = makeTransport(() => PR_FILES_REPLY)
    const { server } = buildApp({ transport, deduper })
    await server.ready()
    const response = await post(server, 'pull_request', { action: 'opened' }, 'd-invalid')
    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: 400, data: null })
  })

  it('ping → pong(连通性自检)', async () => {
    const { transport } = makeTransport(() => PR_FILES_REPLY)
    const { server } = buildApp({ transport, deduper })
    await server.ready()
    const response = await post(server, 'ping', { zen: 'Keep it logically awesome.' }, 'd-ping')
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ code: 0, data: { accepted: true, reason: 'pong' } })
  })

  it('同一 delivery guid 重投只处理一次', async () => {
    const { calls, transport } = makeTransport(() =>
      calls.some((c) => c.method === 'POST') ? { status: 201, body: { id: 1 } } : PR_FILES_REPLY,
    )
    const { server } = buildApp({ transport, textModel: textModelReturning(REVIEW_JSON), deduper })
    await server.ready()

    const first = await post(server, 'pull_request', pullRequestPayload(), 'd-retry')
    expect(first.statusCode).toBe(200)
    const callsAfterFirst = calls.length
    expect(callsAfterFirst).toBeGreaterThan(0)

    const second = await post(server, 'pull_request', pullRequestPayload(), 'd-retry')
    expect(second.statusCode).toBe(200)
    expect(second.json()).toMatchObject({
      code: 0,
      data: { accepted: false, reason: 'duplicate_delivery' },
    })
    expect(calls).toHaveLength(callsAfterFirst)
  })

  it('非 review 类 action 不触发评审', async () => {
    const { calls, transport } = makeTransport(() => PR_FILES_REPLY)
    const { server } = buildApp({ transport, textModel: textModelReturning(REVIEW_JSON), deduper })
    await server.ready()
    const response = await post(
      server,
      'pull_request',
      pullRequestPayload({ action: 'labeled' }),
      'd-labeled',
    )
    expect(response.json()).toMatchObject({
      code: 0,
      data: { accepted: false, reason: 'action_not_reviewed', action: 'labeled' },
    })
    expect(calls).toHaveLength(0)
  })

  it('draft PR 被跳过(不打扰还在写的作者)', async () => {
    const { calls, transport } = makeTransport(() => PR_FILES_REPLY)
    const { server } = buildApp({ transport, textModel: textModelReturning(REVIEW_JSON), deduper })
    await server.ready()
    const payload = pullRequestPayload()
    ;(payload['pull_request'] as Record<string, unknown>)['draft'] = true
    const response = await post(server, 'pull_request', payload, 'd-draft')
    expect(response.json()).toMatchObject({
      code: 0,
      data: { accepted: true, outcome: { status: 'skipped', reason: 'pull_request_is_draft' } },
    })
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })

  it('缺 installation → accepted:false 并给出原因,不是 500', async () => {
    const { transport } = makeTransport(() => PR_FILES_REPLY)
    const payload = pullRequestPayload()
    delete payload['installation']
    const { server } = buildApp({ transport, textModel: textModelReturning(REVIEW_JSON), deduper })
    await server.ready()
    const response = await post(server, 'pull_request', payload, 'd-no-installation')
    expect(response.statusCode).toBeLessThan(500)
    expect(response.json()).toMatchObject({
      code: 0,
      data: { accepted: false, reason: 'no_installation_or_repo' },
    })
  })

  it('pull_request 全链:取 diff → 出结论 → 回写 review', async () => {
    const { calls, transport } = makeTransport((req) => {
      if (req.method === 'POST') return { status: 201, body: { id: 777 } }
      return PR_FILES_REPLY
    })
    const prompts: ReviewPrompt[] = []
    const textModel: TextCompletion = async (prompt) => {
      prompts.push(prompt)
      return REVIEW_JSON
    }
    const { server } = buildApp({ transport, textModel, deduper })
    await server.ready()

    const response = await post(server, 'pull_request', pullRequestPayload(), 'd-review')
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      code: 0,
      data: {
        accepted: true,
        event: 'pull_request',
        outcome: { status: 'posted', reviewId: 777, findings: 1 },
      },
    })

    const get = calls.find((c) => c.method === 'GET')
    expect(get?.path).toBe('/repos/octo/demo/pulls/7/files?per_page=100')
    const submit = calls.find((c) => c.method === 'POST')
    expect(submit?.path).toBe('/repos/octo/demo/pulls/7/reviews')
    expect(submit?.body).toMatchObject({ commit_id: 'abc123', event: 'REQUEST_CHANGES' })
    const submittedBody = submit?.body as { comments: Array<{ path: string; line: number }> }
    expect(submittedBody.comments[0]).toMatchObject({ path: 'src/a.ts', line: 1 })
    expect(prompts[0]?.user).toContain('src/a.ts')
  })

  it('模型输出不是 JSON 时降级为 COMMENT 而不是失败', async () => {
    const { calls, transport } = makeTransport(replyByMethod)
    const { server } = buildApp({
      transport,
      textModel: textModelReturning('这看着还行,但没给 JSON'),
      deduper,
    })
    await server.ready()
    const response = await post(server, 'pull_request', pullRequestPayload(), 'd-degraded')
    expect(response.json()).toMatchObject({
      code: 0,
      data: { accepted: true, outcome: { status: 'posted', degraded: true, findings: 0 } },
    })
    const submit = calls.find((c) => c.method === 'POST')
    const body = submit?.body as { event: string; body: string }
    expect(body.event).toBe('COMMENT')
    expect(body.body).toContain('这看着还行')
  })

  it('模型抛错收敛为 failed(stage=model),路由不返 500', async () => {
    const { transport } = makeTransport(() => PR_FILES_REPLY)
    const boom: TextCompletion = async () => {
      throw new Error('ai-service /llm/complete 调用失败(status=503)')
    }
    const { server } = buildApp({ transport, textModel: boom, deduper })
    await server.ready()
    const response = await post(server, 'pull_request', pullRequestPayload(), 'd-model-fail')
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      code: 0,
      data: { accepted: true, outcome: { status: 'failed', stage: 'model' } },
    })
  })

  it('模型臆造 diff 里没有的文件路径时,该条行级评论被丢掉', async () => {
    const { calls, transport } = makeTransport(replyByMethod)
    const hallucinated = JSON.stringify({
      event: 'REQUEST_CHANGES',
      body: '结论',
      comments: [
        { path: 'src/不存在的文件.ts', line: 99, level: 'CRITICAL', body: '编的' },
        { path: 'src/a.ts', line: 1, level: 'WARNING', body: '真的' },
      ],
    })
    const { server } = buildApp({ transport, textModel: textModelReturning(hallucinated), deduper })
    await server.ready()
    await post(server, 'pull_request', pullRequestPayload(), 'd-grounding')
    const submit = calls.find((c) => c.method === 'POST')
    const body = submit?.body as { comments: Array<{ path: string }> }
    expect(body.comments).toHaveLength(1)
    expect(body.comments[0]?.path).toBe('src/a.ts')
  })

  it('@机器人 评论:命中提及则回帖', async () => {
    const { calls, transport } = makeTransport(() =>
      calls.some((c) => c.method === 'POST') ? { status: 201, body: { id: 321 } } : PR_FILES_REPLY,
    )
    const { server } = buildApp({
      transport,
      textModel: textModelReturning('这是回复正文'),
      deduper,
    })
    await server.ready()
    const response = await post(
      server,
      'issue_comment',
      issueCommentPayload('@ihui-ai-bot 帮我看下这次改动的风险'),
      'd-mention',
    )
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      code: 0,
      data: {
        accepted: true,
        event: 'issue_comment',
        outcome: { status: 'replied', commentId: 321 },
      },
    })
    const submit = calls.find((c) => c.method === 'POST')
    expect(submit?.path).toBe('/repos/octo/demo/issues/7/comments')
    const body = submit?.body as { body: string }
    expect(body.body).toContain('这是回复正文')
    expect(body.body).toContain('由 IHUI AI(智汇AI)GitHub App 自动生成')
  })

  it('中文提及 @智汇AI 同样命中', async () => {
    const { calls, transport } = makeTransport(replyByMethod)
    const { server } = buildApp({ transport, textModel: textModelReturning('收到'), deduper })
    await server.ready()
    const response = await post(
      server,
      'issue_comment',
      issueCommentPayload('CC @智汇AI 解释一下这个 PR'),
      'd-cn-mention',
    )
    expect(response.json()).toMatchObject({
      code: 0,
      data: { accepted: true, outcome: { status: 'replied', requestKind: 'explain' } },
    })
    const submit = calls.find((c) => c.method === 'POST')
    expect(submit?.path).toBe('/repos/octo/demo/issues/7/comments')
  })

  it('代码块里的 @ihui 不算呼叫', async () => {
    const { calls, transport } = makeTransport(() => PR_FILES_REPLY)
    const { server } = buildApp({ transport, textModel: textModelReturning('x'), deduper })
    await server.ready()
    const response = await post(
      server,
      'issue_comment',
      issueCommentPayload('示例:\n```bash\ncurl -u @ihui\n```\n没有真的叫人'),
      'd-fence',
    )
    expect(response.json()).toMatchObject({
      code: 0,
      data: { accepted: false, reason: 'no_mention' },
    })
    expect(calls).toHaveLength(0)
  })

  it('机器人自己的评论不自触发', async () => {
    const { calls, transport } = makeTransport(() => PR_FILES_REPLY)
    const { server } = buildApp({ transport, textModel: textModelReturning('x'), deduper })
    await server.ready()
    const response = await post(
      server,
      'issue_comment',
      issueCommentPayload('@ihui-ai-bot 再看一下', {
        comment: { id: 1, body: '@ihui-ai-bot 再看一下', user: { login: 'dependabot[bot]' } },
      }),
      'd-bot-author',
    )
    expect(response.json()).toMatchObject({
      code: 0,
      data: { accepted: false, reason: 'author_is_bot' },
    })
    expect(calls).toHaveLength(0)
  })

  it('edited 动作不处理(只接 created)', async () => {
    const { calls, transport } = makeTransport(() => PR_FILES_REPLY)
    const { server } = buildApp({ transport, textModel: textModelReturning('x'), deduper })
    await server.ready()
    const response = await post(
      server,
      'issue_comment',
      issueCommentPayload('@ihui-ai-bot 看风险', { action: 'edited' }),
      'd-edited',
    )
    expect(response.json()).toMatchObject({
      code: 0,
      data: { accepted: false, reason: 'not_created_action' },
    })
    expect(calls).toHaveLength(0)
  })

  it('纯 issue(非 PR 讨论)不处理', async () => {
    const { transport } = makeTransport(() => PR_FILES_REPLY)
    const { server } = buildApp({ transport, textModel: textModelReturning('x'), deduper })
    await server.ready()
    const payload = issueCommentPayload('@ihui-ai-bot 你好')
    delete (payload['issue'] as Record<string, unknown>)['pull_request']
    const response = await post(server, 'issue_comment', payload, 'd-issue-only')
    expect(response.json()).toMatchObject({
      code: 0,
      data: { accepted: false, reason: 'not_discussion_on_pr' },
    })
  })

  it('文本模型未接线时明确 skipped,不静默成功', async () => {
    const { transport } = makeTransport(() => PR_FILES_REPLY)
    const { server } = buildApp({ transport, textModel: null, deduper })
    await server.ready()
    const response = await post(
      server,
      'issue_comment',
      issueCommentPayload('@ihui-ai-bot 看风险'),
      'd-no-model',
    )
    expect(response.json()).toMatchObject({
      code: 0,
      data: {
        accepted: true,
        outcome: { status: 'skipped', reason: 'comment_handler_not_configured' },
      },
    })
  })

  it('GitHub API 调用失败时收敛为 failed(stage=diff),仍返回 2xx', async () => {
    const { transport } = makeTransport(() => ({
      status: 401,
      body: { message: 'Bad credentials' },
    }))
    const { server } = buildApp({ transport, textModel: textModelReturning(REVIEW_JSON), deduper })
    await server.ready()
    const response = await post(server, 'pull_request', pullRequestPayload(), 'd-diff-fail')
    expect(response.statusCode).toBe(200)
    const outcome = (
      response.json() as { data: { outcome: { status: string; stage: string; message: string } } }
    ).data.outcome
    expect(outcome.status).toBe('failed')
    expect(outcome.stage).toBe('diff')
    expect(outcome.message).not.toContain('Bad credentials')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
