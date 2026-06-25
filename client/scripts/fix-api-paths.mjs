/**
 * 修复 api 子目录化后的相对路径引用问题
 * 1. ../utils/ -> ../../utils/ (跨目录引用多一层)
 * 2. ../config/ -> ../../config/
 * 3. ./xxx (api 内部引用) -> ../子目录/xxx
 * 4. index.ts barrel 双重路径修复
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_SRC = join(__dirname, '..', 'src');
const API_DIR = join(CLIENT_SRC, 'api');

// api/ 下的子目录（已存在 + 新建）
const API_SUBDIRS = new Set([
  'admin', 'agent', 'ai', 'auth', 'course', 'user', 'unified', 'zhs',
  'category', 'chat', 'skills', 'remote', 'oauth', 'ranking', 'developer',
  'payment', 'content', 'tools', 'system', 'statistics', 'distribution',
  'platform', 'app', 'n8n', 'knowledge', 'file', 'api-mgmt', 'learn', 'models',
  'core', 'edu', 'services', 'v2-business', 'official', '__tests__',
]);

// src/ 下的顶层目录（用于判断 ../xxx 是否跨目录引用）
const SRC_TOP_DIRS = new Set([
  'api', 'assets', 'components', 'composables', 'config', 'constants',
  'data', 'directives', 'lib', 'locales', 'plugins', 'router', 'services',
  'shared', 'stores', 'styles', 'templates', 'types', 'utils', 'views', 'workers',
]);

async function main() {
  console.log('=== Fixing api relative paths ===');
  const subdirs = await readdir(API_DIR, { withFileTypes: true });
  let fixed = 0;

  for (const entry of subdirs) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    if (!API_SUBDIRS.has(entry.name)) continue;

    const subdirPath = join(API_DIR, entry.name);
    const files = await readdir(subdirPath);
    for (const file of files) {
      if (!file.endsWith('.ts') || file.endsWith('.d.ts')) continue;
      const filePath = join(subdirPath, file);
      let content = await readFile(filePath, 'utf-8');
      const original = content;

      // 1. 修复跨目录引用: ../utils/ -> ../../utils/ (但 ../core/ 这种 api 内部引用不动)
      // 匹配 ../xxx 其中 xxx 是 src/ 顶层目录但不是 api/ 子目录
      content = content.replace(
        /from ['"](\.\.\/)([a-zA-Z][\w-]*)/g,
        (match, prefix, dir) => {
          // 如果 dir 是 src 顶层目录且不是 api 子目录，需要多加一层 ../
          if (SRC_TOP_DIRS.has(dir) && !API_SUBDIRS.has(dir)) {
            return `from '${prefix}${prefix}${dir}`;
          }
          return match;
        }
      );
      // 同样处理 import('...') 动态导入
      content = content.replace(
        /import\(['"](\.\.\/)([a-zA-Z][\w-]*)/g,
        (match, prefix, dir) => {
          if (SRC_TOP_DIRS.has(dir) && !API_SUBDIRS.has(dir)) {
            return `import('${prefix}${prefix}${dir}`;
          }
          return match;
        }
      );

      // 2. 修复 api 内部相对引用: ./xxx -> ../子目录/xxx
      // ./fastapi (原在根目录,现移到 system/) -> ../system/fastapi
      // ./services/xxx (services 是已存在子目录) -> ../services/xxx
      // ./core/xxx -> ../core/xxx
      content = content.replace(
        /from ['"]\.\/([a-zA-Z][\w-]*)/g,
        (match, name) => {
          // 如果 name 是 api 子目录（如 core/services/edu），改为 ../name
          if (API_SUBDIRS.has(name)) {
            return `from '../${name}`;
          }
          // 否则 name 是已移动的模块文件名，需要找到它的新位置
          const newSubdir = findSubdirForModule(name);
          if (newSubdir) {
            return `from '../${newSubdir}/${name}`;
          }
          return match;
        }
      );

      if (content !== original) {
        await writeFile(filePath, content, 'utf-8');
        fixed++;
      }
    }
  }

  console.log(`  fixed ${fixed} files in subdirs`);

  // 3. 修复 index.ts barrel: ./auth/auth/xxx -> ./auth/xxx (双重路径)
  const indexPath = join(API_DIR, 'index.ts');
  let indexContent = await readFile(indexPath, 'utf-8');
  const indexOriginal = indexContent;

  // 修复 ./子目录/子目录/xxx -> ./子目录/xxx (如 ./auth/auth/auth-accounts -> ./auth/auth-accounts)
  for (const sub of API_SUBDIRS) {
    const pattern = new RegExp(`\\./${sub}/${sub}/`, 'g');
    indexContent = indexContent.replace(pattern, `./${sub}/`);
  }

  if (indexContent !== indexOriginal) {
    await writeFile(indexPath, indexContent, 'utf-8');
    console.log('  fixed index.ts double paths');
  }

  console.log('=== Done ===');
}

// 模块名 -> 子目录 的反向映射（从 DOMAIN_MAP 重建）
const MODULE_TO_SUBDIR = {};
// 这里需要和 reorganize-api.mjs 的 DOMAIN_MAP 一致
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
};

function findSubdirForModule(name) {
  return DOMAIN_MAP[name] || null;
}

main().catch(e => { console.error(e); process.exit(1); });
