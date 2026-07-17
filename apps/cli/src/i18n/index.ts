export type Locale = 'zh-CN' | 'en' | 'ja' | 'ko' | 'zh-TW';

import { messages as zhCN } from './messages/zh-CN.js';
import { messages as en } from './messages/en.js';
import { messages as ja } from './messages/ja.js';
import { messages as ko } from './messages/ko.js';
import { messages as zhTW } from './messages/zh-TW.js';

type Messages = typeof zhCN;

const baseMessages: Record<Locale, Partial<Messages>> = {
  'zh-CN': zhCN,
  en,
  ja,
  ko,
  'zh-TW': zhTW,
};

let activeLocale: Locale = getLocale();

function normalizeLocale(raw: string): Locale {
  const lower = raw.toLowerCase();
  if (lower === 'zh' || lower === 'zh-cn') return 'zh-CN';
  if (lower === 'zh-tw' || lower === 'zh-hk') return 'zh-TW';
  if (lower === 'en' || lower.startsWith('en-')) return 'en';
  if (lower === 'ja' || lower.startsWith('ja-')) return 'ja';
  if (lower === 'ko' || lower.startsWith('ko-')) return 'ko';
  return 'zh-CN';
}

export function getLocale(): Locale {
  if (process.env.IHUI_LOCALE) {
    return normalizeLocale(process.env.IHUI_LOCALE);
  }
  return normalizeLocale(Intl.DateTimeFormat().resolvedOptions().locale);
}

export function setLocale(locale: Locale): void {
  activeLocale = locale;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>,
): T {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(base)) {
    const baseValue = base[key];
    const overrideValue = override[key];
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = deepMerge(
        baseValue as Record<string, unknown>,
        overrideValue as Record<string, unknown>,
      );
    } else {
      result[key] = overrideValue !== undefined ? overrideValue : baseValue;
    }
  }
  return result as T;
}

function getNestedValue(obj: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (!isPlainObject(current)) return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const active = deepMerge(
    baseMessages['zh-CN'] as unknown as Record<string, unknown>,
    baseMessages[activeLocale] as unknown as Record<string, unknown>,
  );
  const text = getNestedValue(active, key);
  if (text === undefined) {
    return key;
  }
  if (!params) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) =>
    String(params[name] ?? `{{${name}}}`),
  );
}

export const i18n = {
  getLocale,
  setLocale,
  t,
};
