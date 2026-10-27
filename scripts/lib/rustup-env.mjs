// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rustup/cargo 工具链归属钉正判据(纯函数,零 IO —— IO 由调用方注入,§0.6 单一真相源)。
 *
 * 立因(2026-10-27 本机实测):agent 会话在 Loomy 沙箱里跑 `desktop-build.mjs`,进程
 * `HOME`/`USERPROFILE` 被沙箱根(`C:\Users\Public\Loomy\<id>`)接管,而机器真实的 rustup
 * 工具链装在**真实用户档案**(`C:\Users\<name>\.rustup`,且 `.cargo`/`.rustup` 本体是
 * junction 改道到 D 盘的 —— AGENTS §26)。rustup 按 HOME 找 `settings.toml` 找不到 ⇒
 * "no default toolchain",tauri 在 `cargo metadata` 这步直接死,报错还特别像"没装 Rust"。
 * 判机器状态的出路不能写死目录层级 —— 唯一可靠事实是:**PATH 上那个 cargo.exe 本来就住在
 * 真用户档案里**,从它反推 RUSTUP_HOME/CARGO_HOME,再验那枚 `settings.toml` 真的在。
 *
 * 方向纪律(§0.10):判不出 ⇒ `undecided`,原 env 一个字节不动、构建照跑(把真实报错留给
 * rustup 自己说);**绝不**为了"看起来修好了"去猜一个档案目录。能判出且当前 HOME 档位缺
 * `settings.toml` ⇒ 才给 RUSTUP_HOME/CARGO_HOME 两枚变量(不多不少 —— 动 HOME 会把
 * npm/pnpm/cache 全族重定向,那是比本病更大的改动面)。
 *
 * Windows 与 POSIX 同构适用(cargo 在两边都按 HOME 找 .rustup);分隔符/扩展名按 platform 分档。
 */

/** rustup 的家:显式 RUSTUP_HOME 优先,否则 $HOME/.rustup(POSIX)或 %USERPROFILE%\.rustup(Windows)。 */
export function deriveRustupHome(env, platform) {
  if (env.RUSTUP_HOME) return env.RUSTUP_HOME
  const home = platform === 'win32' ? env.USERPROFILE || env.HOME : env.HOME || env.USERPROFILE
  if (!home) return null
  return `${home.replace(/[\\/]+$/, '')}/.rustup`
}

/** `settings.toml` 在不在:rustup 判"有默认工具链可解析"的最直接落位证据(缺 = no default)。 */
export function rustupHomeUsable(rustupHome, existsSync) {
  if (!rustupHome) return false
  return existsSync(`${rustupHome.replace(/[\\/]+$/, '')}/settings.toml`)
}

/** 从 PATH 找 cargo 可执行。返回第一枚命中;找不到返回 null。纯判据,existsSync 注入。 */
export function findCargoFromPath(env, platform, existsSync) {
  const pathVar = env.PATH || env.Path || env.path || ''
  const parts = pathVar.split(platform === 'win32' ? ';' : ':')
  const names = platform === 'win32' ? ['cargo.exe', 'cargo'] : ['cargo']
  for (const dir of parts) {
    if (!dir) continue
    const norm = dir.replace(/[\\/]+$/, '')
    for (const n of names) {
      const p = `${norm}/${n}`
      if (existsSync(p)) return p
    }
  }
  return null
}

/** cargo.exe 的所在档案 ⇒ 候选 { CARGO_HOME, RUSTUP_HOME }(<home>/.cargo/bin/cargo[.exe] 的父两级)。 */
export function deriveHomesFromCargo(cargoPath) {
  if (!cargoPath) return null
  const binDir = cargoPath.slice(0, cargoPath.lastIndexOf('/'))
  const cargoHome = binDir.slice(0, binDir.lastIndexOf('/'))
  if (!cargoHome || cargoHome === binDir) return null
  const homeRoot = cargoHome.slice(0, cargoHome.lastIndexOf('/'))
  const rustupHome = `${homeRoot}/.rustup`
  return { cargoHome, rustupHome }
}

/**
 * 主出口:返回这次构建该用的 env。
 * @param {{ env: Record<string,string|undefined>, platform: string, existsSync: (p:string)=>boolean }} opts
 * @returns {{ action: 'noop'|'pinned'|'undecided', env: Record<string,string|undefined>, notes: string[] }}
 */
export function planRustupPin({ env, platform, existsSync }) {
  const notes = []
  const cur = deriveRustupHome(env, platform)
  if (rustupHomeUsable(cur, existsSync)) return { action: 'noop', env, notes }

  const cargoPath = findCargoFromPath(env, platform, existsSync)
  if (!cargoPath) {
    notes.push(`rustup 家不可用(${cur ?? '取不到 HOME'}),PATH 里也找不到 cargo —— 不改动 env,构建若挂请读 rustup 自己的报错`)
    return { action: 'undecided', env, notes }
  }
  const derived = deriveHomesFromCargo(cargoPath.replace(/\\/g, '/'))
  if (!derived || !rustupHomeUsable(derived.rustupHome, existsSync)) {
    notes.push(`cargo 命中 ${cargoPath},但其档案位下没有可用 .rustup —— 不改动 env(绝不猜目录)`)
    return { action: 'undecided', env, notes }
  }
  notes.push(`rustup 家 ${cur ?? '(无)'} 缺 settings.toml;改钉 RUSTUP_HOME=${derived.rustupHome} CARGO_HOME=${derived.cargoHome}(取自 PATH 上的 ${cargoPath})`)
  return {
    action: 'pinned',
    env: { ...env, RUSTUP_HOME: derived.rustupHome, CARGO_HOME: derived.cargoHome },
    notes,
  }
}

/**
 * 三态可见的调用侧包装 —— 四个桌面构建入口共用这一份(§0.6:同型日志写第二份必然漂移)。
 * noop 不打扰、pinned 打两枚改动、undecided 点名后原样交下去(§0.3:取不到不猜,但绝不静默)。
 * @param {{ env: Record<string,string|undefined>, platform: string, existsSync: (p:string)=>boolean, tag?: string, log?: (m:string)=>void }} opts
 * @returns {Record<string,string|undefined>}
 */
export function applyRustupPinToEnv({ env, platform, existsSync, tag = 'rustup', log = (m) => console.log(m) }) {
  const r = planRustupPin({ env, platform, existsSync })
  for (const n of r.notes) log(`[${tag}] rustup 归属:${r.action} —— ${n}`)
  if (r.action === 'pinned') log(`[${tag}] 已钉 RUSTUP_HOME=${r.env.RUSTUP_HOME} CARGO_HOME=${r.env.CARGO_HOME}`)
  return r.env
}

export const __test__ = {
  deriveRustupHome,
  rustupHomeUsable,
  findCargoFromPath,
  deriveHomesFromCargo,
  planRustupPin,
  applyRustupPinToEnv,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
