// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-427(2026-10-07 拍板"抄上游")—— 技能广告门控:
 * `Skill` 工具不在真实工具表里,system prompt 就不得广告技能段(上游
 * context/builder.ts:225-228 的谓词)。走生产入口 formatSkillsForPrompt:
 *   - 传 toolTable 且无 Skill ⇒ 技能段整块不出,且经注入登记簿留下可见记过(不静默);
 *   - 传 toolTable 且有 Skill ⇒ 与不传 gate 逐字同形(既有行为零漂移)。
 */
import { describe, it, expect } from 'vitest';

import {
  formatSkillsForPrompt,
  SKILL_INVOCATION_TOOL_NAME,
  type Skill,
} from '../src/skills/index.js';

function makeSkill(name: string, body: string): Skill {
  return {
    name,
    source: `/tmp/${name}.md`,
    description: 'demo skill for the ad gate',
    body,
    priority: 0,
  };
}

describe('G-427 skill advertisement gate', () => {
  const demo = makeSkill('g427-demo', 'G427-DEMO-BODY-MARKER');

  it('⑴ SKILL_INVOCATION_TOOL_NAME is the upstream tool name', () => {
    expect(SKILL_INVOCATION_TOOL_NAME).toBe('Skill');
  });

  it('⑵ toolTable without the Skill tool ⇒ section withheld, recorded not silent', () => {
    const text = formatSkillsForPrompt([demo], { toolTable: ['Bash', 'Read', 'Grep'] });
    expect(text).toBe('');
    expect(text).not.toContain('G427-DEMO-BODY-MARKER');
  });

  it('⑶ toolTable with the Skill tool ⇒ section advertised, same as legacy', () => {
    const gated = formatSkillsForPrompt([demo], { toolTable: ['Bash', SKILL_INVOCATION_TOOL_NAME] });
    const legacy = formatSkillsForPrompt([demo]);
    expect(gated).toContain('G427-DEMO-BODY-MARKER');
    expect(gated).toBe(legacy);
  });

  it('⑷ no gate argument ⇒ legacy behavior, byte-identical (no tool-table judgment)', () => {
    const legacy = formatSkillsForPrompt([demo]);
    expect(legacy).toContain('G427-DEMO-BODY-MARKER');
    expect(formatSkillsForPrompt([demo], {})).toBe(legacy);
  });

  it('⑸ gate wins over the empty-list short circuit ordering (withheld reason is the gate, not "no skills")', () => {
    // 门在"零技能"短路之前判:即便清单为空,门关闭时也不产生"未发现任何技能"的误导记过
    const text = formatSkillsForPrompt([], { toolTable: ['Bash'] });
    expect(text).toBe('');
  });
});
