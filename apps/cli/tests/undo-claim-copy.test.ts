// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest';

import {
  renderUndoClaim,
  renderUndoConfirm,
  renderUndoPreparing,
  renderUndoSucceeded,
  selectUndoClaimKey,
  UNDO_CLAIM_KEYS,
  UNDO_CLAIM_KEY_PREFIX,
} from '../src/commands/undo-claim-copy.js';
import {
  classifyUndoVerdict,
  type FileState,
  type WorkspaceSnapshot,
} from '../src/commands/undo-workspace-state.js';

/**
 * D163 收口刀验收:三态判据 → 七句文案的分派,必须**有牙**。
 *
 * 钉五件事,方向两两相反:
 *   1. 确证变了 ⇒ undoFailedChanged(不许降级成"判不了");
 *   2. 读不出来   ⇒ undoFailedUnverifiable(不许谎称"已发生变化");
 *   3. 部分失败   ⇒ undoPartialWarning(票面专为 CLI 写的那句);
 *   4. 无步可撤   ⇒ undoUnavailable(承诺只在真的没动时说);
 *   5. 干净成功   ⇒ undoSucceeded(带 {count} 插值)。
 * 反向锁两条:确证优先(1 压 2)、以及把判据恒真 ⇒ 失败两态必须消失。
 */

function snap(entries: Record<string, FileState>): WorkspaceSnapshot {
  return new Map(Object.entries(entries));
}

const present = (content: string): FileState => ({ kind: 'present', content });
const unknown = (reason: string): FileState => ({ kind: 'unknown', reason });

describe('D163 键表', () => {
  it('七键、无重复、刻意不含 undoFailed(语义被 undoPartialWarning/undoUnavailable 覆盖)', () => {
    expect([...UNDO_CLAIM_KEYS].sort()).toEqual([
      'undoConfirm',
      'undoFailedChanged',
      'undoFailedUnverifiable',
      'undoPartialWarning',
      'undoPreparing',
      'undoSucceeded',
      'undoUnavailable',
    ]);
    expect(UNDO_CLAIM_KEYS).not.toContain('undoFailed');
    expect(new Set(UNDO_CLAIM_KEYS).size).toBe(UNDO_CLAIM_KEYS.length);
  });
});

describe('D163 classifyUndoVerdict 三态', () => {
  it('逐字节等价 ⇒ unchanged', () => {
    const before = snap({ '/a': present('x') });
    const after = snap({ '/a': present('x') });
    expect(classifyUndoVerdict(before, after)).toBe('unchanged');
  });

  it('内容不同 ⇒ changed', () => {
    expect(
      classifyUndoVerdict(snap({ '/a': present('x') }), snap({ '/a': present('y') })),
    ).toBe('changed');
  });

  it('一侧 absent 一侧 present ⇒ changed', () => {
    expect(
      classifyUndoVerdict(snap({ '/a': { kind: 'absent' } }), snap({ '/a': present('y') })),
    ).toBe('changed');
  });

  it('只读不出来 ⇒ unknown(没事实就不许声称)', () => {
    expect(
      classifyUndoVerdict(snap({ '/a': present('x') }), snap({ '/a': unknown('EACCES') })),
    ).toBe('unknown');
  });

  it('反向锁:确证变化 + 另有读不出来 ⇒ 仍判 changed(确证不许被降级)', () => {
    const before = snap({ '/a': present('x'), '/b': present('y') });
    const after = snap({ '/a': present('CHANGED'), '/b': unknown('EBUSY') });
    expect(classifyUndoVerdict(before, after)).toBe('changed');
  });
});

describe('D163 selectUndoClaimKey 分派', () => {
  it('① 确证变了 ⇒ undoFailedChanged', () => {
    expect(selectUndoClaimKey({ verdict: 'changed', partial: false, undoneSteps: 2 })).toBe(
      'undoFailedChanged',
    );
  });

  it('② 判不了 ⇒ undoFailedUnverifiable', () => {
    expect(selectUndoClaimKey({ verdict: 'unknown', partial: false, undoneSteps: 2 })).toBe(
      'undoFailedUnverifiable',
    );
  });

  it('③ 部分失败(且工作区未变)⇒ undoPartialWarning', () => {
    expect(selectUndoClaimKey({ verdict: 'unchanged', partial: true, undoneSteps: 1 })).toBe(
      'undoPartialWarning',
    );
  });

  it('④ 无步可撤 + 未变 ⇒ undoUnavailable', () => {
    expect(selectUndoClaimKey({ verdict: 'unchanged', partial: false, undoneSteps: 0 })).toBe(
      'undoUnavailable',
    );
  });

  it('⑤ 干净成功 ⇒ undoSucceeded', () => {
    expect(selectUndoClaimKey({ verdict: 'unchanged', partial: false, undoneSteps: 3 })).toBe(
      'undoSucceeded',
    );
  });

  it('反向锁:确证优先 —— changed 压过 partial 与 undoneSteps', () => {
    expect(selectUndoClaimKey({ verdict: 'changed', partial: true, undoneSteps: 0 })).toBe(
      'undoFailedChanged',
    );
  });
});

describe('D163 渲染', () => {
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}|${JSON.stringify(params)}` : key;

  it('undoSucceeded 带 count 插值', () => {
    expect(renderUndoSucceeded(4, t)).toBe('cliEntry.undoSucceeded|{"count":4}');
  });

  it('undoConfirm 带 fileCount 与 turnCount 两个插值', () => {
    expect(renderUndoConfirm(3, 2, t)).toBe('cliEntry.undoConfirm|{"fileCount":3,"turnCount":2}');
  });

  it('preparing 走同一前缀,无插值', () => {
    expect(renderUndoPreparing(t)).toBe('cliEntry.undoPreparing');
  });

  it('renderUndoClaim 对成功态补 count,对其余态不补', () => {
    expect(renderUndoClaim({ verdict: 'unchanged', partial: false, undoneSteps: 7 }, t)).toBe(
      'cliEntry.undoSucceeded|{"count":7}',
    );
    expect(renderUndoClaim({ verdict: 'changed', partial: false, undoneSteps: 7 }, t)).toBe(
      'cliEntry.undoFailedChanged',
    );
  });

  it('前缀与键表拼接后,七键全部落在 cliEntry 命名空间', () => {
    for (const key of UNDO_CLAIM_KEYS) {
      expect(UNDO_CLAIM_KEY_PREFIX + key).toMatch(/^cliEntry\.undo[A-Z]/);
    }
  });
});
