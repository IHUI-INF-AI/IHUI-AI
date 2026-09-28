// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 镜像测试:合并提交的身份必须"带着走"(§22c)。
 *
 * 起因(2026-09-27 05:15,IHUI-DEPLOYLOOP 服务身份):git-sync-converge 的无冲突分支调
 * `commit-tree` 时没有随带 git 身份,而 user.name/user.email 只存在于交互账户的
 * `%USERPROFILE%\.gitconfig` ⇒ LocalSystem 读不到 ⇒ 每轮 rc=128 "Author identity unknown",
 * 部署环连撞 35+ 轮不产出新构建(线上停在旧提交),而每轮仍在对生产库跑 migrate+seed。
 *
 * 为什么 `--self-test` 的用例 13-15 不够:那三条判的是**辅助函数会给正确答案**,
 * 而"生产调用点有没有把合并提交交给这个辅助函数拼"是另一格。把调用点改回裸
 * `git(['commit-tree', …])` 时三条用例一字不改仍然全绿 —— 这正是本仓记过最多次的
 * "造好没装车"(守门 64/70/81/115 同族),所以必须有一条源码级装车锁。
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '../git-sync-converge.mjs')
const UNION = resolve(HERE, '../union-converge.mjs')
const src = readFileSync(SRC, 'utf8')

test('T1 装车证明:推进 HEAD 的那枚 commit-tree 必须经 mergeCommitArgs 拼参', () => {
  // 正向:调用点确实把参数交给辅助函数
  assert.match(src, /const mergeSha = git\(\s*mergeCommitArgs\(/)
  // 反向锁:不得退回裸数组(退回去 = 服务身份下整条收敛链再次永不产出,而 self-test 仍全绿)
  assert.doesNotMatch(src, /const mergeSha = git\(\s*\[/)
})

test('T2 身份取值与 union-converge 同一份,不得自立第二档', () => {
  const grab = (text) => {
    const n = text.match(/user\.name=([^'"]+)/)
    const e = text.match(/user\.email=([^'"]+)/)
    assert.ok(n && e, '源文件里找不到 user.name/user.email 注入')
    return `${n[1]}|${e[1]}`
  }
  assert.equal(grab(src), grab(readFileSync(UNION, 'utf8')))
})

test('T3 纯函数形状:身份 -c 必须排在 commit-tree 之前,双父逐个 -p', async () => {
  const { mergeCommitArgs, GIT_MACHINE_IDENTITY } = await import(
    new URL('../git-sync-converge.mjs', import.meta.url).href
  )
  const out = mergeCommitArgs({ tree: 'T', parents: ['P1', 'P2'], message: 'M' })
  assert.equal(out.indexOf('commit-tree'), GIT_MACHINE_IDENTITY.length)
  assert.deepEqual(out, [
    ...GIT_MACHINE_IDENTITY,
    'commit-tree',
    'T',
    '-p',
    'P1',
    '-p',
    'P2',
    '-m',
    'M',
  ])
  // 单父不得产出空 -p(那会被 git 读成 root commit)
  assert.deepEqual(mergeCommitArgs({ tree: 'T', parents: 'P1', message: 'M' }), [
    ...GIT_MACHINE_IDENTITY,
    'commit-tree',
    'T',
    '-p',
    'P1',
    '-m',
    'M',
  ])
})

test('T4 阳性对照必须剥掉 git 配置,否则自检会因"本机配过身份"而恒绿', () => {
  // 用例 13 的全部价值在于复刻服务身份:两份 config 指到不存在的路径 + 抹掉 GIT_*_NAME/EMAIL。
  // 谁把这段摘掉,自检就会在交互账户下"成功",证明的却不是服务的那份环境。
  assert.match(src, /GIT_CONFIG_GLOBAL\s*=\s*resolve\(/)
  assert.match(src, /GIT_CONFIG_SYSTEM\s*=\s*resolve\(/)
  assert.match(src, /GIT_COMMITTER_EMAIL/)
  assert.match(src, /delete idEnv\[k\]/)
  assert.match(src, /identity\|auto-detect/)
})
