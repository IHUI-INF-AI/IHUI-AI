// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * goal-b49 / X2 — registry 汇总口的「待接线」定性与两件可验证处置(2026-11-05)。
 *
 * 本票口径(可复跑):`.ihui-agent/tmp/rea-goal-b49/count-prod-callers.mjs` —— 五枚
 * `get*Extensions` 与 `runTurnInputContributors`/`runCommandContributors` 生产调用数 = 0
 * (阳性对照 `readSkillCatalog` = 1,见脚本 CONTROL 行)。本用例**不复刻**那份口径(§0.6),
 * 只钉两件它照出来的、能在行为面钉死的事:
 *
 *   ① **装载断链已修**:清单里的 `turnInputContributors`/`commandContributors` 过去在
 *      `normalizeManifest` 被静默丢掉 ⇒ 两枚汇总口与两个 runner 恒空(声明的功能到不了
 *      注册表)。现在逐字透传,并由 registry 汇总口在正向对照里读出非空。
 *   ② **别名那一格**:安装通道的 `validateExtensionManifest` 只认正牌 scope,点分声明名
 *      会被判 `permission_not_registered`(显式拒绝,不是静默)。本票交出的适配器让同一张
 *      归属表在安装通道也生效:在册别名通过、未知/无归属仍拒(**不扩权**)。
 *
 * ② 是刻意的正反对照:只验"别名能过"一侧的话,"全都不拒"与"正确归属"在账面上一样。
 */

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateExtensionManifest } from '@ihui/types';
import { loadPlugins } from '../src/plugins/loader.js';
import { PluginRegistry } from '../src/plugins/registry.js';
import {
  DECLARED_PERMISSION_NAMES,
  createAliasAwareManifestValidator,
  normalizeExtensionManifestPermissions,
  resolveDeclaredPermissionName,
} from '../src/plugins/permission-names.js';

let root: string;

beforeEach(() => {
  root = mkScratch('plugin-registry-surface-');
});

afterEach(() => {
  rmScratch(root);
});

function writePlugin(dirName: string, manifest: Record<string, unknown>): string {
  const dir = path.join(root, dirName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  return dir;
}

/** 扩展 manifest 的最小合法外壳(id 反向域名式 / semver / entryCapabilities+activationEvents 必填);权限维由各用例自己给。 */
const BASE_MANIFEST = {
  id: 'com.example.probe',
  name: 'probe',
  version: '1.0.0',
  entryCapabilities: [] as string[],
  activationEvents: [] as string[],
} as const;

/** 与 `createExtensionManifestGate` 的默认注入一致:本用例只量权限名这一维。 */
const VALIDATION_CTX = { isRegisteredScope: () => true } as const;

/** 从校验器通过的 verdict 里取规范化后的 permissions(只读这一维,不 import 具体 manifest 类型)。 */
function manifestPermissionsOf(verdict: { manifest?: unknown }): string[] | undefined {
  const manifest = verdict.manifest;
  if (!manifest || typeof manifest !== 'object') return undefined;
  const permissions = (manifest as Record<string, unknown>).permissions;
  return Array.isArray(permissions) ? permissions.filter((p): p is string => typeof p === 'string') : undefined;
}

describe('① 装载断链:P2-4 两族声明从清单到注册表', () => {
  it('清单声明的 turnInputContributors/commandContributors 透传到 PluginDefinition', () => {
    writePlugin('p24', {
      name: 'p24-probe',
      version: '1.0.0',
      turnInputContributors: ['ctx-loader', 'state-injector'],
      commandContributors: ['lint', 'test'],
    });
    const defs = loadPlugins({ pluginsDir: root });
    const def = defs.find((d) => d.name === 'p24-probe');
    expect(def, '插件未装载,先查夹具').toBeTruthy();
    expect(def?.turnInputContributors).toEqual(['ctx-loader', 'state-injector']);
    expect(def?.commandContributors).toEqual(['lint', 'test']);
  });

  it('注册后两枚汇总口读得出非空(修复前恒为空数组)', () => {
    writePlugin('p24', {
      name: 'p24-probe',
      version: '1.0.0',
      turnInputContributors: ['ctx-loader'],
      commandContributors: ['lint'],
    });
    const registry = new PluginRegistry({ workingDir: root });
    expect(registry.registerAll(loadPlugins({ pluginsDir: root }))).toBe(1);
    expect(registry.getTurnInputContributorExtensions()).toEqual(['ctx-loader']);
    expect(registry.getCommandContributorExtensions()).toEqual(['lint']);
  });

  it('非字符串项被过滤,不影响同族其余项(清单脏数据不炸装载)', () => {
    writePlugin('p24', {
      name: 'p24-probe',
      version: '1.0.0',
      turnInputContributors: ['ctx-loader', 42, null, 'memory-loader'],
      commandContributors: 'not-an-array',
    });
    const def = loadPlugins({ pluginsDir: root }).find((d) => d.name === 'p24-probe');
    expect(def?.turnInputContributors).toEqual(['ctx-loader', 'memory-loader']);
    expect(def?.commandContributors).toBeUndefined();
  });
});

describe('② 安装通道别名:validateExtensionManifest 真跑(正反对照)', () => {
  it('不包装:点分声明名被判 permission_not_registered(现状是显式拒绝,不是静默通过)', () => {
    const result = validateExtensionManifest(
      { ...BASE_MANIFEST, permissions: ['chat.createSession'] },
      VALIDATION_CTX,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.code)).toContain('permission_not_registered');
    expect(result.errors[0]?.path).toBe('permissions[0]');
  });

  it('包装后:同一条别名通过,且交到校验器时已是正牌 scope', () => {
    const validate = createAliasAwareManifestValidator(validateExtensionManifest);
    const result = validate({ ...BASE_MANIFEST, permissions: ['chat.createSession'] }, VALIDATION_CTX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(manifestPermissionsOf(result)).toEqual(['chat:write']);
  });

  it('包装后:未知 scope 仍然拒(适配器不扩权,失效方向是拒)', () => {
    const validate = createAliasAwareManifestValidator(validateExtensionManifest);
    const result = validate({ ...BASE_MANIFEST, permissions: ['nope:scope'] }, VALIDATION_CTX);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.code)).toContain('permission_not_registered');
    expect(result.errors[0]?.message).toContain('nope:scope');
  });

  it('包装后:正牌 scope 原样通过(别名规则不反噬正牌名)', () => {
    const validate = createAliasAwareManifestValidator(validateExtensionManifest);
    const result = validate({ ...BASE_MANIFEST, permissions: ['agents:read'] }, VALIDATION_CTX);
    expect(result.ok).toBe(true);
  });

  it('归属表全量:有归属的别名全过,归属为 null 的 11 条仍拒(逐条点名)', () => {
    const validate = createAliasAwareManifestValidator(validateExtensionManifest);
    const rejected: string[] = [];
    for (const [name, target] of Object.entries(DECLARED_PERMISSION_NAMES)) {
      const result = validate({ ...BASE_MANIFEST, permissions: [name] }, VALIDATION_CTX);
      if (target.scope === null) {
        expect(result.ok, `无归属名 ${name} 不该被放行`).toBe(false);
        rejected.push(name);
      } else {
        expect(result.ok, `有归属的别名 ${name} 未通过`).toBe(true);
        expect(resolveDeclaredPermissionName(name)).toBe(target.scope);
      }
    }
    expect(rejected.length).toBeGreaterThan(0);
  });
});

describe('③ 归一化是纯函数(不改入参、不挪下标)', () => {
  it('不改原对象:入参 permissions 逐字保留', () => {
    const input: Record<string, unknown> = { ...BASE_MANIFEST, permissions: ['chat.createSession', 'workspace.read'] };
    const out = normalizeExtensionManifestPermissions(input) as Record<string, unknown>;
    expect(out).not.toBe(input);
    expect(input.permissions).toEqual(['chat.createSession', 'workspace.read']);
    expect(out.permissions).toEqual(['chat:write', 'workspace:read']);
  });

  it('非对象 / 无 permissions / permissions 非数组 ⇒ 原对象原样返回(形态错归校验器判)', () => {
    expect(normalizeExtensionManifestPermissions(null)).toBeNull();
    expect(normalizeExtensionManifestPermissions('x')).toBe('x');
    const noPerm = { name: 'p' };
    expect(normalizeExtensionManifestPermissions(noPerm)).toBe(noPerm);
    const badPerm = { permissions: 'oops' };
    expect(normalizeExtensionManifestPermissions(badPerm)).toBe(badPerm);
  });

  it('数组里的非字符串项原样保留,不 filter(否则校验器点名的 permissions[i] 会错位)', () => {
    const out = normalizeExtensionManifestPermissions({
      ...BASE_MANIFEST,
      permissions: ['chat.createSession', 7],
    }) as { permissions: unknown[] };
    expect(out.permissions).toEqual(['chat:write', 7]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
