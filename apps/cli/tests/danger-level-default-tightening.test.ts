// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-1058647 语义锁:「未声明 dangerLevel 的工具不得比显式声明的档位更松」。
//
// 票面链路(2026-10-06 取证,HEAD 行 L10851):tools/index.ts 的 dangerLevel 是可选字段,
// 而 commands/agent.ts 的 `tool?.dangerLevel ?? 'read'` 把缺席折成 'read',permissions.ts 的
// default/acceptEdits/plan 三档又都把 read 映射为 allow ⇒ 「没写」比「写了 dangerous」更松。
//
// 机主拍板(2026-10-07):两步走 —— 14 枚读工具补显式 dangerLevel 先行(已由他批入库),
// MCP 适配层缺省翻 dangerous;**agent.ts 的 ?? 'read' 兜底按票面禁令不动**(改它会在持有人
// 拍板前改变全部无标注工具的批准行为)。故本测试只锁语义、不改产品码:
//   ① 工具层(index.ts)对"同一缺席"取的必须是保守档 'write'(两处,源码锁);
//   ② 权限矩阵里 'write' 在 default 档是 ask 而非 allow ⇒ 缺席(若走工具层保守档)不会静默放行;
//   ③ default 档唯一映射 allow 的档位是 'read' —— 这正是"缺席折成 read"是更松侧的病灶所在;
//   ④ 严格度序:未声明(→write→ask)不比声明的 dangerous(→ask)更松;
//   ⑤ agent.ts 的 ?? 'read' 兜底原样在位(禁令锁):它一旦被人改动,本锁变红,
//      提醒按 G-1058647 重新复核"未声明 → read → default allow"那条更松链路是否重新暴露。
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { checkPermission } from '../src/tools/permissions.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOLS_INDEX = join(HERE, '..', 'src', 'tools', 'index.ts');
const AGENT_SRC = join(HERE, '..', 'src', 'commands', 'agent.ts');

/** 严格度序:allow(最松)=0 < ask=1 < deny(最严)=2。只用于同 mode 内比较。 */
function strictness(decision: 'allow' | 'deny' | 'ask'): number {
  return decision === 'allow' ? 0 : decision === 'ask' ? 1 : 2;
}

describe('G-1058647 未声明 dangerLevel 不得比声明更松(语义锁,不改产品码)', () => {
  it('工具层对缺席的缺省必须是保守档 write(index.ts 两处 ?? write 源码锁)', () => {
    const src = readFileSync(TOOLS_INDEX, 'utf8');
    const sites = src.match(/tool\.dangerLevel \?\? 'write'/g) ?? [];
    // G-424 钩子改写重判后按改后内容重跑规则面,第三处 ?? 'write' 是重判路径的保守档
    // (与首过同形,非判据复制);count 随执行路径阶段数走,语义锁钉的是"不得比声明更松"。
    expect(sites.length).toBe(3);
  });

  it('agent.ts 的 ?? read 兜底按票面禁令保持原样(变动即须按 G-1058647 复核)', () => {
    const src = readFileSync(AGENT_SRC, 'utf8');
    expect(src).toMatch(/tool\?\.dangerLevel \?\? 'read'/);
  });

  it('default 档:write(未声明的保守缺省)⇒ ask,不得静默 allow', () => {
    expect(checkPermission('any_tool', undefined, 'default', 'write')).toBe('ask');
  });

  it('default 档:唯一映射 allow 的档位是声明的 read(缺席折成 read 正是更松侧的病灶)', () => {
    expect(checkPermission('any_tool', undefined, 'default', 'read')).toBe('allow');
    expect(checkPermission('any_tool', undefined, 'default', 'write')).not.toBe('allow');
    expect(checkPermission('any_tool', undefined, 'default', 'dangerous')).not.toBe('allow');
  });

  it('严格度序:未声明(→write→ask)不比声明的 dangerous(→ask)更松', () => {
    const undeclared = strictness(checkPermission('any_tool', undefined, 'default', 'write'));
    const dangerous = strictness(checkPermission('any_tool', undefined, 'default', 'dangerous'));
    expect(undeclared).toBeGreaterThanOrEqual(dangerous);
  });

  it('plan 档:write ⇒ deny(manual 档:一律 ask)——保守缺省在任何收窄档都不比声明更松', () => {
    expect(checkPermission('any_tool', undefined, 'plan', 'write')).toBe('deny');
    expect(checkPermission('any_tool', undefined, 'manual', 'write')).toBe('ask');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
