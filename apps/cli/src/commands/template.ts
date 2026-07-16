/**
 * AGENTS.md 模板生成与管理
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

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

export function agentsMdExists(workspacePath: string): boolean {
  return fs.existsSync(path.join(workspacePath, 'AGENTS.md'));
}

export function writeAgentsMd(workspacePath: string): boolean {
  const agentsPath = path.join(workspacePath, 'AGENTS.md');
  const existed = fs.existsSync(agentsPath);
  const content = generateAgentsMdTemplate(path.basename(workspacePath));
  fs.writeFileSync(agentsPath, content, 'utf-8');
  return existed;
}
