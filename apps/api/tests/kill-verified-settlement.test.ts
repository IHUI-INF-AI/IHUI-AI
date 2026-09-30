// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-998132(票3)—— 杀完的终态按 OS 事实判:命令派发成功 ≠ killed:true。
 *
 * 立因(上游 processTreeTerminator.ts:165-176 判据):taskkill runner 报错**且**
 * isPidAlive(pid) 才算真失败 —— 命令非零但进程确实没了 = 不误报失败;
 * 进程还在但命令成功 = 也不装成功。G-670 立的是"杀前验身份",本票立"杀后验事实"。
 *
 * 全程注入 deps(inspect/runKill/isAlive),不派生任何真实 taskkill/kill。
 */
import { describe, expect, it, vi } from 'vitest';
import {
  killProcessVerified,
  type KillIdentityExpectation,
  type ProcIdentitySnapshot,
} from '../src/utils/kill-verified.js';

const MINE: ProcIdentitySnapshot = {
  executablePath: 'D:\\nodejs\\node.exe',
  commandLine: 'node dist/server.js --port 8801',
};
const expectation: KillIdentityExpectation = { commandLineAnyOf: ['8801'] };
const identityOk = { inspect: async () => MINE };

describe('G-998132 终态按 OS 事实结算(deps.runKill + deps.isAlive 成对注入)', () => {
  it('(a) runKill 成功且 OS 复核进程已消失 ⇒ killed:true,无 observation', async () => {
    const runKill = vi.fn(async (_bin: string, _argv: string[]) => ({
      ok: true,
      output: 'SUCCESS: The process with PID 4242 has been terminated.',
    }));
    const isAlive = vi.fn(async (_pid: number) => false);
    const out = await killProcessVerified(4242, expectation, { ...identityOk, runKill, isAlive });
    expect(out.killed).toBe(true);
    if (out.killed) expect(out.observation).toBeUndefined();
    expect(runKill).toHaveBeenCalledTimes(1);
    expect(isAlive).toHaveBeenCalledWith(4242);
  });

  it('(b) runKill 报失败但 OS 复核进程已消失 ⇒ 仍结算为已不在(带 observation,非假失败)', async () => {
    const runKill = vi.fn(async (_bin: string, _argv: string[]) => ({
      ok: false,
      output: 'ERROR: Access is denied.',
    }));
    const isAlive = vi.fn(async (_pid: number) => false);
    const out = await killProcessVerified(4242, expectation, { ...identityOk, runKill, isAlive });
    expect(out.killed).toBe(true);
    if (out.killed) {
      expect(out.observation).toContain('4242');
      expect(out.observation).toContain('已不在');
      expect(out.observation).toContain('Access is denied');
    }
  });

  it('(c) runKill 报失败且 OS 复核进程仍在 ⇒ 不得报 killed:true(reason: kill-verify-failed)', async () => {
    const runKill = vi.fn(async (_bin: string, _argv: string[]) => ({
      ok: false,
      output: 'ERROR: Access is denied.',
    }));
    const isAlive = vi.fn(async (_pid: number) => true);
    const out = await killProcessVerified(4242, expectation, { ...identityOk, runKill, isAlive });
    expect(out.killed).toBe(false);
    if (!out.killed) {
      expect(out.reason).toBe('kill-verify-failed');
      expect(out.record).toContain('4242');
      expect(out.record).toContain('Access is denied');
    }
  });

  it('(d) runKill 报成功但 OS 复核进程仍在 ⇒ 同样不装成功(killed:false / kill-verify-failed)', async () => {
    const runKill = vi.fn(async (_bin: string, _argv: string[]) => ({
      ok: true,
      output: 'SUCCESS: The process with PID 4242 has been terminated.',
    }));
    const isAlive = vi.fn(async (_pid: number) => true);
    const out = await killProcessVerified(4242, expectation, { ...identityOk, runKill, isAlive });
    expect(out.killed).toBe(false);
    if (!out.killed) {
      expect(out.reason).toBe('kill-verify-failed');
      expect(out.record).toContain('在场');
    }
  });

  it('(e) 存活复核口异常 ⇒ 保守按仍在处理,不装成功', async () => {
    const runKill = vi.fn(async (_bin: string, _argv: string[]) => ({ ok: true, output: 'SUCCESS' }));
    const isAlive = vi.fn(async (_pid: number) => {
      throw new Error('probe down');
    });
    const out = await killProcessVerified(4242, expectation, { ...identityOk, runKill, isAlive });
    expect(out.killed).toBe(false);
    if (!out.killed) {
      expect(out.reason).toBe('kill-verify-failed');
      expect(out.record).toContain('probe down');
    }
  });

  it('(f) 旧形 runKill(裸字符串,未带 ok 维)⇒ 不误伤:OS 复核已消失仍 killed:true', async () => {
    const runKill = vi.fn(async (_bin: string, _argv: string[]) => 'done');
    const isAlive = vi.fn(async (_pid: number) => false);
    const out = await killProcessVerified(4242, expectation, { ...identityOk, runKill, isAlive });
    expect(out.killed).toBe(true);
    if (out.killed) expect(out.observation).toBeUndefined();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
