// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CLI 消费点: `ihui skills install|verify|uninstall|pack`。
 *
 * 这是安装安全链在真实入口上的接线:
 *   - install  → verify(4 阶段) → 原子落位(installSkillPackage)
 *   - verify   → 逐阶段打印 stage/code,失败退出码 1
 *   - uninstall→ 逐项删除 + 残留复检(uninstallSkillPackage)
 *   - pack     → 专家包生成器(引用技能必须存在;产物可被 verify 消费)
 *
 * 命令描述与输出一律 ASCII:守门 70 的硬编码中文棘轮约束新增文件,新入口不开第二套惯例。
 */

import type { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash, createPrivateKey, type KeyObject } from 'node:crypto';

import { getCapability, validateExtensionManifest, type ApiKeyPermission } from '@ihui/types';

import {
  createExtensionManifestGate,
  generateExpertPack,
  discoverInstalledSkillSources,
  getDefaultSkillInstallRoot,
  installSkillPackage,
  isSkillPackageError,
  uninstallSkillPackage,
  verifySkillPackage,
} from '../skills/packaging/index.js';

/**
 * 技能安装授权面:直接委托声明式扩展 manifest 校验器(单一 schema 来源),
 * 权限 scope 走 capability-catalog 已登记索引,未登记即拒。
 */
const extensionManifestGate = createExtensionManifestGate(validateExtensionManifest, {
  isRegisteredScope: (scope) => getCapability(scope as ApiKeyPermission) !== undefined,
});

interface PackageOptions {
  trustedKeys?: string;
  installRoot?: string;
  json?: boolean;
}

interface PackOptions {
  id: string;
  name: string;
  version: string;
  skills: string;
  promptTemplate: string;
  modelTier: string;
  signingKey: string;
  keyId: string;
  output: string;
  rule?: string[];
  installRoot?: string;
  trustedKeys?: string;
  json?: boolean;
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(error: unknown, json: boolean): void {
  if (isSkillPackageError(error)) {
    if (json) printJson({ ok: false, code: error.code, message: error.message, detail: error.detail });
    else console.error(`[${error.code}] ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (json) printJson({ ok: false, code: 'UNKNOWN_ERROR', message });
  else console.error(message);
  process.exitCode = 1;
}

function loadSigningKey(pemPath: string): KeyObject {
  return createPrivateKey(fs.readFileSync(pemPath, 'utf8'));
}

function collectRule(value: string, previous: string[] = []): string[] {
    return [...previous, value];
}

export function registerSkillPackageCommands(skillsCmd: Command): void {
  skillsCmd
    .command('install <package>')
    .description('verify and atomically install a signed skill package (.tar)')
    .option('--trusted-keys <path>', 'trustedKeys JSON (default: ~/.ihui/skill-trusted-keys.json)')
    .option('--install-root <path>', 'install root (default: ~/.ihui/installed-skills)')
    .option('--json', 'machine-readable result')
    .action((packagePath: string, options: PackageOptions) => {
      try {
        const result = installSkillPackage(packagePath, {
          trustedKeysPath: options.trustedKeys,
          installRoot: options.installRoot,
          manifestGate: extensionManifestGate,
        });
        if (options.json) {
          printJson(result);
        } else {
          console.info(`INSTALLED ${result.id}@${result.version}`);
          console.info(`path: ${result.installedPath}`);
          console.info(`files: ${result.files.length}${result.replacedExisting ? ' (replaced previous version)' : ''}`);
        }
      } catch (error) {
        fail(error, options.json === true);
      }
    });

  skillsCmd
    .command('verify <package>')
    .description('run the 4-stage install security chain without writing anything')
    .option('--trusted-keys <path>', 'trustedKeys JSON (default: ~/.ihui/skill-trusted-keys.json)')
    .option('--json', 'machine-readable result')
    .action((packagePath: string, options: PackageOptions) => {
      const result = verifySkillPackage(packagePath, {
        trustedKeysPath: options.trustedKeys,
        manifestGate: extensionManifestGate,
      });
      if (options.json) {
        printJson(result);
      } else {
        for (const check of result.checks) {
          const mark = check.ok ? 'PASS' : `FAIL ${check.code ?? ''}`;
          console.info(`[stage ${check.stage}] ${mark} ${check.item}`);
        }
        if (!result.ok && result.error) console.error(`[${result.error.code}] ${result.error.message}`);
      }
      if (!result.ok) process.exitCode = 1;
    });

  skillsCmd
    .command('uninstall <id>')
    .description('delete an installed skill package file-by-file and verify no residue')
    .option('--install-root <path>', 'install root (default: ~/.ihui/installed-skills)')
    .option('--json', 'machine-readable result')
    .action((id: string, options: PackageOptions) => {
      try {
        const result = uninstallSkillPackage(id, { installRoot: options.installRoot });
        if (options.json) {
          printJson(result);
        } else {
          console.info(`${result.removed ? 'REMOVED' : 'NOT_INSTALLED'} ${result.id}`);
          console.info(`files: ${result.removedFiles.length}; residual: ${result.residual.length}`);
        }
        if (result.residual.length > 0) process.exitCode = 1;
      } catch (error) {
        fail(error, options.json === true);
      }
    });

  skillsCmd
    .command('pack')
    .description('build a reproducible, signed expert-pack from installed skill ids')
    .requiredOption('--id <id>', 'expert pack id')
    .requiredOption('--name <name>', 'expert pack display name')
    .requiredOption('--version <version>', 'expert pack version (semver)')
    .requiredOption('--skills <ids>', 'comma-separated installed skill ids')
    .requiredOption('--prompt-template <text>', 'prompt template')
    .requiredOption('--model-tier <tier>', 'model capability tier')
    .requiredOption('--signing-key <pem>', 'ed25519 private key (PEM)')
    .requiredOption('--key-id <id>', 'signing keyId (must be in receiver trustedKeys)')
    .requiredOption('--output <path>', 'output .tar path')
    .option('--rule <text>', 'repeatable rule entry', collectRule)
    .option('--install-root <path>', 'installed skills root (default: ~/.ihui/installed-skills)')
    .option('--trusted-keys <path>', 'verify the generated pack immediately with this trust store')
    .option('--json', 'machine-readable result')
    .action((options: PackOptions) => {
      try {
        const installRoot = options.installRoot ?? getDefaultSkillInstallRoot();
        const skillIds = options.skills
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        const generated = generateExpertPack({
          id: options.id,
          name: options.name,
          version: options.version,
          skillIds,
          promptTemplate: options.promptTemplate,
          rules: options.rule ?? [],
          modelTier: options.modelTier,
          skillSources: discoverInstalledSkillSources(installRoot),
          signingKey: loadSigningKey(options.signingKey),
          keyId: options.keyId,
          outputPath: path.resolve(options.output),
          manifestGate: extensionManifestGate,
        });
        const verification = options.trustedKeys
          ? verifySkillPackage(generated.outputPath, {
              trustedKeysPath: options.trustedKeys,
              manifestGate: extensionManifestGate,
            })
          : undefined;
        const payload = {
          ok: generated.ok && (verification?.ok ?? true),
          outputPath: generated.outputPath,
          packageSha256: generated.packageSha256,
          checksumsSha256: createHash('sha256').update(generated.checksumsBytes).digest('hex'),
          files: generated.files,
          verification,
        };
        if (options.json) {
          printJson(payload);
        } else {
          console.info(`PACKED ${String(generated.manifest.id)}@${String(generated.manifest.version)}`);
          console.info(`output: ${generated.outputPath}`);
          console.info(`package sha256: ${generated.packageSha256}`);
          console.info(`checksums sha256: ${payload.checksumsSha256}`);
          if (verification) console.info(`self-verify: ${verification.ok ? 'PASS' : 'FAIL'}`);
        }
        if (verification && !verification.ok) process.exitCode = 1;
      } catch (error) {
        fail(error, options.json === true);
      }
    });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
