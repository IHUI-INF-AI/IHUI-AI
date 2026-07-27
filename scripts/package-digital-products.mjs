#!/usr/bin/env node
/**
 * package-digital-products.mjs
 *
 * 打包 IHUI AI 提示词库为可下载的 zip 文件，并生成 manifest.json 校验清单。
 *
 * 用法：
 *   node scripts/package-digital-products.mjs                 # 默认打包 ai-prompt-library
 *   node scripts/package-digital-products.mjs --product=ai-prompt-library
 *   node scripts/package-digital-products.mjs --verify        # 仅校验现有 zip
 *
 * 输出：
 *   - products/<product>/dist/<product>-v<version>.zip
 *   - products/<product>/dist/manifest.json
 *
 * 守门：脚本本身在 scripts/ 下，符合 §25 豁免（正式工具）。
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, stat, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

const args = process.argv.slice(2);
const verifyOnly = args.includes('--verify');
const productArg = args.find(a => a.startsWith('--product='));
const PRODUCT_NAME = productArg ? productArg.split('=')[1] : 'ai-prompt-library';

const PRODUCT_DIR = join(PROJECT_ROOT, 'products', PRODUCT_NAME);
const DIST_DIR = join(PRODUCT_DIR, 'dist');
const PROMPTS_DIR = join(PRODUCT_DIR, 'prompts');

// ============= 工具函数 =============

function log(msg) {
  console.log(`[package] ${msg}`);
}

function warn(msg) {
  console.warn(`[package] WARN: ${msg}`);
}

function err(msg) {
  console.error(`[package] ERROR: ${msg}`);
  process.exit(1);
}

async function sha256(filePath) {
  const data = await readFile(filePath);
  return createHash('sha256').update(data).digest('hex');
}

async function walkDir(dir, base = dir) {
  const result = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      // 跳过 dist 目录（避免自引用）
      if (entry.name === 'dist' || entry.name === 'node_modules' || entry.name === '.git') continue;
      result.push(...await walkDir(fullPath, base));
    } else {
      result.push(fullPath);
    }
  }
  return result;
}

// ============= 校验 JSON =============

async function validateJsonFiles(files) {
  log(`校验 ${files.length} 个 JSON 文件...`);
  let validCount = 0;
  let totalPrompts = 0;
  const errors = [];

  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8');
      const json = JSON.parse(content);

      if (!json.category || !json.prompts || !Array.isArray(json.prompts)) {
        errors.push(`${relative(PRODUCT_DIR, file)}: 缺少 category 或 prompts 字段`);
        continue;
      }

      // 校验每个 prompt
      for (const p of json.prompts) {
        const required = ['id', 'title', 'prompt_template', 'variables'];
        for (const field of required) {
          if (!(field in p)) {
            errors.push(`${relative(PRODUCT_DIR, file)} prompt ${p.id || '?'}: 缺少 ${field}`);
          }
        }
      }

      validCount++;
      totalPrompts += json.prompts.length;
    } catch (e) {
      errors.push(`${relative(PRODUCT_DIR, file)}: ${e.message}`);
    }
  }

  if (errors.length > 0) {
    warn(`校验发现 ${errors.length} 个问题：`);
    errors.forEach(e => warn(`  - ${e}`));
    if (errors.length > 5) err('校验失败：超过 5 个错误');
  }

  log(`✓ 校验通过：${validCount} 个文件，${totalPrompts} 个 prompts`);
  return { validCount, totalPrompts, errors };
}

// ============= 生成 manifest.json =============

async function generateManifest(files, productMeta) {
  log('生成 manifest.json...');

  const fileEntries = [];
  for (const file of files) {
    const relPath = relative(PRODUCT_DIR, file).replace(/\\/g, '/');
    const stats = await stat(file);
    const hash = await sha256(file);
    fileEntries.push({
      path: relPath,
      size: stats.size,
      sha256: hash,
      modified: stats.mtime.toISOString()
    });
  }

  const manifest = {
    product: productMeta.name,
    product_zh: productMeta.name_zh,
    version: productMeta.version,
    release_version: productMeta.release_version,
    price: productMeta.price,
    generated_at: new Date().toISOString(),
    generator: 'package-digital-products.mjs v1.0',
    total_files: fileEntries.length,
    total_prompts: productMeta.total_prompts,
    total_categories: productMeta.total_categories,
    files: fileEntries.sort((a, b) => a.path.localeCompare(b.path)),
    integrity: {
      algorithm: 'sha256',
      description: '使用 SHA256 校验文件完整性：shasum -a 256 <file> 或 certutil -hashfile <file> SHA256'
    }
  };

  const manifestPath = join(DIST_DIR, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  log(`✓ manifest.json 已生成: ${relative(PROJECT_ROOT, manifestPath)}`);

  return { manifest, manifestPath };
}

// ============= 创建 zip =============

async function createZip(version) {
  const zipName = `${PRODUCT_NAME}-v${version}.zip`;
  const zipPath = join(DIST_DIR, zipName);

  // 删除已存在的 zip
  if (existsSync(zipPath)) {
    const { unlink } = await import('node:fs/promises');
    await unlink(zipPath);
    log(`已删除旧 zip: ${zipName}`);
  }

  log(`创建 zip: ${zipName}...`);

  // 使用 PowerShell 的 Compress-Archive（Windows）
  // 注意：Compress-Archive 会保留相对路径结构
  const sourcePath = PRODUCT_DIR;
  const psCommand = [
    '$ErrorActionPreference = "Stop"',
    `$source = "${sourcePath}"`,
    `$dest = "${zipPath}"`,
    `Compress-Archive -Path "$source\\*" -DestinationPath $dest -CompressionLevel Optimal -Force`,
    `Write-Output "ZIP_CREATED:$dest"`
  ].join(';');

  try {
    const output = execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-Command', psCommand
    ], { encoding: 'utf-8', cwd: PROJECT_ROOT, timeout: 60000 });

    if (!output.includes('ZIP_CREATED')) {
      err(`zip 创建失败，输出: ${output}`);
    }

    // 验证 zip 存在且非空
    const stats = await stat(zipPath);
    if (stats.size < 1000) {
      err(`zip 文件过小 (${stats.size} bytes)，可能创建失败`);
    }

    log(`✓ zip 已创建: ${relative(PROJECT_ROOT, zipPath)} (${(stats.size / 1024).toFixed(1)} KB)`);
    return { zipPath, zipName, zipSize: stats.size };
  } catch (e) {
    err(`PowerShell 执行失败: ${e.message}`);
  }
}

// ============= 校验 zip =============

async function verifyZip(zipPath, manifestPath) {
  log('校验 zip 完整性...');

  // 1. 校验 zip 存在
  if (!existsSync(zipPath)) {
    err(`zip 不存在: ${zipPath}`);
  }

  // 2. 校验 zip 可解压列出内容
  const zipPathStr = zipPath;
  const psCommand = [
    '$ErrorActionPreference = "Stop"',
    `$zip = "${zipPathStr}"`,
    `Add-Type -AssemblyName System.IO.Compression.FileSystem`,
    `$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)`,
    `$count = $archive.Entries.Count`,
    `$archive.Dispose()`,
    `Write-Output "ENTRIES:$count"`
  ].join(';');

  try {
    const output = execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-Command', psCommand
    ], { encoding: 'utf-8', timeout: 30000 });

    const match = output.match(/ENTRIES:(\d+)/);
    if (!match) {
      err(`无法解析 zip 条目数: ${output}`);
    }
    const entryCount = parseInt(match[1], 10);
    log(`✓ zip 包含 ${entryCount} 个文件`);

    if (entryCount < 20) {
      warn(`zip 条目数 ${entryCount} 偏少，预期 ≥22（README + CATALOG + index + manifest + 20 prompts）`);
    }
  } catch (e) {
    err(`zip 校验失败: ${e.message}`);
  }

  // 3. 校验 manifest 存在且可读
  if (!existsSync(manifestPath)) {
    err(`manifest 不存在: ${manifestPath}`);
  }

  const manifestContent = await readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestContent);

  log(`✓ manifest 校验通过:`);
  log(`  - 产品: ${manifest.product}`);
  log(`  - 版本: ${manifest.version} (${manifest.release_version})`);
  log(`  - 文件数: ${manifest.total_files}`);
  log(`  - prompts 数: ${manifest.total_prompts}`);
  log(`  - 分类数: ${manifest.total_categories}`);

  // 4. 校验 manifest 中的文件 SHA256
  log('校验文件 SHA256 完整性...');
  let verifiedCount = 0;
  for (const fileEntry of manifest.files) {
    const fullPath = join(PRODUCT_DIR, fileEntry.path);
    if (!existsSync(fullPath)) {
      warn(`manifest 引用的文件不存在: ${fileEntry.path}`);
      continue;
    }
    const currentHash = await sha256(fullPath);
    if (currentHash !== fileEntry.sha256) {
      err(`SHA256 不匹配: ${fileEntry.path}\n  manifest: ${fileEntry.sha256}\n  current:  ${currentHash}`);
    }
    verifiedCount++;
  }
  log(`✓ SHA256 校验通过: ${verifiedCount}/${manifest.files.length} 个文件`);

  return true;
}

// ============= 主流程 =============

async function main() {
  log(`=== IHUI AI 数字产品打包工具 ===`);
  log(`产品: ${PRODUCT_NAME}`);
  log(`项目根: ${PROJECT_ROOT}`);
  log(`产品目录: ${PRODUCT_DIR}`);

  // 1. 检查产品目录
  if (!existsSync(PRODUCT_DIR)) {
    err(`产品目录不存在: ${PRODUCT_DIR}`);
  }

  // 2. 读取 index.json 获取版本信息
  const indexPath = join(PRODUCT_DIR, 'index.json');
  if (!existsSync(indexPath)) {
    err(`index.json 不存在: ${indexPath}`);
  }

  const indexContent = await readFile(indexPath, 'utf-8');
  const index = JSON.parse(indexContent);
  const productMeta = {
    name: index.product.name,
    name_zh: index.product.name_zh,
    version: index.product.version,
    release_version: index.product.release_version,
    price: index.product.price,
    total_prompts: index.product.total_prompts,
    total_categories: index.product.total_categories
  };

  log(`版本: ${productMeta.version} (${productMeta.release_version})`);
  log(`定价: ${productMeta.price}`);
  log(`prompts: ${productMeta.total_prompts} / 分类: ${productMeta.total_categories}`);

  // 3. 收集所有文件
  log('收集产品文件...');
  const allFiles = await walkDir(PRODUCT_DIR);
  log(`找到 ${allFiles.length} 个文件`);

  // 4. 校验 JSON 文件
  const jsonFiles = allFiles.filter(f => f.endsWith('.json'));
  const { totalPrompts } = await validateJsonFiles(jsonFiles);

  // 5. 仅校验模式
  if (verifyOnly) {
    const zipName = `${PRODUCT_NAME}-v${productMeta.version}.zip`;
    const zipPath = join(DIST_DIR, zipName);
    const manifestPath = join(DIST_DIR, 'manifest.json');
    log('=== 仅校验模式 ===');
    await verifyZip(zipPath, manifestPath);
    log('✓ 校验完成');
    return;
  }

  // 6. 创建 dist 目录
  if (!existsSync(DIST_DIR)) {
    await mkdir(DIST_DIR, { recursive: true });
    log(`创建 dist 目录: ${relative(PROJECT_ROOT, DIST_DIR)}`);
  }

  // 7. 生成 manifest（在 zip 之前，以便 manifest 自身也被打包）
  // 注意：先排除 dist 自身的文件
  const filesToPackage = allFiles.filter(f => !f.includes(join(PRODUCT_DIR, 'dist')));
  log(`待打包文件: ${filesToPackage.length} 个`);

  const { manifestPath } = await generateManifest(filesToPackage, productMeta);

  // 8. 重新收集文件（包含刚生成的 manifest.json）
  const allFilesWithManifest = await walkDir(PRODUCT_DIR);
  const filesForZip = allFilesWithManifest.filter(f => !f.includes(join(PRODUCT_DIR, 'dist')) || f === manifestPath);
  // 实际上 manifest.json 在 dist 下，但我们要把它放进 zip
  // 重新策略：将 manifest.json 复制到产品根目录后打包，再删除
  // 或者：手动构造 zip 内容

  // 简化策略：将 manifest.json 临时放在产品根，打包后移除
  const tempManifestPath = join(PRODUCT_DIR, 'manifest.json');
  const manifestContent = await readFile(manifestPath, 'utf-8');
  await writeFile(tempManifestPath, manifestContent, 'utf-8');
  log(`临时 manifest.json 已放置: ${relative(PROJECT_ROOT, tempManifestPath)}`);

  try {
    // 9. 创建 zip
    const { zipPath, zipName, zipSize } = await createZip(productMeta.version);

    // 10. 校验 zip
    await verifyZip(zipPath, manifestPath);

    // 11. 输出最终结果
    log('');
    log('=== 打包完成 ===');
    log(`📦 zip 文件: ${relative(PROJECT_ROOT, zipPath)}`);
    log(`   文件名: ${zipName}`);
    log(`   大小: ${(zipSize / 1024).toFixed(1)} KB (${(zipSize / 1024 / 1024).toFixed(2)} MB)`);
    log(`📋 manifest: ${relative(PROJECT_ROOT, manifestPath)}`);
    log(`🎯 产品: ${productMeta.name_zh} (${productMeta.name})`);
    log(`🔖 版本: ${productMeta.version} (${productMeta.release_version})`);
    log(`💰 定价: ${productMeta.price}`);
    log(`📊 内容: ${totalPrompts} prompts / ${productMeta.total_categories} 分类`);
    log('');
    log('下一步：上传 zip 到 GitHub Release v0.3.0 作为可下载资产。');

  } finally {
    // 清理临时 manifest.json
    if (existsSync(tempManifestPath)) {
      const { unlink } = await import('node:fs/promises');
      await unlink(tempManifestPath);
      log(`已清理临时 manifest.json`);
    }
  }
}

main().catch(e => {
  err(`未捕获异常: ${e.stack || e.message}`);
});
