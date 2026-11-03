// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D163 收口刀:CLI 词包与 UNDO_CLAIM_KEYS 的五语 parity。
 *
 * 为什么放在 apps/cli/tests 而不是 packages/i18n/tests(web 侧那份的位置):
 * 本档要 import `UNDO_CLAIM_KEYS` 作**单一真相源**(§0.6)。parity 的意义是
 * "代码里的键表"与"词包里的键"逐字对上,不是再造第三份写死的清单 ——
 * 那样只会多一处会漂移的副本,而对账恰恰是用来抓漂移的。
 *
 * 有牙自证:取一个必然不存在的键,检测器必须报缺失;否则"键齐"这条断言
 * 恒绿,等于没判。
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { UNDO_CLAIM_KEYS, UNDO_FAILURE_LIST_KEYS } from '../src/commands/undo-claim-copy.js';

const here = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = join(here, '..', '..', '..', 'packages', 'i18n', 'messages', 'cli');
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const;

/** D163 收口刀额外要的选项说明键 + D22046 失败文件清单三键(同属 undo 词包)。 */
const EXTRA_KEYS: readonly string[] = [...UNDO_FAILURE_LIST_KEYS, 'undoDryRunDesc'];

type Messages = Record<string, unknown>;

function load(locale: string): Messages {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as Messages;
}

function cliEntry(locale: string): Record<string, unknown> {
  const section = load(locale).cliEntry;
  if (typeof section !== 'object' || section === null) {
    throw new Error(`${locale}: cliEntry 命名空间缺失`);
  }
  return section as Record<string, unknown>;
}

function value(locale: string, key: string): string | undefined {
  const v = cliEntry(locale)[key];
  return typeof v === 'string' ? v : undefined;
}

describe('D163 CLI 词包 parity(五语 × 八键 + 选项说明)', () => {
  for (const locale of LOCALES) {
    it(`${locale}: 八键与失败清单三键、undoDryRunDesc 齐、值非空`, () => {
      for (const key of [...UNDO_CLAIM_KEYS, ...EXTRA_KEYS]) {
        const v = value(locale, key);
        expect(v, `${locale}/${key}`).toBeDefined();
        expect(v!.length, `${locale}/${key}`).toBeGreaterThan(0);
      }
    });

    it(`${locale}: 不可用原因两档必须是两句不同的话(不再一律同一句)`, () => {
      const unavailable = value(locale, 'undoUnavailable')!;
      const failed = value(locale, 'undoFailed')!;
      expect(failed, locale).not.toBe(unavailable);
    });
  }

  it('undoConfirm 两个插值 {fileCount}/{turnCount} 五语一致', () => {
    for (const locale of LOCALES) {
      const text = value(locale, 'undoConfirm')!;
      expect(text, locale).toContain('{fileCount}');
      expect(text, locale).toContain('{turnCount}');
    }
  });

  it('undoSucceeded 插值 {count} 五语一致', () => {
    for (const locale of LOCALES) {
      expect(value(locale, 'undoSucceeded')!, locale).toContain('{count}');
    }
  });

  it('D22046 失败清单三键的插值占位五语一致', () => {
    for (const locale of LOCALES) {
      // 标题必须同时给"文件数"与"轮次"两个数:只有文件数会让用户多试几次。
      expect(value(locale, 'undoFailedFilesTitle')!, locale).toContain('{count}');
      expect(value(locale, 'undoFailedFilesTitle')!, locale).toContain('{turns}');
      expect(value(locale, 'undoFailedFilesMore')!, locale).toContain('{count}');
      const line = value(locale, 'undoFailedFileLine')!;
      expect(line, locale).toContain('{file}');
      expect(line, locale).toContain('{reason}');
    }
  });

  it('失败两态与"未发生变化"三态互不串台:changed/unverifiable 的文案不得含承诺句', () => {
    for (const locale of LOCALES) {
      const changed = value(locale, 'undoFailedChanged')!;
      const unverifiable = value(locale, 'undoFailedUnverifiable')!;
      // 承诺句只属于 unchanged 那一族(undoUnavailable / undoFailed / undoPartialWarning)
      expect(changed, locale).not.toContain('未发生变化');
      expect(changed, locale).not.toContain('has not changed');
      expect(unverifiable, locale).not.toContain('未发生变化');
      expect(unverifiable, locale).not.toContain('has not changed');
    }
  });

  it('有牙自证:不存在的键必须被报成缺失(否则"键齐"恒绿,等于没判)', () => {
    for (const locale of LOCALES) {
      expect(value(locale, 'undoThisKeyDoesNotExistAnywhere')).toBeUndefined();
    }
  });

  it('键表与词包双向齐:代码侧八键 ⊆ 词包八键(不多造承诺键)', () => {
    for (const locale of LOCALES) {
      const inPack = UNDO_CLAIM_KEYS.filter((k) => value(locale, k) !== undefined);
      expect(inPack.length, locale).toBe(UNDO_CLAIM_KEYS.length);
    }
  });
});
