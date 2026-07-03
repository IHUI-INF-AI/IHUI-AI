// scripts/categorize-git-status.mjs
// 一键按域分桶工作区变更 (commit/stash/discard 策略)

import { execSync } from 'child_process';

const BUCKETS = [
  { name: 'env',       pattern: /^(\.env|\.env\.[\w-]+|server\/\.env|server\/\.env\.[\w-]+|client\/\.env|client\/\.env\.[\w-]+)$/ },
  { name: 'husky',     pattern: /^\.?\.husky\// },
  { name: 'ci',        pattern: /^\.github\// },
  { name: 'gitignore', pattern: /^\.gitignore$/ },
  { name: 'docs',      pattern: /^(docs|server\/docs|AGENTS\.md|README\.md)$/ },
  { name: 'scripts',   pattern: /^(client\/scripts|client\/\.husky|client\/.husky\/pre-commit)/ },
  { name: 'e2e',       pattern: /^client\/e2e\// },
  { name: 'src',       pattern: /^client\/src\// },
  { name: 'locales',   pattern: /^client\/src\/locales\// },
  { name: 'styles',    pattern: /^client\/src\/styles\// },
  { name: 'views',     pattern: /^client\/src\/views\// },
  { name: 'components',pattern: /^client\/src\/components\// },
  { name: 'assets',    pattern: /^client\/src\/assets\// },
  { name: 'router',    pattern: /^client\/src\/router\// },
  { name: 'utils',     pattern: /^client\/src\/utils\// },
  { name: 'config',    pattern: /^client\/config\// },
  { name: 'server',    pattern: /^server\// },
  { name: 'sdk',       pattern: /^server\/sdk\// },
  { name: 'pkg-config',pattern: /^(client\/package\.json|client\/package-lock\.json|server\/.*\.toml|server\/.*\.cfg|server\/.*requirements.*\.txt)$/ },
  { name: 'miniapp',   pattern: /^client\/miniapp\// },
  { name: 'misc',      pattern: /.*/ },
];

const STATUS_RE = /^(.{2})\s+(.+)$/;

function categorize(file) {
  for (const bucket of BUCKETS) {
    if (bucket.pattern.test(file)) return bucket.name;
  }
  return 'misc';
}

function getStrategy(bucket, status) {
  // first char: staged (X), second: unstaged (Y)
  // ?? untracked, !! ignored, M modified, A added, D deleted, R renamed, C copied, U unmerged
  const X = status[0];
  const Y = status[1];
  const isStaged = X !== ' ' && X !== '?';
  const isUnstaged = Y !== ' ' && Y !== '?';
  const isUntracked = X === '?' && Y === '?';
  const isConflict = X === 'U' || Y === 'U';

  if (isConflict) return 'CONFLICT';

  // 策略映射
  const strategies = {
    env: 'COMMIT (env 示例, 不含密钥)',
    husky: 'COMMIT (钩子同步必备)',
    ci: 'COMMIT (CI 配置)',
    gitignore: 'COMMIT (.gitignore 卫生)',
    docs: 'COMMIT (docs 同步)',
    scripts: 'COMMIT (守门脚本)',
    e2e: 'COMMIT (E2E 测试)',
    src: 'COMMIT (业务代码)',
    locales: 'COMMIT (i18n 同步)',
    styles: 'COMMIT (主题/样式)',
    views: 'COMMIT (页面)',
    components: 'COMMIT (组件)',
    assets: 'COMMIT (静态资源)',
    router: 'COMMIT (路由)',
    utils: 'COMMIT (工具函数)',
    config: 'COMMIT (端口/路径配置)',
    server: 'COMMIT (后端代码)',
    sdk: 'COMMIT (SDK 生成代码)',
    'pkg-config': 'COMMIT (依赖配置)',
    miniapp: 'COMMIT (小程序代码)',
    misc: 'REVIEW (单独确认)',
  };

  return strategies[bucket] || 'REVIEW';
}

function main() {
  const raw = execSync('git status --porcelain', { encoding: 'utf8' });
  const lines = raw.split('\n').filter(Boolean);

  const byBucket = {};
  const conflicts = [];

  for (const line of lines) {
    const m = line.match(STATUS_RE);
    if (!m) continue;
    const [, status, file] = m;

    if (status.includes('U')) {
      conflicts.push({ status, file });
      continue;
    }

    const bucket = categorize(file);
    if (!byBucket[bucket]) byBucket[bucket] = [];
    byBucket[bucket].push({ status, file, strategy: getStrategy(bucket, status) });
  }

  console.log('## 工作区分桶报告\n');
  console.log(`总文件数: ${lines.length} | 冲突: ${conflicts.length}\n`);

  for (const [bucket, entries] of Object.entries(byBucket)) {
    if (entries.length === 0) continue;
    console.log(`### ${bucket} (${entries.length})`);
    // 按策略分组
    const byStrategy = {};
    for (const e of entries) {
      const s = e.strategy.split(' ')[0];
      if (!byStrategy[s]) byStrategy[s] = [];
      byStrategy[s].push(e);
    }
    for (const [strategy, items] of Object.entries(byStrategy)) {
      console.log(`  - ${strategy} (${items.length}):`);
      for (const item of items.slice(0, 10)) {
        console.log(`    ${item.status} ${item.file}`);
      }
      if (items.length > 10) {
        console.log(`    ... 还有 ${items.length - 10} 个`);
      }
    }
  }

  if (conflicts.length > 0) {
    console.log('\n### 冲突未解决 (需先处理)');
    for (const c of conflicts) {
      console.log(`  - ${c.status} ${c.file}`);
    }
  }
}

main();
