// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * D113 CLI 端 tool-delta **状态语义**行为测试。
 *
 * 四条判据与 `apps/mobile-rn/tests/tool-delta-frames.test.ts`、
 * `apps/miniapp-taro/tests/tool-delta-frames.test.ts` 同形 —— 三端各自实现、同一套行为,
 * 才是"同一个 UX 语义"的实证;少一条就是某一端偷偷改了规矩:
 *   ① 按 toolCallId 整帧覆盖写入;
 *   ② 同 seq 重放幂等(seq 不参与判断);
 *   ③ 空 toolCallId 丢弃(不产出、也不污染既有帧);
 *   ④ result 到达即清除(最终 diff 以 result 为准)。
 * 另加本端特有的一条:渲染门 `running && 非空`(终端没有常驻卡片,"卡片还开着"= spinner 在跑)。
 */
import { describe, expect, it } from 'vitest';

import {
  createToolDeltaPreviewStore,
  pickToolDeltaPreviewText,
} from '../src/tools/file-edit-preview.js';

describe('D113 CLI tool-delta 状态语义', () => {
  it('① 按 toolCallId 覆盖式写入 partialDiff', () => {
    const store = createToolDeltaPreviewStore();
    expect(store.apply({ toolCallId: 'tc-1', seq: 1, partialText: 'line1\nline2' })).toBe(true);
    expect(store.get('tc-1')).toEqual({ partialText: 'line1\nline2', truncated: false });
  });

  it('② 同 seq 重放幂等:重复投同一帧不叠加、不改值', () => {
    const store = createToolDeltaPreviewStore();
    const frame = { toolCallId: 'tc-1', seq: 2, partialText: 'v1\nv2' };
    store.apply(frame);
    store.apply(frame);
    expect(store.get('tc-1')?.partialText).toBe('v1\nv2');
    expect(store.ids()).toEqual(['tc-1']);
  });

  it('② 累积帧覆盖:后一帧整帧替换前一帧(不是拼接)', () => {
    const store = createToolDeltaPreviewStore();
    store.apply({ toolCallId: 'tc-1', seq: 1, partialText: 'a' });
    store.apply({ toolCallId: 'tc-1', seq: 2, partialText: 'a\nb' });
    expect(store.get('tc-1')?.partialText).toBe('a\nb');
  });

  it('③ 空 toolCallId 丢弃:apply 返回 false 且不留条目', () => {
    const store = createToolDeltaPreviewStore();
    expect(store.apply({ toolCallId: '', seq: 1, partialText: 'ghost' })).toBe(false);
    expect(store.ids()).toEqual([]);
    // 已有条目不得被一条空 id 的坏帧带跑
    store.apply({ toolCallId: 'tc-1', seq: 1, partialText: 'real' });
    store.apply({ toolCallId: '', seq: 2, partialText: 'ghost' });
    expect(store.get('tc-1')?.partialText).toBe('real');
    expect(store.ids()).toEqual(['tc-1']);
  });

  it('④ result 到达即清除:清完再取是 undefined,而非空串', () => {
    const store = createToolDeltaPreviewStore();
    store.apply({ toolCallId: 'tc-1', seq: 1, partialText: 'preview' });
    store.clear('tc-1');
    expect(store.get('tc-1')).toBeUndefined();
    expect(store.ids()).toEqual([]);
  });

  it('④ 流中断走 clearAll:一次调用都没落下终态时不留残余', () => {
    const store = createToolDeltaPreviewStore();
    store.apply({ toolCallId: 'tc-1', seq: 1, partialText: 'a' });
    store.apply({ toolCallId: 'tc-2', seq: 1, partialText: 'b' });
    store.clearAll();
    expect(store.ids()).toEqual([]);
  });

  it('多个工具并行时按 id 各管各的,互不覆盖', () => {
    const store = createToolDeltaPreviewStore();
    store.apply({ toolCallId: 'tc-1', seq: 1, partialText: 'only-1' });
    store.apply({ toolCallId: 'tc-2', seq: 1, partialText: 'only-2' });
    expect(store.get('tc-1')?.partialText).toBe('only-1');
    expect(store.get('tc-2')?.partialText).toBe('only-2');
    store.clear('tc-1');
    expect(store.get('tc-1')).toBeUndefined();
    expect(store.get('tc-2')?.partialText).toBe('only-2');
  });

  it('渲染门:仅 running 且预览非空才输出(完成态不得残留预览框)', () => {
    const store = createToolDeltaPreviewStore();
    store.apply({ toolCallId: 'tc-1', seq: 1, partialText: '+const a = 1' });
    const preview = store.get('tc-1');
    expect(pickToolDeltaPreviewText({ running: true, preview })).toBe('+const a = 1');
    // 非 running(卡片已收)→ 不输出
    expect(pickToolDeltaPreviewText({ running: false, preview })).toBeNull();
    // 无预览 / 空预览 → 不输出(不占行、不打空框)
    expect(pickToolDeltaPreviewText({ running: true, preview: undefined })).toBeNull();
    expect(
      pickToolDeltaPreviewText({ running: true, preview: { partialText: '', truncated: false } }),
    ).toBeNull();
    // result 清除后渲染门自动关 —— 与"完成态不残留"是同一条判据的两半
    store.clear('tc-1');
    expect(pickToolDeltaPreviewText({ running: true, preview: store.get('tc-1') })).toBeNull();
  });
});
