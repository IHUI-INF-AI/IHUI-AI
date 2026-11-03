// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WP-8③ 出口对账:默认传输必须带着**宿主凭据**去问独立校验端点。
 *
 * 立票事实(2026-09-26 端到端取证):`/api/agent/goal-verify` 不在 ai-service 的
 * `JWT_PUBLIC_PATHS` 里,匿名 curl 一律 401。这不是缺陷 —— 把它设成公开等于让任何人
 * 白烧服务端模型额度。真正要钉住的是两件事:
 *   ① CLI 走的是携带 Bearer 的那条路(`ihui login` 拿到的 accessToken 存在 settings 的
 *      `apiKey` 字段里,由 `setTokenProvider` 喂给 api-client);
 *   ② 万一没带上凭据(未登录 / 令牌过期),结论必须是 `undetermined`(按未完成处理),
 *      绝不能因为"HTTP 红了"就当通过 —— 这一条是 fail-open 锁的出口侧。
 */
import { setTokenProvider, setTransport, type Transport, type TransportResponse } from '@ihui/api-client';
import { afterAll, describe, expect, it } from 'vitest';

import { resolveCloudRunBase } from '../src/cloud-run.js';
import { GOAL_VERIFY_PATH, runGoalVerification } from '../src/goal-verification.js';

const defaultTransport = (
  await import('@ihui/api-client').then((m) => m.getTransport())
) as Transport;

afterAll(() => {
  setTransport(defaultTransport);
  setTokenProvider({ getToken: () => null });
});

function makeResponse(status: number, payload: unknown): TransportResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(payload),
    json: async () => payload,
  };
}

const PASS_BODY = {
  status: 'achieved',
  treat_as_complete: true,
  criteria: [],
  independent_request_made: false,
  max_consecutive_failures: 5,
  consecutive_failures: 0,
};

const baseInput = {
  goal: '让 goal 校验真的跑起来',
  criteria: [
    {
      id: 'c1',
      statement: 'typecheck 必须 0 错误',
      evidence_kind: 'command' as const,
      required: true,
      probe_command: 'pnpm --filter @ihui/cli typecheck',
    },
  ],
  calls: [
    {
      id: 'e1',
      toolName: 'run_command',
      args: { command: 'pnpm --filter @ihui/cli typecheck' },
      ok: true,
      output: 'No errors found',
    },
  ],
  executorClaim: '我做完了',
};

describe('goal-verify 的出口:带谁的凭据、打哪个基址', () => {
  it('默认出口打 ai-service 基址(不是 --api-url 指向的 apps/api),并携带 Bearer 令牌', async () => {
    const seen: Array<{ url: string; headers?: Record<string, string> }> = [];
    setTransport(async (url, init) => {
      seen.push({ url, headers: init.headers as Record<string, string> | undefined });
      return makeResponse(200, PASS_BODY);
    });
    setTokenProvider({ getToken: () => 'stub.jwt.token' });

    const v = await runGoalVerification(baseInput);

    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe(`${resolveCloudRunBase()}${GOAL_VERIFY_PATH}`);
    expect(seen[0].headers?.Authorization).toBe('Bearer stub.jwt.token');
    expect(v?.goal_status).toBe('achieved');
  });

  it('服务端回送的 max_consecutive_failures 必须原样带出(阈值以真源下发为准,端内不另立)', async () => {
    setTransport(async () => makeResponse(200, PASS_BODY));
    setTokenProvider({ getToken: () => 'stub.jwt.token' });
    const v = await runGoalVerification(baseInput);
    expect(v?.max_consecutive_failures).toBe(5);
  });

  it('未登录 / 401 ⇒ undetermined 且不视为完成(出口侧 fail-open 锁)', async () => {
    setTransport(async () => makeResponse(401, { code: 401, message: 'Authentication required' }));
    setTokenProvider({ getToken: () => null });
    const v = await runGoalVerification(baseInput);
    expect(v?.status).toBe('undetermined');
    expect(v?.treat_as_complete).toBe(false);
    // 光"判成 undetermined"不够 —— 401 与"端点返回了怪东西"必须能分辨,
    // 否则未登录这种一眼可修的原因会被读成服务端坏了。
    expect(v?.unavailable_reason).toMatch(/401|Authentication/);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
