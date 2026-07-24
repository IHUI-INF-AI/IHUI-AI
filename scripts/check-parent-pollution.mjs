#!/usr/bin/env node
/**
 * check-parent-pollution.mjs — 项目父目录污染巡查(运行时项目外文件创建禁令)
 *
 * 触发背景(2026-07-24 立):
 *   历史教训:2026-07-19 agent 用 RunCommand 直接在 `D:\桌面\项目\` 创建了
 *   search_uuyc.ps1 + uuyc_search_result.txt,违反 AGENTS.md §15 项目外路径禁令。
 *   原 check-workspace-hygiene.mjs 只能扫项目内代码引用,无法检测 agent
 *   在项目外**直接创建**的运行时产物,存在盲区。
 *
 * 守门策略(反向巡查):
 *   1. 扫描项目父目录及父目录的所有非项目子目录中的"可执行脚本 + 文本文件"
 *   2. 命中条件(满足任一即判定为污染):
 *      a. 文件名匹配 agent 临时产物命名模式(search_*.ps1 / *_result.txt /
 *         *_search*.ps1 / tmp_*.ps1 / ihui-*.ps1 / test_*.ps1 / debug_*.txt 等)
 *      b. 文件内容同时包含项目路径引用(IHUI-AI / d:\桌面\项目) + agent 操作
 *         痕迹(Get-ChildItem / Out-File / Write-Output / Remove-Item 等)
 *      c. 文件内容包含本仓库敏感路径(apps/web / apps/api / packages/)且文件
 *         不在项目内
 *   3. 用户合法脚本不会同时满足"项目路径引用 + agent 操作痕迹"两条
 *
 * 扫描范围:
 *   - 项目父目录(D:\桌面\项目\)的所有非 IHUI-AI 文件
 *   - 项目祖父目录(D:\桌面\)下扩展名为 .ps1/.txt/.log/.bat/.sh/.py/.js/.mjs/.cjs
 *     的根级文件(不递归到子目录,避免误伤其他项目)
 *   - 跳过用户合法的快捷方式(.lnk)、Office 文档等
 *
 * 用法:
 *   node scripts/check-parent-pollution.mjs          # 阻塞模式(exit 1)
 *   node scripts/check-parent-pollution.mjs --warn   # warn-only(不阻塞)
 *
 * 退出码:0 = 无污染;1 = 发现项目外污染(阻塞 commit)
 */

import { readFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import * as os from 'node:os';
import { join, resolve, relative, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const PROJECT_NAME = basename(ROOT); // IHUI-AI
const PARENT_DIR = dirname(ROOT);    // D:\桌面\项目
const GRANDPARENT_DIR = dirname(PARENT_DIR); // D:\桌面

// ===== 可疑扩展名(agent 临时产物典型格式) =====
const SUSPICIOUS_EXTS = new Set([
  '.ps1', '.psm1', '.bat', '.cmd', '.sh',
  '.py', '.js', '.mjs', '.cjs', '.ts',
  '.txt', '.log', '.tmp',
]);

// ===== 文件名 agent 临时产物模式(强信号,直接判定) =====
const AGENT_FILENAME_PATTERNS = [
  /^search_.*\.(ps1|py|sh|bat|txt|js|mjs)$/i,
  /_search_.*\.(ps1|py|sh|bat|txt)$/i,
  /_search_result.*\.txt$/i,
  /^search_result.*\.txt$/i,
  /^uuyc.*\.(ps1|txt|log)$/i,
  /^tmp_.*\.(ps1|py|sh|bat|txt|js|mjs)$/i,
  /^ihui[-_].*\.(ps1|py|sh|bat|txt|js|mjs|json)$/i,
  /^test_.*\.(ps1|py|sh|bat)$/i,
  /^debug_.*\.(txt|log|ps1)$/i,
  /^cleanup.*\.(ps1|py|sh|bat)$/i,
  /^fix_.*\.(ps1|py|sh|bat)$/i,
  /^migrate.*\.(ps1|py|sh|bat)$/i,
  /^scan_.*\.(ps1|py|sh|bat|txt)$/i,
  /_result\.txt$/i,
  /_output\.txt$/i,
  /_list\.txt$/i,
];

// ===== 内容 agent 操作痕迹(PowerShell/Node 自动化命令) =====
const AGENT_OP_TRACES = [
  /Get-ChildItem/i,
  /Write-Output/i,
  /Out-File/i,
  /Set-Content/i,
  /Add-Content/i,
  /Remove-Item/i,
  /Copy-Item/i,
  /Move-Item/i,
  /New-Item/i,
  /Select-Object/i,
  /Format-Table/i,
  /Format-List/i,
  /\$ErrorActionPreference/i,
  /\[Console\]::OutputEncoding/i,
  /WriteAllBytes|WriteAllText/i,
  /require\(['"]fs['"]\)/,
  /import.*from\s+['"]node:fs['"]/,
];

// ===== 项目路径引用(同时命中即判定污染) =====
const PROJECT_REF_PATTERNS = [
  /IHUI[-_]?AI/i,
  /d:\\桌面\\项目/i,
  /D:\\桌面\\项目/i,
  /桌面\\项目/i,
  /apps[\\/]web[\\/]/,
  /apps[\\/]api[\\/]/,
  /apps[\\/]ai-service[\\/]/,
  /apps[\\/]extension[\\/]/,
  /apps[\\/]desktop[\\/]/,
  /apps[\\/]miniapp-taro[\\/]/,
  /apps[\\/]mobile-rn[\\/]/,
  /apps[\\/]cli[\\/]/,
  /packages[\\/]database[\\/]/,
  /packages[\\/]auth[\\/]/,
  /packages[\\/]types[\\/]/,
  /packages[\\/]ui([-_]?react)?[\\/]/,
  /@ihui\//i,
  /@ihui[-_]/i,
];

// ===== 用户合法文件名模式(白名单,不算污染) =====
const USER_LEGIT_PATTERNS = [
  /\.lnk$/i,                  // 快捷方式
  /\.url$/i,                  // URL 快捷方式
  /\.(docx?|xlsx?|pptx?|pdf|odt|ods|odp)$/i, // Office 文档
  /\.(jpg|jpeg|png|gif|bmp|webp|svg|ico|tiff?)$/i, // 图片
  /\.(mp4|mp3|wav|avi|mkv|flv|mov|wma|flac)$/i, // 音视频
  /\.(zip|rar|7z|tar|gz|bz2|xz)$/i,  // 压缩包
  /\.(exe|msi|dmg|pkg|deb|rpm|appimage)$/i,  // 安装包(用户下载)
  /^desktop\.ini$/i,
  /^Thumbs\.db$/i,
];

function isUserLegit(filename) {
  return USER_LEGIT_PATTERNS.some(p => p.test(filename));
}

function matchesAgentFilenamePattern(filename) {
  return AGENT_FILENAME_PATTERNS.some(p => p.test(filename));
}

function scanFileContent(filePath) {
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  // 截断前 50KB,避免大文件耗时
  if (content.length > 50 * 1024) {
    content = content.slice(0, 50 * 1024);
  }

  const hasProjectRef = PROJECT_REF_PATTERNS.some(p => p.test(content));
  const hasAgentOp = AGENT_OP_TRACES.some(p => p.test(content));

  return { hasProjectRef, hasAgentOp, content };
}

function findPollution(dir, recursive = false, depth = 0) {
  const pollutions = [];
  if (!existsSync(dir) || depth > 2) return pollutions;

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return pollutions;
  }

  for (const entry of entries) {
    // 跳过项目目录自身
    if (dir === PARENT_DIR && entry.name === PROJECT_NAME) continue;
    // 跳过系统隐藏目录
    if (entry.name === 'System Volume Information' || entry.name === '$RECYCLE.BIN') continue;

    const full = join(dir, entry.name);
    const relPath = relative(ROOT, full).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (recursive && depth < 2) {
        pollutions.push(...findPollution(full, recursive, depth + 1));
      }
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = extname(entry.name).toLowerCase();
    if (!SUSPICIOUS_EXTS.has(ext)) continue;
    if (isUserLegit(entry.name)) continue;

    // 强信号:文件名匹配 agent 临时产物模式 → 直接判定
    if (matchesAgentFilenamePattern(entry.name)) {
      pollutions.push({
        file: full,
        relPath: `[项目外] ${relPath}`,
        reason: `文件名匹配 agent 临时产物模式(${entry.name})`,
        level: 'blocking',
      });
      continue;
    }

    // 弱信号:内容同时包含项目路径引用 + agent 操作痕迹
    const scan = scanFileContent(full);
    if (scan && scan.hasProjectRef && scan.hasAgentOp) {
      pollutions.push({
        file: full,
        relPath: `[项目外] ${relPath}`,
        reason: '内容同时包含项目路径引用 + agent 自动化操作痕迹',
        level: 'blocking',
      });
    }
  }

  return pollutions;
}

function main() {
  const args = process.argv.slice(2);
  const isWarn = args.includes('--warn');
  const isAutoClean = args.includes('--auto-clean');
  const isQuiet = args.includes('--quiet');

  const allPollutions = [];

  // 1. 扫描项目父目录(递归到 2 层,捕获 D:\桌面\项目\*.ps1 和子目录中的污染)
  allPollutions.push(...findPollution(PARENT_DIR, true, 0));

  // 2. 扫描项目祖父目录(桌面)的根级文件(不递归,避免误伤其他项目)
  allPollutions.push(...findPollution(GRANDPARENT_DIR, false, 0));

  // 3. 扫描用户主目录根级(只扫 agent 临时产物命名模式的文件,不递归)
  //    覆盖 agent 误写到 ~/ 的情况(如 ~/*.ps1 / ~/*.txt 调试日志)
  const homeDir = os.homedir();
  allPollutions.push(...findPollution(homeDir, false, 0));

  // --auto-clean: 自动清理强信号命中(文件名匹配 agent 临时产物模式)的污染
  // 只清理文件名强信号命中,不清理内容双信号命中(避免误删用户合法脚本)
  if (isAutoClean && allPollutions.length > 0) {
    const cleaned = [];
    const remaining = [];
    for (const p of allPollutions) {
      if (p.reason.includes('文件名匹配 agent 临时产物模式')) {
        try {
          unlinkSync(p.file);
          cleaned.push(p);
        } catch (e) {
          remaining.push(p);
        }
      } else {
        remaining.push(p);
      }
    }

    if (cleaned.length > 0 && !isQuiet) {
      console.log(`🧹 parent-pollution [auto-clean]: 已自动清理 ${cleaned.length} 个 agent 污染文件`);
      for (const p of cleaned) {
        console.log(`  ✓ 已删除 ${p.relPath}`);
      }
    }

    if (remaining.length === 0) {
      if (!isQuiet) console.log('✅ parent-pollution: 清理完成,无剩余污染');
      process.exit(0);
    }

    // 剩余的是内容双信号命中,需要人工确认
    if (!isQuiet) {
      console.error(`⚠️  parent-pollution: ${remaining.length} 个文件需人工确认(内容双信号命中,不自动删除)`);
      for (const p of remaining) {
        console.error(`  ${p.relPath}`);
        console.error(`    原因: ${p.reason}`);
        console.error(`    手动删除: Remove-Item "${p.file}" -Force`);
      }
    }
    process.exit(1);
  }

  if (allPollutions.length === 0) {
    if (!isQuiet) console.log('✅ parent-pollution: 项目父目录及桌面根目录无 agent 污染');
    process.exit(0);
  }

  const mode = isWarn ? 'WARN' : 'BLOCK';
  const prefix = isWarn ? '⚠️ ' : '❌ ';
  console.error(`${prefix}parent-pollution [${mode}]: 发现 ${allPollutions.length} 个项目外污染文件`);
  console.error('');
  console.error('违反 AGENTS.md §15 项目外路径禁令 + §15 运行时禁令:');
  console.error('  agent 不得在项目目录外用 RunCommand / PowerShell 创建任何文件。');
  console.error('  所有临时脚本必须放 .trae-cn/tmp/<脚本名>,所有产物必须放项目内。');
  console.error('');
  for (const p of allPollutions.slice(0, 30)) {
    console.error(`  ${p.relPath}`);
    console.error(`    原因: ${p.reason}`);
  }
  console.error('');
  console.error('清理方法:');
  console.error('  自动清理: pnpm hygiene:parent:clean  (只清文件名强信号命中)');
  console.error('  手动清理: Remove-Item "<文件路径>" -Force');
  console.error('');

  if (isWarn) {
    console.log('(warn-only 模式,不阻塞 commit)');
    process.exit(0);
  }
  process.exit(1);
}

main();
