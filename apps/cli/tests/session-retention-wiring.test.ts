// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话保留策略接线回归(2026-09-26 实现票)。
 *
 * 钉的是三条行为,缺一条就意味着"已声明、从未执行"回潮:
 *  1. saveSession(写生命周期点)触发 pruneOldSessions ⇒ 超 7 天的旧会话文件被删;
 *  2. 节流窗口内第二次 saveSession **不再**扫删(策略被动执行但不放大成每写必扫);
 *  3. IHUI_SESSION_PRUNE_DISABLED=1 显式关闭通道在位(测试隔离/人工排障出口)。
 * vitest 每文件独立模块注册表 ⇒ 本文件的节流从 0 起算;用例间依赖声明顺序(节流窗口),
 * 旧会话一律**直接落盘**制造 —— 若经 saveSession 造旧档,会先吃掉节流窗口(第一版就踩了)。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  saveSession,
  loadSession,
  getSessionStatePath,
  pruneOldSessions,
  newSessionId,
  type SessionState,
} from '../src/sessions/index.js';

let tmpStateDir: string;

beforeEach(() => {
  tmpStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-sess-retention-'));
  process.env.IHUI_SESSION_STATE_DIR = tmpStateDir;
  delete process.env.IHUI_SESSION_PRUNE_DISABLED;
});

afterEach(() => {
  delete process.env.IHUI_SESSION_STATE_DIR;
  delete process.env.IHUI_SESSION_PRUNE_DISABLED;
  if (tmpStateDir && fs.existsSync(tmpStateDir)) {
    fs.rmSync(tmpStateDir, { recursive: true, force: true });
  }
});

function makeState(ageDays: number): SessionState {
  const stamp = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: newSessionId(),
    sessionId: 'sess-retention-' + Math.random().toString(36).slice(2),
    createdAt: stamp,
    updatedAt: stamp,
    model: 'test-model',
    messages: [],
    status: 'completed',
  };
}

/** 直接把会话文件写到盘上(不经 saveSession,免得消耗节流窗口) */
function seedOnDisk(state: SessionState): void {
  fs.writeFileSync(getSessionStatePath(state.id), JSON.stringify(state, null, 2), 'utf-8');
}

describe('会话保留策略:写前裁剪已装车', () => {
  it('1) 环境开关 =1 时裁剪不执行(显式关闭通道在位)', () => {
    process.env.IHUI_SESSION_PRUNE_DISABLED = '1';
    const old = makeState(8);
    seedOnDisk(old);
    saveSession(makeState(0));
    expect(fs.existsSync(getSessionStatePath(old.id))).toBe(true);
  });

  it('2) saveSession 触发裁剪:8 天前的旧会话被删,新会话完好(接线主判据)', () => {
    const old = makeState(8);
    seedOnDisk(old);
    const fresh = makeState(0);
    saveSession(fresh);
    expect(fs.existsSync(getSessionStatePath(old.id))).toBe(false);
    expect(loadSession(fresh.id)).not.toBeNull();
  });

  it('3) 节流:60s 窗口内再写不扫删;直调 pruneOldSessions 仍能清(能力在场、触发受节流)', () => {
    const old2 = makeState(9);
    seedOnDisk(old2);
    saveSession(makeState(0)); // 用例 2 已开启节流窗口 ⇒ 这次不裁剪
    expect(fs.existsSync(getSessionStatePath(old2.id))).toBe(true);
    expect(pruneOldSessions()).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(getSessionStatePath(old2.id))).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
