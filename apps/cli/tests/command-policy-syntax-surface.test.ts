// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Z14 形状锁:命令语法表拆档后的导出集(基线效应表 / arity 表 / 查询出口三档)。
 * 拆档是"逐字搬运",所以本文件锁的不是内容而是**结构**:
 *  ① basename 全集一枚不少、一枚不多(拆漏一族当场红)
 *  ② 组装点与族档是同一批对象引用(不是复制粘贴出来的第二份真相源,§0.6)
 *  ③ 查询出口 `commandSpecOf` 与下标读同值,且原型键(`constructor`/`__proto__`)不得被当成"有条目"
 *  ④ 网络档的基线效应逐条钉住(wget 的 network 翻转、nc 的登记都在这一格)
 *  ⑤ arity 表的形态:每条选项都有 name,arity 只取三档
 *  ⑥ 每档文件 <250 行(拆档的目的本身,回潮即红)
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { SYNTAX_TABLE, commandSpecOf } from '../src/tools/command-policy/syntax-table.js';
import { READ_ONLY_SIMPLE } from '../src/tools/command-policy/syntax-readonly.js';
import { GIT_SPEC } from '../src/tools/command-policy/syntax-git.js';
import { DOCKER_SPEC, KUBECTL_SPEC } from '../src/tools/command-policy/syntax-docker-kubectl.js';
import { CARGO_SPEC } from '../src/tools/command-policy/syntax-package-clusters.js';
import { FILE_SPECS } from '../src/tools/command-policy/syntax-files.js';
import { GH_TABLE, NETWORK_SPECS } from '../src/tools/command-policy/syntax-network.js';
import { SYNTAX_TABLE as BARREL_TABLE } from '../src/tools/command-policy/index.js';

/** 拆前 HEAD(`eff9c8e`)的登记全集 + Z14 新增的 `nc` + Z29 新增的 PowerShell 两枚 cmdlet(枚数与成员都现读于 `git show` 的表体)。 */
const PINNED_BASENAMES: readonly string[] = [
  'ag', 'awk', 'cat', 'cargo', 'chattr', 'chmod', 'chgrp', 'chown', 'cp', 'curl', 'cut', 'dd', 'date', 'docker', 'find',
  'gh', 'git', 'grep', 'halt', 'head', 'hostname', 'kill', 'killall', 'kubectl', 'ln', 'ls', 'mkdir', 'mkfs',
  'mv', 'nc', 'npm', 'patch', 'pkill', 'pnpm', 'poweroff', 'ps', 'pwd', 'reboot', 'rg', 'rm', 'rmdir', 'sed',
  'setfacl', 'shred', 'shutdown', 'sort', 'ssh', 'scp', 'sftp', 'tail', 'tar', 'tee', 'touch', 'truncate', 'tr',
  'uniq', 'unzip', 'uptime', 'wc', 'wget', 'whoami', 'xargs', 'zip', 'invoke-webrequest', 'invoke-restmethod',
];

const ARITIES = new Set(['none', 'required', 'optional']);
const EFFECTS = new Set(['read', 'write', 'network', 'system', 'destructive']);
/** 基线档多一格 `requires-subcommand`(git 裸命令必须带子命令才可判定)。 */
const BASELINES = new Set([...EFFECTS, 'requires-subcommand']);

describe('语法表导出集 — 拆档不丢登记(① + ②)', () => {
  it('① basename 全集 = 钉住的 63 枚,无 undefined 条目', () => {
    expect(Object.keys(SYNTAX_TABLE).sort()).toEqual([...PINNED_BASENAMES].sort());
    expect(PINNED_BASENAMES).toHaveLength(65);
    for (const name of PINNED_BASENAMES) expect(SYNTAX_TABLE[name]).toBeTypeOf('object');
  });

  it('② 组装点用的就是族档本身那些对象(同一引用,零复制)', () => {
    const families: Readonly<Record<string, unknown>>[] = [READ_ONLY_SIMPLE, FILE_SPECS, NETWORK_SPECS, GH_TABLE];
    for (const family of families) {
      for (const [key, spec] of Object.entries(family)) {
        expect(SYNTAX_TABLE[key]).toBe(spec);
      }
    }
    expect(SYNTAX_TABLE.git).toBe(GIT_SPEC);
    expect(SYNTAX_TABLE.docker).toBe(DOCKER_SPEC);
    expect(SYNTAX_TABLE.kubectl).toBe(KUBECTL_SPEC);
    expect(SYNTAX_TABLE.cargo).toBe(CARGO_SPEC);
    // npm/pnpm 在组装点由 packageManagerSpec 现造(结构化 + 写基线)
    for (const pm of ['npm', 'pnpm']) {
      expect(SYNTAX_TABLE[pm]?.effect).toBe('write');
      expect(SYNTAX_TABLE[pm]?.structured).toBe(true);
      expect(Object.keys(SYNTAX_TABLE[pm]?.subcommands ?? {}).length).toBeGreaterThan(10);
    }
  });

  it('②b 公共桶口(index.ts)仍交出同一张表 —— 拆档没换导出面', () => {
    expect(BARREL_TABLE).toBe(SYNTAX_TABLE);
  });
});

describe('查询出口 — commandSpecOf(③)', () => {
  it('③ 与下标读逐键同值;原型键与未登记名一律 undefined(不折成"有条目")', () => {
    for (const name of PINNED_BASENAMES) expect(commandSpecOf(name)).toBe(SYNTAX_TABLE[name]);
    for (const bogus of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'ncat', 'telnet']) {
      expect(commandSpecOf(bogus)).toBeUndefined();
    }
  });
});

describe('基线效应表与 arity 表的形态(④ + ⑤)', () => {
  it('④ 网络档逐条钉住:curl/wget/ssh/scp/sftp/nc 都是 network 基线', () => {
    for (const cmd of ['curl', 'wget', 'ssh', 'scp', 'sftp', 'nc']) {
      expect(SYNTAX_TABLE[cmd]?.effect).toBe('network');
      expect(NETWORK_SPECS[cmd]).toBe(SYNTAX_TABLE[cmd]);
    }
    // wget 的写知识不丢(URL 操作数存在即下载)——Z14 翻转基线时保留那一格
    expect(SYNTAX_TABLE.wget?.operandsBreakReadonly).toBe(true);
    // 只读档不得混进网络命令;网络档里也不得有 read 基线
    for (const cmd of Object.keys(NETWORK_SPECS)) expect(EFFECTS.has(String(SYNTAX_TABLE[cmd]?.effect))).toBe(true);
    for (const cmd of Object.keys(READ_ONLY_SIMPLE)) expect(READ_ONLY_SIMPLE[cmd]?.effect).toBe('read');
  });

  it('⑤ 每条命令的 effect 在档内、每个选项都有 name 且 arity 只取三档', () => {
    const seenOptions = new Set<string>();
    for (const [name, spec] of Object.entries(SYNTAX_TABLE)) {
      expect(BASELINES.has(String(spec.effect))).toBe(true);
      const optionGroups = [spec.options ?? [], spec.globalOptions ?? []];
      for (const sub of Object.values(spec.subcommands ?? {})) optionGroups.push(sub.options ?? []);
      for (const group of optionGroups) {
        for (const option of group) {
          expect(typeof option.name).toBe('string');
          expect(option.name.length).toBeGreaterThan(0);
          if (option.arity !== undefined) expect(ARITIES.has(option.arity)).toBe(true);
          for (const effect of option.effects ?? []) expect(EFFECTS.has(effect)).toBe(true);
          seenOptions.add(`${name} ${option.name}`);
        }
      }
    }
    // arity 表拆档后没有把某条命令的选项清单搬丢(枚数现读)
    expect(seenOptions.size).toBeGreaterThan(500);
  });
});

describe('行数档(⑥)— 拆档的目的本身', () => {
  it('每档文件 < 250 行(回潮即红)', () => {
    const files = [
      'syntax-table.ts', 'syntax-options.ts', 'syntax-readonly.ts', 'syntax-git.ts', 'syntax-docker-kubectl.ts',
      'syntax-package-clusters.ts', 'syntax-files.ts', 'syntax-network.ts',
    ];
    for (const file of files) {
      const text = readFileSync(fileURLToPath(new URL(`../src/tools/command-policy/${file}`, import.meta.url)), 'utf8');
      const lines = text.split(/\r?\n/).length;
      // goal-b49/Z33 修正:原写法把布尔量 `lines < 250` 放在 expect 的第二参(失败信息位),
      // 断言体比的是同一个字符串 ⇒ 恒真、本预算锁从未生效。改为真断言(信息位归第二参)。
      expect(lines, `${file}=${lines} 行,超 250 档(拆档回潮)`).toBeLessThan(250);
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
