#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * branch-delete-with-backup.mjs —— 删分支前强制 tag 备份的收口出口(§9b「删除未合并分支前
 * 必须 tag 备份」的唯一机械实现)
 *
 * 背景(2026-10-03 事故,PROJECT_PLAN 登记行「assistant 发布切片:删分支之前不 tag 备份」):
 *   某发布工作流收尾执行 `git push origin --delete release-chunks-assistant || true`,
 *   分支尖上那批 `chunk: msi.partNN` / `chunk base (orphan)` 提交随之全部失去唯一引用,
 *   变成悬空 commit,丢 commit 防护门(30a)对每一次提交判红。17 枚历史悬空已按 §22
 *   逐枚手工补标 `lost-commit/<sha>`;发布工作流 v3 已改走 blob-SHA 直取、免分支。
 *   本工具把"删前必备份"变成**机械惯例**,防下一个发布/清理脚本再犯同一型:
 *
 *   git tag lost-commit/branch-<分支名净化>-<sha7> <分支尖>   ← 打不上 ⇒ 拒删(fail-closed)
 *   git branch -d|-D <分支>                                    ← 打上了才删
 *
 * 设计要点:
 *  - 命名沿用守门 30a 已覆盖的 `lost-commit/*` 命名空间(与 check-redline-path-naming.mjs
 *    的 probeTagName 同族):短 sha 进名字 ⇒ 天然唯一、重跑不撞;sync-lost-commit-tags.mjs
 *    的 auto-push 会顺手把它推 origin(本工具自己**绝不 push** —— 推送只归 §22 那一条链)。
 *  - **fail-closed 是本工具的全部价值**:tag 打不上(对象库异常/refs 写不进)就绝不删分支,
 *    宁可把"删不掉"留给人工,也不把"删了才发现的悬空"留给 30a。已存在的同名 tag 视为
 *    已备份(幂等),照常删。
 *  - 默认 `git branch -d`(只删已合并);`--force` 才用 -D。未合并分支在 -d 下被 git 拒绝时
 *    退出 1,**tag 已在**(备份先行,顺序不可换),由人工确认后 `--force` 重跑。
 *
 * 用法:
 *   node scripts/branch-delete-with-backup.mjs <分支名>          # 备份 + branch -d
 *   node scripts/branch-delete-with-backup.mjs <分支名> --force  # 备份 + branch -D
 *   node scripts/branch-delete-with-backup.mjs --help
 *
 * 退出码:0 = 已备份并删除(或分支本就不存在,如实报)· 1 = 备份/删除失败(现场保留)
 *          2 = 参数不成立 / 不在 git 仓内
 */
import { pathToFileURL } from 'node:url'

import { gitRaw } from './lib/face-reader.mjs'

const KNOWN_FLAGS = new Set(['--help', '-h', '--force'])

/** 分支名 → tag 名里的安全段:git ref 名不允许的字符全部换成 `-`,并截短防超长 ref。 */
export function sanitizeBranchForTag(branch) {
  return String(branch ?? '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 40) || 'unnamed'
}

/** 备份 tag 名(短 sha 进名字 ⇒ 唯一、幂等、可审计;lost-commit/* 命名空间由 30a 与 §22 链覆盖)。 */
export function buildBackupTagName(branch, sha) {
  return `lost-commit/branch-${sanitizeBranchForTag(branch)}-${String(sha).slice(0, 7)}`
}

function git(args) {
  // 派生统一走层(scripts/lib/face-reader.mjs):绝对 git + quotepath + 显式 stdio/windowsHide
  // 由 gitRaw 同源提供;失败抛 Undetermined(message 首行含 git 原话,catch 侧措辞不变)。
  return gitRaw(args, process.cwd())
}

function printHelp() {
  console.log(
    [
      'branch-delete-with-backup.mjs — 删分支前强制 tag 备份(§9b / 丢 commit 防护门 30a 配套)',
      '',
      '用法: node scripts/branch-delete-with-backup.mjs <分支名> [--force]',
      '',
      '  --force   用 git branch -D(未合并也删);默认 -d(只删已合并)',
      '',
      '流程: ① 解析分支尖 sha → ② 打带注释 tag lost-commit/branch-<净化分支名>-<sha7>',
      '      (打不上 ⇒ 拒删,exit 1)→ ③ 才删分支。本工具绝不 push;tag 上 origin 由',
      '      sync-lost-commit-tags.mjs --auto-push(post-commit 钩子)负责。',
    ].join('\n'),
  )
}

export function run(argv) {
  const args = argv.filter((a) => a !== '--')
  const unknown = args.filter((a) => a.startsWith('-') && !KNOWN_FLAGS.has(a))
  if (unknown.length) {
    console.error(
      `❌ 未知参数:${unknown.join(' ')} —— 本工具只认 <分支名> 与 --force(拼错必须当场失败,不得降级成"没删")`,
    )
    return 2
  }
  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    return 0
  }
  const positional = args.filter((a) => !a.startsWith('-'))
  if (positional.length !== 1 || !positional[0]) {
    console.error('❌ 需要恰好一个分支名:node scripts/branch-delete-with-backup.mjs <分支名> [--force]')
    return 2
  }
  const branch = positional[0]
  const force = args.includes('--force')

  // ① 分支尖必须在(本地分支)。remote-tracking/ detached 一律不收:本工具管的是"删本地分支"。
  let sha = ''
  try {
    sha = git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]).trim()
  } catch {
    sha = ''
  }
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    console.log(`ℹ️ 本地分支 ${branch} 不存在(refs/heads 解析不到)—— 无可删,也不需要备份,如实退出 0`)
    return 0
  }

  // ② 备份先行(顺序是硬约束:先 tag 后删,反了就是把症状按住而不是修根因)。
  const tagName = buildBackupTagName(branch, sha)
  try {
    git([
      'tag', '-a', tagName, sha, '-m',
      `删分支备份(§9b):分支 ${branch} 尖 ${sha},由 branch-delete-with-backup.mjs 在删除前打标保活;` +
        `否则分支一删尖端 commit 即悬空,触发丢 commit 防护门。非业务内容。`,
    ])
    console.log(`✅ 已备份:${tagName} → ${sha.slice(0, 12)}`)
  } catch (e) {
    const already = /already exists/i.test(String(e?.stderr ?? e?.message ?? ''))
    if (already) {
      console.log(`✅ 备份已存在(幂等):${tagName} → ${sha.slice(0, 12)}`)
    } else {
      console.error(
        `❌ 备份 tag 打不上(${String(e?.stderr ?? e?.message ?? e).split('\n')[0].slice(0, 160)})⇒ 拒删分支 ${branch}。` +
          `分支原样保留,先修对象库/refs 再重跑;绝不带着"没备份"往下删。`,
      )
      return 1
    }
  }

  // ③ 备份在位才允许删。
  try {
    git(['branch', force ? '-D' : '-d', branch])
    console.log(`✅ 已删除分支:${branch}(备份 tag ${tagName} 在,尖端 commit 仍可达)`)
    return 0
  } catch (e) {
    const msg = String(e?.stderr ?? e?.message ?? e).split('\n')[0]
    console.error(
      `❌ 删除分支 ${branch} 被拒(${msg.slice(0, 160)})。` +
        `备份 tag ${tagName} 已在;若确认未合并内容不需要了,用 --force 重跑(-D)。`,
    )
    return 1
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  let code = 2
  try {
    code = run(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ 脚本执行异常:${e?.message ?? e}`)
    code = 2
  }
  if (code !== 0) process.exit(code)
}

/** §22c:镜像测试直接 import 判据/构造函数,不得复制一份实现。 */
export const __test__ = { sanitizeBranchForTag, buildBackupTagName }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
