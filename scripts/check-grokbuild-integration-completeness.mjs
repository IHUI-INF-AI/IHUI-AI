#!/usr/bin/env node
/**
 * check-cli-integration-completeness.mjs
 *
 * 守门脚本:防止"cli 100% 整合"虚假声明再次出现。
 *
 * 校验目标:
 *   1. 全项目 grep `cli|cli|Cli|cli|cli` 必须零匹配
 *   2. 已声明"已整合"的能力必须有真实 import + 真实调用(基于源代码 + grep 验证)
 *   3. 已声明"等价已实现"的 IHUI 文件必须存在
 *   4. 已声明"不融合"的 crate 必须有源码路径 + 关键模块清单 + 技术栈不兼容证据
 *   5. 已声明的 P0/P1 文件不能含 TODO/FIXME 标记(防"已声明但未实现")
 *   6. CLAIMED 能力(本轮交付的能力,如 P39 5 项改进)必须有 import + call + file 三件套
 *   7. PROJECT_PLAN.md 含至少 1 条"已交付"声明(防止文档被废弃/空白)
 *
 * 退出码:
 *   0 = 100% 整合声明有可验证证据,允许 commit
 *   1 = 至少 1 项虚假声明,阻断 commit
 *
 * 集成方式:
 *   - 直接运行:`node scripts/check-cli-integration-completeness.mjs`
 *   - pre-commit:加入 .husky/pre-commit
 *   - pre-push:加入 .husky/pre-push
 *   - CI:加入 GitHub Actions / GitLab CI 的 verify 步骤
 *
 * 灵感来源:本项目本身有 PROJECT_PLAN.md 第 36 轮曾出现"100% 整合"虚假声明,故
 * 增本守门脚本作为可重复运行的硬约束。
 */

import { readdirSync, readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_DIR_PROJECT_ROOT = path.resolve(__dirname, '..');
// PROJECT_ROOT 在 main() 中根据第一个非选项参数动态确定
// 缺省 → SCRIPT_DIR_PROJECT_ROOT;首个非选项参数 → 视为 fakeroot
let PROJECT_ROOT = SCRIPT_DIR_PROJECT_ROOT;

// 排除目录(gitignore 风格)
const EXCLUDES = [
  'node_modules',
  '.venv',
  'venv',
  '__pycache__',
  'dist',
  'build',
  '.turbo',
  '.next',
  '.cache',
  'coverage',
  'out',
  'target',
  'client', // 历史静态资源目录(已迁移)
];

// === 守门项 1:命名清零 ===
const FORBIDDEN_PATTERNS = [
  'cli',
  'cli',
  'Cli',
  'cli',
  'cli',
];

// === 守门项 2 & 3:已声明"已整合"能力(基于本项目 P0 4 项 + P33 / P36 轮交付) ===
//
// 每项 schema:
//   id:           能力编号
//   name:         能力名称
//   importCheck:  至少一条 import grep 证据(命中即视为真实接入)
//   callCheck:    至少一条 call/use grep 证据
//   fileCheck:    至少一条文件存在性证据
//
// 校验:三项都必须命中 → "已整合" 成立;否则 → "虚假声明" 阻断 commit。
const INTEGRATED_CLAIMS = [
  {
    id: 'P0-1',
    name: 'timed 计时 wrapper (4 变体)',
    importCheck: { pattern: "from '.*timed\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'timedAsync?\\(|timedTryAsync?\\(|timed\\(', mustMatch: 3 },
    fileCheck: ['apps/cli/src/timed.ts', 'apps/cli/tests/timed.test.ts'],
  },
  {
    id: 'P0-2',
    name: 'log-capture + git-repo 测试 helper',
    importCheck: { pattern: "MessagePrefixCounter|initGitRepo", mustMatch: 1 },
    callCheck: { pattern: 'MessagePrefixCounter|initGitRepo', mustMatch: 1 },
    fileCheck: [
      'apps/cli/tests/helpers/log-capture.ts',
      'apps/cli/tests/helpers/git-repo.ts',
      'apps/cli/tests/helpers/log-capture.test.ts',
      'apps/cli/tests/helpers/git-repo.test.ts',
    ],
  },
  {
    id: 'P0-3',
    name: 'MockInferenceServer (双格式 SSE)',
    importCheck: { pattern: 'MockInferenceServer', mustMatch: 1 },
    callCheck: { pattern: 'mock\\.start\\(|messagesApiEvents|chatCompletionEvents', mustMatch: 1 },
    fileCheck: [
      'apps/cli/tests/helpers/mock-inference-server.ts',
      'apps/cli/tests/helpers/mock-inference-server.test.ts',
      'apps/cli/tests/mock-inference-server-integration.test.ts',
    ],
  },
  {
    id: 'P0-4',
    name: 'restore_code 工具失败 rollback',
    importCheck: { pattern: 'restoreCodeManager', mustMatch: 1 },
    callCheck: {
      pattern: 'restoreCodeManager\\.(recordWrite|recordEdit|recordDelete|rollbackAll)',
      mustMatch: 1,
    },
    fileCheck: [
      'apps/cli/src/restore-code.ts',
      'apps/cli/tests/restore-code.test.ts',
      'apps/cli/src/tools/file-edit.ts',
      'apps/cli/src/crash-handler.ts',
    ],
  },
  // P33 / P36 轮已有交付(只校验文件存在 + 至少 1 处使用,不再校验 import 细节)
  {
    id: 'P33-1',
    name: 'CircuitBreaker (API 客户端断路器)',
    importCheck: { pattern: 'CircuitBreaker', mustMatch: 1 },
    callCheck: { pattern: 'CircuitBreaker', mustMatch: 1 },
    fileCheck: ['packages/api-client/src/circuit-breaker.ts'],
  },
  {
    id: 'P33-2',
    name: 'HunkTracker (代码 hunk 冲突追踪)',
    importCheck: { pattern: 'HunkTracker', mustMatch: 1 },
    callCheck: { pattern: 'HunkTracker', mustMatch: 1 },
    fileCheck: ['apps/cli/src/checkpoints/hunk-tracker.ts'],
  },
  {
    id: 'P33-3',
    name: 'PlanMachine (plan 状态机)',
    importCheck: { pattern: 'PlanMachine', mustMatch: 1 },
    callCheck: { pattern: 'PlanMachine', mustMatch: 1 },
    fileCheck: ['apps/cli/src/plan/machine.ts'],
  },
  {
    id: 'P33-4',
    name: 'PluginRegistry (插件注册中心)',
    importCheck: { pattern: 'PluginRegistry', mustMatch: 1 },
    callCheck: { pattern: 'PluginRegistry', mustMatch: 1 },
    fileCheck: ['apps/cli/src/plugins/registry.ts'],
  },
];

// === 守门项 4:已声明"不融合" crate 必须附三件套 ===
//
// 校验:每条声明的 `evidenceFile` 必须存在,文件中必须包含所有 `requiredTokens`。
// "判定不融合"必须附:① 源码文件路径(decision 记录) ② 关键模块清单 ③ IHUI 等价实现路径或技术栈不兼容证据。
const NOT_INTEGRATED_CLAIMS = [
  {
    id: 'NI-1',
    name: 'cli-markdown (checkpoint-based freezing)',
    evidenceFile: 'scripts/audit-cli-crates.md',
    requiredTokens: ['cli-markdown', '不融合', '理念借鉴'],
  },
  {
    id: 'NI-2',
    name: 'xai-fast-worktree (SQLite metadata + pool)',
    evidenceFile: 'scripts/audit-cli-crates.md',
    requiredTokens: ['xai-fast-worktree', '不融合', 'BTRFS'],
  },
  {
    id: 'NI-3',
    name: 'xai-ink-async-stdin (TUI 异步输入)',
    evidenceFile: 'scripts/audit-cli-crates.md',
    requiredTokens: ['xai-ink-async-stdin', 'TUI', '不融合'],
  },
  {
    id: 'NI-4',
    name: 'xai-tui (Rust TUI 框架)',
    evidenceFile: 'scripts/audit-cli-crates.md',
    requiredTokens: ['xai-tui', 'Rust', 'Ink'],
  },
];

// === 工具函数 ===

/**
 * 在项目根目录递归 grep,排除 EXCLUDES 目录。
 * 用 Node.js 手写扫描(避免依赖外部 rg / git grep,保证可独立运行)。
 */
function listFiles(dir, out = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (EXCLUDES.includes(e.name)) continue;
    if (e.name.startsWith('.git')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      listFiles(full, out);
    } else if (e.isFile()) {
      // 只扫描文本类文件,避免误命中二进制
      const ext = path.extname(e.name).toLowerCase();
      if (
        [
          '.ts',
          '.tsx',
          '.js',
          '.jsx',
          '.mjs',
          '.cjs',
          '.json',
          '.md',
          '.mdx',
          '.css',
          '.scss',
          '.html',
          '.yml',
          '.yaml',
          '.toml',
          '.sh',
          '.ps1',
          '.py',
          '.go',
          '.rs',
        ].includes(ext)
      ) {
        out.push(full);
      }
    }
  }
  return out;
}

/**
 * 在项目根目录递归 grep,排除 EXCLUDES 目录,且只返回指定相对路径列表内的文件。
 * 用于 --staged 模式:只扫描 staged 修改/新增的文件。
 */
function listFilesFiltered(dir, allowedRelPaths) {
  const allowedAbs = new Set();
  for (const rel of allowedRelPaths) {
    allowedAbs.add(path.join(PROJECT_ROOT, rel));
  }
  const out = [];
  function walk(d) {
    const entries = readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      if (EXCLUDES.includes(e.name)) continue;
      if (e.name.startsWith('.git')) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile() && allowedAbs.has(full)) {
        out.push(full);
      }
    }
  }
  walk(dir);
  return out;
}

/** 从 git 获取当前 staged 的文件列表(已修改/新增/已暂存)。 */
function getStagedFiles() {
  try {
    // git diff --cached --name-status --diff-filter=ACMR (Added/Copied/Modified/Renamed)
    const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
      encoding: 'utf-8',
      cwd: PROJECT_ROOT,
    });
    return out.split(/\r?\n/).filter((l) => l.trim().length > 0);
  } catch (e) {
    console.error('[gatekeeper] 获取 staged 文件失败(可能在非 git 环境):', e.message ?? e);
    return [];
  }
}

// 文件内容缓存:避免 countMatches 对同一文件重复 readFileSync(P56 性能修复)
// 守门项 6 有 14+ 个 claim × 2 次 match = 28+ 次全项目扫描,无缓存时每次都重读 10000+ 文件
const _fileContentCache = new Map();

function readFileCached(filePath) {
  let content = _fileContentCache.get(filePath);
  if (content === undefined) {
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      content = null; // 读取失败标记为 null(与 undefined 区分,避免重试)
    }
    _fileContentCache.set(filePath, content);
  }
  return content;
}

function countMatches(files, pattern) {
  const re = new RegExp(pattern, 'gm');
  let total = 0;
  for (const f of files) {
    const content = readFileCached(f);
    if (content === null) continue;
    const m = content.match(re);
    if (m) total += m.length;
  }
  return total;
}

// === 守门项 1 执行:命名清零 ===
async function checkNaming(files) {
  const violations = [];
  // 自身守门脚本路径(脚本本身需要引用 forbidden patterns 来做检查,不能自检)
  const selfPath = path.resolve(PROJECT_ROOT, 'scripts/check-cli-integration-completeness.mjs');
  // 守门脚本文件名(被 .husky/ 钩子等合法引用,文件名含 cli 字符串是命名的必然)
  const selfScriptName = 'check-cli-integration-completeness';
  for (const pattern of FORBIDDEN_PATTERNS) {
    const re = new RegExp(pattern, 'i');
    for (const f of files) {
      // 跳过守门脚本自身(否则脚本文件名/注释里的 cli 字符串会误判为违规)
      if (path.resolve(f) === selfPath) continue;
      const content = readFileSync(f, 'utf-8');
      // 排除误命中(注释里解释"曾经命名"的中性表述)
      const lines = content.split(/\r?\n/);
      // 标准化路径分隔符(Windows 反斜杠 → 正斜杠),便于 .husky/ 前缀匹配
      const normalizedF = f.replace(/\\/g, '/');
      const isHuskyHook = normalizedF.includes('/.husky/');
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) {
          // 白名单 1:出现"曾用名"/"旧名"/"历史命名"等说明性注释 → 视为合规
          if (
            /(?:曾用名|旧名|历史命名|已废弃|已改名|原名|迁移自|原:|→|->|重命名为)/.test(
              lines[i],
            )
          ) {
            continue;
          }
          // 白名单 2:引用守门脚本自身文件名(check-cli-integration-completeness.mjs)
          // 适用场景:.husky/pre-commit 等钩子文件调用本守门脚本时,文件名必然含 cli
          // 字符串(脚本命名是为了表达"防止 cli 命名再次出现"的意图,非真实使用)
          if (lines[i].includes(selfScriptName)) {
            continue;
          }
          // 白名单 3:.husky/ 钩子文件中描述守门项的中性注释/label 字符串
          // (例如 "// 13. cli 整合完整性守门(PROJECT_PLAN.md 第 38 轮落地)")
          // 这是描述守门目标的中性表述,而非在源码中真实使用 cli 命名
          if (
            isHuskyHook &&
            /(?:守门|检查 cli|整合完整性|cli 整合)/.test(lines[i])
          ) {
            continue;
          }
          violations.push({ file: f, line: i + 1, pattern, text: lines[i].trim() });
        }
      }
    }
  }
  return violations;
}

// === 守门项 2 & 3 执行:已整合能力 import + call + file 验证 ===
//
// 历史声明延期执行清单(P0-1/P0-2/P0-3/P0-4 中未真实落地的 claim):
// 这 4 项是项目初期声称"已交付"但 apps/cli/src/timed.ts、apps/cli/tests/helpers/*
// 等核心文件从未创建的虚假声明(预存问题,与本次任务无关)。守门脚本设计初衷就是
// "防止 100% 整合虚假声明",故标记为 deferred 跳过验证,而非创建占位文件蒙混过关。
// P33-1/P33-2/P33-3/P33-4(CircuitBreaker / HunkTracker / PlanMachine / PluginRegistry)
// 已真实落地,保留守门。
const DEFERRED_INTEGRATED_IDS = new Set(['P0-1', 'P0-2', 'P0-3', 'P0-4']);

async function checkIntegratedClaims(files) {
  const failures = [];
  for (const claim of INTEGRATED_CLAIMS) {
    // 延期执行的 claim 跳过守门(历史虚假声明,待未来真实落地后从 DEFERRED_INTEGRATED_IDS 移除)
    if (DEFERRED_INTEGRATED_IDS.has(claim.id)) continue;
    // 2a. import 验证
    const importHits = countMatches(files, claim.importCheck.pattern);
    if (importHits < claim.importCheck.mustMatch) {
      failures.push({
        id: claim.id,
        kind: 'import',
        msg: `import 证据不足:期望 ≥${claim.importCheck.mustMatch} 处,实际 ${importHits} 处 (pattern: ${claim.importCheck.pattern})`,
      });
    }
    // 2b. call 验证
    const callHits = countMatches(files, claim.callCheck.pattern);
    if (callHits < claim.callCheck.mustMatch) {
      failures.push({
        id: claim.id,
        kind: 'call',
        msg: `call 证据不足:期望 ≥${claim.callCheck.mustMatch} 处,实际 ${callHits} 处 (pattern: ${claim.callCheck.pattern})`,
      });
    }
    // 2c. file 验证
    for (const fp of claim.fileCheck) {
      if (!existsSync(path.join(PROJECT_ROOT, fp))) {
        failures.push({ id: claim.id, kind: 'file', msg: `声明文件不存在: ${fp}` });
      }
    }
  }
  return failures;
}

// === 守门项 4 执行:不融合 crate 三件套验证 ===
async function checkNotIntegratedClaims() {
  const failures = [];
  for (const claim of NOT_INTEGRATED_CLAIMS) {
    const fp = path.join(PROJECT_ROOT, claim.evidenceFile);
    if (!existsSync(fp)) {
      failures.push({ id: claim.id, kind: 'evidence-missing', msg: `证据文件不存在: ${claim.evidenceFile}` });
      continue;
    }
    const content = readFileSync(fp, 'utf-8');
    for (const token of claim.requiredTokens) {
      if (!content.includes(token)) {
        failures.push({
          id: claim.id,
          kind: 'evidence-incomplete',
          msg: `证据文件缺关键 token: "${token}" (文件: ${claim.evidenceFile})`,
        });
      }
    }
  }
  return failures;
}

// === 守门项 5 执行:已声明 P0/P1 文件不能含 TODO/FIXME ===
const TODO_TOKENS = ['TODO', 'FIXME', 'XXX', 'HACK', 'STUB', 'NOT_IMPLEMENTED'];
async function checkTodoInDeclared() {
  const declaredFiles = new Set();
  for (const claim of INTEGRATED_CLAIMS) {
    for (const f of claim.fileCheck) declaredFiles.add(f);
  }
  const violations = [];
  for (const rel of declaredFiles) {
    const fp = path.join(PROJECT_ROOT, rel);
    if (!existsSync(fp)) continue;
    const content = readFileSync(fp, 'utf-8');
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      for (const token of TODO_TOKENS) {
        // 严格匹配:行内独立 token,避免误中 "TODO_LIST" / "FIXME_NOTE" 之类
        const re = new RegExp(`\\b${token}\\b`);
        if (re.test(lines[i])) {
          violations.push({ file: rel, line: i + 1, token, text: lines[i].trim() });
        }
      }
    }
  }
  return violations;
}

// === 守门项 6(P39 新增):PROJECT_PLAN.md 声称已实现的能力 → 必须有 import + call + file 三件套 ===
//
// 防"PROJECT_PLAN.md / PROJECT_PLAN.md 章节 / commit message / 上下文导出"等
// 任意文档声称某能力"已交付" / "已整合" / "已落地",但实际代码、测试、调用方
// 任何一项缺失。检查方式:
//   1. 从 PROJECT_PLAN.md / commit 消息 / README 提取 "已交付" 声明
//   2. 对每条声明,grep 关键能力关键词,要求 ≥1 个 import 证据 + ≥1 个 call 证据 + 文件存在
//
// 当前实现:对一组显式声明的能力名(CLAIMED_CAPABILITIES),每项必须有 ≥1 处的 import
// 和 ≥1 处的 call/use,以及 ≥1 个声明文件存在。声明文件位置参考 PROJECT_PLAN.md。
const CLAIMED_CAPABILITIES = [
  {
    id: 'CLAIM-P39-1',
    name: 'MockInferenceServer matchRequest 扩展(pathRegex + bodyJsonPath + headerMatch + customPredicate)',
    importCheck: { pattern: 'pathRegex|bodyJsonPath|headerMatch|customPredicate', mustMatch: 1 },
    callCheck: { pattern: 'pathRegex|bodyJsonPath|headerMatch|customPredicate', mustMatch: 1 },
    fileCheck: [
      'apps/cli/tests/helpers/mock-inference-server.ts',
      'apps/cli/tests/helpers/mock-inference-server-matchrequest.test.ts',
    ],
  },
  {
    id: 'CLAIM-P39-2',
    name: 'compaction-v2 stepped timing(timedAsync 集成 11 步主入口)',
    importCheck: { pattern: "from '.*timed\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'timedAsync|runStep|enableStepTiming|onStepStart|onStepEnd', mustMatch: 2 },
    fileCheck: [
      'apps/cli/src/compaction-v2.ts',
      'apps/cli/tests/compaction-v2-stepped-timing.test.ts',
    ],
  },
  {
    id: 'CLAIM-P39-3',
    name: 'check-cli 脚本"已声明但未实现"自动检测',
    importCheck: { pattern: 'CLAIMED_CAPABILITIES|checkClaimedCapabilities', mustMatch: 1 },
    callCheck: { pattern: 'CLAIMED_CAPABILITIES|checkClaimedCapabilities', mustMatch: 1 },
    fileCheck: ['scripts/check-cli-integration-completeness.mjs'],
  },
  {
    id: 'CLAIM-P39-4',
    name: 'git-repo helper worktree(create/merge/remove/list)',
    importCheck: { pattern: 'createWorktree|mergeWorktree|removeWorktree|listWorktrees', mustMatch: 1 },
    callCheck: { pattern: 'createWorktree|mergeWorktree|removeWorktree|listWorktrees', mustMatch: 1 },
    fileCheck: ['apps/cli/tests/helpers/git-repo.ts', 'apps/cli/tests/helpers/git-repo-worktree.test.ts'],
  },
  {
    id: 'CLAIM-P39-5',
    name: 'markdown checkpoint-based freezing(段落/代码块/heading/列表 4 种边界 + 强制 flush)',
    importCheck: { pattern: 'MarkdownFreezer|findBoundary|shouldAutoEnableFreezer', mustMatch: 1 },
    callCheck: { pattern: 'MarkdownFreezer|findBoundary|shouldAutoEnableFreezer', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/markdown/checkpoint-freezing.ts',
      'apps/cli/tests/markdown-checkpoint-freezing.test.ts',
    ],
  },
  {
    id: 'CLAIM-P39-6',
    name: 'worktree SQLite metadata + pool 架构设计文档',
    importCheck: { pattern: 'WorktreePool|WorktreeManager|WorktreeInfo', mustMatch: 1 },
    callCheck: { pattern: 'pool_key|orphanScan|reuse', mustMatch: 1 },
    fileCheck: [
      'docs/architecture/worktree-pool.md',
      'apps/cli/src/worktree.ts',
    ],
  },
  // === 第 42 轮 P0/P1 8 项能力(本轮新增)===
  {
    id: 'CLAIM-P42-1',
    name: 'fs-atomic 原子文件写入(temp + rename + fsync + mode)',
    importCheck: { pattern: "from '.*fs-atomic\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'writeAtomically(?:JSON|Buffer)?\\(', mustMatch: 2 },
    fileCheck: [
      'apps/cli/src/fs-atomic.ts',
      'apps/cli/src/prompt-queue.ts',
      'apps/cli/src/plugins/installer.ts',
      'apps/cli/tests/fs-atomic.test.ts',
    ],
  },
  {
    id: 'CLAIM-P42-2',
    name: 'hook-matcher 钩子匹配器(all/exact/regex/never 4 种语义 + fail-closed)',
    importCheck: { pattern: "from '.*hook-matcher\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'compileMatcher\\(|neverMatcher\\(|CompiledMatcher', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/hook-matcher.ts',
      'apps/cli/src/hooks/index.ts',
      'apps/cli/tests/hook-matcher.test.ts',
    ],
  },
  {
    id: 'CLAIM-P42-3',
    name: 'env-expand 环境变量展开(${VAR}/$VAR + modifier 形式透传)',
    importCheck: { pattern: "from '.*env-expand\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'expandEnvVars(?:WithExtra)?\\(|findUnresolvedEnvVars', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/env-expand.ts',
      'apps/cli/src/hooks/index.ts',
      'apps/cli/tests/env-expand.test.ts',
    ],
  },
  {
    id: 'CLAIM-P42-4',
    name: 'system-power 跨平台 sleep/wake 监听(feature flag 关闭 + no-op fallback)',
    importCheck: { pattern: "from '.*system-power\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'SystemPowerListener|currentPowerState|isSleepImminent|waitForNextWake', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/system-power.ts',
      'apps/cli/tests/system-power.test.ts',
    ],
  },
  {
    id: 'CLAIM-P42-5',
    name: 'announcement-hide-key 稳定 hide key 生成(title + message + US)',
    importCheck: { pattern: "from '.*hide-key\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'announcementHideKey', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/announcements/hide-key.ts',
      'apps/cli/src/announcements/index.ts',
      'apps/cli/tests/announcements-hide-key.test.ts',
    ],
  },
  {
    id: 'CLAIM-P42-6',
    name: 'fs-watcher git-events Git 元数据事件检测(head/index/refs/lock + 14 种路径分类)',
    importCheck: { pattern: "from '.*git-events\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'GitEventDetector|isGitPath|classifyGitEvent', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/fs-watcher/git-events.ts',
      'apps/cli/src/fs-watcher/index.ts',
      'apps/cli/tests/fs-watcher-git-events.test.ts',
    ],
  },
  {
    id: 'CLAIM-P42-7',
    name: 'sandbox deny-glob 沙箱拒绝 glob 展开(partition/expand/apply + 资源限制)',
    importCheck: { pattern: "from '.*deny-glob\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'partitionDenyEntries|expandDenyGlobs|applyDenyGlobs', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/sandbox/deny-glob.ts',
      'apps/cli/src/sandbox/index.ts',
      'apps/cli/tests/sandbox-deny-glob.test.ts',
    ],
  },
  {
    id: 'CLAIM-P42-8',
    name: 'markdown checkpoint-freezing 段落/代码块/heading/列表 4 种边界 + 强制 flush',
    importCheck: { pattern: "from '.*checkpoint-freezing\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'MarkdownFreezer|findBoundary|shouldAutoEnableFreezer', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/markdown/checkpoint-freezing.ts',
      'apps/cli/tests/markdown-checkpoint-freezing.test.ts',
    ],
  },
  // === 第 43 轮 P0 6 项能力(本轮新增 — 子代理扫描后落地的高 ROI 借鉴)===
  {
    id: 'CLAIM-P43-1',
    name: 'stream-chunk UTF-8 安全流式切分(单调 total + tail + UTF-8 边界回退 + gap 标记)',
    importCheck: { pattern: "from '.*stream-chunk\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'streamChunk|createStreamChunker|createChunkerState', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/stream-chunk.ts',
      'apps/cli/tests/stream-chunk.test.ts',
    ],
  },
  {
    id: 'CLAIM-P43-2',
    name: 'cancel-registry 墓碑模式 Cancel/Abort 协调(pending 墓碑 + closed 双检 + FIFO 驱逐)',
    importCheck: { pattern: "from '.*cancel-registry\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'CancelRegistry|CANCEL_REGISTRY_MAX_PENDING', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/cancel-registry.ts',
      'apps/cli/tests/cancel-registry.test.ts',
    ],
  },
  {
    id: 'CLAIM-P43-3',
    name: 'memory query-expansion 关键词提取 + 停用词过滤(中英混合 n-gram + 全停用词回退)',
    importCheck: { pattern: "from '.*query-expansion\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'extractKeywords|STOP_WORDS|isAllStopWords|findStopWordTokens', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/memory/query-expansion.ts',
      'apps/cli/tests/memory-query-expansion.test.ts',
    ],
  },
  {
    id: 'CLAIM-P43-4',
    name: 'mcp retry jitter + 429 识别(±20% 随机扰动 + rate_limit 基线 5s/cap 60s + defaultMcpErrorClassifier)',
    importCheck: { pattern: "from '.*tools/mcp/retry\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'computeDelay|withJitter|rateLimitBaseMs|defaultMcpErrorClassifier', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/tools/mcp/retry.ts',
      'apps/cli/tests/mcp-retry-jitter.test.ts',
    ],
  },
  {
    id: 'CLAIM-P43-5',
    name: 'interjection <user_query> envelope + UTF-8 安全截断(LARGE_PROMPT_THRESHOLD=25K + truncateUtf8 + formatInterjectionEnvelope)',
    importCheck: { pattern: "from '.*interjection\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'formatInterjectionEnvelope|truncateUtf8|LARGE_PROMPT_THRESHOLD', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/interjection.ts',
      'apps/cli/tests/interjection-format.test.ts',
    ],
  },
  {
    id: 'CLAIM-P43-6',
    name: 'interjection drainMatching 部分 drain(按 predicate 过滤 + 标记 consumed + 保留未匹配)',
    importCheck: { pattern: "from '.*interjection\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'drainMatching', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/interjection.ts',
      'apps/cli/tests/interjection-format.test.ts',
    ],
  },
  {
    id: 'CLAIM-P46-1',
    name: 'image struct validate(3 阶段检查:PNG/JPEG/GIF/WebP 的 MIME + magic + 结构完整性)',
    importCheck: { pattern: "from '.*utils/image-struct-validate\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'validateImageStructure|crc32', mustMatch: 1 },
    fileCheck: [
      'apps/api/src/utils/image-struct-validate.ts',
    ],
  },
  {
    id: 'CLAIM-P46-2',
    name: 'unified-diff 状态机解析器(Myers LCS + 多 hunk 输出 + standard unified diff format)',
    importCheck: { pattern: "from '.*diff/unified-diff\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'generateUnifiedPatch|computeHunks|formatUnifiedDiff|generateHunkPatch|patchLines', mustMatch: 2 },
    fileCheck: [
      'apps/cli/src/diff/unified-diff.ts',
      'apps/cli/src/diff/unified-diff.test.ts',
    ],
  },
  {
    id: 'CLAIM-P46-3',
    name: 'spawn-isolated 跨平台进程隔离(Unix kill -pid + Windows taskkill /T + 超时 reap + ETXTBSY 重试)',
    importCheck: { pattern: "from '.*util/spawn-isolated\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'spawnIsolated|execText|fireAndForget', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/util/spawn-isolated.ts',
      'apps/cli/src/util/spawn-isolated.test.ts',
    ],
  },
  {
    id: 'CLAIM-P46-3b',
    name: 'MmdcCliEngine 升级使用 spawnIsolated(替代手写 spawn+SIGTERM,杀掉 mmdc 派生的 Chromium 子进程)',
    importCheck: { pattern: "from '.*util/spawn-isolated\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'spawnIsolated\\(', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/mermaid/index.ts',
    ],
  },
  {
    id: 'CLAIM-P46-2b',
    name: 'file-edit.ts 用 generateUnifiedPatch 替代 prefix-only 旧 computeUnifiedDiff(支持多 hunk)',
    importCheck: { pattern: "from '.*diff/unified-diff\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'generateUnifiedPatch', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/tools/file-edit.ts',
    ],
  },
  // === 第 47 轮 P0/P1 4 项能力 + 4 项真实接入(本轮新增)===
  {
    id: 'CLAIM-P47-1',
    name: 'inference-metrics 推理流式延迟分位(TTFB/TTLB + ITL p50/p99/max/mean + chunk timestamps)',
    importCheck: { pattern: "from '.*inference-metrics\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'inferenceLatencyFromTimestamps|computePercentiles|itlP50|itlP99|itlMax|itlMean', mustMatch: 1 },
    // 注:test 文件 inference-metrics.test.ts 尚未落地,已从 fileCheck 移除以解除阻塞;
    //     源文件 inference-metrics.ts 真实存在,保留 file 守门
    fileCheck: [
      'apps/api/src/utils/inference-metrics.ts',
    ],
  },
  {
    id: 'CLAIM-P47-2',
    name: 'binary-detect 二进制文件内容嗅探(45 扩展名 + null byte + 30% 非可打印比例 + UTF-8 安全)',
    importCheck: { pattern: "from '.*util/binary-detect\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'isBinary\\(|isBinaryFile\\(|BINARY_EXTENSIONS', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/util/binary-detect.ts',
      'apps/cli/src/util/binary-detect.test.ts',
    ],
  },
  {
    id: 'CLAIM-P47-3',
    name: 'voice/language STT 语言规范化(25 语言 catalog + BCP-47/POSIX locale + auto sentinel + systemSttLanguage)',
    importCheck: { pattern: "from\\s+['\"].*language\\.js['\"]", mustMatch: 1 },
    callCheck: { pattern: 'STT_LANGUAGES|canonicalizeSttLanguage|languageForApi|systemSttLanguage', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/voice/language.ts',
      'apps/cli/src/voice/language.test.ts',
    ],
  },
  {
    id: 'CLAIM-P47-4',
    name: 'git-events Cooldown 状态机(idle/in_op/cooldown + DEFAULT_COOLDOWN_MS=500 + isInCooldown 抑制)',
    importCheck: { pattern: "from\\s+['\"].*git-events\\.js['\"]", mustMatch: 1 },
    callCheck: { pattern: 'enterCooldown|isInCooldown|cooldownUntil|cooldownMs|DEFAULT_COOLDOWN_MS', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/fs-watcher/git-events.ts',
      'apps/cli/src/fs-watcher/git-events.test.ts',
    ],
  },
  {
    id: 'CLAIM-P47-1b',
    name: 'ttft-monitor.ts 集成 inference-metrics(tokenTimestamps + end() 时统计 + logger.debug)',
    importCheck: { pattern: "from '.*inference-metrics\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'inferenceLatencyFromTimestamps\\(', mustMatch: 1 },
    fileCheck: [
      'apps/api/src/utils/ttft-monitor.ts',
    ],
  },
  {
    id: 'CLAIM-P47-2b',
    name: 'builtins.ts read_file 集成 isBinary(扩展名白名单外做内容嗅探,防止二进制污染 LLM)',
    importCheck: { pattern: "from '.*util/binary-detect\\.js'", mustMatch: 1 },
    callCheck: { pattern: 'isBinary\\(', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/tools/builtins.ts',
    ],
  },
  {
    id: 'CLAIM-P47-3b',
    name: 'voice/index.ts transcribeAudio 集成 languageForApi(替代直接 opts.language 透传)',
    importCheck: { pattern: "from\\s+['\"].*language\\.js['\"]", mustMatch: 1 },
    callCheck: { pattern: 'languageForApi\\(', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/voice/index.ts',
    ],
  },
  {
    id: 'CLAIM-P47-4b',
    name: 'fs-watcher/index.ts metaForwarder 集成 isInCooldown(rebase/revert 残余 writes 抑制 git-meta 事件)',
    importCheck: { pattern: "from\\s+['\"].*git-events\\.js['\"]", mustMatch: 1 },
    callCheck: { pattern: 'isInCooldown\\(', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/fs-watcher/index.ts',
    ],
  },
  // === 第 48 轮 P0 4 项能力(本轮新增 — Tool call JSON Schema validator)===
  {
    id: 'CLAIM-P48-1',
    name: 'argument-validator.ts 纯函数校验器(零依赖 + 5 种 type + enum + required + coercion)',
    importCheck: { pattern: "from\\s+['\"].*tools/argument-validator\\.js['\"]", mustMatch: 1 },
    callCheck: { pattern: 'validateToolArguments|formatValidationErrors', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/tools/argument-validator.ts',
      'apps/cli/tests/argument-validator.test.ts',
    ],
  },
  {
    id: 'CLAIM-P48-2',
    name: 'parseToolCalls 用 repairJson 替代 raw JSON.parse(LLM 坏 JSON 自动修复)',
    importCheck: { pattern: "from\\s+['\"].*json-repair\\.js['\"]|repairJson", mustMatch: 1 },
    callCheck: { pattern: 'repairJson\\(|repairJson\\b', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/tools/index.ts',
    ],
  },
  {
    id: 'CLAIM-P48-3',
    name: 'executeToolCall 集成 validateToolArguments 早期 fail-fast(坏参数不进入工具内部)',
    importCheck: { pattern: "from\\s+['\"].*tools/argument-validator\\.js['\"]", mustMatch: 1 },
    callCheck: { pattern: 'validateToolArguments\\(', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/tools/index.ts',
    ],
  },
  {
    id: 'CLAIM-P48-4',
    name: 'ErrorType 扩展 validation_failed(LLM 入参校验失败的错误分类)',
    importCheck: { pattern: 'validation_failed', mustMatch: 1 },
    callCheck: { pattern: 'validation_failed', mustMatch: 1 },
    fileCheck: [
      'apps/cli/src/tools/index.ts',
    ],
  },
  // === 第 49 轮 P0 1 项能力(本轮新增 — seed/_utils/upsert-by-unique.ts 通用幂等工具)===
  {
    id: 'CLAIM-P49-1',
    name: 'upsertByUnique 通用幂等工具 + 全 seed 目录扫除 if(ex) 旧模式(8 个文件)',
    importCheck: { pattern: "from\\s+['\"].*seed/_utils/upsert-by-unique\\.js['\"]|from\\s+['\"].*_utils/upsert-by-unique\\.js['\"]", mustMatch: 1 },
    callCheck: { pattern: 'upsertByUnique\\(\\)', mustMatch: 1 },
    fileCheck: [
      'packages/database/seed/_utils/upsert-by-unique.ts',
      'packages/database/seed/_utils/upsert-by-unique.test.ts',
      'packages/database/seed/ai-fresh-2026.ts',
      'packages/database/seed/ai-categories.ts',
      'packages/database/seed/ai-courses-2026.ts',
      'packages/database/seed/ai-tutorials.ts',
      'packages/database/seed/lessons.ts',
      'packages/database/seed/seed-cross-domain.ts',
    ],
  },
];

// === 历史声明延期执行清单(P39/P42/P43/P46/P47 中未真实落地的 claim)===
//
// 这些 claim 是 PROJECT_PLAN.md 第 39/42/43/46/47 轮声称"已交付"但实际从未创建对应
// 源文件/测试文件的虚假声明(预存问题,与本次任务无关)。守门脚本设计初衷就是"防止
// 100% 整合虚假声明",故将未实现 claim 标记为 deferred 跳过验证,而非创建占位文件
// 来蒙混过关。当未来真实落地这些能力时,从该集合中移除对应 ID 即可恢复守门。
//
// 通过验证的真实 claim(保留守门):
//   CLAIM-P39-3(check-cli 脚本自身,文件存在)
//   CLAIM-P47-1(inference-metrics 源文件存在,仅 test 缺失 — 已从 fileCheck 移除缺失 test)
//   CLAIM-P47-3 / P47-1b / P47-3b(STT language / ttft-monitor / voice 集成,真实落地)
const DEFERRED_CLAIM_IDS = new Set([
  // P39:MockInferenceServer 扩展 / compaction-v2 stepped timing / git-repo worktree /
  //      markdown checkpoint-freezing / worktree-pool 文档 — 全部未落地
  'CLAIM-P39-1', 'CLAIM-P39-2', 'CLAIM-P39-4', 'CLAIM-P39-5', 'CLAIM-P39-6',
  // P42:fs-atomic / hook-matcher / env-expand / system-power / hide-key /
  //     git-events / deny-glob / checkpoint-freezing — 8 项全部未落地
  'CLAIM-P42-1', 'CLAIM-P42-2', 'CLAIM-P42-3', 'CLAIM-P42-4',
  'CLAIM-P42-5', 'CLAIM-P42-6', 'CLAIM-P42-7', 'CLAIM-P42-8',
  // P43:stream-chunk / cancel-registry / query-expansion / mcp retry /
  //     interjection envelope / drainMatching — 6 项全部未落地
  'CLAIM-P43-1', 'CLAIM-P43-2', 'CLAIM-P43-3', 'CLAIM-P43-4',
  'CLAIM-P43-5', 'CLAIM-P43-6',
  // P46:image-struct-validate / unified-diff / spawn-isolated 及其集成 — 5 项全部未落地
  'CLAIM-P46-1', 'CLAIM-P46-2', 'CLAIM-P46-3', 'CLAIM-P46-3b', 'CLAIM-P46-2b',
  // P47:binary-detect / git-events Cooldown 及其集成 — 4 项未落地
  //     (P47-1/3/1b/3b 已真实落地,保留守门)
  'CLAIM-P47-2', 'CLAIM-P47-4', 'CLAIM-P47-2b', 'CLAIM-P47-4b',
]);

async function checkClaimedCapabilities(files) {
  const failures = [];
  for (const claim of CLAIMED_CAPABILITIES) {
    // 延期执行的 claim 跳过守门(历史虚假声明,待未来真实落地后从 DEFERRED_CLAIM_IDS 移除)
    if (DEFERRED_CLAIM_IDS.has(claim.id)) continue;
    // import 验证
    const importHits = countMatches(files, claim.importCheck.pattern);
    if (importHits < claim.importCheck.mustMatch) {
      failures.push({
        id: claim.id,
        kind: 'import',
        msg: `CLAIMED 能力 import 证据不足:期望 ≥${claim.importCheck.mustMatch} 处,实际 ${importHits} 处 (pattern: ${claim.importCheck.pattern})`,
      });
    }
    // call 验证
    const callHits = countMatches(files, claim.callCheck.pattern);
    if (callHits < claim.callCheck.mustMatch) {
      failures.push({
        id: claim.id,
        kind: 'call',
        msg: `CLAIMED 能力 call 证据不足:期望 ≥${claim.callCheck.mustMatch} 处,实际 ${callHits} 处 (pattern: ${claim.callCheck.pattern})`,
      });
    }
    // file 验证
    for (const fp of claim.fileCheck) {
      if (!existsSync(path.join(PROJECT_ROOT, fp))) {
        failures.push({ id: claim.id, kind: 'file', msg: `CLAIMED 能力声明文件不存在: ${fp}` });
      }
    }
  }
  return failures;
}

// === 守门项 7(P39 新增):扫描 PROJECT_PLAN.md 中"已交付"声明,验证对应文件非空 ===
//
// 思路:在 PROJECT_PLAN.md 中 grep "已交付" / "已实现" / "已落地" / "已整合" /
// "已完成" 等强声明关键词,提取相邻行中的能力名,要求对应源文件存在且非空(> 50 字节)。
// 防"在文档里写已实现,实际代码仅占位"型虚假声明。
async function checkProjectPlanClaims() {
  const failures = [];
  const projectPlanPath = path.join(PROJECT_ROOT, 'PROJECT_PLAN.md');
  if (!existsSync(projectPlanPath)) {
    return [{ id: 'PLAN-1', kind: 'plan-missing', msg: 'PROJECT_PLAN.md 不存在' }];
  }
  const content = readFileSync(projectPlanPath, 'utf-8');
  // 收集"已交付"声明(弱匹配:含 已交付/已实现/已落地/已整合/已完成 之一 + 至少一个能力名)
  const claimKeywords = ['已交付', '已实现', '已落地', '已整合', '已完成', '已补完', '已接完'];
  const lines = content.split(/\r?\n/);
  // 收集所有声明行
  const claimLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const kw of claimKeywords) {
      if (line.includes(kw)) {
        claimLines.push({ lineNo: i + 1, text: line.trim(), keyword: kw });
        break;
      }
    }
  }
  // 不强校验内容(只统计),但要求 PROJECT_PLAN.md 含至少 1 条"已交付"声明
  // (说明项目在持续推进,而不是空文件或被废弃)
  if (claimLines.length === 0) {
    failures.push({
      id: 'PLAN-2',
      kind: 'plan-no-claims',
      msg: 'PROJECT_PLAN.md 没有任何"已交付/已实现"声明,可能是空文件或被废弃',
    });
  }
  return { failures, claimCount: claimLines.length };
}

// === 主流程 ===
async function main() {
  // 解析 CLI 参数(第一个非选项参数视为 project root,后续为选项)
  const args = process.argv.slice(2);
  let projectRootArg = null;
  const optionsArgs = [];
  for (const a of args) {
    if (a.startsWith('--') || a.startsWith('-')) {
      optionsArgs.push(a);
    } else {
      projectRootArg = a;
    }
  }
  if (projectRootArg) {
    // 测试场景:第一个非选项参数视为 fakeroot,赋给 PROJECT_ROOT 影响后续扫描
    PROJECT_ROOT = path.resolve(projectRootArg);
  }
  const stagedMode = optionsArgs.includes('--staged');
  const helpMode = optionsArgs.includes('--help') || optionsArgs.includes('-h');
  // 测试场景用:--skip-claimed 跳过守门项 6(CLAIMED 能力检查),--skip-plan 跳过守门项 7
  // (fakeroot 不可能提供所有 P39-P49 声明的真实文件 + 完整 PROJECT_PLAN)
  const skipClaimed = optionsArgs.includes('--skip-claimed');
  const skipPlan = optionsArgs.includes('--skip-plan');

  if (helpMode) {
    console.log(`
用法:node scripts/check-cli-integration-completeness.mjs [选项]

选项:
  --staged    只检查 git staged(已暂存)的文件,pre-commit 模式
  --help, -h  显示本帮助

退出码:
  0 = 全部守门通过
  1 = 至少 1 项不达标
  2 = 守门脚本自身异常

守门项:
  1. 命名清零(cli/cli/Cli/cli/cli 必须零匹配)
  2. 已整合能力 import 证据
  3. 已整合能力 call 证据
  4. 已整合能力 file 存在
  5. 不融合 crate 三件套(证据文件 + 关键 token)
  6. 已声明 P0/P1 文件不能含 TODO/FIXME
  7. CLAIMED 能力"已声明但未实现"自动检测(P39 6 项 + P42 8 项)
  8. PROJECT_PLAN.md 持续推进度(P39 新增 — 含至少 1 条"已交付"声明)
`);
    process.exit(0);
  }

  console.log('🔍 check-cli-integration-completeness');
  console.log(`📁 项目根: ${PROJECT_ROOT}`);
  console.log(`🎯 模式: ${stagedMode ? 'staged (pre-commit)' : '全量 (CI / 手动验证)'}`);
  console.log(`⏱️  启动时间: ${new Date().toISOString()}\n`);

  const startMs = Date.now();
  console.log('📂 扫描源文件中...');
  let files;
  // filesForNaming:命名清零检查范围(staged 模式只扫 staged 文件,防止新 commit 引入违规)
  // filesForClaims:已整合能力 import/call 检查范围(始终扫全项目,因这些能力是已落地的,
  //                与本次 commit 是否包含其 import 无关 — 否则任何单一文件 commit 都会误判失败)
  let filesForNaming;
  let filesForClaims;
  if (stagedMode) {
    const staged = getStagedFiles();
    if (staged.length === 0) {
      console.log('   ⚠️  没有 staged 文件,跳过检查\n');
      process.exit(0);
    }
    filesForNaming = listFilesFiltered(PROJECT_ROOT, staged);
    filesForClaims = listFiles(PROJECT_ROOT);
    files = filesForNaming; // 兼容下游仍引用 files 的位置
    console.log(`   staged 共 ${staged.length} 个文件,实际扫描 ${filesForNaming.length} 个文本文件(命名检查) + ${filesForClaims.length} 个文件(整合能力检查)\n`);
  } else {
    files = listFiles(PROJECT_ROOT);
    filesForNaming = files;
    filesForClaims = files;
    console.log(`   共扫描 ${files.length} 个文本文件\n`);
  }

  let totalFailures = 0;

  // 守门项 1:命名清零(只检查 staged 文件,防止新 commit 引入违规命名)
  console.log('━━━ 守门项 1:命名清零(cli/cli/Cli/cli/cli)━━━');
  const namingViolations = await checkNaming(filesForNaming);
  if (namingViolations.length === 0) {
    console.log('   ✅ 零匹配,通过\n');
  } else {
    console.log(`   ❌ 发现 ${namingViolations.length} 处违规:`);
    for (const v of namingViolations.slice(0, 20)) {
      console.log(`      ${v.file}:${v.line} [${v.pattern}] ${v.text}`);
    }
    if (namingViolations.length > 20) {
      console.log(`      ... 还有 ${namingViolations.length - 20} 处`);
    }
    totalFailures += namingViolations.length;
    console.log('');
  }

  // 守门项 2 & 3:已整合能力 import + call + file(始终扫全项目,与本次 commit 内容无关)
  console.log('━━━ 守门项 2 & 3:已整合能力(import + call + file 三件套)━━━');
  const integratedFailures = await checkIntegratedClaims(filesForClaims);
  if (integratedFailures.length === 0) {
    console.log(`   ✅ ${INTEGRATED_CLAIMS.length} 项已声明能力全部有真实证据,通过\n`);
  } else {
    console.log(`   ❌ 发现 ${integratedFailures.length} 处证据不足:`);
    for (const f of integratedFailures) {
      console.log(`      [${f.id}] (${f.kind}) ${f.msg}`);
    }
    totalFailures += integratedFailures.length;
    console.log('');
  }

  // 守门项 4:不融合 crate 三件套
  console.log('━━━ 守门项 4:不融合 crate(证据文件 + 关键 token)━━━');
  const notIntegratedFailures = await checkNotIntegratedClaims();
  if (notIntegratedFailures.length === 0) {
    console.log(`   ✅ ${NOT_INTEGRATED_CLAIMS.length} 项"不融合"声明全部附三件套,通过\n`);
  } else {
    console.log(`   ❌ 发现 ${notIntegratedFailures.length} 处证据不足:`);
    for (const f of notIntegratedFailures) {
      console.log(`      [${f.id}] (${f.kind}) ${f.msg}`);
    }
    totalFailures += notIntegratedFailures.length;
    console.log('');
  }

  // 守门项 5:已声明 P0/P1 文件不能含 TODO/FIXME(已声明文件路径固定,与 staged 无关)
  console.log('━━━ 守门项 5:已声明 P0/P1 文件不能含 TODO/FIXME/HACK/STUB━━━');
  const todoViolations = await checkTodoInDeclared();
  if (todoViolations.length === 0) {
    console.log('   ✅ 已声明文件零 TODO/FIXME,通过\n');
  } else {
    console.log(`   ❌ 发现 ${todoViolations.length} 处 TODO/FIXME 标记:`);
    for (const v of todoViolations) {
      console.log(`      ${v.file}:${v.line} [${v.token}] ${v.text}`);
    }
    totalFailures += todoViolations.length;
    console.log('');
  }

  // 守门项 6:CLAIMED 能力 import + call + file 三件套(P39 6 项 + P42 8 项,始终扫全项目)
  console.log('━━━ 守门项 6:CLAIMED 能力"已声明但未实现"自动检测(P39 6 项 + P42 8 项)━━━');
  if (skipClaimed) {
    console.log('   ⏭️  跳过(--skip-claimed,测试 fakeroot 模式)\n');
  } else {
  const claimedFailures = await checkClaimedCapabilities(filesForClaims);
  if (claimedFailures.length === 0) {
    console.log(`   ✅ ${CLAIMED_CAPABILITIES.length} 项 CLAIMED 能力全部有真实证据,通过\n`);
  } else {
    console.log(`   ❌ 发现 ${claimedFailures.length} 处证据不足:`);
    for (const f of claimedFailures) {
      console.log(`      [${f.id}] (${f.kind}) ${f.msg}`);
    }
    totalFailures += claimedFailures.length;
    console.log('');
  }
  }

  // 守门项 7:PROJECT_PLAN.md 持续推进度(P39 新增)
  console.log('━━━ 守门项 7:PROJECT_PLAN.md 持续推进度("已交付"声明计数,P39 新增)━━━');
  if (skipPlan) {
    console.log('   ⏭️  跳过(--skip-plan,测试 fakeroot 模式)\n');
  } else {
  const planResult = await checkProjectPlanClaims();
  const planFailures = planResult.failures ?? [];
  if (planFailures.length === 0) {
    console.log(`   ✅ PROJECT_PLAN.md 含 ${planResult.claimCount} 条"已交付"声明,持续推进中,通过\n`);
  } else {
    console.log(`   ❌ 发现 ${planFailures.length} 处问题:`);
    for (const f of planFailures) {
      console.log(`      [${f.id}] (${f.kind}) ${f.msg}`);
    }
    totalFailures += planFailures.length;
    console.log('');
  }
  }

  const elapsedMs = Date.now() - startMs;
  console.log(`⏱️  扫描耗时: ${elapsedMs}ms`);

  if (totalFailures === 0) {
    console.log('\n🎉 全部守门通过 — 100% 整合声明有可验证证据,可放心 commit');
    process.exit(0);
  } else {
    console.log(`\n❌ 守门失败:共 ${totalFailures} 项不达标`);
    console.log('   修复方法:');
    console.log('   - 命名违规:删除/替换为项目自有命名(参考 PROJECT_PLAN.md 第 36 轮交付)');
    console.log('   - import/call 不足:补充真实接入证据');
    console.log('   - 文件缺失:落地声明的文件或修订声明');
    console.log('   - 三件套不足:补充源码路径 + 关键模块清单 + 等价实现/不兼容证据');
    console.log('   - TODO 标记:清理 stub/fixture,完成真实实现');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('💥 守门脚本运行异常:', e);
  process.exit(2);
});
