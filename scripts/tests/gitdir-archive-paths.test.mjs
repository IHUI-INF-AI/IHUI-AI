// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// gitdir 归档落点回归测试(§15b 项目外落点唯一制)。
//
// 成因:git-guardian 与 git-rebuild-local 曾各自写 `${GITDIR}.broken-<ts>`,而 GITDIR 在工作树
// 之外 ⇒ **每次现场归档都在盘根长一个新目录**(实测累计 3 个 / 1.94GB);同时 resolveBackupDir
// 只认写死的 `D:/IHUI-AI.git-backup-20260912`,备份迁入 §15b 目录后它会解析到不存在的路径,
// 使 git-guardian 报 `backupOk:false`(本地恢复源形同失效,却无人察觉)。
// 本测试钉住三件事:①归档根的推导契约;②归档出口不再落盘根;③两个调用点确实接上了出口。
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { basename, dirname, join, parse, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 遮罩只留那一份实现(§"任一门不得留本地副本"):判据面 = 注释与字符串都抹平的等长文本。
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'

import { gitArchiveDir, gitdirArchivePath, resolveBackupDir, resolveWorktree } from '../lib/gitdir.mjs'
import { gitArchiveRootFor, ensureGitArchiveDir } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

test('gitArchiveDir:要么为 null,要么落在 <盘>/DevEnv/backups/git', () => {
  const dir = gitArchiveDir()
  if (dir === null) return // 只读/换机环境允许退化,但不得抛异常
  assert.match(dir.replace(/\\/g, '/'), /\/DevEnv\/backups\/git$/)
  assert.ok(existsSync(dir), '返回的归档根必须真实存在')
})

test('gitdirArchivePath:现场归档不再落在 gitdir 同级的盘根', () => {
  const root = gitArchiveDir()
  if (!root) return
  const dst = gitdirArchivePath('IHUI-AI-git-repo.broken-TEST')
  assert.equal(dst.replace(/\\/g, '/'), `${root.replace(/\\/g, '/')}/IHUI-AI-git-repo.broken-TEST`)
  // 反向对照:旧写法会得到 `D:/IHUI-AI-git-repo.broken-TEST`(盘根),必须已被排除
  const old = `${resolveWorktree().replace(/\/$/, '')}-git-repo.broken-TEST`
  assert.notEqual(dst, old)
  assert.ok(dirname(dst.replace(/\\/g, '/')).endsWith('/backups/git'))
})

test('resolveBackupDir:备份在归档根下时必须解析到那里(而非已迁走的旧盘根路径)', () => {
  const root = gitArchiveDir()
  if (!root) return
  const name = `${basename(resolveWorktree().replace(/[\\/]+$/, ''))}.git-backup-20260912`
  if (!existsSync(join(root, name, 'HEAD'))) return // 该机未迁移,允许走兜底
  assert.equal(resolveBackupDir().replace(/\\/g, '/'), `${root.replace(/\\/g, '/')}/${name}`)
})

// —— 「装车」证明:出口若被并发旧基线写回删掉,这里必须红 ——
test('两个调用点必须真的使用 gitdirArchivePath(防"造好没装车")', () => {
  for (const f of ['../git-guardian.mjs', '../git-rebuild-local.mjs']) {
    const src = readFileSync(join(HERE, f), 'utf8')
    assert.ok(/gitdirArchivePath\(/.test(src), `${f} 未接归档出口`)
    assert.ok(/import \{[^}]*basename[^}]*\} from 'node:path'/.test(src), `${f} 缺 basename 导入`)
  }
  const g = readFileSync(join(HERE, '../git-guardian.mjs'), 'utf8')
  assert.ok(/from '\/lib\/gitdir\.mjs'|\.\/lib\/gitdir\.mjs/.test(g) && /gitdirArchivePath,/.test(g), 'guardian 未 import 出口')
})

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09-28 追加:归档根推导的**深度无关性** + **夹具不交出生产落点** + **解析无 mkdir 副作用**。
//
// 成因(盘上留证,非假想):旧推导 `resolve(wt,'..','..')` 只在「仓库恰在 `<盘>:/<仓名>`」
// 这一种布局上等于盘根。`scripts/tests/git-backup-refresh.test.mjs` 造的夹具工作树是
// `<scratch>/wtNNNNNN`(两层深),向上两级正好落在 scratch 根 ⇒ 现场归档写进临时根,
// 而 `gitArchiveDir()` 里那句 mkdirSync 当场把它创建出来。实测盘上残留
// `G:/DevEnv/Temp/ihui-scratch/DevEnv/backups/git`(2,311 B / 10 文件 / 7 目录,
// meta 的 unitId 是 `post-commit-*` ⇒ 提交链上的 git-lock 抢占跑出来的)。
// §5b/§15b 把这里当"现场归档唯一出口",落点随深度漂 = 把恢复现场放进宿主清理层的射程。
//
// 三条约束必须**同时**成立,少任何一条都不算修好:
//   ① 深度无关(盘根锚定)——单靠它会把**夹具也**解析到生产归档根,比原缺陷更糟;
//   ② 真仓解析结果逐字不变(§5b 的恢复链按这个路径读);
//   ③ 夹具解析不得等于生产归档根 + 解析函数零 mkdir(否则测试往生产归档堆垃圾)。
// 所以 ① 必须与 ③ 的夹具闸配对出现,下面 D1/D2 成对钉这条耦合。
// ─────────────────────────────────────────────────────────────────────────────

/** 真仓锚定值**由被审工作树现推**,不得写死盘符(§15b 盘符禁死)。 */
function expectedRootFor(worktree) {
  return `${parse(worktree).root.replace(/[\\/]+$/, '')}/DevEnv/backups/git`.replace(/\\/g, '/')
}

test('D1 深度无关:同盘上 1..6 层深的合成工作树,归档根全部等于同一个盘根值', () => {
  const wt = resolveWorktree()
  const want = expectedRootFor(wt)
  for (let depth = 1; depth <= 6; depth++) {
    const segs = []
    for (let i = 0; i < depth; i++) segs.push(`lv${i}`)
    const synth = `${parse(wt).root.replace(/[\\/]+$/, '')}/ihui-depth-absent/${segs.join('/')}/IHUI-AI`
    const got = gitArchiveRootFor(synth)
    assert.equal(got, want, `depth=${depth} 解析漂了:${got} ≠ ${want}(旧写法这里会长出 ${depth} 种答案)`)
  }
})

test('D2 夹具闸:落在 §26 scratch 里的工作树一律解析为 null(不得交出生产归档根)', () => {
  const dir = mkScratch('gitdir-archive-')
  try {
    for (const depth of [0, 1, 2, 3]) {
      let wt = dir
      for (let i = 0; i < depth; i++) wt = join(wt, `L${i}`)
      mkdirSync(wt, { recursive: true })
      // 解析函数不得有 mkdir 副作用:夹具根下**不允许**长出 DevEnv 那一棵
      assert.equal(gitArchiveRootFor(wt), null, `depth=${depth} 夹具工作树被交出了归档根`)
      assert.equal(gitArchiveDir(wt), null, `depth=${depth} gitArchiveDir 夹具侧未返回 null`)
      assert.equal(gitdirArchivePath('scene.broken-T', wt), null, `depth=${depth} 夹具侧写出了归档路径`)
      assert.equal(
        existsSync(join(dir, 'DevEnv')),
        false,
        `depth=${depth} 解析/出口自己创建了 <夹具>/DevEnv ⇒ mkdir 副作用没搬走`,
      )
    }
    // 反向对照:夹具闸不是"永远 null" —— 真仓工作树必须照旧解析得出(否则本闸把防护做成瘫痪)
    assert.equal(gitArchiveDir(resolveWorktree()), expectedRootFor(resolveWorktree()))
  } finally {
    rmScratch(dir)
  }
})

test('D3 逐字不变:真仓解析结果 == 盘根/DevEnv/backups/git,且不因夹具闸而改变', () => {
  const wt = resolveWorktree()
  const got = gitArchiveDir()
  if (got === null) return // 只读/换机环境允许退化(与既有第一条同源约定),但不得抛
  assert.equal(got, expectedRootFor(wt), `真仓归档根漂了:${got}`)
  assert.match(got, /\/DevEnv\/backups\/git$/)
  // §15b 的实质不变量:归档必须在**工作树之外**。旧写法靠"仓恰在盘根下一级"才碰巧成立,
  // 深度一变就落回树内(实测 depth=2/3 时落在 <夹具>/L*/DevEnv/backups/git),所以这里
  // 钉的是判据真正在乎的那件事,而不是那套耦合。
  const inTree = got.startsWith(`${wt.replace(/\\/g, '/')}/`) || got === wt.replace(/\\/g, '/')
  assert.equal(inTree, false, `归档根落进工作树里了:${got} ⊂ ${wt}`)
})

test('D4 建目录只在写归档的出口:ensureGitArchiveDir 缺目录时建得出、生产根不因其被绕过', () => {
  const dir = mkScratch('gitdir-ensure-')
  try {
    const missing = join(dir, 'DevEnv', 'backups', 'git')
    assert.equal(existsSync(missing), false, '夹具不该预先带着 DevEnv 树')
    assert.equal(ensureGitArchiveDir(missing), true, 'ensure 没把缺的归档根建出来 ⇒ 写归档必然失败')
    assert.equal(existsSync(missing), true)
    // ensure 建的这个落点**不等于**生产归档根(盘符由夹具所在盘现推,不写死)
    assert.notEqual(missing.replace(/\\/g, '/'), gitArchiveDir(resolveWorktree()))
    assert.equal(ensureGitArchiveDir(null), false, '空 root 必须判不可用,不得当通过')
  } finally {
    rmScratch(dir)
  }
})

test('D5 解析面零 mkdir:gitArchiveDir / gitArchiveRootFor 不得自带建目录(建目录只在出口)', () => {
  // 源码级反向锁:判据失效的表现永远是安静,而"把 mkdir 搬回解析函数"在盘上只会多长一棵树,
  // 运行期断言测不到别人那台机,所以这一格只能用源码形状钉(§22c 镜像测试同取向)。
  // **判据面 = 遮罩面**(注释与字符串抹掉的等长文本,遮罩实现全仓只有一份 `lib/code-mask.mjs`):
  // 本模块的头注要解释旧写法错在哪,不遮注释的话"门判自己的散文"就会恒红(守门 131 那一课,
  // 本票实测踩过一次)。代价如实登记:遮罩把字符串也抹了,所以"两级推导的字面量"这种
  // 文本形态在本面**判不出来** —— 那一格由 D1(逐层同值)与 D2(夹具必为 null + 不落 DevEnv)
  // 的行为断言兜:改回按深度推导,这两条当场翻红,字面量锁只是第二道。
  const masked = maskCommentsAndStrings(readFileSync(resolve(join(HERE, '../lib/gitdir.mjs')), 'utf8'))
  const fnBody = (name) => {
    const at = masked.indexOf(`export function ${name}(`)
    if (at < 0) return null
    const next = masked.indexOf('\n}\n', at)
    return next < 0 ? null : masked.slice(at, next)
  }
  for (const name of ['gitArchiveDir', 'gitArchiveRootFor']) {
    const body = fnBody(name)
    assert.ok(body, `${name} 出口不见了`)
    assert.ok(!/mkdirSync\s*\(/.test(body), `${name} 里又出现 mkdirSync ⇒ 只读询问会自己长出一棵归档目录树`)
  }
  const ensure = fnBody('ensureGitArchiveDir')
  assert.ok(ensure && /mkdirSync\s*\(/.test(ensure), '建目录没落在 ensureGitArchiveDir 这一处出口')
  const exitFn = fnBody('gitdirArchivePath')
  assert.ok(exitFn && /ensureGitArchiveDir\(/.test(exitFn), 'gitdirArchivePath 未调用建目录出口 ⇒ 写归档会因父目录不存在而失败')
})

test('D6 resolveBackupDir 必须把注入的工作树传到底(夹具侧不得挂上生产归档候选)', () => {
  // 与 `git-backup-refresh.mjs:198` 那处被静默丢弃的入参同一条缺陷的第二格:函数收 worktree,
  // 却在内部调 `gitArchiveDir()` 不传 —— 于是"算名字用注入值、算落点用全局值",
  // 夹具的备份解析会挂上一条指向生产归档根的第一候选(永不命中 ⇒ 账面看不出来)。
  // 行为判据:工作树**已不存在**时,唯一可能的候选来源就是它自己的同级 —— 若第一候选
  // 来自生产归档根,返回的就是那条不存在的生产候选路径,与同级路径不等,当场翻红。
  const dir = mkScratch('gitdir-backup-')
  try {
    const ghost = join(dir, 'gone-wt')
    const want = join(dir, 'gone-wt.git-backup-20260912').replace(/\\/g, '/')
    assert.equal(resolveBackupDir(ghost).replace(/\\/g, '/'), want, 'resolveBackupDir 的第一候选被生产归档根截胡')
    // 反向对照:真仓工作树照旧允许生产归档根作第一候选(不得把防护做成"永远同级")
    const wt = resolveWorktree()
    const root = gitArchiveDir(wt)
    if (root) {
      const prodCand = `${root}/${basename(wt)}.git-backup-20260912`
      assert.equal(resolveBackupDir(wt).replace(/\\/g, '/'), prodCand.replace(/\\/g, '/'))
    }
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
