#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 桌面端本机一键发版(2026-09-17 极致化):
 *   node scripts/release-desktop-local.mjs [--no-install] [--no-push] [--no-upload] [--minor|--major]
 * 流程:bump 版本 → tauri build(薄壳+签名,~2.5 分钟)→ Gitee release 直传 →
 *       desktop-feed 更新(windows)→ 提交推送 → 本机静默自装。
 *   --no-upload:跳过 Gitee 直传(本地验证构建必带;--no-push 不挡上传,见下方旗标注)。
 * 仅发 Windows(本机通道);全平台走 CI(tag → release-desktop.yml)。
 * 前置:~/.tauri/ 更新签名密钥;git credential 含 gitee.com token。
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { planArtifactInvariant } from './lib/desktop-artifact-invariant.mjs';

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
// ⚠️ NO_PUSH 只挡「版本 bump 提交」,**不挡 Gitee 上传** —— 2026-09-27 实测踩坑:
//    本地验证构建想"只出包不出网",结果把 智汇AI_0.1.44_x64-setup.exe(+sig) 传上了
//    Gitee release 成孤儿资产(Gitee API 不暴露 asset id、无法逐删,见
//    gitee-release-attach.py「asset 列表不返回 id」注释)。本地验证一律带 --no-upload。
const NO_UPLOAD = process.argv.includes('--no-upload');
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

// ── 2b. 单一产物不变量(强制):bundle 目录里**永远只允许存在当前版本这一个包** ──
// 判据本身抽到 scripts/lib/desktop-artifact-invariant.mjs(纯函数,有单测钉住),
// 这里只负责执行删除与失败退出 —— 别在脚本里再抄一份过滤逻辑。
{
  // 这里不取首轮 violations:缺包/缺 sig 已由上方 existsSync 拦住,多包就是下面要删的 stale,
  // 真正有判定意义的是**清理后**那一轮。
  const { keep, stale } = planArtifactInvariant(readdirSync(NSIS_DIR), exeName)
  const undeletable = []
  for (const f of stale) {
    try {
      rmSync(path.join(NSIS_DIR, f), { force: true })
      console.log(`🧹 清理旧产物: ${f}`)
    } catch (e) {
      undeletable.push(f)
      console.warn(
        `⚠️ 旧产物删不掉(通常是它正被一个运行中的安装器占用):${f} —— ${e?.code ?? e?.message ?? e}`,
      )
    }
  }
  const after = planArtifactInvariant(readdirSync(NSIS_DIR), exeName)
  // 违规分两类,成因与处置相反,不得合在一起判红:
  //  ① 缺当前包 / 缺当前签名 ⇒ 本次产物根本没产出 ⇒ 必须失败。
  //  ② 残留多个 setup 包 ⇒ 只是"装哪一个"的歧义风险;而本脚本下游用的是**由版本号拼出的
  //     显式路径**(见上方 exeName / exePath,刻意不靠 glob 猜包),歧义不会让它上传错版本。
  //     若残留项恰好就是刚才删不掉的那些(被进程占用),降级为警告并点名 —— 否则"另一个会话
  //     开着安装器"这种机器态会把一次**已成功**的构建伪装成整条发版失败:2026-09-27 实测
  //     即此型,裸 rmSync 抛 EPERM 让脚本崩在本步,后面 Gitee 直传 / 版本提交 / 本机自装
  //     全部没执行,而账面读起来像"发版没成功"。
  const missing = after.violations.filter((v) => v.startsWith('缺少'))
  const residue = after.violations.filter((v) => !v.startsWith('缺少'))
  if (missing.length > 0) {
    console.error(
      `ERROR: 单一产物不变量被破坏 —— ${missing.join(';')}\n` +
        `  目录 ${NSIS_DIR} 现存产物: ${after.keep.join(', ') || '(空)'}`,
    )
    process.exit(1)
  }
  if (residue.length > 0 && undeletable.length === 0) {
    // 有残留、又不是"删不掉"造成的 ⇒ 清理逻辑本身有问题,不能放过。
    console.error(
      `ERROR: 目录里仍有多个版本的包,而本次并没有"删不掉"的项 —— 清理逻辑自身失效:${residue.join(';')}`,
    )
    process.exit(1)
  }
  if (residue.length > 0) {
    console.warn(
      `⚠️ 不变量未完全成立但已放行:残留 ${undeletable.join(', ')} 正被其他进程占用。` +
        ` 下游按显式路径取 ${exeName},不受歧义影响;关掉那个安装器后请手工清一次目录。`,
    )
  }
  console.log(
    residue.length > 0
      ? `✅ 本次产物齐备:${exeName} + .sig(另有 ${undeletable.length} 个旧包因被占用而残留)`
      : `✅ 单一产物不变量成立: ${keep.length} 件(${exeName} + .sig),目录内无其他版本残留`,
  )
}

// ── 3. Gitee 直传(python 实现:undici multipart 对 Gitee 报 401,urllib 实证可行)──
if (NO_UPLOAD) {
  console.log('\n=== --no-upload:跳过 Gitee 直传,产物仅在本机 ===');
} else {
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
  env: { ...process.env, GITEE_TOKEN: giteeTok }, timeout: 120000, windowsHide: true,
});
if (gr.status !== 0) { console.error('ERROR: Gitee 发行阶段失败'); process.exit(1); }
// feed 三条链路的**真实归属**(2026-09-22 逐行核对后更正,原注释把 CI 的活记到了本机头上):
//   ① 客户端主端点 https://aizhs.top/desktop-feed.json
//      —— 由 resolve-desktop-download.mjs 刷新站点快照 `apps/web/src/config/desktop-feed.generated.ts`
//         后随 Web 部署生效(CI: sync-downloads.yml / release-desktop.yml)。本机发版脚本**不刷它**。
//   ② 客户端兜底端点 GitHub release `desktop-updater-feed/latest.json`
//      —— 由 CI 的 scripts/generate-latest-json.mjs 维护。本机通道走 gitee-release-attach.py 的
//         replace_gitee_feed + replace_github_feed,而后者开头就 `if not GH_TOKEN: return`,
//         本机只传 GITEE_TOKEN ⇒ **本机这一条是空转**,别把它当成"已同步双平台"。
//   ③ Gitee release 附件(安装包直链,供人下载,不在 updater endpoints 里)—— 本机这条真实生效。
//   曾额外传过一个 DESKTOP_FEED_OUT 环境变量,但 gitee-release-attach.py 全文不读它(死变量,已删)。
//   不再需要任何 desktop-feed 分支 git 操作(该分支会被仓库单分支守门删除)。
}

// ── 4. 提交推送版本 bump ──
if (!NO_PUSH) {
  const r = spawnSync(process.execPath, ['scripts/safe-commit.mjs', '-m', `chore(desktop): 版本 bump ${version}(本机一键发版)`, '--', 'apps/desktop/src-tauri/tauri.conf.json', 'apps/desktop/package.json'], { stdio: 'inherit', windowsHide: true });
  if (r.status !== 0) console.log('⚠️ 版本 bump 提交受阻(可能并行会话竞争),不影响已发布的 Gitee 资产');
}

console.log(`\n=== ✅ desktop v${version} 本机发版完成(Windows) ===`);
if (NO_UPLOAD) {
  console.log(`    本地产物(未上传): ${exePath}`);
} else {
  console.log(`    Gitee 直链: https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}/releases/download/desktop-v${version}/${exeName}`);
}
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
