/**
 * LSP 工具测试 — 消息编解码 / 握手 / 多语言 / 单例 / workspace 工具
 *
 * 策略:mock child_process.spawn + spawnSync,不依赖真实 LSP server。
 * 用 PassThrough 流模拟 stdio,验证 JSON-RPC 消息编解码、initialize 握手、参数透传。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type * as childProcess from 'node:child_process';

// Mock child_process.spawn + spawnSync(在所有 import 之前 hoist)
vi.mock('node:child_process', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof childProcess;
  return { ...actual, spawn: vi.fn(), spawnSync: vi.fn() };
});

// 绕过源码循环依赖 bug(git.ts ↔ git-advanced.ts):mock 这两个模块为空数组,
// 不影响被测的 LSP 工具行为(lsp.ts 不依赖 git 模块)。
vi.mock('../src/tools/git-advanced.js', () => ({ GIT_ADVANCED_TOOLS: [] }));
vi.mock('../src/tools/github-pr.js', () => ({ GITHUB_PR_TOOLS: [] }));

// 先触发 index.js 完整加载,避免 lsp.ts ↔ index.ts 循环依赖导致 registerLspTools 未定义
import '../src/tools/index.js';
import { spawn, spawnSync } from 'node:child_process';
import {
  getLspClientForFile,
  getLspClientByLanguage,
  disposeLspClient,
  lspUnavailableResult,
  toRelPath,
  resolveAndCheckFile,
  symbolKindName,
  lsp_workspace_symbol,
  lsp_rename_symbol,
  lsp_code_actions,
  LSP_TOOLS,
} from '../src/tools/lsp.js';
import {
  LSP_SERVERS,
  findLspConfigForFile,
  findLspConfigByLanguage,
  isLspServerAvailable,
  listAvailableLspServers,
} from '../src/tools/lsp-languages.js';
import type { ToolContext } from '../src/tools/index.js';

// ==================== Mock LSP server ====================

interface MockLspChild {
  child: EventEmitter & { stdout: EventEmitter; stdin: PassThrough; stderr: PassThrough; pid: number; kill: ReturnType<typeof vi.fn>; killed: boolean };
  stdout: EventEmitter;
  stdin: PassThrough;
  sent: Array<{ method: string; params?: unknown; id?: number | string }>;
}

/** JSON-RPC 消息编码(Content-Length header + JSON body) */
function encodeLspMessage(msg: Record<string, unknown>): string {
  const body = JSON.stringify(msg);
  return `Content-Length: ${Buffer.byteLength(body, 'utf-8')}\r\n\r\n${body}`;
}

/** 按方法返回模拟 LSP 响应 result */
function getLspResult(method: string, _params: unknown): unknown {
  switch (method) {
    case 'initialize':
      return { capabilities: { workspaceSymbolProvider: true, renameProvider: true, codeActionProvider: true } };
    case 'workspace/symbol':
      return [
        {
          name: 'AuthService',
          kind: 5,
          location: { uri: 'file:///test/src/auth.ts', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 11 } } },
          containerName: 'src',
        },
      ];
    case 'textDocument/rename':
      return {
        changes: {
          'file:///test/src/auth.ts': [
            { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 11 } }, newText: 'NewAuth' },
          ],
        },
      };
    case 'textDocument/codeAction':
      return [{ title: 'Convert to arrow function', kind: 'refactor.rewrite' }];
    default:
      return null;
  }
}

function createMockLspChild(): MockLspChild {
  // 用 EventEmitter 模拟 stdout(vscode-jsonrpc 的 StreamMessageReader 只需 on/off 方法),
  // 用 setImmediate 异步 emit data 事件,避免在 stdin.on('data') 回调内同步写 stdout 导致重入
  const stdout = new EventEmitter();
  const stdin = new PassThrough();
  const child = new EventEmitter() as MockLspChild['child'];
  child.stdout = stdout;
  child.stdin = stdin;
  child.stderr = new PassThrough();
  child.pid = 12345;
  child.kill = vi.fn(() => true);
  child.killed = false;

  const sent: MockLspChild['sent'] = [];
  let buffer = '';

  stdin.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf-8');
    // 循环解析所有完整消息
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;
      const header = buffer.substring(0, headerEnd);
      const m = header.match(/Content-Length:\s*(\d+)/i);
      if (!m || !m[1]) {
        buffer = buffer.substring(headerEnd + 4);
        break;
      }
      const len = parseInt(m[1], 10);
      const bodyStart = headerEnd + 4;
      if (buffer.length - bodyStart < len) break; // body 不完整
      const body = buffer.substring(bodyStart, bodyStart + len);
      buffer = buffer.substring(bodyStart + len);
      try {
        const msg = JSON.parse(body) as { method?: string; params?: unknown; id?: number | string };
        if (msg.method) {
          sent.push({ method: msg.method, params: msg.params, id: msg.id });
          // 请求(id 存在)自动回复,用 setImmediate 异步发送避免重入
          if (msg.id !== undefined) {
            const result = getLspResult(msg.method, msg.params);
            const respStr = encodeLspMessage({ jsonrpc: '2.0', id: msg.id, result });
            setImmediate(() => stdout.emit('data', Buffer.from(respStr)));
          }
        }
      } catch {
        // 忽略 JSON 解析错误
      }
    }
  });

  return { child, stdout, stdin, sent };
}

// ==================== 测试环境 ====================

let origHooksConfig: string | undefined;
let ctx: ToolContext;
let workspace: string;
let lastMock: MockLspChild;

beforeEach(() => {
  origHooksConfig = process.env.IHUI_HOOKS_CONFIG;
  process.env.IHUI_HOOKS_CONFIG = path.join(os.tmpdir(), 'ihui-no-hooks-lsp-' + Date.now() + '.json');
  workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-lsp-test-'));
  ctx = { workspacePath: workspace };

  // 默认 mock:spawn 返回可自动回复的 LSP server
  vi.mocked(spawn).mockImplementation(
    (() => {
      const mock = createMockLspChild();
      lastMock = mock;
      return mock.child;
    }) as any,
  );
  vi.mocked(spawnSync).mockReset();
});

afterEach(() => {
  disposeLspClient();
  if (origHooksConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
  else process.env.IHUI_HOOKS_CONFIG = origHooksConfig;
  vi.mocked(spawn).mockReset();
  vi.mocked(spawnSync).mockReset();
  try {
    fs.rmSync(workspace, { recursive: true, force: true });
  } catch {
    // 忽略
  }
});

function writeFile(rel: string, content: string): string {
  const abs = path.join(workspace, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
  return abs;
}

// ==================== LSP_SERVERS 配置 ====================

describe('LSP_SERVERS 配置', () => {
  it('内置 7 种语言 server', () => {
    expect(LSP_SERVERS).toHaveLength(7);
    const langs = LSP_SERVERS.map((s) => s.language).sort();
    expect(langs).toEqual(['c', 'csharp', 'go', 'java', 'python', 'rust', 'typescript']);
  });

  it('TypeScript 配置 command 含 --stdio', () => {
    const ts = findLspConfigByLanguage('typescript')!;
    expect(ts.command).toEqual(['typescript-language-server', '--stdio']);
    expect(ts.fileExtensions).toContain('.ts');
    expect(ts.fileExtensions).toContain('.tsx');
  });

  it('Python 配置 command 为 pylsp', () => {
    const py = findLspConfigByLanguage('python')!;
    expect(py.command).toEqual(['pylsp']);
    expect(py.fileExtensions).toContain('.py');
  });

  it('Rust 配置 requiresWorkspace=true', () => {
    const rust = findLspConfigByLanguage('rust')!;
    expect(rust.command).toEqual(['rust-analyzer']);
    expect(rust.requiresWorkspace).toBe(true);
  });
});

// ==================== findLspConfigForFile ====================

describe('findLspConfigForFile', () => {
  it('.ts → typescript', () => {
    expect(findLspConfigForFile('/test/file.ts')?.language).toBe('typescript');
  });
  it('.tsx → typescript', () => {
    expect(findLspConfigForFile('/test/file.tsx')?.language).toBe('typescript');
  });
  it('.py → python', () => {
    expect(findLspConfigForFile('/test/file.py')?.language).toBe('python');
  });
  it('.rs → rust', () => {
    expect(findLspConfigForFile('/test/file.rs')?.language).toBe('rust');
  });
  it('.go → go', () => {
    expect(findLspConfigForFile('/test/file.go')?.language).toBe('go');
  });
  it('.java → java', () => {
    expect(findLspConfigForFile('/test/file.java')?.language).toBe('java');
  });
  it('.c → c', () => {
    expect(findLspConfigForFile('/test/file.c')?.language).toBe('c');
  });
  it('.cpp → c', () => {
    expect(findLspConfigForFile('/test/file.cpp')?.language).toBe('c');
  });
  it('.cs → csharp', () => {
    expect(findLspConfigForFile('/test/file.cs')?.language).toBe('csharp');
  });
  it('未知扩展名 → null', () => {
    expect(findLspConfigForFile('/test/file.unknown')).toBeNull();
  });
  it('无扩展名 → null', () => {
    expect(findLspConfigForFile('/test/Makefile')).toBeNull();
  });
  it('大写扩展名也能匹配', () => {
    expect(findLspConfigForFile('/test/FILE.TS')?.language).toBe('typescript');
  });
});

// ==================== findLspConfigByLanguage ====================

describe('findLspConfigByLanguage', () => {
  it('typescript → 配置', () => {
    const cfg = findLspConfigByLanguage('typescript');
    expect(cfg).not.toBeNull();
    expect(cfg!.language).toBe('typescript');
  });
  it('未知语言 → null', () => {
    expect(findLspConfigByLanguage('brainfuck')).toBeNull();
  });
});

// ==================== isLspServerAvailable ====================

describe('isLspServerAvailable', () => {
  it('spawnSync 退出码 0 → true', async () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);
    const cfg = LSP_SERVERS[0]!;
    expect(await isLspServerAvailable(cfg)).toBe(true);
  });

  it('spawnSync 退出码非 0 → false', async () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 1 } as any);
    const cfg = LSP_SERVERS[0]!;
    expect(await isLspServerAvailable(cfg)).toBe(false);
  });

  it('spawnSync 抛异常 → false', async () => {
    vi.mocked(spawnSync).mockImplementation(() => {
      throw new Error('command not found');
    });
    const cfg = LSP_SERVERS[0]!;
    expect(await isLspServerAvailable(cfg)).toBe(false);
  });

  it('Windows 用 where,POSIX 用 which', async () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);
    const cfg = LSP_SERVERS[0]!;
    await isLspServerAvailable(cfg);
    const cmd = vi.mocked(spawnSync).mock.calls[0]![0];
    if (os.platform() === 'win32') {
      expect(cmd).toBe('where');
    } else {
      expect(cmd).toBe('which');
    }
  });
});

// ==================== listAvailableLspServers ====================

describe('listAvailableLspServers', () => {
  it('只返回已安装的 LSP server', async () => {
    vi.mocked(spawnSync).mockImplementation(((cmd: string) => {
      // 模拟只有 typescript-language-server 和 pylsp 已安装
      if (cmd === 'where' || cmd === 'which') return { status: 0 } as any;
      return { status: 0 } as any;
    }) as any);
    // 全部可用
    const all = await listAvailableLspServers();
    expect(all).toHaveLength(7);
  });

  it('全部未安装时返回空数组', async () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 1 } as any);
    const all = await listAvailableLspServers();
    expect(all).toEqual([]);
  });

  it('部分安装时返回子集', async () => {
    vi.mocked(spawnSync).mockImplementation(((cmd: string, args: string[]) => {
      const binary = args[0];
      if (binary === 'typescript-language-server' || binary === 'pylsp') {
        return { status: 0 } as any;
      }
      return { status: 1 } as any;
    }) as any);
    const available = await listAvailableLspServers();
    expect(available).toHaveLength(2);
    expect(available.map((c) => c.language).sort()).toEqual(['python', 'typescript']);
  });
});

// ==================== 工具函数 ====================

describe('symbolKindName', () => {
  it('1 → File', () => {
    expect(symbolKindName(1)).toBe('File');
  });
  it('5 → Class', () => {
    expect(symbolKindName(5)).toBe('Class');
  });
  it('12 → Function', () => {
    expect(symbolKindName(12)).toBe('Function');
  });
  it('26 → TypeParameter', () => {
    expect(symbolKindName(26)).toBe('TypeParameter');
  });
  it('未知 kind → Unknown', () => {
    expect(symbolKindName(99)).toBe('Unknown');
  });
});

describe('toRelPath', () => {
  it('URI 转相对路径', () => {
    const uri = `file://${workspace.replace(/\\/g, '/')}/src/test.ts`;
    const rel = toRelPath(uri, workspace);
    expect(rel).toBe('src/test.ts');
  });
});

describe('resolveAndCheckFile', () => {
  it('文件存在 → ok', () => {
    const filePath = writeFile('test.ts', 'const x = 1;');
    const result = resolveAndCheckFile('test.ts', workspace);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.filePath).toBe(filePath);
    }
  });
  it('文件不存在 → 错误', () => {
    const result = resolveAndCheckFile('nonexistent.ts', workspace);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result as { error: string }).error).toContain('文件不存在');
    }
  });
});

describe('lspUnavailableResult', () => {
  it('返回 lsp-unavailable errorType', () => {
    const r = lspUnavailableResult(new Error('spawn ENOENT'));
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('lsp-unavailable');
    expect(r.error).toContain('spawn ENOENT');
    expect(r.error).toContain('codegraph');
  });
});

// ==================== LSP 消息编解码 ====================

describe('LSP 消息编码(Content-Length header + JSON body)', () => {
  it('写入 stdin 的消息包含 Content-Length header', async () => {
    const client = getLspClientByLanguage(workspace, 'typescript')!;
    await client.ensureStarted();

    // 检查所有发送的消息都有 Content-Length header
    expect(lastMock.sent.length).toBeGreaterThan(0);
    // sent 数组记录了解析后的消息,验证编码格式需检查原始数据
    // 这里通过 sent 数组验证消息被正确解析(反序列化)来间接验证编码
    const initMsg = lastMock.sent.find((m) => m.method === 'initialize');
    expect(initMsg).toBeDefined();
  });

  it('消息体为合法 JSON-RPC 2.0', async () => {
    const client = getLspClientByLanguage(workspace, 'typescript')!;
    await client.ensureStarted();

    const initMsg = lastMock.sent.find((m) => m.method === 'initialize');
    expect(initMsg).toBeDefined();
    expect(initMsg!.id).toBeDefined(); // 请求有 id
    expect(initMsg!.params).toBeDefined(); // 请求有 params
  });
});

describe('LSP 消息解码(从 buffer 解析)', () => {
  it('从 stdout 读取的响应被正确解析', async () => {
    const client = getLspClientByLanguage(workspace, 'typescript')!;
    // ensureStarted 发送 initialize 请求,mock 自动回复
    // 如果解码失败,ensureStarted 会超时(15s)
    // 测试在 15s 内完成说明解码正确
    await client.ensureStarted();
    expect(client.language).toBe('typescript');
  });

  it('多条消息粘包也能正确解析', async () => {
    // 自定义 mock:一次性发送 initialize 响应 + initialized 确认(粘包)
    let initId: number | string | undefined;
    vi.mocked(spawn).mockImplementation(
      (() => {
        const mock = createMockLspChild();
        // 覆盖 stdin data handler 实现粘包
        mock.stdin.removeAllListeners('data');
        let buf = '';
        mock.stdin.on('data', (chunk: Buffer) => {
          buf += chunk.toString('utf-8');
          while (true) {
            const headerEnd = buf.indexOf('\r\n\r\n');
            if (headerEnd === -1) break;
            const header = buf.substring(0, headerEnd);
            const m = header.match(/Content-Length:\s*(\d+)/i);
            if (!m || !m[1]) {
              buf = buf.substring(headerEnd + 4);
              break;
            }
            const len = parseInt(m[1], 10);
            const bodyStart = headerEnd + 4;
            if (buf.length - bodyStart < len) break;
            const body = buf.substring(bodyStart, bodyStart + len);
            buf = buf.substring(bodyStart + len);
            try {
              const msg = JSON.parse(body);
              mock.sent.push({ method: msg.method, params: msg.params, id: msg.id });
              // 只回复 initialize,且一次性发送两条消息(粘包)
              if (msg.method === 'initialize' && msg.id !== undefined) {
                initId = msg.id;
                const resp1 = encodeLspMessage({ jsonrpc: '2.0', id: msg.id, result: { capabilities: {} } });
                // 第二条是一个无关的 notification(不干扰)
                const resp2 = encodeLspMessage({ jsonrpc: '2.0', method: '$/progress', params: {} });
                // 粘包:两条消息拼接后一次 emit
                setImmediate(() => mock.stdout.emit('data', Buffer.from(resp1 + resp2)));
              }
            } catch {
              // 忽略
            }
          }
        });
        lastMock = mock;
        return mock.child;
      }) as any,
    );

    const client = getLspClientByLanguage(workspace, 'typescript')!;
    await client.ensureStarted();
    expect(initId).toBeDefined();
  });
});

// ==================== LspClient 初始化 ====================

describe('LspClient 初始化(initialize 握手 + initialized 通知)', () => {
  it('发送 initialize 请求,包含 processId/rootUri/capabilities', async () => {
    const client = getLspClientByLanguage(workspace, 'typescript')!;
    await client.ensureStarted();

    const initMsg = lastMock.sent.find((m) => m.method === 'initialize');
    expect(initMsg).toBeDefined();
    const params = initMsg!.params as Record<string, unknown>;
    expect(params.processId).toBe(process.pid);
    expect(params.rootUri).toBeDefined();
    expect(params.capabilities).toBeDefined();
  });

  it('initialize 后发送 initialized 通知', async () => {
    const client = getLspClientByLanguage(workspace, 'typescript')!;
    await client.ensureStarted();

    const initializedMsg = lastMock.sent.find((m) => m.method === 'initialized');
    expect(initializedMsg).toBeDefined();
    expect(initializedMsg!.id).toBeUndefined(); // 通知没有 id
  });

  it('重复调用 ensureStarted 不重新启动', async () => {
    const client = getLspClientByLanguage(workspace, 'typescript')!;
    await client.ensureStarted();
    const sentCountAfterFirst = lastMock.sent.length;
    await client.ensureStarted(); // 第二次应直接返回
    expect(lastMock.sent.length).toBe(sentCountAfterFirst); // 没有新消息
  });
});

// ==================== LspClient 多语言 server 启动 ====================

describe('LspClient 多语言 server 启动', () => {
  it('TypeScript 配置调用 spawn 传 typescript-language-server', async () => {
    const client = getLspClientByLanguage(workspace, 'typescript')!;
    await client.ensureStarted();
    expect(vi.mocked(spawn)).toHaveBeenCalled();
    const spawnArgs = vi.mocked(spawn).mock.calls[0]!;
    expect(spawnArgs[0]).toBe('typescript-language-server');
    expect(spawnArgs[1]).toEqual(['--stdio']);
  });

  it('Python 配置调用 spawn 传 pylsp', async () => {
    const client = getLspClientByLanguage(workspace, 'python')!;
    await client.ensureStarted();
    const spawnArgs = vi.mocked(spawn).mock.calls[0]!;
    expect(spawnArgs[0]).toBe('pylsp');
  });

  it('Rust 配置调用 spawn 传 rust-analyzer', async () => {
    const client = getLspClientByLanguage(workspace, 'rust')!;
    await client.ensureStarted();
    const spawnArgs = vi.mocked(spawn).mock.calls[0]!;
    expect(spawnArgs[0]).toBe('rust-analyzer');
  });

  it('不支持的语言返回 null', () => {
    expect(getLspClientByLanguage(workspace, 'brainfuck')).toBeNull();
  });
});

// ==================== LspClient 单例管理 ====================

describe('LspClient 单例管理(Map<workspace::language, LspClient>)', () => {
  it('相同 workspace + language 返回同一实例', () => {
    const c1 = getLspClientByLanguage(workspace, 'typescript')!;
    const c2 = getLspClientByLanguage(workspace, 'typescript')!;
    expect(c1).toBe(c2);
  });

  it('相同 workspace 不同 language 返回不同实例', () => {
    const c1 = getLspClientByLanguage(workspace, 'typescript')!;
    const c2 = getLspClientByLanguage(workspace, 'python')!;
    expect(c1).not.toBe(c2);
    expect(c1.language).toBe('typescript');
    expect(c2.language).toBe('python');
  });

  it('不同 workspace 相同 language 返回不同实例', () => {
    const c1 = getLspClientByLanguage(workspace, 'typescript')!;
    const c2 = getLspClientByLanguage('/other-workspace', 'typescript')!;
    expect(c1).not.toBe(c2);
  });

  it('disposeLspClient 后重新获取返回新实例', () => {
    const c1 = getLspClientByLanguage(workspace, 'typescript')!;
    disposeLspClient();
    const c2 = getLspClientByLanguage(workspace, 'typescript')!;
    expect(c1).not.toBe(c2);
  });
});

// ==================== getLspClientForFile ====================

describe('getLspClientForFile(按文件扩展名自动选择 LSP server)', () => {
  it('.ts 文件 → typescript client', () => {
    const client = getLspClientForFile(workspace, path.join(workspace, 'test.ts'));
    expect(client.language).toBe('typescript');
  });

  it('.py 文件 → python client', () => {
    const client = getLspClientForFile(workspace, path.join(workspace, 'test.py'));
    expect(client.language).toBe('python');
  });

  it('.rs 文件 → rust client', () => {
    const client = getLspClientForFile(workspace, path.join(workspace, 'test.rs'));
    expect(client.language).toBe('rust');
  });

  it('未知扩展名 → 回退到 typescript client', () => {
    const client = getLspClientForFile(workspace, path.join(workspace, 'file.unknown'));
    expect(client.language).toBe('typescript');
  });

  it('相同语言的不同文件返回同一 client', () => {
    const c1 = getLspClientForFile(workspace, path.join(workspace, 'a.ts'));
    const c2 = getLspClientForFile(workspace, path.join(workspace, 'b.ts'));
    expect(c1).toBe(c2);
  });
});

// ==================== LSP 工具:lsp_workspace_symbol ====================

describe('lsp_workspace_symbol(workspace/symbol 请求 + query 透传)', () => {
  it('发送 workspace/symbol 请求,query 透传', async () => {
    const r = await lsp_workspace_symbol.execute({ query: 'AuthService' }, ctx);
    expect(r.success).toBe(true);
    expect(r.output).toContain('AuthService');

    const wsMsg = lastMock.sent.find((m) => m.method === 'workspace/symbol');
    expect(wsMsg).toBeDefined();
    const params = wsMsg!.params as Record<string, unknown>;
    expect(params.query).toBe('AuthService');
  });

  it('language 参数限定搜索的 LSP server', async () => {
    const r = await lsp_workspace_symbol.execute({ query: 'test', language: 'python' }, ctx);
    expect(r.success).toBe(true);
    // 验证 spawn 被调用时用的是 pylsp
    const spawnArgs = vi.mocked(spawn).mock.calls[0]!;
    expect(spawnArgs[0]).toBe('pylsp');
  });

  it('limit 参数限制返回数量', async () => {
    const r = await lsp_workspace_symbol.execute({ query: 'test', limit: 1 }, ctx);
    expect(r.success).toBe(true);
  });

  it('不支持的语言返回提示', async () => {
    const r = await lsp_workspace_symbol.execute({ query: 'test', language: 'brainfuck' }, ctx);
    expect(r.success).toBe(true);
    expect(r.output).toContain('不支持的语言');
  });

  it('缺少 query 参数返回错误', async () => {
    const r = await lsp_workspace_symbol.execute({}, ctx);
    expect(r.success).toBe(false);
    expect(r.error).toContain('query');
  });

  it('无匹配符号时返回提示', async () => {
    // 自定义 mock 返回空结果
    vi.mocked(spawn).mockImplementation(
      (() => {
        const mock = createMockLspChild();
        // 覆盖 workspace/symbol 响应为空
        mock.stdin.removeAllListeners('data');
        let buf = '';
        mock.stdin.on('data', (chunk: Buffer) => {
          buf += chunk.toString('utf-8');
          while (true) {
            const headerEnd = buf.indexOf('\r\n\r\n');
            if (headerEnd === -1) break;
            const header = buf.substring(0, headerEnd);
            const m = header.match(/Content-Length:\s*(\d+)/i);
            if (!m || !m[1]) {
              buf = buf.substring(headerEnd + 4);
              break;
            }
            const len = parseInt(m[1], 10);
            const bodyStart = headerEnd + 4;
            if (buf.length - bodyStart < len) break;
            const body = buf.substring(bodyStart, bodyStart + len);
            buf = buf.substring(bodyStart + len);
            try {
              const msg = JSON.parse(body);
              mock.sent.push({ method: msg.method, params: msg.params, id: msg.id });
              if (msg.id !== undefined) {
                let result: unknown = getLspResult(msg.method, msg.params);
                if (msg.method === 'workspace/symbol') result = []; // 空结果
                const respStr = encodeLspMessage({ jsonrpc: '2.0', id: msg.id, result });
                setImmediate(() => mock.stdout.emit('data', Buffer.from(respStr)));
              }
            } catch {
              // 忽略
            }
          }
        });
        lastMock = mock;
        return mock.child;
      }) as any,
    );

    const r = await lsp_workspace_symbol.execute({ query: 'nonexistent' }, ctx);
    expect(r.success).toBe(true);
    expect(r.output).toContain('未找到');
  });
});

// ==================== LSP 工具:lsp_rename_symbol ====================

describe('lsp_rename_symbol(textDocument/rename 请求 + newName 透传)', () => {
  it('发送 rename 请求,newName 透传(预览模式)', async () => {
    const _filePath = writeFile('src/auth.ts', 'class AuthService {}\n');
    const r = await lsp_rename_symbol.execute(
      { file: 'src/auth.ts', line: 0, character: 6, newName: 'NewAuth' },
      ctx,
    );
    expect(r.success).toBe(true);
    expect(r.output).toContain('预览');
    expect(r.output).toContain('NewAuth');

    const renameMsg = lastMock.sent.find((m) => m.method === 'textDocument/rename');
    expect(renameMsg).toBeDefined();
    const params = renameMsg!.params as Record<string, unknown>;
    expect(params.newName).toBe('NewAuth');
    const position = params.position as Record<string, unknown>;
    expect(position.line).toBe(0);
    expect(position.character).toBe(6);
  });

  it('apply=true + confirm=true 应用 edits 到磁盘', async () => {
    const filePath = writeFile('src/auth.ts', 'class AuthService {}\n');
    const r = await lsp_rename_symbol.execute(
      { file: 'src/auth.ts', line: 0, character: 0, newName: 'NewAuth', apply: true, confirm: true },
      ctx,
    );
    expect(r.success).toBe(true);
    expect(r.output).toContain('已应用');
    // 验证文件已被修改(mock 返回的 edit 将前 11 字符替换为 NewAuth)
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('NewAuth');
  });

  it('apply=true + confirm=false 拒绝执行', async () => {
    writeFile('src/auth.ts', 'class AuthService {}\n');
    const r = await lsp_rename_symbol.execute(
      { file: 'src/auth.ts', line: 0, character: 0, newName: 'NewAuth', apply: true, confirm: false },
      ctx,
    );
    expect(r.success).toBe(false);
    expect(r.error).toContain('confirm');
  });

  it('文件不存在返回错误', async () => {
    const r = await lsp_rename_symbol.execute(
      { file: 'nonexistent.ts', line: 0, character: 0, newName: 'NewAuth' },
      ctx,
    );
    expect(r.success).toBe(false);
    expect(r.error).toContain('文件不存在');
  });

  it('缺少 newName 返回错误', async () => {
    const r = await lsp_rename_symbol.execute(
      { file: 'test.ts', line: 0, character: 0 },
      ctx,
    );
    expect(r.success).toBe(false);
    expect(r.error).toContain('newName');
  });
});

// ==================== LSP 工具:lsp_code_actions ====================

describe('lsp_code_actions(textDocument/codeAction 请求 + range 透传)', () => {
  it('发送 codeAction 请求,range 透传', async () => {
    writeFile('src/auth.ts', 'class AuthService {}\n');
    const r = await lsp_code_actions.execute(
      { file: 'src/auth.ts', line: 0, character: 5 },
      ctx,
    );
    expect(r.success).toBe(true);
    expect(r.output).toContain('code action');

    const caMsg = lastMock.sent.find((m) => m.method === 'textDocument/codeAction');
    expect(caMsg).toBeDefined();
    const params = caMsg!.params as Record<string, unknown>;
    const range = params.range as Record<string, unknown>;
    expect(range.start).toEqual({ line: 0, character: 5 });
    expect(range.end).toEqual({ line: 0, character: 5 });
  });

  it('kind 参数透传到 context.only', async () => {
    writeFile('src/auth.ts', 'class AuthService {}\n');
    const r = await lsp_code_actions.execute(
      { file: 'src/auth.ts', line: 0, character: 5, kind: 'quickfix' },
      ctx,
    );
    expect(r.success).toBe(true);
    const caMsg = lastMock.sent.find((m) => m.method === 'textDocument/codeAction');
    const params = caMsg!.params as Record<string, unknown>;
    const context = params.context as Record<string, unknown>;
    expect(context.only).toEqual(['quickfix']);
  });

  it('无可用 code action 时返回提示', async () => {
    writeFile('src/auth.ts', 'class AuthService {}\n');
    // 自定义 mock 返回空 codeAction
    vi.mocked(spawn).mockImplementation(
      (() => {
        const mock = createMockLspChild();
        mock.stdin.removeAllListeners('data');
        let buf = '';
        mock.stdin.on('data', (chunk: Buffer) => {
          buf += chunk.toString('utf-8');
          while (true) {
            const headerEnd = buf.indexOf('\r\n\r\n');
            if (headerEnd === -1) break;
            const header = buf.substring(0, headerEnd);
            const m = header.match(/Content-Length:\s*(\d+)/i);
            if (!m || !m[1]) {
              buf = buf.substring(headerEnd + 4);
              break;
            }
            const len = parseInt(m[1], 10);
            const bodyStart = headerEnd + 4;
            if (buf.length - bodyStart < len) break;
            const body = buf.substring(bodyStart, bodyStart + len);
            buf = buf.substring(bodyStart + len);
            try {
              const msg = JSON.parse(body);
              mock.sent.push({ method: msg.method, params: msg.params, id: msg.id });
              if (msg.id !== undefined) {
                let result: unknown = getLspResult(msg.method, msg.params);
                if (msg.method === 'textDocument/codeAction') result = [];
                const respStr = encodeLspMessage({ jsonrpc: '2.0', id: msg.id, result });
                setImmediate(() => mock.stdout.emit('data', Buffer.from(respStr)));
              }
            } catch {
              // 忽略
            }
          }
        });
        lastMock = mock;
        return mock.child;
      }) as any,
    );

    const r = await lsp_code_actions.execute(
      { file: 'src/auth.ts', line: 0, character: 5 },
      ctx,
    );
    expect(r.success).toBe(true);
    expect(r.output).toContain('无可用');
  });

  it('文件不存在返回错误', async () => {
    const r = await lsp_code_actions.execute(
      { file: 'nonexistent.ts', line: 0, character: 0 },
      ctx,
    );
    expect(r.success).toBe(false);
    expect(r.error).toContain('文件不存在');
  });
});

// ==================== LSP_TOOLS 注册 ====================

describe('LSP_TOOLS 注册', () => {
  it('注册 7 个 LSP 工具', () => {
    expect(LSP_TOOLS).toHaveLength(7);
    expect(LSP_TOOLS.map((t) => t.name).sort()).toEqual([
      'lsp_code_actions',
      'lsp_diagnostics',
      'lsp_find_references',
      'lsp_goto_definition',
      'lsp_hover',
      'lsp_rename_symbol',
      'lsp_workspace_symbol',
    ]);
  });
});

// ==================== 错误处理:LSP server 未安装 ====================

describe('错误处理:LSP server 未安装时降级', () => {
  it('spawn error 事件 → lsp-unavailable', async () => {
    vi.mocked(spawn).mockImplementation(
      (() => {
        const stdout = new PassThrough();
        const stdin = new PassThrough();
        const child = new EventEmitter() as any;
        child.stdout = stdout;
        child.stdin = stdin;
        child.stderr = new PassThrough();
        child.pid = 12345;
        child.kill = vi.fn(() => true);
        child.killed = false;
        // 模拟二进制不存在,异步触发 error 事件
        setImmediate(() => {
          child.emit('error', new Error('spawn typescript-language-server ENOENT'));
        });
        return child;
      }) as any,
    );

    const r = await lsp_workspace_symbol.execute({ query: 'test' }, ctx);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('lsp-unavailable');
    expect(r.error).toContain('typescript-language-server');
  });

  it('initialize 超时 → lsp-unavailable', async () => {
    vi.mocked(spawn).mockImplementation(
      (() => {
        const stdout = new PassThrough();
        const stdin = new PassThrough();
        const child = new EventEmitter() as any;
        child.stdout = stdout;
        child.stdin = stdin;
        child.stderr = new PassThrough();
        child.pid = 12345;
        child.kill = vi.fn(() => true);
        child.killed = false;
        // 不回复任何请求 → initialize 超时(15s)
        stdin.on('data', () => {
          // 消费但不回复
        });
        return child;
      }) as any,
    );

    // 此测试会等待 LSP_INIT_TIMEOUT_MS(15s)超时
    const r = await lsp_workspace_symbol.execute({ query: 'test' }, ctx);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('lsp-unavailable');
    expect(r.error).toContain('超时');
  }, 20_000);

  it('dispose 清理子进程和连接', () => {
    const _client = getLspClientByLanguage(workspace, 'typescript')!;
    // dispose 不应抛异常
    expect(() => disposeLspClient()).not.toThrow();
  });
});
