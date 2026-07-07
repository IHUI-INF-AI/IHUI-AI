/**
 * 守门脚本：账号密码登录禁止强制 11 位手机号正则 + admin 路由必须指向 /api/v1/login/username
 *          + 后端 auth_service 禁止 sys_user.phone 直读 (2026-07-05 增)
 *
 * 背景 (2026-07-04 立, 修复 admin/admin123 在普通 /login 入口登录失败):
 *   - useLoginLogic.handleAccountLogin 之前 L208-211 强制账号必须是 /^1[3-9]\d{9}$/,
 *     导致 admin 这种 username 被前端拦截弹"请输入正确的手机号",根本到不了后端.
 *   - 后端 /api/v1/auth/login 已扩展为兼容 sys_user.user_name fallback
 *     (server/app/services/auth_service.py:login_by_password)
 *   - unified-auth.ts admin loginPath 之前误指 /api/v1/auth/login (普通用户接口, 按 phone 查),
 *     已修对为 /api/v1/login/username (sys_user 表专用接口, app/api/v1/auth/username_login.py:42)
 *
 * 2026-07-05 增 (修复后端响应构造 AttributeError):
 *   - server/app/services/auth_service.py _build_token_data_for_sys_user 之前用 sys_user.phone
 *     直读手机号, 但 AdminUser 模型手机号 Python 属性名是 phonenumber (DB 列名 phone),
 *     触发 AttributeError 被 login.py try/except 吞掉, 误报 401 "用户不存在或密码错误"
 *     误导用户 (实际 admin 密码是对的). 修复后改用 getattr(sys_user, "phonenumber", None).
 *   - 守门: 禁止 auth_service.py 出现 `sys_user.phone` 直接属性访问 (必须用 phonenumber 或 getattr).
 *
 * 守门规则:
 *   1. useLoginLogic.ts 禁止出现 `!/^1[3-9]\d{9}$/.test(...)` 这类强制手机号校验.
 *      (AccountLoginForm.vue 的 form rules 已经接受 username/phone/email 三种格式,
 *       submit 时已校验过, handleAccountLogin 重复校验是历史错误, 留此脚本防回退.)
 *   2. unified-auth.ts (含 unified/unified-auth.ts 备份) admin loginPath 必须指向 /api/v1/login/username.
 *      不允许再退回到 /api/v1/auth/login (普通用户接口查 user.phone 找不到 admin).
 *   3. server auth_service.py 禁止 `sys_user.phone` 直接属性访问 (AdminUser 模型无 phone 属性,
 *      直读触发 AttributeError; 正确写法: sys_user.phonenumber 或 getattr(sys_user, "phonenumber", None)).
 *
 * 用法:
 *   - 检查暂存文件:  node scripts/check-no-phone-only-login.mjs
 *   - 检查整个 src:  node scripts/check-no-phone-only-login.mjs --all
 *   - 检查指定文件:  node scripts/check-no-phone-only-login.mjs file1.ts
 *   - 严格阈值控制:  NO_PHONE_ONLY_LOGIN_THRESHOLD=0 node scripts/check-no-phone-only-login.mjs
 *
 * 退出码: 0 通过, 1 发现违规 (> THRESHOLD)
 *
 * 性能: <50ms (pre-commit 友好)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const TARGET_FILES = new Set([
  'src/components/login/composables/useLoginLogic.ts',
  'src/api/unified-auth.ts',
  'src/api/unified/unified-auth.ts',
  '../server/app/services/auth_service.py',
]);
const THRESHOLD = Number(process.env.NO_PHONE_ONLY_LOGIN_THRESHOLD ?? 0);

/**
 * 强制手机号正则: !/^1[3-9]\d{9}$/.test(...)
 * 也匹配 (xxx && !/^1[3-9]\d{9}$/.test(account)) 这种多条件组合
 */
const FORCE_PHONE_REGEX = /!\s*\/\^1\[3-9\]\\d\{9\}\$\/\.test\s*\(/g;

/**
 * AdminUser 模型手机号 Python 属性名是 phonenumber (DB 列名 phone),
 * 直读 sys_user.phone 会触发 AttributeError. 正确写法: sys_user.phonenumber
 * 或 getattr(sys_user, "phonenumber", None).
 * 守门: 禁止 `sys_user.phone` 直接属性访问 (允许 sys_user.phonenumber 和 getattr 形式).
 * 注意: 只检查 `sys_user.phone` 这种 sys_user 别名直读, 不影响 User 模型 (它有 phone 字段).
 */
const SYS_USER_PHONE_RE = /\bsys_user\.phone\b(?!\s*number)/g;

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      cwd: rootDir,
      encoding: 'utf-8',
    });
    return output
      .split(/\r?\n/)
      .filter(Boolean)
      .map(f => path.resolve(rootDir, f));
  } catch {
    return [];
  }
}

function main() {
  let files;
  if (process.argv.includes('--all')) {
    files = [...TARGET_FILES].map(f => path.resolve(rootDir, f));
  } else if (process.argv.length > 2 && !process.argv[2].startsWith('-')) {
    files = process.argv.slice(2).map(f => path.resolve(f));
  } else {
    files = getStagedFiles().filter(f => {
      // 兼容绝对路径与相对路径: TARGET_FILES 内的相对路径在跨目录时是 '../server/...'
      // 同时支持 client/src/... 和 server/app/... 两种命名
      const rel = path.relative(rootDir, f).replace(/\\/g, '/');
      const isTarget = [...TARGET_FILES].some(target => {
        // 转为绝对路径后比较
        const targetAbs = path.resolve(rootDir, target);
        return f === targetAbs || rel === target || rel.endsWith(target) || f.endsWith(target.replace(/\//g, path.sep));
      });
      return isTarget;
    });
  }

  if (files.length === 0) {
    console.log('✓ 无登录相关文件需要检查');
    process.exit(0);
  }

  let totalViolations = 0;
  const fileViolations = [];

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    // 计算相对路径用于匹配 (兼容 ../server/... 跨目录情况, 因为 rootDir 是 client/)
    const abs = path.resolve(file);
    const relFromClient = path.relative(rootDir, abs).replace(/\\/g, '/');
    const relFromServer = path
      .relative(path.resolve(rootDir, '..'), abs)
      .replace(/\\/g, '/');
    const relPath =
      relFromClient === '../server/app/services/auth_service.py'
        ? '../server/app/services/auth_service.py'
        : relFromClient;
    const text = fs.readFileSync(file, 'utf-8');
    const lines = text.split(/\r?\n/);

    if (relPath === 'src/components/login/composables/useLoginLogic.ts') {
      for (let i = 0; i < lines.length; i++) {
        FORCE_PHONE_REGEX.lastIndex = 0;
        const m = FORCE_PHONE_REGEX.exec(lines[i]);
        if (m) {
          fileViolations.push({
            file: relPath,
            line: i + 1,
            col: m.index + 1,
            snippet: lines[i].trim(),
            rule: '强制手机号正则',
          });
          totalViolations++;
        }
      }
    } else if (
      relPath === 'src/api/unified-auth.ts' ||
      relPath === 'src/api/unified/unified-auth.ts'
    ) {
      // 检查 admin loginPath 必须是 /api/v1/login/username
      const adminBlockRe = /admin:\s*\{[\s\S]*?loginPath:\s*'([^']+)'/g;
      adminBlockRe.lastIndex = 0;
      let match;
      while ((match = adminBlockRe.exec(text)) !== null) {
        const loginPath = match[1];
        if (loginPath !== '/api/v1/login/username') {
          // 算行号
          const before = text.slice(0, match.index);
          const lineNum = before.split(/\r?\n/).length;
          fileViolations.push({
            file: relPath,
            line: lineNum,
            col: 1,
            snippet: `loginPath: '${loginPath}'`,
            rule: 'admin loginPath 错配',
          });
          totalViolations++;
        }
      }
    } else if (relPath === '../server/app/services/auth_service.py') {
      // 规则 3: 禁止 sys_user.phone 直读 (AdminUser 模型 phone 属性不存在, 应为 phonenumber)
      // 行级匹配, 给出精确位置. 跳过纯注释行 (Python # 开头) 避免误报.
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) continue;
        SYS_USER_PHONE_RE.lastIndex = 0;
        let m;
        while ((m = SYS_USER_PHONE_RE.exec(line)) !== null) {
          fileViolations.push({
            file: relPath,
            line: i + 1,
            col: m.index + 1,
            snippet: line.trim(),
            rule: 'sys_user.phone 直读触发 AttributeError',
          });
          totalViolations++;
        }
      }
    }
  }

  if (totalViolations === 0) {
    console.log(`✓ 已检查 ${files.length} 个文件, 无登录校验/路由违规`);
    process.exit(0);
  }

  console.log(`✗ 发现 ${totalViolations} 处登录校验/路由违规\n`);
  console.log('  硬约束 (2026-07-04 立):');
  console.log('    1. useLoginLogic.handleAccountLogin 禁止强制 11 位手机号正则');
  console.log('       (AccountLoginForm.vue form rules 已接受 username/phone/email,');
  console.log('        后端 auth_service.login_by_password 已扩展兼容 sys_user.user_name)');
  console.log('    2. unified-auth.ts admin loginPath 必须指向 /api/v1/login/username');
  console.log('       (后端 app/api/v1/auth/username_login.py:42, sys_user 表专用接口)');
  console.log('    3. auth_service.py 禁止 sys_user.phone 直读 (2026-07-05 增)');
  console.log('       (AdminUser 模型无 phone 属性, 直读触发 AttributeError 被吞掉误报 401)');
  console.log('       正确写法: sys_user.phonenumber 或 getattr(sys_user, "phonenumber", None)');
  console.log('');
  for (const v of fileViolations) {
    console.log(`  ${v.file}:${v.line}  [${v.rule}]`);
    console.log(`    ${v.snippet}`);
  }
  console.log('');

  if (totalViolations > THRESHOLD) {
    process.exit(1);
  }
}

main();
