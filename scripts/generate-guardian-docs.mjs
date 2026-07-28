#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 守门体系文档自动化生成器(P3-C)。
 *
 * 从 scripts/guardian-runner.mjs 字符级解析 const checks = [...] 数组,
 * 提取每个守门项的 id/label/script/args/mode/onFailHint 字段及前置注释,
 * 与内置配置(UPGRADE_TIMELINE / NAMESPACE_MAP)合并后渲染 Markdown,
 * 写入 docs/guardian-reference.md。
 *
 * 用法:
 *   node scripts/generate-guardian-docs.mjs          生成 docs/guardian-reference.md(覆盖)
 *   node scripts/generate-guardian-docs.mjs --check   仅校验文档是否最新(过期 exit 1,CI 用)
 *   node scripts/generate-guardian-docs.mjs --help    打印帮助
 *
 * 设计约束:
 *   - 不修改 guardian-runner.mjs(只读)
 *   - 不硬编码守门项 id/label/mode(全部从源码动态提取)
 *   - UPGRADE_TIMELINE / NAMESPACE_MAP 是手工维护的配置表(无法从代码自动推导)
 *
 * 局限性:
 *   - 解析器为字符级状态机,假设 checks 数组语法规范(无嵌套对象、无 spread、无动态字段)
 *   - 字符串内转义引号场景未处理(当前 guardian-runner.mjs 无此情况)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RUNNER_PATH = join(ROOT, 'scripts', 'guardian-runner.mjs')
const DOC_PATH = join(ROOT, 'docs', 'guardian-reference.md')

// === 1. guardian-runner.mjs 解析器(字符级状态机,字符串/注释感知)===

/**
 * 跳过字符串字面量,返回结束位置(关闭引号的下一位置)。
 * 处理 \\ 转义,不处理模板字符串内 ${} 嵌套(守门配置未使用)。
 */
function skipString(source, start) {
  const quote = source[start]
  let i = start + 1
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2
      continue
    }
    if (source[i] === quote) return i + 1
    i++
  }
  return i
}

/** 定位 const checks = [ ... ] 的边界,返回 { startIdx, endIdx }(endIdx 指向 ])。 */
function findChecksArray(source) {
  const startMatch = source.match(/const\s+checks\s*=\s*\[/)
  if (!startMatch) throw new Error('无法找到 const checks = [')
  const startIdx = startMatch.index + startMatch[0].length
  let depth = 1
  let i = startIdx
  while (i < source.length) {
    const c = source[i]
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(source, i)
      continue
    }
    if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++
      continue
    }
    if (c === '/' && source[i + 1] === '*') {
      i += 2
      while (i < source.length - 1 && !(source[i] === '*' && source[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) return { startIdx, endIdx: i }
    }
    i++
  }
  throw new Error('无法找到 checks 数组的结束 ]')
}

/**
 * 解析 checks 数组,返回 [{ id, label, script, args, mode, onFailHint, comment }]。
 * 字符级状态机跟踪 { } 深度,在 depth 0 → 1 转换时开启新 check 块,
 * 同时捕获前置 // 注释行(包含升级评估、设计原因等上下文)。
 */
function parseChecks(source) {
  const { startIdx, endIdx } = findChecksArray(source)
  const content = source.slice(startIdx, endIdx)
  const checks = []
  let depthBrace = 0
  let currentBlock = null
  let pendingComment = []
  let buffer = []
  let i = 0
  while (i < content.length) {
    const c = content[i]
    // 块注释(优先级最高,可能包含 // 或引号)
    if (c === '/' && content[i + 1] === '*') {
      let end = i + 2
      while (end < content.length - 1 && !(content[end] === '*' && content[end + 1] === '/')) end++
      end += 2
      if (depthBrace > 0) buffer.push(content.slice(i, end))
      i = end
      continue
    }
    // 行注释
    if (c === '/' && content[i + 1] === '/') {
      let end = i
      while (end < content.length && content[end] !== '\n') end++
      const commentLine = content.slice(i, end)
      if (depthBrace === 0) {
        pendingComment.push(commentLine.trim())
      } else {
        buffer.push(commentLine)
      }
      i = end
      continue
    }
    // 字符串
    if (c === '"' || c === "'" || c === '`') {
      const end = skipString(content, i)
      if (depthBrace > 0) buffer.push(content.slice(i, end))
      i = end
      continue
    }
    // 大括号深度跟踪
    if (c === '{') {
      if (depthBrace === 0) {
        currentBlock = { raw: '', comment: pendingComment }
        pendingComment = []
        buffer = []
        depthBrace = 1
        i++
        continue
      }
      depthBrace++
      buffer.push(c)
      i++
      continue
    }
    if (c === '}') {
      depthBrace--
      if (depthBrace === 0) {
        currentBlock.raw = buffer.join('')
        checks.push(currentBlock)
        currentBlock = null
        buffer = []
      } else {
        buffer.push(c)
      }
      i++
      continue
    }
    if (depthBrace > 0) buffer.push(c)
    i++
  }
  return checks.map(extractFields)
}

/** 从 raw 块中提取指定 key 的字符串字面量值。 */
function extractString(raw, key) {
  const re = new RegExp(`\\b${key}:\\s*(['"\`])([\\s\\S]*?)\\1`)
  const m = raw.match(re)
  return m ? m[2] : ''
}

/**
 * 匹配字符串字面量的通用 regex(支持单/双/模板引号,处理 \\ 转义)。
 * 用反向引用 + 否定前瞻,允许单引号字符串内嵌套双引号,反之亦然。
 * 例如: 'foo "bar" baz' 会被整体匹配为一个字符串。
 */
const STRING_LITERAL_RE = /(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g

/** 从 raw 块中提取 args 数组(字符串字面量列表)。 */
function extractArgs(raw) {
  const m = raw.match(/\bargs:\s*\[([\s\S]*?)\]/)
  if (!m) return []
  const content = m[1]
  if (!content.trim()) return []
  const args = []
  STRING_LITERAL_RE.lastIndex = 0
  let am
  while ((am = STRING_LITERAL_RE.exec(content)) !== null) {
    args.push(am[2].replace(/\\(.)/g, '$1'))
  }
  return args
}

/** 从 raw 块中提取 onFailHint([...].join('\n')) 的合并文本。 */
function extractOnFailHint(raw) {
  const m = raw.match(/\bonFailHint:\s*\[([\s\S]*?)\]\s*\.join\(/)
  if (!m) return ''
  const content = m[1]
  const lines = []
  STRING_LITERAL_RE.lastIndex = 0
  let am
  while ((am = STRING_LITERAL_RE.exec(content)) !== null) {
    lines.push(am[2].replace(/\\(.)/g, '$1'))
  }
  return lines.join('\n')
}

function extractFields(block) {
  return {
    id: extractString(block.raw, 'id'),
    label: extractString(block.raw, 'label'),
    script: extractString(block.raw, 'script'),
    args: extractArgs(block.raw),
    mode: extractString(block.raw, 'mode'),
    onFailHint: extractOnFailHint(block.raw),
    comment: block.comment,
  }
}

// === 2. P2-G 升级时间表配置(手工评估,基于源码注释 + AGENTS.md 规则)===
// tier: 'short'(1-2 周) | 'mid'(1-3 个月) | 'eval'(待评估) | 'never'(永久 warn)

const UPGRADE_TIMELINE = {
  '2g-web': {
    tier: 'short',
    date: '2026-08-03',
    prerequisite: '1 周观察期(2026-07-27 立)无误报',
    risk: '共享登录组件命名空间 bug 模式可能漏报(检测目标 8 个组件)',
  },
  '31': {
    tier: 'short',
    date: '~2026-08-02',
    prerequisite: '1 周观察期(2026-07-26 立)无误报',
    risk: '7 项静态扫描可能不覆盖所有视觉漂移场景',
  },
  '2f-mobile-rn': {
    tier: 'mid',
    date: '待定',
    prerequisite: 'check-i18n-keys.mjs 补 mobile-rn 分支(当前 fall through 到 web 分支,无实际防护)',
    risk: '修复前为占位项,升级无意义',
  },
  '2f-ext': {
    tier: 'mid',
    date: '~2026-09-01',
    prerequisite: 'extension i18n 体量稳定(≥ web 端 50%)',
    risk: 'extension 端 i18n 刚起步,误报率未知',
  },
  '2g-ext': {
    tier: 'mid',
    date: '~2026-09-01',
    prerequisite: '同 2f-ext,extension i18n 稳定后同步升级',
    risk: '同 2f-ext',
  },
  '2h-ext': {
    tier: 'mid',
    date: '~2026-09-01',
    prerequisite: '同 2f-ext',
    risk: '同 2f-ext',
  },
  '2i-ext': {
    tier: 'mid',
    date: '~2026-09-01',
    prerequisite: '同 2f-ext',
    risk: '同 2f-ext',
  },
  '2f-cli': {
    tier: 'eval',
    date: '按需',
    prerequisite: 'cli 端 i18n 体量增长后评估(当前 63 行)',
    risk: '体量过小,升级收益低',
  },
  '2d': {
    tier: 'never',
    reason: '日文汉字词(登録/確認/削除)易误报,AGENTS.md §19 明确标注 ja warn-only',
  },
  '2l-shared': {
    tier: 'never',
    reason: '同 2d,日文汉字词易误报',
  },
  '13b': {
    tier: 'never',
    reason: 'PLAN 体积超限不应阻塞 commit,仅提醒(脚本名已标 warn-only)',
  },
  '19': {
    tier: 'never',
    reason: '跨 agent 协作场景复杂,机械阻塞会误伤正常 commit',
  },
  '21': {
    tier: 'never',
    reason: '平台独占豁免需人工判断,无法机械阻塞(AGENTS.md §9 明确 warn-only)',
  },
  '22': {
    tier: 'never',
    reason: 'bug 修复/重构场景合理不更新 README(AGENTS.md §21 豁免场景)',
  },
  '24b': {
    tier: 'never',
    reason: '端口冲突可后期修复,不应阻塞 commit',
  },
  '34': {
    tier: 'never',
    reason: '@ts-ignore 有合理压制场景(第三方库类型缺陷),不强制阻塞',
  },
}

// === 3. P2-H 命名空间映射(数字 ID → 语义化 ID,分层命名)===

const NAMESPACE_MAP = {
  '1': 'security/api-key-leak',
  '2': 'i18n/parity-web',
  '2b': 'i18n/zh-tw-residue-web',
  '2c': 'i18n/ko-residue-web',
  '2d': 'i18n/ja-residue-web',
  '2e': 'i18n/en-broken-web',
  '2f-web': 'i18n/pipeline-web',
  '2f-miniapp-taro': 'i18n/pipeline-miniapp-taro',
  '2f-mobile-rn': 'i18n/parity-mobile-rn',
  '2f-cli': 'i18n/parity-cli',
  '2f-ext': 'i18n/parity-extension',
  '2f-shared': 'i18n/parity-shared',
  '2f-shared-diff': 'i18n/pipeline-shared',
  '2g-web': 'i18n/namespace-passing-web',
  '2g-ext': 'i18n/zh-tw-residue-extension',
  '2h-ext': 'i18n/ko-residue-extension',
  '2i-ext': 'i18n/en-broken-extension',
  '2j-shared': 'i18n/zh-tw-residue-shared',
  '2k-shared': 'i18n/ko-residue-shared',
  '2l-shared': 'i18n/ja-residue-shared',
  '2m-shared': 'i18n/en-broken-shared',
  '2n-web': 'i18n/parity-web-strict',
  '3': 'code-quality/schema-drift',
  '4': 'code-quality/stale-dist',
  '4b': 'code-quality/dist-utf8',
  '4c': 'code-quality/api-client-utf8',
  '6': 'code-quality/sanitizer-bypass',
  '7': 'code-quality/dedupe',
  '8': 'code-quality/api-routes',
  '9': 'code-quality/safe-parse',
  '10': 'code-quality/openapi-info',
  '11': 'ui/rounded-full',
  '12': 'engineering/delivery-report',
  '13b': 'engineering/project-plan-size',
  '13c': 'engineering/project-plan-archive',
  '15': 'engineering/migration-completeness',
  '17': 'ui/css-token-nesting',
  '18': 'ui/native-title-tooltip',
  '19': 'engineering/staged-pollution',
  '20': 'ui/tailwind-class-conflict',
  '21': 'engineering/multi-end-sync',
  '22': 'engineering/readme-sync',
  '23': 'engineering/staged-files-info',
  '24a': 'ui/sidebar-width',
  '24b': 'engineering/port-registry',
  '25': 'workspace/external-paths',
  '26': 'workspace/parent-pollution',
  '27': 'ui/z-index',
  '28': 'ui/overlay-zindex',
  '29': 'push/sync',
  '30': 'i18n/integrity',
  '30a': 'commit-loss/guard',
  '31': 'ui/auth-shell-shared',
  '33': 'llm/provider-schema',
  '34': 'code-quality/ts-ignore',
  '35': 'code-quality/mypy',
  '36': 'ui/design-tokens-miniapp-taro',
  '37': 'ui/design-tokens-web',
  '38': 'dependencies/solito-residue',
}

// === 4. Markdown 渲染 ===

function escapeTableCell(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, '<br>')
}

function generateMarkdown(checks) {
  const blocking = checks.filter((c) => c.mode === 'blocking')
  const warn = checks.filter((c) => c.mode === 'warn')
  const info = checks.filter((c) => c.mode === 'info')
  const today = new Date().toISOString().slice(0, 10)
  const withHint = checks.filter((c) => c.onFailHint)

  const tblBlocks = (arr) =>
    arr
      .map(
        (c) =>
          `| ${c.id} | ${escapeTableCell(c.label)} | ${c.script} | ${
            c.args.length ? escapeTableCell(c.args.join(' ')) : '—'
          } | ${c.onFailHint ? '有' : '—'} |`,
      )
      .join('\n')

  const tblInfo = (arr) =>
    arr
      .map(
        (c) =>
          `| ${c.id} | ${escapeTableCell(c.label)} | ${c.script} | ${
            c.args.length ? escapeTableCell(c.args.join(' ')) : '—'
          } |`,
      )
      .join('\n')

  const warnByTier = (tier) =>
    warn
      .filter((c) => UPGRADE_TIMELINE[c.id]?.tier === tier)
      .map((c) => {
        const t = UPGRADE_TIMELINE[c.id]
        if (tier === 'never') {
          return `| ${c.id} | ${escapeTableCell(c.label)} | ${t.reason} |`
        }
        return `| ${c.id} | ${escapeTableCell(c.label)} | ${t.date} | ${escapeTableCell(
          t.prerequisite,
        )} | ${escapeTableCell(t.risk)} |`
      })
      .join('\n')

  const uncategorizedWarn = warn.filter((c) => !UPGRADE_TIMELINE[c.id])

  const namespaceRows = checks
    .map(
      (c) =>
        `| ${c.id} | \`${NAMESPACE_MAP[c.id] || '—（待补充）'}\` | ${escapeTableCell(
          c.label,
        )} | ${c.script} |`,
    )
    .join('\n')

  const hintBlocks = withHint
    .map(
      (c) =>
        `#### [${c.id}] ${c.label}\n\n\`\`\`\n${c.onFailHint}\n\`\`\``,
    )
    .join('\n\n')

  return `# 守门体系参考文档（自动生成）

> 本文档由 \`scripts/generate-guardian-docs.mjs\` 从 \`scripts/guardian-runner.mjs\` 动态提取生成。
> 修改 guardian-runner.mjs 后请运行 \`pnpm guardian:docs\` 重新生成。
> **禁止手工编辑**——下次生成会覆盖。
>
> 最后生成：${today}（共 ${checks.length} 项：blocking ${blocking.length} / warn ${warn.length} / info ${info.length}）

## 目录

- [1. 守门项完整清单](#1-守门项完整清单)
- [2. P2-G: warn→blocking 升级时间表](#2-p2-g-warnblocking-升级时间表)
- [3. P2-H: id 命名空间重构建议](#3-p2-h-id-命名空间重构建议)
- [4. P3-C: 文档自动化机制说明](#4-p3-c-文档自动化机制说明)

---

## 1. 守门项完整清单

按 mode 分组，每组按 guardian-runner.mjs 中的出现顺序排列。

### 1.1 blocking 项（${blocking.length} 项）

| ID | Label | Script | Args | onFailHint |
|----|-------|--------|------|------------|
${tblBlocks(blocking)}

### 1.2 warn 项（${warn.length} 项）

| ID | Label | Script | Args | onFailHint |
|----|-------|--------|------|------------|
${tblBlocks(warn)}

### 1.3 info 项（${info.length} 项）

| ID | Label | Script | Args |
|----|-------|--------|------|
${tblInfo(info)}

### 1.4 失败提示详情（onFailHint）

仅展示有 onFailHint 的守门项（共 ${withHint.length} 项），按 guardian-runner.mjs 出现顺序排列。

${hintBlocks}

---

## 2. P2-G: warn→blocking 升级时间表

按升级优先级分 4 档：**短期**（1-2 周）/ **中长期**（1-3 个月）/ **待评估** / **永久 warn**。
分类依据：guardian-runner.mjs 源码注释 + AGENTS.md §"守门脚本速查" + 实际依赖评估。

### 2.1 短期升级（1-2 周）

已有明确"观察期无误报即升级"评估结论。

| ID | Label | 建议升级时间 | 前置条件 | 风险点 |
|----|-------|--------------|----------|--------|
${warnByTier('short') || '| — | — | — | — | — |'}

### 2.2 中长期升级（1-3 个月）

依赖外部条件（脚本修复、子模块稳定）才能升级。

| ID | Label | 建议升级时间 | 前置条件 | 风险点 |
|----|-------|--------------|----------|--------|
${warnByTier('mid') || '| — | — | — | — | — |'}

### 2.3 待评估

warn-only 起步，无明确升级计划，需触发条件。

| ID | Label | 评估时间点 | 触发条件 | 风险点 |
|----|-------|------------|----------|--------|
${warnByTier('eval') || '| — | — | — | — | — |'}

### 2.4 永久 warn（不升级）

设计上选择 warn 而非 blocking，原因明确，无升级计划。

| ID | Label | 永久 warn 原因 |
|----|-------|----------------|
${warnByTier('never') || '| — | — | — |'}

### 2.5 未分类 warn 项

以下 warn 项未在 UPGRADE_TIMELINE 配置中，需补充评估。

${
  uncategorizedWarn.length === 0
    ? '（无）'
    : `| ID | Label | Script |\n|----|-------|--------|\n${uncategorizedWarn
        .map((c) => `| ${c.id} | ${escapeTableCell(c.label)} | ${c.script} |`)
        .join('\n')}`
}

---

## 3. P2-H: id 命名空间重构建议

### 3.1 现状问题

- ID 是数字 1-38 + 字母后缀（2b/2c/2d/2e/2f/4b/4c/13b/13c/24a/24b/30a 等）
- 数字无语义，新增项需查表找下一个可用编号（源码注释显示 35/36/37/38 都因编号冲突而改用其他数字）
- 字母后缀规则不统一（2b/2c 表示同主题子项，但 4b/4c/13b/13c 含义不同）
- ID 与脚本名无映射关系（id=2 → check-i18n-keys.mjs，需查文档）

### 3.2 重构方案：分层命名空间

格式：\`<category>/<topic>[-<subtopic>]\`

| 分类 | 范围 | 示例 |
|------|------|------|
| \`security/\` | 安全相关 | \`security/api-key-leak\` |
| \`i18n/\` | 国际化（parity / 残留检测 / 流水线 / 完整性） | \`i18n/parity-web\`、\`i18n/zh-tw-residue\` |
| \`code-quality/\` | 代码质量（schema / dist / 路由 / 类型） | \`code-quality/schema-drift\` |
| \`ui/\` | UI 样式（圆角 / z-index / token / tooltip） | \`ui/rounded-full\`、\`ui/z-index\` |
| \`engineering/\` | 工程约束（PLAN / 多端同步 / README） | \`engineering/multi-end-sync\` |
| \`workspace/\` | 工作区卫生 | \`workspace/external-paths\` |
| \`commit-loss/\` | 防提交丢失 | \`commit-loss/guard\` |
| \`push/\` | Push 同步 | \`push/sync\` |
| \`dependencies/\` | 依赖治理 | \`dependencies/solito-residue\` |
| \`llm/\` | LLM 配置 | \`llm/provider-schema\` |

### 3.3 完整映射表（数字 ID → 语义化 ID）

按 guardian-runner.mjs 出现顺序排列。

| 数字 ID | 语义化 ID | Label | Script |
|---------|-----------|-------|--------|
${namespaceRows}

### 3.4 迁移建议

1. **过渡期（1-2 个月）**：guardian-runner.mjs 增加 \`semanticId\` 字段，与 \`id\` 并存；日志/onFailHint 同时输出两个 ID
2. **文档同步**：AGENTS.md §"守门脚本速查" / docs/GATEKEEPERS.md / 各 check-*.mjs 输出全部改用 semanticId
3. **完成迁移**：删除数字 \`id\` 字段，所有引用改为 \`semanticId\`
4. **影响范围**：guardian-runner.mjs / .husky/pre-commit / AGENTS.md / docs/GATEKEEPERS.md / 各 check-*.mjs 脚本输出

### 3.5 重构收益

- 新增守门项无需查表找编号，直接按主题命名
- 日志/CI 输出更易读（\`[i18n/parity-web]\` 比 \`[2n-web]\` 直观）
- 与 AGENTS.md §"守门脚本速查"分类完全对齐
- 便于按分类过滤执行（如 \`guardian-runner --filter 'i18n/*'\`）

---

## 4. P3-C: 文档自动化机制说明

### 4.1 脚本用法

\`\`\`bash
# 生成（覆盖）docs/guardian-reference.md
pnpm guardian:docs

# 等价于
node scripts/generate-guardian-docs.mjs

# 仅校验文档是否最新（CI 用，过期则 exit 1）
node scripts/generate-guardian-docs.mjs --check

# 打印帮助
node scripts/generate-guardian-docs.mjs --help
\`\`\`

### 4.2 工作原理

1. 读取 \`scripts/guardian-runner.mjs\` 源码
2. 字符级解析 \`const checks = [...]\` 数组（字符串/注释感知，避免误匹配）
3. 对每个 check 对象提取 \`id\` / \`label\` / \`script\` / \`args\` / \`mode\` / \`onFailHint\`
4. 同时提取对象前的 \`//\` 注释块（包含升级评估、设计原因等上下文）
5. 与内置的 \`UPGRADE_TIMELINE\`（升级时间表）和 \`NAMESPACE_MAP\`（命名空间映射）合并
6. 渲染 Markdown 模板，写入 \`docs/guardian-reference.md\`

### 4.3 CI 集成建议

| 场景 | 命令 | 失败行为 |
|------|------|----------|
| PR 检查 | \`pnpm guardian:docs -- --check\` | 文档过期则 CI fail，提示重新生成 |
| Pre-commit（可选） | \`node scripts/generate-guardian-docs.mjs --check\` | staged 含 guardian-runner.mjs 但 docs 未更新时 warn |
| 文档生成 | \`pnpm guardian:docs\` | 自动覆盖，无需人工编辑 |

**推荐集成位置**：CI 流水线在 lint/typecheck 之后加一步 \`pnpm guardian:docs -- --check\`，确保文档与代码同步。

### 4.4 维护规则

- **禁止手工编辑** \`docs/guardian-reference.md\`（会被下次生成覆盖）
- **修改 guardian-runner.mjs** 后必须运行 \`pnpm guardian:docs\` 重新生成
- **新增守门项** 时同步在脚本的 \`UPGRADE_TIMELINE\` 和 \`NAMESPACE_MAP\` 配置中添加条目
- **升级 mode**（warn → blocking）后需同步更新 \`UPGRADE_TIMELINE\` 配置（删除该 ID 条目，因它已不在 warn 列表）

### 4.5 局限性

- 升级时间表（\`UPGRADE_TIMELINE\`）和命名空间映射（\`NAMESPACE_MAP\`）是手工维护的配置表，无法从代码自动推导
- 解析器是字符级状态机，假设 guardian-runner.mjs 的 checks 数组语法规范（无嵌套对象、无 spread 操作符、无动态字段）
- 字符串内转义引号场景未处理（当前 guardian-runner.mjs 无此情况，未来如有需更新解析器）
- onFailHint 中的多行字符串在 §1 表格中只显示"有/无"，完整内容在 §1.4

---

*本文档由 \`scripts/generate-guardian-docs.mjs\` 自动生成，禁止手工编辑。*
`
}

// === main ===

const argv = process.argv.slice(2)

if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`generate-guardian-docs.mjs — 守门体系文档自动化生成器

用法:
  node scripts/generate-guardian-docs.mjs          生成 docs/guardian-reference.md
  node scripts/generate-guardian-docs.mjs --check   仅校验文档是否最新(过期 exit 1)
  node scripts/generate-guardian-docs.mjs --help    打印此帮助

工作原理:
  字符级解析 scripts/guardian-runner.mjs 的 const checks = [...] 数组,
  提取 id/label/script/args/mode/onFailHint 字段,
  与内置配置(UPGRADE_TIMELINE / NAMESPACE_MAP)合并后渲染 Markdown。

输出:
  docs/guardian-reference.md(4 章节:完整清单 + 升级时间表 + 命名空间 + 自动化说明)
`)
  process.exit(0)
}

const source = readFileSync(RUNNER_PATH, 'utf8')
const checks = parseChecks(source)

if (checks.length === 0) {
  console.error('❌ 未从 guardian-runner.mjs 提取到任何守门项,解析器可能失效')
  process.exit(1)
}

const md = generateMarkdown(checks)

if (argv.includes('--check')) {
  if (!existsSync(DOC_PATH)) {
    console.error('❌ docs/guardian-reference.md 不存在,请运行 pnpm guardian:docs 生成')
    process.exit(1)
  }
  const existing = readFileSync(DOC_PATH, 'utf8')
  if (existing !== md) {
    console.error('❌ docs/guardian-reference.md 已过期,请运行 pnpm guardian:docs 重新生成')
    process.exit(1)
  }
  console.log(`✅ docs/guardian-reference.md 已是最新(${checks.length} 项)`)
  process.exit(0)
}

writeFileSync(DOC_PATH, md, 'utf8')

const counts = {
  blocking: checks.filter((c) => c.mode === 'blocking').length,
  warn: checks.filter((c) => c.mode === 'warn').length,
  info: checks.filter((c) => c.mode === 'info').length,
}
console.log(`✅ 已生成 ${DOC_PATH}`)
console.log(`   守门项总数: ${checks.length}`)
console.log(`   blocking: ${counts.blocking}`)
console.log(`   warn: ${counts.warn}`)
console.log(`   info: ${counts.info}`)
process.exit(0)
