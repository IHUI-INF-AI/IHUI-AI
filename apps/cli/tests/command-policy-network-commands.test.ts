// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Z9:网络类命令登记 → `network` 效应闸门跟长。
 * 登记表(`tools/command-policy/syntax-table.ts`)是唯一数据面;本文件零判据复算(§0.6),
 * 取词与出口判定一律 import 生产实现(`evaluateArgv` / `extractBareHostTargets` / `buildEgressEnvExit`)。
 * 覆盖面:①登记面效应 ②逐条取词 ③反向对照(未登记 = 不适用,不是允许,§0.3)
 * ④选项变形的覆盖边界 ⑤下游消费锁(egress 闸门真的吃到这次登记)。
 */

import { describe, it, expect } from 'vitest';

import { evaluateArgv } from '../src/tools/command-policy/evaluate.js';
import { SYNTAX_TABLE } from '../src/tools/command-policy/syntax-table.js';
import { extractBareHostTargets } from '../src/sandbox/egress/bare-host.js';
import { buildEgressEnvExit } from '../src/sandbox/egress/env-inject.js';
import { EGRESS_ENV } from '../src/sandbox/egress/policy.js';

const hostsOf = (line: string): string[] => extractBareHostTargets(line).map((t) => t.raw);

const REGISTERED: readonly string[] = ['ssh', 'scp', 'sftp'];

describe('登记面 — 新登记的三条命令都带 network 基线效应', () => {
  it('① 表里 effect=network,且由 evaluateArgv 结算出 network;只读资格不新增', () => {
    for (const cmd of REGISTERED) {
      expect(SYNTAX_TABLE[cmd]?.effect).toBe('network');
      const finding = evaluateArgv([cmd, 'db.internal']);
      expect(finding.effects).toContain('network');
      expect(finding.verdict).not.toBe('read-only');
    }
  });
});

describe('取词断言 — 每条新登记命令的目的地 token', () => {
  it('② ssh:裸 host 与 `user@host`(形态权威 = plugins/url-shape.ts 的 ssh 档)', () => {
    expect(hostsOf('ssh db.internal')).toEqual(['db.internal']);
    expect(hostsOf('ssh git@files.internal')).toEqual(['files.internal']);
  });

  it('②b ssh 的本机生产 argv 形态(scripts/git-guardian.mjs 的 SSH_COMMAND):-i/-o 取值不吃掉目的地', () => {
    expect(hostsOf('ssh -i C:/keys/deploy -o IdentitiesOnly=yes -o ConnectTimeout=20 monitor.internal')).toEqual([
      'monitor.internal',
    ]);
  });

  it('②c scp:`user@host:path`(形态权威 = plugins/url-shape.ts 的 SCP_LIKE_RE)与两个远端', () => {
    expect(hostsOf('scp user@files.internal:/srv/app.tar ./app.tar')).toEqual(['files.internal']);
    expect(hostsOf('scp a.internal:/x b.internal:/y')).toEqual(['a.internal', 'b.internal']);
  });

  it('②d sftp:host 与 `user@host` 操作数;未登记选项(-P)不改变基线效应', () => {
    expect(hostsOf('sftp backup.internal')).toEqual(['backup.internal']);
    expect(hostsOf('sftp -P 2222 deploy@backup.internal')).toEqual(['backup.internal']);
    expect(evaluateArgv(['sftp', '-P', '2222', 'backup.internal']).effects).toContain('network');
  });
});

describe('反向对照(§0.3) — 量不到效应 = 不适用,不折成"允许"', () => {
  it('③ 未登记 basename:结论 unknown + 点名未登记,闸门不扩面(裸域名一个都不造)', () => {
    const finding = evaluateArgv(['nc', 'monitor.internal', '22']);
    expect(finding.effects).not.toContain('network');
    expect(finding.verdict).toBe('unknown');
    expect(finding.reason).toBe('unregistered-command');
    expect(hostsOf('nc monitor.internal 22')).toEqual([]);
    expect(hostsOf('telnet db.internal 23')).toEqual([]);
  });

  it('③b 已在册但基线不是 network(wget)⇒ 本闸门不覆盖它 —— 登记在册 ≠ 效应在册', () => {
    expect(SYNTAX_TABLE.wget?.effect).toBe('write');
    expect(evaluateArgv(['wget', 'db.internal']).effects).not.toContain('network');
    expect(hostsOf('wget db.internal/x')).toEqual([]);
  });
});

describe('选项变形的覆盖边界 — 覆盖到哪就断言到哪', () => {
  it('④ `-o K=V` 的值 token 不误判成目的地,外层目的地照取', () => {
    expect(hostsOf('ssh -o StrictHostKeyChecking=accept-new target.internal')).toEqual(['target.internal']);
  });

  it('④b 已知盲区:第二跳藏在**单个引号值内部**(ProxyCommand)时词位切分看不到,只取到外层目标', () => {
    expect(hostsOf(`ssh -o 'ProxyCommand=ssh -W %h:%p bastion.internal' target.internal`)).toEqual(['target.internal']);
  });

  it('④c 变量化参数仍走既有 dynamic → unjudged 通道,不在这里造目标', () => {
    expect(hostsOf('ssh "$TARGET_HOST"')).toEqual([]);
  });
});

describe('下游消费锁 — 这次登记被 egress 闸门真的吃到', () => {
  const denyEnv = { [EGRESS_ENV.denyDomains]: 'blocked.internal', [EGRESS_ENV.ledger]: 'off' };

  it('⑤ 新登记的 scp 命中 enforce 档 deny 域 ⇒ 出口 blocked,命令不该被拉起', () => {
    const exit = buildEgressEnvExit({
      commandLine: 'scp user@blocked.internal:/srv/app.tar ./app.tar',
      cwd: process.cwd(),
      env: denyEnv,
      append: () => null,
    });
    expect(exit.blocked).toBe(true);
    expect(exit.blockReason).toContain('blocked.internal');
  });

  it('⑤b 正向对照:纯本地路径的同形命令不误伤', () => {
    const exit = buildEgressEnvExit({
      commandLine: 'scp ./local.txt ./backup.txt',
      cwd: process.cwd(),
      env: denyEnv,
      append: () => null,
    });
    expect(exit.blocked).toBe(false);
    expect(exit.verdicts).toHaveLength(0);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
