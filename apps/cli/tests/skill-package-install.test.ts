// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 技能安装安全链验收(反向例逐条给实际错误码)。
 * 覆盖: 4 阶段校验的每个错误码 + 原子落位 + 卸载清零 + 安装期零执行 + gate 对接。
 */

import { afterAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createExtensionManifestGate,
  installSkillPackage,
  isSkillPackageError,
  type SkillPackageError,
  uninstallSkillPackage,
  verifySkillPackageBuffer,
} from '../src/skills/packaging/index.js';
import {
  baseManifest,
  buildPackage,
  cleanupTempRoots,
  createPublisher,
  makeTempDir,
  writePackage,
  type Publisher,
} from './skill-package-fixtures.js';

function capture(fn: () => unknown): SkillPackageError {
  try {
    fn();
  } catch (error) {
    if (!isSkillPackageError(error)) throw error;
    return error;
  }
  throw new Error('expected SkillPackageError but call succeeded');
}

function verifyBytes(bytes: Buffer, publisher: Publisher) {
  return verifySkillPackageBuffer(bytes, { trustedKeysPath: publisher.trustStorePath });
}

describe('skill package install security chain', () => {
  afterAll(() => cleanupTempRoots());

  it('installs a valid signed package as regular 0644 files', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const root = path.join(dir, 'installed');
    const pkg = writePackage(
      dir,
      buildPackage({ manifest: baseManifest(), publisher, payload: { 'SKILL.md': '# Demo\n' } }),
    );

    const result = installSkillPackage(pkg, {
      trustedKeysPath: publisher.trustStorePath,
      installRoot: root,
    });

    expect(result.id).toBe('demo-skill');
    expect(result.version).toBe('1.0.0');
    expect(result.files).toEqual(['SKILL.md', 'manifest.json']);
    expect(fs.existsSync(path.join(result.installedPath, 'SKILL.md'))).toBe(true);
    expect(fs.readFileSync(path.join(result.installedPath, 'SKILL.md'), 'utf8')).toBe('# Demo\n');
    expect(fs.statSync(path.join(result.installedPath, 'SKILL.md')).mode & 0o111).toBe(0);
  });

  it('rejects one tampered file byte and names the file', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const verdict = verifyBytes(
      buildPackage({
        manifest: baseManifest(),
        publisher,
        replaceAfterChecksums: { 'SKILL.md': '# Tampered\n' },
      }),
      publisher,
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_CHECKSUM_MISMATCH');
    expect(verdict.error?.detail.file).toBe('SKILL.md');
  });

  it('rejects a checksums entry missing for an existing file', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const verdict = verifyBytes(
      buildPackage({
        manifest: baseManifest(),
        publisher,
        mutateChecksums: (files) => {
          delete files['SKILL.md'];
          return files;
        },
      }),
      publisher,
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_CHECKSUM_MISSING_ENTRY');
    expect(verdict.error?.detail.file).toBe('SKILL.md');
  });

  it('rejects a checksums entry naming a file not present', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const verdict = verifyBytes(
      buildPackage({
        manifest: baseManifest(),
        publisher,
        mutateChecksums: (files) => ({ ...files, 'ghost.txt': 'a'.repeat(64) }),
      }),
      publisher,
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_CHECKSUM_EXTRA_ENTRY');
    expect(verdict.error?.detail.file).toBe('ghost.txt');
  });

  it('rejects ../evil.txt as path traversal', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const verdict = verifyBytes(
      buildPackage({ manifest: baseManifest(), publisher, payload: { '../evil.txt': 'pwn' } }),
      publisher,
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_PATH_TRAVERSAL');
    expect(verdict.error?.detail.path).toBe('../evil.txt');
  });

  it('rejects C:\\evil.txt as an absolute path', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const verdict = verifyBytes(
      buildPackage({ manifest: baseManifest(), publisher, payload: { 'C:\\evil.txt': 'pwn' } }),
      publisher,
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_PATH_ABSOLUTE');
    expect(verdict.error?.detail.path).toBe('C:\\evil.txt');
  });

  it('rejects a symlink entry', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const verdict = verifyBytes(
      buildPackage({
        manifest: baseManifest(),
        publisher,
        extraEntries: [{ path: 'link', content: Buffer.alloc(0), type: 'symlink', linkname: '/etc/passwd' }],
      }),
      publisher,
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_PATH_LINK');
    expect(verdict.error?.detail.path).toBe('link');
  });

  it('rejects a regular file with executable bits', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const verdict = verifyBytes(
      buildPackage({ manifest: baseManifest(), publisher, modeOverrides: { 'SKILL.md': 0o755 } }),
      publisher,
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_PATH_EXECUTABLE');
    expect(verdict.error?.detail.path).toBe('SKILL.md');
  });

  it('rejects duplicate archive paths', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const verdict = verifyBytes(
      buildPackage({
        manifest: baseManifest(),
        publisher,
        extraEntries: [{ path: 'SKILL.md', content: Buffer.from('# Duplicate\n'), mode: 0o644 }],
      }),
      publisher,
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_PATH_DUPLICATE');
    expect(verdict.error?.detail.path).toBe('SKILL.md');
  });

  it('rejects a package with no signature (no fail-open)', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const verdict = verifyBytes(buildPackage({ manifest: baseManifest(), publisher, omitSignature: true }), publisher);

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_SIGNATURE_MISSING');
  });

  it('rejects a signature whose keyId is not in trustedKeys', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const other = createPublisher(path.join(dir, 'other'), 'publisher-b');
    const verdict = verifyBytes(buildPackage({ manifest: baseManifest(), publisher, signWith: other }), publisher);

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_SIGNATURE_KEY_UNTRUSTED');
    expect(verdict.error?.detail.keyId).toBe('publisher-b');
  });

  it('rejects a corrupted signature value', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const verdict = verifyBytes(
      buildPackage({
        manifest: baseManifest(),
        publisher,
        signatureOverride: {
          algorithm: 'ed25519',
          keyId: publisher.keyId,
          payload: 'checksums.json',
          signature: Buffer.from('not-a-valid-signature').toString('base64'),
        },
      }),
      publisher,
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_SIGNATURE_INVALID');
  });

  it('rejects when the trust store is absent (fail-closed)', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const bytes = buildPackage({ manifest: baseManifest(), publisher });
    const verdict = verifySkillPackageBuffer(bytes, {
      trustedKeysPath: path.join(dir, 'missing-trusted-keys.json'),
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_TRUST_STORE_MISSING');
  });

  it('rejects a corrupted trust store', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const broken = path.join(dir, 'broken-trusted-keys.json');
    fs.writeFileSync(broken, '{ not json', 'utf8');

    const verdict = verifySkillPackageBuffer(buildPackage({ manifest: baseManifest(), publisher }), {
      trustedKeysPath: broken,
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_TRUST_STORE_INVALID');
  });

  it('rejects malformed checksums JSON', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const verdict = verifyBytes(
      buildPackage({ manifest: baseManifest(), publisher, checksumsOverride: Buffer.from('{ not json') }),
      publisher,
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_CHECKSUMS_INVALID');
  });

  it('rejects an invalid manifest', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const verdict = verifyBytes(buildPackage({ manifest: baseManifest({ name: '' }), publisher }), publisher);

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_MANIFEST_INVALID');
    expect((verdict.error?.detail.issues as Array<{ path: string }>)[0]?.path).toBe('name');
  });

  it('rejects a manifest declaring executable keys', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const verdict = verifyBytes(
      buildPackage({ manifest: baseManifest({ scripts: { postinstall: 'node postinstall.js' } }), publisher }),
      publisher,
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_MANIFEST_INVALID');
    expect(JSON.stringify(verdict.error?.detail.issues)).toContain('scripts');
  });

  it('rejects a package without manifest.json', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const verdict = verifyBytes(
      buildPackage({ manifest: baseManifest(), publisher, omitEntries: ['manifest.json'] }),
      publisher,
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_MANIFEST_MISSING');
  });

  it('rejects a package without checksums.json', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const verdict = verifyBytes(
      buildPackage({ manifest: baseManifest(), publisher, omitEntries: ['checksums.json'] }),
      publisher,
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_CHECKSUMS_MISSING');
  });

  it('rejects a non-tar archive', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const verdict = verifyBytes(Buffer.from('not a tar archive'), publisher);

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_ARCHIVE_INVALID');
  });

  it('fails atomically and leaves no staging directory', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const pkg = writePackage(dir, buildPackage({ manifest: baseManifest(), publisher }));
    const installRootAsFile = path.join(dir, 'not-a-directory');
    fs.writeFileSync(installRootAsFile, 'occupied', 'utf8');

    const error = capture(() =>
      installSkillPackage(pkg, { trustedKeysPath: publisher.trustStorePath, installRoot: installRootAsFile }),
    );

    expect(error.code).toBe('SKILL_PKG_INSTALL_COMMIT_FAILED');
    expect(error.detail.stagingRemoved).toBe(true);
    expect(fs.readFileSync(installRootAsFile, 'utf8')).toBe('occupied');
    expect(fs.readdirSync(dir).some((entry) => entry.includes('.staging-'))).toBe(false);
  });

  it('replaces an existing version and removes superseded files', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const root = path.join(dir, 'installed');
    const v1 = writePackage(
      dir,
      buildPackage({
        manifest: baseManifest({ version: '1.0.0' }),
        publisher,
        payload: { 'SKILL.md': 'v1', 'OLD.md': 'legacy' },
      }),
      'v1.tar',
    );
    const v2 = writePackage(
      dir,
      buildPackage({ manifest: baseManifest({ version: '2.0.0' }), publisher, payload: { 'SKILL.md': 'v2' } }),
      'v2.tar',
    );

    installSkillPackage(v1, { trustedKeysPath: publisher.trustStorePath, installRoot: root });
    const second = installSkillPackage(v2, { trustedKeysPath: publisher.trustStorePath, installRoot: root });

    expect(second.replacedExisting).toBe(true);
    expect(second.version).toBe('2.0.0');
    expect(fs.readFileSync(path.join(root, 'demo-skill', 'SKILL.md'), 'utf8')).toBe('v2');
    expect(fs.existsSync(path.join(root, 'demo-skill', 'OLD.md'))).toBe(false);
  });

  it('uninstalls file-by-file and reports zero residue', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const root = path.join(dir, 'installed');
    const pkg = writePackage(dir, buildPackage({ manifest: baseManifest(), publisher }));
    installSkillPackage(pkg, { trustedKeysPath: publisher.trustStorePath, installRoot: root });

    const removed = uninstallSkillPackage('demo-skill', { installRoot: root });

    expect(removed.removed).toBe(true);
    expect(removed.removedFiles.sort()).toEqual(['SKILL.md', 'manifest.json']);
    expect(removed.residual).toEqual([]);
    expect(fs.existsSync(path.join(root, 'demo-skill'))).toBe(false);
    expect(uninstallSkillPackage('demo-skill', { installRoot: root }).removed).toBe(false);
  });

  it('reports uninstall residue when the install path is not a directory', () => {
    const dir = makeTempDir();
    const root = path.join(dir, 'installed');
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, 'demo-skill'), 'not a directory', 'utf8');

    const error = capture(() => uninstallSkillPackage('demo-skill', { installRoot: root }));

    expect(error.code).toBe('SKILL_PKG_UNINSTALL_RESIDUE');
    expect(fs.existsSync(path.join(root, 'demo-skill'))).toBe(true);
  });

  it('never executes postinstall-style content from the package', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const root = path.join(dir, 'installed');
    const marker = path.join(dir, 'EXECUTED');
    const previous = process.env.IHUI_SKILL_INSTALL_PROBE;
    process.env.IHUI_SKILL_INSTALL_PROBE = marker;
    try {
      const pkg = writePackage(
        dir,
        buildPackage({
          manifest: baseManifest(),
          publisher,
          payload: {
            'SKILL.md': '# Demo\n',
            'package.json': JSON.stringify({ scripts: { postinstall: 'node postinstall.js' } }),
            'postinstall.js': "require('node:fs').writeFileSync(process.env.IHUI_SKILL_INSTALL_PROBE, 'executed')\n",
          },
        }),
      );
      installSkillPackage(pkg, { trustedKeysPath: publisher.trustStorePath, installRoot: root });

      expect(fs.existsSync(marker)).toBe(false);
      expect(fs.existsSync(path.join(root, 'demo-skill', 'postinstall.js'))).toBe(true);
      expect(fs.statSync(path.join(root, 'demo-skill', 'postinstall.js')).mode & 0o111).toBe(0);
    } finally {
      if (previous === undefined) delete process.env.IHUI_SKILL_INSTALL_PROBE;
      else process.env.IHUI_SKILL_INSTALL_PROBE = previous;
    }
  });

  it('has static evidence that the install chain cannot spawn/exec/eval', () => {
    const packagingDir = fileURLToPath(new URL('../src/skills/packaging/', import.meta.url));
    const commandFile = fileURLToPath(new URL('../src/commands/skill-package.ts', import.meta.url));
    const stripComments = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const sources = [
      ...fs
        .readdirSync(packagingDir)
        .filter((name) => name.endsWith('.ts'))
        .map((name) => stripComments(fs.readFileSync(path.join(packagingDir, name), 'utf8'))),
      stripComments(fs.readFileSync(commandFile, 'utf8')),
    ].join('\n');

    for (const pattern of [/\bnode:child_process\b/, /\bexecSync\b/, /\bspawnSync\b/, /\bexecFile\b/, /\bnew Function\b/, /\beval\s*\(/]) {
      expect(pattern.test(sources), `install chain must not contain ${String(pattern)}`).toBe(false);
    }
  });

  it('delegates manifest semantics to the parallel-session validator (coupling point)', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const seen: Array<Record<string, unknown>> = [];
    const gate = createExtensionManifestGate((raw) => {
      seen.push(raw as Record<string, unknown>);
      return { ok: false, errors: [{ path: 'permissions[0]', code: 'unknown_scope', message: 'scope not registered' }] };
    });

    const verdict = verifySkillPackageBuffer(
      buildPackage({
        manifest: baseManifest({
          kind: 'expert-pack',
          skills: ['demo-skill'],
          promptTemplate: 'template',
          rules: ['rule-1'],
        }),
        publisher,
      }),
      { trustedKeysPath: publisher.trustStorePath, manifestGate: gate },
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_MANIFEST_INVALID');
    expect((verdict.error?.detail.issues as Array<{ code: string }>)[0]?.code).toBe('unknown_scope');
    expect(seen[0]).not.toHaveProperty('skills');
    expect(seen[0]).not.toHaveProperty('promptTemplate');
    expect(seen[0]).not.toHaveProperty('rules');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
