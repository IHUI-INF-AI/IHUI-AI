// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 自动修复结果 → PR 的幂等开出(D30②)。全 mock transport,零网络、零数据库。
import { describe, it, expect } from 'vitest'

import { GithubAppError } from '../src/services/github-app/jwt'
import type {
  GithubApiRequest,
  GithubApiResponse,
  GithubTransport,
  InstallationToken,
} from '../src/services/github-app/jwt'
import type { InstallationTokenProvider } from '../src/services/github-app/jwt'
import {
  openPullRequestForFix,
  openPullRequestForFixWithInstallation,
  renderPrBody,
  toRepoCoordinates,
  validateFixResult,
} from '../src/services/github-app/pr-creator'
import type { FixResultInput, RepoCoordinates } from '../src/services/github-app/pr-creator'

/** 上游响应体里可能混进的凭据串:任何断言都不允许它出现在结论里 */
const SENTINEL = 'ghp_SENTINEL_upstream_body_must_never_leak'

const COORD: RepoCoordinates = { owner: 'IHUI-INF-AI', repo: 'IHUI-AI', installationId: 4242 }

function makeInput(overrides: Partial<FixResultInput> = {}): FixResultInput {
  return {
    headRef: 'ihui-autofix/D30-7c1a',
    baseRef: 'main',
    title: 'fix(api): 自动修复空指针',
    body: '根据复现用例定位到 `parse()` 未判空,已补守卫。',
    commitSha: '7c1a9f2',
    coordinates: COORD,
    ...overrides,
  }
}

interface Harness {
  calls: GithubApiRequest[]
  transport: GithubTransport
}

function makeTransport(reply: (req: GithubApiRequest) => GithubApiResponse): Harness {
  const calls: GithubApiRequest[] = []
  const transport: GithubTransport = async (request) => {
    calls.push(request)
    return reply(request)
  }
  return { calls, transport }
}

/** 把发出去的请求体收成可断言的对象(GithubApiRequest.body 是 unknown,不得随处 as any) */
function sentBody(req: GithubApiRequest | undefined): Record<string, unknown> {
  const body = req?.body
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
}

function makeProvider(
  behavior: 'ok' | 'missing-credentials' | 'rejected' = 'ok',
): InstallationTokenProvider {
  const token: InstallationToken = {
    token: 'ghs_injected_fake_token',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    installationId: COORD.installationId,
  }
  return {
    async get() {
      if (behavior === 'missing-credentials') {
        throw new GithubAppError(
          'app_credentials_not_configured',
          'GitHub App 凭据未配置(GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY)',
        )
      }
      if (behavior === 'rejected') {
        throw new GithubAppError('installation_token_rejected', '换取 token 被拒(status=401)', 401)
      }
      return token
    },
    peek: () => token,
    invalidate: () => undefined,
  }
}

function prPayload(
  number: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    number,
    html_url: `https://github.com/${COORD.owner}/${COORD.repo}/pull/${number}`,
    state: 'open',
    base: { ref: 'main' },
    head: { ref: 'ihui-autofix/D30-7c1a' },
    ...overrides,
  }
}

describe('openPullRequestForFix — 新建路径', () => {
  it('① 无既有 open PR 时 POST 新建,并回 html_url + number', async () => {
    const { calls, transport } = makeTransport((req) => {
      if (req.method === 'GET') return { status: 200, body: [] }
      return { status: 201, body: prPayload(101) }
    })

    const outcome = await openPullRequestForFix({ transport }, makeInput())

    expect(outcome).toMatchObject({
      status: 'created',
      number: 101,
      htmlUrl: `https://github.com/${COORD.owner}/${COORD.repo}/pull/101`,
      headRef: 'ihui-autofix/D30-7c1a',
      baseRef: 'main',
      commitSha: '7c1a9f2',
    })
    expect(calls.map((c) => c.method)).toEqual(['GET', 'POST'])
    const post = calls[1]
    expect(post?.path).toBe(`/repos/${COORD.owner}/${COORD.repo}/pulls`)
    expect(sentBody(post)).toMatchObject({
      head: 'ihui-autofix/D30-7c1a',
      base: 'main',
      title: 'fix(api): 自动修复空指针',
    })
    expect(String(sentBody(post)['body'])).toContain('7c1a9f2')
  })

  it('幂等查询按 head=owner:branch 过滤(否则同 head 的 PR 查不到就会重复建)', async () => {
    const { calls, transport } = makeTransport(() => ({ status: 200, body: [] }))
    await openPullRequestForFix({ transport }, makeInput())

    const get = calls[0]
    expect(get?.method).toBe('GET')
    expect(get?.path).toContain('state=open')
    expect(get?.path).toContain(
      `head=${encodeURIComponent(`${COORD.owner}:ihui-autofix/D30-7c1a`)}`,
    )
  })

  it('上游未回 html_url 时用坐标兜底构造,不返回空串', async () => {
    const { transport } = makeTransport((req) =>
      req.method === 'GET' ? { status: 200, body: [] } : { status: 201, body: { number: 55 } },
    )
    const outcome = await openPullRequestForFix({ transport }, makeInput())
    expect(outcome.status).toBe('created')
    if (outcome.status === 'created') {
      expect(outcome.htmlUrl).toBe(`https://github.com/${COORD.owner}/${COORD.repo}/pull/55`)
    }
  })
})

describe('openPullRequestForFix — 幂等:已存在同 head/base 的 open PR ⇒ 更新而非新建', () => {
  it('② 走 PATCH,全程零 POST', async () => {
    const { calls, transport } = makeTransport((req) => {
      if (req.method === 'GET') return { status: 200, body: [prPayload(77)] }
      return { status: 200, body: prPayload(77) }
    })

    const outcome = await openPullRequestForFix({ transport }, makeInput({ body: '更新后的正文' }))

    expect(outcome).toMatchObject({
      status: 'updated',
      number: 77,
      recoveredFromConflict: false,
    })
    const methods = calls.map((c) => c.method)
    expect(methods).toEqual(['GET', 'PATCH'])
    expect(methods).not.toContain('POST')
    expect(calls[1]?.path).toBe(`/repos/${COORD.owner}/${COORD.repo}/pulls/77`)
    expect(String(sentBody(calls[1])['body'])).toContain('更新后的正文')
  })

  it('base 分支不同的同 head open PR 不算命中(不得替人决定合并目标)', async () => {
    const { calls, transport } = makeTransport((req) => {
      if (req.method === 'GET') {
        return { status: 200, body: [prPayload(88, { base: { ref: 'release/1.2' } })] }
      }
      return { status: 201, body: prPayload(89) }
    })

    const outcome = await openPullRequestForFix({ transport }, makeInput())

    expect(outcome.status).toBe('created')
    expect(calls.map((c) => c.method)).toEqual(['GET', 'POST'])
    expect(calls[1]?.path).toBe(`/repos/${COORD.owner}/${COORD.repo}/pulls`)
  })
})

describe('openPullRequestForFix — 422 竞态回落', () => {
  it('③ 新建撞 422 时回查既有 PR 并更新,结论是 updated 而非 failed', async () => {
    let lookups = 0
    const { calls, transport } = makeTransport((req) => {
      if (req.method === 'POST') {
        // GitHub 的重复 head 422:响应体里带 message/errors,本例故意塞哨兵
        return { status: 422, body: { message: `Validation Failed ${SENTINEL}`, errors: [] } }
      }
      if (req.method === 'GET') {
        lookups += 1
        // 首查为空(竞态窗口),回查时已被别人建好
        return { status: 200, body: lookups > 1 ? [prPayload(99)] : [] }
      }
      return { status: 200, body: prPayload(99) }
    })

    const outcome = await openPullRequestForFix({ transport }, makeInput())

    expect(outcome).toMatchObject({ status: 'updated', number: 99, recoveredFromConflict: true })
    expect(calls.map((c) => c.method)).toEqual(['GET', 'POST', 'GET', 'PATCH'])
    expect(outcome.status === 'updated' ? outcome.htmlUrl : '').not.toContain(SENTINEL)
  })

  it('422 且回查仍无既有 PR ⇒ create_rejected,且 message 不含上游响应体', async () => {
    const { transport } = makeTransport((req) => {
      if (req.method === 'POST') return { status: 422, body: { message: SENTINEL } }
      return { status: 200, body: [] }
    })

    const outcome = await openPullRequestForFix({ transport }, makeInput())

    expect(outcome.status).toBe('failed')
    if (outcome.status === 'failed') {
      expect(outcome.stage).toBe('create_rejected')
      expect(outcome.upstreamStatus).toBe(422)
      expect(outcome.message).toContain('422')
      expect(outcome.message).not.toContain(SENTINEL)
    }
  })
})

describe('openPullRequestForFix — 非 2xx 的可诊断失败(不外泄上游响应体)', () => {
  it('④ 查询既有 PR 非 2xx ⇒ 不新建(避免制造重复 PR),message 只有状态码', async () => {
    const { calls, transport } = makeTransport((req) =>
      req.method === 'GET'
        ? { status: 502, body: { documentation_url: SENTINEL } }
        : { status: 201, body: prPayload(1) },
    )

    const outcome = await openPullRequestForFix({ transport }, makeInput())

    expect(outcome.status).toBe('failed')
    if (outcome.status === 'failed') {
      expect(outcome.stage).toBe('lookup_rejected')
      expect(outcome.upstreamStatus).toBe(502)
      expect(outcome.message).toContain('502')
      expect(outcome.message).not.toContain(SENTINEL)
    }
    expect(calls.map((c) => c.method)).toEqual(['GET'])
  })

  it('④ 创建非 2xx(500)⇒ create_rejected,哨兵不入 message', async () => {
    const { transport } = makeTransport((req) =>
      req.method === 'GET'
        ? { status: 200, body: [] }
        : { status: 500, body: { error: SENTINEL, token: SENTINEL } },
    )

    const outcome = await openPullRequestForFix({ transport }, makeInput())

    expect(outcome.status).toBe('failed')
    if (outcome.status === 'failed') {
      expect(outcome.stage).toBe('create_rejected')
      expect(outcome.upstreamStatus).toBe(500)
      expect(outcome.message).not.toContain(SENTINEL)
      expect(JSON.stringify(outcome)).not.toContain(SENTINEL)
    }
  })

  it('④ 更新既有 PR 被拒 ⇒ update_rejected,哨兵不入 message', async () => {
    const { transport } = makeTransport((req) => {
      if (req.method === 'GET') return { status: 200, body: [prPayload(77)] }
      return { status: 403, body: { message: `Resource not accessible ${SENTINEL}` } }
    })

    const outcome = await openPullRequestForFix({ transport }, makeInput())

    expect(outcome.status).toBe('failed')
    if (outcome.status === 'failed') {
      expect(outcome.stage).toBe('update_rejected')
      expect(outcome.upstreamStatus).toBe(403)
      expect(outcome.message).toContain('77')
      expect(outcome.message).not.toContain(SENTINEL)
    }
  })

  it('2xx 但响应形态不符 ⇒ malformed/不猜号:POST 返回非 PR 形状时判 create_rejected', async () => {
    const { transport } = makeTransport((req) =>
      req.method === 'GET'
        ? { status: 200, body: [] }
        : { status: 201, body: { unexpected: SENTINEL } },
    )
    const outcome = await openPullRequestForFix({ transport }, makeInput())
    expect(outcome.status).toBe('failed')
    if (outcome.status === 'failed') {
      expect(outcome.stage).toBe('create_rejected')
      expect(outcome.message).not.toContain(SENTINEL)
    }
  })

  it('列表响应形态不符(非数组)⇒ lookup_rejected 而不是当成"没有既有 PR"', async () => {
    const { calls, transport } = makeTransport(() => ({ status: 200, body: { items: SENTINEL } }))
    const outcome = await openPullRequestForFix({ transport }, makeInput())
    expect(outcome.status).toBe('failed')
    if (outcome.status === 'failed') expect(outcome.stage).toBe('lookup_rejected')
    expect(calls.map((c) => c.method)).toEqual(['GET'])
  })
})

describe('缺凭据 / 缺坐标 ⇒ 早失败且可诊断', () => {
  it('⑤ App 凭据未配置 ⇒ token_unavailable,且一个 HTTP 请求都没发出', async () => {
    const { calls, transport } = makeTransport(() => ({ status: 201, body: prPayload(1) }))
    const outcome = await openPullRequestForFixWithInstallation(
      { transport, tokenProvider: makeProvider('missing-credentials') },
      makeInput(),
    )

    expect(outcome.status).toBe('failed')
    if (outcome.status === 'failed') {
      expect(outcome.stage).toBe('token_unavailable')
      expect(outcome.message).toContain('凭据未配置')
    }
    expect(calls).toHaveLength(0)
  })

  it('⑤ installation token 被拒 ⇒ token_unavailable,并带上游状态码', async () => {
    const { calls, transport } = makeTransport(() => ({ status: 201, body: prPayload(1) }))
    const outcome = await openPullRequestForFixWithInstallation(
      { transport, tokenProvider: makeProvider('rejected') },
      makeInput(),
    )
    expect(outcome.status).toBe('failed')
    if (outcome.status === 'failed') {
      expect(outcome.stage).toBe('token_unavailable')
      expect(outcome.message).toContain('401')
    }
    expect(calls).toHaveLength(0)
  })

  it('⑤ token 取到后正常走幂等流程(鉴权头由 withInstallationAuth 挂上)', async () => {
    const { calls, transport } = makeTransport((req) =>
      req.method === 'GET' ? { status: 200, body: [] } : { status: 201, body: prPayload(123) },
    )
    const outcome = await openPullRequestForFixWithInstallation(
      { transport, tokenProvider: makeProvider('ok') },
      makeInput(),
    )
    expect(outcome).toMatchObject({ status: 'created', number: 123 })
    for (const call of calls) {
      expect(call.headers['Authorization']).toBe('Bearer ghs_injected_fake_token')
    }
  })

  it('⑤ 仓库全名形态不符 / installationId 缺失 ⇒ 坐标组装返回 null', () => {
    expect(toRepoCoordinates('just-a-repo', 1)).toBeNull()
    expect(toRepoCoordinates('a/b/c', 1)).toBeNull()
    expect(toRepoCoordinates('  /  ', 1)).toBeNull()
    expect(toRepoCoordinates('o/r', null)).toBeNull()
    expect(toRepoCoordinates('o/r', undefined)).toBeNull()
    expect(toRepoCoordinates('o/r', 0)).toBeNull()
    expect(toRepoCoordinates('o/r', -3)).toBeNull()
    expect(toRepoCoordinates('o/r', 1.5)).toBeNull()
    expect(toRepoCoordinates('o/r', 7)).toEqual({ owner: 'o', repo: 'r', installationId: 7 })
  })

  it('⑤ 必填项为空 ⇒ invalid_input,不发请求', async () => {
    const { calls, transport } = makeTransport(() => ({ status: 201, body: prPayload(1) }))
    for (const bad of [
      makeInput({ headRef: '   ' }),
      makeInput({ baseRef: '' }),
      makeInput({ title: ' ' }),
      makeInput({ commitSha: '' }),
      makeInput({ title: 'x'.repeat(300) }),
    ]) {
      const outcome = await openPullRequestForFix({ transport }, bad)
      expect(outcome.status).toBe('failed')
      if (outcome.status === 'failed') expect(outcome.stage).toBe('invalid_input')
    }
    expect(calls).toHaveLength(0)
  })
})

describe('纯函数出口', () => {
  it('validateFixResult 只报字段名,不回显内容', () => {
    expect(validateFixResult(makeInput())).toBeNull()
    expect(validateFixResult(makeInput({ headRef: '' }))).toContain('headRef')
  })

  it('renderPrBody 追加 sha 且幂等(重复调用不叠加)', () => {
    const once = renderPrBody('正文', 'abc123')
    expect(once).toContain('abc123')
    expect(renderPrBody(once, 'abc123')).toBe(once)
    expect(renderPrBody('', 'abc123')).toBe('自动修复提交:abc123')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
