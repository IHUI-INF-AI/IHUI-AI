// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * browser 状态查询工具(browser_get_bounding_box / get_state / get_attribute)。
 *
 * 对标 Trae 的 browser_get_bounding_box + is_visible/is_enabled/is_checked +
 * get_attribute/get_input_value 那一整族读侧工具。它们的价值在「点之前先确认」:
 * 缺了它们,模型只能靠 snapshot 的文本猜元素状态,点禁用项 / 勾错复选框会静默发生。
 *
 * 这里钉的是**不依赖真实浏览器**就能判定的失败路径(与 browser-tools.test.ts 同口径):
 *   ① ref/selector 二选一:同时给两个 / 都不给 ⇒ 当场 fail,不拉起浏览器;
 *   ② get_attribute 缺 attribute 必填 ⇒ 当场 fail;
 *   ③ 三个工具都是只读(dangerLevel='read'),不进批准面。
 */

import { describe, expect, it } from 'vitest';

import { BROWSER_TOOLS } from '../src/tools/browser.js';

const bbox = BROWSER_TOOLS.find((t) => t.name === 'browser_get_bounding_box')!;
const state = BROWSER_TOOLS.find((t) => t.name === 'browser_get_state')!;
const attr = BROWSER_TOOLS.find((t) => t.name === 'browser_get_attribute')!;

describe('browser 状态查询工具', () => {
  it('三个工具都存在且都是只读', () => {
    for (const t of [bbox, state, attr]) {
      expect(t).toBeDefined();
      expect(t.name).toMatch(/^browser_/);
      expect(t.dangerLevel).toBe('read');
    }
  });

  it('ref/selector 同时给两个 ⇒ 当场 fail(param_invalid),不拉浏览器', async () => {
    const r = await bbox.execute({ ref: 'e1', selector: '#x' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errorType).toBe('param_invalid');
  });

  it('ref/selector 都不给 ⇒ 当场 fail(param_invalid)', async () => {
    for (const t of [bbox, state, attr]) {
      const r = await t.execute(attr === t ? { attribute: 'value' } : {});
      expect(r.success).toBe(false);
      if (!r.success) expect(r.errorType).toBe('param_invalid');
    }
  });

  it('get_attribute 缺 attribute 必填 ⇒ 抛错(requireString 惯例,与其他工具一致)', async () => {
    await expect(attr.execute({ selector: '#x' })).rejects.toThrow(/attribute/);
  });

  it('get_attribute 给了 attribute + selector ⇒ 参数合法,只是找不到浏览器会话(非参数错)', async () => {
    // 不 mock 会话:走到拉起浏览器那一步会失败,但**不是** param_invalid ——
    // 这证明参数校验已通过,失败发生在更后面的会话层。
    const r = await attr.execute({ attribute: 'value', selector: '#x' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errorType).not.toBe('param_invalid');
  });

  it('get_state / get_bounding_box 给了 ref ⇒ 参数合法,失败发生在会话层(非参数错)', async () => {
    for (const t of [bbox, state]) {
      const r = await t.execute({ ref: 'e1' });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.errorType).not.toBe('param_invalid');
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
