/**
 * AGENTS.md 章节完整性回归测试 (2026-07-02)
 *
 * 防回归目标：AGENTS.md 是项目级 Agent 行为规范的唯一来源，
 *   2026-07-02 曾因 stash 误覆盖导致 2 个章节（AI 浮窗对话历史入口唯一性 +
 *   登录/注册按钮设计令牌）整体丢失，commit 9b6ca3c6 自称"恢复"但只补了 1 行空行。
 *   本测试用源码级 regex 锚点断言 9 个 H2 章节必须存在且顺序正确，
 *   任何章节被删/被替换/顺序错乱都会在 CI 失败。
 *
 * 验证项（纯源码级，不需要浏览器）：
 *   1) AGENTS.md 文件存在
 *   2) 文件总行数 >= 200（防止被截断成空壳）
 *   3) 行尾必须全部为 LF（CRLF = 0）—— 顺便守门
 *   4) H2 章节计数必须 == 9（多余/缺失都算回归）
 *   5) 9 个章节标题按既定顺序逐字匹配
 *
 * CI 入口：npx playwright test agents-md-sections.spec.ts
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const PROJECT_ROOT = join(ROOT, '..')
const AGENTS_MD_PATH = join(PROJECT_ROOT, 'AGENTS.md')

/**
 * 9 个 H2 章节的精确标题（按 AGENTS.md 中出现的顺序）。
 *
 * 维护规则：
 *   - 新增章节时，先在 AGENTS.md 追加，再在本数组追加对应标题
 *   - 删除章节时，先在本数组删除，再在 AGENTS.md 删除
 *   - 顺序必须与 AGENTS.md 中实际出现顺序一致（顺序错乱也算回归）
 *
 * 历史教训：
 *   2026-07-02 stash ai-panel-cleanup-batch 误把"端口配置"+"行尾格式"两章
 *   整个替换成了"AI 浮窗对话历史"+"登录按钮设计令牌"两章，
 *   导致后两章在 HEAD 中丢失近 1 天才被发现。
 */
const EXPECTED_SECTIONS: ReadonlyArray<{ title: string; keyword: string }> = [
  {
    title: '## 目标驱动模式执行规范（/goal）',
    keyword: '目标驱动模式',
  },
  {
    title: '## 主题色改动硬约束（2026-07-02 立）',
    keyword: '主题色改动硬约束',
  },
  {
    title: '## 纯白/纯黑边框改动硬约束（2026-07-02 立）',
    keyword: '纯白/纯黑边框改动硬约束',
  },
  {
    title: '## AI 面板 embedded/floating 模式样式分离约束（2026-07-02 立）',
    keyword: 'AI 面板 embedded/floating 模式样式分离约束',
  },
  {
    title: '## 多 commit 协作模式下的 hunks 边界规范（2026-07-02 立）',
    keyword: '多 commit 协作模式下的 hunks 边界规范',
  },
  {
    title: '## 端口配置统一守门（2026-07-02 立）',
    keyword: '端口配置统一守门',
  },
  {
    title: '## 行尾格式守门（2026-07-02 立）',
    keyword: '行尾格式守门',
  },
  {
    title: '## AI 浮窗对话历史入口唯一性硬约束（2026-07-02 立）',
    keyword: 'AI 浮窗对话历史入口唯一性硬约束',
  },
  {
    title: '## 登录/注册按钮设计令牌应用硬约束（2026-07-02 立）',
    keyword: '登录/注册按钮设计令牌应用硬约束',
  },
]

test.describe('AGENTS.md 章节完整性守门 (2026-07-02)', () => {
  // ===================================================================
  // 1) 文件存在 + 行数下限
  // ===================================================================
  test('源码级：AGENTS.md 文件存在且行数 >= 200', () => {
    const buf = readFileSync(AGENTS_MD_PATH)
    const content = buf.toString('utf8')
    const lineCount = content.split('\n').length

    expect(
      lineCount,
      `AGENTS.md 行数 ${lineCount} < 200，可能被截断或大量内容丢失。\n` +
        `路径：${AGENTS_MD_PATH}\n` +
        `历史上 stash 误覆盖曾导致 2 章节 (~95 行) 整体丢失，此断言用于及早发现。`
    ).toBeGreaterThanOrEqual(200)
  })

  // ===================================================================
  // 2) 行尾必须全部为 LF（CRLF = 0）
  // ===================================================================
  test('源码级：AGENTS.md 必须使用 LF 行尾（CRLF/CR = 0）', () => {
    const buf = readFileSync(AGENTS_MD_PATH)
    let crlf = 0
    let crOnly = 0
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] === 0x0a) {
        if (i > 0 && buf[i - 1] === 0x0d) crlf++
      } else if (buf[i] === 0x0d) {
        if (i + 1 >= buf.length || buf[i + 1] !== 0x0a) crOnly++
      }
    }
    expect(
      crlf,
      `AGENTS.md 含 ${crlf} 个 CRLF 行尾，违反项目 LF 行尾硬约束。\n` +
        `修复：node -e "const fs=require('fs');let c=fs.readFileSync('AGENTS.md','utf8');` +
        `fs.writeFileSync('AGENTS.md',c.replace(/\\r\\n/g,'\\n').replace(/\\r/g,'\\n'))"`
    ).toBe(0)
    expect(
      crOnly,
      `AGENTS.md 含 ${crOnly} 个 lone CR 行尾，违反项目 LF 行尾硬约束。`
    ).toBe(0)
  })

  // ===================================================================
  // 3) H2 章节计数必须 == 9（多余/缺失都算回归）
  // ===================================================================
  test('源码级：AGENTS.md H2 章节计数必须等于 9', () => {
    const content = readFileSync(AGENTS_MD_PATH, 'utf8')
    // 匹配行首 ## 开头（但不匹配 ### / #### 等更深层级）
    const h2Matches = content.match(/^## [^\n]+$/gm) || []

    expect(
      h2Matches.length,
      `AGENTS.md H2 章节数 = ${h2Matches.length}，期望 = 9。\n` +
        `实际 H2 列表：\n${h2Matches.map((h) => '  ' + h).join('\n')}\n` +
        `新增章节时：先在 AGENTS.md 追加，再更新 agents-md-sections.spec.ts 的 EXPECTED_SECTIONS。\n` +
        `删除章节时：先更新 EXPECTED_SECTIONS，再删 AGENTS.md。`
    ).toBe(EXPECTED_SECTIONS.length)
  })

  // ===================================================================
  // 4) 9 个章节标题按既定顺序逐字匹配
  // ===================================================================
  test('源码级：AGENTS.md 9 个 H2 章节标题按既定顺序逐字匹配', () => {
    const content = readFileSync(AGENTS_MD_PATH, 'utf8')
    const h2Matches = content.match(/^## [^\n]+$/gm) || []

    EXPECTED_SECTIONS.forEach((expected, idx) => {
      const actual = h2Matches[idx]
      expect(
        actual,
        `AGENTS.md 第 ${idx + 1} 个 H2 章节缺失。\n` +
          `期望：${expected.title}\n` +
          `实际：${actual ?? '(undefined — 章节被删或顺序错乱)'}\n` +
          `关键字：${expected.keyword}\n` +
          `修复：在 AGENTS.md 中恢复该章节（参考 git stash 6768f56f 或 git log -- AGENTS.md）`
      ).toBeDefined()
      expect(
        actual,
        `AGENTS.md 第 ${idx + 1} 个 H2 章节标题不匹配。\n` +
          `期望：${expected.title}\n` +
          `实际：${actual}\n` +
          `可能原因：标题被改字 / 顺序被打乱 / 章节被替换成另一个`
      ).toBe(expected.title)
    })
  })

  // ===================================================================
  // 5) 关键章节内容存在性抽查（防"标题在但正文被删"）
  // ===================================================================
  test('源码级：关键章节正文要点存在（防"空标题"回归）', () => {
    const content = readFileSync(AGENTS_MD_PATH, 'utf8')

    // 每个章节抽一个最关键的标识词，确保不只是标题在、正文也在
    const sectionSpotChecks: ReadonlyArray<{ keyword: string; mustContain: string }> = [
      { keyword: '目标驱动模式', mustContain: 'STATE.md' },
      { keyword: '主题色改动硬约束', mustContain: 'check:theme-tokens' },
      { keyword: '纯白/纯黑边框改动硬约束', mustContain: 'declaration-property-value-disallowed-list' },
      { keyword: 'AI 面板 embedded/floating', mustContain: '.floating-chat-dialog.is-embedded' },
      { keyword: 'hunks 边界规范', mustContain: 'Hunks-Overlap' },
      { keyword: '端口配置统一守门', mustContain: 'check:port-drift' },
      { keyword: '行尾格式守门', mustContain: 'check:line-endings' },
      { keyword: 'AI 浮窗对话历史入口唯一性', mustContain: 'ChatSessionPanel.vue' },
      { keyword: '登录/注册按钮设计令牌', mustContain: '_login-tokens.scss' },
    ]

    sectionSpotChecks.forEach(({ keyword, mustContain }) => {
      // 找到章节起始位置
      const sectionStart = content.indexOf(keyword)
      expect(
        sectionStart,
        `AGENTS.md 缺失含 "${keyword}" 的章节`
      ).toBeGreaterThanOrEqual(0)

      // 取该章节到下一个 ## 之间的正文
      const nextH2 = content.indexOf('\n## ', sectionStart + 1)
      const sectionBody =
        nextH2 === -1
          ? content.slice(sectionStart)
          : content.slice(sectionStart, nextH2)

      expect(
        sectionBody.includes(mustContain),
        `AGENTS.md 中 "${keyword}" 章节正文缺失关键标识 "${mustContain}"。\n` +
          `可能原因：章节正文被删/被截断/被替换成另一个章节的内容。\n` +
          `修复：参考 git stash 6768f56f:AGENTS.md 或 git log -p -- AGENTS.md 找回正文`
      ).toBe(true)
    })
  })
})
