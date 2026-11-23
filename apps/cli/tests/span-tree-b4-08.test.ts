// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-08 启动 span 树判据(2026-11-23)。全部用伪时钟驱动 —— 判据不读真实时间,
 * 也不允许测试依赖机器快慢(§22c:测试 import 生产判据,不复制字面量)。
 */
import { describe, expect, it } from 'vitest';

import {
  createSpanTree,
  renderSpanLine,
  SPAN_STATE_MEASURED,
  SPAN_STATE_OVERLAPPED,
  SPAN_STATE_UNJUDGED,
} from '../src/startup/span-tree.js';

function fakeClock(): { now: () => number; set: (ms: number) => void } {
  let cursor = 0;
  return {
    now: () => cursor,
    set: (ms: number) => {
      cursor = ms;
    },
  };
}

describe('B4-08 span tree', () => {
  it('单根单段:measured 且耗时随伪时钟', () => {
    const clock = fakeClock();
    const tree = createSpanTree(clock.now);
    clock.set(10);
    const handle = tree.open('boot');
    clock.set(42);
    handle.close();
    const reading = tree.reading();
    expect(reading.state).toBe(SPAN_STATE_MEASURED);
    if (reading.state !== SPAN_STATE_MEASURED) return;
    expect(reading.spanCount).toBe(1);
    expect(reading.roots).toEqual(['boot']);
    expect(reading.maxDepth).toBe(1);
    expect(reading.totalMs).toBe(32);
    expect(reading.slowest).toEqual({ name: 'boot', ms: 32 });
  });

  it('嵌套两段:深度与父子预算各自正确', () => {
    const clock = fakeClock();
    const tree = createSpanTree(clock.now);
    clock.set(1);
    const root = tree.open('boot');
    clock.set(2);
    const child = tree.open('config');
    clock.set(5);
    child.close();
    clock.set(9);
    root.close();
    const reading = tree.reading();
    expect(reading.state).toBe(SPAN_STATE_MEASURED);
    if (reading.state !== SPAN_STATE_MEASURED) return;
    expect(reading.spanCount).toBe(2);
    expect(reading.maxDepth).toBe(2);
    expect(reading.totalMs).toBe(8);
    // 父 8ms > 子 3ms ⇒ 最慢段是根
    expect(reading.slowest).toEqual({ name: 'boot', ms: 8 });
  });

  it('同父并发同名 ⇒ overlapped(后到那段不被吞成"不存在")', () => {
    const clock = fakeClock();
    const tree = createSpanTree(clock.now);
    clock.set(1);
    const root = tree.open('boot');
    clock.set(2);
    const first = tree.open('probe');
    clock.set(3);
    const second = tree.open('probe');
    clock.set(4);
    first.close();
    second.close();
    clock.set(5);
    root.close();
    const reading = tree.reading();
    expect(reading.state).toBe(SPAN_STATE_OVERLAPPED);
    if (reading.state !== SPAN_STATE_OVERLAPPED) return;
    expect(reading.overlapCount).toBe(1);
    expect(reading.first).toEqual({ parent: 'boot', name: 'probe' });
  });

  it('不同父下的同名段不算覆盖', () => {
    const clock = fakeClock();
    const tree = createSpanTree(clock.now);
    clock.set(1);
    const r1 = tree.open('a');
    clock.set(2);
    const c1 = tree.open('load');
    clock.set(3);
    c1.close();
    clock.set(4);
    r1.close();
    clock.set(5);
    const r2 = tree.open('b');
    clock.set(6);
    const c2 = tree.open('load');
    clock.set(7);
    c2.close();
    clock.set(8);
    r2.close();
    const reading = tree.reading();
    expect(reading.state).toBe(SPAN_STATE_MEASURED);
    if (reading.state !== SPAN_STATE_MEASURED) return;
    expect(reading.spanCount).toBe(4);
    expect(reading.roots).toEqual(['a', 'b']);
  });

  it('未闭合 ⇒ unjudged 并点名', () => {
    const clock = fakeClock();
    const tree = createSpanTree(clock.now);
    clock.set(1);
    tree.open('boot');
    const reading = tree.reading();
    expect(reading.state).toBe(SPAN_STATE_UNJUDGED);
    if (reading.state !== SPAN_STATE_UNJUDGED) return;
    expect(reading.reason).toBe('span-unclosed');
    expect(reading.detail).toContain('boot');
  });

  it('缺必需 span ⇒ unjudged 点名缺失项', () => {
    const clock = fakeClock();
    const tree = createSpanTree(clock.now, { required: ['boot', 'ready'] });
    clock.set(1);
    const boot = tree.open('boot');
    clock.set(2);
    boot.close();
    const reading = tree.reading();
    expect(reading.state).toBe(SPAN_STATE_UNJUDGED);
    if (reading.state !== SPAN_STATE_UNJUDGED) return;
    expect(reading.reason).toBe('missing-required');
    expect(reading.detail).toBe('ready');
  });

  it('时钟回拨出现负时长 ⇒ unjudged 不冒充 measured', () => {
    const clock = fakeClock();
    const tree = createSpanTree(clock.now);
    clock.set(100);
    const handle = tree.open('boot');
    clock.set(50);
    handle.close();
    const reading = tree.reading();
    expect(reading.state).toBe(SPAN_STATE_UNJUDGED);
    if (reading.state !== SPAN_STATE_UNJUDGED) return;
    expect(reading.reason).toBe('non-monotonic');
    expect(reading.detail).toBe('boot');
  });

  it('子段跑到父段开合区间之外 ⇒ unjudged', () => {
    const clock = fakeClock();
    const tree = createSpanTree(clock.now);
    clock.set(0);
    const root = tree.open('boot');
    clock.set(10);
    const child = tree.open('config');
    clock.set(20);
    root.close();
    clock.set(30);
    child.close();
    const reading = tree.reading();
    expect(reading.state).toBe(SPAN_STATE_UNJUDGED);
    if (reading.state !== SPAN_STATE_UNJUDGED) return;
    expect(reading.reason).toBe('non-monotonic');
    expect(reading.detail).toBe('config');
  });

  it('stopAt 达成后新 open 被停采并计数', () => {
    const clock = fakeClock();
    const tree = createSpanTree(clock.now, { stopAt: 'ready' });
    clock.set(1);
    const ready = tree.open('ready');
    clock.set(2);
    expect(tree.stopped()).toBe(false);
    ready.close();
    expect(tree.stopped()).toBe(true);
    clock.set(3);
    tree.open('late');
    tree.open('later');
    expect(tree.stoppedOpenCount()).toBe(2);
    const reading = tree.reading();
    expect(reading.state).toBe(SPAN_STATE_MEASURED);
    if (reading.state !== SPAN_STATE_MEASURED) return;
    expect(reading.spanCount).toBe(1);
  });

  it('stopAt 达成前的 open 不受影响', () => {
    const clock = fakeClock();
    const tree = createSpanTree(clock.now, { stopAt: 'ready' });
    clock.set(1);
    const boot = tree.open('boot');
    clock.set(2);
    const ready = tree.open('ready');
    clock.set(3);
    ready.close();
    clock.set(4);
    boot.close();
    expect(tree.stopped()).toBe(true);
    expect(tree.stoppedOpenCount()).toBe(0);
  });

  it('最慢段取最长;等长时保留先出现的', () => {
    const clock = fakeClock();
    const tree = createSpanTree(clock.now);
    clock.set(0);
    const a = tree.open('a');
    clock.set(10);
    a.close();
    clock.set(10);
    const b = tree.open('b');
    clock.set(20);
    b.close();
    const reading = tree.reading();
    expect(reading.state).toBe(SPAN_STATE_MEASURED);
    if (reading.state !== SPAN_STATE_MEASURED) return;
    expect(reading.slowest).toEqual({ name: 'a', ms: 10 });
  });

  it('unjudged / overlapped 行不出现任何耗时读数', () => {
    const clock = fakeClock();
    const tree = createSpanTree(clock.now);
    clock.set(1);
    tree.open('boot');
    const unjudgedLine = renderSpanLine(tree.reading());
    expect(unjudgedLine).toContain('state=unjudged');
    expect(unjudgedLine).not.toMatch(/\d+(\.\d+)?ms/);

    const overlayTree = createSpanTree(clock.now);
    clock.set(10);
    const root = overlayTree.open('boot');
    clock.set(11);
    const first = overlayTree.open('probe');
    clock.set(12);
    const second = overlayTree.open('probe');
    clock.set(13);
    first.close();
    second.close();
    clock.set(14);
    root.close();
    const overlayLine = renderSpanLine(overlayTree.reading());
    expect(overlayLine).toContain('state=overlapped');
    expect(overlayLine).not.toMatch(/\d+(\.\d+)?ms/);
  });

  it('close 幂等:重复闭合不改变账面', () => {
    const clock = fakeClock();
    const tree = createSpanTree(clock.now);
    clock.set(1);
    const handle = tree.open('boot');
    clock.set(5);
    handle.close();
    clock.set(9);
    handle.close();
    const reading = tree.reading();
    expect(reading.state).toBe(SPAN_STATE_MEASURED);
    if (reading.state !== SPAN_STATE_MEASURED) return;
    expect(reading.totalMs).toBe(4);
  });

  it('零缺省:一次 open 都没有 ⇒ unjudged(no-spans) 且渲染点名', () => {
    const tree = createSpanTree(fakeClock().now);
    const reading = tree.reading();
    expect(reading.state).toBe(SPAN_STATE_UNJUDGED);
    if (reading.state !== SPAN_STATE_UNJUDGED) return;
    expect(reading.reason).toBe('no-spans');
    expect(renderSpanLine(reading)).toContain('reason=no-spans');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
