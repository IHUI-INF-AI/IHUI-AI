// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B3-01 Chrome Native Messaging host 安装器。
 *
 * 做三件事：
 *   1. 校验扩展 ID（Chrome 扩展 ID 固定 32 位 a-p 小写）；
 *   2. 写 host manifest（`allowed_origins` 只放这一个扩展，不用通配）；
 *   3. 写 HKCU 注册表键，让 Chrome 找到 manifest。
 *
 * 默认 dry-run，只有 `--apply` 才落盘/写注册表；host 可执行文件必须是绝对路径且存在。
 * 用法：
 *   node scripts/install-extension-native-host.mjs --extension-id <32位> --host-exe <abs.exe> [--apply]
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export const NATIVE_HOST_NAME = 'ai.ihui.bridge';
export const EXTENSION_ID_RE = /^[a-p]{32}$/;

export function validateExtensionId(value) {
  return typeof value === 'string' && EXTENSION_ID_RE.test(value);
}

export function buildManifest(extensionId, hostExe) {
  if (!validateExtensionId(extensionId)) {
    throw new Error(`invalid extension id: ${extensionId}`);
  }
  if (typeof hostExe !== 'string' || !isAbsolute(hostExe) || !hostExe.toLowerCase().endsWith('.exe')) {
    throw new Error(`host exe must be an absolute .exe path: ${hostExe}`);
  }
  if (!existsSync(hostExe)) {
    throw new Error(`host exe does not exist: ${hostExe}`);
  }
  return {
    name: NATIVE_HOST_NAME,
    description: 'IHUI AI browser bridge',
    path: hostExe,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${extensionId}/`],
  };
}

export function registryArgs(manifestPath) {
  if (typeof manifestPath !== 'string' || !isAbsolute(manifestPath)) {
    throw new Error(`manifest path must be absolute: ${manifestPath}`);
  }
  return [
    'add',
    `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`,
    '/ve',
    '/t',
    'REG_SZ',
    '/d',
    manifestPath,
    '/f',
  ];
}

function parseArgs(argv) {
  const out = { apply: false, extensionId: '', hostExe: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') out.apply = true;
    else if (arg === '--extension-id') out.extensionId = argv[++i] ?? '';
    else if (arg === '--host-exe') out.hostExe = argv[++i] ?? '';
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = buildManifest(args.extensionId, args.hostExe);
  const manifestPath = join(process.cwd(), 'apps', 'extension', 'native-host', `${NATIVE_HOST_NAME}.json`);
  const regArgs = registryArgs(manifestPath);

  if (!args.apply) {
    console.log(JSON.stringify({ dryRun: true, manifestPath, manifest, registry: regArgs }, null, 2));
    return;
  }

  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  const reg = spawnSync('reg.exe', regArgs, { windowsHide: true, encoding: 'utf-8' });
  if (reg.status !== 0) {
    throw new Error(`reg add failed (${reg.status}): ${reg.stderr || reg.stdout}`);
  }
  console.log(JSON.stringify({ applied: true, manifestPath, registry: regArgs }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
