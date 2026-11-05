// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  EXTENSION_ACTIVATION_EVENTS,
  extensionDataClassGrant,
  validateExtensionManifest,
  type ExtensionManifestIssue,
} from '@ihui/types';
import {
  ACTIVATION_POLICY,
  classifyActivations,
  loadPlugins,
  loadPluginsWithContributionAudit,
  type PluginDiagnostic,
} from '../src/plugins/index.js';

/**
 * goal-b49 / W6 — 激活事件词表的运行期消费方(装载 / 延迟 / 拒绝三态)就住在本装载器。
 *
 * 钉的六件事(缺一不算"接上了"):
 *   ① **穷尽性三面一致**:词表(`EXTENSION_ACTIVATION_EVENTS`)↔ 校验器(`validateExtensionManifest`
 *      真跑,不抄它的错误码表)↔ 消费方(`ACTIVATION_POLICY` 键集)三处键集逐字相等,少一项即红;
 *   ② 三态各自有**真实宿主调用点**:`load` / `defer` 必须给得出 source,`reject` 必须给得出原因;
 *   ③ 拒绝**出声**且分两种形态:无宿主源 / 默认拒 ⇒ `plugin-activation-rejected`,
 *      不认识 / 形态坏 ⇒ `plugin-activation-unknown-event`(正文点名当前词表全量);
 *   ④ `load` / `defer` **不造噪声行**,未声明该字段 ⇒ 零条裁决(把"没写"写成"已判"是 §0.3 的反面);
 *   ⑤ 判定只有一把尺:finding 的 `dataClasses` 必须与 `extensionDataClassGrant` 同输入同输出;
 *   ⑥ 拒事件不牵连装载本身(升档会把可整改的提示变成启动红旗,§12e)。
 *
 * 正反对照是刻意的:只验"拒"一侧,恒拒与恒放在账面上长得一模一样。
 */

let root: string;

beforeEach(() => {
  root = mkScratch('plugin-activation-events-');
});

afterEach(() => {
  rmScratch(root);
});

function writePlugin(dirName: string, manifest: Record<string, unknown>): string {
  const dir = path.join(root, dirName);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'plugin.json');
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2), 'utf-8');
  return file;
}

function byCode(diagnostics: readonly PluginDiagnostic[], code: string): PluginDiagnostic[] {
  return diagnostics.filter((d) => d.code === code);
}

/** 真跑上游校验器:该事件会不会被判成 activation_event_unknown(不在测试里复算判据,§22c)。 */
function validatorIssuesFor(event: string): ExtensionManifestIssue[] {
  const result = validateExtensionManifest(
    {
      id: 'com.example.activation-probe',
      name: 'activation-probe',
      version: '1.0.0',
      permissions: ['agents:read'],
      entryCapabilities: ['agents:read'],
      activationEvents: [event],
    },
    { isRegisteredScope: (scope: string) => scope === 'agents:read' },
  );
  return result.ok ? [] : result.errors;
}

describe('① 穷尽性:词表 ↔ 校验器 ↔ 消费方,三处键集逐字一致', () => {
  const vocabulary = [...EXTENSION_ACTIVATION_EVENTS].sort();

  it('消费方裁决表的键集 == 词表(少一档即红:那一档会掉进 unknown-event)', () => {
    expect(Object.keys(ACTIVATION_POLICY).sort()).toEqual(vocabulary);
  });

  it('校验器接受词表每一档(真跑 validateExtensionManifest,不抄它的判据)', () => {
    for (const event of vocabulary) {
      const unknown = validatorIssuesFor(event).filter((e) => e.code === 'activation_event_unknown');
      expect(unknown, `词表档 "${event}" 被上游校验器判成未知事件:两处已漂移`).toEqual([]);
    }
    // 反向对照:词表外的事件必须被校验器拒(否则"恒绿"与"真判过"同形)
    expect(validatorIssuesFor('onNotARealEvent').some((e) => e.code === 'activation_event_unknown')).toBe(true);
  });

  it('三处一致才算数:词表每一档在消费方里都有具名裁决', () => {
    for (const event of vocabulary) {
      const audit = classifyActivations({
        pluginName: 'p',
        file: 'plugin.json',
        permissions: ['agents:read'],
        activationEvents: [event],
      });
      expect(audit.findings.length, `档 "${event}" 没被消费方裁决`).toBe(1);
      expect(audit.findings[0]!.reasons.length, `档 "${event}" 的裁决没有原因`).toBeGreaterThan(0);
    }
  });
});

describe('② 三态都有据可查', () => {
  it('load / defer 必须给得出真实调用点;reject 必须给得出原因', () => {
    for (const [event, policy] of Object.entries(ACTIVATION_POLICY)) {
      expect(['load', 'defer', 'reject'], `"${event}" 的档位不在三态内`).toContain(policy.disposition);
      expect(policy.reason.trim().length, `"${event}" 没有可复述的原因`).toBeGreaterThan(0);
      if (policy.disposition === 'reject') continue;
      expect(policy.source, `"${event}" 标了 ${policy.disposition} 却拿不出调用点`).not.toBe('none');
      expect(policy.source).toContain('agent.ts');
    }
  });

  it('本宿主的启动点只有一档:装载即激活的是 onStartup', () => {
    const loaded = Object.entries(ACTIVATION_POLICY).filter(([, p]) => p.disposition === 'load').map(([k]) => k);
    expect(loaded).toEqual(['onStartup']);
  });

  it('defer 档点名它挂在哪个宿主事件源上(preToolCall 面)', () => {
    expect(ACTIVATION_POLICY.onToolCall!.source).toContain('preToolCall');
    expect(ACTIVATION_POLICY.onSkillInvoke!.source).toContain('preToolCall');
  });

  it('对侧的 onChatMention:<id> 一族我方无档:词表里没有参数化事件(取证结论,不是缺功能)', () => {
    for (const event of EXTENSION_ACTIVATION_EVENTS) {
      expect(event, `词表里出现了参数化事件 "${event}":消费方/宿主两侧必须同批动`).not.toContain(':');
    }
  });
});

describe('③④ 拒绝出声、生效不喧哗', () => {
  it('无宿主源(onViewMount)⇒ 一条 plugin-activation-rejected,点名事件与原因', () => {
    const file = writePlugin('view-only', {
      name: 'w6-view',
      version: '1.0.0',
      permissions: ['agents:read'],
      activationEvents: ['onViewMount'],
    });
    const result = loadPluginsWithContributionAudit({ pluginsDir: root });
    const rejected = byCode(result.diagnostics, 'plugin-activation-rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.severity).toBe('warning');
    expect(rejected[0]!.file).toBe(file);
    expect(rejected[0]!.message).toContain('onViewMount');
    expect(rejected[0]!.message).toContain('no view host');
    expect(byCode(result.diagnostics, 'plugin-activation-unknown-event')).toHaveLength(0);
  });

  it('默认拒:醒得来但没有任何可达数据类 ⇒ rejected + default deny 文案', () => {
    const audit = classifyActivations({
      pluginName: 'p',
      file: 'plugin.json',
      activationEvents: ['onToolCall'],
    });
    expect(audit.rejectedCount).toBe(1);
    expect(audit.findings[0]!.reasonCode).toBe('default-deny');
    expect(audit.findings[0]!.reasons.join(' ')).toContain('default deny');
    expect(audit.findings[0]!.dataClasses).toEqual([]);
  });

  it('词表外的事件 ⇒ unknown-event 码,正文点名当前词表全量', () => {
    writePlugin('bogus-event', {
      name: 'w6-bogus',
      version: '1.0.0',
      permissions: ['agents:read'],
      activationEvents: ['onTeleport'],
    });
    const result = loadPluginsWithContributionAudit({ pluginsDir: root });
    const unknown = byCode(result.diagnostics, 'plugin-activation-unknown-event');
    expect(unknown).toHaveLength(1);
    expect(unknown[0]!.message).toContain('onTeleport');
    for (const event of EXTENSION_ACTIVATION_EVENTS) {
      expect(unknown[0]!.message, `拒绝时未点名当前词表档位 "${event}"`).toContain(event);
    }
    expect(byCode(result.diagnostics, 'plugin-activation-rejected')).toHaveLength(0);
  });

  it('activationEvents 不是数组 ⇒ 出声(不当"没声明"),但插件照常装载', () => {
    const audit = classifyActivations({ pluginName: 'p', file: 'plugin.json', permissions: ['agents:read'], activationEvents: 'onStartup' });
    expect(audit.rejectedCount).toBe(1);
    expect(audit.findings[0]!.reasonCode).toBe('invalid-shape');
    expect(audit.findings[0]!.reasons.join(' ')).toContain('must be an array');
  });

  it('正向对照:load / defer 各占一条裁决但零诊断;未声明该字段 ⇒ 零条裁决、零行日志', () => {
    writePlugin('quiet', {
      name: 'w6-quiet',
      version: '1.0.0',
      tools: ['todo_list'],
      permissions: ['agents:read'],
      contributes: { tools: [{ name: 'todo_list', capability: 'agents:read' }] },
      activationEvents: ['onStartup', 'onToolCall'],
    });
    const result = loadPluginsWithContributionAudit({ pluginsDir: root });
    expect(result.activations.loadedCount).toBe(1);
    expect(result.activations.deferredCount).toBe(1);
    expect(result.activations.rejectedCount).toBe(0);
    expect(byCode(result.diagnostics, 'plugin-activation-rejected')).toHaveLength(0);
    expect(byCode(result.diagnostics, 'plugin-activation-unknown-event')).toHaveLength(0);

    writePlugin('silent', { name: 'w6-silent', version: '1.0.0', permissions: ['agents:read'] });
    const second = loadPluginsWithContributionAudit({ pluginsDir: root });
    // quiet 那枚仍无激活诊断,silent 连裁决都不该有(把"没写"写成"已判"就是造噪声)
    expect(second.activations.findings.some((f) => f.pluginName === 'w6-silent')).toBe(false);
    expect(byCode(second.diagnostics, 'plugin-activation-unknown-event')).toHaveLength(0);
  });
});

describe('⑤⑥ 判定只有一把尺;拒事件不阻断装载', () => {
  it('finding 的数据类集合 == capability-catalog 那把尺同输入同输出(不是第二份判据)', () => {
    const permissions = ['agents:read', 'files:write'];
    const ruler = extensionDataClassGrant({ permissions });
    const audit = classifyActivations({ pluginName: 'p', file: 'plugin.json', permissions, activationEvents: ['onStartup'] });
    expect(audit.findings[0]!.dataClasses).toEqual(ruler.allowed);
    expect(audit.findings[0]!.disposition).toBe('load');
    expect(audit.loadedCount).toBe(1);
  });

  it('事件被拒不影响装载:插件仍在 plugins 里(拒的是"什么时候醒",不是"装不装")', () => {
    writePlugin('reject-but-load', { name: 'w6-load', version: '1.0.0', permissions: ['agents:read'], activationEvents: ['onSchedule'] });
    const result = loadPluginsWithContributionAudit({ pluginsDir: root });
    expect(result.plugins.map((p) => p.name)).toContain('w6-load');
    expect(result.activations.rejectedCount).toBe(1);
    expect(loadPlugins({ pluginsDir: root }).map((p) => p.name)).toContain('w6-load');
  });

  it('同一份清单声明两次同一事件 ⇒ 两条裁决(重复不得被静默折掉)', () => {
    const audit = classifyActivations({ pluginName: 'p', file: 'plugin.json', permissions: ['agents:read'], activationEvents: ['onStartup', 'onStartup'] });
    expect(audit.findings).toHaveLength(2);
    expect(audit.loadedCount).toBe(2);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
