// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rustup-env 判据镜像测试(§22c:import 源脚本 __test__,判据不在测试里复抄)。
 *
 * 钉住的四型:
 *   R1 当前 HOME 有 settings.toml ⇒ noop,env 一字不动;
 *   R2 沙箱 HOME(缺 settings.toml)+ PATH 上的 cargo 住在真档案 ⇒ pinned,只给
 *      RUSTUP_HOME/CARGO_HOME 两枚(绝不动 HOME —— 那是更大改动面);
 *   R3 PATH 上没有 cargo ⇒ undecided,env 原样(§0.3 不猜);
 *   R4 cargo 找到了、但它档案位下同样没有 .rustup/settings.toml ⇒ undecided,
 *      env 原样(反"顺手猜一个 C:\Users\Administrator"的过拟合)。
 * 变异对:摘掉 pinned 分支(把 action 改回 undecided)⇒ R2 翻红。
 */
import assert from 'node:assert/strict'
import { applyRustupPinToEnv, planRustupPin } from '../lib/rustup-env.mjs'

/** 用目录清单造假盘:existsSync = 集合命中。路径统一正斜杠比对。 */
function mkExists(virtualFiles) {
  const set = new Set(virtualFiles.map((f) => f.replace(/\\/g, '/')))
  return (p) => set.has(p.replace(/\\/g, '/'))
}

// R1: HOME 即真档案(settings.toml 在) ⇒ noop
{
  const env = {
    HOME: '/home/dev',
    PATH: '/home/dev/.cargo/bin:/usr/bin',
  }
  const exists = mkExists(['/home/dev/.rustup/settings.toml', '/home/dev/.cargo/bin/cargo'])
  const r = planRustupPin({ env, platform: 'linux', existsSync: exists })
  assert.equal(r.action, 'noop')
  assert.equal(r.env, env, 'noop 必须原对象透传(env 一字不动)')
}

// R2: 沙箱 HOME 没有 settings.toml,cargo 住在 Administrator 档案 ⇒ pinned 两枚,不动 HOME
{
  const env = {
    HOME: 'C:\\Users\\Public\\Loomy\\abc',
    USERPROFILE: 'C:\\Users\\Public\\Loomy\\abc',
    PATH: 'C:\\Users\\Administrator\\.cargo\\bin;C:\\Windows\\system32',
  }
  const exists = mkExists([
    'C:/Users/Administrator/.cargo/bin/cargo.exe',
    'C:/Users/Administrator/.rustup/settings.toml',
  ])
  const r = planRustupPin({ env, platform: 'win32', existsSync: exists })
  assert.equal(r.action, 'pinned', '沙箱 HOME 病相必须给出钉正')
  assert.equal(r.env.RUSTUP_HOME, 'C:/Users/Administrator/.rustup')
  assert.equal(r.env.CARGO_HOME, 'C:/Users/Administrator/.cargo')
  assert.equal(r.env.HOME, env.HOME, '绝不动 HOME(重定向 cache 全族是更大改动面)')
  assert.ok(r.notes[0].includes('settings.toml'), 'note 必须点名判据依据')
  assert.equal(env.RUSTUP_HOME, undefined, '入参 env 不得被就地变异')
}

// R3: PATH 找不到 cargo ⇒ undecided 原样
{
  const env = { HOME: '/nowhere', PATH: '/usr/bin' }
  const exists = mkExists([])
  const r = planRustupPin({ env, platform: 'linux', existsSync: exists })
  assert.equal(r.action, 'undecided')
  assert.equal(r.env, env)
}

// R4: cargo 在 PATH,但其档案位没有可用 .rustup ⇒ undecided(不猜目录)
{
  const env = { HOME: '/sandbox', PATH: '/opt/rust/bin:/usr/bin' }
  const exists = mkExists(['/opt/rust/bin/cargo'])
  const r = planRustupPin({ env, platform: 'linux', existsSync: exists })
  assert.equal(r.action, 'undecided')
  assert.equal(r.env, env)
  assert.ok(r.notes[0].includes('不改动 env'), 'undecided 必须留话,不能静默')
}

// R5: 显式 RUSTUP_HOME 已给出且可用 ⇒ noop(即便 HOME 是沙箱位)
{
  const env = {
    HOME: '/sandbox',
    RUSTUP_HOME: '/custom/rustup',
    PATH: '/usr/bin',
  }
  const exists = mkExists(['/custom/rustup/settings.toml'])
  const r = planRustupPin({ env, platform: 'linux', existsSync: exists })
  assert.equal(r.action, 'noop')
}

// R6: PATH 目录带尾分隔符 ⇒ 仍要命中(cargo 路径拼接不能因尾 '\\' 失效)
{
  const env = { HOME: 'C:\\sandbox', USERPROFILE: 'C:\\sandbox', PATH: 'C:\\opt\\cargo\\bin;C:\\Windows' }
  const exists = mkExists(['C:/opt/cargo/bin/cargo.exe', 'C:/opt/.rustup/settings.toml'])
  const r = planRustupPin({ env, platform: 'win32', existsSync: exists })
  assert.equal(r.action, 'pinned')
  assert.equal(r.env.RUSTUP_HOME, 'C:/opt/.rustup')
}

// R7: 调用侧包装 applyRustupPinToEnv —— 三态各自的可观测性(四个桌面入口共用这一份出口)
//     pinned: 返回的 env 带两枚且日志点名两枚取值;
//     undecided: env 逐字节原样透传 + 日志必须有一行(静默的"未判定"等于没判,§0.3);
//     noop: 原对象透传且一行日志都不发(不打扰正常构建的输出面)。
{
  const sandbox = {
    HOME: 'C:\\Users\\Public\\Loomy\\abc',
    USERPROFILE: 'C:\\Users\\Public\\Loomy\\abc',
    PATH: 'C:\\Users\\Administrator\\.cargo\\bin;C:\\Windows\\system32',
  }
  const exists = mkExists([
    'C:/Users/Administrator/.cargo/bin/cargo.exe',
    'C:/Users/Administrator/.rustup/settings.toml',
  ])
  const lines = []
  const out = applyRustupPinToEnv({
    env: sandbox,
    platform: 'win32',
    existsSync: exists,
    tag: 'entry-x',
    log: (m) => lines.push(m),
  })
  assert.equal(out.RUSTUP_HOME, 'C:/Users/Administrator/.rustup')
  assert.ok(lines.some((l) => l.includes('[entry-x]') && l.includes('pinned')), 'pinned 必须带 tag 与档位')
  assert.ok(lines.some((l) => l.includes('已钉 RUSTUP_HOME=')), 'pinned 必须把取值打出来,不能只说"处理过了"')

  const lost = { HOME: '/nowhere', PATH: '/usr/bin' }
  const quiet = []
  const out2 = applyRustupPinToEnv({
    env: lost,
    platform: 'linux',
    existsSync: mkExists([]),
    tag: 'entry-y',
    log: (m) => quiet.push(m),
  })
  assert.equal(out2, lost, 'undecided 必须原对象透传(不猜目录)')
  assert.equal(quiet.length, 1, 'undecided 必须留一行话,但不许冒充"已钉正"')
  assert.ok(!quiet[0].includes('已钉'), 'undecided 不得输出"已钉"字样')

  const good = { HOME: '/home/dev', RUSTUP_HOME: '/home/dev/.rustup', PATH: '/usr/bin' }
  const none = []
  const out3 = applyRustupPinToEnv({
    env: good,
    platform: 'linux',
    existsSync: mkExists(['/home/dev/.rustup/settings.toml']),
    log: (m) => none.push(m),
  })
  assert.equal(out3, good, 'noop 必须原对象透传')
  assert.equal(none.length, 0, 'noop 不许打扰正常构建的输出面')
}

console.log('rustup-env.test.mjs: pass 7 cases')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
