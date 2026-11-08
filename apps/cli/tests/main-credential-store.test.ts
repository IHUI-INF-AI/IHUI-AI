// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 主凭据安全存储(settings.json 的 apiKey/refreshToken/apiSecret)回归用例。
 *
 * 对照验收口径:
 *   ① 旧格式(明文 settings.json)首次加载即迁入安全存储,并从盘上剥净;
 *   ② 迁移后盘上任何位置(settings / 备份 / 日志 / 存储本身)都不再出现令牌原文;
 *   ③ 安全存储不可用时 fail-closed:写入口报错、读入口进故障台账、需要凭据的操作抛处置说明,
 *      **不落任何明文文件**;
 *   ④ 并发/多实例各自只改自己的字段,不整份覆盖(后写者不会把先写者的字段抹掉)。
 *
 * 令牌一律用合成值:`ihui-main-cred-test-only-*`。**任何断言/快照里都不出现真实令牌**。
 */

import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mergeSettingsFromCwd } from '../src/commands/settings.js';
import {
  MAIN_CRED_BACKEND_ENV,
  MainCredentialStoreError,
  applyStoredMainCredentials,
  assertMainCredentialStoreUsable,
  clearMainCredentials,
  getMainCredentialStoreFailure,
  getMainCredentialStorePaths,
  migratePlaintextCredentials,
  readMainCredentials,
  withoutMainCredentialFields,
  writeMainCredentials,
} from '../src/lib/main-credential-store.js';

// 本文件每个用例都要真落盘(建密钥 + 信封 + 回读),还有起子进程的并发用例:
// 只在本文件放宽超时,不动仓库全局 testTimeout。
vi.setConfig({ testTimeout: 120_000 });

/** 合成令牌(仅测试用,与真实凭据无关)。 */
const TOKEN_A = 'ihui-main-cred-test-only-api-key-aaaa';
const TOKEN_B = 'ihui-main-cred-test-only-refresh-token-bbbb';
const TOKEN_C = 'ihui-main-cred-test-only-api-secret-cccc';

let root: string;
let homeDir: string;
let ihuiDir: string;
let settingsPath: string;
const savedEnv = new Map<string, string | undefined>();

function setEnv(key: string, value: string | undefined): void {
  if (!savedEnv.has(key)) savedEnv.set(key, process.env[key]);
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function writeJson(target: string, value: unknown): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

function readJson(target: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(target, 'utf-8')) as Record<string, unknown>;
}

/** 目录里所有文件的原始内容(用于断言"没有任何文件含令牌原文")。 */
function readAllText(dir: string): string {
  const chunks: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isFile()) chunks.push(fs.readFileSync(full, 'utf-8'));
  }
  return chunks.join('\n');
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-main-cred-'));
  homeDir = path.join(root, 'home');
  ihuiDir = path.join(homeDir, '.ihui');
  settingsPath = path.join(ihuiDir, 'settings.json');
  fs.mkdirSync(ihuiDir, { recursive: true });
  // settings 的 home 层与主凭据存储目录都跟着 HOME/IHUI_HOME 走:两边指到同一个临时 home
  setEnv('HOME', homeDir);
  setEnv('USERPROFILE', homeDir);
  setEnv('IHUI_HOME', ihuiDir);
  // 钉选机器绑定档:不跑 DPAPI 探针(Windows 上每次冷启动都是秒级),也保证档位可复现
  setEnv(MAIN_CRED_BACKEND_ENV, 'encrypted-file');
});

afterEach(() => {
  for (const [key, value] of savedEnv) setEnv(key, value);
  savedEnv.clear();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('主凭据安全存储', () => {
  it('旧格式迁移:明文 settings.json 搬进安全存储并从盘上剥净', () => {
    writeJson(settingsPath, { apiKey: TOKEN_A, refreshToken: TOKEN_B, theme: 'dark' });

    const result = migratePlaintextCredentials([settingsPath]);

    expect(result.failure).toBeUndefined();
    expect(result.migrated).toBe(true);
    expect(result.strippedFiles).toBe(1);

    const stored = readMainCredentials();
    expect(stored.state).toBe('ok');
    expect(stored.credentials.apiKey).toBe(TOKEN_A);
    expect(stored.credentials.refreshToken).toBe(TOKEN_B);

    const onDisk = readJson(settingsPath);
    expect(onDisk).not.toHaveProperty('apiKey');
    expect(onDisk).not.toHaveProperty('refreshToken');
    // 非凭据字段必须原样保留(迁移不是"重写整份配置")
    expect(onDisk.theme).toBe('dark');

    const paths = getMainCredentialStorePaths();
    // 与 MCP 同一套信封判据:结构级"恰一层"
    const envelope = readJson(paths.storePath);
    expect(Object.keys(envelope)).toEqual(['ihuiVaultV1']);
    // 存储本身不得含明文
    expect(fs.readFileSync(paths.storePath, 'utf-8')).not.toContain(TOKEN_A);
  });

  it('迁移后明文不再出现:备份/日志被清洗,存储与 settings 均无令牌原文', () => {
    writeJson(settingsPath, { apiKey: TOKEN_A, refreshToken: TOKEN_B });
    const backupPath = `${settingsPath}.bak`;
    const logPath = path.join(ihuiDir, 'logs', 'cli.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(backupPath, `{"apiKey":"${TOKEN_A}"}\n`, 'utf-8');
    fs.writeFileSync(logPath, `token=${TOKEN_B} apiKey=${TOKEN_A}\n`, 'utf-8');

    const result = migratePlaintextCredentials([settingsPath]);

    expect(result.failure).toBeUndefined();
    expect(result.scrubbedFiles).toBeGreaterThanOrEqual(2);

    expect(fs.readFileSync(backupPath, 'utf-8')).not.toContain(TOKEN_A);
    expect(fs.readFileSync(backupPath, 'utf-8')).toContain('[REDACTED]');
    const logRaw = fs.readFileSync(logPath, 'utf-8');
    expect(logRaw).not.toContain(TOKEN_A);
    expect(logRaw).not.toContain(TOKEN_B);
    expect(logRaw).toContain('[REDACTED]');

    expect(fs.readFileSync(settingsPath, 'utf-8')).not.toContain(TOKEN_A);
    expect(readAllText(ihuiDir)).not.toContain(TOKEN_A);
    expect(readAllText(ihuiDir)).not.toContain(TOKEN_B);
  });

  it('迁移来源不在 ~/.ihui 时:同目录的备份/日志同样清洗', () => {
    const claudeDir = path.join(homeDir, '.claude');
    const claudeSettings = path.join(claudeDir, 'settings.json');
    const claudeBackup = `${claudeSettings}.bak`;
    writeJson(claudeSettings, { apiKey: TOKEN_A });
    fs.writeFileSync(claudeBackup, `apiKey=${TOKEN_A}\n`, 'utf-8');

    const result = migratePlaintextCredentials([claudeSettings]);

    expect(result.failure).toBeUndefined();
    expect(result.scrubbedFiles).toBeGreaterThanOrEqual(1);
    expect(fs.readFileSync(claudeBackup, 'utf-8')).toContain('apiKey=[REDACTED]');
    expect(fs.readFileSync(claudeBackup, 'utf-8')).not.toContain(TOKEN_A);
    expect(fs.readFileSync(claudeSettings, 'utf-8')).not.toContain(TOKEN_A);
    expect(readMainCredentials().credentials.apiKey).toBe(TOKEN_A);
  });

  it('安全存储不可用时 fail-closed:写入报错、读取进故障台账、需要凭据的操作抛处置说明', () => {
    setEnv(MAIN_CRED_BACKEND_ENV, 'unavailable');

    // ① 写入口必须显式失败,且不落任何明文文件
    let thrown: unknown;
    try {
      writeMainCredentials({ apiKey: TOKEN_A });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(MainCredentialStoreError);
    const error = thrown as MainCredentialStoreError;
    expect(error.code).toBe('secure-store-unavailable');
    expect(error.remediation.length).toBeGreaterThan(0);
    expect(error.message).not.toContain(TOKEN_A);

    const paths = getMainCredentialStorePaths();
    expect(fs.existsSync(paths.storePath)).toBe(false);
    expect(readAllText(ihuiDir)).not.toContain(TOKEN_A);

    // ② 读入口不把"解不开/不可用"折成"未登录":存储存在但档位不可用 ⇒ unavailable + 故障台账
    fs.writeFileSync(paths.storePath, '{"ihuiVaultV1":{"alg":"A256GCM","kid":"x","iv":"y","ct":"z"}}', 'utf-8');
    const read = readMainCredentials();
    expect(read.state).toBe('unavailable');
    expect(read.credentials).toEqual({});
    expect(getMainCredentialStoreFailure()?.code).toBe('secure-store-unavailable');
    expect(getMainCredentialStoreFailure()?.remediation.length).toBeGreaterThan(0);

    // ③ 需要凭据的操作抛错并带处置说明(不是静默当未登录)
    expect(() => assertMainCredentialStoreUsable()).toThrow(MainCredentialStoreError);

    // ④ 迁移失败⇒原文件保留(删掉明文却没写进安全存储等于丢凭据),但内存里绝不返回明文
    writeJson(settingsPath, { apiKey: TOKEN_A });
    const migrated = migratePlaintextCredentials([settingsPath]);
    expect(migrated.migrated).toBe(false);
    expect(migrated.failure?.code).toBe('secure-store-unavailable');
    const merged = mergeSettingsFromCwd(path.join(root, 'project'));
    expect(merged).not.toHaveProperty('apiKey');
    // 明文**文件**保留是刻意的:没写进安全存储就删,等于把用户凭据丢掉;程序不再读它,
    // 所有需要凭据的操作都会按上面的处置说明显式失败。
    expect(fs.readFileSync(settingsPath, 'utf-8')).toContain(TOKEN_A);
  });

  it('安全存储可用时:回填只发生在 global 层,env/CLI 仍可覆盖', () => {
    writeJson(settingsPath, { apiKey: TOKEN_A, theme: 'dark' });
    migratePlaintextCredentials([settingsPath]);

    const merged = mergeSettingsFromCwd(path.join(root, 'project'));
    expect(merged).toHaveProperty('apiKey', TOKEN_A);
    expect(merged).toHaveProperty('theme', 'dark');

    // 剥字段是精确的:只动三个凭据键
    const stripped = withoutMainCredentialFields({ apiKey: TOKEN_A, refreshToken: TOKEN_B, apiSecret: TOKEN_C, x: 1 });
    expect(stripped).toEqual({ x: 1 });

    // 存储里没有凭据时,回填不改变原对象形状
    clearMainCredentials();
    expect(applyStoredMainCredentials({ theme: 'dark' })).toEqual({ theme: 'dark' });
  });

  it('并发/多实例:两个进程各写自己的字段,最终互不覆盖', async () => {
    const paths = getMainCredentialStorePaths();
    const cliRoot = fileURLToPath(new URL('..', import.meta.url));
    const scriptPath = path.join(root, 'concurrent-writer.mts');
    const storeModule = path.join(cliRoot, 'src/lib/main-credential-store.ts');
    // Windows 盘符路径不是合法 ESM 说明符(G:/... 会被当成 g: 协议)⇒ 必须转成 file:// URL
    const storeModuleUrl = pathToFileURL(storeModule).href;
    fs.writeFileSync(
      scriptPath,
      [
        `import { writeMainCredentials } from ${JSON.stringify(storeModuleUrl)};`,
        'const field = process.argv[2];',
        'const value = process.argv[3];',
        // 两个子进程几乎同时起跑,逼出"读-改-写"重叠窗口
        'await new Promise((resolve) => setTimeout(resolve, 120));',
        'writeMainCredentials({ [field]: value });',
        'process.exit(0);',
      ].join('\n'),
      'utf-8',
    );

    const runChild = (field: string, value: string): Promise<void> =>
      new Promise((resolve, reject) => {
        execFile(
          process.execPath,
          ['--import', 'tsx', scriptPath, field, value],
          { cwd: cliRoot, env: { ...process.env }, timeout: 120_000 },
          (err, stdout, stderr) => {
            if (err) {
              reject(new Error(`子进程失败(${field}):${stderr || stdout || err.message}`));
              return;
            }
            resolve();
          },
        );
      });

    await Promise.all([runChild('apiKey', TOKEN_A), runChild('refreshToken', TOKEN_B)]);

    const stored = readMainCredentials();
    expect(stored.state).toBe('ok');
    // 后写者读到先写者的结果再合并:两个字段都在,不是"最后一份整文件覆盖"
    expect(stored.credentials.apiKey).toBe(TOKEN_A);
    expect(stored.credentials.refreshToken).toBe(TOKEN_B);
    // 锁必须释放(否则下一次写入会被 10s 超时挡住)
    expect(fs.existsSync(paths.lockPath)).toBe(false);
  }, 180_000);
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
