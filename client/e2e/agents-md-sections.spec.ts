/**
 * AGENTS.md 章节完整性回归测试 (2026-07-02)
 *
 * 防回归目标：AGENTS.md 是项目级 Agent 行为规范的唯一来源，
 *   2026-07-02 曾因 stash 误覆盖导致 2 个章节（AI 浮窗对话历史入口唯一性 +
 *   登录/注册按钮设计令牌）整体丢失，commit 9b6ca3c6 自称"恢复"但只补了 1 行空行。
 *   本测试用源码级 regex 锚点断言 15 个 H2 章节必须存在且顺序正确，
 *   任何章节被删/被替换/顺序错乱都会在 CI 失败。
 *
 * 验证项（纯源码级，不需要浏览器）：
 *   1) AGENTS.md 文件存在
 *   2) 文件总行数 >= 200（防止被截断成空壳）
 *   3) 行尾必须全部为 LF（CRLF = 0）—— 顺便守门
 *   4) H2 章节计数必须 == 16（多余/缺失都算回归）
 *   5) 16 个章节标题按既定顺序逐字匹配
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
 * 15 个 H2 章节的精确标题 + 正文要点（按 AGENTS.md 中出现的顺序）。
 *
 * 维护规则 (2026-07-03 改进):
 *   - 新增章节: 在 AGENTS.md 追加正文 + 在本数组追加 { title, mustContain }
 *   - keyword 从 title 自动派生 (deriveKeyword), 不再手动维护
 *   - mustContain 是章节正文必须含的关键标识 (每个章节不同, 必须手动写)
 *   - 顺序必须与 AGENTS.md 中实际出现顺序一致（顺序错乱也算回归）
 *
 * 历史教训：
 *   2026-07-02 stash ai-panel-cleanup-batch 误把"端口配置"+"行尾格式"两章
 *   整个替换成了"AI 浮窗对话历史"+"登录按钮设计令牌"两章，
 *   导致后两章在 HEAD 中丢失近 1 天才被发现。
 */
const EXPECTED_SECTIONS: ReadonlyArray<{ title: string; mustContain: string }> = [
  { title: '## 目标驱动模式执行规范（/goal）', mustContain: 'STATE.md' },
  { title: '## 开发服务器启动约定（2026-07-03 立）', mustContain: 'dev-up.ps1' },
  { title: '## 主题色改动硬约束（2026-07-02 立）', mustContain: 'check:theme-tokens' },
  { title: '## 纯白/纯黑边框改动硬约束（2026-07-02 立）', mustContain: 'declaration-property-value-disallowed-list' },
  { title: '## AI 面板 embedded/floating 模式样式分离约束（2026-07-02 立）', mustContain: '.floating-chat-dialog.is-embedded' },
  { title: '## 多 commit 协作模式下的 hunks 边界规范（2026-07-02 立）', mustContain: 'Hunks-Overlap' },
  { title: '## 端口配置统一守门（2026-07-02 立）', mustContain: 'check:port-drift' },
  { title: '## 行尾格式守门（2026-07-02 立）', mustContain: 'check:line-endings' },
  { title: '## AI 浮窗对话历史入口唯一性硬约束（2026-07-02 立）', mustContain: 'ChatSessionPanel.vue' },
  { title: '## 登录/注册按钮设计令牌应用硬约束（2026-07-02 立）', mustContain: '_login-tokens.scss' },
  { title: '## 文案 / i18n 联动改动硬约束（2026-07-03 立）', mustContain: 'check:becomesupplier:join-us' },
  { title: '## 会话过期通知位置 + 自动关闭硬约束（2026-07-03 立）', mustContain: 'SESSION_EXPIRED_DURATION_MS' },
  { title: '## 会话过期通知按钮双层蓝边 + 中间白线视觉 bug 硬约束（2026-07-03 立）', mustContain: '.session-expired-notification' },
  { title: '## Vue scoped + @use partial 规范（2026-07-03 立）', mustContain: 'check-ai-header-style-scope' },
  { title: '## 暗色浮层 primary 按钮双层蓝边 + 中间白线视觉 bug 硬约束（2026-07-03 立）', mustContain: ':where(.el-message-box, .el-notification, .el-dialog' },
  { title: '## 圆角统一硬约束（2026-07-03 立）', mustContain: 'check-no-pill-radius' },
]

// 从 H2 标题自动派生 keyword (用于在正文中定位章节)
// 规则: 去掉 '## ' 前缀, 取 '（' 前的部分
// 例: '## 主题色改动硬约束（2026-07-02 立）' → '主题色改动硬约束'
function deriveKeyword(title: string): string {
  return title.replace(/^## /, '').split('（')[0]
}

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
  // 3) H2 章节计数必须 == EXPECTED_SECTIONS.length（多余/缺失都算回归）
  // ===================================================================
  test(`源码级：AGENTS.md H2 章节计数必须等于 ${EXPECTED_SECTIONS.length}`, () => {
    const content = readFileSync(AGENTS_MD_PATH, 'utf8')
    // 匹配行首 ## 开头（但不匹配 ### / #### 等更深层级）
    const h2Matches = content.match(/^## [^\n]+$/gm) || []

    expect(
      h2Matches.length,
      `AGENTS.md H2 章节数 = ${h2Matches.length}，期望 = ${EXPECTED_SECTIONS.length}。\n` +
        `实际 H2 列表：\n${h2Matches.map((h) => '  ' + h).join('\n')}\n` +
        `新增章节时：先在 AGENTS.md 追加，再更新 agents-md-sections.spec.ts 的 EXPECTED_SECTIONS。\n` +
        `删除章节时：先更新 EXPECTED_SECTIONS，再删 AGENTS.md。`
    ).toBe(EXPECTED_SECTIONS.length)
  })

  // ===================================================================
  // 4) EXPECTED_SECTIONS.length 个章节标题按既定顺序逐字匹配
  // ===================================================================
  test(`源码级：AGENTS.md ${EXPECTED_SECTIONS.length} 个 H2 章节标题按既定顺序逐字匹配`, () => {
    const content = readFileSync(AGENTS_MD_PATH, 'utf8')
    const h2Matches = content.match(/^## [^\n]+$/gm) || []

    EXPECTED_SECTIONS.forEach((expected, idx) => {
      const actual = h2Matches[idx]
      expect(
        actual,
        `AGENTS.md 第 ${idx + 1} 个 H2 章节缺失。\n` +
          `期望：${expected.title}\n` +
          `实际：${actual ?? '(undefined — 章节被删或顺序错乱)'}\n` +
          `关键字：${deriveKeyword(expected.title)}\n` +
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
  //    keyword 从 title 自动派生 (deriveKeyword), mustContain 从 EXPECTED_SECTIONS 取
  // ===================================================================
  test('源码级：关键章节正文要点存在（防"空标题"回归）', () => {
    const content = readFileSync(AGENTS_MD_PATH, 'utf8')

    EXPECTED_SECTIONS.forEach((section) => {
      const keyword = deriveKeyword(section.title)
      const mustContain = section.mustContain
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
