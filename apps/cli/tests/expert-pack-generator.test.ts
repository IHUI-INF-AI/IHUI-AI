// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 专家包生成器验收:
 *   - 同一输入两次生成 ⇒ checksums.json 逐字节相同(整包也相同);
 *   - 引用不存在的技能 ⇒ 点名拒绝;
 *   - 生成物能被安装安全链 verify/install 消费(闭环);
 *   - 模型档位写入 manifest.modelTiers。
 */

import { afterAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  discoverInstalledSkillSources,
  generateExpertPack,
  installSkillPackage,
  isSkillPackageError,
  readTar,
  sha256Hex,
  uninstallSkillPackage,
  verifySkillPackage,
  type SkillPackageError,
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

function installFixtureSkill(root: string, dir: string, publisher: Publisher, id: string): void {
  const pkg = writePackage(
    dir,
    buildPackage({
      manifest: baseManifest({ id, name: id }),
      publisher,
      payload: { 'SKILL.md': `# ${id}\n`, 'notes.md': `${id} notes\n` },
    }),
    `${id}.tar`,
  );
  installSkillPackage(pkg, { trustedKeysPath: publisher.trustStorePath, installRoot: root });
}

describe('expert pack generator', () => {
  afterAll(() => cleanupTempRoots());

  it('is reproducible: two runs produce byte-identical checksums and package', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const root = path.join(dir, 'installed');
    installFixtureSkill(root, dir, publisher, 'skill-a');
    installFixtureSkill(root, dir, publisher, 'skill-b');
    const sources = discoverInstalledSkillSources(root);

    const common = {
      id: 'demo-expert',
      name: 'Demo Expert',
      version: '1.0.0',
      skillIds: ['skill-b', 'skill-a'],
      promptTemplate: 'Use both skills carefully.',
      rules: ['never expose secrets', 'cite sources'],
      modelTier: 'standard',
      skillSources: sources,
      signingKey: publisher.privateKey,
      keyId: publisher.keyId,
    };
    const first = generateExpertPack({ ...common, outputPath: path.join(dir, 'expert-1.tar') });
    const second = generateExpertPack({ ...common, outputPath: path.join(dir, 'expert-2.tar') });

    expect(first.checksumsBytes.equals(second.checksumsBytes)).toBe(true);
    expect(first.packageBytes.equals(second.packageBytes)).toBe(true);
    expect(first.packageSha256).toBe(second.packageSha256);
    expect(sha256Hex(first.checksumsBytes)).toBe(sha256Hex(second.checksumsBytes));

    const fromTar = readTar(fs.readFileSync(first.outputPath)).entries.get('checksums.json')!;
    expect(fromTar.content.equals(first.checksumsBytes)).toBe(true);
  });

  it('rejects a referenced skill id that does not exist, naming it', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const root = path.join(dir, 'installed');
    installFixtureSkill(root, dir, publisher, 'skill-a');
    const sources = discoverInstalledSkillSources(root);

    const error = capture(() =>
      generateExpertPack({
        id: 'bad-expert',
        name: 'Bad Expert',
        version: '1.0.0',
        skillIds: ['skill-a', 'missing-skill'],
        promptTemplate: 'n/a',
        rules: [],
        modelTier: 'standard',
        skillSources: sources,
        signingKey: publisher.privateKey,
        keyId: publisher.keyId,
        outputPath: path.join(dir, 'bad-expert.tar'),
      }),
    );

    expect(error.code).toBe('SKILL_PKG_EXPERT_SKILL_NOT_FOUND');
    expect(error.detail.skillId).toBe('missing-skill');
    expect(fs.existsSync(path.join(dir, 'bad-expert.tar'))).toBe(false);
  });

  it('produces a pack that the install security chain verifies and installs', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const root = path.join(dir, 'installed');
    installFixtureSkill(root, dir, publisher, 'skill-a');
    const sources = discoverInstalledSkillSources(root);

    const generated = generateExpertPack({
      id: 'closed-loop-expert',
      name: 'Closed Loop Expert',
      version: '1.0.0',
      skillIds: ['skill-a'],
      promptTemplate: 'answer with evidence',
      rules: ['no guessing'],
      modelTier: 'advanced',
      skillSources: sources,
      signingKey: publisher.privateKey,
      keyId: publisher.keyId,
      outputPath: path.join(dir, 'closed-loop.tar'),
    });

    const verdict = verifySkillPackage(generated.outputPath, { trustedKeysPath: publisher.trustStorePath });
    expect(verdict.ok).toBe(true);
    expect(verdict.identity?.kind).toBe('expert-pack');
    expect(verdict.files).toContain('skills/skill-a/SKILL.md');

    const installed = installSkillPackage(generated.outputPath, {
      trustedKeysPath: publisher.trustStorePath,
      installRoot: path.join(dir, 'expert-root'),
    });
    expect(installed.id).toBe('closed-loop-expert');
    const removed = uninstallSkillPackage('closed-loop-expert', { installRoot: path.join(dir, 'expert-root') });
    expect(removed.residual).toEqual([]);
  });

  it('records model tier and referenced skill ids in the manifest', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const root = path.join(dir, 'installed');
    installFixtureSkill(root, dir, publisher, 'skill-a');
    installFixtureSkill(root, dir, publisher, 'skill-b');
    const sources = discoverInstalledSkillSources(root);

    const generated = generateExpertPack({
      id: 'manifest-expert',
      name: 'Manifest Expert',
      version: '1.0.0',
      skillIds: ['skill-b', 'skill-a'],
      promptTemplate: 'template',
      rules: ['rule'],
      modelTier: 'basic',
      skillSources: sources,
      signingKey: publisher.privateKey,
      keyId: publisher.keyId,
      outputPath: path.join(dir, 'manifest-expert.tar'),
    });
    const manifest = generated.manifest as {
      modelTiers: { min: string };
      skills: string[];
      promptTemplate: string;
      rules: string[];
      kind: string;
    };

    expect(manifest.kind).toBe('expert-pack');
    expect(manifest.modelTiers.min).toBe('basic');
    expect(manifest.skills).toEqual(['skill-a', 'skill-b']);
    expect(manifest.promptTemplate).toBe('template');
    expect(manifest.rules).toEqual(['rule']);
  });

  it('still rejects a generated pack signed by an untrusted key', () => {
    const dir = makeTempDir();
    const publisher = createPublisher(dir);
    const stranger = createPublisher(path.join(dir, 'stranger'), 'publisher-x');
    const root = path.join(dir, 'installed');
    installFixtureSkill(root, dir, publisher, 'skill-a');
    const sources = discoverInstalledSkillSources(root);

    const generated = generateExpertPack({
      id: 'stranger-expert',
      name: 'Stranger Expert',
      version: '1.0.0',
      skillIds: ['skill-a'],
      promptTemplate: 'template',
      rules: [],
      modelTier: 'standard',
      skillSources: sources,
      signingKey: stranger.privateKey,
      keyId: stranger.keyId,
      outputPath: path.join(dir, 'stranger.tar'),
    });
    const verdict = verifySkillPackage(generated.outputPath, { trustedKeysPath: publisher.trustStorePath });

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_SIGNATURE_KEY_UNTRUSTED');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
