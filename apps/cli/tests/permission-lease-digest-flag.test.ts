// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 内容绑定档位的**操作员开关**回归(CLI `--permission-lease-digest` / REPL `/lease --digest`)。
 *
 * 上一票把机制建到了 `grantDigestTrackedLeaseFromFlag()` 就停了 —— 两个授予入口都不传
 * `digestTrackOnApproval`,于是生产上没有任何办法把这一档打开,即本仓反复出现的
 * 「造好没装车」第二次。所以本文件钉的不是摘要算法(那是 `permission-lease-digest-at-approval.test.ts`
 * 的射程),而是**开关的可达性与缺省语义**:
 *  ① 缺省即关:不开 flag 时走的就是改前那一份 `grantLeaseFromFlag`,对象里一个摘要键都不多(第 1 组)
 *  ② 开 flag ⇒ 档位为真、身份 = `leaseWorkspaceIdOf(workspacePath)`、出生时槽位数 0(第 2 组)
 *  ③ 身份拿不到 ⇒ `invalid` 且**现有租约逐字不变**(第 3 组)
 *  ④ 结构锁:`index.ts` 真的调 `grantDigestTrackedLeaseFromFlag(`,`repl.ts` 真的把两键喂进唯一构造出口
 *     (第 4 组 —— 本票交付后被摘线即红;口径与守门 70/76/81 同族:判据存在而无人调用等于没有)
 *  ⑤ 只给 digest 不给 `--permission-lease` ⇒ 必须拒因,不得静默当"没给"(第 5 组)
 *  ⑥ 新 i18n 键五语言占位符等值(第 6 组 —— 文案走 i18n 是本票的硬要求,漏一种语言就是运行时取到键名)
 *
 * 一条与任务书的偏离,如实登记在这里而不是偷偷改掉:任务书第 ④ 条要求 `repl.ts` 源码面出现
 * `grantDigestTrackedLeaseFromFlag(`。该出口的 `grantor` 写死 `'cli-flag'`、scope 前缀写死 `cli-agent:`
 * (见 permission-lease-flag.ts 内那两行注释),REPL 走它会把交互授予在 audit.jsonl 里记成命令行授予 ——
 * 而 `repl.ts` 专门为此引入了 `REPL_LEASE_SCOPE_PREFIX`/`'repl-command'` 第二个来源标记。
 * 硬要求本身列的两个出口是"/"关系(二者之一即可),故 REPL 侧按 `grantPermissionLease()` 这一支走,
 * 归属不被改写;本文件的 ④ 因此对 repl.ts 判的是同一件事的等价形态(档位键 + 身份唯一出口),
 * 而不是那一个字面串。
 *
 * `auditLog` 由 vi.mock 截获 ⇒ 既不断言落盘也不真往 ~/.ihui 写。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auditCalls: Array<{ tool: string; input: Record<string, unknown> }> = [];

vi.mock('../src/audit.js', () => ({
  auditLog: (entry: { tool: string; input: Record<string, unknown> }) => {
    auditCalls.push({ tool: entry.tool, input: entry.input });
  },
}));

import {
  activePermissionLease,
  isPermissionLeaseLive,
  resetPermissionLeaseForTests,
} from '../src/tools/permission-lease.js';
import {
  digestGateRejectionFor,
  digestSlotCountOf,
  grantDigestTrackedLeaseFromFlag,
  grantLeaseFromFlag,
  isDigestTrackedLease,
  LEASE_DIGEST_WITHOUT_LEASE_REASON,
  leaseWorkspaceIdOf,
} from '../src/utils/permission-lease-flag.js';

const MINUTE = 60_000;
/** 时钟钉住:到期判据不得依赖测试跑在哪一刻。 */
const T0 = Date.UTC(2026, 8, 26, 12, 0, 0);
const WS = 'G:/IHUI-AI/apps/cli';

beforeEach(() => {
  auditCalls.length = 0;
  resetPermissionLeaseForTests();
});
afterEach(() => {
  resetPermissionLeaseForTests();
});

/** 取源码面并把**整行注释**去掉:锁必须只认代码位,注释里提一句不算装车(守门 57 同型判据)。 */
function codeLinesOf(rel: string): string[] {
  const p = fileURLToPath(new URL(rel, import.meta.url));
  return readFileSync(p, 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(?:\/\/|\*|\/\*)/.test(line));
}

describe('① 缺省即关 ⇒ 与改前逐字等价(正证)', () => {
  it('档位关闭时前置校验永不拒绝,哪怕清单为空(空清单由既有出口判 kind:none)', () => {
    expect(digestGateRejectionFor(false, undefined)).toBeNull();
    expect(digestGateRejectionFor(false, '')).toBeNull();
    expect(digestGateRejectionFor(false, 'write_file')).toBeNull();
  });

  it('不开 flag ⇒ 走旧档,lease 里三个摘要字段一个都不存在', () => {
    const outcome = grantLeaseFromFlag({
      toolsRaw: 'write_file',
      ttlRaw: '5',
      target: 'sess-off',
      nowMs: T0,
    });
    expect(outcome.kind).toBe('granted');
    if (outcome.kind !== 'granted') return;
    const lease = outcome.lease;
    // 这三个键的存在性就是"档位"的全部真相:缺省档必须让消费侧读出 undefined ⇒ 逐字旧语义
    expect(lease.digestTrackOnApproval).toBeUndefined();
    expect(lease.slotDigests).toBeUndefined();
    expect(lease.workspaceId).toBeUndefined();
    expect(isDigestTrackedLease(lease)).toBe(false);
    expect(digestSlotCountOf(lease)).toBe(0);
    // 审计行也必须记 false(缺省档),否则审计面与内容面分叉
    const granted = auditCalls.find((c) => c.tool === 'permission_lease_granted');
    expect(granted?.input.digestTrackOnApproval).toBe(false);
  });

  it('index.ts 的关闭分支确实还是 grantLeaseFromFlag(而非把摘要键无条件带上)', () => {
    const lines = codeLinesOf('../src/index.ts');
    const offBranch = lines.find((l) => /^\s*:\s*grantLeaseFromFlag\(\s*\{/.test(l));
    expect(offBranch).toBeDefined();
    // 分叉点只有那一个布尔,且它的真值来自显式 flag(缺省 undefined ⇒ false)
    expect(lines.some((l) => l.includes('opts.permissionLeaseDigest === true'))).toBe(true);
  });
});

describe('② 开了 flag ⇒ 档位为真、身份同源、出生时零绑定', () => {
  it('digestTrackOnApproval 为真且 workspaceId 恰等于 leaseWorkspaceIdOf(workspacePath)', () => {
    const outcome = grantDigestTrackedLeaseFromFlag({
      toolsRaw: 'write_file,git_commit',
      ttlRaw: '5',
      target: 'sess-on',
      workspacePath: `  ${WS}  `,
      nowMs: T0,
    });
    expect(outcome.kind).toBe('granted');
    if (outcome.kind !== 'granted') return;
    expect(outcome.lease.digestTrackOnApproval).toBe(true);
    // 身份唯一映射:trim 后同值,不是第二份算法算出来的
    expect(outcome.lease.workspaceId).toBe(leaseWorkspaceIdOf(`  ${WS}  `));
    expect(outcome.lease.workspaceId).toBe(WS);
    expect(outcome.lease.grantor).toBe('cli-flag');
    // "开着但还没绑"必须能被查询面分辨出来 ⇒ 档位真、槽位 0
    expect(isDigestTrackedLease(outcome.lease)).toBe(true);
    expect(digestSlotCountOf(outcome.lease)).toBe(0);
    expect(outcome.lease.slotDigests).toEqual({});
    const granted = auditCalls.find((c) => c.tool === 'permission_lease_granted');
    expect(granted?.input.digestTrackOnApproval).toBe(true);
  });

  it('ttl 与轮次的封顶在这一档同形生效(不因新开入口而少一道封顶)', () => {
    const outcome = grantDigestTrackedLeaseFromFlag({
      toolsRaw: 'write_file',
      ttlRaw: '99999',
      turnsRaw: '99999',
      target: 'sess-cap',
      workspacePath: WS,
      nowMs: T0,
    });
    expect(outcome.kind).toBe('granted');
    if (outcome.kind !== 'granted') return;
    expect(outcome.ttlMinutes).toBe(60);
    expect(outcome.turns).toBe(25);
    expect(Date.parse(outcome.lease.expiresAt)).toBe(T0 + 60 * MINUTE);
  });
});

describe('③ 身份拿不到 ⇒ 失败关闭且不改现有租约', () => {
  it('空 workspacePath ⇒ kind:invalid;无既有租约时仍为 null', () => {
    const outcome = grantDigestTrackedLeaseFromFlag({
      toolsRaw: 'write_file',
      target: 'sess-no-ws',
      workspacePath: '   ',
      nowMs: T0,
    });
    expect(outcome.kind).toBe('invalid');
    if (outcome.kind !== 'invalid') return;
    expect(outcome.reason).toContain('workspace identity');
    expect(activePermissionLease()).toBeNull();
  });

  it('已有旧档租约时,身份为空的那次授予**不得**把它换掉或撤掉', () => {
    const first = grantLeaseFromFlag({ toolsRaw: 'grep', ttlRaw: '5', target: 'sess-keep', nowMs: T0 });
    expect(first.kind).toBe('granted');
    const before = activePermissionLease();
    expect(before).not.toBeNull();

    const bad = grantDigestTrackedLeaseFromFlag({
      toolsRaw: 'write_file',
      target: 'sess-steal',
      workspacePath: undefined,
      nowMs: T0 + 1000,
    });
    expect(bad.kind).toBe('invalid');
    const after = activePermissionLease();
    // 同一份对象、同一档位:失败的那次授予对状态零影响(与 repl 侧"回显拒因、状态不变"同一条要求)
    expect(after).toBe(before);
    expect(after?.scope).toBe(before?.scope);
    expect(isDigestTrackedLease(after)).toBe(false);
    expect(isPermissionLeaseLive(after as never, T0 + 2000)).toBe(true);
    // 失败路径不得留下第二条 grant 审计行
    expect(auditCalls.filter((c) => c.tool === 'permission_lease_granted')).toHaveLength(1);
  });
});

describe('④ 结构锁:开关真的挂在两个授予入口上', () => {
  it('index.ts 代码位调用 grantDigestTrackedLeaseFromFlag(', () => {
    const lines = codeLinesOf('../src/index.ts');
    expect(lines.filter((l) => l.includes('grantDigestTrackedLeaseFromFlag(')).length).toBeGreaterThanOrEqual(1);
    // 拒因必须真的打印并 exit 1,不得只算不用
    expect(lines.some((l) => l.includes('digestGateRejectionFor('))).toBe(true);
    expect(lines.some((l) => /process\.exitCode = 1/.test(l))).toBe(true);
  });

  it('repl.ts 代码位把 digestTrackOnApproval 与 leaseWorkspaceIdOf 喂进唯一构造出口', () => {
    const lines = codeLinesOf('../src/commands/repl.ts');
    expect(lines.some((l) => l.includes('digestTrackOnApproval: true'))).toBe(true);
    expect(lines.some((l) => l.includes('leaseWorkspaceIdOf(state.opts.workspacePath)'))).toBe(true);
    // 开关的解析位:只认裸 --digest,并在授予/查询两处都参与判据
    expect(lines.some((l) => /token === '--digest'/.test(l))).toBe(true);
    expect(lines.some((l) => l.includes('isDigestTrackedLease(lease)'))).toBe(true);
    expect(lines.some((l) => l.includes('digestSlotCountOf(lease)'))).toBe(true);
    // 归属不被改写:REPL 授予仍走 repl-command(见文件头那条偏离登记)
    expect(lines.some((l) => l.includes("grantor: 'repl-command'"))).toBe(true);
    expect(lines.some((l) => l.includes('grantDigestTrackedLeaseFromFlag('))).toBe(false);
  });

  it('CLI 侧注册了这一档 option,且没有把它做成默认开', () => {
    const lines = codeLinesOf('../src/index.ts');
    const optionLine = lines.find((l) => l.includes("--permission-lease-digest'"));
    expect(optionLine, "--permission-lease-digest 必须真被注册成 option").toBeDefined();
    // 布尔 flag(不带 <value> 占位)⇒ commander 缺省给 undefined ⇒ 判据只认 === true 时缺省即关
    expect(optionLine).not.toMatch(/--permission-lease-digest\s+</);
    expect(lines.some((l) => l.includes('opts.permissionLeaseDigest === true'))).toBe(true);
  });
});

describe('⑤ 只给 digest 不给 --permission-lease ⇒ 一行拒因,绝不静默当没给', () => {
  it('缺清单的开关返回固定拒因(与既有出口的空清单判据不是同一条)', () => {
    expect(digestGateRejectionFor(true, undefined)).toBe(LEASE_DIGEST_WITHOUT_LEASE_REASON);
    expect(digestGateRejectionFor(true, '')).toBe(LEASE_DIGEST_WITHOUT_LEASE_REASON);
    // "写了开关却解析出零个工具"(`, ` 这类)由唯一解析出口给因,本门只保证**绝不返回 null**
    // (判据委托给解析出口,而不是自己判一遍再各说一套 —— 两处算同一件事必漂移)。
    const commaOnly = digestGateRejectionFor(true, '  ,  ');
    expect(commaOnly).not.toBeNull();
    expect(commaOnly).toContain('--permission-lease');
    expect(digestGateRejectionFor(true, 'write_file')).toBeNull();
    expect(LEASE_DIGEST_WITHOUT_LEASE_REASON).toContain('--permission-lease');
  });

  it('反向锁:该出口对空清单本身返回 none —— 所以前置校验必须存在,漏接就是静默失效', () => {
    // 这条把"为什么需要第 5 组"钉成事实:不跑前置校验时,开关+空清单会被读成"没给",
    // 操作员明确要求的那一套就被悄悄换成另一套(本仓"失败必须响"同一条禁令)。
    const silent = grantDigestTrackedLeaseFromFlag({
      toolsRaw: undefined,
      target: 'sess-silent',
      workspacePath: WS,
      nowMs: T0,
    });
    expect(silent.kind).toBe('none');
    expect(digestGateRejectionFor(true, undefined)).not.toBeNull();
  });
});

describe('⑥ 新键五语言齐备且占位符逐语言等值', () => {
  const NEW_KEYS = [
    'permissionLeaseDigestDesc',
    'permissionLeaseDigestGranted',
    'replLeaseDigestGranted',
    'replLeaseDigestStateOn',
    'replLeaseDigestStateOff',
  ] as const;
  const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const;

  it('每个新键在五语言里都解析得到非空且≠键名(缺一种就是运行时回显键名)', () => {
    for (const lang of LANGS) {
      const p = fileURLToPath(new URL(`../../../packages/i18n/messages/cli/${lang}.json`, import.meta.url));
      const parsed = JSON.parse(readFileSync(p, 'utf8')) as { cliEntry?: Record<string, unknown> };
      for (const key of NEW_KEYS) {
        const value = parsed.cliEntry?.[key];
        expect(typeof value, `${lang}/${key}`).toBe('string');
        expect((value as string).trim().length, `${lang}/${key}`).toBeGreaterThan(0);
        expect(value, `${lang}/${key}`).not.toBe(key);
      }
    }
  });

  it('占位符集合逐语言与 zh-CN 同形(同键同槽)', () => {
    const slotsOf = (text: string): string[] => [...text.matchAll(/\{([a-zA-Z_][\w]*)\}/g)].map((m) => m[1]).sort();
    const read = (lang: string): Record<string, unknown> => {
      const p = fileURLToPath(new URL(`../../../packages/i18n/messages/cli/${lang}.json`, import.meta.url));
      const all = JSON.parse(readFileSync(p, 'utf8')) as { cliEntry?: Record<string, unknown> };
      return all.cliEntry ?? {};
    };
    const base = read('zh-CN');
    for (const key of NEW_KEYS) {
      const expected = slotsOf(String(base[key] ?? ''));
      for (const lang of LANGS) {
        expect(slotsOf(String(read(lang)[key] ?? '')), `${lang}/${key}`).toEqual(expected);
      }
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
