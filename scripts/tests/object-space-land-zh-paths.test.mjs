// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/object-space-land.mjs 的提交面回读对**中文名**路径的判定(票 D171)。
// 票面:提交面回读若用"git 输出文本逐字比对"(不还原 quotePath 八进制转写),已成功的
// 交付会被报成失败 exit 1。本器该判据已被 G-801 换成 cat-file -e 逐路径问 git 的结论
// (路径作为 argv 直接传给 git,不经过输出文本,天然免疫转写);D171 再把混提辅助清单
// 统一到 lib/git-paths 的 -z 出口(形状锁见 object-space-land.test.mjs 的 T-G801-4)。
// 本文件把票面两格钉死:
//  ① 声明侧与 git 侧判同值:含中文名的路径真在树里 ⇒ commitFacePresence 判 present;
//  ② 反向对照:声明一个树里不存在的中文名 ⇒ 仍判 absent(main 的 notProven=absent
//     分支照旧 exit 1)—— 否则 ① 只是把判据关掉。
// git 写操作只发生在临时仓内(§26 夹具落点),绝不碰真仓索引与 refs。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ } from '../object-space-land.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GIT = resolveGitBin() || 'git'

const ZH_PATH = 'docs/项目说明/8端一致性 认证矩阵.txt' // 中文目录 + 中文名 + 内含空格
const ZH_MISSING = 'docs/项目说明/不存在 的中文文档.txt'

const runGit = (dir, args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

function zhRepo(t) {
  const dir = mkScratch('osl-zh-')
  t.after(() => {
    try {
      rmScratch(dir)
    } catch (e) {
      // 本环境的 safe-delete shim 对 >50 项的批量删要求确认(git 夹具的 .git 项数天然超限)。
      // 清理失败不得改写判据结论(scratch-dir 退出路径的同一纪律);残留交 §26 每日 Temp 体检兜。
      console.warn(`⚠ D171 夹具清理未执行 ${dir}:${e?.message ?? e}`)
    }
  })
  mkdirSync(join(dir, 'docs', '项目说明'), { recursive: true })
  runGit(dir, ['init', '-q'])
  runGit(dir, ['config', 'user.email', 'gates@ihui.test'])
  runGit(dir, ['config', 'user.name', 'gates-zh'])
  writeFileSync(join(dir, 'a.txt'), 'v1\n')
  writeFileSync(join(dir, ZH_PATH), '中文路径的正文\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'init: 中文名与 ASCII 路径'])
  return dir
}

test('D171 中文名判同值(①):中文名路径真在树里 ⇒ commitFacePresence 判 present,声明侧与 git 侧判同值', (t) => {
  const dir = zhRepo(t)
  const head = runGit(dir, ['rev-parse', 'HEAD']).trim()
  const paths = [ZH_PATH, 'a.txt']
  const res = __test__.commitFacePresence({ root: dir, commit: head, paths })
  assert.deepEqual(
    res.present,
    paths,
    `声明路径(含中文名)必须逐条判 present,实得 ${JSON.stringify(res)}`,
  )
  assert.deepEqual(res.absent, [], '在树里的中文名不得被报成"缺路径"(G-801 的假失败形态)')
  assert.deepEqual(res.undetermined, [], '判得出的路径不得滑进未判定')
  assert.equal(
    res.present.length + res.absent.length + res.undetermined.length,
    paths.length,
    '三态必须闭合到清单长度',
  )
  // git 自己的结论独立佐证:同一根路径 rev-parse 必须解析得到(两侧判同值)
  runGit(dir, ['rev-parse', '--verify', '--quiet', `${head}:${ZH_PATH}`])
})

test('D171 中文名仍红(②):声明一个树里不存在的中文名 ⇒ commitFacePresence 判 absent(exit 1 判红出口仍红)', (t) => {
  const dir = zhRepo(t)
  const head = runGit(dir, ['rev-parse', 'HEAD']).trim()
  assert.equal(existsSync(join(dir, ZH_MISSING)), false, '夹具自证:该中文名盘上也不存在')
  const paths = [ZH_PATH, ZH_MISSING]
  const res = __test__.commitFacePresence({ root: dir, commit: head, paths })
  assert.deepEqual(res.present, [ZH_PATH], '在树的中文名照旧判 present(①的牙没被拆)')
  assert.deepEqual(
    res.absent,
    [ZH_MISSING],
    '不存在的中文名必须判 absent ⇒ main 的 notProven 分支照旧 exit 1(反向对照,判据没被关掉)',
  )
  assert.deepEqual(res.undetermined, [])
  assert.equal(
    res.present.length + res.absent.length + res.undetermined.length,
    paths.length,
    '三态闭合:非 ASCII 的缺项被明确判 absent,既没被静默跳过也没折进未判定',
  )
})
