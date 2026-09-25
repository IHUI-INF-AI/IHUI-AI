// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, describe, expect, it } from 'vitest';
import { extractPrimarySubtag, readSystemLocaleEnv } from '../src/utils/system-locale.js';
import { getLocale } from '../src/i18n/index.js';
import { languageForApi } from '../src/voice/language.js';

const KEYS = ['LC_ALL', 'LC_MESSAGES', 'LANG', 'IHUI_LOCALE'] as const;
const saved: Record<string, string | undefined> = {};
for (const k of KEYS) saved[k] = process.env[k];

afterEach(() => {
  for (const k of KEYS) {
    const v = saved[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('readSystemLocaleEnv:POSIX 链的单一实现', () => {
  it('LC_ALL 赢过 LC_MESSAGES 与 LANG', () => {
    expect(readSystemLocaleEnv({ LC_ALL: 'de_DE.UTF-8', LC_MESSAGES: 'fr_FR.UTF-8', LANG: 'ja_JP.UTF-8' })).toBe('de_DE.UTF-8');
  });

  it('空串按"未设置"处理,不 mask 低优先级变量(变异对照:若按"已定义即返回"本条必红)', () => {
    expect(readSystemLocaleEnv({ LC_ALL: '   ', LC_MESSAGES: '', LANG: 'ja_JP.UTF-8' })).toBe('ja_JP.UTF-8');
  });

  it('C / POSIX / C.UTF-8 判"无语言信息"', () => {
    for (const raw of ['C', 'POSIX', 'C.UTF-8', 'c.utf8']) {
      expect(readSystemLocaleEnv({ LANG: raw })).toBeNull();
    }
  });

  it('链上全空返回 null', () => {
    expect(readSystemLocaleEnv({})).toBeNull();
  });
});

describe('extractPrimarySubtag', () => {
  it('POSIX 与 BCP-47 两族分隔符都剥', () => {
    expect(extractPrimarySubtag('fr_FR.UTF-8')).toBe('fr');
    expect(extractPrimarySubtag('zh-Hans-CN')).toBe('zh');
    expect(extractPrimarySubtag('PT_BR')).toBe('pt');
  });

  it('null / 空 / C 档返回 null(不得把 C.UTF-8 读成语言 c)', () => {
    expect(extractPrimarySubtag(null)).toBeNull();
    expect(extractPrimarySubtag('')).toBeNull();
    expect(extractPrimarySubtag('C.UTF-8')).toBeNull();
  });
});

/**
 * 单一真相源的装车证明:两个消费面(i18n 界面取词 / voice STT auto)
 * 必须对同一份 env 给出一致结论。此前 i18n 只读 Intl,与 voice 各算一次。
 */
describe('界面语言与语音 auto 共用同一份链', () => {
  it('LANG=ja_JP.UTF-8 时两侧都判 ja', () => {
    delete process.env.LC_ALL;
    delete process.env.LC_MESSAGES;
    process.env.LANG = 'ja_JP.UTF-8';
    delete process.env.IHUI_LOCALE;
    expect(getLocale()).toBe('ja');
    expect(languageForApi('auto')).toBe('ja');
  });

  it('IHUI_LOCALE 显式覆盖仍最高优先', () => {
    process.env.LANG = 'ja_JP.UTF-8';
    process.env.IHUI_LOCALE = 'en-US';
    expect(getLocale()).toBe('en');
  });

  it('LANG=zh_TW.UTF-8(POSIX 形态)必须落 zh-TW,不得静默回默认档', () => {
    delete process.env.LC_ALL;
    delete process.env.LC_MESSAGES;
    process.env.LANG = 'zh_TW.UTF-8';
    delete process.env.IHUI_LOCALE;
    expect(getLocale()).toBe('zh-TW');
  });

  it('链上无语言信息时不伪装成 env 结论(走 ICU 兜底且不抛)', () => {
    process.env.LC_ALL = 'C.UTF-8';
    delete process.env.LC_MESSAGES;
    delete process.env.LANG;
    delete process.env.IHUI_LOCALE;
    expect(['zh-CN', 'en', 'ja', 'ko', 'zh-TW']).toContain(getLocale());
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
