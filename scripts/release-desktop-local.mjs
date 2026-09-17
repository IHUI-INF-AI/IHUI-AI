#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (李春川 Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
const BUMP = process.argv.includes('--minor') ? 'minor' : process.argv.includes('--major') ? 'major' : 'patch';

const sh = (cmd, opts = {}) => execSync(cmd, { stdio: opts.quiet ? 'pipe' : 'inherit', encoding: 'utf8', ...opts });

// ── 1. 版本 bump ──
const conf = JSON.parse(readFileSync(CONF, 'utf8'));
const old = conf.version;
const [maj, mid, pat] = old.split('.').map(Number);
const version = BUMP === 'major' ? `${maj + 1}.0.0` : BUMP === 'minor' ? `${maj}.${mid + 1}.0` : `${maj}.${mid}.${pat + 1}`;
conf.version = version;
writeFileSync(CONF, JSON.stringify(conf, null, 2) + '\n');
const pkg = JSON.parse(readFileSync(PKG, 'utf8'));
pkg.version = version;
writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n');
console.log(`\n=== 版本 ${old} → ${version} ===`);

// ── 2. tauri build(薄壳:前端跳过)──
const keyPath = path.join(process.env.USERPROFILE || '', '.tauri/ihui-updater.key');
const exeName = `智汇AI_${version}_x64-setup.exe`;
if (!existsSync(keyPath)) {
  console.error(`ERROR: 更新签名密钥缺失 ${keyPath}`);
  process.exit(1);
}
const key = readFileSync(keyPath, 'utf8').trim();
const pwd = readFileSync(path.join(process.env.USERPROFILE || '', '.tauri/ihui-updater-password.txt'), 'utf8').trim();
sh(`TAURI_SKIP_FRONTEND=1 TAURI_SIGNING_PRIVATE_KEY="${key}" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${pwd}" pnpm exec tauri build`, { cwd: DESKTOP });

const exePath = path.join(NSIS_DIR, exeName);
const sigPath = `${exePath}.sig`;
if (!existsSync(exePath) || !existsSync(sigPath)) {
  console.error(`ERROR: 产物缺失 ${exePath}`);
  process.exit(1);
}
const exeSize = (statSync(exePath).size / 1e6).toFixed(1);
console.log(`\n=== 产物: ${exeName} (${exeSize}MB) + sig ===`);

// ── 3. Gitee 直传(release + 附件 + feed)──
const cred = (host) => {
  const out = sh(`git credential fill <<CREF\nprotocol=https\nhost=${host}\n\nCREF`, { quiet: true });
  return out.split('\n').find((l) => l.startsWith('password='))?.slice(10)?.trim();
};
const giteeTok = cred('gitee.com');
if (!giteeTok) {
  console.error('ERROR: 无法获取 gitee.com token');
  process.exit(1);
}
const gApi = async (p, method = 'GET', data) => {
  let url = `https://gitee.com/api/v5${p}`;
  if (data && method === 'POST') url += (url.includes('?') ? '&' : '?') + `access_token=${giteeTok}`;
  const r = await fetch(url, {
    method,
    headers: data && method !== 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`gitee ${method} ${p} -> ${r.status}: ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
};
const tag = `desktop-v${version}`;
const giteeUrl = (f) => `https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}/releases/download/${tag}/${f}`;

try {
  // release 找/建
  let rel;
  try {
    rel = await gApi(`/repos/${GITEE_OWNER}/${GITEE_REPO}/releases/tags/${tag}`);
  } catch {
    rel = await gApi(`/repos/${GITEE_OWNER}/${GITEE_REPO}/releases`, 'POST', {
      tag_name: tag, name: `智汇AI 桌面端 ${tag}`, body: `桌面端 ${version}(本机极速发版)`, target_commitish: 'main', prerelease: false,
    });
  }
  const rid = rel.id;
  const have = new Set((rel.assets || []).map((a) => a.name));

  // 附件上传(跳过同名)
  for (const [f, p] of [[exeName, exePath], [`${exeName}.sig`, sigPath]]) {
    if (have.has(f)) { console.log(`[gitee] ${f} 已存在,跳过`); continue; }
    const boundary = 'ihui' + Date.now();
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${f}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
      readFileSync(p),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const r = await fetch(`https://gitee.com/api/v5/repos/${GITEE_OWNER}/${GITEE_REPO}/releases/${rid}/attach_files?access_token=${giteeTok}`, {
      method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body,
    });
    if (!r.ok) throw new Error(`上传 ${f} -> ${r.status}`);
    console.log(`[gitee] 上传 ${f}: OK`);
  }

  // feed 更新(contents API;分支缺失时重建)
  const latest = {
    version,
    notes: `智汇AI 桌面端 ${version}:本机极速发版。`,
    pub_date: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    platforms: { 'windows-x86_64': { signature: readFileSync(sigPath, 'utf8').trim(), url: giteeUrl(exeName) } },
  };
  const contentB64 = Buffer.from(JSON.stringify(latest, null, 2), 'utf8').toString('base64');
  let cur = null;
  try {
    cur = await gApi(`/repos/${GITEE_OWNER}/${GITEE_REPO}/contents/latest.json?ref=desktop-feed`);
  } catch { /* 文件/分支缺失 */ }
  const putBody = { access_token: giteeTok, content: contentB64, branch: 'desktop-feed', message: `desktop updater feed ${version}` };
  if (cur?.sha) putBody.sha = cur.sha;
  try {
    await gApi(`/repos/${GITEE_OWNER}/${GITEE_REPO}/contents/latest.json`, 'PUT', putBody);
  } catch (e) {
    // 分支可能被 Gitee 镜像删除 → 重建后重试
    console.log('[gitee] desktop-feed 缺失,重建...');
    await gApi(`/repos/${GITEE_OWNER}/${GITEE_REPO}/branches`, 'POST', { refs: 'main', branch_name: 'desktop-feed' }).catch(() => {});
    const cur2 = await gApi(`/repos/${GITEE_OWNER}/${GITEE_REPO}/contents/latest.json?ref=desktop-feed`).catch(() => null);
    const body2 = { access_token: giteeTok, content: contentB64, branch: 'desktop-feed', message: `desktop updater feed ${version}` };
    if (cur2?.sha) body2.sha = cur2.sha;
    await gApi(`/repos/${GITEE_OWNER}/${GITEE_REPO}/contents/latest.json`, 'PUT', body2);
  }
  console.log('[gitee] desktop-feed/latest.json 已更新');
} catch (e) {
  console.error(`ERROR Gitee 阶段: ${e.message}`);
  process.exit(1);
}

// ── 4. 提交推送版本 bump ──
if (!NO_PUSH) {
  const r = spawnSync(process.execPath, ['scripts/safe-commit.mjs', '-m', `chore(desktop): 版本 bump ${version}(本机一键发版)`, '--', 'apps/desktop/src-tauri/tauri.conf.json', 'apps/desktop/package.json'], { stdio: 'inherit' });
  if (r.status !== 0) console.log('⚠️ 版本 bump 提交受阻(可能并行会话竞争),不影响已发布的 Gitee 资产');
}

console.log(`\n=== ✅ desktop v${version} 本机发版完成(Windows) ===`);
console.log(`    Gitee 直链: ${giteeUrl(exeName)}`);
console.log(`    全平台(macos/linux)如需发布: git tag desktop-v${version} && git push origin desktop-v${version} 触发 CI`);

// ── 5. 本机静默自装 ──
if (!NO_INSTALL) {
  const running = spawnSync('tasklist', []).stdout?.toString().toLowerCase().includes('ihui-desktop');
  if (running) {
    console.log('⚠️ 桌面端正在运行,跳过自装(请关闭后重跑或手动安装)');
  } else {
    sh(`"${exePath}" /S`);
    console.log(`=== 已静默安装 v${version},重启桌面端即生效 ===`);
  }
}
