/**
 * 批量重组前端 api 目录: 平铺 .ts -> 业务域子目录
 * 并更新所有 import 引用路径
 */
import { readdir, mkdir, rename, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_SRC = join(__dirname, '..', 'src');
const API_DIR = join(CLIENT_SRC, 'api');

// 业务域分类映射: 文件名(无扩展名) -> 子目录
const DOMAIN_MAP = {
  // admin
  admin: 'admin', 'admin-activities': 'admin', 'admin-agents': 'admin', 'admin-dashboard': 'admin',
  'admin-faq': 'admin', 'admin-migration': 'admin', 'admin-orders': 'admin', 'admin-products': 'admin',
  // agent
  agent: 'agent', agents: 'agent', 'agent-buy': 'agent', 'agent-category': 'agent', 'agent-category-cache': 'agent',
  'agent-developer': 'agent', 'agent-examine': 'agent', 'agent-plaza': 'agent', 'agent-settlement': 'agent',
  'agent-task': 'agent', 'agent-withdrawal': 'agent',
  // ai
  ai: 'ai', 'ai-career': 'ai', 'ai-chat-types': 'ai', 'ai-community': 'ai', 'ai-generation': 'ai',
  'ai-index': 'ai', 'ai-models': 'ai', 'ai-proxy': 'ai', 'ai-team': 'ai', 'ai-world': 'ai',
  aiChat: 'ai', aiModelInfo: 'ai', aigc: 'ai',
  // auth
  auth: 'auth', 'auth-accounts': 'auth', 'auth-info': 'auth', 'auth-tokens': 'auth',
  'auth-user': 'auth', 'auth-user-vip': 'auth', 'auth-veri-codes': 'auth', 'auth-vip-level': 'auth',
  // course
  course: 'course', courses: 'course', 'course-audit': 'course', 'course-pay': 'course',
  'course-pay-log': 'course', 'course-planet': 'course',
  // user
  user: 'user', userSk: 'user', 'user-agent-context': 'user', 'user-export': 'user',
  'user-margin': 'user', 'user-platform': 'user', 'user-sys-link': 'user',
  // unified
  'unified-ai': 'unified', 'unified-alipay': 'unified', 'unified-auth': 'unified', 'unified-wechat': 'unified',
  // zhs
  'zhs-activity': 'zhs', 'zhs-advertise': 'zhs', 'zhs-agent': 'zhs', 'zhs-banner-carousel': 'zhs',
  // category
  category: 'category', 'category-dictionary': 'category', 'category-link': 'category',
  // chat
  chat: 'chat', chatRoom: 'chat', 'chat-history': 'chat',
  // skills
  skills: 'skills', 'skills-backend': 'skills', 'skills-enhanced-ai': 'skills',
  // remote
  remote: 'remote', 'remote-agent-task': 'remote', 'remote-config': 'remote',
  // oauth
  oauth: 'oauth', 'oauth2-auth': 'oauth',
  // ranking
  ranking: 'ranking', rankings: 'ranking',
  // developer
  developer: 'developer', 'developer-permissions': 'developer',
  // payment/finance
  'ali-pay': 'payment', payment: 'payment', 'top-up': 'payment', refund: 'payment',
  orders: 'payment', billing: 'payment', wallet: 'payment', withdrawal: 'payment',
  commission: 'payment', fund: 'payment', invoice: 'payment', trader: 'payment',
  // content/community
  article: 'content', news: 'content', community: 'content', circle: 'content',
  xuqiu: 'content', favorites: 'content', feedback: 'content', share: 'content',
  'business-card': 'content', 'content-generation': 'content',
  // tools/mcp
  mcp: 'tools', tools: 'tools', workflows: 'tools', openclaw: 'tools',
  // system
  settings: 'system', security: 'system', help: 'system', home: 'system',
  monitoring: 'system', notification: 'system', message: 'system', tasks: 'system',
  tickets: 'system', visittracking: 'system', fastapi: 'system', apis: 'system',
  // statistics
  statistics: 'statistics', 'token-value': 'statistics',
  // distribution
  distribution: 'distribution', subordinates: 'distribution', shop: 'distribution',
  // platform
  gateway: 'platform', platforms: 'platform', miniprogram: 'platform', plugins: 'platform',
  'product-identity': 'platform',
  // app
  'app-version': 'app', apps: 'app',
  // n8n
  n8n: 'n8n', 'n8n-agents': 'n8n',
  // knowledge
  knowledge: 'knowledge', 'knowledge-planet': 'knowledge',
  // file
  'file-upload': 'file', files: 'file',
  // api-mgmt
  'api-service': 'api-mgmt', 'api-utils': 'api-mgmt',
  // learn/edu (独立域)
  learn: 'learn', live: 'learn', exam: 'learn', member: 'learn', study: 'learn', docs: 'learn',
  // models (独立)
  models: 'models',
  // client/generated (保留根目录)
  client: null, 'generated-client': null,
};

// 需要跳过的子目录（已存在，不动）
const EXISTING_SUBDIRS = ['core', 'edu', 'services', 'v2-business', 'official', '__tests__'];

async function main() {
  console.log('=== Step 1: Scan api files ===');
  const allEntries = await readdir(API_DIR, { withFileTypes: true });
  const flatFiles = allEntries
    .filter(e => e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.d.ts'))
    .map(e => e.name);

  console.log(`  flat .ts files: ${flatFiles.length}`);

  // 构建移动计划: 旧文件名 -> { subdir, newFile }
  const movePlan = [];
  const pathMap = {}; // 旧模块名 -> 新路径(相对 api/)
  for (const file of flatFiles) {
    const base = file.replace(/\.ts$/, '');
    const subdir = DOMAIN_MAP[base];
    if (subdir === null) {
      // 保留根目录
      pathMap[base] = base;
      continue;
    }
    if (!subdir) {
      console.warn(`  no mapping for: ${base}, keeping in root`);
      pathMap[base] = base;
      continue;
    }
    movePlan.push({ file, subdir, base });
    pathMap[base] = `${subdir}/${base}`;
  }
  console.log(`  files to move: ${movePlan.length}`);
  console.log(`  files staying: ${flatFiles.length - movePlan.length}`);

  console.log('\n=== Step 2: Create subdirectories ===');
  const subdirs = [...new Set(movePlan.map(p => p.subdir))];
  for (const sub of subdirs) {
    const dir = join(API_DIR, sub);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
      console.log(`  created: ${sub}/`);
    }
  }

  console.log('\n=== Step 3: Move files ===');
  for (const { file, subdir } of movePlan) {
    const oldPath = join(API_DIR, file);
    const newDir = join(API_DIR, subdir);
    const newPath = join(newDir, file);
    if (existsSync(newPath)) {
      console.log(`  skip (exists): ${subdir}/${file}`);
      continue;
    }
    await rename(oldPath, newPath);
  }
  console.log(`  moved ${movePlan.length} files`);

  console.log('\n=== Step 4: Update imports ===');
  // 扫描 client/src 下所有 .ts/.vue 文件，更新 @/api/xxx 引用
  const updatedFiles = await updateImports(pathMap);
  console.log(`  updated ${updatedFiles} files`);

  console.log('\n=== Done ===');
}

async function updateImports(pathMap) {
  // 收集所有 .ts/.vue/.tsx 文件
  const files = await collectFiles(CLIENT_SRC, ['.ts', '.vue', '.tsx']);
  let updated = 0;

  // 构建替换正则: @/api/xxx -> @/api/subdir/xxx
  // 按模块名长度降序，避免 agent 被 agents 前缀匹配
  const modules = Object.keys(pathMap).sort((a, b) => b.length - a.length);

  for (const file of files) {
    let content = await readFile(file, 'utf-8');
    const original = content;

    for (const mod of modules) {
      const newPath = pathMap[mod];
      if (newPath === mod) continue; // 未移动，跳过

      // 替换 @/api/mod -> @/api/subdir/mod
      // 注意边界: @/api/agent 后面不能跟字母/数字/连字符(避免 @/api/agent-buy 误匹配)
      const escaped = mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`@/api/${escaped}(?![\\w-])`, 'g');
      content = content.replace(regex, `@/api/${newPath}`);

      // 替换 ./mod -> ./subdir/mod (仅在同一 api 目录内的文件，如 index.ts)
      // 这种情况较少，且需要判断相对路径，暂不处理
    }

    // 处理 api 目录内的相对引用 ./xxx
    if (file.startsWith(API_DIR)) {
      for (const mod of modules) {
        const newPath = pathMap[mod];
        if (newPath === mod) continue;
        const escaped = mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // ./mod -> ./subdir/mod (但不匹配 ./mod-xxx)
        const regex2 = new RegExp(`(from ['"]\\.)\\/${escaped}(?![\\w-])`, 'g');
        content = content.replace(regex2, `$1/${newPath}`);
      }
    }

    if (content !== original) {
      await writeFile(file, content, 'utf-8');
      updated++;
    }
  }
  return updated;
}

async function collectFiles(dir, exts) {
  const result = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // 跳过 node_modules、dist、.git
      if (['node_modules', 'dist', '.git', '.nuxt', '.output'].includes(entry.name)) continue;
      result.push(...await collectFiles(full, exts));
    } else if (entry.isFile()) {
      if (exts.some(ext => entry.name.endsWith(ext))) {
        result.push(full);
      }
    }
  }
  return result;
}

main().catch(e => { console.error(e); process.exit(1); });
