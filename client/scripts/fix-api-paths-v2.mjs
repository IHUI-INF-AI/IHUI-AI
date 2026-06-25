/**
 * 精确修复 api 子目录化后的所有路径问题
 * 策略：用引号边界精确匹配，避免前缀误匹配
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_SRC = join(__dirname, '..', 'src');
const API_DIR = join(CLIENT_SRC, 'api');

const DOMAIN_MAP = {
  admin: 'admin', 'admin-activities': 'admin', 'admin-agents': 'admin', 'admin-dashboard': 'admin',
  'admin-faq': 'admin', 'admin-migration': 'admin', 'admin-orders': 'admin', 'admin-products': 'admin',
  agent: 'agent', agents: 'agent', 'agent-buy': 'agent', 'agent-category': 'agent', 'agent-category-cache': 'agent',
  'agent-developer': 'agent', 'agent-examine': 'agent', 'agent-plaza': 'agent', 'agent-settlement': 'agent',
  'agent-task': 'agent', 'agent-withdrawal': 'agent',
  ai: 'ai', 'ai-career': 'ai', 'ai-chat-types': 'ai', 'ai-community': 'ai', 'ai-generation': 'ai',
  'ai-index': 'ai', 'ai-models': 'ai', 'ai-proxy': 'ai', 'ai-team': 'ai', 'ai-world': 'ai',
  aiChat: 'ai', aiModelInfo: 'ai', aigc: 'ai',
  auth: 'auth', 'auth-accounts': 'auth', 'auth-info': 'auth', 'auth-tokens': 'auth',
  'auth-user': 'auth', 'auth-user-vip': 'auth', 'auth-veri-codes': 'auth', 'auth-vip-level': 'auth',
  course: 'course', courses: 'course', 'course-audit': 'course', 'course-pay': 'course',
  'course-pay-log': 'course', 'course-planet': 'course',
  user: 'user', userSk: 'user', 'user-agent-context': 'user', 'user-export': 'user',
  'user-margin': 'user', 'user-platform': 'user', 'user-sys-link': 'user',
  'unified-ai': 'unified', 'unified-alipay': 'unified', 'unified-auth': 'unified', 'unified-wechat': 'unified',
  'zhs-activity': 'zhs', 'zhs-advertise': 'zhs', 'zhs-agent': 'zhs', 'zhs-banner-carousel': 'zhs',
  category: 'category', 'category-dictionary': 'category', 'category-link': 'category',
  chat: 'chat', chatRoom: 'chat', 'chat-history': 'chat',
  skills: 'skills', 'skills-backend': 'skills', 'skills-enhanced-ai': 'skills',
  remote: 'remote', 'remote-agent-task': 'remote', 'remote-config': 'remote',
  oauth: 'oauth', 'oauth2-auth': 'oauth',
  ranking: 'ranking', rankings: 'ranking',
  developer: 'developer', 'developer-permissions': 'developer',
  'ali-pay': 'payment', payment: 'payment', 'top-up': 'payment', refund: 'payment',
  orders: 'payment', billing: 'payment', wallet: 'payment', withdrawal: 'payment',
  commission: 'payment', fund: 'payment', invoice: 'payment', trader: 'payment',
  article: 'content', news: 'content', community: 'content', circle: 'content',
  xuqiu: 'content', favorites: 'content', feedback: 'content', share: 'content',
  'business-card': 'content', 'content-generation': 'content',
  mcp: 'tools', tools: 'tools', workflows: 'tools', openclaw: 'tools',
  settings: 'system', security: 'system', help: 'system', home: 'system',
  monitoring: 'system', notification: 'system', message: 'system', tasks: 'system',
  tickets: 'system', visittracking: 'system', fastapi: 'system', apis: 'system',
  statistics: 'statistics', 'token-value': 'statistics',
  distribution: 'distribution', subordinates: 'distribution', shop: 'distribution',
  gateway: 'platform', platforms: 'platform', miniprogram: 'platform', plugins: 'platform',
  'product-identity': 'platform',
  'app-version': 'app', apps: 'app',
  n8n: 'n8n', 'n8n-agents': 'n8n',
  knowledge: 'knowledge', 'knowledge-planet': 'knowledge',
  'file-upload': 'file', files: 'file',
  'api-service': 'api-mgmt', 'api-utils': 'api-mgmt',
  learn: 'learn', live: 'learn', exam: 'learn', member: 'learn', study: 'learn', docs: 'learn',
  models: 'models',
  // 保留根目录的模块
  client: null, 'generated-client': null, 'v2-agents': null, 'v2-courses': null,
  'v2-orders': null, 'v2-user': null, 'probe-v2': null,
};

const API_SUBDIRS = new Set([...new Set(Object.values(DOMAIN_MAP).filter(Boolean))]);
const EXISTING_SUBDIRS = new Set(['core', 'edu', 'services', 'v2-business', 'official', '__tests__']);
const ALL_API_SUBDIRS = new Set([...API_SUBDIRS, ...EXISTING_SUBDIRS]);

const SRC_TOP_DIRS = new Set([
  'api', 'assets', 'components', 'composables', 'config', 'constants',
  'data', 'directives', 'lib', 'locales', 'plugins', 'router', 'services',
  'shared', 'stores', 'styles', 'templates', 'types', 'utils', 'views', 'workers',
]);

async function main() {
  console.log('=== Fixing all api paths ===');
  const files = await collectFiles(CLIENT_SRC, ['.ts', '.vue', '.tsx']);
  let fixed = 0;

  for (const file of files) {
    let content = await readFile(file, 'utf-8');
    const original = content;
    const isInApi = file.replace(/\\/g, '/').includes('/src/api/');

    // 1. 修复三层路径: @/api/sub/sub/xxx -> @/api/sub/xxx (双重替换遗留)
    for (const sub of API_SUBDIRS) {
      // @/api/agent/agent/agent-plaza -> @/api/agent/agent-plaza
      content = content.replace(
        new RegExp(`@/api/${sub}/${sub}/`, 'g'),
        `@/api/${sub}/`
      );
      // ../sub/sub/xxx -> ../sub/xxx (相对路径双重)
      content = content.replace(
        new RegExp(`\\.\\./${sub}/${sub}/`, 'g'),
        `../${sub}/`
      );
      // ./sub/sub/xxx -> ./sub/xxx (虽然不应该出现，但防御性处理)
      content = content.replace(
        new RegExp(`\\./${sub}/${sub}/`, 'g'),
        `./${sub}/`
      );
    }

    // 2. 修复 ./xxx 相对引用（api 子目录内的文件引用其他 api 模块）
    if (isInApi) {
      // ./fastapi -> ../system/fastapi (已移动的模块)
      // ./services -> ../services (已存在子目录)
      // ./client -> ../client (保留根目录的模块)
      content = content.replace(
        /from ['"]\.\/([a-zA-Z][\w-]*)/g,
        (match, name) => {
          // 是已存在子目录 -> ../name
          if (EXISTING_SUBDIRS.has(name)) {
            return `from '../${name}`;
          }
          // 是新子目录 -> ../name (引用目录本身)
          if (API_SUBDIRS.has(name)) {
            return `from '../${name}`;
          }
          // 是已移动的模块文件 -> ../子目录/模块名
          const subdir = DOMAIN_MAP[name];
          if (subdir) {
            return `from '../${subdir}/${name}`;
          }
          // 保留根目录的模块 -> ../模块名
          if (DOMAIN_MAP[name] === null) {
            return `from '../${name}`;
          }
          return match;
        }
      );
      // 同样处理动态 import('./xxx')
      content = content.replace(
        /import\(['"]\.\/([a-zA-Z][\w-]*)/g,
        (match, name) => {
          if (EXISTING_SUBDIRS.has(name)) return `import('../${name}`;
          if (API_SUBDIRS.has(name)) return `import('../${name}`;
          const subdir = DOMAIN_MAP[name];
          if (subdir) return `import('../${subdir}/${name}`;
          if (DOMAIN_MAP[name] === null) return `import('../${name}`;
          return match;
        }
      );
    }

    // 3. 修复 ../xxx 跨目录引用（api 子目录内的文件引用 src/ 下其他目录）
    if (isInApi) {
      // ../utils/xxx -> ../../utils/xxx (多一层)
      // ../config/xxx -> ../../config/xxx
      // 但 ../core/xxx 不变（core 是 api 内部子目录）
      content = content.replace(
        /from ['"](\.\.\/)([a-zA-Z][\w-]*)/g,
        (match, prefix, dir) => {
          // 如果是 src 顶层目录且不是 api 子目录，多加一层 ../
          if (SRC_TOP_DIRS.has(dir) && !ALL_API_SUBDIRS.has(dir)) {
            return `from '${prefix}${prefix}${dir}`;
          }
          return match;
        }
      );
      content = content.replace(
        /import\(['"](\.\.\/)([a-zA-Z][\w-]*)/g,
        (match, prefix, dir) => {
          if (SRC_TOP_DIRS.has(dir) && !ALL_API_SUBDIRS.has(dir)) {
            return `import('${prefix}${prefix}${dir}`;
          }
          return match;
        }
      );
    }

    // 4. 修复 index.ts barrel 双重路径
    if (file.endsWith('api/index.ts')) {
      for (const sub of API_SUBDIRS) {
        content = content.replace(
          new RegExp(`\\./${sub}/${sub}/`, 'g'),
          `./${sub}/`
        );
      }
    }

    if (content !== original) {
      await writeFile(file, content, 'utf-8');
      fixed++;
    }
  }

  console.log(`  fixed ${fixed} files`);
  console.log('=== Done ===');
}

async function collectFiles(dir, exts) {
  const result = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', '.nuxt', '.output'].includes(entry.name)) continue;
      result.push(...await collectFiles(full, exts));
    } else if (entry.isFile()) {
      if (exts.some(ext => entry.name.endsWith(ext)) && !entry.name.endsWith('.d.ts')) {
        result.push(full);
      }
    }
  }
  return result;
}

main().catch(e => { console.error(e); process.exit(1); });
