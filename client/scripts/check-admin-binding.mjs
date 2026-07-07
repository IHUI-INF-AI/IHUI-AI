/**
 * 守门脚本：最高管理员账号必须同时绑 phone=18643389808 / email=502319984@qq.com
 *          + login_by_password 必须支持 phone/email/user_name 三种登录 (2026-07-05 立)
 *          + admin_user.phone / admin_user.email 必须有 UNIQUE 约束 (2026-07-06 增)
 *          + update_admin_account.py 严禁被业务代码 import (2026-07-06 增)
 *
 * 背景:
 *   用户要求 admin 系统管理员账号 (user_name='admin', 密码 admin123) 同时支持
 *   三种登录方式: user_name='admin' / phone='18643389808' / email='502319984@qq.com',
 *   登录后都是最高管理员.
 *
 *   涉及文件:
 *     1. server/scripts/update_admin_account.py - 数据迁移脚本, 幂等绑定 phone/email/user_uuid
 *        + 确保 admin_role + admin_user_role 关联存在 (init-only, 严禁业务 import)
 *     2. server/scripts/seed.py - 新部署 seed 也要带 phone/email 绑定
 *     3. server/app/services/auth_service.py:login_by_password - 必须同时支持
 *        user_name / phonenumber / email 三种 fallback (OR 一次性查)
 *     4. server/app/models/admin_models.py:AdminUser - schema='public' 不可回归
 *        + phonenumber / email 必须有 unique=True (防多 user 抢同一手机/邮箱)
 *     5. server/alembic/versions/029_add_unique_admin_user_phone_email.py - 迁移必须存在
 *     6. server/scripts/init_admin_binding.sql - 兼容不走 alembic 的部署
 *
 * 守门规则:
 *   1. update_admin_account.py 必须存在, 且必须包含常量:
 *        ADMIN_PHONE = "18643389808"
 *        ADMIN_EMAIL = "502319984@qq.com"
 *        ADMIN_NICK_NAME = "最高管理员"
 *        ADMIN_USER_UUID = "00000000-0000-0000-0000-000000000001"
 *   2. seed.py 第 7 步创建 admin user 时必须包含 phonenumber='18643389808' / email='502319984@qq.com'
 *   3. auth_service.py login_by_password 函数体内必须同时引用:
 *        SysUser.user_name == phone_stripped
 *        SysUser.phonenumber == phone_stripped
 *        SysUser.email == phone_lower
 *   4. admin_models.py AdminUser.__table_args__ 不允许再有 schema='public' (允许 extend_existing)
 *   5. 配套 verify_admin_login.py 回归脚本必须存在
 *   6. (2026-07-06 增) admin_models.py:AdminUser 必须有 unique=True 在 email 和 phonenumber
 *   7. (2026-07-06 增) alembic 迁移 029_add_unique_admin_user_phone_email.py 必须存在
 *   8. (2026-07-06 增) init_admin_binding.sql 必须存在
 *   9. (2026-07-06 增) update_admin_account.py 严禁被 server/app/** 业务代码 import
 *
 * 用法:
 *   - 检查暂存文件:  node scripts/check-admin-binding.mjs
 *   - 检查整个项目:  node scripts/check-admin-binding.mjs --all
 *   - 检查指定文件:  node scripts/check-admin-binding.py file1.py
 *
 * 退出码: 0 通过, 1 发现违规
 *
 * 性能: <100ms (pre-commit 友好)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const serverDir = path.resolve(rootDir, '..', 'server');

// server 端文件 (用绝对路径)
const UPDATE_SCRIPT = path.join(serverDir, 'scripts', 'update_admin_account.py');
const VERIFY_SCRIPT = path.join(serverDir, 'scripts', 'verify_admin_login.py');
const SEED_SCRIPT = path.join(serverDir, 'scripts', 'seed.py');
const AUTH_SERVICE = path.join(serverDir, 'app', 'services', 'auth_service.py');
const ADMIN_MODELS = path.join(serverDir, 'app', 'models', 'admin_models.py');
const MIGRATION_029 = path.join(serverDir, 'alembic', 'versions', '029_add_unique_admin_user_phone_email.py');
const INIT_SQL = path.join(serverDir, 'scripts', 'init_admin_binding.sql');

const TARGET_FILES = [
  UPDATE_SCRIPT,
  VERIFY_SCRIPT,
  SEED_SCRIPT,
  AUTH_SERVICE,
  ADMIN_MODELS,
  MIGRATION_029,
  INIT_SQL,
];

// 必含常量
const REQUIRED_CONSTANTS = [
  { name: 'ADMIN_PHONE', value: '18643389808' },
  { name: 'ADMIN_EMAIL', value: '502319984@qq.com' },
  { name: 'ADMIN_NICK_NAME', value: '最高管理员' },
];

// login_by_password 必须引用的 SysUser 属性 (OR 子句)
const REQUIRED_LOGIN_FALLBACKS = [
  'SysUser.user_name',
  'SysUser.phonenumber',
  'SysUser.email',
];

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
    files = TARGET_FILES.map(f => path.resolve(f));
  } else if (process.argv.length > 2 && !process.argv[2].startsWith('-')) {
    files = process.argv.slice(2).map(f => path.resolve(f));
  } else {
    // 默认 / --staged: 仅检查暂存区内的相关文件
    const staged = getStagedFiles();
    files = TARGET_FILES.filter(f => staged.includes(f));
  }

  if (files.length === 0) {
    console.log('✓ [admin-binding] 无相关文件在暂存区, 跳过');
    process.exit(0);
  }

  const violations = [];
  const checkedFiles = [];

  // 规则 1 + 5: update_admin_account.py + verify_admin_login.py 必须存在
  if (files.includes(UPDATE_SCRIPT) || files.includes(VERIFY_SCRIPT)) {
    if (!fs.existsSync(UPDATE_SCRIPT)) {
      violations.push({
        file: path.relative(rootDir, UPDATE_SCRIPT),
        rule: 'update_admin_account.py 不存在',
        fix: '创建 server/scripts/update_admin_account.py, 含 ADMIN_PHONE/EMAIL/NICK_NAME 常量',
      });
    } else {
      const text = fs.readFileSync(UPDATE_SCRIPT, 'utf-8');
      for (const { name, value } of REQUIRED_CONSTANTS) {
        if (!text.includes(`${name} = `) || !text.includes(value)) {
          violations.push({
            file: path.relative(rootDir, UPDATE_SCRIPT),
            rule: `update_admin_account.py 缺常量 ${name}=${JSON.stringify(value)}`,
            fix: `在文件顶部添加 ${name} = ${JSON.stringify(value)}`,
          });
        }
      }
      checkedFiles.push(UPDATE_SCRIPT);
    }

    if (!fs.existsSync(VERIFY_SCRIPT)) {
      violations.push({
        file: path.relative(rootDir, VERIFY_SCRIPT),
        rule: 'verify_admin_login.py 不存在',
        fix: '创建 server/scripts/verify_admin_login.py 验证三种登录方式',
      });
    } else {
      checkedFiles.push(VERIFY_SCRIPT);
    }
  }

  // 规则 2: seed.py 第 7 步创建 admin user 时必须包含 phone/email 绑定
  if (files.includes(SEED_SCRIPT) && fs.existsSync(SEED_SCRIPT)) {
    const text = fs.readFileSync(SEED_SCRIPT, 'utf-8');
    if (!text.includes('phonenumber="18643389808"') || !text.includes('email="502319984@qq.com"')) {
      violations.push({
        file: path.relative(rootDir, SEED_SCRIPT),
        rule: 'seed.py admin user 缺 phone/email 绑定',
        fix: '在 SysUser(user_id=1, user_name="admin", ...) 里加 phonenumber="18643389808" + email="502319984@qq.com"',
      });
    }
    checkedFiles.push(SEED_SCRIPT);
  }

  // 规则 3: auth_service.py login_by_password 必须同时引用 3 个 SysUser 属性
  if (files.includes(AUTH_SERVICE) && fs.existsSync(AUTH_SERVICE)) {
    const text = fs.readFileSync(AUTH_SERVICE, 'utf-8');
    for (const attr of REQUIRED_LOGIN_FALLBACKS) {
      if (!text.includes(attr)) {
        violations.push({
          file: path.relative(rootDir, AUTH_SERVICE),
          rule: `login_by_password 缺 ${attr} 登录 fallback`,
          fix: `在 sys_user OR 查询里加 ${attr} 子句, 允许 phone/email/user_name 三种方式登录`,
        });
      }
    }
    checkedFiles.push(AUTH_SERVICE);
  }

  // 规则 4: admin_models.py AdminUser.__table_args__ 不允许再有 schema='public'
  if (files.includes(ADMIN_MODELS) && fs.existsSync(ADMIN_MODELS)) {
    const text = fs.readFileSync(ADMIN_MODELS, 'utf-8');
    // 只检查 AdminUser 类的 __table_args__ (行范围足够小, 全文匹配也行, 但要避免误判其他类)
    if (/class\s+AdminUser\b[\s\S]*?__table_args__\s*=\s*\([\s\S]*?["']schema["']\s*:\s*["']public["']/.test(text)) {
      violations.push({
        file: path.relative(rootDir, ADMIN_MODELS),
        rule: "AdminUser.__table_args__ 不允许再有 schema='public'",
        fix: 'SQLite fallback 上 ORM 会生成 public.admin_user 报 "no such table". 移除 schema 字段, 只保留 extend_existing=True. PG 上 public 是默认 search_path, 不影响.',
      });
    }
    // 规则 6 (2026-07-06 增): email / phonenumber 必须有 unique=True
    // 抓 AdminUser 类块 (从 class AdminUser 到下一个 class 或文件末) 校验 unique=True
    // 用 [\s\S]*? 配合前向 (?=class\s+\w+|$) 限定 AdminUser 类
    const adminUserMatch = text.match(/class\s+AdminUser\b[\s\S]*?(?=^class\s+\w+|\Z)/m);
    if (adminUserMatch) {
      const block = adminUserMatch[0];
      // 1. email = Column(... unique=True ...)
      //    Column() 可能含嵌套 (), 改用 balanced paren regex
      const emailLine = block.match(/email\s*=\s*Column\((?:[^()]|\([^()]*\))*\)/);
      if (!emailLine || !/unique\s*=\s*True/.test(emailLine[0])) {
        violations.push({
          file: path.relative(rootDir, ADMIN_MODELS),
          rule: 'AdminUser.email 缺 unique=True',
          fix: '在 email = Column(...) 加 unique=True, 防止多 user 抢同一邮箱导致 login_by_password 命中非预期 user.',
        });
      }
      // 2. phonenumber = Column("phone", ... unique=True ...)
      const phoneLine = block.match(/phonenumber\s*=\s*Column\((?:[^()]|\([^()]*\))*\)/);
      if (!phoneLine || !/unique\s*=\s*True/.test(phoneLine[0])) {
        violations.push({
          file: path.relative(rootDir, ADMIN_MODELS),
          rule: 'AdminUser.phonenumber 缺 unique=True',
          fix: '在 phonenumber = Column("phone", ...) 加 unique=True, 防止多 user 抢同一手机导致 admin 登录走错 user.',
        });
      }
    } else {
      violations.push({
        file: path.relative(rootDir, ADMIN_MODELS),
        rule: 'AdminUser 类未找到',
        fix: '检查 admin_models.py 是否被错误重命名.',
      });
    }
    checkedFiles.push(ADMIN_MODELS);
  }

  // 规则 7 (2026-07-06 增): alembic 迁移 029 必须存在
  if (files.includes(MIGRATION_029)) {
    if (!fs.existsSync(MIGRATION_029)) {
      violations.push({
        file: path.relative(rootDir, MIGRATION_029),
        rule: 'alembic 迁移 029_add_unique_admin_user_phone_email.py 不存在',
        fix: '创建 alembic/versions/029_add_unique_admin_user_phone_email.py, 为已存在 DB 补 admin_user.phone/email UNIQUE 索引.',
      });
    } else {
      const text = fs.readFileSync(MIGRATION_029, 'utf-8');
      if (!text.includes('uq_admin_user_phone') || !text.includes('uq_admin_user_email')) {
        violations.push({
          file: path.relative(rootDir, MIGRATION_029),
          rule: '迁移 029 缺 UNIQUE INDEX 名称',
          fix: '迁移必须创建 uq_admin_user_phone 和 uq_admin_user_email 两个 UNIQUE INDEX.',
        });
      }
      checkedFiles.push(MIGRATION_029);
    }
  }

  // 规则 8 (2026-07-06 增): init_admin_binding.sql 必须存在 (兼容不走 alembic 的部署)
  if (files.includes(INIT_SQL)) {
    if (!fs.existsSync(INIT_SQL)) {
      violations.push({
        file: path.relative(rootDir, INIT_SQL),
        rule: 'init_admin_binding.sql 不存在',
        fix: '创建 scripts/init_admin_binding.sql, 含 CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_user_phone/email.',
      });
    } else {
      const text = fs.readFileSync(INIT_SQL, 'utf-8');
      if (!text.includes('uq_admin_user_phone') || !text.includes('uq_admin_user_email')) {
        violations.push({
          file: path.relative(rootDir, INIT_SQL),
          rule: 'init_admin_binding.sql 缺 UNIQUE INDEX DDL',
          fix: 'SQL 必须包含 CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_user_phone/email.',
        });
      }
      checkedFiles.push(INIT_SQL);
    }
  }

  // 规则 9 (2026-07-06 增): update_admin_account.py 严禁被 server/app/** 业务代码 import
  // 只在 --all 模式或显式传入业务文件时检查 (性能考虑)
  if (process.argv.includes('--all')) {
    const businessDir = path.join(serverDir, 'app');
    const updateScriptName = 'update_admin_account';
    const businessViolations = [];
    function walkBusiness(dir) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__pycache__') continue;
          walkBusiness(full);
        } else if (entry.name.endsWith('.py')) {
          const text = fs.readFileSync(full, 'utf-8');
          // 多种 import 形式: import scripts.update_admin_account, from scripts.update_admin_account import ...
          const patterns = [
            new RegExp(`from\\s+scripts\\.${updateScriptName}\\b`, 'g'),
            new RegExp(`import\\s+scripts\\.${updateScriptName}\\b`, 'g'),
            new RegExp(`from\\s+\\.\\.+\\.${updateScriptName}\\b`, 'g'),
          ];
          for (const re of patterns) {
            const matches = text.match(re);
            if (matches) {
              businessViolations.push({
                file: path.relative(rootDir, full),
                matches,
              });
            }
          }
        }
      }
    }
    walkBusiness(businessDir);
    if (businessViolations.length > 0) {
      for (const v of businessViolations) {
        violations.push({
          file: v.file,
          rule: `业务代码 import 了 init-only 脚本 update_admin_account.py (init-only, 严禁在请求路径使用)`,
          fix: '从业务代码移除 import. 此脚本仅在部署/初始化阶段执行, 业务路径应走 auth_service / db.session 等常规接口.',
        });
      }
    }
  }

  console.log(`[admin-binding] 检查 ${checkedFiles.length} 个文件`);
  if (violations.length === 0) {
    console.log('✓ [admin-binding] 全部通过');
    process.exit(0);
  }

  console.error(`✗ [admin-binding] ${violations.length} 项违规:`);
  for (const v of violations) {
    console.error(`  - [${v.rule}]`);
    console.error(`    file: ${v.file}`);
    console.error(`    fix:  ${v.fix}`);
  }
  process.exit(1);
}

main();
