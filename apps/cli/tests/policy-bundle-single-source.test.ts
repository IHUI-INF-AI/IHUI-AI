// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 同一事实的字面量不得写两份(G-816013 · DB 判据的落地侧证明)
//
// 这组用例钉三件事,少一件都会让"收成一圈"变成一句散文:
//  1. 策略四档的**取值**被逐字冻结 —— 收成一份出口不是改观感,首跑与改动后必须逐字节同值;
//  2. `first-run.ts` 不得再重述这四个布尔字面量(源码级反向锁:重述一次,DB 判据当场红,
//     而这条用例保证"没人靠删判据消红" —— 两处各拦一次,方向一致);
//  3. `DEFAULT_SETTINGS` 经展开后仍然**带着**这四个键且值不变(展开写错位置 / 漏 spread 时,
//     类型层会红,但这条保证不会有人把 spread 换成 `{}` 来"过门")。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { DEFAULT_POLICY_OPTIONS, DEFAULT_SETTINGS } from '../src/config/defaults.js';

const POLICY_KEYS = ['auditEnabled', 'allowDangerous', 'planFirst', 'enableMcp'] as const;

/** 键序也是契约:`JSON.stringify(settings)` 按插入序产出配置文件字节。 */
const EXPECTED_ORDER = ['auditEnabled', 'allowDangerous', 'planFirst', 'enableMcp'];

describe('G-816013 策略档唯一落点', () => {
  it('① 取值冻结:四档字面量与收成出口前逐字相同', () => {
    expect(DEFAULT_POLICY_OPTIONS).toEqual({
      auditEnabled: true,
      allowDangerous: false,
      planFirst: false,
      enableMcp: false,
    });
    expect(EXPECTED_ORDER).toEqual([...POLICY_KEYS]);
  });

  it('② DEFAULT_SETTINGS 带着同一份四档(展开生效,不是被覆盖成 undefined)', () => {
    for (const k of POLICY_KEYS) {
      expect(DEFAULT_SETTINGS[k], `DEFAULT_SETTINGS.${k}`).toBe(DEFAULT_POLICY_OPTIONS[k]);
      expect(typeof DEFAULT_SETTINGS[k]).toBe('boolean');
    }
  });

  it('③ 键序未被 spread 打乱:四档在 maxIterations 之后、sandbox 之前连续出现', () => {
    const keys = Object.keys(DEFAULT_SETTINGS);
    const start = keys.indexOf('maxIterations');
    expect(start).toBeGreaterThan(-1);
    expect(keys.slice(start + 1, start + 5)).toEqual(EXPECTED_ORDER);
    expect(keys[start + 5]).toBe('sandbox');
  });

  it('④ 源码级反向锁:first-run.ts 不得再重述这四个布尔(第二份字面量即本用例的责任)', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/commands/first-run.ts', import.meta.url)), 'utf8');
    // 注释/文档不参与:只数**赋值形态**的字面量(`key: true|false`)
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const k of POLICY_KEYS) {
      const re = new RegExp(`(^|[{,\\s])${k}\\s*:\\s*(true|false)`, 'm');
      expect(re.test(code), `first-run.ts 仍在本地写 ${k} 的字面量 ⇒ 请引 DEFAULT_POLICY_OPTIONS`).toBe(false);
    }
    expect(code.includes('DEFAULT_POLICY_OPTIONS')).toBe(true);
  });

  it('⑤ 唯一落点恰好一处:整个 defaults.ts 里每个键只出现一次字面量形态', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/config/defaults.ts', import.meta.url)), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const k of POLICY_KEYS) {
      const hits = code.match(new RegExp(`${k}\\s*:\\s*(true|false)`, 'g')) || [];
      expect(hits.length, `defaults.ts 里 ${k} 的字面量出现 ${hits.length} 次(应恰为 1 次)`).toBe(1);
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
