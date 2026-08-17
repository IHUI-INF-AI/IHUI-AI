/**
 * 修复 dist/index.js 中错误的 .js 扩展名
 * 规则：如果路径对应的是一个目录（有 index.js），则去掉 .js 后缀
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'g:/IHUI-AI';
const PACKAGES = [
  'packages/types',
  'packages/shared',
  'packages/auth',
  'packages/ui-react',
  'packages/design-tokens',
  'packages/api-client',
];

let totalFixed = 0;

for (const pkg of PACKAGES) {
  const distDir = path.join(ROOT, pkg, 'dist');
  if (!fs.existsSync(distDir)) continue;

  const files = findAllJS(distDir);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const result = fixContent(content, path.dirname(file));
    if (result.count > 0) {
      fs.writeFileSync(file, result.content);
      const rel = path.relative(ROOT, file);
      console.log(`[fix] ${rel} (${result.count} replacements)`);
      totalFixed += result.count;
    }
  }
}

console.log(`\nTotal: ${totalFixed} replacements.`);

function findAllJS(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...findAllJS(full));
    } else if (entry.name.endsWith('.js')) {
      result.push(full);
    }
  }
  return result;
}

function resolveTarget(baseDir, modulePath) {
  const filePath = path.join(baseDir, modulePath + '.js');
  if (fs.existsSync(filePath)) return 'file';
  const dirPath = path.join(baseDir, modulePath, 'index.js');
  if (fs.existsSync(dirPath)) return 'dir';
  return null;
}

function fixContent(content, fileDir) {
  let count = 0;
  const lines = content.split('\n');
  const newLines = lines.map(line => {
    const fixed = line.replace(
      /(from\s+['"])(\.\.?[\/][^'"]+?)(['"])/g,
      (match, p1, p2, p3) => {
        if (p2.includes('*') || p2.includes('?')) return match;

        const target = resolveTarget(fileDir, p2);
        if (target === 'dir') {
          // Directory - must NOT have .js suffix
          if (p2.endsWith('.js')) {
            count++;
            return p1 + p2.replace(/\.js$/, '') + p3;
          }
          return match;
        } else if (target === 'file') {
          // File - must have .js suffix
          if (!p2.endsWith('.js')) {
            count++;
            return p1 + p2 + '.js' + p3;
          }
          return match;
        }
        return match;
      }
    );
    return fixed;
  });

  return { content: newLines.join('\n'), count };
}
