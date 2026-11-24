// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 凭据加密内核 —— CLI 侧所有"落盘密钥/凭据信封"的**唯一实现**。
 *
 * 来源:2026-09 的 MCP 凭据落盘改造(D146)已把三件事写在同一份 `tools/mcp-credentials.ts`:
 *   ① 信封结构(`ihuiVaultV1`:A256GCM + HKDF 域分离,结构级"恰一层"判据);
 *   ② OS 档(Windows DPAPI,CurrentUser;探针 = 真跑 protect/unprotect 往返);
 *   ③ 机器绑定口令文件(本机身份派生密钥包裹主密钥,`ihui*KeyV1` 信封)。
 *
 * 2026-11 主凭据(settings.json 的 apiKey/refreshToken/apiSecret)也要落到同一档安全存储。
 * 若在新模块里再抄一遍 AES/HKDF/DPAPI,仓里就会出现两套"看起来一样、改一处漏一处"的加密
 * (§0.6 单一真相源)。因此本文件把上述三件事原样抽到这里,`mcp-credentials.ts` 与
 * `main-credential-store.ts` 都只调用它 —— **不新增第二套加密**。
 *
 * 边界:
 * - 本文件不决定"存哪里/档位怎么选/失败怎么处置",只提供 primitive;
 * - 所有诊断文案不得包含密钥或凭据原文(调用方负责 redaction);
 * - 信封结构与桌面端 `apps/web/src/lib/local-vault.ts` 同形(跨包同族约束 §3)。
 */

import { execFile, execFileSync } from 'node:child_process';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import * as fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/** 信封顶层字段:与 local-vault.ts 同形,结构判据只认这唯一一层 */
export const VAULT_ENVELOPE_FIELD = 'ihuiVaultV1';
export const VAULT_ALG = 'A256GCM';
/** Object.keys().sort() 的比对基准 —— 必须是排好序的同一份名单 */
export const VAULT_ENVELOPE_KEYS_SORTED: readonly string[] = ['alg', 'ct', 'iv', 'kid'];
export const VAULT_KEY_BYTES = 32;
export const VAULT_IV_BYTES = 12;
export const VAULT_TAG_BYTES = 16;
export const VAULT_KID_BYTES = 8;
/** OS 档单次 PowerShell 调用的硬超时:取"引擎冷启动"最差档的数倍,挂住不等于可用 */
export const DPAPI_TIMEOUT_MS = 15_000;

export interface CredentialEnvelopeBody {
  alg: typeof VAULT_ALG;
  kid: string;
  iv: string;
  ct: string;
}

function isPlainObject(value: unknown): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array | null {
  try {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
    const buf = Buffer.from(padded, 'base64');
    if (buf.length === 0) return null;
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

function sortedKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).sort();
}

export function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const got = sortedKeys(value);
  if (got.length !== expected.length) return false;
  return got.every((k, i) => k === expected[i]);
}

/**
 * 结构级判据:对象**有且仅有** `field` 一个键,其值**有且仅有** alg/kid/iv/ct 四个字段,
 * 且 iv/ct 能解出 base64url 字节。"存在即算"不够 —— 迁移幂等要求能判"恰一层",
 * 否则会把已加密的 blob 再包一层(照 local-vault.ts 的同一条判据)。
 */
export function parseVaultEnvelope(
  stored: string,
  field: string = VAULT_ENVELOPE_FIELD,
): CredentialEnvelopeBody | null {
  let outer: unknown;
  try {
    outer = JSON.parse(stored);
  } catch {
    return null;
  }
  if (!isPlainObject(outer)) return null;
  const record = outer as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== field) return null;
  const inner = record[field];
  if (!isPlainObject(inner)) return null;
  const body = inner as Record<string, unknown>;
  if (!hasExactKeys(body, VAULT_ENVELOPE_KEYS_SORTED)) return null;
  if (body.alg !== VAULT_ALG) return null;
  if (typeof body.kid !== 'string' || body.kid.length === 0) return null;
  if (typeof body.iv !== 'string' || typeof body.ct !== 'string') return null;
  if (!fromBase64Url(body.iv) || !fromBase64Url(body.ct)) return null;
  return { alg: VAULT_ALG, kid: body.kid, iv: body.iv, ct: body.ct };
}

/** 主密钥的公开指纹:SHA-256(key) 前 8 字节 hex。用于判"密钥被换过",不是密钥。 */
export function kidOfKey(key: Uint8Array): string {
  return createHash('sha256').update(key).digest().subarray(0, VAULT_KID_BYTES).toString('hex');
}

/** HKDF 域分离:同一主密钥派生互不通用的子密钥(salt 与 info 同取域标签)。 */
export function deriveDomainKey(master: Uint8Array, info: string): Uint8Array {
  const label = Buffer.from(info, 'utf-8');
  return new Uint8Array(hkdfSync('sha256', master, label, label, VAULT_KEY_BYTES));
}

/** AES-256-GCM 密封:ct 尾部含 16 字节 tag —— 与 WebCrypto 的产出字节同形。 */
export function aesGcmSeal(key: Uint8Array, plain: string): { iv: string; ct: string } {
  const iv = new Uint8Array(randomBytes(VAULT_IV_BYTES));
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(plain, 'utf-8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: toBase64Url(iv), ct: toBase64Url(new Uint8Array(Buffer.concat([enc, tag]))) };
}

export function aesGcmOpen(key: Uint8Array, iv: string, ct: string): string | null {
  const ivBytes = fromBase64Url(iv);
  const ctBytes = fromBase64Url(ct);
  if (!ivBytes || !ctBytes || ctBytes.length <= VAULT_TAG_BYTES) return null;
  const tag = ctBytes.subarray(ctBytes.length - VAULT_TAG_BYTES);
  const body = ctBytes.subarray(0, ctBytes.length - VAULT_TAG_BYTES);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, ivBytes);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(body)), decipher.final()]).toString('utf-8');
  } catch {
    return null;
  }
}

/** 用指定域标签封存任意明文;`field` 只影响外壳键名(默认与桌面端同形)。 */
export function sealVaultEnvelope(
  plain: string,
  masterKey: Uint8Array,
  kid: string,
  domainInfo: string,
  field: string = VAULT_ENVELOPE_FIELD,
): string {
  const key = deriveDomainKey(masterKey, domainInfo);
  const { iv, ct } = aesGcmSeal(key, plain);
  return JSON.stringify({ [field]: { alg: VAULT_ALG, kid, iv, ct } });
}

/** 解封;`kid` 不匹配(密钥已换/异机封的)一律不解、不猜。 */
export function openVaultEnvelope(
  body: CredentialEnvelopeBody,
  masterKey: Uint8Array,
  domainInfo: string,
): string | null {
  if (kidOfKey(masterKey) !== body.kid) return null;
  const key = deriveDomainKey(masterKey, domainInfo);
  return aesGcmOpen(key, body.iv, body.ct);
}

// ==================== 机器绑定口令文件 ====================

export function machineMaterialLabel(): string {
  let user = '';
  try {
    user = os.userInfo().username;
  } catch {
    user = process.env.USERNAME || process.env.USER || '';
  }
  return `${os.hostname()}|${os.platform()}|${os.arch()}|${user}`;
}

/** 本机身份指纹(只出指纹,不出原料;它自身不是密钥) */
export function machineBindingFingerprint(): string {
  return createHash('sha256').update(machineMaterialLabel(), 'utf-8').digest().subarray(0, 8).toString('hex');
}

/** 机器绑定密钥信封的形状(与凭据信封同族,但字段是 mb/iv/ct) */
export interface KeyEnvelopeBody {
  mb: string;
  iv: string;
  ct: string;
}

export function parseKeyEnvelope(
  stored: string,
  field: string,
): KeyEnvelopeBody | null {
  let outer: unknown;
  try {
    outer = JSON.parse(stored);
  } catch {
    return null;
  }
  if (!isPlainObject(outer)) return null;
  const record = outer as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== field) return null;
  const inner = record[field];
  if (!isPlainObject(inner)) return null;
  const body = inner as Record<string, unknown>;
  if (!hasExactKeys(body, ['ct', 'iv', 'mb'])) return null;
  if (typeof body.mb !== 'string' || typeof body.iv !== 'string' || typeof body.ct !== 'string') return null;
  return { mb: body.mb, iv: body.iv, ct: body.ct };
}

export function sealKeyEnvelope(
  master: Uint8Array,
  field: string,
  keyWrapInfo: string,
): string {
  const { iv, ct } = aesGcmSeal(deriveDomainKey(new Uint8Array(Buffer.from(machineMaterialLabel(), 'utf-8')), keyWrapInfo), toBase64Url(master));
  return JSON.stringify({ [field]: { mb: machineBindingFingerprint(), iv, ct } });
}

export function openKeyEnvelope(env: KeyEnvelopeBody, keyWrapInfo: string): Uint8Array | null {
  if (env.mb !== machineBindingFingerprint()) return null; // 换了机器/换了账号:解不开,不猜、不覆盖
  const plain = aesGcmOpen(deriveDomainKey(new Uint8Array(Buffer.from(machineMaterialLabel(), 'utf-8')), keyWrapInfo), env.iv, env.ct);
  if (plain === null) return null;
  const key = fromBase64Url(plain);
  if (!key || key.length !== VAULT_KEY_BYTES) return null;
  return key;
}

// ==================== OS 档:Windows DPAPI ====================

/**
 * 档位①的可行性证据(2026-09-28 本机现读,取证经 `scripts/run-evidence.mjs` 落件):
 *   pwsh 7.6.4(`C:\Program Files\PowerShell\7\pwsh.exe`)
 *     → `PROBE A_ProtectedDataAssembly OK roundtrip=8bytes`
 *   powershell 5.1.26100(`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`)
 *     → `PROBE A_ProtectedDataAssembly FAIL 无法加载找到程序集…`(消息被 GBK 码页打乱,
 *        所以判据只认 ASCII 状态词,绝不解析本地化文案)
 * ⇒ 档位①**只**在能 `Add-Type -AssemblyName System.Security.Cryptography.ProtectedData`
 *   的引擎上启用;每次运行现探,不照抄本注释。
 */
export const OS_TIER_EVIDENCE = 'pwsh7=OK;windows-powershell5.1=FAIL(assembly-not-found;2026-09-28 实测)';

export const DPAPI_PS_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  '$mode=$args[0]',
  'try {',
  '  Add-Type -AssemblyName System.Security.Cryptography.ProtectedData -ErrorAction Stop',
  '  $in=[Console]::In.ReadToEnd().Trim()',
  '  $raw=[Convert]::FromBase64String($in)',
  "  if ($mode -eq 'protect') {",
  '    $out=[System.Security.Cryptography.ProtectedData]::Protect($raw,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)',
  '  } else {',
  '    $out=[System.Security.Cryptography.ProtectedData]::Unprotect($raw,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)',
  '  }',
  '  [Console]::Out.Write([Convert]::ToBase64String($out))',
  '  exit 0',
  '} catch {',
  '  exit 3',
  '}',
].join('\n');

export interface DpapiOutcome {
  ok: boolean;
  payload: string | null;
  engine: string;
  detail: string;
}

/** PowerShell 候选引擎(命中即缓存)。绝不写死盘符:ProgramFiles/SystemRoot 取自 env。 */
export function pwshCandidates(): string[] {
  const out = ['pwsh'];
  const programFiles = process.env.ProgramFiles || process.env['ProgramFiles(x86)'] || '';
  if (programFiles) out.push(path.posix.join(programFiles.replace(/\\/g, '/'), 'PowerShell/7/pwsh.exe'));
  const systemRoot = (process.env.SystemRoot || '').replace(/\\/g, '/');
  if (systemRoot) {
    out.push(path.posix.join(systemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'));
  }
  return out;
}

let cachedEngine: string | null = null;
/** 引擎都试过一遍的失败结论(进程内缓存,避免每次写盘都重跑一遍冷启动) */
let osTierFailure: string | null = null;

function dpapiArgs(mode: 'protect' | 'unprotect'): string[] {
  const encoded = Buffer.from(DPAPI_PS_SCRIPT, 'utf16le').toString('base64');
  return ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded, mode];
}

function dpapiFailureDetail(engine: string, err: unknown): string {
  const code = (err as { code?: number | string; status?: number | string }).code
    ?? (err as { status?: number | string }).status
    ?? 'n/a';
  // 只取退出码与 ASCII 片段:PowerShell 的异常文案是本机码页下的本地化文本(实测被 GBK 打乱)
  return `${engine} rc=${code} ${String((err as Error)?.message ?? err).replace(/[^\x20-\x7e]/g, '').slice(0, 80)}`;
}

/** 异步 DPAPI 调用(MCP 主链路使用)。 */
export function runDpapiAsync(mode: 'protect' | 'unprotect', bytes: Uint8Array): Promise<DpapiOutcome> {
  return new Promise((resolve) => {
    const payloadB64 = Buffer.from(bytes).toString('base64');
    const candidates = cachedEngine ? [cachedEngine, ...pwshCandidates().filter((e) => e !== cachedEngine)] : pwshCandidates();
    let index = 0;
    const failures: string[] = [];
    const tryNext = (): void => {
      if (index >= candidates.length) {
        resolve({ ok: false, payload: null, engine: '', detail: failures.join(' | ').slice(0, 240) });
        return;
      }
      const engine = candidates[index++];
      if (!engine) {
        tryNext();
        return;
      }
      if (engine === 'pwsh' && process.platform !== 'win32') {
        tryNext();
        return;
      }
      const child = execFile(
        engine,
        dpapiArgs(mode),
        { encoding: 'utf8', timeout: DPAPI_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
        (err, stdout) => {
          if (err) {
            failures.push(dpapiFailureDetail(engine, err));
            if (process.platform === 'win32') {
              resolve({ ok: false, payload: null, engine: '', detail: failures.join(' | ').slice(0, 240) });
              return;
            }
            tryNext();
            return;
          }
          const last = stdout.split(/\r?\n/).filter((l) => l.trim().length > 0).pop() ?? '';
          if (last.length > 0) {
            cachedEngine = engine;
            resolve({ ok: true, payload: last.trim(), engine, detail: `roundtrip chars=${last.length}` });
          } else {
            failures.push(`${engine} empty output`);
            if (process.platform === 'win32') {
              resolve({ ok: false, payload: null, engine: '', detail: failures.join(' | ').slice(0, 240) });
              return;
            }
            tryNext();
          }
        },
      );
      // 载荷走 stdin,不进 argv(进程列表里看得见命令行参数)
      if (child.stdin) {
        child.stdin.end(payloadB64);
      }
    };
    tryNext();
  });
}

/** 同步 DPAPI 调用(主凭据加载链路;settings 读取是同步契约,不能改成 async)。 */
export function runDpapiSync(mode: 'protect' | 'unprotect', bytes: Uint8Array): DpapiOutcome {
  const payloadB64 = Buffer.from(bytes).toString('base64');
  const candidates = cachedEngine ? [cachedEngine, ...pwshCandidates().filter((e) => e !== cachedEngine)] : pwshCandidates();
  const failures: string[] = [];
  for (const engine of candidates) {
    if (engine === 'pwsh' && process.platform !== 'win32') continue;
    try {
      const stdout = execFileSync(engine, dpapiArgs(mode), {
        input: payloadB64,
        encoding: 'utf8',
        timeout: DPAPI_TIMEOUT_MS,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
      });
      const last = stdout.split(/\r?\n/).filter((l) => l.trim().length > 0).pop() ?? '';
      if (last.length > 0) {
        cachedEngine = engine;
        return { ok: true, payload: last.trim(), engine, detail: `roundtrip chars=${last.length}` };
      }
      failures.push(`${engine} empty output`);
    } catch (err) {
      failures.push(dpapiFailureDetail(engine, err));
    }
    if (process.platform === 'win32') break; // Windows 上"pwsh 不在 PATH"是常态,继续往下探
  }
  return { ok: false, payload: null, engine: '', detail: failures.join(' | ').slice(0, 240) };
}

const PROBE_TEXT = 'ihui-credential-vault-os-tier-probe';

/** 探针 = 真跑一次 protect→unprotect 往返(不写盘),因此"探针通过"与"能力可用"是同一件事。 */
export async function probeDpapiAsync(): Promise<{ ok: boolean; engine: string; detail: string }> {
  if (process.platform !== 'win32') {
    return { ok: false, engine: '', detail: 'non-win32: OS tier 未取证,不启用' };
  }
  if (osTierFailure) return { ok: false, engine: '', detail: osTierFailure };
  const probe = await runDpapiAsync('protect', new Uint8Array(Buffer.from(PROBE_TEXT, 'utf-8')));
  if (!probe.ok || !probe.payload) {
    osTierFailure = probe.detail || 'all engines failed';
    return { ok: false, engine: '', detail: osTierFailure };
  }
  const back = await runDpapiAsync('unprotect', new Uint8Array(Buffer.from(probe.payload, 'base64')));
  const roundtrip =
    back.ok && back.payload && Buffer.from(back.payload, 'base64').toString('utf-8') === PROBE_TEXT;
  if (!roundtrip) {
    osTierFailure = `protect ok 但 unprotect 往返不一致(${back.detail})`;
    return { ok: false, engine: '', detail: osTierFailure };
  }
  return { ok: true, engine: probe.engine, detail: probe.detail };
}

/** 同步版探针(与异步版共用同一份脚本/候选序/失败缓存)。 */
export function probeDpapiSync(): { ok: boolean; engine: string; detail: string } {
  if (process.platform !== 'win32') {
    return { ok: false, engine: '', detail: 'non-win32: OS tier 未取证,不启用' };
  }
  if (osTierFailure) return { ok: false, engine: '', detail: osTierFailure };
  const probe = runDpapiSync('protect', new Uint8Array(Buffer.from(PROBE_TEXT, 'utf-8')));
  if (!probe.ok || !probe.payload) {
    osTierFailure = probe.detail || 'all engines failed';
    return { ok: false, engine: '', detail: osTierFailure };
  }
  const back = runDpapiSync('unprotect', new Uint8Array(Buffer.from(probe.payload, 'base64')));
  const roundtrip =
    back.ok && back.payload && Buffer.from(back.payload, 'base64').toString('utf-8') === PROBE_TEXT;
  if (!roundtrip) {
    osTierFailure = `protect ok 但 unprotect 往返不一致(${back.detail})`;
    return { ok: false, engine: '', detail: osTierFailure };
  }
  return { ok: true, engine: probe.engine, detail: probe.detail };
}

/** 0o600 = rw-------;Windows 上 chmod 只影响 owner 位。失败不改变"已加密"结论。 */
export async function chmodSafeAsync(p: string): Promise<void> {
  try {
    await fsp.chmod(p, 0o600);
  } catch {
    // 某些文件系统不支持 chmod:忽略(文件已写入),但**不**把它当成"加密已生效"
  }
}

export function chmodSafeSync(p: string): void {
  try {
    fs.chmodSync(p, 0o600);
  } catch {
    // 同上:chmod 失败不推翻内容已写入的事实
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
