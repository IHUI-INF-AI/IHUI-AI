#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 判据自检器,机器读数必须走 stdout */
/**
 * desktop-signing-preflight — 签名凭据前置自检(2026-11-04 立)
 *
 * 为什么要有这一步:
 *   凭据缺失时,`release-desktop.yml` 的签名步靠 job 级 env 折算出的
 *   `SIGNPATH_CONFIGURED` / `APPLE_SIGNING_CONFIGURED` 整体跳过 —— 因为 step 级 `if`
 *   读不到 `secrets` 上下文。后果是:先编译 30-45 分钟,最后才由 `signature-gate` 判红,
 *   日志里也看不出"到底缺哪一枚"。本步在**打包之前**一次性点名缺项并立即失败。
 *
 * 纪律:只判"在不在"(trim 后长度 > 0),**绝不打印任何值**、
 *   连长度/前缀/哈希都不打印 —— 凭据一旦落进日志即等同泄漏。
 *
 * 平台口径(Linux 不参与代码签名强制门,但 updater `.sig` 仍要私钥):
 *   windows: SignPath 四件套 + Tauri 更新签名私钥两枚
 *   macos:   Apple 证书三件 + 公证通道二选一(Apple ID 三件 / API Key 三件) + Tauri 两枚
 *   linux:   仅 Tauri 两枚
 *
 * 2026-11-05 扩 `--scope cli`:`release-cli.yml` 的 Windows 二进制同样要 Authenticode 签名,
 *   但 CLI 不发 updater `.sig`、也不需要 Apple 凭据,故 cli 口径 = Windows 只要求 SignPath 四件,
 *   linux/macos 零要求。默认 scope=desktop,保持既有调用逐字同义。
 *
 * 退出码: 0 就绪 / 1 有缺项(逐条点名) / 2 用法错误(写 stderr)
 * 用法: node scripts/desktop-signing-preflight.mjs --platform windows|macos|linux [--scope desktop|cli]
 *       node scripts/desktop-signing-preflight.mjs --self-test
 */
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const TAURI = ['DESKTOP_TAURI_PRIVATE_KEY', 'DESKTOP_TAURI_KEY_PASSWORD'];
const SIGNPATH = [
  'SIGNPATH_API_TOKEN',
  'SIGNPATH_ORGANIZATION_ID',
  'SIGNPATH_PROJECT_SLUG',
  'SIGNPATH_SIGNING_POLICY_SLUG',
];
const APPLE_CORE = ['APPLE_CERTIFICATE', 'APPLE_CERTIFICATE_PASSWORD', 'APPLE_SIGNING_IDENTITY'];
const APPLE_ID_CHANNEL = ['APPLE_ID', 'APPLE_PASSWORD', 'APPLE_TEAM_ID'];
const APPLE_KEY_CHANNEL = ['APPLE_API_KEY', 'APPLE_API_ISSUER', 'APPLE_API_KEY_P8'];

const HINTS = {
  SIGNPATH_API_TOKEN: 'SignPath 用户设置里的 submitter token(只显示一次)',
  SIGNPATH_ORGANIZATION_ID: 'SignPath Organization settings 页的 UUID',
  SIGNPATH_PROJECT_SLUG: 'SignPath Project 的 slug(与后台逐字一致)',
  SIGNPATH_SIGNING_POLICY_SLUG: 'SignPath Signing Policy 的 slug(Restricted)',
  DESKTOP_TAURI_PRIVATE_KEY: 'Tauri updater 私钥(已存在的 DESKTOP_TAURI_PRIVATE_KEY)',
  DESKTOP_TAURI_KEY_PASSWORD: 'Tauri 私钥口令(已存在的 DESKTOP_TAURI_KEY_PASSWORD)',
  APPLE_CERTIFICATE: 'Developer ID Application 证书 .p12 的单行 base64',
  APPLE_CERTIFICATE_PASSWORD: '导出 .p12 时设的密码',
  APPLE_SIGNING_IDENTITY: 'security find-identity 里的整串 "Developer ID Application: ..."',
  APPLE_ID: 'Apple ID 邮箱(公证通道 A)',
  APPLE_PASSWORD: 'App 专用密码 xxxx-xxxx-xxxx-xxxx(公证通道 A)',
  APPLE_TEAM_ID: 'Apple Developer 团队 ID(公证通道 A)',
  APPLE_API_KEY: 'App Store Connect API Key 的 Key ID(公证通道 B)',
  APPLE_API_ISSUER: 'App Store Connect Issuer UUID(公证通道 B)',
  APPLE_API_KEY_P8: 'App Store Connect API Key 的 .p8 内容(单行 base64 或原始 PEM;公证通道 B)',
  APPLE_API_KEY_PATH:
    '可选:.p8 落盘路径覆盖(不填则 workflow 写到 $RUNNER_TEMP/ihui-asc-api-key.p8,不再是必填 secret)',
};

export const PLATFORMS = ['windows', 'macos', 'linux'];
export const SCOPES = ['desktop', 'cli'];

function has(env, name) {
  const v = env[name];
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * 纯函数:给定平台、环境变量与 scope,返回 {ready, scope, missing:[{name,hint}], count, total}
 * missing 里同一枚 secret 只出现一次,顺序固定(便于与日志对照)。
 * scope=cli 时只要求 Windows 的 SignPath 四件(CLI 不发 updater `.sig`、不涉 Apple 凭据)。
 */
export function inspectCredentials(platform, env, scope = 'desktop') {
  if (!PLATFORMS.includes(platform)) throw new Error(`未知平台: ${platform}`);
  if (!SCOPES.includes(scope)) throw new Error(`未知 scope: ${scope}`);
  const required = [];
  if (scope === 'cli') {
    // CLI 的 Windows 二进制走 SignPath Authenticode;linux/macos 产物本链不签名
    if (platform === 'windows') required.push(...SIGNPATH);
  } else if (platform === 'windows') required.push(...SIGNPATH, ...TAURI);
  else if (platform === 'linux') required.push(...TAURI);
  else {
    required.push(...APPLE_CORE);
    const idOk = APPLE_ID_CHANNEL.every((n) => has(env, n));
    const keyOk = APPLE_KEY_CHANNEL.every((n) => has(env, n));
    if (idOk) required.push(...APPLE_ID_CHANNEL);
    else if (keyOk) required.push(...APPLE_KEY_CHANNEL);
    // 两个通道都不完整时,把两组都列为"二选一待填",让日志一次看全
    else required.push(...APPLE_ID_CHANNEL, ...APPLE_KEY_CHANNEL);
    required.push(...TAURI);
  }

  const unique = [...new Set(required)];
  const missing = unique
    .filter((n) => !has(env, n))
    .map((n) => ({ name: n, hint: HINTS[n] || '' }));
  return { platform, scope, count: unique.length - missing.length, total: unique.length, missing };
}

function printReport(result) {
  const { platform, scope, count, total, missing } = result;
  if (total === 0) {
    console.log(`无需签名凭据(scope=${scope},平台=${platform})`);
    return 0;
  }
  if (missing.length === 0) {
    console.log(`签名凭据已就绪 ${count}/${total}(scope=${scope},平台=${platform})`);
    return 0;
  }
  const names = missing.map((m) => m.name).join(', ');
  console.error(`::error::签名凭据缺口(scope=${scope},平台=${platform},缺 ${missing.length}/${total}): ${names}`);
  for (const m of missing) console.error(`  - 缺少 secret: ${m.name} —— ${m.hint}`);
  if (scope === 'desktop' && platform === 'macos' && missing.some((m) => APPLE_ID_CHANNEL.includes(m.name) || APPLE_KEY_CHANNEL.includes(m.name))) {
    console.error('  说明:公证通道 A(APPLE_ID/PASSWORD/TEAM_ID)与通道 B(API_KEY/ISSUER/API_KEY_P8)二选一,必须整组给齐');
  }
  console.error('  取值入口与申请步骤: docs/DESKTOP_CODE_SIGNING.md');
  return 1;
}

// ── self-test:只跑纯函数,不接触真实环境 ────────────────────────────────────────
function selfTest() {
  const cases = [];
  const empty = {};
  cases.push([inspectCredentials('windows', empty).missing.length === 6, 'windows 全空 → 缺 6 项(SignPath 4 + Tauri 2)']);
  const winOk = { SIGNPATH_API_TOKEN: 'x', SIGNPATH_ORGANIZATION_ID: 'x', SIGNPATH_PROJECT_SLUG: 'x', SIGNPATH_SIGNING_POLICY_SLUG: 'x', DESKTOP_TAURI_PRIVATE_KEY: 'x', DESKTOP_TAURI_KEY_PASSWORD: 'x' };
  cases.push([inspectCredentials('windows', winOk).missing.length === 0, 'windows 齐 → 0 缺项']);
  cases.push([inspectCredentials('linux', empty).missing.length === 2, 'linux 只要求 Tauri 两枚']);
  const macCoreOnly = { APPLE_CERTIFICATE: 'x', APPLE_CERTIFICATE_PASSWORD: 'x', APPLE_SIGNING_IDENTITY: 'x', DESKTOP_TAURI_PRIVATE_KEY: 'x', DESKTOP_TAURI_KEY_PASSWORD: 'x' };
  cases.push([inspectCredentials('macos', macCoreOnly).missing.length === 6, 'macOS 只给证书 → 两组公证通道全缺(3+3)']);
  const macA = { ...macCoreOnly, APPLE_ID: 'x', APPLE_PASSWORD: 'x', APPLE_TEAM_ID: 'x' };
  cases.push([inspectCredentials('macos', macA).missing.length === 0, 'macOS 渠道 A 齐 → 0 缺项']);
  const macHalfA = { ...macCoreOnly, APPLE_ID: 'x' };
  cases.push([inspectCredentials('macos', macHalfA).missing.length === 5, 'macOS 半个通道 A → 不会被当成就绪']);
  const half = { ...winOk, SIGNPATH_PROJECT_SLUG: '   ' };
  cases.push([inspectCredentials('windows', half).missing.length === 1, '空白串不算就绪(仍是 1 项缺)']);
  // 通道 B 三件 = Key ID / Issuer / .p8 内容;缺 .p8 内容即不完整(2026-11-05 补落盘步后新增)
  const macBNoP8 = { ...macCoreOnly, APPLE_API_KEY: 'x', APPLE_API_ISSUER: 'x' };
  cases.push([
    inspectCredentials('macos', macBNoP8).missing.some((m) => m.name === 'APPLE_API_KEY_P8'),
    '通道 B 缺 APPLE_API_KEY_P8 → 不完整(必须点名 .p8 内容)',
  ]);
  const macB = { ...macBNoP8, APPLE_API_KEY_P8: 'x' };
  cases.push([inspectCredentials('macos', macB).missing.length === 0, 'macOS 通道 B 齐 → 0 缺项']);
  // CLI 口径:Windows 只要求 SignPath 四件;linux/macos 零要求
  cases.push([inspectCredentials('windows', empty, 'cli').missing.length === 4, 'cli/windows 全空 → 缺 4 项(SignPath)']);
  const cliWinOk = { SIGNPATH_API_TOKEN: 'x', SIGNPATH_ORGANIZATION_ID: 'x', SIGNPATH_PROJECT_SLUG: 'x', SIGNPATH_SIGNING_POLICY_SLUG: 'x' };
  cases.push([inspectCredentials('windows', cliWinOk, 'cli').missing.length === 0, 'cli/windows 齐 → 0 缺项']);
  cases.push([inspectCredentials('linux', empty, 'cli').total === 0, 'cli/linux 零要求(total=0)']);
  cases.push([inspectCredentials('macos', empty, 'cli').total === 0, 'cli/macos 零要求(total=0)']);
  return cases;
}

function main(argv) {
  if (argv.includes('--self-test')) {
    const cases = selfTest();
    let failed = 0;
    for (const [ok, label] of cases) {
      console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
      if (!ok) failed++;
    }
    if (failed) {
      console.error(`self-test 失败 ${failed}/${cases.length}`);
      return 1;
    }
    console.log(`self-test 通过 ${cases.length}/${cases.length}`);
    return 0;
  }
  const plIdx = argv.indexOf('--platform');
  // runner.os 给的是 Windows/macOS/Linux,统一小写后比对
  const platform = plIdx >= 0 ? String(argv[plIdx + 1] || '').toLowerCase() : '';
  const scIdx = argv.indexOf('--scope');
  const scope = scIdx >= 0 ? String(argv[scIdx + 1] || '').toLowerCase() : 'desktop';
  if (!PLATFORMS.includes(platform) || !SCOPES.includes(scope)) {
    console.error('用法: node scripts/desktop-signing-preflight.mjs --platform windows|macos|linux [--scope desktop|cli]');
    return 2;
  }
  return printReport(inspectCredentials(platform, process.env, scope));
}

if (pathToFileURL(path.resolve(process.argv[1] || '')).href === import.meta.url) {
  process.exitCode = main(process.argv.slice(2));
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
