# IHUI 技能包格式规范(Skill Package Spec)

> 版本:v1(2026-09-17)· 对齐 agentskills.io 开放标准与平台 `SkillFrontmatter` 类型
> (`packages/types/src/agent-runtime.ts`)· 校验器:`scripts/lint-skill-package.mjs`

## 1. 包结构

```
my-skill/
├── SKILL.md            # 必需,唯一入口(元数据 + 指令正文)
├── references/         # 可选,渐进式加载的引用文档(正文通过相对路径引用)
├── scripts/            # 可选,skill 依赖的脚本
└── assets/             # 可选,静态资源
```

## 2. SKILL.md 结构

```
---
name: my-skill
description: 一句话说清本技能做什么、什么时候用(≤1024 字符)
version: 1.0.0
license: MIT
tags: [示例, 教程]
tools: [read_file, run_command]
progressiveDisclosure: false
---
(正文:指令、流程、约束…)
```

## 3. Frontmatter 字段

| 字段 | 必填 | 约束 |
|---|---|---|
| `name` | ✅ | 1–64 字符;建议 kebab-case;与目录名一致(推荐,非强制) |
| `description` | ✅ | 非空,≤1024 字符;写清「做什么 + 何时触发」,供 agent 检索匹配 |
| `version` | 推荐 | 语义化 `MAJOR.MINOR.PATCH` |
| `license` | 推荐 | SPDX 标识(MIT / Apache-2.0 …);未填视为「保留所有权利」 |
| `tags` | 可选 | 字符串数组,≤10 个 |
| `tools` / `allowedTools` | 可选 | 字符串数组(工具白名单,二选一填写) |
| `model` | 可选 | 指定执行模型 ID |
| `progressiveDisclosure` | 可选 | boolean;true 时正文应 <5k 字,大块内容放 `references/` 并相对路径引用 |
| `prerequisites.commands` / `.env` | 可选 | 字符串数组;运行前置声明 |
| `relatedSkills` | 可选 | 关联 skill 名数组(渐进式加载引用层) |
| `source` | 可选 | `builtin` / `user` / `auto` / `hub`(平台侧字段,手写包无需填) |

**未识别字段**:忽略不报错(向前兼容)。

## 4. 审核红线(市场收录一票否决)

1. 正文含密钥/凭证(通过 `check-api-key-leak` 同源启发式)。
2. `description` 与正文不符(标题党/诱导检索)。
3. 指令要求外传用户数据或关闭安全守门。
4. 引用的 `references/`、`scripts/` 相对路径文件不存在。

## 5. 校验

```bash
node scripts/lint-skill-package.mjs path/to/my-skill        # 目录(找 SKILL.md)
node scripts/lint-skill-package.mjs path/to/SKILL.md        # 单文件
node scripts/lint-skill-package.mjs path/to/skills-dir      # 批量(递归扫 SKILL.md)
```

退出码:全部通过 → 0;任一 ERROR → 1(WARNING 只提示)。
