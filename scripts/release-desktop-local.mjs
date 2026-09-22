#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面端本机一键发版(2026-09-17 极致化):
 *   node scripts/release-desktop-local.mjs [--no-install] [--no-push] [--minor|--major]
 * 流程:bump 版本 → tauri build(薄壳+签名,~2.5 分钟)→ Gitee release 直传 →
 *       desktop-feed 更新(windows)→ 提交推送 → 本机静默自装。
 * 仅发 Windows(本机通道);全平台走 CI(tag → release-desktop.yml)。
 * 前置:~/.tauri/ 更新签名密钥;git credential 含 gitee.com token。
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const cwd0 = process.cwd();
const ROOT = /apps[\\/]desktop$/.test(cwd0) ? path.resolve(cwd0, '../..') : cwd0;
const DESKTOP = path.join(ROOT, 'apps/desktop');
const CONF = path.join(DESKTOP, 'src-tauri/tauri.conf.json');
const PKG = path.join(DESKTOP, 'package.json');
const NSIS_DIR = path.join(DESKTOP, 'src-tauri/target/release/bundle/nsis');
const GITEE_OWNER = 'JLSLSSZWHYXGS_0';
const GITEE_REPO = 'IHUI-AI';

const NO_INSTALL = process.argv.includes('--no-install');
const NO_PUSH = process.argv.includes('--no-push');
const KEEP_VERSION = process.argv.includes('--keep-version');
const BUMP = process.argv.includes('--minor') ? 'minor' : process.argv.includes('--major') ? 'major' : 'patch';

// python 解析:Windows 上裸 `python` 会命中 Microsoft Store 的占位 stub
// (执行即打印 "Python was not found" 并非零退出 → Gitee 发行阶段必挂),
// 故优先仓库 venv 绝对路径,不依赖 PATH(AGENTS.md §5b 同一纪律)。
const PYTHON_CANDIDATES = [
  path.join(ROOT, 'apps/ai-service/.venv/Scripts/python.exe'),
  path.join(ROOT, 'apps/ai-service/.venv/bin/python'),
];
const pythonBin = PYTHON_CANDIDATES.find((p) => existsSync(p)) ?? 'python3';

const sh = (cmd, opts = {}) => execSync(cmd, { stdio: opts.quiet ? 'pipe' : 'inherit', encoding: 'utf8', windowsHide: true, ...opts });

// ── 1. 版本 bump ──
const conf = JSON.parse(readFileSync(CONF, 'utf8'));
const old = conf.version;
const [maj, mid, pat] = old.split('.').map(Number);
const version = KEEP_VERSION
  ? old
  : BUMP === 'major'
    ? `${maj + 1}.0.0`
    : BUMP === 'minor'
      ? `${maj}.${mid + 1}.0`
      : `${maj}.${mid}.${pat + 1}`;
if (!KEEP_VERSION) {
  conf.version = version;
  writeFileSync(CONF, JSON.stringify(conf, null, 2) + '\n');
  const pkg = JSON.parse(readFileSync(PKG, 'utf8'));
  pkg.version = version;
  writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`\n=== 版本 ${old} → ${version} ===`);
} else {
  console.log(`\n=== 复用当前版本 ${version}(--keep-version,产物已构建)===`);
}

// ── 2. tauri build(薄壳:前端跳过;env 经 spawnSync 传递,Windows cmd 不支持前缀变量)──
const keyPath = path.join(process.env.USERPROFILE || '', '.tauri/ihui-updater.key');
const exeName = `智汇AI_${version}_x64-setup.exe`;
if (!existsSync(keyPath)) {
  console.error(`ERROR: 更新签名密钥缺失 ${keyPath}`);
  process.exit(1);
}
const key = readFileSync(keyPath, 'utf8').trim();
const pwd = readFileSync(path.join(process.env.USERPROFILE || '', '.tauri/ihui-updater-password.txt'), 'utf8').trim();
const buildEnv = {
  ...process.env,
  TAURI_SKIP_FRONTEND: '1',
  TAURI_SIGNING_PRIVATE_KEY: key,
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: pwd,
};
const build = spawnSync('pnpm', ['exec', 'tauri', 'build'], { cwd: DESKTOP, stdio: 'inherit', env: buildEnv, shell: true, windowsHide: true });
if (build.status !== 0) {
  console.error('ERROR: tauri build 失败');
  process.exit(1);
}

const exePath = path.join(NSIS_DIR, exeName);
const sigPath = `${exePath}.sig`;
if (!existsSync(exePath) || !existsSync(sigPath)) {
  console.error(`ERROR: 产物缺失 ${exePath}`);
  process.exit(1);
}
const exeSize = (statSync(exePath).size / 1e6).toFixed(1);
console.log(`\n=== 产物: ${exeName} (${exeSize}MB) + sig ===`);

// ── 3. Gitee 直传(python 实现:undici multipart 对 Gitee 报 401,urllib 实证可行)──
const giteeScript = path.join(ROOT, '.github/scripts/gitee-release-attach.py');
// 2026-09-17:git credential 里的 gitee 凭证对 API 无效(31 位,实证 401)——
// 优先用密钥目录的 apikey(32 位,实证有效),回退环境变量
const GITEE_KEY_FILE = 'F:/BaiduSyncdisk/密钥/git仓库/gitee apikey.txt';
const giteeTok = existsSync(GITEE_KEY_FILE)
  ? readFileSync(GITEE_KEY_FILE, 'utf8').trim()
  : process.env.GITEE_TOKEN;
if (!giteeTok) { console.error('ERROR: 无法获取 gitee.com token(密钥文件与环境变量均无)'); process.exit(1); }
const gr = spawnSync(pythonBin, [giteeScript, '--tag', `desktop-v${version}`, '--exe', exePath, '--sig', sigPath, '--version', version], {
  stdio: 'inherit',
  env: { ...process.env, GITEE_TOKEN: giteeTok, DESKTOP_FEED_OUT: path.join(ROOT, '.ihui-agent/desktop-feed/latest.json') }, timeout: 120000, windowsHide: true,
});
if (gr.status !== 0) { console.error('ERROR: Gitee 发行阶段失败'); process.exit(1); }
// feed 已改为 release 附件 + 站点快照方案(2026-09-17):
//   - GitHub/Gitee release desktop-updater-feed 附件由 gitee-release-attach.py 维护
//   - 站点端点 https://aizhs.top/desktop-feed.json 由 resolve-desktop-download.mjs 刷新快照后部署生效
//   - 不再需要任何 desktop-feed 分支 git 操作(该分支会被仓库单分支守门删除)

// ── 4. 提交推送版本 bump ──
if (!NO_PUSH) {
  const r = spawnSync(process.execPath, ['scripts/safe-commit.mjs', '-m', `chore(desktop): 版本 bump ${version}(本机一键发版)`, '--', 'apps/desktop/src-tauri/tauri.conf.json', 'apps/desktop/package.json'], { stdio: 'inherit', windowsHide: true });
  if (r.status !== 0) console.log('⚠️ 版本 bump 提交受阻(可能并行会话竞争),不影响已发布的 Gitee 资产');
}

console.log(`\n=== ✅ desktop v${version} 本机发版完成(Windows) ===`);
console.log(`    Gitee 直链: https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}/releases/download/desktop-v${version}/${exeName}`);
console.log(`    全平台(macos/linux)如需发布: git tag desktop-v${version} && git push origin desktop-v${version} 触发 CI`);

// ── 5. 本机静默自装 ──
if (!NO_INSTALL) {
  const running = spawnSync('tasklist', [], { windowsHide: true }).stdout?.toString().toLowerCase().includes('ihui-desktop');
  if (running) {
    console.log('⚠️ 桌面端正在运行,跳过自装(请关闭后重跑或手动安装)');
  } else {
    sh(`"${exePath}" /S`);
    console.log(`=== 已静默安装 v${version},重启桌面端即生效 ===`);
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
