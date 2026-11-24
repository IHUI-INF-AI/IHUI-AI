// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 技能包/专家包测试夹具。
 *
 * 复用生产写入端(writeTar/canonicalJson/signChecksums)构造合法包,这样反向例只需
 * 精确注入"一处违规",而不是手搓整份归档 —— 篡改面越小,错误码归因越确定。
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { generateKeyPairSync, type KeyObject } from 'node:crypto';

import {
  buildChecksums,
  canonicalJson,
  CHECKSUMS_FILE,
  MANIFEST_FILE,
  SIGNATURE_FILE,
  signChecksums,
  writeTar,
  type SignatureDocument,
  type TarEntry,
} from '../src/skills/packaging/index.js';

export interface Publisher {
  keyId: string;
  privateKey: KeyObject;
  publicKeyB64: string;
  trustStorePath: string;
}

export const tempRoots: string[] = [];

export function makeTempDir(prefix = 'ihui-skill-pkg-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
}

export function cleanupTempRoots(): void {
  for (const dir of tempRoots.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // 临时目录清理失败不影响断言结论
    }
  }
}

export function createPublisher(dir: string, keyId = 'publisher-a'): Publisher {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const publicKeyB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  fs.mkdirSync(dir, { recursive: true });
  const trustStorePath = path.join(dir, `trusted-${keyId}.json`);
  fs.writeFileSync(
    trustStorePath,
    `${JSON.stringify({ keys: [{ id: keyId, algorithm: 'ed25519', publicKey: publicKeyB64 }] }, null, 2)}\n`,
    'utf8',
  );
  return { keyId, privateKey, publicKeyB64, trustStorePath };
}

export function baseManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'demo-skill',
    name: 'Demo Skill',
    version: '1.0.0',
    kind: 'skill',
    description: 'fixture package',
    entryCapabilities: [],
    activationEvents: ['onSkillInvoke'],
    permissions: [],
    contributes: {},
    ...overrides,
  };
}

export interface BuildPackageOptions {
  manifest: Record<string, unknown>;
  payload?: Record<string, string | Buffer>;
  publisher: Publisher;
  /** 换一把私钥签名(用于"不在 trustedKeys 的签名者"反向例) */
  signWith?: Publisher;
  /** 不写 signature.json */
  omitSignature?: boolean;
  /** 从归档里整体移除某路径(用于"清单缺项"前的 structure 删档) */
  omitEntries?: string[];
  /** 校验和构建完成后再替换/追加文件字节(用于"篡改 1 文件"反向例) */
  replaceAfterChecksums?: Record<string, Buffer | string>;
  /** 直接改写 checksums 的 files 映射(用于缺项/多项反向例) */
  mutateChecksums?: (files: Record<string, string>) => Record<string, string>;
  /** 直接用这段字节作为 checksums.json(签名仍对这段字节计算) */
  checksumsOverride?: Buffer;
  /** 直接改写签名文档(用于坏签名反向例) */
  signatureOverride?: SignatureDocument | Buffer;
  /** 文件模式覆盖(用于可执行位反向例) */
  modeOverrides?: Record<string, number>;
  /** 额外 tar 条目(用于符号链接/重复路径反向例) */
  extraEntries?: TarEntry[];
}

export function buildPackage(options: BuildPackageOptions): Buffer {
  const files = new Map<string, Buffer>();
  if (!options.omitEntries?.includes(MANIFEST_FILE)) {
    files.set(MANIFEST_FILE, canonicalJson(options.manifest));
  }
  for (const [name, content] of Object.entries(options.payload ?? { 'SKILL.md': '# Demo Skill\n' })) {
    files.set(name, Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'));
  }

  let checksumsBytes: Buffer;
  if (options.checksumsOverride) {
    checksumsBytes = options.checksumsOverride;
  } else {
    const base = JSON.parse(buildChecksums(files).toString('utf8')) as {
      algorithm: 'sha256';
      files: Record<string, string>;
    };
    if (options.mutateChecksums) base.files = options.mutateChecksums({ ...base.files });
    checksumsBytes = canonicalJson(base);
  }

  const entries: TarEntry[] = [];
  for (const [name, content] of files) {
    entries.push({ path: name, content, mode: options.modeOverrides?.[name] ?? 0o644 });
  }
  for (const [name, content] of Object.entries(options.replaceAfterChecksums ?? {})) {
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const existing = entries.find((entry) => entry.path === name);
    if (existing) existing.content = bytes;
    else entries.push({ path: name, content: bytes });
  }

  if (!options.omitEntries?.includes(CHECKSUMS_FILE)) {
    entries.push({ path: CHECKSUMS_FILE, content: checksumsBytes });
  }
  if (!options.omitSignature) {
    let signatureBytes: Buffer;
    if (Buffer.isBuffer(options.signatureOverride)) {
      signatureBytes = options.signatureOverride;
    } else if (options.signatureOverride) {
      signatureBytes = canonicalJson(options.signatureOverride);
    } else {
      const signer = options.signWith ?? options.publisher;
      signatureBytes = canonicalJson(signChecksums(checksumsBytes, signer.privateKey, signer.keyId));
    }
    if (!options.omitEntries?.includes(SIGNATURE_FILE)) {
      entries.push({ path: SIGNATURE_FILE, content: signatureBytes });
    }
  }
  entries.push(...(options.extraEntries ?? []));
  return writeTar(entries);
}

export function packagePath(dir: string, name = 'skill.tar'): string {
  return path.join(dir, name);
}

export function writePackage(dir: string, bytes: Buffer, name = 'skill.tar'): string {
  const file = packagePath(dir, name);
  fs.writeFileSync(file, bytes, { mode: 0o644 });
  return file;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
