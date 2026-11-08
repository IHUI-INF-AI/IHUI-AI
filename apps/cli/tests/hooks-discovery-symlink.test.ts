// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { HooksDiscovery } from '../src/hooks/discovery.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边

/** 本机能否建**文件**符号链接(Windows 需开发者模式/管理员):不能就如实 skip,不冒充 passed。 */
const CAN_FILE_SYMLINK = (() => {
  const d = mkScratch('hooks-link-cap-');
  try {
    const real = path.join(d, 'real.txt');
    fs.writeFileSync(real, 'x');
    const link = path.join(d, 'link.txt');
    fs.symlinkSync(real, link, 'file');
    return fs.lstatSync(link).isSymbolicLink();
  } catch {
    return false;
  } finally {
    try {
      rmScratch(d);
    } catch {
      // 探针目录清理失败不影响能力判定
    }
  }
})();
const itLink = CAN_FILE_SYMLINK ? it : it.skip;
const LINK_CASE_COUNT = 1;
if (!CAN_FILE_SYMLINK) {
  console.warn(
    `[hooks-discovery-symlink] 本机不能建文件符号链接 ⇒ 跳过 ${LINK_CASE_COUNT} 条 symlink 用例(skip,不计覆盖);` +
      '拒绝语义的同等价路径由 tasks-atomic-write 的 lstat-mock 用例覆盖。',
  );
}

let scratch = '';
const prevHome = process.env.HOME;
const prevUserProfile = process.env.USERPROFILE;

beforeAll(() => {
  scratch = mkScratch('hooks-discovery-symlink-');
  // 隔离用户级 hooks 目录,免得扫到开发机真实的 ~/.ihui-agent/hooks
  process.env.HOME = scratch;
  process.env.USERPROFILE = scratch;
});

afterAll(() => {
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  if (prevUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = prevUserProfile;
  try {
    rmScratch(scratch);
  } catch (err) {
    console.warn(`[hooks-discovery-symlink] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

function tmpLeftovers(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.includes('.tmp-')) : [];
}

describe('DBG-46 hooks discovery 状态文件目标是符号链接', () => {
  itLink('写入被拒 ⇒ SymlinkTargetError,链接与真身均未被改动,无 tmp 残留', () => {
    const ws = path.join(scratch, 'ws');
    const dir = path.join(ws, '.ihui-agent', 'hooks');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'demo.mjs'),
      "---\nname: demo\n---\nconsole.log('demo hook')\n",
      'utf-8',
    );
    const real = path.join(ws, 'hooks-state-real.json');
    fs.writeFileSync(real, JSON.stringify({}, null, 2));
    const before = fs.readFileSync(real);
    const link = path.join(dir, '.state.json');
    fs.symlinkSync(real, link, 'file');

    const discovery = new HooksDiscovery(ws);
    expect(discovery.discover().some((hook) => hook.name === 'demo')).toBe(true);

    let thrown: unknown = null;
    try {
      discovery.enable('demo');
    } catch (err) {
      thrown = err;
    }

    expect((thrown as { code?: string })?.code).toBe('symlink_target');
    expect((thrown as Error)?.name).toBe('SymlinkTargetError');
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(real).equals(before)).toBe(true);
    expect(tmpLeftovers(dir)).toEqual([]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
