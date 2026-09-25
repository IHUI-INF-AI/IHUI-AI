#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 唯一的"凭据落点解析"CLI —— 给 PowerShell / 批处理这类读不到 node 模块的调用方用,
 * 免得它们在本地另抄一份盘符候选(F:/D:/E:/G:/C:),那正是 §5d 记录过的"读不到文件
 * 被下游报成凭据失效"的成因。判据逻辑一律留在 scripts/lib/key-dir.mjs,这里只做出口。
 *
 * 用法:
 *   node scripts/secret-path.mjs <子目录> <文件名>   # 打印绝对路径(不含任何口令内容)
 *   node scripts/secret-path.mjs --verify <子目录> <文件名>
 *
 * 退出码:
 *   0  解析到且文件存在(stdout = 路径)
 *   1  凭据文件不存在(路径确实找不到 —— 调用方应"快速失败并说明落点",不得当成"口令错误")
 *   2  凭据**根目录**都不可达(换机/离线/未挂盘)⇒ 无法判定,同样不得说成凭据无效
 *
 * 刻意不把口令打到 stdout:调用方只要路径,自己按行读;NSSM 会把服务 stdout 落进日志。
 */
import { keyFile, resolveKeyDir, resolveSecretsRoot, SECRETS_ROOT_CANDIDATES } from './lib/key-dir.mjs'

const args = process.argv.slice(2)
const verifyOnly = args[0] === '--verify'
const [sub, name] = verifyOnly ? args.slice(1) : args

if (!sub || !name) {
  console.error('用法: node scripts/secret-path.mjs [--verify] <子目录> <文件名>')
  process.exit(2)
}

const root = resolveSecretsRoot()
if (!root) {
  console.error(
    `无法判定:凭据根目录不可达(已探候选根,取第一个存在者: ${SECRETS_ROOT_CANDIDATES.join(' | ')})`,
  )
  process.exit(2)
}

// 区分"子目录不存在"与"文件不存在":两者的处置动作不同(前者要先 mkdir),
// 混成一句"文件不存在"会让人以为写好了文件却仍读不到。判据仍走 key-dir,不自己拼路径。
const dir = resolveKeyDir(sub)
if (!dir) {
  console.error(`凭据目录不存在: ${root}/${sub} —— 先建该目录,再在其中写入一行裸口令的文件 ${name}`)
  console.error(`  已探候选根(取第一个存在者): ${SECRETS_ROOT_CANDIDATES.join(' | ')}`)
  process.exit(1)
}

const file = keyFile(sub, name)
if (!file) {
  // 必须把**探过的候选根**一起打出来:根目录挑到哪个盘是每次实测出来的(§5d/§15b 反复记过),
  // 只报"文件不存在"会把"凭据其实在另一台/另一个盘上"误判成"口令无效"。
  console.error(`凭据文件不存在: ${dir}/${name} —— 文件内容只写一行裸口令,不要加引号或键名前缀`)
  console.error(`  已探候选根(取第一个存在者): ${SECRETS_ROOT_CANDIDATES.join(' | ')}`)
  console.error('  若真实库在别处,用 IHUI_SECRETS_ROOT 或专用 env 覆盖后重试(不得在调用方另抄盘符)')
  process.exit(1)
}

if (!verifyOnly) process.stdout.write(file)
else console.log(`OK ${file}`)
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
