#!/usr/bin/env node
/**
 * check-readme-sync.mjs — README 同步守门(warn-only,2026-07-22 立,AGENTS.md §22)
 *
 * 检测 staged 文件中是否有 apps/ / packages/ 下的功能代码改动,
 * 但 README.md 未在 staged 列表中 → warn 提醒"是否需要同步更新 README"。
 *
 * 豁免场景(AGENTS.md §22):
 * - 纯 bug 修复(不改变对外能力)
 * - 纯重构(不改变功能契约)
 * - 纯测试 / 文档 / 守门脚本改动(不改变运行时能力)
 * - 纯配置 / 依赖升级(不改变功能清单)
 * - 单端内部优化(不改变跨端契约)
 *
 * 用法:
 *   node scripts/check-readme-sync.mjs --staged   # pre-commit 钩子用
 *   node scripts/check-readme-sync.mjs             # 全量扫描 working tree
 *
 * 退出码:0(warn-only,永不阻塞 commit)
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const README_PATH = path.join(ROOT, "README.md");

// 豁免目录 / 文件模式(改动这些不触发 README 同步提醒)
const EXEMPT_PATTERNS = [
  /^\.husky\//,            // git hooks
  /^scripts\//,            // 守门 / 工具脚本
  /^\.trae-cn\//,          // trae 内部
  /^\.trae\//,             // trae 内部
  /^docs\//,               // 文档目录(本身就是文档)
  /^AGENTS\.md$/,          // agent 规则文档
  /^PROJECT_PLAN\.md$/,    // 任务计划文档
  /^README\..*\.md$/,      // 其他语言 README(由 i18n 流程同步)
  /\.test\.ts$/,           // 测试文件
  /\.spec\.ts$/,           // e2e 测试
  /\.test\.tsx$/,          // 测试文件
  /\.spec\.tsx$/,          // e2e 测试
  /__tests__\//,           // 测试目录
  /\/e2e\//,               // e2e 目录
  /\.md$/,                 // 所有 .md 文件(文档类)
  /\.json$/,               // 配置 JSON
  /\.yml$/,                // CI 配置
  /\.yaml$/,               // CI 配置
  /package\.json$/,        // 依赖配置
  /pnpm-lock\.yaml$/,      // 锁文件
  /tsconfig\.json$/,       // TS 配置
  /\.eslintrc/,            // eslint 配置
  /prettier/,              // prettier 配置
];

// 触发 README 同步提醒的功能代码模式
const TRIGGER_PATTERNS = [
  /^apps\/[^/]+\/src\//,    // apps/*/src/ 功能代码
  /^packages\/[^/]+\/src\//, // packages/*/src/ 共享包代码
  /^apps\/ai-service\/app\/(api|services)\//, // ai-service API / 服务层
];

function getStagedFiles() {
  try {
    const out = execSync("git diff --cached --name-only --diff-filter=ACMR", {
      encoding: "utf8",
      cwd: ROOT,
    });
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function isExempt(file) {
  return EXEMPT_PATTERNS.some((p) => p.test(file));
}

function isTrigger(file) {
  return TRIGGER_PATTERNS.some((p) => p.test(file));
}

function main() {
  const args = process.argv.slice(2);
  const useStaged = args.includes("--staged");

  let files;
  if (useStaged) {
    files = getStagedFiles();
  } else {
    // 全量扫描 working tree(非 staged 模式)
    try {
      const out = execSync("git diff --name-only HEAD", { encoding: "utf8", cwd: ROOT });
      files = out.trim().split("\n").filter(Boolean);
    } catch {
      files = [];
    }
  }

  if (files.length === 0) {
    process.exit(0);
  }

  // 过滤出触发文件(功能代码,非豁免)
  const triggerFiles = files.filter((f) => isTrigger(f) && !isExempt(f));

  if (triggerFiles.length === 0) {
    process.exit(0);
  }

  // 检查 README.md 是否在改动列表中
  const readmeChanged = files.some((f) => f === "README.md");

  if (readmeChanged) {
    // README 已同步,无需提醒
    process.exit(0);
  }

  // README 未同步,发 warn(不阻塞)
  console.warn("⚠️  [check-readme-sync] 检测到功能代码改动但 README.md 未同步:");
  console.warn(`   改动文件(${triggerFiles.length} 个功能文件):`);
  triggerFiles.slice(0, 5).forEach((f) => console.warn(`     - ${f}`));
  if (triggerFiles.length > 5) {
    console.warn(`     ... 还有 ${triggerFiles.length - 5} 个`);
  }
  console.warn("   按 AGENTS.md §22:功能开发后应同步更新 README.md(本次改动是否影响对外能力清单?)");
  console.warn("   豁免场景:bug 修复 / 重构 / 测试 / 配置 / 单端内部优化 → 可忽略此提醒");
  console.warn("   (warn-only,不阻塞 commit)");

  process.exit(0); // warn-only,永远 exit 0
}

main();
