// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 部署脚本「git 调用必须钉住生产签出那一本仓」的源码锁(2026-10-26 实测事故逼出)。
 *
 * 现场(逐条可复现,不是推测):2026-10-26 16:21 那轮手动部署的日志写着
 *   「=== 部署完成,HEAD=76941775480 ===」,而那一轮真正要上线的是 e3138d80576 —— 一枚更新的提交。
 * 追因(实测证据):
 *   ① 生产签出 prod 的 FETCH_HEAD mtime 停在 15:33、内容是旧的 769417754(本轮 fetch 根本没碰它);
 *   ② 本轮 fetch 打印的源是 `ssh://ssh.github.com:443/…` —— 那是**主仓 D:\IHUI-AI** 的 origin,
 *      不是 prod 的 origin(HTTPS);主仓的 FETCH_HEAD mtime 正是 16:21、内容是 e3138d80576;
 *   ③ 日志里「本地落后远端 N 个提交,进行 fast-forward merge」那一行**整行缺失**
 *      ⇒ behind 被算成 0 ⇒ ff-only 整段被跳过 ⇒ prod 根本没被推进;
 *   ④ 构建面却按 `$Root`(prod)的 HEAD 取源码 ⇒ 造出的是 769417754 ⇒ 切的是旧版本,
 *      健康门禁全绿、日志写「部署成功」,没有任何一处会为"新版本没上线"报警。
 * 成因是结构性的:ihui-deploy.ps1 里**取源 / 定 tip / 算 behind / 快进**这四处 git 调用
 * 当年全是**当前工作目录相对**的(没有 `-C $Root`)。手工从主仓起脚本 ⇒ fetch 打进主仓、
 * FETCH_HEAD 读的是主仓那份、behind 的 HEAD 也是主仓的 HEAD ⇒ 三个决策全部对着**另一个仓**做。
 *
 * 判据(本文件即唯一真相源,不复制实现):
 *   L1 本文件里**每一条** `& git …` 调用都必须带 `-C $Root` ⇒ 读到的永远是生产签出那一本仓;
 *   L2 每一条 `Invoke-GitWithTimeout -GitArgs …` 的参数里都必须带 `'-C', $Root`
 *      (fetch 是取源入口;读错仓 = 把另一个仓的 FETCH_HEAD 当本轮 tip);
 *   L3 三条变异对照各改一处 ⇒ 必须翻红(证明锁有牙,而不是"今天恰好满足");
 *   L4 注释里描述旧形态不得被算成违规(注释不是代码)。
 *
 * 为什么不并进 deploy-diverged-autorecover.test.mjs:那个文件守的是「分叉先自愈、
 * 连续多轮才报警」那一族(ff 竞态 R1–R3);本族是「取源面读错仓库」,成因、判据面、变异点都不同,
 * 混在一处会让两族互相掩护(改坏一族时另一族仍绿 ⇒ 看起来还有人在守)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC = readFileSync(join(ROOT, 'deploy/win/ihui-deploy.ps1'), 'utf8')

/** 剥掉整行注释(PowerShell 只有 # 行注释这一种;判定面先剥注释,免得门在自己解释自己的散文上恒红)。 */
function stripPsComments(src) {
  return src
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('#'))
    .join('\n')
}

/**
 * 判据本体(可对任意源码调用 ⇒ 变异对照必须用同一份实现,否则测的是副本)。
 * @param {string} src
 */
export function assertRepoPinned(src) {
  const code = stripPsComments(src)
  const fails = []
  const lines = code.split('\n')
  lines.forEach((line, i) => {
    // ① `& git …` 调用:必须显式钉仓。
    //    判据面先把**双引号字符串**剥掉(补救文案里写给人看的 `git tag … && git push …`
    //    是字符串不是调用;`&&` 的第二个 & 也会被裸 `/& git/` 误认成调用 ⇒ 加否定后顾)。
    const bare = line.replace(/"[^"]*"/g, '""')
    if (/(?<!&)& git\b/.test(bare) && !/-C\s+\$Root\b/.test(bare)) {
      fails.push(`行 ${i + 1}:git 调用未钉仓库(-C $Root 缺失):${line.trim()}`)
    }
    // ② 带墙钟的 fetch 调用:参数里必须带 '-C', $Root(这一条读原行 —— 单引号串是判据本身的一部分)
    if (/Invoke-GitWithTimeout\s+-GitArgs/.test(line) && !/'-C',\s*\$Root/.test(line)) {
      fails.push(`行 ${i + 1}:取源调用未钉仓库('-C', $Root 缺失):${line.trim()}`)
    }
  })
  if (fails.length) throw new Error(`取源面未钉仓库:\n  - ${fails.join('\n  - ')}`)
}

test('L1/L2 真文件:ihui-deploy.ps1 的每条 git 调用都钉在 $Root', () => {
  assertRepoPinned(SRC)
})

test('L3-1 变异:去掉 FETCH_HEAD 定格那一刀的 -C $Root 必须翻红', () => {
  const mutant = SRC.replace(/& git -C \$Root rev-parse FETCH_HEAD/, '& git rev-parse FETCH_HEAD')
  assert.notEqual(mutant, SRC, '夹具没生效(定位不到 FETCH_HEAD 定格调用)')
  assert.throws(() => assertRepoPinned(mutant), /未钉仓库/, '去掉钉仓后仍判通过 ⇒ 这条锁没有牙')
})

test('L3-2 变异:去掉快进那一刀的 -C $Root 必须翻红', () => {
  const mutant = SRC.replace(
    /& git -C \$Root merge --ff-only \$remoteTip/g,
    '& git merge --ff-only $remoteTip',
  )
  assert.notEqual(mutant, SRC, '夹具没生效(定位不到快进调用)')
  assert.throws(() => assertRepoPinned(mutant), /未钉仓库/, '去掉钉仓后仍判通过 ⇒ 这条锁没有牙')
})

test('L3-3 变异:去掉取源 fetch 的 -C $Root 必须翻红', () => {
  const mutant = SRC.replace(
    /@\('-C', \$Root, 'fetch', 'origin', 'main'\)/,
    "@('fetch', 'origin', 'main')",
  )
  assert.notEqual(mutant, SRC, '夹具没生效(定位不到取源 fetch 调用)')
  assert.throws(() => assertRepoPinned(mutant), /未钉仓库/, '去掉钉仓后仍判通过 ⇒ 这条锁没有牙')
})

test('L4 反向锁:注释里描述旧形态不得被算成违规', () => {
  const withExtraDoc =
    SRC +
    '\n# 历史写法曾为 & git rev-parse FETCH_HEAD 与 & git merge --ff-only $remoteTip(未钉仓库)\n'
  assertRepoPinned(withExtraDoc)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
