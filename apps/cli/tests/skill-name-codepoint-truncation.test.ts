// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票 G-414 ① —— 名称档按 UTF-16 码元截断会切出孤立代理对。
//
// 这个文件刻意**只** import `../src/utils/prompt-boundary.js`(该模块不引任何 workspace 包):
// 同目录的 `prompt-boundary.test.ts` 还要拉 `reminders.js` / `tools/index.js`,
// 那条链在隔离 worktree 里因为 `@ihui/api-client` 构建不过(端内 taro 类型缺失,与本票无关)
// 而整文件 0 test 加载失败 ⇒ 判据写了却一次也没跑。断言住在能真跑的地方,才有牙齿。
import { describe, expect, it } from 'vitest';
import {
  SKILL_NAME_MAX_CHARS,
  buildSkillPromptSection,
  sanitizeSkillName,
  truncateToCodePoints,
} from '../src/utils/prompt-boundary.js';

/**
 * 孤立代理扫描器(判据的判据):逐 UTF-16 码元走 —— 高位代理必须紧跟低位代理,
 * 且不得出现无前驱的低位代理。**刻意不用正则**:票面要的断言是"截断结果不得含孤立代理",
 * 一条写错的正则会让断言本身失效,而码元扫描每一步都可读。
 */
function hasLoneSurrogate(s: string): boolean {
  for (let i = 0; i < s.length; i += 1) {
    const unit = s.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i += 1; // 合法代理对:整对跳过
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true; // 无前驱的低位代理
    }
  }
  return false;
}

describe('sanitizeSkillName:截断口径是码位,不是 UTF-16 码元', () => {
  /**
   * 阳性对照(票面那一格)。修前必红:旧实现 `.slice(0, 80)` 在同一条断言下
   * 产出以 `0xd83d` 收尾的串(已用 `git show HEAD^:` 的原文喂同一扫描器实测到)。
   */
  it('边界落在 emoji 中间时不得留下孤立高位代理', () => {
    const name = `${'a'.repeat(SKILL_NAME_MAX_CHARS - 1)}😀tail`; // 第 80 个码元正好是半个代理对
    const out = sanitizeSkillName(name);
    expect(hasLoneSurrogate(out)).toBe(false);
    expect(Array.from(out).length).toBeLessThanOrEqual(SKILL_NAME_MAX_CHARS);
    // 码元数允许比上限多 1(代理对是整体,不能被切成半对)—— 这条写反就会逼人砍 emoji
    expect(out.length).toBeLessThanOrEqual(SKILL_NAME_MAX_CHARS + 1);
  });

  it('输入本就带孤立代理时一律丢弃(唯一出口不得把非法串递给提示/落库/上报)', () => {
    const halfPair = `技${String.fromCharCode(0xd83d)}`; // '技' + 孤高位代理
    expect(hasLoneSurrogate(halfPair)).toBe(true);
    const out = sanitizeSkillName(halfPair);
    expect(hasLoneSurrogate(out)).toBe(false);
    expect(out).toBe('技');
  });

  it('回归:BMP 名称与未超长的 emoji 名称逐字不变', () => {
    expect(sanitizeSkillName('代码评审 review 技能')).toBe('代码评审 review 技能');
    const emojiName = '🧪 smoke test';
    expect(sanitizeSkillName(emojiName)).toBe(emojiName);
    // 既有两条口径不得被顺手改动
    expect(sanitizeSkillName('x'.repeat(200))).toHaveLength(SKILL_NAME_MAX_CHARS);
    expect(sanitizeSkillName('  re​view<script>  ')).toBe('reviewscript');
  });
});

describe('truncateToCodePoints:一处截断实现,别处不得再抄', () => {
  it('按码位计数,代理对算一个', () => {
    expect(truncateToCodePoints('😀😀😀', 2)).toBe('😀😀');
    expect(Array.from(truncateToCodePoints('😀'.repeat(100), SKILL_NAME_MAX_CHARS))).toHaveLength(
      SKILL_NAME_MAX_CHARS,
    );
  });

  it('预算恰好等于长度时不多切一刀', () => {
    const name = `x${'😀'.repeat(3)}`;
    expect(truncateToCodePoints(name, 4)).toBe(name);
  });

  it('非正数/非有限预算产出空串(不接受 NaN 当"不限长"的默认值)', () => {
    expect(truncateToCodePoints('abc', 0)).toBe('');
    expect(truncateToCodePoints('abc', -5)).toBe('');
    expect(truncateToCodePoints('abc', Number.NaN)).toBe('');
  });

  it('混合半对时只留完整码位', () => {
    const mixed = `a\u{1F600}${String.fromCharCode(0xd83d)}b${String.fromCharCode(0xde00)}c`;
    const out = truncateToCodePoints(mixed, 80);
    expect(out).toBe('a😀bc');
    expect(hasLoneSurrogate(out)).toBe(false);
  });
});

describe('端到端:超长 emoji 技能名进提示后仍合法', () => {
  it('段内不含孤立代理,该技能仍入段', () => {
    const long = `${'y'.repeat(SKILL_NAME_MAX_CHARS - 1)}😀😀`;
    const r = buildSkillPromptSection([{ name: long, body: '正文' }]);
    expect(hasLoneSurrogate(r.text)).toBe(false);
    expect(r.included).toBe(1);
    expect(r.text).toContain('正文');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
