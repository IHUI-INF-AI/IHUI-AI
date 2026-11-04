// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkFolderTrust } from '../src/sandbox/index.js';
import {
  buildFileAccessRules,
  clearGuardRulesCache,
  decideFileAccess,
  evaluateFileAccess,
  loadGuardFaceRules,
  toAclPath,
  CREDENTIAL_FILE_ACCESS_RULES,
  GUARD_MANIFEST_REL_PATH,
  type ManifestReader,
} from '../src/sandbox/file-access-policy.js';
import { globMatches, normalizeWorkspacePath } from '../src/sandbox/glob-pattern.js';
import { read_file } from '../src/tools/builtins.js';
import type { ToolContext } from '../src/tools/index.js';

/** 注入式清单读取器:记录被请求过的绝对路径,并按脚本回话(不落任何真文件) */
function fakeReader(body: string | null): { calls: string[]; read: ManifestReader } {
  const calls: string[] = [];
  return { calls, read: (abs: string) => (calls.push(abs), body) };
}

const FAKE_MANIFEST = JSON.stringify({
  signatureRequiredFrom: '2026-11-11',
  entries: [
    { path: 'scripts/lib/', kind: 'judgement-lib', why: '判据库' },
    { path: 'scripts/check-*.mjs', kind: 'gate-body', why: '门体' },
    { path: 'AGENTS.md', kind: 'rule-doc', why: '规则文档' },
  ],
});

describe('文件访问裁决 · 凭据族(读侧 deny)', () => {
  const rules = CREDENTIAL_FILE_ACCESS_RULES;

  it('① .env 的读请求被拒,并点名是哪条规则、下一步做什么', () => {
    const v = decideFileAccess('read', '.env', rules);
    expect(v.decision).toBe('deny');
    expect(v.rule?.pattern).toBe('.env');
    expect(v.nextStep).toContain('不要把该文件的正文打印');
  });

  it('② 例外族按声明序先生效:.env.example 可读而 .env.local 不可读(反向对照防假绿)', () => {
    expect(decideFileAccess('read', '.env.example', rules).decision).toBe('allow');
    expect(decideFileAccess('read', '.env.template', rules).decision).toBe('allow');
    expect(decideFileAccess('read', '.env.local', rules).decision).toBe('deny');
    expect(decideFileAccess('read', '.env.production', rules).decision).toBe('deny');
  });

  it('③ secrets 目录与私钥族按任意深度命中,普通源码件不受影响', () => {
    expect(decideFileAccess('read', 'src/secrets/db.txt', rules).decision).toBe('deny');
    expect(decideFileAccess('read', 'deploy/win/cert.pem', rules).decision).toBe('deny');
    expect(decideFileAccess('read', '.ssh/id_ed25519', rules).decision).toBe('deny');
    expect(decideFileAccess('read', 'a/b/c/.npmrc', rules).decision).toBe('deny');
    expect(decideFileAccess('read', 'packages/i18n/messages/web/en.json', rules).decision).toBe('allow');
  });

  it('④ Windows 反斜杠与 ./ 前缀进同一把尺(不因形态漂移放过)', () => {
    expect(decideFileAccess('read', '.\\secrets\\db.txt', rules).path).toBe('secrets/db.txt');
    expect(decideFileAccess('read', '.\\secrets\\db.txt', rules).decision).toBe('deny');
    expect(decideFileAccess('read', './.env', rules).decision).toBe('deny');
    expect(decideFileAccess('read', 'src\\deploy\\a.pem', rules).decision).toBe('deny');
  });

  it('⑤ 绝对路径先折成工作区相对形态(不给"传绝对路径就绕过"留缝)', () => {
    const ws = 'G:/IHUI-AI';
    expect(toAclPath(ws, 'G:/IHUI-AI/src/deploy/x.pem')).toBe('src/deploy/x.pem');
    expect(toAclPath(ws, 'src/deploy/x.pem')).toBe('src/deploy/x.pem');
    // 越出工作区:实现保持原样进尺(折不成相对不等于"看不见"),两种形态都必须被拦住。
    const outside = toAclPath(ws, 'G:/Other/keys/id_rsa');
    expect(outside).toBe('G:/Other/keys/id_rsa');
    expect(decideFileAccess('read', outside, rules).decision).toBe('deny');
    const crossDrive = toAclPath(ws, 'D:/Other/keys/id_rsa');
    expect(decideFileAccess('read', crossDrive, rules).decision).toBe('deny');
    // 根层形态(本仓 glob 里 `**/x` 要求前置一层 ⇒ 裸形态必须单列,否则根层漏过去)
    expect(decideFileAccess('read', 'id_rsa', rules).decision).toBe('deny');
    expect(decideFileAccess('read', 'server.pem', rules).decision).toBe('deny');
    expect(decideFileAccess('read', 'secrets/db.txt', rules).decision).toBe('deny');
    expect(decideFileAccess('read', '.ssh/id_ed25519', rules).decision).toBe('deny');
  });

  it('⑥ 未命中的普通路径 allow 且 rule 为 null(不把自己变成恒拦门,§12e)', () => {
    const v = decideFileAccess('read', 'apps/cli/src/tools/index.ts', rules);
    expect(v.decision).toBe('allow');
    expect(v.rule).toBeNull();
    expect(v.nextStep).toBeNull();
  });
});

describe('文件访问裁决 · 守护面从已审清单派生', () => {
  it('⑦ 目录形态补成递归 glob;写侧默认 advisory(出声但不阻断)', () => {
    const { read, calls } = fakeReader(FAKE_MANIFEST);
    const outcome = loadGuardFaceRules('G:/ws', read);
    expect(outcome.state).toBe('ok');
    if (outcome.state !== 'ok') return;
    expect(outcome.rules.map((r) => r.pattern)).toEqual([
      'scripts/lib/**',
      'scripts/check-*.mjs',
      'AGENTS.md',
    ]);
    expect(outcome.rules.every((r) => r.enforcement === 'advisory')).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('immutable-guard.json');

    const built = buildFileAccessRules('G:/ws-adv', read);
    const v = decideFileAccess('write', 'scripts/lib/plan-task-index.mjs', built.rules);
    expect(v.decision).toBe('ask');
    expect(v.enforcement).toBe('advisory');
    expect(v.nextStep).toContain('immutable-exempt');
  });

  it('⑧ 总闸两档:默认放行带 note;IHUI_FILE_ACL_STRICT=1 才真拦', () => {
    const { read } = fakeReader(FAKE_MANIFEST);
    clearGuardRulesCache();
    const lenient = evaluateFileAccess('write', 'AGENTS.md', 'G:/ws-lenient', {}, read);
    expect(lenient.blocked).toBe(false);
    expect(lenient.note).toContain('advisory');
    expect(lenient.verdict.decision).toBe('ask');

    const strict = evaluateFileAccess(
      'write',
      'AGENTS.md',
      'G:/ws-strict',
      { IHUI_FILE_ACL_STRICT: '1' },
      read,
    );
    expect(strict.blocked).toBe(true);
    expect(strict.note).toContain('[file-acl ask]');
    expect(strict.note).toContain('immutable-exempt');
  });

  it('⑨ 凭据族在两档下都真拦(严档不是唯一防线)', () => {
    const { read } = fakeReader(FAKE_MANIFEST);
    const blocked = evaluateFileAccess('read', '.env', 'G:/ws-cred', {}, read);
    expect(blocked.blocked).toBe(true);
    expect(blocked.note).toContain('[file-acl deny]');
  });

  it('⑩ 清单读不到 = 未判定并点名,绝不空表冒充"本仓没有守护件"(§0.3)', () => {
    const { read } = fakeReader(null);
    const outcome = loadGuardFaceRules('G:/empty-ws', read);
    expect(outcome.state).toBe('unjudged');
    if (outcome.state !== 'unjudged') return;
    expect(outcome.reason).toContain('取不到守护面清单');
    const built = buildFileAccessRules('G:/empty-ws-2', read);
    expect(built.guard.state).toBe('unjudged');
    expect(decideFileAccess('read', '.env', built.rules).decision).toBe('deny');
  });

  it('⑪ 枚举到 0 条判未判定;坏 JSON 判未判定并带原委', () => {
    expect(loadGuardFaceRules('G:/a', fakeReader('{"entries":[]}').read).state).toBe('unjudged');
    const bad = loadGuardFaceRules('G:/b', fakeReader('{ 坏 JSON').read);
    expect(bad.state).toBe('unjudged');
    if (bad.state !== 'unjudged') return;
    expect(bad.reason).toContain('不是合法 JSON');
  });

  it('⑫ 本仓真实清单可被逐枚派生(证明"不抄第二份"这条路真走得通)', () => {
    clearGuardRulesCache();
    const repoRootUrl = new URL('../../../', import.meta.url);
    const outcome = loadGuardFaceRules(fileURLToPath(repoRootUrl));
    expect(outcome.state).toBe('ok');
    if (outcome.state !== 'ok') return;
    const raw = JSON.parse(
      readFileSync(fileURLToPath(new URL(GUARD_MANIFEST_REL_PATH, repoRootUrl)), 'utf8'),
    ) as { entries: { path: string }[] };
    expect(outcome.count).toBe(raw.entries.length);
    expect(outcome.rules.map((r) => r.pattern)).toEqual(
      raw.entries.map((e) => (e.path.endsWith('/') ? `${e.path}**` : e.path)),
    );
  });
});

describe('glob 匹配原语单一真相源', () => {
  it('⑬ 裁决层与 folder_trust 同尺:同 pattern 同路径给出同结论', () => {
    const cases: [string, string, boolean][] = [
      ['scripts/lib/**', 'scripts/lib/a/b.mjs', true],
      ['scripts/*', 'scripts/lib/a.mjs', false],
      ['**/*.pem', 'deploy/x.pem', true],
      ['AGENTS.md', 'AGENTS.md', true],
      ['**/secrets/**', 'src/secrets/db.txt', true],
    ];
    for (const [pattern, p, expectHit] of cases) {
      expect(globMatches(pattern, normalizeWorkspacePath(p))).toBe(expectHit);
      expect(checkFolderTrust(p, { [pattern]: 'forbidden' }) === 'forbidden').toBe(expectHit);
    }
  });

  it('⑭ 形状锁:裁决函数不碰文件系统(拒绝必须发生在任何 fs 动作之前)', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/sandbox/file-access-policy.ts', import.meta.url)),
      'utf8',
    );
    const start = src.indexOf('export function decideFileAccess');
    expect(start).toBeGreaterThan(-1);
    const tail = src.slice(start);
    const body = tail.slice(0, tail.indexOf('\nexport ', 10));
    expect(body).not.toMatch(/readFileSync|writeFileSync|existsSync|statSync|openSync|rmSync|unlinkSync/);
  });
});

describe('装车证明:read_file 真的走到了这一层', () => {
  /** 只给 read_file 在拒绝分支上会碰到的字段;其余留空 ⇒ 一旦越过裁决就会当场炸出来 */
  const ctx = { workspacePath: 'G:/IHUI-AI-nonexistent-ws' } as unknown as ToolContext;

  it('⑮ 不存在的 .env 也被拒(证明判据排在 fs 之前,且不是"文件不存在"顶包)', async () => {
    const res = await read_file.execute({ path: '.env' }, ctx);
    expect(res.success).toBe(false);
    expect(res.error).toContain('[file-acl deny]');
    expect(res.error).not.toContain('文件不存在');
  });

  it('⑯ 正向对照:普通路径不受本层影响(不把正常读取一起堵死,§12e)', async () => {
    const res = await read_file.execute({ path: 'src/note.txt' }, ctx);
    expect(res.success).toBe(false);
    expect(res.error).toContain('文件不存在');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
