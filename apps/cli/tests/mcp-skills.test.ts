// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SEP-2640 Skills over MCP 客户端测试。
 *
 * 钉六件事：
 *   1. 只在 resources + skills 扩展同时声明时启用；
 *   2. skills/list 分页、条目形状、frontmatter.name 与目录名一致；
 *   3. resources/read 的 digest/size 验真（不一致就拒绝，不把坏内容交给模型）；
 *   4. dynamic manifest 不伪装成已验证；
 *   5. directoryRead 未声明时不得调用目录读取；
 *   6. 工具面：列表不取文件；加载工具带 approval:'ask'，且只读 SKILL.md/显式文件。
 */
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  McpSkillIntegrityError,
  McpSkillProtocolError,
  createMcpSkillTools,
  getMcpSkill,
  listMcpSkillDirectory,
  listMcpSkills,
  parseMcpSkillEntry,
  parseMcpSkillsCapability,
  readMcpSkillFile,
  resolveMcpSkillUri,
  type McpSkillEntry,
} from '../src/tools/mcp-skills.js';
import { mcpSkillToolsForConnection, type McpConnection } from '../src/tools/mcp-runtime.js';

function digest(text: string): string {
  return `sha256:${createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex')}`;
}

const skillText =
  '---\nname: code-review\ndescription: Review code using the team checklist.\n---\n\n# Code review\n';
const checklistText = '# Review checklist\nCheck correctness, tests, and compatibility.\n';

function makeEntry(overrides: Partial<McpSkillEntry> = {}): McpSkillEntry {
  return {
    uri: 'skill://code-review/SKILL.md',
    frontmatter: {
      name: 'code-review',
      description: 'Review code using the team checklist.',
    },
    resources: [
      { uri: 'skill://code-review/SKILL.md', digest: digest(skillText), size: Buffer.byteLength(skillText) },
      {
        uri: 'skill://code-review/references/checklist.md',
        digest: digest(checklistText),
        size: Buffer.byteLength(checklistText),
      },
    ],
    ...overrides,
  };
}

/** 生产 `rpc` 已把 JSON-RPC 外壳拆成 result；fixture 与生产同形，不喂外壳。 */
function jsonRpc(result: unknown): unknown {
  return result;
}

describe('Skills capability', () => {
  it('requires resources + skills extension, directoryRead defaults false', () => {
    expect(parseMcpSkillsCapability(undefined)).toBeNull();
    expect(parseMcpSkillsCapability({})).toBeNull();
    expect(parseMcpSkillsCapability({ resources: {}, extensions: {} })).toBeNull();
    expect(
      parseMcpSkillsCapability({
        resources: {},
        extensions: { 'io.modelcontextprotocol/skills': {} },
      }),
    ).toEqual({ directoryRead: false });
    expect(
      parseMcpSkillsCapability({
        resources: {},
        extensions: { 'io.modelcontextprotocol/skills': { directoryRead: true } },
      }),
    ).toEqual({ directoryRead: true });
  });
});

describe('Skills list/get', () => {
  it('follows nextCursor and validates entries', async () => {
    const rpc = vi.fn(async (method: string, params: Record<string, unknown>) => {
      if (method !== 'skills/list') throw new Error(`unexpected ${method}`);
      if (!params.cursor) {
        return jsonRpc({ resultType: 'complete', skills: [makeEntry()], nextCursor: 'p2', ttlMs: 1000 });
      }
      return jsonRpc({
        resultType: 'complete',
        skills: [
          {
            ...makeEntry(),
            uri: 'skill://deploy/SKILL.md',
            frontmatter: { name: 'deploy', description: 'Deploy safely.' },
            resources: [
              {
                uri: 'skill://deploy/SKILL.md',
                digest: `sha256:${'0'.repeat(64)}`,
                size: 1,
              },
            ],
          },
        ],
      });
    });
    const page = await listMcpSkills(rpc);
    expect(page.skills.map((s) => s.frontmatter.name)).toEqual(['code-review', 'deploy']);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('rejects name mismatch, missing SKILL.md, duplicate uri and broken digest', () => {
    const mismatch = { ...makeEntry(), frontmatter: { name: 'other', description: 'x' } };
    expect(() => parseMcpSkillEntry(mismatch)).toThrow(McpSkillProtocolError);

    const noRoot = {
      ...makeEntry(),
      resources: [
        {
          uri: 'skill://code-review/references/checklist.md',
          digest: digest(checklistText),
          size: Buffer.byteLength(checklistText),
        },
      ],
    };
    expect(() => parseMcpSkillEntry(noRoot)).toThrow(/SKILL.md/);

    const badDigest = {
      ...makeEntry(),
      resources: [{ uri: 'skill://code-review/SKILL.md', digest: 'sha256:xyz', size: 10 }],
    };
    expect(() => parseMcpSkillEntry(badDigest)).toThrow(/digest/);

    const manifest = makeEntry().resources;
    if (manifest === 'dynamic') throw new Error('fixture must have manifest');
    expect(() =>
      parseMcpSkillEntry({
        ...makeEntry(),
        resources: [...manifest, manifest[0]],
      }),
    ).toThrow(/重复/);
  });

  it('detects list cursor cycles and invalid resultType', async () => {
    const deploy = makeEntry({
      uri: 'skill://deploy/SKILL.md',
      frontmatter: { name: 'deploy', description: 'Deploy safely.' },
      resources: [
        { uri: 'skill://deploy/SKILL.md', digest: digest('deploy'), size: Buffer.byteLength('deploy') },
      ],
    });
    let page = 0;
    const cycle = vi.fn(async () =>
      jsonRpc({
        resultType: 'complete',
        skills: [page++ === 0 ? makeEntry() : deploy],
        nextCursor: 'same',
      }),
    );
    await expect(listMcpSkills(cycle)).rejects.toThrow(/环/);

    const bad = vi.fn(async () => jsonRpc({ skills: [] }));
    await expect(listMcpSkills(bad)).rejects.toThrow(/resultType/);
  });

  it('get by URI works even when not in listing, but rejects URI drift', async () => {
    const rpc = vi.fn(async (method: string, params: Record<string, unknown>) => {
      expect(method).toBe('skills/get');
      expect(params.uri).toBe('skill://code-review/SKILL.md');
      return jsonRpc({ resultType: 'complete', skill: makeEntry() });
    });
    const entry = await getMcpSkill(rpc, 'skill://code-review/SKILL.md');
    expect(entry.frontmatter.name).toBe('code-review');

    const drift = vi.fn(async () => jsonRpc({ resultType: 'complete', skill: makeEntry() }));
    await expect(getMcpSkill(drift, 'skill://other/SKILL.md')).rejects.toThrow(/不一致/);
  });
});

describe('Skills file integrity', () => {
  it('verifies text digest and byte size', async () => {
    const rpc = vi.fn(async () => jsonRpc({ contents: [{ uri: 'skill://code-review/SKILL.md', text: skillText }] }));
    const file = await readMcpSkillFile(rpc, makeEntry(), 'skill://code-review/SKILL.md');
    expect(file.verified).toBe(true);
    expect(file.text).toBe(skillText);
    expect(file.bytes).toBe(Buffer.byteLength(skillText));
  });

  it('rejects files outside manifest and mismatched digest/size', async () => {
    const rpc = vi.fn(async () => jsonRpc({ contents: [{ uri: 'skill://code-review/SKILL.md', text: skillText }] }));
    await expect(
      readMcpSkillFile(rpc, makeEntry(), 'skill://code-review/secret.txt'),
    ).rejects.toThrow(McpSkillIntegrityError);

    const badDigestRpc = vi.fn(async () =>
      jsonRpc({ contents: [{ uri: 'skill://code-review/SKILL.md', text: 'tampered' }] }),
    );
    await expect(
      readMcpSkillFile(badDigestRpc, makeEntry(), 'skill://code-review/SKILL.md'),
    ).rejects.toThrow(/SHA-256|大小/);
  });

  it('does not claim dynamic content is verified', async () => {
    const dynamic = makeEntry({ resources: 'dynamic' });
    const rpc = vi.fn(async () => jsonRpc({ contents: [{ uri: 'skill://code-review/SKILL.md', text: skillText }] }));
    const file = await readMcpSkillFile(rpc, dynamic, 'skill://code-review/SKILL.md');
    expect(file.verified).toBe(false);
  });

  it('resolves relative references inside root and rejects traversal', () => {
    const entry = makeEntry();
    expect(resolveMcpSkillUri(entry, 'references/checklist.md')).toBe(
      'skill://code-review/references/checklist.md',
    );
    expect(() => resolveMcpSkillUri(entry, '../../etc/passwd')).toThrow(McpSkillProtocolError);
    expect(() => resolveMcpSkillUri(entry, 'skill://other/secret.md')).toThrow(McpSkillProtocolError);
    expect(() => resolveMcpSkillUri(entry, '..')).toThrow(McpSkillProtocolError);
  });
});

describe('Skills directory read', () => {
  it('refuses directory reads without directoryRead and paginates when enabled', async () => {
    await expect(
      listMcpSkillDirectory(vi.fn(), 'skill://code-review', { directoryRead: false }),
    ).rejects.toThrow(/directoryRead/);

    const rpc = vi.fn(async (method: string, params: Record<string, unknown>) => {
      if (!params.cursor) {
        return jsonRpc({
          resultType: 'complete',
          resources: [{ uri: 'skill://code-review/references', name: 'references', mimeType: 'inode/directory' }],
          nextCursor: 'p2',
        });
      }
      return jsonRpc({
        resultType: 'complete',
        resources: [{ uri: 'skill://code-review/templates' }],
      });
    });
    const result = await listMcpSkillDirectory(rpc, 'skill://code-review', { directoryRead: true });
    expect(result.resources.map((r) => r.uri)).toEqual([
      'skill://code-review/references',
      'skill://code-review/templates',
    ]);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});

describe('Skills tools', () => {
  it('connection wiring exposes tools only when capability is present', () => {
    const base = {
      server: { name: 'demo' },
      tools: [],
      connected: true,
      transport: 'stdio',
      ssePending: new Map(),
      sseNextId: 1,
    } as unknown as McpConnection;
    expect(mcpSkillToolsForConnection(base)).toEqual([]);
    const wired = mcpSkillToolsForConnection({
      ...base,
      mcpSkillsCapability: { directoryRead: false },
    } as unknown as McpConnection);
    expect(wired.map((t) => t.name)).toEqual(['mcp__demo__skill_list', 'mcp__demo__skill_load']);
  });

  it('list tool returns metadata without reading files', async () => {
    const calls: string[] = [];
    const rpc = vi.fn(async (method: string) => {
      calls.push(method);
      if (method === 'skills/list') {
        return jsonRpc({ resultType: 'complete', skills: [makeEntry()], ttlMs: 1000 });
      }
      throw new Error(`unexpected ${method}`);
    });
    const tools = createMcpSkillTools({
      serverName: 'demo',
      capability: { directoryRead: false },
      rpc,
    });
    const list = tools.find((t) => t.name === 'mcp__demo__skill_list')!;
    const result = await list.execute({}, {} as never);
    expect(result.success).toBe(true);
    expect(result.output).toContain('code-review');
    expect(calls).toEqual(['skills/list']);
    expect(calls).not.toContain('resources/read');
  });

  it('load tool is approval-gated and reads only SKILL.md + explicit files', async () => {
    const calls: string[] = [];
    const rpc = vi.fn(async (method: string, params: Record<string, unknown>) => {
      calls.push(method);
      if (method === 'skills/list') {
        return jsonRpc({ resultType: 'complete', skills: [makeEntry()], ttlMs: 1000 });
      }
      if (method === 'resources/read') {
        const uri = String(params.uri);
        return jsonRpc({
          contents: [
            {
              uri,
              text: uri.endsWith('checklist.md') ? checklistText : skillText,
            },
          ],
        });
      }
      throw new Error(`unexpected ${method}`);
    });
    const tools = createMcpSkillTools({
      serverName: 'demo',
      capability: { directoryRead: false },
      rpc,
    });
    const load = tools.find((t) => t.name === 'mcp__demo__skill_load')!;
    expect(load.registration?.approval).toBe('ask');

    const result = await load.execute(
      { skill: 'code-review', files: ['references/checklist.md'] },
      {} as never,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('Review checklist');
    expect(result.output).toContain('verified: true');
    expect(calls).toEqual([
      'skills/list',
      'resources/read',
      'resources/read',
    ]);
  });

  it('load tool reports integrity failure instead of success', async () => {
    const rpc = vi.fn(async (method: string) => {
      if (method === 'skills/list') {
        return jsonRpc({ resultType: 'complete', skills: [makeEntry()], ttlMs: 1000 });
      }
      return jsonRpc({
        contents: [{ uri: 'skill://code-review/SKILL.md', text: 'tampered' }],
      });
    });
    const tools = createMcpSkillTools({
      serverName: 'demo',
      capability: { directoryRead: false },
      rpc,
    });
    const load = tools.find((t) => t.name === 'mcp__demo__skill_load')!;
    const result = await load.execute({ skill: 'code-review' }, {} as never);
    expect(result.success).toBe(false);
    expect(result.errorType).toBe('mcp_skill_integrity');
  });
});
