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
import { t as realT } from '../src/i18n/index.js';

/**
 * D163 收口刀验收:三态判据 → 八句文案的分派,必须**有牙**。
 *
 * 钉六件事,方向两两相反:
 *   1. 确证变了 ⇒ undoFailedChanged(不许降级成"判不了");
 *   2. 读不出来   ⇒ undoFailedUnverifiable(不许谎称"已发生变化");
 *   3. 部分失败   ⇒ undoPartialWarning(票面专为 CLI 写的那句);
 *   4. 没动过手   ⇒ undoUnavailable(无快照:检查点里没有条目);
 *   5. 动过手全败 ⇒ undoFailed(暂时不可用) —— 与 4 必须是**两句不同的话**;
 *   6. 干净成功   ⇒ undoSucceeded(带 {count} 插值)。
 * 反向锁三条:确证优先(1 压 2)、比对结论翻成 changed 时 4/5 的承诺句必须消失、
 * 以及 4 与 5 的分档不得合并。
 */

function snap(entries: Record<string, FileState>): WorkspaceSnapshot {
  return new Map(Object.entries(entries));
}

const present = (content: string): FileState => ({ kind: 'present', content });
const unknown = (reason: string): FileState => ({ kind: 'unknown', reason });

describe('D163 键表', () => {
  it('八键、无重复、含 undoFailed(不可用原因分档的第二句)', () => {
    expect([...UNDO_CLAIM_KEYS].sort()).toEqual([
      'undoConfirm',
      'undoFailed',
      'undoFailedChanged',
      'undoFailedUnverifiable',
      'undoPartialWarning',
      'undoPreparing',
      'undoSucceeded',
      'undoUnavailable',
    ]);
    expect(UNDO_CLAIM_KEYS).toContain('undoFailed');
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
    expect(
      selectUndoClaimKey({ verdict: 'changed', partial: true, undoneSteps: 1, attemptedSteps: 2 }),
    ).toBe('undoFailedChanged');
  });

  it('② 判不了 ⇒ undoFailedUnverifiable', () => {
    expect(
      selectUndoClaimKey({ verdict: 'unknown', partial: false, undoneSteps: 2, attemptedSteps: 2 }),
    ).toBe('undoFailedUnverifiable');
  });

  it('③ 部分失败(且工作区未变)⇒ undoPartialWarning', () => {
    expect(
      selectUndoClaimKey({ verdict: 'unchanged', partial: true, undoneSteps: 1, attemptedSteps: 2 }),
    ).toBe('undoPartialWarning');
  });

  it('④a 没动过手(检查点里没有条目)⇒ undoUnavailable', () => {
    expect(
      selectUndoClaimKey({ verdict: 'unchanged', partial: false, undoneSteps: 0, attemptedSteps: 0 }),
    ).toBe('undoUnavailable');
  });

  it('④b 动过手但一条也没撤成 ⇒ undoFailed(暂时不可用)', () => {
    expect(
      selectUndoClaimKey({ verdict: 'unchanged', partial: true, undoneSteps: 0, attemptedSteps: 2 }),
    ).toBe('undoFailed');
  });

  it('⑤ 干净成功 ⇒ undoSucceeded', () => {
    expect(
      selectUndoClaimKey({ verdict: 'unchanged', partial: false, undoneSteps: 3, attemptedSteps: 3 }),
    ).toBe('undoSucceeded');
  });

  it('反向锁:确证优先 —— changed 压过 partial 与尝试数', () => {
    expect(
      selectUndoClaimKey({ verdict: 'changed', partial: true, undoneSteps: 0, attemptedSteps: 2 }),
    ).toBe('undoFailedChanged');
  });

  it('分档锁:同一份"全失败"事实,不许把 ④a 与 ④b 并成一句', () => {
    const noAttempt = selectUndoClaimKey({
      verdict: 'unchanged',
      partial: false,
      undoneSteps: 0,
      attemptedSteps: 0,
    });
    const attemptedAllFailed = selectUndoClaimKey({
      verdict: 'unchanged',
      partial: true,
      undoneSteps: 0,
      attemptedSteps: 2,
    });
    expect(noAttempt).toBe('undoUnavailable');
    expect(attemptedAllFailed).toBe('undoFailed');
    expect(noAttempt).not.toBe(attemptedAllFailed);
  });

  it('反向锁:比对结论翻成 changed ⇒ ④b 不再说"未发生变化"那一句', () => {
    const unchanged = selectUndoClaimKey({
      verdict: 'unchanged',
      partial: true,
      undoneSteps: 0,
      attemptedSteps: 2,
    });
    const changed = selectUndoClaimKey({
      verdict: 'changed',
      partial: true,
      undoneSteps: 0,
      attemptedSteps: 2,
    });
    expect(unchanged).toBe('undoFailed');
    expect(changed).toBe('undoFailedChanged');
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
    expect(
      renderUndoClaim({ verdict: 'unchanged', partial: false, undoneSteps: 7, attemptedSteps: 7 }, t),
    ).toBe('cliEntry.undoSucceeded|{"count":7}');
    expect(
      renderUndoClaim({ verdict: 'changed', partial: false, undoneSteps: 7, attemptedSteps: 7 }, t),
    ).toBe('cliEntry.undoFailedChanged');
  });

  it('前缀与键表拼接后,八键全部落在 cliEntry 命名空间', () => {
    for (const key of UNDO_CLAIM_KEYS) {
      expect(UNDO_CLAIM_KEY_PREFIX + key).toMatch(/^cliEntry\.undo[A-Z]/);
    }
  });
});

describe('D163 真实词包:不可用原因两档不再同一句', () => {
  const noSnapshot = {
    verdict: 'unchanged',
    partial: false,
    undoneSteps: 0,
    attemptedSteps: 0,
  } as const;
  const allFailed = {
    verdict: 'unchanged',
    partial: true,
    undoneSteps: 0,
    attemptedSteps: 2,
  } as const;

  it('无快照 vs 全失败:渲染出的中文文案不同,且各自点名原因', () => {
    const a = renderUndoClaim(noSnapshot, realT);
    const b = renderUndoClaim(allFailed, realT);
    expect(a).not.toBe(b);
    expect(a).toContain('文件检查点不可用');
    expect(b).toContain('CLI 文件检查点暂时不可用');
    // 两句承诺都只在"真的没变"这一族里出现,事实门在上游 verdict
    expect(a).toContain('工作区未发生变化');
    expect(b).toContain('工作区未发生变化');
  });

  it('反向锁:同一份全失败事实,比对结论翻成 changed ⇒ 不得再出现"未发生变化"', () => {
    const changed = renderUndoClaim({ ...allFailed, verdict: 'changed' }, realT);
    expect(changed).not.toContain('未发生变化');
    expect(changed).toContain('已发生变化');
  });
});
