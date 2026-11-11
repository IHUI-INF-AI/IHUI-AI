// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  judgePushRemoteUrl,
  judgePushWindow,
  HTTPS_REMOTE_HINT,
  SSH_REMOTE_HINT,
} from '../lib/push-window-gate.mjs'

// ─── 病理(2026-11-07 实测;2026-11-11 修订) ──────────────────────────────
// `.husky/post-commit` → `scripts/lib/post-commit-hook.js` 的缺省行为是"只要
// HUSKY_SKIP_PUSH !== '1' 就自动推";而 origin 是 `ssh://git@ssh.github.com:443/...`,
// 不是硬约束要求的显式 https 地址 ⇒ 一次默认行为 + 一个 SSH remote = 一次违规推送。
// 本文件的每一条都在钉"缺省 = 不推",而不是"缺省 = 推"。
//
// 2026-11-11 修订:原判据只准 https,而本机 GitHub 常规 443 不可达,唯一通道是
// `ssh://git@ssh.github.com:443`,且机主后定铁律「origin 必须 ssh、严禁改回 https」。
// 旧判据让 guard **永久 exit 1**(每轮刷 failed),人只能绕开它手推 ⇒ 模块整体失效。
// 修订只放宽**协议白名单**(https + ssh),窗口闸与危险协议拒绝一律不动 ——
// "不自动推"由 PUSH_WINDOW 独立承担,与协议无关。下面每条都保留了这个分工的牙。

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'git-push-guard.mjs')
const GUARD_SRC = readFileSync(SCRIPT_PATH, 'utf8')

const HTTPS_ORIGIN = 'https://github.com/IHUI-INF-AI/IHUI-AI.git'
const SSH_ORIGIN = 'ssh://git@ssh.github.com:443/IHUI-INF-AI/IHUI-AI.git'

// ─── 纯判据:协议闸 ─────────────────────────────────────

test('协议闸:ssh:// 目标 ⇒ 放行并原样回显(2026-11-11 修订:本机唯一可用通道)', () => {
  const v = judgePushRemoteUrl(SSH_ORIGIN)
  assert.equal(v.ok, true, 'ssh:// 是本机唯一可用通道,必须放行')
  assert.equal(v.code, 'ssh')
  assert.equal(v.url, SSH_ORIGIN, '放行也必须原样回显目标 URL(便于日志追责)')
})

test('协议闸:scp-like / git:// / file:// / 本地路径 / 相对路径一律拒绝', () => {
  const refused = [
    'git@github.com:IHUI-INF-AI/IHUI-AI.git',
    'git@ssh.github.com:IHUI-INF-AI/IHUI-AI.git',
    'git://github.com/IHUI-INF-AI/IHUI-AI.git',
    'file:///D:/IHUI-AI/.git',
    'D:/IHUI-AI/.git',
    'C:\\repo\\bare.git',
    '/tmp/ihui-bare.git',
    '../bare.git',
    'plain-string',
  ]
  for (const url of refused) {
    const v = judgePushRemoteUrl(url)
    assert.equal(v.ok, false, `${url} 必须被拒`)
    assert.equal(v.code, 'unsafe-remote', `${url} 的拒绝码`)
    assert.equal(v.url, url, `${url} 必须原样回显`)
    assert.match(v.reason, /本轮不推/)
  }
})

test('协议闸:显式 https 放行;大小写与尾随空白不影响;空值 = 未判定 ⇒ 拒绝', () => {
  for (const url of [
    HTTPS_ORIGIN,
    `  ${HTTPS_ORIGIN}  `,
    'HTTPS://github.com/IHUI-INF-AI/IHUI-AI.git',
  ]) {
    const v = judgePushRemoteUrl(url)
    assert.equal(v.ok, true, `${url} 应放行`)
    assert.equal(v.code, 'https')
    assert.equal(v.url, url.trim())
  }
  for (const empty of [null, undefined, '', '   ']) {
    const v = judgePushRemoteUrl(empty)
    assert.equal(v.ok, false, '取不到 URL 不得读成合规(未判定 ≠ 通过)')
    assert.equal(v.code, 'remote-unreadable')
    assert.match(v.reason, /取不到目标远端 URL/)
  }
  assert.equal(HTTPS_REMOTE_HINT, HTTPS_ORIGIN, '正确写法必须与硬约束逐字一致')
})

test('协议闸:ssh 同样受支持;大小写不敏感;只有协议头的残缺值仍拒', () => {
  for (const [url, code] of [
    [SSH_ORIGIN, 'ssh'],
    [`  ${SSH_ORIGIN}  `, 'ssh'],
    ['SSH://git@ssh.github.com:443/IHUI-INF-AI/IHUI-AI.git', 'ssh'],
  ]) {
    const v = judgePushRemoteUrl(url)
    assert.equal(v.ok, true, `${url} 应放行`)
    assert.equal(v.code, code)
    assert.equal(v.url, url.trim(), '放行时 URL 必须是 trim 后的原文')
  }
  // 主机段为空的残缺值不得因为"协议名对"就放行
  for (const bare of ['ssh://', 'https://', 'ssh:// ', 'https:///path']) {
    const v = judgePushRemoteUrl(bare)
    assert.equal(v.ok, false, `${bare} 不得放行(没有主机段)`)
    assert.equal(v.code, 'unsafe-remote')
  }
  assert.equal(SSH_REMOTE_HINT, SSH_ORIGIN, 'ssh 正确写法必须与实测通道逐字一致')
})

// ─── 纯判据:窗口闸 ─────────────────────────────────────

test('窗口闸:缺省 = 无窗口 ⇒ 拒绝,且文案点名"提交已落地本地"', () => {
  for (const env of [{}, { PUSH_WINDOW: '' }, { PUSH_WINDOW: '0' }, { PUSH_WINDOW: 'true' }]) {
    const v = judgePushWindow(env)
    assert.equal(v.ok, false, `${JSON.stringify(env)} 不得被读成有窗口`)
    assert.match(v.reason, /推送窗口未开启/)
    assert.match(v.reason, /本轮不推/)
    assert.match(v.reason, /提交已落地本地/)
  }
  const absent = judgePushWindow({})
  assert.equal(absent.code, 'window-absent')
  assert.equal(absent.value, '(未设置)')
})

test('窗口闸:只有显式 PUSH_WINDOW=1 才放行', () => {
  const v = judgePushWindow({ PUSH_WINDOW: '1' })
  assert.equal(v.ok, true)
  assert.equal(v.code, 'window-open')
  assert.equal(judgePushWindow({ PUSH_WINDOW: ' 1 ' }).ok, false, '带空白的 1 不算显式')
})

// ─── 端到端:真跑 guard(全程本地桩,不联网、不推真远端) ─────
// 夹具:work + 本地 bare;origin 的 **raw 配置**写硬约束里的 https 地址,
// 再用 `url.<bare>.insteadOf` 把实际传输落到 bare(测试桩)。
// 这样三道闸的素材都是真的:URL 原文取得到、ls-remote 能到、push 能落地。

function sh(cmd, cwd) {
  return execSync(cmd, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 120_000,
  })
}

function createRepoWithStubbedOrigin() {
  const work = mkScratch('ihui-pwg-work-')
  const bare = mkScratch('ihui-pwg-bare-')
  const bareUrl = bare.replace(/\\/g, '/')
  sh(`git init --bare -b main "${bareUrl}"`, work)
  sh('git init -b main', work)
  for (const [k, v] of [
    ['user.email', 't@e.co'],
    ['user.name', 't'],
    ['commit.gpgsign', 'false'],
  ])
    sh(`git config --local ${k} "${v}"`, work)
  sh(`git remote add origin "${HTTPS_ORIGIN}"`, work)
  sh(`git config --local "url.${bareUrl}.insteadOf" "${HTTPS_ORIGIN}"`, work)
  writeFileSync(join(work, 'README.md'), '# init\n')
  sh('git add README.md', work)
  sh('git commit -m init', work)
  sh('git push -u origin main', work)
  return { work, bare, bareUrl }
}

function makeAheadCommit(work, name = 'ahead.txt') {
  writeFileSync(join(work, name), 'x\n')
  sh(`git add "${name}"`, work)
  sh(`git commit -m "feat: ${name}"`, work)
}

function runGuard(cwd, env = {}) {
  return spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 180_000,
    // 缺省清空窗口与跳过变量 —— 每条用例只测它自己显式给的那一档
    env: { ...process.env, GUARD_ASYNC: '0', HUSKY_SKIP_PUSH: '', PUSH_WINDOW: '', ...env },
  })
}

function remoteMain(work) {
  return sh('git ls-remote origin refs/heads/main', work).split('\t')[0].trim()
}

test('端到端:SSH origin + 已开窗口 ⇒ 放行并真落地(桩内,不联网)', () => {
  const { work, bare, bareUrl } = createRepoWithStubbedOrigin()
  try {
    // 目标改成真实通道的 SSH 地址;insteadOf 只把**传输**落到本地 bare,
    // raw 配置仍是 ssh ⇒ 闸读到的就是"要推给谁"。
    sh(`git remote set-url origin "${SSH_ORIGIN}"`, work)
    sh(`git config --local "url.${bareUrl}.insteadOf" "${SSH_ORIGIN}"`, work)
    makeAheadCommit(work, 'ssh-ahead.txt')
    const localSha = sh('git rev-parse HEAD', work).trim()
    const r = runGuard(work, { PUSH_WINDOW: '1' })
    assert.equal(r.status, 0, `ssh + 窗口应放行,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.doesNotMatch(
      r.stdout,
      /unsafe-remote|本轮不推|推送窗口未开启/,
      '放行的一轮不得出现拒绝文案',
    )
    assert.equal(remoteMain(work), localSha, '放行后 local == remote(测试桩内)')
  } finally {
    rmScratch(work)
    rmScratch(bare)
  }
})

test('端到端:危险协议 origin(file://) + 已开窗口 ⇒ 仍在推送前被协议闸拒(远端 tip 一动没动)', () => {
  const { work, bare, bareUrl } = createRepoWithStubbedOrigin()
  // 直接读 bare 仓库自身的 ref —— 不经过 origin 解析,免得 insteadOf 改写干扰判据。
  // 用 ls-remote 而不是 `--git-dir=... rev-parse`:后者在 cwd 也属于某个仓时会受
  // GIT_DIR 环境/路径解析干扰,本机实测出现过「before 读到桩仓、after 读成主仓 HEAD」
  // 的串仓假红;ls-remote 只认参数里给的那个仓,不读 cwd,读数稳定。
  const bareTip = () => sh(`git ls-remote "${bareUrl}" refs/heads/main`, work).split('\t')[0].trim()
  try {
    const before = bareTip()
    const fileUrl = `file:///${bareUrl.replace(/^\/+/, '')}`
    sh(`git remote set-url origin "${fileUrl}"`, work)
    sh(`git config --local "url.${bareUrl}.insteadOf" "${fileUrl}"`, work)
    makeAheadCommit(work, 'file-ahead.txt')
    const localSha = sh('git rev-parse HEAD', work).trim()
    const r = runGuard(work, { PUSH_WINDOW: '1' })
    assert.equal(r.status, 1, `危险协议应拒绝并 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.ok(r.stdout.includes(fileUrl), '必须回显目标 URL 原文')
    assert.match(r.stdout, /不是受支持的显式传输协议|本轮不推/)
    assert.doesNotMatch(r.stdout, /push 成功|验证通过/, '被拒的一轮不得出现"推送成功"')
    assert.equal(bareTip(), before, '协议闸拒绝后远端 tip 必须未变')
    assert.equal(sh('git rev-parse HEAD', work).trim(), localSha, '提交留在本地')
  } finally {
    rmScratch(work)
    rmScratch(bare)
  }
})

test('端到端:https origin 但缺 PUSH_WINDOW ⇒ 窗口闸拒绝(远端未变)', () => {
  const { work, bare } = createRepoWithStubbedOrigin()
  try {
    makeAheadCommit(work, 'window-ahead.txt')
    const before = remoteMain(work)
    const r = runGuard(work) // 显式不给 PUSH_WINDOW
    assert.equal(r.status, 1, `无窗口应拒绝并 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /推送窗口未开启/)
    assert.match(r.stdout, /提交已落地本地/)
    assert.doesNotMatch(r.stdout, /push 成功|验证通过/, '无窗口的一轮不得出现"推送成功"')
    assert.equal(remoteMain(work), before, '窗口闸拒绝后远端 tip 必须未变')
  } finally {
    rmScratch(work)
    rmScratch(bare)
  }
})

test('端到端:https origin + PUSH_WINDOW=1 ⇒ 放行(桩内真落地,不联网)', () => {
  const { work, bare } = createRepoWithStubbedOrigin()
  try {
    makeAheadCommit(work, 'allow-ahead.txt')
    const r = runGuard(work, { PUSH_WINDOW: '1' })
    assert.equal(r.status, 0, `两道闸都过应推送成功,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.doesNotMatch(
      r.stdout,
      /违反 HTTPS 显式地址约束|推送窗口未开启/,
      '放行的一轮不得再出现拒绝文案',
    )
    assert.equal(
      remoteMain(work),
      sh('git rev-parse HEAD', work).trim(),
      '放行后 local == remote(测试桩内)',
    )
  } finally {
    rmScratch(work)
    rmScratch(bare)
  }
})

// ─── 装车反向锁:判据在、主流程没用它 = 没有 ─────────────
test('装车锁:guard 必须真调这两道闸,且读的是 origin URL 原文', () => {
  assert.match(GUARD_SRC, /from '\.\/lib\/push-window-gate\.mjs'/, 'guard 未引用闸模块')
  assert.ok(GUARD_SRC.includes('judgePushRemoteUrl(originUrl)'), '协议闸未被主流程调用')
  assert.ok(GUARD_SRC.includes('judgePushWindow(process.env)'), '窗口闸未被主流程调用')
  assert.ok(
    GUARD_SRC.includes('git config --get remote.origin.url'),
    '取材必须是 remote.origin.url 原文(不用 get-url 的 insteadOf 展开结果)',
  )
  assert.doesNotMatch(
    GUARD_SRC,
    /PUSH_WINDOW\s*!==\s*'1'|PUSH_WINDOW\s*===\s*'0'/,
    '窗口判据不得在 guard 里另写一份(单一真相源在 lib/push-window-gate.mjs)',
  )
})
