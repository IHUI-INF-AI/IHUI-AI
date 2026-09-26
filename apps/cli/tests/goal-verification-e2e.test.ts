// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * goal 独立校验闸门 · 端到端真判取证(2026-09-26,wave10)
 *
 * 与 `goal-verification.test.ts` 的分工:那边全是注入替身,证明"归一化逻辑对不对";
 * 本文件只回答一件事 —— **真实打到 ai-service 的 HTTP 结论,在 TS 侧落哪一档**。
 * 没有真响应参与的断言不算本文件的目标(替身用例在单测里已经钉死)。
 *
 * 判据取的是 `apps/ai-service/app/routers/goal_verification.py` 的
 * `POST /api/agent/goal-verify`。三条机器指标路径的语义(读码 + 当次实测钉死):
 *  · 只送 `outcome: met` 的机器证据 ⇒ status=achieved / treat_as_complete=true,
 *    且 `independent_request_made=false` —— 这条路径**不经过 judge**
 *    (`completion_verification.py` 的 `verify_goal_completion` 只在存在
 *    `pending`(非机器可判且有可用证据)条目时才发起模型请求),
 *    因此它不依赖任何厂商模型凭据,本机无 key 也应当能真判;
 *  · 机器证据为 unmet ⇒ not_achieved / 章不盖;
 *  · 指标声明了但没采到证据(outcome=absent + unavailable_reason)⇒
 *    undetermined / 章不盖 —— **绝不落 achieved**。
 *
 * 环境门槛(硬要求:没跑不许记为通过):
 *  · 基址取 `AI_SERVICE_URL`(与生产调用方 `resolveCloudRunBase()` 同一优先级),
 *    缺省 http://127.0.0.1:8803;
 *  · 收集期先用一次真实探活 POST 判环境:连不上 / 非 2xx / 401(JWT 中间件挡住,
 *    本机默认 8803 实例的实测就是这个)/ 响应解不出 ⇒ 整组 skip,
 *    并用 console.warn 打印**具体原因**;
 *  · 只有探活拿到形状正确的 200 响应,`describe.skipIf(false)` 那一组才会跑,
 *    而那一组的每条断言都在真打 HTTP。
 */
import { describe, expect, it } from 'vitest';

import {
  GOAL_VERIFY_PATH,
  STOP_VERIFICATION_NOT_ACHIEVED,
  STOP_VERIFICATION_UNDETERMINED,
  applyGoalVerificationToStopReason,
  normalizeGoalVerdict,
} from '../src/goal-verification.js';

const BASE = (process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:8803').replace(/\/+$/, '');
const ENDPOINT = `${BASE}${GOAL_VERIFY_PATH}`;
const PROBE_TIMEOUT_MS = 8000;

interface Body {
  goal: string;
  criteria: Array<{ id: string; statement: string; evidence_kind: string; required: boolean }>;
  evidence: Array<{
    id: string;
    criterion_id: string;
    source: string;
    outcome?: 'met' | 'unmet' | 'absent' | null;
    excerpt?: string;
    unavailable_reason?: string | null;
  }>;
  executor_claim: string;
}

/** 与 .ihui-agent/tmp/wave10/req-*.json 同形的三档载荷(自包含,不依赖临时目录留存) */
const REQ_MET: Body = {
  goal: 'wave10 取证:机器指标 met 一档',
  criteria: [{ id: 'c-met', statement: '探针命令退出码等于期望值 0', evidence_kind: 'command', required: true }],
  evidence: [
    { id: 'ev-1', criterion_id: 'c-met', source: 'probe:echo-ok', outcome: 'met', excerpt: 'run_command echo ok -> exit=0\nok' },
  ],
  executor_claim: '我已经完成了(自述,不参与判定)',
};

const REQ_UNMET: Body = {
  goal: 'wave10 取证:机器指标 unmet 一档',
  criteria: [{ id: 'c-unmet', statement: '探针命令退出码等于期望值 0', evidence_kind: 'command', required: true }],
  evidence: [
    { id: 'ev-2', criterion_id: 'c-unmet', source: 'probe:exit-2', outcome: 'unmet', excerpt: 'run_command false -> exit=2\nTS2345 error' },
  ],
  executor_claim: '我已经完成了',
};

const REQ_NO_EVIDENCE: Body = {
  goal: 'wave10 取证:指标声明了但没采到证据',
  criteria: [{ id: 'c-absent', statement: '探针命令必须真跑过', evidence_kind: 'command', required: true }],
  evidence: [
    {
      id: 'absent:c-absent',
      criterion_id: 'c-absent',
      source: 'cli-collector',
      outcome: 'absent',
      unavailable_reason: '本轮没有真跑过探针命令: node scripts/never-run.mjs',
    },
  ],
  executor_claim: '我已经完成了',
};

async function postVerify(body: Body): Promise<{ status: number; data: unknown }> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { unparsable: text.slice(0, 200) };
  }
  return { status: res.status, data };
}

function isVerifyShape(v: unknown): v is { status: string; treat_as_complete: boolean } {
  if (v === null || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.status === 'string' && typeof o.treat_as_complete === 'boolean';
}

// —— 收集期探活:一次真 HTTP,把"能不能跑"变成事实而不是猜测 ——
let skipReason: string | null = null;
let probeData: unknown = null;
try {
  const probe = await postVerify(REQ_MET);
  if (probe.status === 401) {
    skipReason = `端点被 JWT 中间件拦截(HTTP 401 ${ENDPOINT})—— 本机服务默认要求 Bearer token,测试不持有凭据;` + ' 可指向一个 dev 档实例(AI_SERVICE_URL=http://127.0.0.1:18803)真跑';
  } else if (probe.status !== 200) {
    skipReason = `探活返回 HTTP ${probe.status}(${ENDPOINT}),非 200`;
  } else if (!isVerifyShape(probe.data)) {
    skipReason = `探活 200 但响应体缺 status/treat_as_complete 章,按未判定处理:${JSON.stringify(probe.data).slice(0, 200)}`;
  } else {
    probeData = probe.data;
  }
} catch (err) {
  skipReason = `无法连接 ${ENDPOINT}:${err instanceof Error ? err.message : String(err)}`;
}

if (skipReason) {
  // 必须喊出来:skip 不打印原因,读报告的人会把"没跑"当成"跑了没问题"
  console.warn(`[goal-verification-e2e] SKIP(环境不满足,未发生任何真判):${skipReason}`);
}

const skip = skipReason !== null;

describe.skipIf(skip)('goal-verification e2e —— 真判一次', () => {
  it(
    '门槛如实性:进入本组即探活成功过,skip 时整组以 skip 呈现(原因见上方 console.warn)',
    () => {
      expect(skip, `skipReason=${skipReason ?? '(none)'}`).toBe(false);
      expect(isVerifyShape(probeData)).toBe(true);
    },
  );

  it(
    'met 一档:真响应 ⇒ achieved 且盖章;TS 档位与 stopReason 均按"完成"落',
    () => {
      const v = normalizeGoalVerdict(probeData);
      expect(v.status).toBe('achieved');
      expect(v.treat_as_complete).toBe(true);
      expect(v.goal_status).toBe('achieved');
      expect(applyGoalVerificationToStopReason('end_turn', v)).toBe('end_turn');
    },
  );

  it(
    'unmet 一档:真响应 ⇒ not_achieved、章不盖,end_turn 被覆盖为 verification_not_achieved',
    async () => {
      const { status, data } = await postVerify(REQ_UNMET);
      expect(status).toBe(200);
      const v = normalizeGoalVerdict(data);
      expect(v.status).toBe('not_achieved');
      expect(v.treat_as_complete).toBe(false);
      expect(applyGoalVerificationToStopReason('end_turn', v)).toBe(STOP_VERIFICATION_NOT_ACHIEVED);
    },
  );

  it(
    '缺证据一档:真响应 ⇒ undetermined 而不是 achieved,end_turn 被覆盖为 verification_undetermined',
    async () => {
      const { status, data } = await postVerify(REQ_NO_EVIDENCE);
      expect(status).toBe(200);
      const v = normalizeGoalVerdict(data);
      expect(v.status).toBe('undetermined');
      expect(v.treat_as_complete).toBe(false);
      expect(v.goal_status).toBe('undetermined');
      expect(applyGoalVerificationToStopReason('end_turn', v)).toBe(STOP_VERIFICATION_UNDETERMINED);
    },
  );

  it(
    '不依赖 judge 的路径自证:机器指标全判时 independent_request_made 恒为 false',
    () => {
      // 若该字段为 true,说明这次"真判"其实经过了模型 —— 本机无凭据时结论不可复制
      const o = probeData as Record<string, unknown>;
      expect(o.independent_request_made).toBe(false);
      expect(o.judge_model).toBeNull();
    },
  );
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
