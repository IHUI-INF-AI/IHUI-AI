// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-408① — 项目(第 3 层 `<cwd>/.ihui/settings.json`)可写键封闭表测试。
 * 判据式核心用例:**把 allowDangerous 放进项目层 settings.json ⇒ 不生效,且大声拒绝**(点名键),
 * 另配三条不可缺的对照:
 *  - 用户全局层写 allowDangerous 仍然生效(拒绝只落在项目层,回退路径可用);
 *  - 项目层写合法键(apiUrl 等)照常合入(策略没把正常路径一起砸了);
 *  - 未知键/非法枚举值拒绝并点名(不静默丢弃、不静默接受)。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  filterProjectLayerSettings,
  PROJECT_ALLOWED_SETTINGS_KEYS,
  PROJECT_KEY_VALIDATORS,
  SECURITY_SENSITIVE_SETTINGS_KEYS,
} from '../src/config/layer-policy.js';
import { loadConfig, sourcesFor } from '../src/config/index.js';
import { DEFAULT_SETTINGS } from '../src/config/defaults.js';

describe('layer-policy 纯函数:封闭表自洽', () => {
  it('两张表互斥(同一键不得既可写又敏感)', () => {
    const allow = new Set<string>(PROJECT_ALLOWED_SETTINGS_KEYS);
    for (const k of SECURITY_SENSITIVE_SETTINGS_KEYS) {
      expect(allow.has(k), `安全键 ${k} 不得同时出现在项目白名单`).toBe(false);
    }
  });

  it('白名单与校验器表逐字等值(表有键而校验器没有 ⇒ 该键的枚举/类型校验无人执行)', () => {
    const validators = Object.keys(PROJECT_KEY_VALIDATORS).sort();
    const allowed = [...PROJECT_ALLOWED_SETTINGS_KEYS].map(String).sort();
    expect(validators).toEqual(allowed);
  });

  it('DEFAULT_SETTINGS 的每个顶层键都被两张表覆盖(新增键漏登记 ⇒ 本用例点名)', () => {
    const all = new Set<string>([...PROJECT_ALLOWED_SETTINGS_KEYS, ...SECURITY_SENSITIVE_SETTINGS_KEYS]);
    const missing = Object.keys(DEFAULT_SETTINGS).filter((k) => !all.has(k));
    expect(missing, `未登记的 Settings 顶层键: ${missing.join(', ')}`).toEqual([]);
  });

  it('安全敏感键拒绝:分类为 security-sensitive 且原因可行动(点名落点)', () => {
    const { accepted, rejected } = filterProjectLayerSettings({ allowDangerous: true });
    expect(Object.keys(accepted)).toEqual([]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.key).toBe('allowDangerous');
    expect(rejected[0]!.category).toBe('security-sensitive');
    expect(rejected[0]!.reason).toContain('~/.ihui/settings.json');
  });

  it('permissionMode 同型(票面点名的第二个键,不得只拦 allowDangerous)', () => {
    const { rejected } = filterProjectLayerSettings({ permissionMode: 'bypassPermissions' });
    expect(rejected[0]?.category).toBe('security-sensitive');
  });

  it('未知键拒绝:白名单是封闭的,未声明的顶层键不静默接受', () => {
    const { accepted, rejected } = filterProjectLayerSettings({ totallyUnknownKey: 1 });
    expect(Object.keys(accepted)).toEqual([]);
    expect(rejected[0]?.category).toBe('unknown-key');
  });

  it('非法枚举/类型拒绝并点名:locale 越界、maxIterations 非正整数、apiUrl 非 http(s)', () => {
    const { accepted, rejected } = filterProjectLayerSettings({
      locale: 'fr',
      maxIterations: -3,
      apiUrl: 'ftp://nope',
      provider: 'ollama',
    });
    expect(rejected.map((r) => r.key).sort()).toEqual(['apiUrl', 'locale', 'maxIterations']);
    expect(rejected.every((r) => r.category === 'invalid-value')).toBe(true);
    expect(accepted).toEqual({ provider: 'ollama' });
  });

  it('合法键原样通过(阳性对照:策略不是"项目层什么都别想写")', () => {
    const { accepted, rejected } = filterProjectLayerSettings({
      apiUrl: 'https://example.invalid',
      locale: 'en',
      maxIterations: 40,
      nativeFunctionCalling: 'auto',
      sampler: { temperature: 0.2 },
    });
    expect(rejected).toEqual([]);
    expect(accepted).toEqual({
      apiUrl: 'https://example.invalid',
      locale: 'en',
      maxIterations: 40,
      nativeFunctionCalling: 'auto',
      sampler: { temperature: 0.2 },
    });
  });
});

describe('loadConfig 端到端:项目层安全键不生效且大声拒绝(G-408① 判据用例)', () => {
  let tmpProject: string;
  let tmpHome: string;
  let origHome: string | undefined;
  let origUserProfile: string | undefined;
  let warnLines: string[];
  let origWarn: typeof console.warn;

  beforeEach(() => {
    tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cfg-proj-'));
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cfg-home-'));
    origHome = process.env.HOME;
    origUserProfile = process.env.USERPROFILE;
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
    warnLines = [];
    origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnLines.push(args.map(String).join(' '));
    };
  });

  afterEach(() => {
    console.warn = origWarn;
    for (const d of [tmpProject, tmpHome]) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
      } catch {
        /* TEMP 回收兜底 */
      }
    }
    if (origHome === undefined) delete process.env.HOME;
    else process.env.HOME = origHome;
    if (origUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = origUserProfile;
  });

  function writeProjectSettings(obj: Record<string, unknown>): string {
    const dir = path.join(tmpProject, '.ihui');
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, 'settings.json');
    fs.writeFileSync(p, JSON.stringify(obj), 'utf-8');
    return p;
  }

  it('allowDangerous/permissionMode/apiKey 进项目层 ⇒ 不生效 + stderr 点名每个键;合法键照常合入', () => {
    writeProjectSettings({
      allowDangerous: true,
      permissionMode: 'bypassPermissions',
      apiKey: 'sk_live_from_repo_content',
      locale: 'fr',
      notASettingsKey: 1,
      apiUrl: 'https://project-layer.example.invalid',
    });
    const s = loadConfig({ cwd: tmpProject, env: {}, cliArgs: {} });
    // 拒绝生效:合并结果落在默认值,而不是项目层写入的值
    expect(s.allowDangerous).toBe(DEFAULT_SETTINGS.allowDangerous);
    expect(s.allowDangerous).toBe(false);
    expect(s.permissionMode).toBe('default');
    expect(s.apiKey).toBeUndefined();
    expect(s.locale).toBe(DEFAULT_SETTINGS.locale);
    // 正常路径未被砸:合法键合入
    expect(s.apiUrl).toBe('https://project-layer.example.invalid');
    // 大声拒绝:每一条点名(键名出现在 stderr 记录里),一条都不能哑
    const joined = warnLines.join('\n');
    for (const k of ['allowDangerous', 'permissionMode', 'apiKey', 'locale', 'notASettingsKey']) {
      expect(joined, `拒绝记录必须点名 ${k}`).toContain(k);
    }
  });

  it('出处探针同面:被拒的键不得再以 project 层出现在 sourcesFor(判据只有一处)', () => {
    writeProjectSettings({ allowDangerous: true });
    const entries = sourcesFor('allowDangerous', { cwd: tmpProject, env: {}, cliArgs: {} });
    expect(entries.some((e) => e.layer === 'project')).toBe(false);
  });

  it('回退路径阳性对照:同一把 allowDangerous 写进用户全局层 ⇒ 生效(拒绝只落在项目层)', () => {
    fs.mkdirSync(path.join(tmpHome, '.ihui'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpHome, '.ihui', 'settings.json'),
      JSON.stringify({ allowDangerous: true }),
      'utf-8',
    );
    // 项目里只放一个合法键:证明同一次读取中"全局安全键生效 + 项目合法键生效"并存
    writeProjectSettings({ apiUrl: 'https://ok.example.invalid' });
    const s = loadConfig({ cwd: tmpProject, env: {}, cliArgs: {} });
    expect(s.allowDangerous).toBe(true);
    expect(s.apiUrl).toBe('https://ok.example.invalid');
    expect(warnLines.join('\n')).not.toMatch(/拒绝/);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
