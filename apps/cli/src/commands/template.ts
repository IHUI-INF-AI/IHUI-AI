// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AGENTS.md 模板生成与管理
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { runHook, surfaceHookOutcome } from '../hooks/index.js';

function generateAgentsMdTemplate(projectName?: string): string {
  const name = projectName || 'Your Project';
  return `# AGENTS.md

> 本文件为 AI 编码代理提供项目上下文。编辑此文件以帮助代理理解你的项目。

## 项目概述

${name} — <!-- 简要描述项目的目的和功能 -->

## 构建与测试命令

- 构建: \`npm run build\`
- 测试: \`npm test\`
- 代码检查: \`npm run lint\`
- 开发模式: \`npm run dev\`

## 代码风格

- 语言: TypeScript
- 模块系统: ESM
- 格式化: Prettier

## 项目架构

\`\`\`
project/
├── src/           # 源代码
├── tests/         # 测试文件
├── package.json   # 依赖与脚本
└── tsconfig.json  # TypeScript 配置
\`\`\`

## 约定

<!-- 描述任何特殊约定或注意事项 -->
`;
}

export function agentsMdExists(
  workspacePath: string,
  stat: (target: string) => unknown = fs.statSync,
): boolean {
  const agentsPath = path.join(workspacePath, 'AGENTS.md');
  try {
    stat(agentsPath);
    return true;
  } catch (error) {
    const code =
      error !== null && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : undefined;
    if (code === 'ENOENT' || code === 'ENOTDIR') return false;
    throw new Error(`AGENTS.md 读不到,不能用模板覆盖 (${code ?? 'unknown'})`);
  }
}

export async function writeAgentsMd(workspacePath: string): Promise<boolean> {
  const agentsPath = path.join(workspacePath, 'AGENTS.md');
  const existed = agentsMdExists(workspacePath);
  const content = generateAgentsMdTemplate(path.basename(workspacePath));
  // setup 档的真实事件源:`ihui init` / REPL `/init` 真正写 AGENTS.md **之前**派发一次,
  // 载荷带装载来源(setupSource='init')。派发在写入前,钩子看到的是"即将装载"而不是
  // 事后补报;非成功终态由 surfaceHookOutcome 喊到 stderr,不静默。
  const hookRes = await runHook('setup', { workspacePath, setupSource: 'init' });
  surfaceHookOutcome('setup', hookRes);
  fs.writeFileSync(agentsPath, content, 'utf-8');
  return existed;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
