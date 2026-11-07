// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  API_KEY_PERMISSION_SET,
  extensionDataClassGrant,
  getCapability,
  type ApiKeyPermission,
  type CapabilityDataClass,
} from '@ihui/types';
import {
  DECLARED_PERMISSION_NAMES,
  DECLARED_PERMISSION_NAME_LIST,
  UNMAPPED_PERMISSION_NAMES,
  classifyContributions,
  loadPluginsWithContributionAudit,
  permissionGrantOf,
  resolveDeclaredPermissionName,
  type DeclaredPermissionTarget,
  type PluginDiagnostic,
} from '../src/plugins/index.js';

/**
 * goal-b49 / W6 — 对侧 33 条点分权限名**入库**后的三面一致判据。
 *
 * 钉的五件事:
 *   ① **穷尽性三面一致**:词表(归属表的键集)↔ 校验器(能力目录那把尺 + `API_KEY_PERMISSION_SET`)
 *      ↔ 消费方(装载器的贡献审计真的按这些名给出裁决),三处对不上即红;
 *   ② 归属表**不产出裁决**:有归属的名,其数据类结论必须与"直接声明正牌 scope"逐字相等
 *      —— 相等才证明表只做了改名,没有第二把权限判据尺(票面禁则);
 *   ③ 无归属的名按**默认拒**兜住:拿不到任何数据类,且被逐条点名(§0.3 不得写成"没限制");
 *   ④ 入库不等于扩权:表里任何名都**不得**出现在 `API_KEY_PERMISSION_SET`(那是 api/ai-service 的
 *      真实授权面),对侧词表只以别名形态存在;
 *   ⑤ 装载端到端:声明点分名的插件在装载器里真拿到对应数据类(不是只在函数层自证)。
 */

let root: string;

beforeEach(() => {
  root = mkScratch('plugin-permission-names-');
});

afterEach(() => {
  rmScratch(root);
});

/** 词表键集(第一处键集;不复制名单,直接从在册表取,§22c)。 */
const TABLE = DECLARED_PERMISSION_NAMES as Record<string, DeclaredPermissionTarget>;
const NAMES = [...DECLARED_PERMISSION_NAME_LIST].sort();

function byCode(diagnostics: readonly PluginDiagnostic[], code: string): PluginDiagnostic[] {
  return diagnostics.filter((d) => d.code === code);
}

describe('① 穷尽性:词表 ↔ 校验器 ↔ 消费方', () => {
  it('词表自身:键集与列表同源、无重复、都是点分小写名', () => {
    expect(DECLARED_PERMISSION_NAME_LIST).toHaveLength(Object.keys(TABLE).length);
    expect(NAMES).toEqual([...DECLARED_PERMISSION_NAME_LIST].sort());
    expect(new Set(NAMES).size, '声明名有重复(后写覆盖前写 = 静默丢一条)').toBe(NAMES.length);
    for (const name of NAMES) {
      expect(name, `"${name}" 不是对侧那种点分小写名`).toMatch(/^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/);
    }
  });

  it('校验器侧:有归属的名,其目标 scope 必在正牌枚举 **且** 在能力目录登记(两个判据缺一不可)', () => {
    for (const name of NAMES) {
      const entry = TABLE[name]!;
      if (entry.scope === null) continue;
      expect(API_KEY_PERMISSION_SET.has(entry.scope), `"${name}" 归属到未在册的 "${entry.scope}"`).toBe(true);
      expect(getCapability(entry.scope as ApiKeyPermission), `"${name}" 的目标 "${entry.scope}" 没在能力目录登记`).toBeTruthy();
      const ruler = permissionGrantOf([name]);
      expect(ruler.allowed.length, `"${name}" 归属了却求不出任何数据类`).toBeGreaterThan(0);
      expect(ruler.unregistered, `"${name}" 归属后仍被尺判为未登记`).toEqual([]);
      expect(entry.why.trim().length).toBeGreaterThan(0);
    }
  });

  it('消费方侧:每一条在册声明名都被装载器的贡献审计真裁决过,数据类与尺同输入同输出', () => {
    for (const name of NAMES) {
      const audit = classifyContributions({
        pluginName: 'p',
        file: 'plugin.json',
        permissions: [name],
        contributes: { tools: [{ name: `probe_${name.replace(/\W/g, '_')}`, capability: name }] },
      });
      expect(audit.findings.length, `声明名 "${name}" 没被消费方裁决`).toBe(1);
      const finding = audit.findings[0]!;
      expect(finding.dataClasses).toEqual(permissionGrantOf([name]).allowed);
      expect(finding.verdict).toBe(permissionGrantOf([name]).allowed.length > 0 ? 'accepted' : 'declined');
      if (finding.verdict === 'declined') {
        expect(finding.reasons.join(' ')).toContain('default deny');
        expect(finding.unregisteredPermissions).toContain(name);
      }
    }
  });

  it('三面一致的收口:归属表覆盖全部声明名,漏一条就等于把该条留成静默未知', () => {
    expect(NAMES.length).toBeGreaterThan(0);
    expect(Object.keys(TABLE).sort()).toEqual(NAMES);
    expect([...UNMAPPED_PERMISSION_NAMES].sort()).toEqual(
      NAMES.filter((n) => TABLE[n]!.scope === null).sort(),
    );
  });
});

describe('②③④ 归属表不产出裁决 · 无归属走默认拒 · 入库不扩权', () => {
  it('有归属的名:数据类结论 == 直接声明正牌 scope(表只改名,不另开一把尺)', () => {
    for (const name of NAMES) {
      const entry = TABLE[name]!;
      if (entry.scope === null) continue;
      expect(permissionGrantOf([name]).allowed, `"${name}" 的结论与正牌 scope 不同:出现第二把尺`)
        .toEqual(extensionDataClassGrant({ permissions: [entry.scope] }).allowed);
    }
  });

  it('无归属的名:透传给尺 ⇒ 数据类为空 + 被逐条点名(默认拒)', () => {
    expect(UNMAPPED_PERMISSION_NAMES.length).toBeGreaterThan(0);
    for (const name of UNMAPPED_PERMISSION_NAMES) {
      expect(API_KEY_PERMISSION_SET.has(name), `"${name}" 竟已是正牌 scope,不该留在无归属档`).toBe(false);
      const ruler = permissionGrantOf([name]);
      expect(ruler.allowed, `"${name}" 在没有对位条目的情况下拿到了数据类`).toEqual([]);
      expect(ruler.unregistered).toContain(name);
      expect(TABLE[name]!.why.trim().length, `"${name}" 没写为什么不归属`).toBeGreaterThan(0);
    }
    // 凭据读取这一条单独钉死:它必须是默认拒,不得被任何映射顺手放行
    expect(permissionGrantOf(['auth.readUserToken']).allowed).toEqual([] as CapabilityDataClass[]);
  });

  it('入库不等于扩权:表里任何名都不得进入真实授权面枚举', () => {
    for (const name of NAMES) {
      expect(API_KEY_PERMISSION_SET.has(name), `"${name}" 被写进了 API 授权枚举 = 授权面扩大`).toBe(false);
    }
    expect(resolveDeclaredPermissionName('nope:scope')).toBe('nope:scope');
    expect(permissionGrantOf(['nope:scope']).unregistered).toEqual(['nope:scope']);
  });

  it('正牌 scope 原样透传,别名规则不得反噬正牌名', () => {
    expect(resolveDeclaredPermissionName('agents:read')).toBe('agents:read');
    expect(permissionGrantOf(['agents:read']).allowed).toEqual(['scoped-read']);
  });
});

describe('⑤ 装载端到端:点分权限名在装载器里真算数', () => {
  it('声明 chat.createSession 的插件 ⇒ tools 档 accepted,数据类与 chat:write 同一条结论', () => {
    const dir = path.join(root, 'alias-plugin');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'plugin.json'),
      JSON.stringify(
        {
          name: 'w6-alias',
          version: '1.0.0',
          permissions: ['chat.createSession'],
          contributes: { tools: [{ name: 'session_writer', capability: 'chat.createSession' }] },
        },
        null,
        2,
      ),
      'utf-8',
    );
    const result = loadPluginsWithContributionAudit({ pluginsDir: root });
    const finding = result.contributions.findings.find((f) => f.kind === 'tools');
    expect(finding?.verdict).toBe('accepted');
    expect(finding?.dataClasses).toEqual(extensionDataClassGrant({ permissions: ['chat:write'] }).allowed);
    expect(finding?.unregisteredPermissions).toEqual([]);
    expect(byCode(result.diagnostics, 'plugin-contribution-declined')).toHaveLength(0);
    expect(result.plugins.map((p) => p.name)).toContain('w6-alias');
  });

  it('声明无归属名(纯 UI reveal)的插件 ⇒ 一条数据类都不给,并在诊断里点名该 scope', () => {
    const dir = path.join(root, 'unmapped-plugin');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'plugin.json'),
      JSON.stringify(
        { name: 'w6-reveal', version: '1.0.0', permissions: ['chat.revealSession'], contributes: { commands: [] } },
        null,
        2,
      ),
      'utf-8',
    );
    const result = loadPluginsWithContributionAudit({ pluginsDir: root });
    const finding = result.contributions.findings.find((f) => f.kind === 'commands');
    expect(finding?.verdict).toBe('declined');
    expect(finding?.dataClasses).toEqual([]);
    expect(finding?.unregisteredPermissions).toEqual(['chat.revealSession']);
    const declined = byCode(result.diagnostics, 'plugin-contribution-declined');
    expect(declined).toHaveLength(1);
    expect(declined[0]!.message).toContain('chat.revealSession');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
