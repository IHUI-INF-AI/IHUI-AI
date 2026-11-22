// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WP-8③ 装车证明:闸门必须**挂在循环的交账路径上**,不是又一个"造好没人跑"的模块。
 *
 * 为什么用源码级断言而不是跑一次完整循环:`runToolLoop` 要真 provider + 真工具栈,
 * 在单测里起不来(本仓同类判据都走这一型,如守门 115 的"校验器必须有非测试调用方")。
 * 判据取"调用位"而非"import 位" —— 只 import 不调用正是本仓最高频的失效形态。
 *
 * 每条都有对应的反向事实在注释里,免得下一个人把它当装饰删掉。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const agentSrc = readFileSync(new URL('../src/commands/agent.ts', import.meta.url), 'utf8');
const entrySrc = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');

describe('goal 校验闸门的接线位', () => {
  it('循环交账前必须真的调用独立校验(不是只 import)', () => {
    expect(agentSrc).toContain('await runGoalVerification({');
  });

  it('校验结论必须改写交账的 stopReason', () => {
    expect(agentSrc).toContain('stopReason = applyGoalVerificationToStopReason(');
  });

  it('采集面必须在每个工具结果处累积(缺了这一格,机器指标永远采不到证据)', () => {
    expect(agentSrc).toContain('goalCallRecords.push({');
  });

  it('两个校验档必须进退出码映射 —— 未过验收不得退 0', () => {
    expect(agentSrc).toContain("case 'verification_not_achieved':");
    expect(agentSrc).toContain("case 'verification_undetermined':");
  });

  it('命令行入口必须给出声明指标的出口', () => {
    expect(entrySrc).toContain("--goal-criteria <file>");
    expect(entrySrc).toContain('goalCriteria: resolveGoalCriteria(');
  });

  it('指标解析不得静默降级:读不到 / 非数组 / 缺字段一律先停', () => {
    // 反例形态是 "catch { return undefined }" —— 那等于把一次带验收的运行洗成无验收
    expect(entrySrc).not.toMatch(/function resolveGoalCriteria[\s\S]{0,400}catch[\s\S]{0,60}return undefined/);
    expect(entrySrc).toContain('process.exit(2)');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
