// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 环境变量穿透守卫。
 *
 * 钉五件事:
 *   ① 键名含 `=` / NUL ⇒ 拒绝(否则值会变成另一个变量名);
 *   ② 凭据类键 ⇒ 拒绝**并给出该走哪条通道**(不是笼统 "invalid");
 *   ③ 未登记键放行(与黑名单互补;猜错只是多传一个无害变量);
 *   ④ mergeSafeEnv 只保留通过者,并把拒绝项报出来;
 *   ⑤ 值是 undefined ⇒ 表示删除,合法。
 */
import { describe, expect, it } from 'vitest';

import {
  checkEnvKey,
  checkEnvMap,
  mergeSafeEnv,
  routedEnvKeys,
} from '../src/sandbox/env-guard.js';

describe('checkEnvKey 键名合法性', () => {
  it('含 "=" ⇒ 拒绝并解释后果', () => {
    const v = checkEnvKey('FOO=bar');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain('切成');
  });

  it('含 NUL ⇒ 拒绝', () => {
    const v = checkEnvKey('FOO\u0000BAR');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain('NUL');
  });

  it('空键名 ⇒ 拒绝', () => {
    expect(checkEnvKey('').ok).toBe(false);
  });
});

describe('checkEnvKey 归类表', () => {
  it('凭据类键 ⇒ 拒绝且**指明通道**', () => {
    const v = checkEnvKey('IHUI_API_TOKEN');
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.reason).toContain('registerCliTokenProvider');
      expect(v.reason).toContain('/proc/');
    }
  });

  it('配置目录类 ⇒ 放行但标记应作为参数传', () => {
    const v = checkEnvKey('IHUI_CLI_TURNS_DIR');
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.route.kind).toBe('pass-as-param');
    }
  });

  it('本进程设置类 ⇒ 拒绝(调用方不得覆盖)', () => {
    const v = checkEnvKey('IHUI_LOCALE');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain('不得覆盖');
  });

  it('普通宿主机键 ⇒ 放行', () => {
    expect(checkEnvKey('PATH').ok).toBe(true);
    expect(checkEnvKey('NODE_ENV').ok).toBe(true);
  });

  it('未登记键 ⇒ 放行(与黑名单互补的失效方向)', () => {
    const v = checkEnvKey('SOME_BRAND_NEW_VAR_2027');
    expect(v.ok).toBe(true);
  });
});

describe('checkEnvMap 一次报全', () => {
  it('多个问题全部列出(不是只报第一个)', () => {
    const r = checkEnvMap({
      'BAD=KEY': 'x',
      IHUI_API_TOKEN: 'secret',
      IHUI_LOCALE: 'en',
    });
    expect(r.ok).toBe(false);
    expect(r.problems.length).toBe(3);
  });

  it('值非字符串 ⇒ 记入 valueProblems', () => {
    const r = checkEnvMap({ PATH: 123 });
    expect(r.ok).toBe(false);
    expect(r.valueProblems).toHaveLength(1);
  });

  it('值含 NUL ⇒ 记入 valueProblems', () => {
    const r = checkEnvMap({ PATH: 'a\u0000b' });
    expect(r.ok).toBe(false);
  });

  it('undefined 值合法(表示删除该键)', () => {
    const r = checkEnvMap({ PATH: undefined });
    expect(r.ok).toBe(true);
  });

  it('应作为参数传的键被单独列出', () => {
    const r = checkEnvMap({ IHUI_CLI_TURNS_DIR: '/x' });
    expect(r.ok).toBe(true);
    expect(r.passAsParams).toHaveLength(1);
    expect(r.passAsParams[0]!.key).toBe('IHUI_CLI_TURNS_DIR');
  });

  it('空对象 ⇒ 通过', () => {
    const r = checkEnvMap({});
    expect(r.ok).toBe(true);
    expect(r.problems).toHaveLength(0);
  });
});

describe('mergeSafeEnv', () => {
  const base = { PATH: '/usr/bin', HOME: '/home/u' };

  it('只保留通过守卫的键', () => {
    const { env, rejected } = mergeSafeEnv(base, {
      NODE_ENV: 'production',
      IHUI_API_TOKEN: 'secret',
    });
    expect(env.NODE_ENV).toBe('production');
    expect(env.IHUI_API_TOKEN).toBeUndefined();
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.key).toBe('IHUI_API_TOKEN');
  });

  it('base 的键不被丢掉', () => {
    const { env } = mergeSafeEnv(base, { NODE_ENV: 'x' });
    expect(env.PATH).toBe('/usr/bin');
    expect(env.HOME).toBe('/home/u');
  });

  it('overlay 里 undefined ⇒ 删除该键', () => {
    const { env } = mergeSafeEnv(base, { HOME: undefined });
    expect(env.HOME).toBeUndefined();
    expect(env.PATH).toBe('/usr/bin');
  });

  it('拒绝项带可操作原因(不是 "invalid")', () => {
    const { rejected } = mergeSafeEnv(base, { IHUI_API_TOKEN: 'x' });
    expect(rejected[0]!.reason).toContain('registerCliTokenProvider');
  });
});

describe('routedEnvKeys', () => {
  it('返回已归类键且非空', () => {
    const keys = routedEnvKeys();
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).toContain('IHUI_API_TOKEN');
  });

  it('排序稳定', () => {
    const a = routedEnvKeys();
    const b = routedEnvKeys();
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([...a]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
