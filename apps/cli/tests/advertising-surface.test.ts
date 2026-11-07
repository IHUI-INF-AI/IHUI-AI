// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 广告面 = 可执行面(2026-11-05)。
 *
 * 钉的是"发给模型的 tools 清单不该摆着结构上执行不了的墙":无头会话 `approverAvailable:false`,
 * 危险档永远 denied —— 而旧代码把整份注册表原样下发,自主派发环实测 `run_command` 被调 40 次、
 * 几乎全部 success:false,每次烧掉一整轮迭代(会话上限 40 轮)。
 *
 * 三条硬要求:
 *  ① 真值表**成对**(allow / ask×有人 / ask×没人 / deny),不许合并档位;
 *  ② **写类工具必须两档都留在广告面** —— 把 `write_file` 那一族摘掉就等于把执行体的
 *     唯一产出能力削没,那是"为了少撞墙而把门焊死",比原缺陷更坏;
 *  ③ 危险档的 dangerLevel 取**注册表原文**,不在测试里另写一份(§22c)。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkPermission, isAdvertisableDecision } from '../src/tools/permissions.js';
import { read_file, run_command } from '../src/tools/builtins.js';

const AGENT_SRC = fileURLToPath(new URL('../src/commands/agent.ts', import.meta.url));

describe('广告面投影', () => {
  it('① 真值表四格成对:allow 留、deny 摘、ask 看有没有人可问', () => {
    expect(isAdvertisableDecision('allow', true)).toBe(true);
    expect(isAdvertisableDecision('allow', false)).toBe(true);
    expect(isAdvertisableDecision('deny', true)).toBe(false);
    expect(isAdvertisableDecision('deny', false)).toBe(false);
    expect(isAdvertisableDecision('ask', false)).toBe(true);
    expect(isAdvertisableDecision('ask', true)).toBe(false);
  });

  it('② 写类档在无头会话仍可得(执行体的产出能力不被削),危险档才被摘', () => {
    // 注册表原文:run_command 是 dangerous,read_file 是 read —— 测试不自己声明档级
    expect(run_command.dangerLevel).toBe('dangerous');
    expect(read_file.dangerLevel ?? 'read').toBe('read');
    const nobodyToAsk = true;
    const dg = checkPermission('run_command', undefined, 'acceptEdits', run_command.dangerLevel!);
    const rd = checkPermission('read_file', undefined, 'acceptEdits', 'read');
    const wr = checkPermission('write_file', undefined, 'acceptEdits', 'write');
    expect(isAdvertisableDecision(dg, nobodyToAsk)).toBe(false);
    expect(isAdvertisableDecision(rd, nobodyToAsk)).toBe(true);
    expect(isAdvertisableDecision(wr, nobodyToAsk)).toBe(true);
    // 人在场时危险档回到清单里(由确认窗去问人,不由这里替人决定)
    expect(isAdvertisableDecision(dg, false)).toBe(true);
  });

  it('③ 接线锁:过滤真发生在下发处,且"过滤后为空 ⇒ 不过滤"这条退路在册', () => {
    const src = readFileSync(AGENT_SRC, 'utf8');
    expect(src).toMatch(/advertisableTools\(listTools\(\)\)/);
    expect(src).toMatch(/toolsToProviderSchema\(advertisedTools\)/);
    expect(src).toMatch(/isAdvertisableDecision\(d, nobodyToAsk\)/);
    expect(src).toMatch(/过滤后为空/);
    // 反向:下发处不得再直接吃整份注册表(那正是本枚要结清的老形态)。
    // 剔掉注释行再比 —— 本文件头注里就原样引用过那句旧代码,字面量尺不剔注释会被自己的注释洗白。
    const codeLines = src
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => !l.startsWith('*') && !l.startsWith('/*') && !l.startsWith('//'));
    expect(codeLines.join('\n')).not.toMatch(/toolsToProviderSchema\(\s*listTools\(\)\s*\)/);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
