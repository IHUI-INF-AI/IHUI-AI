// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CLI 端 SSO 接入(2026-08-01 立)
 *
 * 平台特有:依赖 node:http + node:child_process(打开浏览器),
 * 不适合共享到 packages/shared。
 *
 * 核心逻辑复用 @ihui/shared/auth/sso-core(exchangeSsoCode / extractSsoCode / buildSsoLoginUrl),
 * 仅保留 cli 独占(本地 loopback HTTP 服务器接收 OAuth 回调 + 跨平台打开浏览器)。
 *
 * 使用场景:
 *   - 用户已在 web 端登录,CLI 一键授权拿 token(无需在终端输密码)
 *   - 比 ihui login -a admin -p '<口令>' 更安全(不暴露密码到进程列表)
 *
 * 流程:
 *   1. 启动本地 loopback HTTP 服务器监听 http://localhost:1738/callback
 *   2. buildSsoLoginUrl 拼接 web SSO 登录中心 URL(redirect=http://localhost:1738/callback, client_id=cli)
 *   3. 跨平台打开默认浏览器到 SSO 登录页
 *   4. 用户在浏览器登录/授权,web 端生成 sso_code 后跳转到 http://localhost:1738/callback?sso_code=xxx
 *   5. 本地 HTTP 服务器接收 GET /callback?sso_code=xxx,提取 code,关闭服务器
 *   6. exchangeSsoCode 用 code 换 token(走 @ihui/shared/auth/sso-core)
 *   7. persistTokens 写入 settings.json(apiKey + refreshToken)
 *
 * 安全边界:
 *   - loopback 仅监听 127.0.0.1,不绑 0.0.0.0(防外网回调)
 *   - 后端 isSafeRedirectUri 已允许 localhost(见 apps/api/src/routes/auth-sso.ts)
 *   - sso_code 一次性,30 秒过期,getdel 原子取出(防重放)
 *   - 本地服务器一次性使用,拿到 code 立即关闭(防端口占用)
 */
import * as http from 'node:http';
import * as url from 'node:url';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { writePrivateFile } from './private-file.js';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { DOC_TEXT_MUTED } from '@ihui/design-tokens';
import {
  exchangeSsoCode as exchangeSsoCodeCore,
  extractSsoCode,
  buildSsoLoginUrl,
  type SsoTokenData,
} from '@ihui/shared/auth/sso-core';
import { SSO_CLIENT_IDS, WEB_BASE } from '@ihui/shared/constants';
import { loadSettings, getSettingsPath, type Settings } from '../commands/settings.js';
import { tryParseJson, isRecord } from '../util/json.js';

// 重新导出类型与工具(保持调用方 API 一致)
export type { SsoTokenData } from '@ihui/shared/auth/sso-core';
export { extractSsoCode };

const SSO_CLIENT_ID = SSO_CLIENT_IDS.CLI;
const CALLBACK_PORT = 1738;
const CALLBACK_PATH = '/callback';
const CALLBACK_HOST = '127.0.0.1';
const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;
const SERVER_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟超时(用户登录可能耗时)

/**
 * 回调页把 query 值写进 HTML 前必须过的转义。
 *
 * 此前 `?error=<原样插值>` 直接落进 `<p>`:回环端口 1738 在 5 分钟等待窗内对本机任意
 * 进程/任意页面可达,`/callback?error=<img src=x onerror=...>` 就是在
 * `http://127.0.0.1:1738` 这个 origin 上执行脚本(反射型 XSS)。回环不等于可信源 ——
 * 浏览器里那页与本 CLI 的回调页同源,能读到回调流程。
 */
export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** query 值归一:node 的 url.parse 对重复参数给 string[],原样进模板会变成 "a,b" 还带对象味道 */
function firstQueryValue(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return typeof raw[0] === 'string' ? raw[0] : '';
  return typeof raw === 'string' ? raw : '';
}

/**
 * 跨平台打开默认浏览器到指定 URL。
 * Windows: start, macOS: open, Linux: xdg-open。
 */
function openBrowser(targetUrl: string): void {
  const platform = process.platform;
  let cmd: string;
  let args: string[];
  if (platform === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '', targetUrl];
  } else if (platform === 'darwin') {
    cmd = 'open';
    args = [targetUrl];
  } else {
    cmd = 'xdg-open';
    args = [targetUrl];
  }
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => {
    console.warn(`无法自动打开浏览器,请手动访问: ${targetUrl}`);
  });
  child.unref();
}

/**
 * 启动本地 loopback HTTP 服务器,等待 SSO 回调。
 *
 * `expectedState` 非空时,**只有 state 逐字相符的回调才被接受**;不符的一律 403 且
 * 继续监听(不 resolve、不 close)—— 见 2026-10-31 第 21 批的立据:
 * loopback 端口在等待窗内对本机任意进程与任意网页可达,谁都能往它投一枚自己的授权码,
 * 没有 state 就等于"谁先投谁赢",用户会被换成攻击者的账户。
 *
 * @returns Promise<string> 拿到并校验通过的 sso_code 后 resolve;超时/错误 reject
 */
function waitForCallback(expectedState?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end('Bad Request');
        return;
      }
      const parsed = url.parse(req.url, true);
      // 仅处理 /callback 路径
      if (parsed.pathname !== CALLBACK_PATH) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const code = parsed.query.sso_code;
      if (typeof code === 'string' && code) {
        // 2026-10-31 第 21 批:先比对 state 再认这枚码。
        // 不符 ⇒ 403 并且**不 resolve、不 close**:继续等真正的那次回调(超时兜底)。
        const gotState = firstQueryValue(parsed.query.state);
        if (expectedState && gotState !== expectedState) {
          res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>SSO 回调被拒</title></head>' +
              '<body style="font-family:system-ui;padding:40px;text-align:center;">' +
              '<h1>✗ 回调被拒</h1><p style="color:#c00;">授权响应与本次登录请求不匹配。</p>' +
              '</body></html>',
          );
          return;
        }
        // 成功拿到 code,返回友好提示给浏览器
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>SSO 登录成功</title></head>' +
          '<body style="font-family:system-ui;padding:40px;text-align:center;">' +
          '<h1>✓ 登录成功</h1><p>已获取授权码,请返回终端继续。</p>' +
          `<p style="color:${DOC_TEXT_MUTED};font-size:14px;">本页面可关闭。</p>` +
          '</body></html>',
        );
        server.close();
        clearTimeout(timer);
        resolve(code);
      } else if (parsed.query.error) {
        // 用户主动取消授权(error 参数,真正失败场景)
        const errParam = firstQueryValue(parsed.query.error);
        const errShown = escapeHtmlText(errParam.slice(0, 200) || '未知错误');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>SSO 登录失败</title></head>' +
          '<body style="font-family:system-ui;padding:40px;text-align:center;">' +
          `<h1>✗ 登录失败</h1><p style="color:#c00;">错误: ${errShown}</p>` +
          `<p style="color:${DOC_TEXT_MUTED};font-size:14px;">请返回终端重试。</p>` +
          '</body></html>',
        );
        server.close();
        clearTimeout(timer);
        reject(new Error(`SSO 回调错误: ${errParam}`));
      } else {
        // 2026-08-01 修复:无 sso_code 也无 error 的请求(健康检查/扫描器探测/用户误访问)
        // 不关闭服务器,只返回友好提示让用户继续等待真正的回调
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>等待 SSO 登录</title></head>' +
          '<body style="font-family:system-ui;padding:40px;text-align:center;">' +
          '<h1>等待登录中</h1><p>请在弹出的登录页完成授权。</p>' +
          `<p style="color:${DOC_TEXT_MUTED};font-size:14px;">本页面可关闭,CLI 仍在等待回调。</p>` +
          '</body></html>',
        );
      }
    });

    // 超时定时器(用户 5 分钟未完成登录则超时)
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('SSO 登录超时(5 分钟未完成)'));
    }, SERVER_TIMEOUT_MS);

    // 监听 127.0.0.1(loopback),不绑 0.0.0.0(防外网回调)
    server.listen(CALLBACK_PORT, CALLBACK_HOST, () => {
      // 服务器启动成功,静默等待回调
    });

    server.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`本地回调服务器启动失败: ${err.message}`));
    });
  });
}

/**
 * 构建 web SSO 登录中心 URL。
 * redirect 用 http://localhost:1738/callback(loopback),client_id=cli。
 */
export function getSsoLoginUrl(state?: string): string {
  return buildSsoLoginUrl(WEB_BASE, CALLBACK_URL, SSO_CLIENT_ID, state);
}

/**
 * CLI 封装:用 code 换 token(注入 apiBase + clientId)。
 */
export async function exchangeSsoCode(code: string): Promise<SsoTokenData | null> {
  const settings = loadSettings();
  const apiBase = settings.apiUrl || process.env.IHUI_API_URL || 'http://localhost:8802';
  return exchangeSsoCodeCore(apiBase.replace(/\/+$/, ''), code, SSO_CLIENT_ID);
}

/**
 * 写入 accessToken + refreshToken 到 settings.json(复用 login.ts 的 persistTokens 模式)。
 */
function persistTokens(accessToken: string, refreshToken?: string): void {
  const settingsPath = getSettingsPath();
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let existing: Settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      // 损坏/非对象(如数组、标量)一律从头建,防止把数组误当 Settings 写丢 token
      const parsed = tryParseJson(raw);
      if (isRecord(parsed)) existing = parsed as Settings;
    } catch {
      // 读文件失败,从头建
    }
  }
  existing.apiKey = accessToken;
  if (refreshToken) existing.refreshToken = refreshToken;
  writePrivateFile(settingsPath, JSON.stringify(existing, null, 2) + '\n');
}

/**
 * SSO 一键授权登录(完整流程)。
 *
 * 1. 启动本地 loopback HTTP 服务器
 * 2. 打开浏览器到 web SSO 登录页
 * 3. 等待回调拿 sso_code
 * 4. 用 code 换 token
 * 5. 写入 settings.json
 *
 * @returns 成功返回 SsoTokenData;失败抛错
 */
export async function loginWithSso(): Promise<SsoTokenData> {
  // 2026-10-31 第 21 批:每次登录生成新的随机 state,随授权 URL 发出并在回调比对。
  const state = randomBytes(16).toString('hex');
  const loginUrl = getSsoLoginUrl(state);
  // 提示用户即将打开浏览器
   
  console.info(`正在打开浏览器进行 SSO 授权登录...\n  回调地址: ${CALLBACK_URL}\n  登录页: ${loginUrl}\n`);

  // 并行:启动本地服务器 + 打开浏览器
  const [code] = await Promise.all([
    waitForCallback(state),
    Promise.resolve(openBrowser(loginUrl)),
  ]);

  const tokenData = await exchangeSsoCode(code);
  if (!tokenData) {
    throw new Error('SSO 授权码换取 token 失败(code 无效/已过期/网络错误)');
  }

  persistTokens(tokenData.accessToken, tokenData.refreshToken);
  return tokenData;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
