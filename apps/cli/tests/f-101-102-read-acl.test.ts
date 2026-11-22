// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-101 / F-102 回归锁:读侧 ACL 的"子目录 / 越界形态"与 grep 通道的同一把尺。
 *
 * 两张票同族:读数入口不止 `read_file` 一处,凭据件只要有一条通道没接 ACL,
 * "不可读"就只是文案。这里钉三件行为(判据一律 import 被测方,零复算规则表):
 * ① 子目录凭据件命中最深那条递归尾段规则(`apps/web/.env.local`),且例外族(模板件)
 *    仍按声明序先生效 —— 收紧不得误伤合法读;
 * ② 越界绝对路径(`C:\proj\.env`)在**任何 fs 调用之前**被拒;
 * ③ `grep` 的搜索根被钳制在工作区内;工作区内正常命中;命中文件逐枚过同一读侧判据
 *    (凭据件正文不得经搜索通道漏进结果)。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CREDENTIAL_FILE_ACCESS_RULES,
  decideFileAccess,
  toAclPath,
} from '../src/sandbox/file-access-policy.js';
import { grep, read_file } from '../src/tools/builtins.js';
import type { ToolContext } from '../src/tools/index.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §15b/§26 唯一落点(禁 os.tmpdir/裸 mkdtemp、不得在仓库树内造 git 夹具=门 208)

const TOKEN = 'f101f102needle';

describe('F-101 读侧 ACL 对子目录 / 越界 .env 生效', () => {
  it('① apps/web/.env.local 命中最深层 .env 规则,例外族不误伤', () => {
    const rules = CREDENTIAL_FILE_ACCESS_RULES;
    const dotted = decideFileAccess('read', 'apps/web/.env.local', rules);
    expect(dotted.decision).toBe('deny');
    expect(dotted.rule?.pattern).toBe('**/.env.*');

    const bare = decideFileAccess('read', 'apps/web/.env', rules);
    expect(bare.decision).toBe('deny');
    expect(bare.rule?.pattern).toBe('**/.env');

    // 反向对照:同一尾段形态的模板件仍放行(否则 `**/.env.*` 会把合法读一并拒掉)
    expect(decideFileAccess('read', 'apps/web/.env.example', rules).decision).toBe('allow');
    expect(decideFileAccess('read', 'apps/web/.env.template', rules).decision).toBe('allow');
  });

  it('② C:\\proj\\.env 越界绝对路径被拒,且拒绝发生在 fs 之前', async () => {
    const ws = mkScratch('ihui-f101-');
    try {
      const aclPath = toAclPath(ws, 'C:\\proj\\.env');
      expect(decideFileAccess('read', aclPath, CREDENTIAL_FILE_ACCESS_RULES).decision).toBe('deny');

      // 消费点实证:目标不存在也不会先撞 ENOENT —— 事实上它连 stat 都不该走到
      const ctx = { workspacePath: ws } as unknown as ToolContext;
      const result = await read_file.execute({ path: 'C:\\proj\\.env' }, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('[file-acl deny]');
      expect(result.error).not.toContain('文件不存在');
    } finally {
      rmScratch(ws);
    }
  });
});

describe('F-102 grep 通道接同一读侧 ACL', () => {
  it('③ 搜索根越界被拒;工作区内正常命中;凭据件正文不进结果', async () => {
    const ws = mkScratch('ihui-f102-ws-');
    const outside = mkScratch('ihui-f102-out-');
    try {
      writeFileSync(path.join(ws, 'notes.txt'), `${TOKEN}-ok\n`, 'utf-8');
      mkdirSync(path.join(ws, 'apps', 'web'), { recursive: true });
      writeFileSync(path.join(ws, 'apps', 'web', '.env.local'), `TOKEN=${TOKEN}-secret\n`, 'utf-8');
      writeFileSync(path.join(ws, 'apps', 'web', 'server.pem'), `${TOKEN}-secret\n`, 'utf-8');
      writeFileSync(path.join(outside, 'outside.txt'), `${TOKEN}-outside\n`, 'utf-8');

      const ctx = { workspacePath: ws } as unknown as ToolContext;

      const denied = await grep.execute({ pattern: TOKEN, path: outside }, ctx);
      expect(denied.success).toBe(false);
      expect(denied.error).toContain('搜索根必须位于工作区内');

      const inside = await grep.execute({ pattern: TOKEN }, ctx);
      expect(inside.success).toBe(true);
      expect(inside.output).toContain('notes.txt');
      // 同一份 evaluateFileAccess 逐文件过滤:凭据件命中不得把正文漏出来
      expect(inside.output).not.toContain(`${TOKEN}-secret`);
      expect(inside.output).not.toContain('outside.txt');
    } finally {
      rmScratch(ws);
      rmScratch(outside);
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
