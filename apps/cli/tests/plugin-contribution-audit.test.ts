// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EXTENSION_CONTRIBUTION_KINDS } from '@ihui/types';
import {
  classifyContributions,
  loadPlugins,
  loadPluginsWithContributionAudit,
  loadPluginsWithDiagnostics,
} from '../src/plugins/loader.js';

/**
 * goal-b49 / S2 — 贡献词表的运行期消费方就住在本装载器。
 *
 * 钉的五件事(缺一不算"接上了"):
 *   ① 对侧那几档(`nativeModules` / `sessionResources` / `chatMentionProviders` …)被装载器**认得**:
 *      认得 ≠ 接受。本 CLI 宿主没有对应落点 ⇒ 逐档 `declined` 且点名原因,绝不是静默忽略;
 *   ② 词表外的档 ⇒ `unknown-kind`,并把当前词表全量报出来(排查方向指对);
 *   ③ 声明了贡献却没声明权限 ⇒ **默认拒**,一条数据类都不给;
 *   ④ 词表每一档都必须有裁决条目(`Record<ExtensionContributionKind,…>` 的编译期那一半之外,
 *      运行期再量一遍:漏一档 ⇒ 该档会掉进 unknown-kind,这里当场红);
 *   ⑤ 默认拒不得误伤正常件:声明了合法权限的插件,其 `wired` 档必须 accepted 且照常装载。
 *
 * 正反对照是刻意的:只验"拒"一侧,恒拒(全都拒)与恒放(全都不拒)在账面上长得一模一样。
 */

let root: string;

beforeEach(() => {
  root = mkScratch('plugin-contribution-audit-');
});

afterEach(() => {
  rmScratch(root);
});

/** 建一枚插件目录并写清单,返回插件目录路径 */
function writePlugin(dirName: string, manifest: Record<string, unknown>): string {
  const dir = path.join(root, dirName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  return dir;
}

function baseManifest(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { name: 'b49-probe', version: '1.0.0', ...extra };
}

function findingFor(pluginsDir: string, kind: string) {
  const audit = loadPluginsWithContributionAudit({ pluginsDir: root }).contributions;
  const file = path.join(pluginsDir, 'plugin.json');
  return audit.findings.filter((f) => f.kind === kind && f.file === file);
}

describe('① 新档被装载器识别(认得 ≠ 接受)', () => {
  it('nativeModules ⇒ declined 并点名"要原生二进制",不是 unknown-kind', () => {
    const dir = writePlugin(
      'pip',
      baseManifest({
        permissions: ['agents:read'],
        contributes: { nativeModules: [{ name: 'picture_in_picture', capability: 'agents:read' }] },
      }),
    );
    const [finding] = findingFor(dir, 'nativeModules');
    expect(finding, '装载器不认识 nativeModules:它被归成了未登记档或被静默丢弃').toBeTruthy();
    expect(finding!.verdict).toBe('declined');
    expect(finding!.reasons.join(' ')).toContain('native');
    expect(finding!.itemCount).toBe(1);
  });

  it('sessionResources / chatMentionProviders 同样各有具名裁决', () => {
    const dir = writePlugin(
      'know',
      baseManifest({
        permissions: ['agents:read'],
        contributes: {
          sessionResources: [{ name: 'qmind_sources', capability: 'agents:read' }],
          chatMentionProviders: [{ name: 'knowledge', capability: 'agents:read' }],
        },
      }),
    );
    expect(findingFor(dir, 'sessionResources')[0]?.verdict).toBe('declined');
    expect(findingFor(dir, 'chatMentionProviders')[0]?.verdict).toBe('declined');
  });
});

describe('② 未知档 ⇒ 拒并点名', () => {
  it('词表外的档落 unknown-kind,原因里带当前词表全量', () => {
    const dir = writePlugin(
      'weird',
      baseManifest({
        permissions: ['agents:read'],
        contributes: { totallyBogusKind: [{ name: 'x', capability: 'agents:read' }] },
      }),
    );
    const [finding] = findingFor(dir, 'totallyBogusKind');
    expect(finding).toBeTruthy();
    expect(finding!.verdict).toBe('unknown-kind');
    const reasons = finding!.reasons.join(' ');
    expect(reasons).toContain('not a known contribution kind');
    for (const kind of EXTENSION_CONTRIBUTION_KINDS) {
      expect(reasons, `拒绝时未点名当前词表档位 "${kind}"`).toContain(kind);
    }
  });

  it('contributes 不是对象 ⇒ 出声,不当"没声明"', () => {
    const audit = classifyContributions({
      pluginName: 'p',
      file: 'plugin.json',
      permissions: ['agents:read'],
      contributes: [{ name: 'x' }],
    });
    expect(audit.unknownKindCount).toBe(1);
    expect(audit.findings[0]?.kind).toBe('contributes');
  });
});

describe('③ 缺权限声明 ⇒ 默认拒(正反对照)', () => {
  it('声明了 wired 档但没有任何 permissions ⇒ declined,数据类集合为空', () => {
    const dir = writePlugin(
      'no-perm',
      baseManifest({ contributes: { tools: [{ name: 'todo_list', capability: 'agents:read' }] } }),
    );
    const [finding] = findingFor(dir, 'tools');
    expect(finding, 'wired 档漏了默认拒这一闸 ⇒ 未声明权限也能拿数据面').toBeTruthy();
    expect(finding!.verdict).toBe('declined');
    expect(finding!.reasons.join(' ')).toContain('default deny');
    expect(finding!.dataClasses).toEqual([]);
  });

  it('声明了目录里查无此 scope 的权限 ⇒ 仍默认拒,并把该 scope 点名', () => {
    const dir = writePlugin(
      'bogus-perm',
      baseManifest({
        permissions: ['nope:scope'],
        contributes: { commands: [{ name: 'b49_cmd', capability: 'nope:scope' }] },
      }),
    );
    const [finding] = findingFor(dir, 'commands');
    expect(finding!.verdict).toBe('declined');
    expect(finding!.unregisteredPermissions).toEqual(['nope:scope']);
    expect(finding!.reasons.join(' ')).toContain('nope:scope');
  });
});

describe('④ 词表每一档在装载器里都有裁决(少一档即红)', () => {
  it('逐档构造一份清单:任何一档都不得掉进 unknown-kind', () => {
    for (const kind of EXTENSION_CONTRIBUTION_KINDS) {
      const audit = classifyContributions({
        pluginName: 'p',
        file: 'plugin.json',
        permissions: ['agents:read'],
        contributes: { [kind]: [{ name: `probe_${kind}`, capability: 'agents:read' }] },
      });
      expect(audit.findings.length, `档 "${kind}" 没被装载器裁决`).toBe(1);
      expect(audit.unknownKindCount, `档 "${kind}" 掉进了 unknown-kind`).toBe(0);
      // 本宿主唯一能真接住的是 tools/commands;其余档必须具名 declined,不许静默
      if (kind === 'tools' || kind === 'commands') {
        expect(audit.findings[0]?.verdict).toBe('accepted');
      } else {
        expect(audit.findings[0]?.verdict).toBe('declined');
        expect(audit.findings[0]!.reasons.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('⑤ 默认拒不误伤正常件', () => {
  it('声明了合法权限的插件:tools 档 accepted,且插件照常装载', () => {
    const dir = writePlugin(
      'good',
      baseManifest({
        tools: ['todo_list'],
        permissions: ['agents:read'],
        contributes: { tools: [{ name: 'todo_list', capability: 'agents:read' }] },
      }),
    );
    const result = loadPluginsWithContributionAudit({ pluginsDir: root });
    const finding = result.contributions.findings.find((f) => f.kind === 'tools' && f.file === path.join(dir, 'plugin.json'));
    expect(finding?.verdict).toBe('accepted');
    expect(finding?.dataClasses).toEqual(['scoped-read']);
    expect(result.contributions.declinedCount).toBe(0);
    expect(result.plugins.map((p) => p.name)).toContain('b49-probe');
  });

  it('同宿主的既有契约不变:loadPlugins / loadPluginsWithDiagnostics 仍只回老形态', () => {
    writePlugin('legacy', baseManifest({ tools: ['a'] }));
    expect(loadPlugins({ pluginsDir: root }).map((p) => p.name)).toContain('b49-probe');
    const legacy = loadPluginsWithDiagnostics({ pluginsDir: root });
    expect(Object.keys(legacy).sort()).toEqual(['diagnostics', 'plugins']);
    expect(legacy.diagnostics).toEqual([]);
  });

  it('因同名歧义不装载的插件,其贡献裁决仍逐条出声(歧义管装不装,不管声明了什么)', () => {
    writePlugin('dup-a', { name: 'same', version: '1.0.0', permissions: ['agents:read'], contributes: { views: [{ name: 'v1', capability: 'agents:read' }] } });
    writePlugin('dup-b', { name: 'same', version: '1.0.0', permissions: ['agents:read'], contributes: { views: [{ name: 'v2', capability: 'agents:read' }] } });
    const result = loadPluginsWithContributionAudit({ pluginsDir: root });
    expect(result.plugins).toHaveLength(0);
    const views = result.contributions.findings.filter((f) => f.kind === 'views');
    expect(views).toHaveLength(2);
    expect(views.every((f) => f.verdict === 'declined')).toBe(true);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
