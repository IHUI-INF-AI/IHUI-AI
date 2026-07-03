#!/usr/bin/env node
/**
 * 守门脚本：/edu 教育中心路由名一致性 + 侧边栏接入完整性
 *
 * 检测规则 (对应 Phase C 完成 2026-07-04, 23 业务页面 + 32 路由名):
 *   1. edu.ts 中所有 route name 必须以 'Edu' 前缀开头 (命名规范)
 *   2. edu.ts 必须包含恰好 32 个 Edu* 路由名 (防止误删/误增路由)
 *   3. Sidebar.vue nameMap 必须包含全部 32 个 Edu* 路由名 → 'eduCenter' 映射
 *   4. Sidebar.vue prefixMap 必须包含 ['/edu/', 'eduCenter'] + ['/edu', 'eduCenter']
 *   5. Sidebar.vue navGroups 必须包含 key='eduCenter' + path='/edu' 顶级菜单项
 *
 * 设计意图:
 *   防止未来误删 edu 路由 / 忘记在 Sidebar.vue nameMap 补 Edu* 映射,
 *   导致 /edu/* 子路由跳转后侧边栏高亮丢失. 源码级守门比 E2E 快 (<50ms), pre-commit 友好.
 *
 * 用法:
 *   node scripts/check-edu-route-consistency.mjs          # 全量检查
 *   node scripts/check-edu-route-consistency.mjs --staged  # 仅 staged 文件触发
 *
 * 退出码: 0 通过, 1 一致性违规
 *
 * 性能: <50ms (双文件正则扫描, pre-commit 友好)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(clientRoot, '..');

const onlyStaged = process.argv.includes('--staged');

// ════════════════════════════════════════════════════════════════════════
// Phase C 锁定: 32 个 Edu* 路由名 (2026-07-04 立)
// 涵盖 Learn(5) / Exam(4) / Ask(3) / Circle(3) / Live(2) / Member(7) /
//      Point(1) / Order(2) / Message(1) / Notification(1) / Resource(1) /
//      Search(1) + EduHome + EduAdminHome
// ════════════════════════════════════════════════════════════════════════
const EXPECTED_EDU_ROUTE_NAMES = new Set([
  'EduHome',
  'EduLearn',
  'EduLearnDetail',
  'EduLearnChapter',
  'EduLearnCertificate',
  'EduExam',
  'EduExamPaper',
  'EduExamRecord',
  'EduExamWrongBook',
  'EduAsk',
  'EduAskDetail',
  'EduAskCreate',
  'EduCircle',
  'EduCircleDetail',
  'EduCirclePost',
  'EduLive',
  'EduLiveRoom',
  'EduMember',
  'EduMemberReport',
  'EduMemberNotes',
  'EduMemberOfflineRecords',
  'EduMemberCertUpload',
  'EduMemberPapers',
  'EduMemberPaperUpload',
  'EduPoint',
  'EduOrder',
  'EduOrderDetail',
  'EduMessage',
  'EduNotification',
  'EduResource',
  'EduSearch',
  'EduAdminHome',
]);

const EXPECTED_COUNT = EXPECTED_EDU_ROUTE_NAMES.size; // 32

// ─────────────────────────────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────────────────────────────

function readFile(p) {
  return fs.readFileSync(p, 'utf-8');
}

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: projectRoot,
      encoding: 'utf-8',
    });
    return out
      .split('\n')
      .map((s) => s.trim().replace(/\\/g, '/'))
      .filter(Boolean);
  } catch {
    return null;
  }
}

let violationCount = 0;
function report(file, line, msg) {
  console.error(`  [FAIL] ${path.relative(projectRoot, file)}:${line} ${msg}`);
  violationCount++;
}

// ─────────────────────────────────────────────────────────────────────
// 检查 1: edu.ts 路由名提取 + Edu 前缀校验 + 数量校验
// ─────────────────────────────────────────────────────────────────────
function checkEduRouteNames(eduTsPath) {
  console.log('\n[1] edu.ts: 路由名 Edu* 前缀 + 数量校验');
  if (!fs.existsSync(eduTsPath)) {
    console.error(`  [WARN] ${path.relative(projectRoot, eduTsPath)} 不存在, 跳过`);
    return null;
  }
  const src = readFile(eduTsPath);

  // 提取所有 name: 'XxxYyy' 形式的路由名
  const nameRe = /name\s*:\s*['"]([A-Za-z][A-Za-z0-9]*)['"]/g;
  const foundNames = new Set();
  let m;
  while ((m = nameRe.exec(src)) !== null) {
    foundNames.add(m[1]);
  }

  // 1a. 所有路由名必须以 Edu 前缀开头
  let prefixViolations = 0;
  for (const name of foundNames) {
    if (!name.startsWith('Edu')) {
      const lineNo = src.indexOf(`name: '${name}'`) >= 0
        ? src.slice(0, src.indexOf(`name: '${name}'`)).split('\n').length
        : src.slice(0, src.indexOf(`name: "${name}"`)).split('\n').length;
      report(eduTsPath, lineNo, `路由名 '${name}' 不以 'Edu' 前缀开头 (命名规范)`);
      prefixViolations++;
    }
  }
  if (prefixViolations === 0) {
    console.log(`  [OK] 全部 ${foundNames.size} 个路由名均以 'Edu' 前缀开头`);
  }

  // 1b. 数量校验: 必须恰好 EXPECTED_COUNT 个
  if (foundNames.size !== EXPECTED_COUNT) {
    report(eduTsPath, 0, `路由名数量 ${foundNames.size} ≠ 预期 ${EXPECTED_COUNT} (可能误删/误增路由)`);
  } else {
    console.log(`  [OK] 路由名数量 = ${EXPECTED_COUNT}`);
  }

  // 1c. 对比预期集合: 缺失 + 多余
  const missing = [...EXPECTED_EDU_ROUTE_NAMES].filter((n) => !foundNames.has(n));
  const extra = [...foundNames].filter((n) => !EXPECTED_EDU_ROUTE_NAMES.has(n));
  if (missing.length > 0) {
    report(eduTsPath, 0, `缺失路由名: ${missing.join(', ')}`);
  }
  if (extra.length > 0) {
    report(eduTsPath, 0, `多余路由名 (未在锁定清单中): ${extra.join(', ')}`);
  }
  if (missing.length === 0 && extra.length === 0) {
    console.log(`  [OK] 路由名集合与 Phase C 锁定清单完全匹配`);
  }

  return foundNames;
}

// ─────────────────────────────────────────────────────────────────────
// 检查 2: Sidebar.vue nameMap 必须包含全部 Edu* → 'eduCenter' 映射
// ─────────────────────────────────────────────────────────────────────
function checkSidebarNameMap(sidebarPath, eduNames) {
  console.log('\n[2] Sidebar.vue nameMap: Edu* → eduCenter 映射完整性');
  if (!fs.existsSync(sidebarPath)) {
    console.error(`  [WARN] ${path.relative(projectRoot, sidebarPath)} 不存在, 跳过`);
    return;
  }
  const src = readFile(sidebarPath);

  // 提取 nameMap 块 (从 nameMap 声明到闭合 } )
  // 匹配模式: EduXxxName: 'eduCenter',
  const nameMapRe = /(\bEdu[A-Za-z][A-Za-z0-9]*)\s*:\s*['"]eduCenter['"]/g;
  const mappedNames = new Set();
  let m2;
  while ((m2 = nameMapRe.exec(src)) !== null) {
    mappedNames.add(m2[1]);
  }

  // 检查每个 Edu* 路由名是否都在 nameMap 中映射到 'eduCenter'
  const missing = [];
  for (const name of eduNames) {
    if (!mappedNames.has(name)) {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    report(sidebarPath, 0, `nameMap 缺失 ${missing.length} 个 Edu* → 'eduCenter' 映射: ${missing.join(', ')}`);
  } else {
    console.log(`  [OK] nameMap 包含全部 ${eduNames.size} 个 Edu* → 'eduCenter' 映射`);
  }

  // 检查是否有 Edu* 映射到非 'eduCenter' 的值 (可能误映射)
  const wrongMapRe = /(\bEdu[A-Za-z][A-Za-z0-9]*)\s*:\s*['"](?!eduCenter)['"][^'"]+['"]/g;
  let m3;
  while ((m3 = wrongMapRe.exec(src)) !== null) {
    const lineNo = src.slice(0, m3.index).split('\n').length;
    report(sidebarPath, lineNo, `nameMap 中 '${m3[1]}' 映射到非 'eduCenter' 值 ('${m3[0]}')`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 检查 3: Sidebar.vue prefixMap 必须包含 /edu → eduCenter 条目
// ─────────────────────────────────────────────────────────────────────
function checkSidebarPrefixMap(sidebarPath) {
  console.log('\n[3] Sidebar.vue prefixMap: /edu → eduCenter 前缀匹配');
  if (!fs.existsSync(sidebarPath)) {
    return;
  }
  const src = readFile(sidebarPath);

  // 检查 ['/edu/', 'eduCenter'] 和 ['/edu', 'eduCenter'] 是否都存在
  const hasSlashEduSlash = /\['\/edu\/',\s*'eduCenter'\]/.test(src);
  const hasSlashEdu = /\['\/edu',\s*'eduCenter'\]/.test(src);

  if (!hasSlashEduSlash) {
    report(sidebarPath, 0, `prefixMap 缺失 ['/edu/', 'eduCenter'] 条目`);
  } else {
    console.log(`  [OK] prefixMap 包含 ['/edu/', 'eduCenter']`);
  }
  if (!hasSlashEdu) {
    report(sidebarPath, 0, `prefixMap 缺失 ['/edu', 'eduCenter'] 条目`);
  } else {
    console.log(`  [OK] prefixMap 包含 ['/edu', 'eduCenter']`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 检查 4: Sidebar.vue navGroups 必须包含 eduCenter 顶级菜单项
// ─────────────────────────────────────────────────────────────────────
function checkSidebarNavGroups(sidebarPath) {
  console.log('\n[4] Sidebar.vue navGroups: eduCenter 顶级菜单项');
  if (!fs.existsSync(sidebarPath)) {
    return;
  }
  const src = readFile(sidebarPath);

  // 检查 key: 'eduCenter' + path: '/edu' 同时存在于 navGroups
  // 匹配一个对象块内同时含 key: 'eduCenter' 和 path: '/edu'
  const navItemRe = /key\s*:\s*['"]eduCenter['"][\s\S]*?path\s*:\s*['"]\/edu['"]/;
  const hasEduCenterNav = navItemRe.test(src);

  if (!hasEduCenterNav) {
    report(sidebarPath, 0, `navGroups 缺失 key='eduCenter' + path='/edu' 顶级菜单项`);
  } else {
    console.log(`  [OK] navGroups 包含 key='eduCenter' + path='/edu' 顶级菜单项`);
  }

  // 检查 label 引用 navigation.eduCenter i18n key
  const hasEduCenterLabel = /label\s*:\s*t\(['"]navigation\.eduCenter['"]\)/.test(src);
  if (!hasEduCenterLabel) {
    report(sidebarPath, 0, `navGroups eduCenter 项 label 未引用 t('navigation.eduCenter') i18n key`);
  } else {
    console.log(`  [OK] navGroups eduCenter 项 label 引用 t('navigation.eduCenter')`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────────────

const eduTsPath = path.join(clientRoot, 'src', 'router', 'modules', 'edu.ts');
const sidebarPath = path.join(clientRoot, 'src', 'components', 'Sidebar.vue');

// staged 模式: 若 edu.ts 和 Sidebar.vue 都不在 staged, 跳过
let shouldRun = true;
if (onlyStaged) {
  const staged = getStagedFiles();
  if (staged === null) {
    console.log('[staged] git 不可用, 退到全量检查');
  } else {
    const triggers = [
      'client/src/router/modules/edu.ts',
      'client/src/components/Sidebar.vue',
    ];
    const hasTrigger = triggers.some((t) => staged.includes(t));
    if (!hasTrigger) {
      console.log('[staged] edu.ts / Sidebar.vue 不在 staged, 跳过');
      shouldRun = false;
    }
  }
}

if (shouldRun) {
  console.log('═══ /edu 教育中心路由名一致性守门 ═══');
  const eduNames = checkEduRouteNames(eduTsPath);
  if (eduNames) {
    checkSidebarNameMap(sidebarPath, eduNames);
    checkSidebarPrefixMap(sidebarPath);
    checkSidebarNavGroups(sidebarPath);
  }
}

if (violationCount > 0) {
  console.error(`\n[FAIL] 共 ${violationCount} 处违规, /edu 路由名一致性或侧边栏接入不完整`);
  console.error('');
  console.error('  修复指引:');
  console.error('    1. 若新增/删除 edu 路由: 同步更新本脚本 EXPECTED_EDU_ROUTE_NAMES + Sidebar.vue nameMap');
  console.error('    2. 若 nameMap 缺失 Edu* 映射: 在 Sidebar.vue nameMap 中补 EduXxxName: \'eduCenter\'');
  console.error('    3. 若 prefixMap 缺失: 在 Sidebar.vue prefixMap 中补 [\'/edu/\', \'eduCenter\'] + [\'/edu\', \'eduCenter\']');
  console.error('    4. 跑全套验证: npm run check:edu:route-consistency + npx playwright test e2e/edu-sidebar.spec.ts');
  process.exit(1);
}

console.log('\n[OK] /edu 教育中心路由名一致性 + 侧边栏接入守门通过');
