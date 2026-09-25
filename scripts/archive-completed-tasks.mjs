#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * PROJECT_PLAN.md 已完成任务条目自动归档脚本(2026-07-23 立)
 *
 * 功能:
 *   - 扫描 PROJECT_PLAN.md 中的已完成任务条目(### [x] ✅(YYYY-MM-DD) ...)
 *   - 把完成日期 ≥ 阈值天数的条目移动到 .ihui-agent/archive/PROJECT_PLAN_YYYY-MM-DD_auto-archive.md
 *   - 原位置留 HTML 注释占位(符合 AGENTS.md §1 归档规则 + check-project-plan-archive.mjs 守门)
 *
 * 用法:
 *   node scripts/archive-completed-tasks.mjs              # 默认: 归档 ≥7 天前的已完成条目
 *   node scripts/archive-completed-tasks.mjs --days 3     # 归档 ≥3 天前的
 *   node scripts/archive-completed-tasks.mjs --all        # 归档所有已完成条目(不论日期)
 *   node scripts/archive-completed-tasks.mjs --allow-mass  # 人工放行大批量(自动档阀门见 main())
 *
 * 与守门 13c 的分工(2026-09-25 立,别再让两边各写一套式子):
 *   13c 保护的是「### + 含(已完成 或 ✅)」的**全部**标题行(不许无声删除);
 *   本脚本只搬其中**含 ✅ 且带日期**的子集 —— 搬运集必须是保护集的真子集,
 *   否则一边搬一边护就是互咬。无 ✅ 的「### 已完成清单」一类小节标题因此永远不动。
 *   node scripts/archive-completed-tasks.mjs --dry-run    # 只打印不实际归档
 *   node scripts/archive-completed-tasks.mjs --auto-commit # 归档后自动 git add + commit(防递归: IHUI_ARCHIVE_COMMIT=1)
 *
 * 集成:
 *   - .husky/post-commit 钩子自动调用 --auto-commit 模式
 *   - 防递归: 归档 commit 设 IHUI_ARCHIVE_COMMIT=1, post-commit 检测到跳过
 *
 * 退出码:
 *   0 = 成功(无论是否归档)
 *   1 = 错误(文件读写失败等)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const PLAN_FILE = join(ROOT, 'PROJECT_PLAN.md')
const ARCHIVE_DIR = join(ROOT, '.ihui-agent', 'archive')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const allMode = args.includes('--all')
const autoCommit = args.includes('--auto-commit')
// 大批量(格式漂移/积压)时的显式人工放行口 —— 自动档(pre-commit 钩子)没有这个开关就走阀门
const allowMass = args.includes('--allow-mass')
const daysIdx = args.indexOf('--days')
const daysThreshold = daysIdx >= 0 && args[daysIdx + 1] ? parseInt(args[daysIdx + 1], 10) : 7

// git 二进制按 §5b 取候选,不依赖 PATH(钩子/服务账户环境下 PATH 可能没有 git)
const GIT_BIN = (() => {
  // IHUI_GIT_BIN 与守门 71 同名:既是换机逃生舱,也让**失败路径可被执行验证**
  // (指向一个必然失败的可执行文件就能真跑到回滚分支,不靠静态断言)
  if (process.env.IHUI_GIT_BIN) return process.env.IHUI_GIT_BIN
  for (const p of ['C:/Program Files/Git/bin/git.exe', 'git']) {
    try {
      execFileSync(p, ['--version'], { stdio: 'ignore', windowsHide: true, timeout: 15_000 })
      return p
    } catch {
      /* 试下一个候选;全落空时退回 'git' 由调用处报错,不静默跳过 */
    }
  }
  return 'git'
})()

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

function todayStr() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

function dateDiffDays(dateStr) {
  if (!dateStr) return Infinity // 无日期视为最新,不归档(除非 --all)
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date(todayStr() + 'T00:00:00')
  return Math.floor((now - target) / 86400000)
}

/**
 * 解析 PROJECT_PLAN.md,提取已完成任务条目。
 * 条目标题: **含 ✅ 的 ### 标题**(历史上还接受过 `### [x] ✅(日期)` 那种写法,继续兼容)。
 *   ⚠ 2026-09-25 修前的式子是 /^### \[x\][^\n]*✅/,而 PROJECT_PLAN.md 里 `^### [x]` **命中 0 次** ——
 *   真实形态是 `### XXX ✅(YYYY-MM-DD …)` / `### XXX(YYYY-MM-DD 完成 ✅)`(§1 与守门 13c 用的都是这一形)。
 *   后果:自 2026-09-14(b599edbba 之后)归档器**每次都跑、每次扫到 0 条**,而它的 6 个镜像测试夹具全写
 *   `### [x] ✅(...)` ⇒ 测试一路绿。这是"判据与它所守的对象不同形"的教科书案例,也是守门 13b 那条
 *   "去归档"建议在 09-25 实测返回 0 的真因(不是没东西可归,是它看不见)。
 *   同形要求:本式的目标集必须是 13c 保护集(### + (已完成 或 ✅))的**子集** —— 搬运动作只能作用于
 *   受保护对象,否则一边保护一边搬运会互相抵消(那正是"两道门互咬")。
 * 边界: 下一个 ### / ## 标题 或 单独 --- 分隔行 或 EOF
 * @param {string} content
 * @returns {Array<{startLine:number, endLine:number, title:string, titleText:string, date:string|null, bodyLines:string[]}>}
 */
function parseCompletedTasks(content) {
  const lines = content.split('\n')
  const tasks = []
  let current = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 已完成标题:### 级 + 含 ✅。日期取标题里**第一个** YYYY-MM-DD —— 真实形态里日期常在 ✅ 之前
    //   (`### 第三轮:…(2026-09-09 完成 ✅)`),旧式要求紧跟 ✅ 之后,那种条目就会被判"无日期"而永不归档。
    const headingMatch = /^### (?:\[x\] )?[^\n]*✅/.test(line) ? line : null
    const dateMatch = headingMatch
      ? line.match(/\((\d{4}-\d{2}-\d{2})/) || line.match(/(\d{4}-\d{2}-\d{2})/)
      : null

    if (headingMatch) {
      // 遇到已完成标题:先结束前一个,再开始新条目
      if (current) {
        current.endLine = i - 1
        tasks.push(current)
      }
      current = {
        startLine: i,
        endLine: i,
        title: line,
        titleText: line.replace(/^###\s+/, '').trim(),
        date: dateMatch ? dateMatch[1] : null,
        bodyLines: [line],
      }
    } else if (current) {
      // 在条目内,检查是否到达边界
      if (/^### /.test(line) || /^## /.test(line) || /^---\s*$/.test(line)) {
        current.endLine = i - 1
        tasks.push(current)
        current = null
      } else {
        current.bodyLines.push(line)
        current.endLine = i
      }
    }
  }
  if (current) tasks.push(current)
  return tasks
}

/**
 * 去除条目正文末尾的空行
 */
function trimTrailingEmpty(lines) {
  const result = [...lines]
  while (result.length > 1 && result[result.length - 1].trim() === '') {
    result.pop()
  }
  return result
}

function shouldArchive(task) {
  if (allMode) return true
  if (!task.date) return false // 无日期不归档(除非 --all)
  return dateDiffDays(task.date) >= daysThreshold
}

function main() {
  if (!existsSync(PLAN_FILE)) {
    console.log(`${C.dim}⏭  PROJECT_PLAN.md 不存在,跳过归档${C.reset}`)
    process.exit(0)
  }

  const content = readFileSync(PLAN_FILE, 'utf8')
  const tasks = parseCompletedTasks(content)
  const toArchive = tasks.filter(shouldArchive)

  if (toArchive.length === 0) {
    console.log(
      `${C.dim}⏭  无可归档的已完成任务条目${C.reset} ` +
        `${C.dim}(共 ${tasks.length} 个已完成,阈值 ${allMode ? 'all' : '≥' + daysThreshold + ' 天'})${C.reset}`,
    )
    process.exit(0)
  }

  console.log(
    `${C.cyan}📦 发现 ${toArchive.length} 个可归档的已完成任务条目${C.reset}` +
      `${C.dim}(共 ${tasks.length} 个已完成,阈值 ${allMode ? '--all' : '≥' + daysThreshold + ' 天'})${C.reset}`,
  )
  toArchive.forEach((t) => {
    console.log(`${C.dim}  - ${t.titleText.slice(0, 70)}${C.reset}`)
  })

  if (dryRun) {
    console.log(`${C.yellow}⚠️  --dry-run 模式,未实际归档${C.reset}`)
    process.exit(0)
  }

  // 大批量阀门 —— 只在**自动档**(pre-commit 钩子带 --auto-commit)生效,人工跑不受限。
  // 依据(2026-09-25 实测):修好匹配式后,正常稳态一次是 7 条 / 14.8 KB / 全文的 0.61%;
  //   超过 25 条或 256 KB 就意味着"格式又漂了一次"或"积压被一次性放开",那种量级的活文档重写
  //   必须是人做的决定(共享工作区里并发会话正拿着这份文件,§12)⇒ 拒绝并打印实测数字 + 放行口,
  //   绝不静默搬走半个计划文档。(参照 §5c 水印门"单次缺口 > 200 个拒绝自动回写"的同一条设计。)
  const MASS_MAX_ENTRIES = 25
  const MASS_MAX_BYTES = 256 * 1024
  if (autoCommit && !allowMass) {
    const movedBytes = toArchive.reduce(
      (s, t) => s + Buffer.byteLength(t.bodyLines.join('\n'), 'utf8'),
      0,
    )
    if (toArchive.length > MASS_MAX_ENTRIES || movedBytes > MASS_MAX_BYTES) {
      console.log(
        C.yellow +
          '⚠  大批量归档阀门关闭中(自动档):' +
          toArchive.length +
          ' 条 / ' +
          movedBytes +
          ' B (阈值 ' +
          MASS_MAX_ENTRIES +
          ' 条或 ' +
          MASS_MAX_BYTES +
          ' B)' +
          C.reset,
      )
      console.log(
        C.dim +
          '   这通常是标题格式又漂了一次或积压被一次放开;先 --dry-run 看清单,确认后再人工跑:' +
          ' node scripts/archive-completed-tasks.mjs --allow-mass' +
          C.reset,
      )
      // 退出码 0:这是"自动档少做一件事",不是错误 —— 绝不得让钩子链因此红
      process.exit(0)
    }
  }

  // 确保归档目录存在
  if (!existsSync(ARCHIVE_DIR)) {
    mkdirSync(ARCHIVE_DIR, { recursive: true })
  }

  const today = todayStr()
  const archiveFile = join(ARCHIVE_DIR, `PROJECT_PLAN_${today}_auto-archive.md`)

  // 构建归档文件内容(追加模式)
  const archiveHeader =
    `# PROJECT_PLAN 自动归档(${today})\n\n` +
    `> 本文件由 scripts/archive-completed-tasks.mjs 自动生成,归档自 PROJECT_PLAN.md 的已完成任务条目。\n\n---\n\n`

  let archiveContent = ''
  if (!existsSync(archiveFile)) {
    archiveContent = archiveHeader
  }

  toArchive.forEach((task) => {
    const body = trimTrailingEmpty(task.bodyLines).join('\n')
    archiveContent += body + '\n\n---\n\n'
  })

  // 追加到归档文件
  appendFileSync(archiveFile, archiveContent, 'utf8')

  // 构建 PROJECT_PLAN.md 新内容:用占位注释替换每个已归档条目
  const lines = content.split('\n')
  // 收集要删除的行范围(从后往前删,避免索引偏移)
  const ranges = toArchive.map((t) => ({ start: t.startLine, end: t.endLine, title: t.titleText }))
  // 从后往前替换
  for (let i = ranges.length - 1; i >= 0; i--) {
    const r = ranges[i]
    const placeholder = `<!-- 已归档(${today}):${r.title.slice(0, 60)},完整内容在 .ihui-agent/archive/PROJECT_PLAN_${today}_auto-archive.md -->`
    lines.splice(r.start, r.end - r.start + 1, placeholder)
  }

  const newContent = lines.join('\n')
  writeFileSync(PLAN_FILE, newContent, 'utf8')

  console.log(`${C.green}✅ 已归档 ${toArchive.length} 个条目${C.reset}`)
  console.log(
    `${C.dim}   归档文件: .ihui-agent/archive/PROJECT_PLAN_${today}_auto-archive.md${C.reset}`,
  )
  console.log(`${C.dim}   PROJECT_PLAN.md 原位置已留归档占位注释${C.reset}`)

  // 自动 commit 模式
  if (autoCommit) {
    try {
      // ⚠ 两条都必须**带 pathspec**,且不经 shell(2026-09-25 修,理由写在下面)。
      // 旧写法第二步是 `execSync('git commit --no-verify -m "…"')` —— **不带路径**,等于"把当下索引里
      // 的东西全提交"。共享索引里常年挂着并发会话 staged 的内容(本次改写时就实测撞上 6 个别人
      // staged 的文件删除),那这一枚"归档 commit"会把**别人的在途改动一起打包带走** —— 正是 §12
      // 反复记的那一型污染,而且它跑在 post-commit 里、没有人盯着看。
      // 为什么这个洞今天才暴露:归档器自 2026-09-14 起匹配式与文件真实形态漂开、每次扫到 0 条,
      // 这段代码从没真跑过。**修好匹配式的同一条提交里必须一起修它**,否则"让它能用"就等于"引爆它"。
      const planRel = 'PROJECT_PLAN.md'
      const archiveRel = `.ihui-agent/archive/PROJECT_PLAN_${today}_auto-archive.md`
      const gitQ = ['-c', 'safe.directory=*'] // §5b:不得依赖环境
      // `-f` + 事务性核验 —— 2026-09-25 实测:归档器**第一次真跑**就死在这里。归档目录被
      // .gitignore 的 `.ihui-agent/` 整目录忽略 ⇒ `git add` 拒绝该路径 ⇒ 自动 commit 失败 ⇒
      // 计划文档的改写以"已 staged 未提交"挂在**共享索引**里(别人一次不带 pathspec 的提交就把它
      // 带走),而那 15KB 归档内容**只存在于本机**。同批把 .gitignore 改成 `.ihui-agent/*` +
      // `!.ihui-agent/archive/` 让锚点默认可入库;`-f` 是防"将来又被人加回忽略"的兜底。
      let stagedOk = false
      try {
        execFileSync(GIT_BIN, [...gitQ, 'add', '-f', '--', planRel, archiveRel], {
          cwd: ROOT,
          stdio: 'pipe',
          windowsHide: true,
          timeout: 120_000,
        })
        const staged = new Set(
          execFileSync(
            GIT_BIN,
            [...gitQ, 'diff', '--cached', '--name-only', '--', planRel, archiveRel],
            {
              cwd: ROOT,
              encoding: 'utf8',
              windowsHide: true,
              timeout: 120_000,
            },
          )
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        )
        stagedOk = staged.has(planRel) && staged.has(archiveRel)
        if (!stagedOk) {
          console.error(
            C.red +
              '❌ 归档未被索引收下(暂存集=' +
              JSON.stringify([...staged]) +
              ')—— 通常是 .gitignore 又把 .ihui-agent/archive/ 忽略了' +
              C.reset,
          )
        }
      } catch (e) {
        console.error(C.red + '❌ git add -f 失败:' + e.message + C.reset)
      }
      if (!stagedOk) {
        // 还原:**绝不留"内容已从计划里搬走、但没有任何版本记住它"的中间态**。
        // 先按 §12d 的形态逐路径撤销暂存,再把工作树写回搬运前的原文(内存里那份 content)。
        try {
          execFileSync(GIT_BIN, [...gitQ, 'restore', '--staged', '--', planRel, archiveRel], {
            cwd: ROOT,
            stdio: 'pipe',
            windowsHide: true,
            timeout: 120_000,
          })
        } catch {
          /* 撤销失败也要继续还原工作树,不在此处再抛 */
        }
        writeFileSync(PLAN_FILE, content, 'utf8')
        console.error(
          C.yellow +
            '   已回滚:计划文档还原到搬运前,归档文件留在磁盘当证据。修好忽略规则/索引后重跑即可。' +
            C.reset,
        )
        process.exit(1)
      }
      const msg = `chore(auto): 归档 ${toArchive.length} 个已完成任务条目至 .ihui-agent/archive/`
      execFileSync(
        GIT_BIN,
        [...gitQ, 'commit', '--no-verify', '-m', msg, '--', planRel, archiveRel],
        {
          cwd: ROOT,
          stdio: 'pipe',
          windowsHide: true,
          env: { ...process.env, IHUI_ARCHIVE_COMMIT: '1' },
          timeout: 120_000,
        },
      )
      console.log(`${C.green}✅ 归档 commit 已创建(IHUI_ARCHIVE_COMMIT=1 防递归)${C.reset}`)
    } catch (e) {
      console.error(`${C.red}❌ 自动 commit 失败: ${e.message}${C.reset}`)
      console.error(
        `${C.yellow}   请手动: git add PROJECT_PLAN.md .ihui-agent/archive/ && git commit${C.reset}`,
      )
    }
  }

  process.exit(0)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
