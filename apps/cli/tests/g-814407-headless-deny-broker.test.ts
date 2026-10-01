// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-814407 验收 —— 非交互且无审批面 ⇒ deny,且拒绝文案取自单一出口(headless-permission.ts)。
 *
 * 成对判据:
 *  · 正例:非交互 ∧ 无审批面 ⇒ deny,message **逐字等于** utils/tool-denial.ts 单出口
 *    (`buildToolDenial` + `denialErrorSuffix`)在同一输入下的产出 —— 文案不出自本模块;
 *  · 反例 A:审批面在位 ⇒ use-approval-surface(走原审批路径,经纪不抢答、不代批);
 *  · 反例 B:交互但没接审批通道 ⇒ 仍 deny(人在场 ≠ 有人能应答;安全方向,拿不准从严);
 *  · 默认方向:缺省 autoAllow 为空集 ⇒ 一切需要批准的调用都落 deny。
 *
 * 卫生判据(同族既有纪律):拒绝消息里只出现参数**指纹与键名**,不得回显任何入参值。
 */
import { describe, it, expect } from 'vitest';

import {
  createHeadlessPermissionBroker,
  decideHeadlessPermission,
  approvalSurfacePresent,
} from '../src/headless-permission.js';
import {
  buildToolDenial,
  denialErrorSuffix,
  toolDenialGuidance,
} from '../src/utils/tool-denial.js';

const SUBJECT = {
  name: 'run_command',
  arguments: { cmd: 'rm -rf /tmp/keepme', secretValue: 'hunter2-do-not-leak' },
};

describe('G-814407 headless permission broker', () => {
  it('正例:非交互 ∧ 无审批面 ⇒ deny,且 message 逐字取自单一出口', () => {
    const decision = decideHeadlessPermission(
      { isInteractive: false, hasApprovalSurface: false },
      SUBJECT,
    );
    expect(decision.action).toBe('deny');
    if (decision.action !== 'deny') return; // 类型收窄(不影响判据)

    // 单出口等值:同一输入独立走 buildToolDenial+denialErrorSuffix,产出必须逐字相同。
    const canonical = buildToolDenial({
      gate: 'dangerous-gate',
      decider: 'no-confirmation-channel',
      tool: SUBJECT.name,
      args: SUBJECT.arguments,
    });
    expect(decision.denial).toEqual(canonical);
    expect(decision.message).toBe(denialErrorSuffix(canonical));
    expect(decision.message).toBe(
      `[ihui-denial gate=dangerous-gate decider=no-confirmation-channel args=${canonical.args.fingerprint} keys=${[
        ...canonical.args.keys,
      ].join(',')}] ${toolDenialGuidance('dangerous-gate', 'no-confirmation-channel')}`,
    );
  });

  it('卫生:拒绝文案只带指纹与键名,绝不回显入参值', () => {
    const decision = decideHeadlessPermission(
      { isInteractive: false, hasApprovalSurface: false },
      SUBJECT,
    );
    expect(decision.action).toBe('deny');
    if (decision.action !== 'deny') return;
    expect(decision.message).not.toContain('hunter2-do-not-leak');
    expect(decision.message).not.toContain('rm -rf');
    expect(decision.denial.args.keys).toEqual(['cmd', 'secretValue']);
    expect(decision.denial.args.fingerprint).toMatch(/^args-sha256-v1-[0-9a-f]{64}$/);
  });

  it('反例 A:审批面在位 ⇒ 交回原审批路径(即便工具在 auto-allow 名单里也不抢答)', () => {
    const broker = createHeadlessPermissionBroker({
      isInteractive: true,
      hasApprovalSurface: true,
      autoAllowTools: ['run_command'],
    });
    const decision = broker.evaluate(SUBJECT);
    expect(decision.action).toBe('use-approval-surface');
    expect(broker.deniesWhenSurfaceAbsent).toBe(false);
  });

  it('反例 B:交互但没有接审批通道 ⇒ 仍 deny(人在场不等于有人能应答)', () => {
    const decision = decideHeadlessPermission(
      { isInteractive: true, hasApprovalSurface: false },
      SUBJECT,
    );
    expect(decision.action).toBe('deny');
  });

  it('默认方向:缺省名单为空 ⇒ 任何具名工具都 deny;显式列入名单才 allow(对应上游仅两枚具名工具)', () => {
    const defaultBroker = createHeadlessPermissionBroker({
      isInteractive: false,
      hasApprovalSurface: false,
    });
    expect(defaultBroker.evaluate({ name: 'any_tool' }).action).toBe('deny');
    expect(defaultBroker.deniesWhenSurfaceAbsent).toBe(true);

    const listed = createHeadlessPermissionBroker({
      isInteractive: false,
      hasApprovalSurface: false,
      autoAllowTools: ['create_workflow'],
    });
    const d = listed.evaluate({ name: 'create_workflow' });
    expect(d.action).toBe('allow');
    if (d.action === 'allow') expect(d.reason).toBe('auto-allow-list');
    // 名单外的一律照旧 deny —— 名单是逐名拍板的例外,不是模式匹配。
    expect(listed.evaluate({ name: 'create_workflow_other' }).action).toBe('deny');
  });

  it('审批面判据两问:TTY 与确认通道缺一即"面无"(只认 TTY 会把没实现确认的宿主判成有面)', () => {
    expect(
      approvalSurfacePresent({ ttyInteractive: true, confirmHandlerPresent: true }),
    ).toBe(true);
    expect(
      approvalSurfacePresent({ ttyInteractive: true, confirmHandlerPresent: false }),
    ).toBe(false);
    expect(
      approvalSurfacePresent({ ttyInteractive: false, confirmHandlerPresent: true }),
    ).toBe(false);
    expect(
      approvalSurfacePresent({ ttyInteractive: false, confirmHandlerPresent: false }),
    ).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
