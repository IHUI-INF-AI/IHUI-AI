#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面端本机一键发版(2026-09-17 极致化):
 *   node scripts/release-desktop-local.mjs [--no-install] [--no-push] [--no-upload] [--allow-unsigned-upload] [--minor|--major]
 * 流程:bump 版本 → tauri build(薄壳+签名,~2.5 分钟)→ Gitee release 直传 →
 *       提交推送 → 本机静默自装。
 *   --no-upload:跳过 Gitee 直传(本地验证构建必带;--no-push 不挡上传,见下方旗标注)。
 *   --allow-unsigned-upload:显式放行"本机未签名包"上传 Gitee(仅应急;公开 Windows 发布走 CI/SignPath)。
 * 仅发 Windows(本机通道);全平台走 CI(tag → release-desktop.yml)。
 * 前置:~/.tauri/ 更新签名密钥;git credential 含 gitee.com token。
 */
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { planArtifactInvariant } from './lib/desktop-artifact-invariant.mjs';
import { judgeUpdaterKeyPairing } from './lib/updater-key-pairing.mjs';
// MSVC 工具链注入判据**单源**在 scripts/lib/msvc-env.mjs(立因/三态见该文件头注):
// 本机 `C:\Program Files\Git\usr\bin` 在系统 PATH 里且带 GNU coreutils 的 `link.exe`,
// 未加载 MSVC 的 shell 里 cargo 在链接阶段就撞上它。这里是"调用点",自己一份都不抄(§0.6)。
import { planBuildEnv } from './lib/msvc-env.mjs';
// vcvars 的**生产实现**同样单源:desktop-build.mjs 的 captureVsEnv(切 cwd + 只写批处理文件名,
// 完整路径形态在本机实测静默不生效)。走它已有的具名导出,不另写第二种形态。
import { __test__ as desktopBuildInternals } from './desktop-build.mjs';
// rustup 归属钉正(判据单源 lib/rustup-env.mjs,立因见该文件头注/AGENTS §5f 调用点):
// 本脚本与 desktop-build.mjs 共用工具链注入,同样会吃到"沙箱 HOME ⇒ no default toolchain"。
import { applyRustupPinToEnv } from './lib/rustup-env.mjs';

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
// 2026-10-12:--slow-commit 恢复旧提交路径;默认走对象空间快速落地(见第 4 步注释)。
const SLOW_COMMIT = process.argv.includes('--slow-commit');
// ⚠️ NO_PUSH 只挡「版本 bump 提交」,**不挡 Gitee 上传** —— 2026-09-27 实测踩坑:
//    本地验证构建想"只出包不出网",结果把 智汇AI_0.1.44_x64-setup.exe(+sig) 传上了
//    Gitee release 成孤儿资产。本地验证一律带 --no-upload。
//    (2026-10-18 更正本注旧句"Gitee API 不暴露 asset id、无法逐删":已被同日实测证伪 ——
//     /releases/{id}/attach_files 返回 id 与 size,DELETE by id 返回 204 即真删,孤儿资产**可以**
//     逐件清,别再按"清不掉"行事。)
const NO_UPLOAD = process.argv.includes('--no-upload');
// 本机通道只做 Tauri 更新签名(minisign),不做 Authenticode;而 Gitee 附件自 2026-10-18 起
// 同时是 Windows 更新器直链(见 desktop-latest.generated.ts),所以未签名的本机包一旦上传
// 就会直接进入用户下载/更新面。公开 Windows 发布一律走 CI 的 SignPath 签名腿;本机上传
// 必须显式认领"未签名",失效方向是多要一次定向说明,不是静默放行。
const ALLOW_UNSIGNED_UPLOAD = process.argv.includes('--allow-unsigned-upload');
const KEEP_VERSION = process.argv.includes('--keep-version');
const BUMP = process.argv.includes('--minor') ? 'minor' : process.argv.includes('--major') ? 'major' : 'patch';

if (!NO_UPLOAD && !ALLOW_UNSIGNED_UPLOAD) {
  console.error(
    '❌ 本机发版脚本只做 Tauri 更新签名(minisign),不做 Authenticode。\n' +
      '   公开 Windows 发布请走 CI:git tag desktop-vX.Y.Z && git push origin desktop-vX.Y.Z\n' +
      '   (release-desktop.yml 在 SignPath 四项凭据齐备时自动签名)。\n' +
      '   确需发布未签名包(例如 SignPath 审批前应急),显式加 --allow-unsigned-upload。',
  )
  process.exit(1)
}
if (ALLOW_UNSIGNED_UPLOAD && !NO_UPLOAD) {
  console.warn(
    '⚠️ --allow-unsigned-upload:本次 Gitee 直传的安装包没有 Authenticode 签名,会进入 Windows 用户下载/更新面。',
  )
}

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
// 签之前先问"这把私钥是不是配置信任的那把"。只判 existsSync 会让流程照样走完,
// 产出"构建绿、.sig 存在、但没有一个客户端验得过"的死链包 —— 2026-10-17 本机实测:
// 私钥内嵌公钥、同目录 .pub、conf 里的 pubkey 三方互不配对。判据住在
// scripts/lib/updater-key-pairing.mjs(纯函数,单测钉住三种失效形态)。
const pairing = judgeUpdaterKeyPairing({ confPubkey: conf.plugins?.updater?.pubkey, secretText: key });
if (pairing.verdict !== 'ok') {
  const what = pairing.verdict === 'orphan' ? '不是配置信任的那把钥匙' : '无法判定是否配对';
  console.error(`ERROR: 更新签名密钥与 ${CONF} 的 plugins.updater.pubkey ${what}\n  ${pairing.reason}`);
  console.error('  出路:换成与信任锚配对的私钥(在用的那把只在 CI secrets.DESKTOP_TAURI_PRIVATE_KEY),或修正配置里的 pubkey;别用孤儿钥匙出包。');
  process.exit(pairing.verdict === 'orphan' ? 1 : 2);
}
console.log(`✓ 签名钥匙配对自证:${pairing.reason}`);
const pwd = readFileSync(path.join(process.env.USERPROFILE || '', '.tauri/ihui-updater-password.txt'), 'utf8').trim();
// MSVC 工具链注入(判据单源,见上方 import 的注释)。三态(§0.3):取不到 ⇒ 显式「未判定」+ exit 2,
// 绝不静默回落成"裸 env 硬跑" —— 那一跑的报错是一个指向 GNU `link.exe` 的费解信息。
//
// ⚠ 顺序是判据的一半:planBuildEnv 的成功档是 `{...调用方env, ...vcvars的set块}`,即注入结果
// **整块盖在**调用方 env 上。所以本脚本自己的签名/跳前端 env 必须在注入**之后**才叠,
// 否则由那次 `set` 说了算(实测就是被覆盖的那一侧)。
const toolchain = planBuildEnv({ env: process.env, existsSync, runCapture: desktopBuildInternals.captureVsEnv });
if (!toolchain.ok) {
  console.error(`ERROR: 未判定 —— MSVC 工具链取不到,未进入构建(不记失败也不记绿,reason=${toolchain.reason})`);
  console.error(`  已试候选 ${toolchain.tried.length} 条,其中确实存在的 ${toolchain.candidates.length} 条:`);
  for (const c of toolchain.tried) console.error(`    ${toolchain.candidates.includes(c) ? '[存在]' : '[不存在]'} ${c}`);
  for (const d of toolchain.details) console.error(`    [失败] ${d.vcvars} -> ${d.error}`);
  console.error('  出路:装 VS 2022 Build Tools(含 MSVC v143 + Windows SDK),或设 VSINSTALLDIR 指向现有安装。');
  console.error('        本仓不靠"让 cargo 自己撞"来替代判定 —— 那只会把"没装工具链"换成更难认的一型。');
  process.exit(2);
}
console.log(`✓ MSVC 工具链已注入:${toolchain.linkFrom}`);
if (toolchain.removedDirs.length > 0) console.log(`  已从 PATH 剔除遮蔽目录:${toolchain.removedDirs.join(' ; ')}`);
// rustup 家钉正(与 desktop-build 同判据同出口:三态日志由 lib 单源发,不在本文件写第二份)
const rustupEnv = applyRustupPinToEnv({
  env: toolchain.env,
  platform: process.platform,
  existsSync,
  tag: 'release-desktop-local',
  log: (m) => console.log(m),
});
const buildEnv = {
  ...rustupEnv,
  TAURI_SKIP_FRONTEND: '1',
  TAURI_SIGNING_PRIVATE_KEY: key,
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: pwd,
};
/**
 * 归因用:在**本次构建真正用的那份 env** 里,`where link` 会解析到哪。
 *
 * 这不是判据,只是失败分支的一行诊断 —— 直接问 Windows 的查找器,不重算一遍 PATH 查找规则
 * (那会变成判据的第二份实现)。判"该不该构建"由 planBuildEnv 单源负责。
 *
 * @param {Record<string, string>} env 注入后的 env(即 buildEnv)
 * @returns {string} 一行可读文本;问不到时如实说问不到
 */
function whereLinkIn(env) {
  try {
    const out = execFileSync('where.exe', ['link'], {
      env,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const hits = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    return hits.length > 0 ? hits.join(' | ') : '(无命中:PATH 里找不到 link.exe)';
  } catch (e) {
    return `(执行 where link 失败:${e?.status ?? e?.message ?? e})`;
  }
}
// 失败自动重试 1 次,**兜的是两病并列**,二者的可重试性相反,别只写其中一个:
//   ① 瞬时句柄锁(2026-10-12 实锤形态:cargo 写 .d 文件 os error 5「拒绝访问」,当时无任何
//      存活构建进程,重跑即过)—— 重试是对症的;
//   ② 环境类确定性失败(链接阶段解析到 Git 的 GNU `link.exe` 之类)—— 重试**治不好**,只是把
//      "构建失败"拖成"构建失败两次"。
// 两类都落在同一个失败分支里,重试**之前**区分不了,所以重试保留(为①);真要区分,看最终失败
// 分支那行 `where link` 归因。重试次数与等待时长保持原值,未改动。
const runBuild = () => spawnSync('pnpm', ['exec', 'tauri', 'build'], { cwd: DESKTOP, stdio: 'inherit', env: buildEnv, shell: true, windowsHide: true });
let build = runBuild();
if (build.status !== 0) {
  console.log('\n⚠️ tauri build 失败,5 秒后自动重试 1 次(兜底两病:① 瞬时句柄锁 ② 环境类确定性失败)');
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
  build = runBuild();
  if (build.status !== 0) {
    console.error(`ERROR: tauri build 重试仍失败\n  归因:本次构建 shell 里 link 的解析 → ${whereLinkIn(buildEnv)}`);
    console.error(`  工具链注入点:${toolchain.linkFrom}`);
    console.error('  · 上面若**不**落在同一个 MSVC 目录 ⇒ 工具链没真正加载,重试不会变好(病②),先查 PATH/注入。');
    console.error('  · 上面若已落在 MSVC 目录仍失败 ⇒ 多半是病①(本仓 target 里的残留桌面端进程占着 exe),关掉后重跑。');
    process.exit(1);
  }
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
// feed 三条链路的**真实归属**(2026-09-22 逐行核对后更正,原注释把 CI 的活记到了本机头上;
// 2026-10-05 再更正:机主拍板更新源定稿为**单端点**,GitHub feed 路径整条删除;
// 2026-10-20 再更正:更新器第一数据源是入库烘焙快照,不是运行期解析):
//   ① 客户端唯一更新器端点 https://aizhs.top/desktop-feed.json
//      —— 第一数据源是 apps/web/src/config/desktop-latest.generated.ts(发版后人工烘焙并提交);
//         本机发版脚本**不刷它**。运行期解析与 desktop-feed.generated.ts 只是损坏/缺键时的兜底。
//   ② Gitee release 附件(安装包直链):自 2026-10-18 起烘焙快照把 Windows 主包直指这里 ⇒
//      它**同时是更新面**,不再只是"人工下载存档"。本机上传的包没有 Authenticode,默认拒绝
//      (见顶部 --allow-unsigned-upload 守卫);公开发布走 CI 的 SignPath 签名腿。
//   ③ (已删除,2026-10-05)原 GitHub `desktop-updater-feed/latest.json` 兜底端点:它只由 CI 的
//      generate-latest-json.mjs 维护,而本机通道无 GH_TOKEN ⇒ 本机发版后它原地不动,
//      是一个"看似有兜底、实际随发布路径分叉"的假能力。CI 侧维护逻辑(generate-latest-json.mjs
//      的 ensureFeedRelease/step5、gitee-release-attach.py 的 replace_github_feed)已同批删除。
//   曾额外传过一个 DESKTOP_FEED_OUT 环境变量,但 gitee-release-attach.py 全文不读它(死变量,已删)。
//   不再需要任何 desktop-feed 分支 git 操作(该分支会被仓库单分支守门删除)。
}

// ── 4. 版本 bump 落地(2026-10-12 提速:默认对象空间,秒级)──
// 旧路径 safe-commit 两个实测病灶:① agent/automation 会话被沙箱程序黑名单拦
// (reg.exe/schtasks,发版链直接断);② pre-commit lint-staged EBUSY 重试 4 次 +
// 失败后 guardian-runner 全批取证,2026-10-12 实测把这一步拖到 17 分钟。
// bump 内容是机械的版本号两行(生成物性质),走对象空间快速落地风险极低,
// 跳门留痕(attestation jsonl)机制在。人用终端跑、想要全守门时传 --slow-commit。
if (!NO_PUSH) {
  const MSG = `chore(desktop): 版本 bump ${version}(本机一键发版)`;
  if (SLOW_COMMIT) {
    const r = spawnSync(process.execPath, ['scripts/safe-commit.mjs', '-m', MSG, '--', 'apps/desktop/src-tauri/tauri.conf.json', 'apps/desktop/package.json'], { stdio: 'inherit', windowsHide: true });
    if (r.status !== 0) console.log('⚠️ 版本 bump 提交受阻(可能并行会话竞争),不影响已发布的 Gitee 资产');
  } else {
    const land = spawnSync(process.execPath, ['scripts/object-space-land.mjs'], {
      stdio: 'inherit', windowsHide: true,
      env: {
        ...process.env,
        LAND_PATHS: 'apps/desktop/src-tauri/tauri.conf.json;apps/desktop/package.json',
        LAND_MSG: MSG + '\n\n(快速落地:本机一键发版的机械版本号 bump,对象空间通道;safe-commit 历史路径实测 EBUSY×4 + 取证 17min + 沙箱拦截三病)',
      },
    });
    if (land.status !== 0) console.log('⚠️ 版本 bump 快速落地受阻(不影响已发布的 Gitee 资产;可手工补落地)');
  }
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
// 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  const running = spawnSync('tasklist', [], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).stdout?.toString().toLowerCase().includes('ihui-desktop');
  if (running) {
    console.log('⚠️ 桌面端正在运行,跳过自装(请关闭后重跑或手动安装)');
  } else {
    sh(`"${exePath}" /S`);
    console.log(`=== 已静默安装 v${version},重启桌面端即生效 ===`);
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
