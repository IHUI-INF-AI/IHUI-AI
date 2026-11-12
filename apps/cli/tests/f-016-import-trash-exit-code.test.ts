// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-016 回归:import / trash 的失败路径必须退非 0。
 *
 * 修前形态:参数非法 / 本地文件读不到 / 后端失败 / 回收站清单判不出,一律只
 * `console.error` + `return`,退出码停在 0 ⇒ 脚本化调用方把失败记成成功,
 * "未判定"被当成"没有"。
 * 这里直接驱动真实命令面(registerImportCommand / registerTrashCommand),
 * 网络面经 vi.mock('@ihui/api-client') 拦下;成功路径必须仍是 0 ——
 * 不为了过测试把成功也标红。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import { TRASH_MANIFEST_KIND } from '@ihui/shared/delete-guard';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §15b/§26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

const { fetchApiMock } = vi.hoisted(() => ({ fetchApiMock: vi.fn() }));

import type * as ApiClient from '@ihui/api-client';
vi.mock('@ihui/api-client', async (importOriginal) => {
  // 部分 mock:只替换 fetchApi,其余导出走真实实现(与 import-sessions.test.ts 同法)
  const actual = await importOriginal<typeof ApiClient>();
  return { ...actual, fetchApi: fetchApiMock };
});

import { registerImportCommand } from '../src/commands/import.js';
import { registerTrashCommand } from '../src/commands/trash.js';
import { getDeleteTrashDir } from '../src/tools/file-batch-edit.js';

let ws = '';
let fixtureFile = '';

function makeProgram(): Command {
  const program = new Command();
  // 参数/命令层面的 commander 报错不得直接结束测试进程
  program.exitOverride();
  program.option('-w, --workspace <path>');
  registerImportCommand(program);
  registerTrashCommand(program);
  return program;
}

/** 一次 commit 成功所需的 "解析预览" 桩(parseFile 走 fetchApi) */
function parseOk(): { success: true; data: { preview: Record<string, unknown> } } {
  return {
    success: true,
    data: {
      preview: {
        previewId: 'preview-1',
        source: 'cc-switch',
        sourcePath: fixtureFile,
        providers: [],
        globalWarnings: [],
      },
    },
  };
}

function plantManifest(trashId: string, text: string): void {
  const dir = path.join(getDeleteTrashDir(ws), trashId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), text, 'utf-8');
}

/** 铺一枚形态合法的清单,用于构造"部分判不出" */
function plantGoodManifest(trashId: string): void {
  plantManifest(
    trashId,
    JSON.stringify({
      kind: TRASH_MANIFEST_KIND,
      trashId,
      createdAtIso: '2026-11-05T00:00:00.000Z',
      workspacePath: ws,
      entries: [
        {
          originalPath: path.join(ws, 'note.txt'),
          relativeTrashPath: 'note.txt',
          sizeBytes: 3,
          kind: 'file',
        },
      ],
    }),
  );
}

beforeEach(() => {
  ws = mkScratch('f016-');
  fixtureFile = path.join(ws, 'config.json');
  fs.writeFileSync(fixtureFile, '{}', 'utf-8');
  fetchApiMock.mockReset();
  process.exitCode = 0;
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = 0;
  const dir = ws;
  ws = '';
  if (dir !== '') rmScratch(dir);
});

describe('F-016 import 失败路径退非 0', () => {
  it('无效 source ⇒ 1', async () => {
    await makeProgram().parseAsync([
      'node',
      'ihui',
      'import',
      'commit',
      'no-such-source',
      fixtureFile,
    ]);
    expect(process.exitCode).toBe(1);
  });

  it('无效 strategy ⇒ 1', async () => {
    await makeProgram().parseAsync([
      'node',
      'ihui',
      'import',
      'commit',
      'cc-switch',
      fixtureFile,
      '--strategy',
      'no-such-strategy',
    ]);
    expect(process.exitCode).toBe(1);
  });

  it('本地文件读不到 ⇒ parse / commit 两条腿都退 1', async () => {
    const missing = path.join(ws, 'missing.json');
    await makeProgram().parseAsync(['node', 'ihui', 'import', 'parse', 'cc-switch', missing]);
    expect(process.exitCode).toBe(1);

    process.exitCode = 0;
    await makeProgram().parseAsync(['node', 'ihui', 'import', 'commit', 'cc-switch', missing]);
    expect(process.exitCode).toBe(1);
    // 读取失败在本地就结束,不应发出任何后端请求
    expect(fetchApiMock).not.toHaveBeenCalled();
  });

  it('后端 commit 失败 ⇒ 1', async () => {
    fetchApiMock
      .mockResolvedValueOnce(parseOk())
      .mockResolvedValueOnce({ success: false, error: '落库失败' });
    await makeProgram().parseAsync(['node', 'ihui', 'import', 'commit', 'cc-switch', fixtureFile]);
    expect(fetchApiMock).toHaveBeenCalledTimes(2);
    expect(process.exitCode).toBe(1);
  });

  it('后端 history 失败 ⇒ 1', async () => {
    fetchApiMock.mockResolvedValueOnce({ success: false, error: '查询失败' });
    await makeProgram().parseAsync(['node', 'ihui', 'import', 'history']);
    expect(process.exitCode).toBe(1);
  });
});

describe('F-016 import / trash 成功路径仍为 0', () => {
  it('import commit 成功 ⇒ 0', async () => {
    fetchApiMock.mockResolvedValueOnce(parseOk()).mockResolvedValueOnce({
      success: true,
      data: {
        importId: 'imp-1',
        imported: 1,
        skipped: 0,
        failed: 0,
        failedDetails: [],
        configIds: [1],
      },
    });
    await makeProgram().parseAsync(['node', 'ihui', 'import', 'commit', 'cc-switch', fixtureFile]);
    expect(process.exitCode).toBe(0);
  });

  it('import history 成功(空表)⇒ 0', async () => {
    fetchApiMock.mockResolvedValueOnce({ success: true, data: { list: [], total: 0 } });
    await makeProgram().parseAsync(['node', 'ihui', 'import', 'history']);
    expect(process.exitCode).toBe(0);
  });

  it('trash list 空回收站 ⇒ 0', async () => {
    await makeProgram().parseAsync(['node', 'ihui', '--workspace', ws, 'trash', 'list']);
    expect(process.exitCode).toBe(0);
  });
});

describe('F-016 trash 清单判不出退非 0', () => {
  it('全部判不出 ⇒ 1', async () => {
    plantManifest('badcase1', '{ 这不是合法 JSON');
    await makeProgram().parseAsync(['node', 'ihui', '--workspace', ws, 'trash', 'list']);
    expect(process.exitCode).toBe(1);
  });

  it('部分判不出(仍有可读条目)⇒ 1', async () => {
    plantGoodManifest('goodcase1');
    plantManifest('badcase2', '{ 这不是合法 JSON');
    await makeProgram().parseAsync(['node', 'ihui', '--workspace', ws, 'trash', 'list']);
    expect(process.exitCode).toBe(1);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
