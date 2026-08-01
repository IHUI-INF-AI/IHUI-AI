/**
 * ihui login — 用户名/邮箱/手机号 + 密码登录,获取 JWT accessToken 并写入 settings.json。
 *
 * 对齐 Web 端登录页:Web 端登录后 cookie 自动带 JWT,CLI 没有浏览器,
 * 需要用户提供 credentials 让 CLI 调 /api/auth/login 拿 JWT 后写入 settings.json 的 apiKey 字段。
 *
 * 触发场景:
 *   - 首次使用 CLI 前的认证
 *   - JWT 过期后重新登录(默认 7 天)
 *   - 切换账号
 *
 * 用法:
 *   ihui login                         # 交互式询问 account + password
 *   ihui login -a admin                 # 命令行指定账号,只问密码
 *   ihui login -a admin -p admin123     # 全自动(CI/脚本友好,密码会暴露在进程列表)
 *   ihui login --sso                    # SSO 一键授权(打开浏览器,无需输密码)
 *   ihui login --check                  # 检查当前 token 是否有效
 *   ihui login --logout                 # 清除本地 token
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { loadSettings, getSettingsPath, type Settings } from './settings.js';
import { loginWithSso } from '../lib/sso.js';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  user?: {
    id: string;
    username?: string;
    phone?: string | null;
    email?: string | null;
    avatar?: string | null;
    roleId?: number | null;
  };
  twoFactorRequired?: boolean;
  challengeToken?: string;
}

interface LoginOptions {
  account?: string;
  password?: string;
  apiUrl?: string;
  check?: boolean;
  logout?: boolean;
  sso?: boolean;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * 调用 /api/auth/login 拿 JWT。
 * 失败抛错,成功返回 LoginResponse。
 */
async function requestLogin(
  apiUrl: string,
  account: string,
  password: string,
): Promise<LoginResponse> {
  const url = `${apiUrl.replace(/\/+$/, '')}/api/auth/login`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account, password }),
      signal: controller.signal,
    });
    const text = await resp.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`登录响应非 JSON(HTTP ${resp.status}): ${text.slice(0, 200)}`);
    }
    if (!resp.ok) {
      const msg =
        (parsed && typeof parsed === 'object' && 'message' in parsed
          ? String((parsed as { message: unknown }).message)
          : `HTTP ${resp.status}`) || `HTTP ${resp.status}`;
      throw new Error(msg);
    }
    // API 标准响应:{ code, message, data }
    const outer = parsed as { code?: number; message?: string; data?: LoginResponse };
    if (outer.code !== 0 || !outer.data) {
      throw new Error(outer.message || '登录响应缺 data 字段');
    }
    return outer.data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 写入 accessToken + refreshToken 到 settings.json(保留其他字段)。
 * refreshToken 用于 access token 过期后自动续期,避免用户每 15min 手动重登录。
 */
function persistTokens(accessToken: string, refreshToken?: string): void {
  const settingsPath = getSettingsPath();
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let existing: Settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      const parsed = JSON.parse(raw) as Settings;
      if (parsed && typeof parsed === 'object') existing = parsed;
    } catch {
      // 损坏文件,从头建
    }
  }
  existing.apiKey = accessToken;
  if (refreshToken) existing.refreshToken = refreshToken;
  fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
}

/**
 * 清除本地 token(settings.json 的 apiKey 字段置空)。
 */
function clearLocalToken(): void {
  const settingsPath = getSettingsPath();
  if (!fs.existsSync(settingsPath)) return;
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    const parsed = JSON.parse(raw) as Settings;
    if (parsed && typeof parsed === 'object') {
      parsed.apiKey = undefined;
      parsed.refreshToken = undefined;
      fs.writeFileSync(settingsPath, JSON.stringify(parsed, null, 2) + '\n', 'utf-8');
    }
  } catch {
    // 损坏文件忽略
  }
}

/**
 * 验证当前 settings.json 中的 apiKey 是否有效(调 /api/auth/me)。
 */
async function checkToken(apiUrl: string, token: string): Promise<boolean> {
  const url = `${apiUrl.replace(/\/+$/, '')}/api/auth/me`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    return resp.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 寻找 /api/auth/me 端点,如果不存在则降级用 /api/auth/login(POST) 校验 token 有效性。
 * 这里直接用 /api/auth/me 是 API 标准端点(plugins/auth.ts 注册)。
 */

async function getEffectiveApiUrl(opts: LoginOptions): Promise<string> {
  if (opts.apiUrl) return opts.apiUrl.replace(/\/+$/, '');
  const settings = loadSettings();
  const url = settings.apiUrl || process.env.IHUI_API_URL || 'http://localhost:8802';
  return url.replace(/\/+$/, '');
}

/**
 * 主入口。返回 true 表示登录成功 / token 有效;false 表示失败或未操作。
 */
export async function runLogin(opts: LoginOptions): Promise<boolean> {
  // --logout:清除本地 token
  if (opts.logout) {
    clearLocalToken();
    console.info(chalk.green('✓ 已清除本地 token(settings.json 的 apiKey 字段)'));
    return true;
  }

  // --sso:SSO 一键授权登录(打开浏览器,无需输密码)
  if (opts.sso) {
    try {
      const tokenData = await loginWithSso();
      console.info(chalk.green('\n✓ SSO 授权登录成功,token 已写入 settings.json'));
      const u = tokenData.user;
      const name = u.nickname || u.phone || u.email || u.id;
      const role = u.roleId && u.roleId >= 1 ? ' (admin)' : '';
      console.info(chalk.dim(`  用户: ${name}${role}`));
      const expiresIn = tokenData.expiresIn ?? 0;
      const refreshExpiresIn = tokenData.refreshExpiresIn ?? 0;
      const days = Math.floor(expiresIn / 86400);
      const hours = Math.floor((expiresIn % 86400) / 3600);
      const minutes = Math.floor((expiresIn % 3600) / 60);
      const expiryText = days > 0
        ? `${days} 天${hours > 0 ? ` ${hours} 小时` : ''}`
        : hours > 0
          ? `${hours} 小时${minutes > 0 ? ` ${minutes} 分钟` : ''}`
          : `${minutes} 分钟`;
      const refreshDays = Math.floor(refreshExpiresIn / 86400);
      const refreshExpiryText = refreshDays > 0
        ? `${refreshDays} 天`
        : `${Math.floor(refreshExpiresIn / 3600)} 小时`;
      console.info(chalk.dim(`  Access Token 有效期: ${expiryText}(过期自动续期,无需重登录)`));
      console.info(chalk.dim(`  Refresh Token 有效期: ${refreshExpiryText}(到期需重新 ihui login)\n`));
      return true;
    } catch (err) {
      console.error(chalk.red(`✗ SSO 登录失败: ${(err as Error).message}`));
      console.info(chalk.dim('  可改用账号密码登录: ihui login -a admin'));
      return false;
    }
  }

  const apiUrl = await getEffectiveApiUrl(opts);

  // --check:验证当前 token
  if (opts.check) {
    const settings = loadSettings();
    const token = settings.apiKey;
    if (!token) {
      console.info(chalk.yellow('当前无 token(settings.json 的 apiKey 为空),请用 ihui login 登录'));
      return false;
    }
    const ok = await checkToken(apiUrl, token);
    if (ok) {
      console.info(chalk.green('✓ 当前 token 有效'));
      return true;
    }
    console.info(chalk.red('✗ 当前 token 无效或已过期,请重新登录:ihui login'));
    return false;
  }

  // 普通登录流程
  const account: string = opts.account ?? (await inquirer.prompt<{ account: string }>([
    {
      type: 'input',
      name: 'account',
      message: '账号(用户名/手机号/邮箱):',
      validate: (v: string) => (v.trim() ? true : '请输入账号'),
    },
  ]).then((a) => a.account.trim()));

  const password: string = opts.password ?? (await inquirer.prompt<{ password: string }>([
    {
      type: 'password',
      name: 'password',
      message: '密码:',
      mask: '*',
      validate: (v: string) => (v ? true : '请输入密码'),
    },
  ]).then((a) => a.password));

  if (opts.password) {
    console.warn(chalk.yellow('⚠ --password 会暴露在进程列表中,推荐仅用 ihui login 交互式输入'));
  }

  console.info(chalk.dim(`正在登录 ${apiUrl} ...`));
  let resp: LoginResponse;
  try {
    resp = await requestLogin(apiUrl, account, password);
  } catch (err) {
    console.error(chalk.red(`✗ 登录失败: ${(err as Error).message}`));
    return false;
  }

  // 2FA 挑战:提示用户走 Web 端二次校验
  if (resp.twoFactorRequired) {
    console.info(chalk.yellow('⚠ 该账号启用了 2FA,当前 CLI 暂不支持 2FA 二次校验。'));
    console.info(chalk.dim('  请先在 Web 端登录并完成 2FA,然后从浏览器 cookie 复制 accessToken 到 settings.json 的 apiKey 字段。'));
    return false;
  }

  if (!resp.accessToken) {
    console.error(chalk.red('✗ 登录响应缺 accessToken'));
    return false;
  }

  persistTokens(resp.accessToken, resp.refreshToken);
  console.info(chalk.green('\n✓ 登录成功,token 已写入 settings.json'));
  if (resp.user) {
    const u = resp.user;
    const name = u.username || u.phone || u.email || u.id;
    const role = u.roleId && u.roleId >= 1 ? ' (admin)' : '';
    console.info(chalk.dim(`  用户: ${name}${role}`));
  }
  const expiresIn = resp.expiresIn ?? 0;
  const refreshExpiresIn = resp.refreshExpiresIn ?? 0;
  // 友好显示:>=1 天显示 X 天 Y 小时,<1 天显示 X 小时 Y 分钟,<1 小时显示 X 分钟
  const days = Math.floor(expiresIn / 86400);
  const hours = Math.floor((expiresIn % 86400) / 3600);
  const minutes = Math.floor((expiresIn % 3600) / 60);
  const expiryText = days > 0
    ? `${days} 天${hours > 0 ? ` ${hours} 小时` : ''}`
    : hours > 0
      ? `${hours} 小时${minutes > 0 ? ` ${minutes} 分钟` : ''}`
      : `${minutes} 分钟`;
  // Refresh Token 有效期(默认 30 天),到期前 access token 会自动续期,用户无需手动重登录
  const refreshDays = Math.floor(refreshExpiresIn / 86400);
  const refreshExpiryText = refreshDays > 0
    ? `${refreshDays} 天`
    : `${Math.floor(refreshExpiresIn / 3600)} 小时`;
  console.info(chalk.dim(`  Access Token 有效期: ${expiryText}(过期自动续期,无需重登录)`));
  console.info(chalk.dim(`  Refresh Token 有效期: ${refreshExpiryText}(到期需重新 ihui login)\n`));
  return true;
}

// === CLI 命令注册(对齐 capabilities/memory 等已有命令模式) ===

interface CliLoginOptions {
  account?: string;
  password?: string;
  apiUrl?: string;
  check?: boolean;
  logout?: boolean;
  sso?: boolean;
}

/**
 * 在根 program 上注册 `login` 命令。
 * 用法:
 *   ihui login                         # 交互式
 *   ihui login -a admin                # 命令行指定账号
 *   ihui login -a admin -p admin123    # 全自动
 *   ihui login --sso                    # SSO 一键授权(打开浏览器)
 *   ihui login --check                 # 检查 token
 *   ihui login --logout                # 清除 token
 */
export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('用户名/邮箱/手机号 + 密码登录,获取 JWT(写入 settings.json)')
    .option('-a, --account <account>', '账号(用户名/手机号/邮箱)')
    .option('-p, --password <password>', '密码(会暴露在进程列表,推荐交互式输入)')
    .option('--api-url <url>', '后端 API 地址(默认读 settings.json)')
    .option('--sso', 'SSO 一键授权登录(打开浏览器,无需输密码)')
    .option('--check', '检查当前 token 是否有效')
    .option('--logout', '清除本地 token(settings.json 的 apiKey 字段)')
    .action(async (opts: CliLoginOptions) => {
      const ok = await runLogin(opts);
      if (!ok) process.exitCode = 1;
    });
}
