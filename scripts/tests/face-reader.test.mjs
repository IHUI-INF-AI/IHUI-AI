// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/face-reader.mjs` 的镜像测试。
 *
 * 这道层要解决的是"同一个易错口径被三门各抄一份"。而**收口本身没有哨兵就会重新腐烂**
 * (本仓对豁免清单的教训:`RN_ONLY_BRAND_KEYS` 那种清单过期了没人发现)。所以本文件守两件事:
 *   ① 层自身的四条硬规矩还在(绝对路径 git / batch 的 stdio[0] 是 pipe / 有 timeout / 仓库根比较穿 junction);
 *   ② 三门真的挂在这层上,且没有偷偷自己拼 git 派生。
 * 每条否定式判据都配**阳性对照**:先拿一段"违规写法"喂同一个判据函数,证明它能抓得住,
 * 否则"0 命中"可能只是尺子坏了。
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  FACES,
  FACE_LABEL,
  Undetermined,
  catBatch,
  gitBinary,
  selectFace,
} from '../lib/face-reader.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const scriptsDir = join(here, '..')
const read = (f) => readFileSync(join(scriptsDir, f), 'utf8')

/** 三门:各自都已收敛到共用层(守门 91 = 主题接线、94 = 错误码覆盖、101 = 锁与清单对账) */
const GATES = [
  'check-theme-prop-wiring.mjs',
  'check-error-code-coverage.mjs',
  'check-lock-manifest-consistency.mjs',
]

test('层自身:绝对路径 git(裸 "git" 会让服务账户/GUI 宿主下的取数静默失败)', () => {
  const bin = gitBinary()
  assert.ok(/[\\/]/.test(bin) && bin.length > 5, `gitBinary() 退化成裸命令: ${bin}`)
  const src = read('lib/face-reader.mjs')
  assert.match(src, /from '\.\/gitdir\.mjs'/, '未走 resolveGitBin —— 又变成各自猜路径')
  assert.match(src, /resolveGitBin\(\) \|\| 'git'/, '兜底必须显式写在层里,不得散在各门')
})

test('层自身:cat-file --batch 的 stdio[0] 必须是 pipe(设成 ignore 会让每个 rev 都"取不到")', () => {
  const src = read('lib/face-reader.mjs')
  const at = src.indexOf("'cat-file', '--batch'")
  assert.ok(at > 0, '层里找不到 cat-file --batch —— 这条陷阱的归宿没了')
  const block = src.slice(at, at + 700)
  assert.match(block, /stdio:\s*\[\s*'pipe',\s*'pipe',\s*'pipe'\s*\]/)
  assert.match(block, /input:\s*Buffer\.from\(/, 'rev 清单必须由 input 喂进去')
  assert.match(block, /timeout:\s*[A-Z_]+|timeout:\s*\d+/, '无数字 timeout ⇒ 守门 80 那类无界挂起')
  // maxBuffer 是模块级常量,不在调用点写数字 —— 判据要跟它的真身对齐
  assert.match(src, /const GIT_MAX_BUFFER = 64 << 20/, 'maxBuffer 常量必须给足(真仓有 >1MB 单文件)')
  assert.match(src, /maxBuffer: opts\.maxBuffer \?\? GIT_MAX_BUFFER/)
  assert.match(block, /maxBuffer: GIT_MAX_BUFFER/, 'batch 调用必须吃到那个常量')
})

test('层自身:gitRaw 必须显式接管 stdio(否则子进程 stderr 会漏进守门自己的判定输出)', () => {
  const src = read('lib/face-reader.mjs')
  const at = src.indexOf('export function gitRaw')
  assert.ok(at > 0, '找不到 gitRaw —— 派生入口改名了')
  const block = src.slice(at, src.indexOf('\nexport ', at + 10))
  assert.match(
    block,
    /stdio:\s*\[\s*'ignore',\s*'pipe',\s*'pipe'\s*\]/,
    'gitRaw 未接管 stdio ⇒ `fatal: …` 会直接写在门的 stderr 上;各门只会被迫加 --quiet 绕行',
  )
})

test('层自身:仓库根比较必须穿 junction(本机 DevEnv 系是改道路径)', () => {
  const src = read('lib/face-reader.mjs')
  assert.match(
    src,
    /realpathSync/,
    'assertRepoRoot 未走 realpath ⇒ junction 会把正常仓判成"基准错位"',
  )
  assert.match(src, /--show-toplevel/)
})

test('层自身:面集合固定为三个,两面旗同给必须返回 error 而不是任选一边', () => {
  assert.deepEqual(FACES, ['staged', 'head', 'worktree'])
  assert.equal(Object.keys(FACE_LABEL).length, 3)
  assert.equal(selectFace({ staged: true, worktree: true }).face, null)
  assert.match(selectFace({ staged: true, worktree: true }).error, /不得同用/)
  assert.equal(selectFace({ staged: true }).face, 'staged')
  assert.equal(selectFace({ worktree: true }).face, 'worktree')
  assert.equal(selectFace({}).face, 'head', '默认必须是 HEAD,不得默认工作树')
})

test('取材失败必须走 Undetermined 而不是"当作不存在"(静默少扫 = 偏绿)', () => {
  assert.equal(typeof Undetermined.prototype, 'object')
  const src = read('lib/face-reader.mjs')
  assert.match(src, /class Undetermined extends Error/)
  assert.match(src, /throw new Undetermined\(`git \$\{args\[0\]\} 失败/)
})

/** 阳性对照用的"违规写法"样本:证明下面那条判据真的能抓住裸 git,而不是恒过 */
const BAD_SAMPLE = `const x = execFileSync('git', ['status'], { cwd: root })\nconsole.log(execFileSync("git", ["ls-files"]))\n`
const bareGitCount = (text) =>
  (text.match(/execFileSync\(\s*['"]git['"]/g) || []).length +
  (text.match(/execSync\(\s*['"]git\b/g) || []).length

test('判据本身不恒真:同一把尺子必须能抓住违规样本、而对三门均为 0', () => {
  assert.equal(bareGitCount(BAD_SAMPLE), 2, `尺子连样本都抓不住(实得 ${bareGitCount(BAD_SAMPLE)})`)
  assert.equal(bareGitCount("execFileSync(GIT_BIN, ['status'])"), 0, '走常量的正确写法不得误报')
  for (const f of GATES) assert.equal(bareGitCount(read(f)), 0, `${f} 里仍有自拼的裸 git 派生`)
})

test('装车证明:三门都必须真的 import 这一层', (t) => {
  for (const f of GATES) {
    const src = read(f)
    if (!existsSync(join(scriptsDir, f))) {
      t.skip(`${f} 不在盘上 ⇒ 未判定,不计为通过`)
      continue
    }
    assert.match(
      src,
      /from '\.\/lib\/face-reader\.mjs'/,
      `${f} 未 import 共用层 —— 收口被绕开,重复实现会重新长回来`,
    )
  }
})

test('真实取材抽查:HEAD 面能读到大 blob(>1MB 的那个语言包),证明 maxBuffer 真的够', () => {
  const root = join(here, '..', '..')
  const map = catBatch(root, ['HEAD:package.json', 'HEAD:nope/missing.ts'])
  const pkg = map.get('HEAD:package.json')
  assert.ok(pkg && pkg.length > 3000, `package.json 取到的内容异常短: ${pkg && pkg.length}`)
  assert.equal(map.get('HEAD:nope/missing.ts'), null, 'missing 必须是 null,不得抛成"仓库坏了"')
})

// ───────────────────────── 棘轮:存量认账,增量不认 ─────────────────────────
//
// 本票只收了被点名的三门(91/94/101)。但同一类重复实测还有两摊:
//   · 自拼裸 `git` 派生的 scripts/ 生产文件(实测 33 个)
//   · 自拼 `cat-file --batch` 却没走本层的门(本票实测 9 个,不含本层自己)
// 一次性扫 80 个文件会与各并行会话在提交链上对撞,且多数只是 `git status` 一类一次性调用;
// 所以这里不"顺手全改",而是**钉住不许再长**:数量只减不增,降了不更新基线也算提示。
// 与守门 70/77 的棘轮同一取向 —— 存量债记账,新增债拦停。

/**
 * 基线 = 当次实测真值(扫 scripts/ 生产文件)。调高它必须先在此说明理由。
 * ⚠️ 这个数会随收口下降;下降时测试只提示不拦停,请在同一票里把基线一并下调。
 * 历史:09-25 首量 80 → 修尺子(补 shell 串式与 spawnSync 两型)后真值 82 → 本批 8 道门收口后重定。
 */
const BARE_GIT_BASELINE = 82
const SELF_BATCH_BASELINE = 9

function productionScripts(root) {
  const out = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) {
        if (/(tests|__mocks__|node_modules)/.test(e.name)) continue
        walk(p)
        continue
      }
      if (/\.(mjs|js|cjs)$/.test(e.name)) out.push(p)
    }
  }
  walk(join(root, 'scripts'))
  return out
}

/**
 * 裸 git 派生的计数尺子。⚠️ 必须同时覆盖两个维度,少一个都会让棘轮"看起来在收口、实际没量到":
 *  · 入口:`execFileSync` / `execSync` / `spawnSync` / `spawn` 四种(`git-push-guard` 用的就是 spawnSync);
 *  · 形态:数组式 `execFileSync('git', […])` **和** shell 串式 `execSync('git status --porcelain')`
 *    —— 后者 `git` 后面跟的是空格而不是引号,只匹配 `['"]git['"]` 会把它整类漏掉(实测本仓有大量这种写法)。
 * 判据要覆盖自己想拦的那一种形态,否则分母骗人。
 */
const BARE_GIT_RE = /(execFileSync|execSync|spawnSync|spawn)\(\s*['"]git(?:\.exe)?(?=['"\s])/g
const bareGitCountOf = (text) => (text.match(BARE_GIT_RE) || []).length

function filesWith(root, predicate) {
  const hits = []
  for (const p of productionScripts(root)) {
    let src
    try {
      src = readFileSync(p, 'utf8')
    } catch {
      continue // 读不到交给判据本身暴露,不在这里静默跳过
    }
    if (predicate(src)) hits.push(p.slice(root.length + 1).replace(/\\/g, '/'))
  }
  return hits
}

test('棘尺本身不恒真:两个计数函数都能真抓到注入的样本', () => {
  assert.equal(bareGitCountOf("execFileSync('git', ['status'])"), 1)
  // shell 串式:`git` 后面跟的是空格,只匹配 `['"]git['"]` 会整类漏掉(本仓大量存在)
  assert.equal(
    bareGitCountOf("execSync('git status --porcelain', { cwd })"),
    1,
    'shell 串式裸 git 必须被量到',
  )
  // 漏了这一型,`git-push-guard` 就会从分母里隐身 —— 四种派生入口都要认
  assert.equal(
    bareGitCountOf("spawnSync('git', ['cat-file'], { cwd })"),
    1,
    'spawnSync 裸 git 必须被量到',
  )
  assert.equal(bareGitCountOf('spawn(process.execPath, [s])'), 0, 'node 自身派生不得误报')
  assert.equal(bareGitCountOf("execSync('gitk --everything')"), 0, '同前缀的别的程序不得误报')
  assert.equal(
    bareGitCountOf("execFileSync(GIT_BIN, ['status'])"),
    0,
    '走常量/走层的正确写法不得误报',
  )
  assert.equal(
    bareGitCountOf("execFileSync('git', ['a'])\nspawnSync('git', ['b'])"),
    2,
    '同文件多处分别计',
  )
  const hasBatch = (s) => /cat-file.{0,4}--batch/.test(s)
  assert.equal(hasBatch("x = execFileSync(G, ['cat-file', '--batch'])"), true)
  // `--batch-check` 同族(同样一次问一批对象的存在性/sha,同样有 stdio/maxBuffer 陷阱),必须计入
  assert.equal(hasBatch("spawnSync('git', ['cat-file', '--batch-check'])"), true)
  assert.equal(hasBatch('const a = 1'), false)
})

test('裸 git 派生的生产文件数只减不增(存量记在基线,新增拦停)', () => {
  const root = join(here, '..', '..')
  const hits = filesWith(root, (s) => bareGitCountOf(s) > 0)
  assert.ok(
    hits.length <= BARE_GIT_BASELINE,
    `裸 git 派生的生产文件从基线 ${BARE_GIT_BASELINE} 涨到 ${hits.length} —— ` +
      '新增者请改用 scripts/lib/face-reader.mjs 的 gitRaw(绝对路径 git + quotepath + timeout)。' +
      `本次新增候选:${hits.slice(0, 8).join(', ')}`,
  )
  if (hits.length < BARE_GIT_BASELINE) {
    console.log(
      `◽ 裸 git 存量已降到 ${hits.length}(基线 ${BARE_GIT_BASELINE})—— 收口有效,请把基线一并下调`,
    )
  }
})

test('自拼 cat-file --batch 却不走本层的门,数量只减不增', () => {
  const root = join(here, '..', '..')
  // 本层自己当然要有 batch —— 不排除它,这条就永远多算 1 个,且真正的"新增第 N 份"会被掩盖
  const hits = filesWith(
    root,
    (s) => /cat-file.{0,4}--batch/.test(s) && !/lib\/face-reader/.test(s),
  ).filter((p) => !p.endsWith('lib/face-reader.mjs'))
  assert.ok(
    hits.length <= SELF_BATCH_BASELINE,
    `自拼 batch 取材的门从基线 ${SELF_BATCH_BASELINE} 涨到 ${hits.length}: ${hits.join(', ')} —— ` +
      '每条 batch 都要重写一遍 stdio[0]=pipe / maxBuffer / 头解析,而这三处本仓都真踩过',
  )
  console.log(`◽ 未收口的自拼 batch 取材:${hits.length} 个(${hits.join(', ') || '无'})`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
