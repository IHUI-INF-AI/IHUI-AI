/**
 * voice/language.ts 单元测试。
 * 灵感来源:参考行业 voice/language.rs 的 7 个核心测试 + IHUI 实际场景补充。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  STT_LANGUAGES,
  STT_LANGUAGE_AUTO,
  canonicalizeSttLanguage,
  languageForApi,
  sttLanguageByCode,
} from './language.js';

describe('voice/language', () => {
  // 保存原始环境变量以便恢复
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.LC_ALL;
    delete process.env.LC_MESSAGES;
    delete process.env.LANG;
  });

  afterEach(() => {
    process.env.LC_ALL = originalEnv.LC_ALL;
    process.env.LC_MESSAGES = originalEnv.LC_MESSAGES;
    process.env.LANG = originalEnv.LANG;
  });

  describe('STT_LANGUAGES catalog', () => {
    it('contains 25 languages (May 2026 docs)', () => {
      expect(STT_LANGUAGES.length).toBe(25);
    });

    it('contains expected codes', () => {
      const codes = STT_LANGUAGES.map((l) => l.code);
      for (const expected of [
        'ar',
        'cs',
        'da',
        'nl',
        'en',
        'fil',
        'fr',
        'de',
        'hi',
        'id',
        'it',
        'ja',
        'ko',
        'mk',
        'ms',
        'fa',
        'pl',
        'pt',
        'ro',
        'ru',
        'es',
        'sv',
        'th',
        'tr',
        'vi',
      ]) {
        expect(codes, `should contain ${expected}`).toContain(expected);
      }
    });

    it('codes are unique', () => {
      const codes = STT_LANGUAGES.map((l) => l.code);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('names are non-empty', () => {
      for (const l of STT_LANGUAGES) {
        expect(l.name.length).toBeGreaterThan(0);
      }
    });
  });

  describe('sttLanguageByCode', () => {
    it('finds en', () => {
      expect(sttLanguageByCode('en')?.code).toBe('en');
    });

    it('is case-sensitive (EN returns undefined)', () => {
      expect(sttLanguageByCode('EN')).toBeUndefined();
    });

    it('returns undefined for unknown', () => {
      expect(sttLanguageByCode('zh')).toBeUndefined();
      expect(sttLanguageByCode('auto')).toBeUndefined();
    });
  });

  describe('canonicalizeSttLanguage', () => {
    it('null/undefined/blank → en', () => {
      expect(canonicalizeSttLanguage(null)).toBe('en');
      expect(canonicalizeSttLanguage(undefined)).toBe('en');
      expect(canonicalizeSttLanguage('')).toBe('en');
      expect(canonicalizeSttLanguage('  ')).toBe('en');
    });

    it('exact code (any case) → that code', () => {
      expect(canonicalizeSttLanguage('en')).toBe('en');
      expect(canonicalizeSttLanguage('ES')).toBe('es');
      expect(canonicalizeSttLanguage('  fr  ')).toBe('fr'); // 自动 trim
    });

    it('auto (any case) → AUTO sentinel', () => {
      expect(canonicalizeSttLanguage('auto')).toBe(STT_LANGUAGE_AUTO);
      expect(canonicalizeSttLanguage('AUTO')).toBe(STT_LANGUAGE_AUTO);
      expect(canonicalizeSttLanguage('Auto')).toBe(STT_LANGUAGE_AUTO);
    });

    it('BCP-47 / POSIX forms → primary subtag', () => {
      expect(canonicalizeSttLanguage('en-US')).toBe('en');
      expect(canonicalizeSttLanguage('pt_BR.UTF-8')).toBe('pt');
      expect(canonicalizeSttLanguage('zh-Hans')).toBe('en'); // zh 不在目录
    });

    it('Tagalog alias → Filipino', () => {
      expect(canonicalizeSttLanguage('tl')).toBe('fil');
      expect(canonicalizeSttLanguage('tl-PH')).toBe('fil');
    });

    it('unsupported language → en (default)', () => {
      expect(canonicalizeSttLanguage('zh')).toBe('en');
      expect(canonicalizeSttLanguage('zh-Hans')).toBe('en');
      expect(canonicalizeSttLanguage('nope')).toBe('en');
    });
  });

  describe('languageForApi', () => {
    it('never returns "auto"', () => {
      expect(languageForApi('auto')).not.toBe('auto');
      expect(languageForApi('AUTO')).not.toBe('auto');
    });

    it('returns concrete code for known', () => {
      expect(languageForApi('ja')).toBe('ja');
      expect(languageForApi('EN')).toBe('en');
    });

    it('empty / unknown → en', () => {
      expect(languageForApi('')).toBe('en');
      expect(languageForApi('xx')).toBe('en');
    });

    it('auto + no system locale → en', () => {
      expect(languageForApi('auto')).toBe('en');
    });

    it('auto + LANG=fr → fr (system locale resolved)', () => {
      process.env.LANG = 'fr_FR.UTF-8';
      expect(languageForApi('auto')).toBe('fr');
    });

    it('auto + LC_ALL=ja takes precedence over LANG', () => {
      process.env.LC_ALL = 'ja_JP.UTF-8';
      process.env.LANG = 'en_US.UTF-8';
      expect(languageForApi('auto')).toBe('ja');
    });

    it('auto + LANG=zh (not in catalog) → en fallback', () => {
      process.env.LANG = 'zh_CN.UTF-8';
      expect(languageForApi('auto')).toBe('en');
    });

    it('auto + LC_ALL=C (POSIX) → en fallback', () => {
      process.env.LC_ALL = 'C';
      process.env.LANG = 'fr_FR.UTF-8';
      expect(languageForApi('auto')).toBe('en'); // C → null → en
    });

    it('auto + LANG=tl → fil (alias resolved)', () => {
      process.env.LANG = 'tl_PH.UTF-8';
      expect(languageForApi('auto')).toBe('fil');
    });

    it('empty LC_ALL does not mask LANG (空值视为未设置)', () => {
      process.env.LC_ALL = '';
      process.env.LANG = 'de_DE.UTF-8';
      expect(languageForApi('auto')).toBe('de');
    });
  });
});
