#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * check-workspace-hygiene.mjs v2 — 彻底根治项目外路径违规
 *
 * 7 大漏洞修复(2026-07-23 v2):
 *   1. 覆盖范围:从只扫 .ihui-agent/tmp/ → 扫整个项目 working tree(排除 node_modules/.git/dist/.output/.next/turbo)
 *      〔v3 更正@2026-10-16(台账票「门 25 全量档把别人工具的缓存算成项目违规」)〕全量档不再走磁盘递归:面 = **在册文件**(`git ls-files --cached`)
 *      ∪ `.ihui-agent/tmp/`。磁盘递归会把 `.gitignore` 内别人工具的缓存(实测 `.DevEnv/…/.codex/`
 *      三条)算成违规,而那类红与任何提交内容无关、会话也无法让它变绿 ⇒ §12e 恒红门。
 *      `--staged` 档不变(仍只扫本次暂存集)。
 *   2. 模式匹配:从只检测 ihui-ext/ihui-prof → 检测所有盘符 \temp\ 项目数据 + \AppData\ + 中文绝对路径
 *   3. 阻塞模式:默认 exit 1(阻塞 commit),--warn 降级为 warn-only
 *   4. pre-commit 用 --staged 模式:只扫 staged 文件,避免误报其他 agent 的 WIP
 *   5. 检测硬编码中文绝对路径:d:\桌面\ 等(GBK 编码会乱码)
 *   6. 检测相对路径跳出项目:在文件写入上下文的 ..\..
 *   7. 扫描配置文件:.json/.yaml/.yml 可能含路径配置
 *
 * 违规模式:
 *   a. 任何盘符 \temp\ 后跟非 .log/.txt 文件(项目数据写到系统 temp)
 *   b. \AppData\Local\Temp\ 后跟非 .log 文件
 *   c. $env:TEMP\ / $env:LOCALAPPDATA\ 后跟非 .log 文件
 *   d. 硬编码中文绝对路径(d:\桌面\ / d:\项目\ 等,GBK 会乱码)
 *   e. ihui-ext / ihui-prof 等项目数据目录名出现在项目外路径上下文
 *
 * 白名单:
 *   - 守门脚本自身 + AGENTS.md + 规则文档
 *   - 注释行(# 或 //)或包含"禁止/反面/deprecated/forbidden"的行
 *   - .log / .txt 文件路径
 *   - --redirect 参数(日志重定向)
 *
 * 用法:
 *   node scripts/check-workspace-hygiene.mjs              # 扫整个项目(阻塞)
 *   node scripts/check-workspace-hygiene.mjs --staged      # 只扫 staged(阻塞,用于 pre-commit)
 *   node scripts/check-workspace-hygiene.mjs --warn        # warn-only(不阻塞)
 *   node scripts/check-workspace-hygiene.mjs --staged --warn
 *
 * 退出码:0 = 无违规;1 = 发现违规(阻塞)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { withExcludes, isExcludedDirName } from './lib/exclude-dirs.mjs';
import { gitRaw, catBatch } from './lib/face-reader.mjs';
import { createLogger } from './lib/logger.mjs';
import { flagValue } from './lib/flag-value.mjs';

const log = createLogger();

// ROOT 默认由脚本自身位置推导(§15:不接受用 cwd 挪动扫描面 —— 改 cwd 会让自测静默扫真仓)。
// `--root <dir>` 是**显式测试通道**(守门 70 同法):生产链不带它,语义与改前逐字相同。
// 没有它,自测夹具只能落在被扫描的真仓树里,于是一次被 SIGKILL 打断的运行就把带着
// `$env:TEMP\…` 字面量的夹具永久留在盘上 —— 之后每次全量审计都报一条"项目数据写到系统 temp"
// 的**假违规**,而违规者早已不存在(2026-09-25 实测盘上就挂着 19:23 那一轮的残留)。
// G-322:给了 --root 却没收到合法值(被下一旗标顶掉/结尾无值/空串)⇒ 立即非零点名,
// 不得静默扫默认根还报"无违规" —— 那会把"审计了别的树"读成"审计了你给的树"。
{
  const _f = flagValue(process.argv, '--root');
  if (_f.present && !_f.valid) {
    const _got = _f.token === null ? '(其后没有任何参数)' : JSON.stringify(_f.token);
    console.error(`❌ 无法判定:--root 需要一个目录参数 —— 紧邻的 token 实得:${_got}(不得静默退回仓库根)`);
    process.exit(2);
  }
}
const _rootIdx = process.argv.indexOf('--root');
const _rootArg = _rootIdx > -1 ? process.argv[_rootIdx + 1] : null;
const ROOT = _rootArg ? resolve(_rootArg) : resolve(fileURLToPath(new URL('../', import.meta.url)));
// 显式 --root = 测试通道(那棵树多半不是 git 仓,谈不上"在册面"),仍走磁盘递归;
// 不带它(生产链/全量审计)才走下面的在册面。两档共用同一套判据,只有取材清单不同。
const EXPLICIT_ROOT = Boolean(_rootArg);

// ===== 文件类型 =====
const SCRIPT_EXTS = new Set(['.ps1', '.py', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.sh', '.bat', '.json', '.yaml', '.yml']);

// ===== 排除目录(基于共享 EXCLUDE_DIRS,追加脚本特有) =====
// 'tmp' 是脚本特有排除(原 .ihui-agent/tmp 扫描场景)
// 2026-09-15 补 'public':public/ 是静态资产目录(web 的 monaco 副本、mobile-cap
// Capacitor 构建回填),非手写脚本;其 minified chunk 里的路径字符串曾被误判为
// "相对路径跳出项目"违规,blocking 全体 commit。
const EXCLUDED_DIRS = withExcludes(['tmp', 'public']);

// ===== 文件级白名单(这些文件可以引用项目外路径作为规则文档) =====
const FILE_WHITELIST = [
  /scripts[\\/]check-workspace-hygiene\.mjs$/, // 守门脚本自身
  /scripts[\\/]check-parent-pollution\.mjs$/,  // 项目父目录巡查守门(自身)
  /scripts[\\/]check-port-registry\.mjs$/,     // 端口守门(可能引用示例)
  /AGENTS\.md$/,                               // 项目规则
  /PROJECT_PLAN\.md$/,                         // 任务计划
  /\.ihui-agent[\\/]archive[\\/]/,               // 归档文档
  /docs[\\/]port-management\.md$/,            // 端口管理文档
  /README(\.[a-z-]+)?\.md$/,                  // README
  /scripts[\\/]g-root-guardian\.ps1$/,         // v3.1: G:\ root 守门脚本(引用黑名单路径合法)
  /scripts[\\/]g-root-blacklist\.json$/,       // v3.1: G:\ root 黑名单配置
  /scripts[\\/]install-g-root-guardian\.ps1$/, // v3.1: 安装脚本(引用 g-root-guardian 路径)
  /scripts[\\/]uninstall-g-root-guardian\.ps1$/, // v3.1: 卸载脚本
  /scripts[\\/]g-root-guardian-status\.ps1$/,  // v3.1: 状态查询脚本
  /apps[\\/]web[\\/]public[\\/]vs[\\/]/,        // v3.2: Monaco Editor 第三方编译产物(writeLog 包含 projectName 字符串,非项目代码)
];

// ===== 违规检测器(分级:blocking 阻塞 / warning 提醒) =====
const VIOLATION_CHECKS = [
  // === BLOCKING:项目外路径写入(核心违规,阻塞 commit) ===
  {
    level: 'blocking',
    name: '项目数据写到系统 temp',
    test: (line) => {
      const patterns = [
        /[A-Za-z]:[\\/]temp[\\/][^"'`\s]*\.(?!log|txt)[a-z0-9]+/i,
        /\$env:TEMP[\\/][^"'`\s]*\.(?!log|txt)[a-z0-9]+/i,
        /\$env:LOCALAPPDATA[\\/]Temp[\\/][^"'`\s]*\.(?!log|txt)[a-z0-9]+/i,
        /[A-Za-z]:[\\/]Users[\\/][^"'`\\]+[\\/]AppData[\\/]Local[\\/]Temp[\\/][^"'`\s]*\.(?!log|txt)[a-z0-9]+/i,
      ];
      return patterns.some(p => p.test(line));
    },
    hint: '项目数据必须放项目内(.ihui-agent/tmp/ 或 apps/*/),不能写系统 temp',
  },
  {
    level: 'blocking',
    name: 'ihui-ext / ihui-prof 项目数据目录名(项目外副本)',
    test: (line) => {
      // 只在项目外路径上下文中检测
      if (!/ihui-ext\d?|ihui-prof\d?/i.test(line)) return false;
      // 排除项目内引用(如 .output/chrome-mv3 的注释)
      if (/apps[\\/]extension|\.output/.test(line)) return false;
      return /C:[\\/]|D:[\\/]temp|\$env:TEMP/i.test(line);
    },
    hint: '用项目内路径 apps/extension/.output/chrome-mv3/ 或 .ihui-agent/tmp/chrome-profile/',
  },
  {
    level: 'blocking',
    name: '相对路径跳出项目(文件写入上下文)',
    test: (line) => {
      if (!/\.\.[\\/]\.\.[\\/]/.test(line)) return false;
      return /Out-File|Set-Content|Copy-Item|New-Item|Remove-Item|Move-Item|WriteAllBytes|WriteAllText|open\(|writeFile/i.test(line);
    },
    hint: '文件写入不能跳出项目根,用项目内相对路径',
  },
  // === WARNING:硬编码中文路径(项目内但会 GBK 乱码,提醒) ===
  {
    level: 'warning',
    name: '硬编码中文绝对路径(GBK 会乱码)',
    test: (line) => {
      const patterns = [
        /['"`][A-Za-z]:[\\/][^'"`]*桌面/,
        /['"`][A-Za-z]:[\\/][^'"`]*项目[\\/]/,
        /['"`][A-Za-z]:[\\/][^'"`]*用户/,
      ];
      return patterns.some(p => p.test(line));
    },
    hint: '用 $PSScriptRoot / __dirname / import.meta.url 推导项目根,不要硬编码中文路径',
  },
];

// ===== 行级白名单 =====
function isLineWhitelisted(line) {
  const trimmed = line.trim();
  // 注释行
  if (trimmed.startsWith('#') || trimmed.startsWith('//')) return true;
  // 包含"禁止/反面/deprecated/forbidden"(规则文档中的反面案例)
  if (/禁止|反面|deprecated|forbidden|不要|不得|禁止使用/i.test(line)) return true;
  // .log / .txt 文件路径
  if (/\.(log|txt)\s*['"`;]/i.test(line)) return true;
  // --redirect 参数(日志重定向)
  if (/--redirect/i.test(line)) return true;
  return false;
}

export function scanContent(relPath, content) {
  // 文件级白名单跳过
  if (FILE_WHITELIST.some(re => re.test(relPath))) return [];

  const violations = [];
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (isLineWhitelisted(line)) return;
    for (const check of VIOLATION_CHECKS) {
      if (check.test(line)) {
        violations.push({
          file: relPath,
          line: idx + 1,
          content: line.trim().slice(0, 120),
          level: check.level,
          name: check.name,
          hint: check.hint,
        });
        break;
      }
    }
  });
  return violations;
}

/** 磁盘适配器:只服务"被审面上不存在"的两类对象 —— .ihui-agent/tmp 的未跟踪脏件与 --root 测试树。 */
function scanFileFromDisk(filePath, root = ROOT) {
  const relPath = relative(root, filePath).replace(/\\/g, '/');
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return { violations: [], unreadable: 1 };
  }
  return { violations: scanContent(relPath, content), unreadable: 0 };
}


/** 旧出口保留(镜像测试在用):磁盘读 + 判据本体。 */
function scanFile(filePath) {
  return scanFileFromDisk(filePath).violations;
}


/** 被审面的 rev 规格:head = HEAD:rel;staged = :rel(索引 blob)。 */
export function faceSpecOf(face, rel) {
  return (face === 'staged' ? ':' : 'HEAD:') + rel;
}


/**
 * 在册件一律按被审面取内容(§0.4 同面同轮:一次 catBatch,绝不逐文件回落磁盘)。
 * 取不到 = 未判定,单列计数,既不记绿也不冒红(§0.3)—— 共享工作树的磁盘副本常年滞后 HEAD,
 * 按磁盘判会把别人没提交的旧态钉成本次的红(本仓记过多次的那一型)。
 */
export function scanSetFromFace(root, face, relPaths) {
  const specs = new Set(relPaths.map((r) => faceSpecOf(face, r)));
  const got = catBatch(root, specs);
  const out = { violations: [], scanned: 0, unreadable: [] };
  for (const r of relPaths) {
    const v = got.get(faceSpecOf(face, r));
    if (v === null || v === undefined) { out.unreadable.push(r); continue; }
    out.scanned++;
    out.violations.push(...scanContent(r, v));
  }
  return out;
}

function scanDir(dir, allFiles = []) {
  if (!existsSync(dir)) return allFiles;
  for (const entry of readdirSync(dir)) {
    // 跳过 .ihui-agent/tmp(单独扫描,因为里面是临时脚本)
    if (dir === ROOT && entry === '.ihui-agent') {
      // 扫描 .ihui-agent/tmp 但跳过 .ihui-agent/archive, .ihui-agent/memory 等
      const tmpSubdir = join(dir, entry, 'tmp');
      if (existsSync(tmpSubdir)) scanDir(tmpSubdir, allFiles);
      continue;
    }
    const full = join(dir, entry);
    let s;
    try { s = statSync(full); } catch { continue; }
    if (s.isDirectory()) {
      // 2026-09-15:walker 须同时检查脚本级 EXCLUDED_DIRS(含 'public'/'tmp'),
      // 仅用 isExcludedDirName(共享集)会漏掉脚本特有排除目录
      if (isExcludedDirName(entry) || EXCLUDED_DIRS.has(entry)) continue;
      scanDir(full, allFiles);
    } else if (SCRIPT_EXTS.has(extname(full).toLowerCase())) {
      allFiles.push(full);
    }
  }
  return allFiles;
}

function getStagedFiles() {
  try {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    const out = gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACM'], ROOT);
    return String(out).split(/\r?\n/).filter(Boolean)
      .filter(f => SCRIPT_EXTS.has(extname(f).toLowerCase()));

  } catch {
    return [];
  }
}

/**
 * 全量档取材面(AGENTS §0.4 同面同轮):版本控制在册文件 ∪ 本仓自己的暂存落点 `.ihui-agent/tmp/`。
 *
 * 为什么不再走磁盘递归:递归会把 `.gitignore` 内**别人工具的缓存**当项目源码扫 —— 实测
 * `.DevEnv/cache/userhome/.codex/**\/browser-service.mjs` 三条恒命中"相对路径跳出项目",
 * 而那些文件由 Codex 每次启动重写,任何会话都无法使其变绿。与提交内容无关的红门唯一结局是
 * 逼人 `--no-verify`、连带废掉全部守门(§12e/§12f)。
 * 射程没有缩小:在册源文件全在面内,§25 的临时脚本落点 `.ihui-agent/tmp/` 仍单独并入。
 */
const FULL_FACE_GIT_ARGS = Object.freeze(['ls-files', '--cached', '-z']);
const TMP_LANDING_DIR = join(ROOT, '.ihui-agent', 'tmp');

function getFullFaceFiles() {
  let raw;
  try {
    raw = gitRaw(FULL_FACE_GIT_ARGS, ROOT);
  } catch (e) {
    return { ok: false, reason: `git ls-files 取不到被审面:${e?.message ?? e}` };
  }
  const tracked = String(raw).split('\0').filter(Boolean)
    .filter(f => SCRIPT_EXTS.has(extname(f).toLowerCase()));
  if (tracked.length === 0) {
    // §0.3:枚举到 0 个候选判死不记绿
    return { ok: false, reason: '在册文件清单枚举结果为 0 个脚本文件(判不出"没有违规",只判"没量到")' };
  }
  return { ok: true, faceFiles: tracked, diskFiles: scanDir(TMP_LANDING_DIR), trackedCount: tracked.length };
}

function main() {
  const args = process.argv.slice(2);
  const isStaged = args.includes('--staged');
  const isWarn = args.includes('--warn');

  // 三面各走各的取材通道:staged = 索引 blob;全量 = HEAD blob;
  // --root 测试树与 .ihui-agent/tmp 的未跟踪脏件 = 磁盘(它们在面路上没有 blob)。
  let faceFiles = [];
  let diskFiles = [];
  let faceKind = 'head';
  if (isStaged) {
    faceFiles = getStagedFiles();
    faceKind = 'staged';
    if (faceFiles.length === 0) {
      log.info('✅ workspace-hygiene: 无 staged 脚本文件,跳过');
      process.exit(0);
    }
  } else if (EXPLICIT_ROOT) {
    diskFiles = scanDir(ROOT);
    faceKind = 'disk(--root 测试通道)';
  } else {
    const got = getFullFaceFiles();
    if (!got.ok) {
      log.error('❌ workspace-hygiene: 未判定(取材失败)—— ' + got.reason);
      process.exit(2);
    }
    faceFiles = got.faceFiles;
    diskFiles = got.diskFiles;
  }


  const faceRes = scanSetFromFace(ROOT, isStaged ? 'staged' : 'head', faceFiles);
  const diskRes = { violations: [], unreadable: 0 };
  for (const f of diskFiles) {
    const r = scanFileFromDisk(f);
    diskRes.violations.push(...r.violations);
    diskRes.unreadable += r.unreadable;
  }
  const allViolations = [...faceRes.violations, ...diskRes.violations];
  const scannedCount = faceRes.scanned + (diskFiles.length - diskRes.unreadable);

  const blockingViolations = allViolations.filter(v => v.level === 'blocking');
  const warningViolations = allViolations.filter(v => v.level === 'warning');

  if (allViolations.length === 0) {
    log.info(`✅ workspace-hygiene: 面=${faceKind} ⊕ 未跟踪磁盘件 ${diskFiles.length} 个;扫描 ${scannedCount} 个文件,无违规` + (faceRes.unreadable.length ? `;另 ${faceRes.unreadable.length} 个在册件在该面取不到内容 ⇒ 该部分未判定,不记绿` : ''));
    process.exit(0);
  }

  // 输出 warning(--quiet 时静默)
  if (warningViolations.length > 0) {
    log.warn(`⚠️  workspace-hygiene [WARNING]: ${warningViolations.length} 处硬编码中文路径(不阻塞,但建议修复)`);
    for (const v of warningViolations.slice(0, 10)) {
      log.warn(`  ${v.file}:${v.line}  [${v.name}]`);
      log.warn(`    > ${v.content}`);
    }
    if (warningViolations.length > 10) {
      log.warn(`  ... 还有 ${warningViolations.length - 10} 处`);
    }
    log.warn('');
  }

  // 输出 blocking(阻塞,除非 --warn;主报告始终输出)
  if (blockingViolations.length > 0) {
    const mode = isWarn ? 'WARN' : 'BLOCK';
    const prefix = isWarn ? '⚠️ ' : '❌ ';
    log.error(`${prefix}workspace-hygiene [${mode}]: ${blockingViolations.length} 处项目外路径违规`);
    log.error('');
    log.error('违反 AGENTS.md §15 项目外路径禁令:');
    log.error('  - 扩展打包用 apps/extension/.output/chrome-mv3/');
    log.error('  - Chrome profile 用 .ihui-agent/tmp/chrome-profile/');
    log.error('  - 临时脚本用 .ihui-agent/tmp/<脚本名>');
    log.error('  - 路径推导用 $PSScriptRoot / import.meta.url(避免 GBK 中文乱码)');
    log.error('');
    for (const v of blockingViolations.slice(0, 30)) {
      log.error(`  ${v.file}:${v.line}  [${v.name}]`);
      log.error(`    > ${v.content}`);
      log.error(`    提示: ${v.hint}`);
    }
    if (blockingViolations.length > 30) {
      log.error(`  ... 还有 ${blockingViolations.length - 30} 处`);
    }
    log.error('');
    log.error('如确需在项目外创建文件(系统日志等),请在脚本中用注释标注"豁免:系统日志"。');
    process.exit(isWarn ? 0 : 1);
  }

  // 只有 warning,无 blocking
  log.info(`⚠️  workspace-hygiene: ${warningViolations.length} 处 warning(不阻塞),0 处 blocking`);
  process.exit(0);
}

// §22d 双形态入口(G-1058651):此前顶层裸调 main(),而 main() 内有 4 处 process.exit ——
// 任何 import 本门的进程都会被当场打死(实测 `await import()` 探针被 SIGTERM 终止、
// 取证文件里没有 #EVIDENCE-RC)。守卫只决定**何时点火**,不改判什么。
// 必须经 pathToFileURL():Windows 下 process.argv[1] 带反斜杠,手拼 'file:///' 永不相等。
const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main();
}

// §22c/§22d(G-239):导出判据单元,使镜像测试可走「调生产入口」通道,不必再把材料抄一遍。
// 只导**判据形式**(扩展名清单 / 排除目录集 / 文件级白名单 / 违规检测器 / 行级白名单 / 单文件裁定函数);
// main()、scanDir、getStagedFiles 不是判据形式,故不导 —— 一旦导出即成为本门的契约面,
// 不得为好看而全导。导入本模块(经 isDirectRun 守卫)不再产生副作用、不再 process.exit。
export const __test__ = {
  scanContent,
  faceSpecOf,
  scanSetFromFace,
  SCRIPT_EXTS,
  EXCLUDED_DIRS,
  FILE_WHITELIST,
  VIOLATION_CHECKS,
  isLineWhitelisted,
  scanFile,
  // 全量档取材面的形状锁(镜像测试据此判"有没有把未入库/被忽略的文件重新扫进面内")
  FULL_FACE_GIT_ARGS,
  TMP_LANDING_DIR,
  getFullFaceFiles,
};
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
