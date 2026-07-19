#!/usr/bin/env node
/**
 * edu 业务编辑子页抽样核对脚本(架构迁移审计阶段 5)
 *
 * 目标:
 *   阶段 4 发现 236 个真实缺失前端页面,其中约 130 个是 edu 业务编辑/分类子页。
 *   本脚本抽样 30 个关键页面,验证是否在 Next.js /admin/* 下有等价实现。
 *
 * 三分类:
 *   - 已迁移: /admin/* 下存在路径 slug 直接对应的 page.tsx
 *   - 部分迁移: /admin/* 下存在相关业务关键词(路径不同但功能等价)
 *   - 真实缺失: /admin/* 下无任何等价实现
 *
 * 输出:
 *   - reports/migration-audit-edu-pages-sample-{timestamp}.csv
 *   - reports/migration-audit-edu-pages-sample-summary.json
 *
 * 用法: node scripts/audit-edu-pages-sample-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = 'g:/IHUI-AI';
const REPORTS_DIR = path.join(ROOT, 'reports');
const SOURCE_CSV = path.join(
  REPORTS_DIR,
  'migration-audit-frontend-routes-2026-07-19T12-14-57.csv'
);
const ADMIN_DIR = path.join(ROOT, 'apps', 'web', 'app', '(main)', 'admin');
const MAIN_DIR = path.join(ROOT, 'apps', 'web', 'app', '(main)');

// ─── 工具函数 ──────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === ',' && !inQuote) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function walkPages(dir, predicate, visited = new Set()) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const real = fs.realpathSync(dir);
  if (visited.has(real)) return results;
  visited.add(real);
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name === 'dist'
      ) continue;
      results.push(...walkPages(full, predicate, visited));
    } else if (entry.isFile() && predicate(full)) {
      results.push(full);
    }
  }
  return results;
}

function toRel(p) {
  return p.replace(/\\/g, '/').replace(/^g:\/IHUI-AI\/apps\/web\/app\/\(main\)\//, '');
}

function toDisplayPath(p) {
  const rel = toRel(p);
  // admin/edu/exam/questions/[type]/page.tsx → /admin/edu/exam/questions/[type]
  return '/' + rel.replace(/\/page\.tsx$/, '');
}

// ─── 加载约 130 个 edu 业务编辑/分类子页清单 ──────────────────────────

// 编辑/分类/管理子页关键词(任务 spec 列举的 + 示例路径中出现的)
const EDIT_KEYWORDS = [
  '/edit', '/create', '/category', '/trash', '/level', '/group',
  '/template', '/invoice', '/application', '/title',
  // 业务编辑/分类子页扩展(任务示例路径中出现)
  '/single-choice', '/multi-choice', '/judgment', '/fill-blank', '/subjective',
  '/normal', '/random', '/mark', '/list', '/detail', '/record',
  '/sign', '/lessonstudy', '/memberstudy', '/companystudy',
  '/dynamics', '/product', '/tag', '/post', '/hot-word', '/sensitive-word',
  '/announcement', '/buyconfirm', '/payment',
  '/company/type', '/organizational',
  '/paper', '/question-lib', '/answer', '/exam',
];

// 顶层模块首页(深度=1)— 不算"子页",需排除
const TOP_LEVEL_PATHS = new Set([
  '/exam', '/learn', '/live', '/member', '/article', '/ask',
  '/circle', '/resource', '/point', '/comment', '/message',
  '/search', '/news', '/setting', '/auth', '/account',
  '/announcement', '/about', '/error', '/agreement',
  '/forget', '/unauthorized', '/work-we-chat', '/ding-talk',
  '/index', '/help', '/feedback',
]);

function loadEduEditSubpages() {
  const raw = fs.readFileSync(SOURCE_CSV, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < header.length) continue;
    const vuePath = cols[1] || '';
    const vueSource = cols[5] || '';
    const vueProject = cols[6] || '';
    // 仅取 edu client / code\edu 项目
    const isEdu = /edu/i.test(vueSource) || /edu/i.test(vueProject);
    if (!isEdu) continue;
    // 排除语言迁移/SSO/重定向页
    if (/work-we-chat|ding-talk|forget\/pwd|unauthorized|^\//i.test(vuePath) && TOP_LEVEL_PATHS.has(vuePath.toLowerCase())) continue;
    if (TOP_LEVEL_PATHS.has(vuePath.toLowerCase())) continue;
    // 路径必须 2+ 段(子页)
    const segments = vuePath.split('/').filter(Boolean);
    if (segments.length < 2) continue;
    // 包含编辑/分类关键词,或者就是已知业务模块下的子页
    const hasEditKw = EDIT_KEYWORDS.some(kw => vuePath.toLowerCase().includes(kw));
    const isBusinessSubpage = ['exam', 'learn', 'live', 'member', 'article', 'ask',
      'circle', 'resource', 'point', 'comment', 'message', 'search', 'news',
      'setting', 'auth', 'account', 'announcement', 'certificate'].includes(segments[0]);
    if (!hasEditKw && !isBusinessSubpage) continue;
    rows.push({
      category: cols[0],
      vuePath,
      vueName: cols[3] || '',
      vueSource,
      vueProject,
      matchType: cols[8] || '',
      nextPath: cols[9] || '',
      nextFile: cols[11] || '',
      analysis: cols[12] || '',
    });
  }
  // 去重(同一路径在 edu client / code\edu 两个项目都有)
  const seen = new Set();
  const unique = [];
  for (const r of rows) {
    if (seen.has(r.vuePath)) continue;
    seen.add(r.vuePath);
    unique.push(r);
  }
  return unique;
}

// ─── 30 个抽样页面(覆盖 exam/learn/live/member/order 5 个模块) ───────

const SAMPLES = [
  // ── exam 模块 (10 个) ──────────────────────────────────────────
  {
    vuePath: '/exam/question-lib/single-choice',
    module: 'exam',
    desc: '单选题编辑',
    pathSlugs: ['single-choice', 'singleChoice', 'single_choice'],
    keywords: ['single-choice', 'singleChoice', 'single_choice', '单选'],
  },
  {
    vuePath: '/exam/question-lib/multi-choice',
    module: 'exam',
    desc: '多选题编辑',
    pathSlugs: ['multi-choice', 'multiChoice', 'multi_choice'],
    keywords: ['multi-choice', 'multiChoice', 'multi_choice', '多选'],
  },
  {
    vuePath: '/exam/question-lib/judgment',
    module: 'exam',
    desc: '判断题编辑',
    pathSlugs: ['judgment'],
    keywords: ['judgment', '判断题'],
  },
  {
    vuePath: '/exam/question-lib/fill-blank',
    module: 'exam',
    desc: '填空题编辑',
    pathSlugs: ['fill-blank', 'fillBlank', 'fill_blank'],
    keywords: ['fill-blank', 'fillBlank', 'fill_blank', '填空'],
  },
  {
    vuePath: '/exam/question-lib/subjective',
    module: 'exam',
    desc: '主观题编辑',
    pathSlugs: ['subjective'],
    keywords: ['subjective', '主观'],
  },
  {
    vuePath: '/exam/paper/normal',
    module: 'exam',
    desc: '正常试卷编辑',
    pathSlugs: ['paper-normal', 'paperNormal', 'papers-manual', 'papersManual'],
    keywords: ['papers-manual', 'papersManual', 'paper-normal', 'paperNormal', '正常试卷', '普通试卷'],
  },
  {
    vuePath: '/exam/paper/random',
    module: 'exam',
    desc: '随机试卷编辑',
    pathSlugs: ['paper-random', 'paperRandom', 'papers-random', 'papersRandom'],
    keywords: ['papers-random', 'papersRandom', 'paper-random', 'paperRandom', '随机试卷'],
  },
  {
    vuePath: '/exam/paper/category',
    module: 'exam',
    desc: '试卷分类',
    pathSlugs: ['paper-category', 'paperCategory'],
    keywords: ['paper-category', 'paperCategory', '试卷分类', 'CategoriesDialog', 'exam/categories'],
  },
  {
    vuePath: '/exam/exam/edit',
    module: 'exam',
    desc: '考试编辑',
    pathSlugs: ['exam-edit', 'examEdit', 'ExamDialog'],
    keywords: ['exam-edit', 'examEdit', 'ExamDialog', '考试编辑'],
  },
  {
    vuePath: '/exam/answer/mark',
    module: 'exam',
    desc: '阅卷',
    pathSlugs: ['answer-mark', 'answerMark', 'mark'],
    keywords: ['answer-mark', 'answerMark', '阅卷', 'mark-paper', 'markPaper'],
  },
  // ── learn 模块 (8 个) ──────────────────────────────────────────
  {
    vuePath: '/learn/lesson/edit',
    module: 'learn',
    desc: '课时编辑',
    pathSlugs: ['lesson-edit', 'lessonEdit', 'LearnDialog'],
    keywords: ['lesson-edit', 'lessonEdit', 'LearnDialog', '课时编辑'],
  },
  {
    vuePath: '/learn/lesson/category',
    module: 'learn',
    desc: '课时分类',
    pathSlugs: ['lesson-category', 'lessonCategory', 'LearnCategory', 'learn/categories'],
    keywords: ['lesson-category', 'lessonCategory', 'LearnCategory', '课时分类'],
  },
  {
    vuePath: '/learn/lesson/trash',
    module: 'learn',
    desc: '课时回收站',
    pathSlugs: ['lesson-trash', 'lessonTrash', 'trash'],
    keywords: ['lesson-trash', 'lessonTrash', '课时回收站', 'admin/edu/course/trash'],
  },
  {
    vuePath: '/learn/topic/edit',
    module: 'learn',
    desc: '专题编辑',
    pathSlugs: ['topic-edit', 'topicEdit', 'TopicsDialog'],
    keywords: ['topic-edit', 'topicEdit', 'TopicsDialog', '专题编辑'],
  },
  {
    vuePath: '/learn/topic/category',
    module: 'learn',
    desc: '专题分类',
    pathSlugs: ['topic-category', 'topicCategory'],
    keywords: ['topic-category', 'topicCategory', '专题分类'],
  },
  {
    vuePath: '/learn/certificate/template',
    module: 'learn',
    desc: '证书模板列表',
    pathSlugs: ['certificate-template', 'certificateTemplate', 'cert-template', 'CertTemplate'],
    keywords: ['certificate-template', 'certificateTemplate', 'cert-template', 'CertTemplate', '证书模板'],
  },
  {
    vuePath: '/learn/certificate/template/edit',
    module: 'learn',
    desc: '证书模板编辑',
    pathSlugs: ['certificate-template-edit', 'certificateTemplateEdit', 'cert-template-edit'],
    keywords: ['certificate-template-edit', 'certificateTemplateEdit', 'cert-template-edit', 'CertTemplateDialog', '证书模板编辑'],
  },
  {
    vuePath: '/learn/data/sign',
    module: 'learn',
    desc: '学习签到数据',
    pathSlugs: ['data-sign', 'dataSign', 'sign'],
    keywords: ['data-sign', 'dataSign', '签到', 'signup'],
  },
  // ── live 模块 (4 个) ───────────────────────────────────────────
  {
    vuePath: '/live/channel/edit',
    module: 'live',
    desc: '频道编辑',
    pathSlugs: ['channel-edit', 'channelEdit', 'ChannelForm'],
    keywords: ['channel-edit', 'channelEdit', 'ChannelFormDialog', '频道编辑'],
  },
  {
    vuePath: '/live/channel/category',
    module: 'live',
    desc: '频道分类',
    pathSlugs: ['channel-category', 'channelCategory', 'live-categories', 'LiveCategory'],
    keywords: ['channel-category', 'channelCategory', 'LiveCategory', '频道分类'],
  },
  {
    vuePath: '/live/lecturer/list',
    module: 'live',
    desc: '讲师列表',
    pathSlugs: ['lecturer-list', 'lecturerList', 'lecturers'],
    keywords: ['lecturer-list', 'lecturerList', 'lecturers', '讲师列表'],
  },
  {
    vuePath: '/live/lecturer/edit',
    module: 'live',
    desc: '讲师编辑',
    pathSlugs: ['lecturer-edit', 'lecturerEdit', 'LecturerDialog'],
    keywords: ['lecturer-edit', 'lecturerEdit', 'LecturerDialog', '讲师编辑'],
  },
  // ── member 模块 (5 个) ─────────────────────────────────────────
  {
    vuePath: '/member/edit',
    module: 'member',
    desc: '会员编辑',
    pathSlugs: ['member-edit', 'memberEdit', 'MemberCreate', 'MemberDialog'],
    keywords: ['member-edit', 'memberEdit', 'MemberCreateDialog', 'MemberDialog', '会员编辑'],
  },
  {
    vuePath: '/member/group',
    module: 'member',
    desc: '会员分组',
    pathSlugs: ['member-group', 'memberGroup'],
    keywords: ['member-group', 'memberGroup', '会员分组'],
  },
  {
    vuePath: '/member/level',
    module: 'member',
    desc: '会员等级',
    pathSlugs: ['member-level', 'memberLevel', 'levels'],
    keywords: ['member-level', 'memberLevel', 'levels', '会员等级'],
  },
  {
    vuePath: '/member/tag',
    module: 'member',
    desc: '会员标签',
    pathSlugs: ['member-tag', 'memberTag', 'admin/tags'],
    keywords: ['member-tag', 'memberTag', '会员标签', 'TagDialog', 'admin/tags'],
  },
  {
    vuePath: '/member/company',
    module: 'member',
    desc: '会员公司',
    pathSlugs: ['member-company', 'memberCompany', 'companies'],
    keywords: ['member-company', 'memberCompany', 'companies', '会员公司'],
  },
  // ── order 模块 (3 个) ──────────────────────────────────────────
  {
    vuePath: '/learn/order',
    module: 'order',
    desc: '订单列表',
    pathSlugs: ['learn-order', 'learnOrder', 'orders'],
    keywords: ['learn-order', 'learnOrder', '订单列表'],
  },
  {
    vuePath: '/learn/order/invoice/application',
    module: 'order',
    desc: '发票申请',
    pathSlugs: ['invoice-application', 'invoiceApplication', 'invoices'],
    keywords: ['invoice-application', 'invoiceApplication', 'invoices', '发票申请'],
  },
  {
    vuePath: '/learn/order/invoice/title',
    module: 'order',
    desc: '发票抬头',
    pathSlugs: ['invoice-title', 'invoiceTitle'],
    keywords: ['invoice-title', 'invoiceTitle', '发票抬头'],
  },
];

// ─── 收集 Next.js 候选 page.tsx ────────────────────────────────────────

function collectNextPages() {
  const allPages = [
    ...walkPages(ADMIN_DIR, p => p.endsWith('page.tsx')),
    ...walkPages(MAIN_DIR, p => p.endsWith('page.tsx')),
  ];
  // 同时收集 Dialog/Table/Helper 等组件文件(用于关键词搜索定位)
  const allComponents = [
    ...walkPages(ADMIN_DIR, p => /\.(t|j)sx?$/.test(p)),
    ...walkPages(MAIN_DIR, p => /\.(t|j)sx?$/.test(p)),
  ];
  return { allPages, allComponents };
}

// ─── 用 rg 在文件内容中搜索关键词 ───────────────────────────────────

function rgSearch(keyword, searchDir) {
  try {
    const out = execFileSync(
      'rg',
      ['-l', '-i', '--no-heading', keyword, searchDir],
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

// ─── 三分类评估 ────────────────────────────────────────────────────────

function classify(sample, allPages, allComponents) {
  const { pathSlugs, keywords, vuePath, module: mod } = sample;

  // 1) 路径 slug 精确匹配(在 page.tsx 路径中包含 slug)
  //    特殊:动态路由 [type] 可覆盖多种题型
  const slugMatches = [];
  for (const p of allPages) {
    const rel = toRel(p).toLowerCase();
    // 处理 [type] 动态路由:若 vuePath 属于题型(single-choice/multi-choice/judgment/fill-blank/subjective)
    //   且 Next.js 有 admin/edu/exam/questions/[type]/page.tsx → 视为已迁移
    if (
      /exam\/question-lib\//.test(vuePath) &&
      /admin\/edu\/exam\/questions\/\[type\]\/page\.tsx$/.test(rel)
    ) {
      slugMatches.push({ file: p, kind: 'dynamic-type' });
      continue;
    }
    for (const slug of pathSlugs) {
      const s = slug.toLowerCase();
      // 匹配 kebab-case / camelCase / snake_case 中的任一形式
      const slugVariants = [
        s,
        s.replace(/-/g, ''),
        s.replace(/-/g, '_'),
      ];
      if (slugVariants.some(v => rel.includes(v))) {
        slugMatches.push({ file: p, kind: 'slug', slug });
        break;
      }
    }
  }

  if (slugMatches.length > 0) {
    const best = slugMatches[0];
    return {
      decision: '已迁移',
      matchType: best.kind === 'dynamic-type' ? 'dynamic-route-match' : 'path-slug-match',
      matchEvidence: `path slug "${best.slug || '[type]'}" 命中 ${toRel(best.file)}`,
      nextPath: toDisplayPath(best.file),
      nextFile: best.file,
    };
  }

  // 2) 业务关键词在 page.tsx 路径中匹配(部分迁移 — 路径不同但功能等价)
  for (const p of allPages) {
    const rel = toRel(p).toLowerCase();
    // 仅匹配 /admin/* 下的页面(等价实现应该在 admin 下)
    if (!rel.startsWith('admin/')) continue;
    for (const kw of keywords) {
      const k = kw.toLowerCase();
      if (rel.includes(k)) {
        return {
          decision: '部分迁移',
          matchType: 'admin-page-keyword-match',
          matchEvidence: `keyword "${kw}" 命中 page 路径 ${rel}`,
          nextPath: toDisplayPath(p),
          nextFile: p,
        };
      }
    }
  }

  // 3) 业务关键词在组件文件名/路径中匹配(CertTemplateDialog / LecturerDialog 等)
  for (const p of allComponents) {
    const rel = toRel(p).toLowerCase();
    if (!rel.startsWith('admin/')) continue;
    for (const kw of keywords) {
      const k = kw.toLowerCase();
      // 仅匹配文件名,避免误命中(如 "level" 命中 "levels/LevelDialog")
      const fname = path.basename(rel);
      if (fname.includes(k)) {
        return {
          decision: '部分迁移',
          matchType: 'admin-component-name-match',
          matchEvidence: `keyword "${kw}" 命中组件文件名 ${rel}`,
          nextPath: toDisplayPath(p).replace(/\/[^/]+$/, ''),
          nextFile: p,
        };
      }
    }
  }

  // 4) rg 全文搜索 /admin 目录
  for (const kw of keywords) {
    const hits = rgSearch(kw, ADMIN_DIR);
    if (hits.length > 0) {
      const first = hits[0];
      return {
        decision: '部分迁移',
        matchType: 'admin-content-keyword-match',
        matchEvidence: `rg -i "${kw}" 命中 ${toRel(first)}`,
        nextPath: toDisplayPath(first).replace(/\/[^/]+\.\w+$/, ''),
        nextFile: first,
      };
    }
  }

  // 5) 智能回退:Vue 是独立 edit 页,Next.js 用 Dialog 模式实现
  //    若 /admin/edu/{module}/page.tsx 存在且目录下有 *Dialog.tsx → 部分迁移
  if (/\/(edit|create)$/.test(vuePath)) {
    const segments = vuePath.split('/').filter(Boolean);
    // /learn/lesson/edit → 检查 admin/edu/learn/(lesson?)/page.tsx
    // /exam/exam/edit → 检查 admin/edu/exam/page.tsx
    // /member/edit → 检查 admin/members/page.tsx
    const baseSegment = segments[segments.length - 2] || segments[0];
    const moduleSegment = segments[0];
    const candidates = [
      path.join(ADMIN_DIR, 'edu', moduleSegment, 'page.tsx'),
      path.join(ADMIN_DIR, 'edu', moduleSegment, baseSegment, 'page.tsx'),
      path.join(ADMIN_DIR, moduleSegment + 's', 'page.tsx'),
      path.join(ADMIN_DIR, moduleSegment, 'page.tsx'),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        const dir = path.dirname(cand);
        // 检查同级目录或子目录是否有 *Dialog.tsx
        let dialogFound = false;
        const walk = (d, depth = 0) => {
          if (depth > 2 || dialogFound) return;
          let entries;
          try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
          for (const e of entries) {
            if (e.isFile() && /Dialog\.tsx$/i.test(e.name)) {
              dialogFound = true;
              return;
            }
            if (e.isDirectory() && e.name !== 'node_modules') {
              walk(path.join(d, e.name), depth + 1);
            }
          }
        };
        walk(dir);
        if (dialogFound) {
          return {
            decision: '部分迁移',
            matchType: 'admin-dialog-pattern-match',
            matchEvidence: `Vue 独立 edit 页 → Next.js ${toRel(cand)} + Dialog 模式实现编辑`,
            nextPath: toDisplayPath(cand),
            nextFile: cand,
          };
        }
      }
    }
  }

  // 6) 无任何匹配 → 真实缺失
  return {
    decision: '真实缺失',
    matchType: 'no-match',
    matchEvidence: 'rg + path slug + component name + dialog pattern 全部未命中',
    nextPath: '',
    nextFile: '',
  };
}

// ─── 主流程 ────────────────────────────────────────────────────────────

function main() {
  // Step 1: 加载 130 个 edu 编辑子页
  const eduPages = loadEduEditSubpages();
  console.log(`[Step 1] 加载 ${eduPages.length} 个 edu 业务编辑/分类子页`);

  // 按模块分组统计
  const moduleCount = {};
  for (const r of eduPages) {
    const mod = r.vuePath.split('/')[1] || 'root';
    moduleCount[mod] = (moduleCount[mod] || 0) + 1;
  }
  console.log('[Step 1] 模块分布:', moduleCount);

  // Step 2: 收集 Next.js 候选页面
  const { allPages, allComponents } = collectNextPages();
  console.log(`[Step 2] 收集 Next.js page.tsx: ${allPages.length}, 组件文件: ${allComponents.length}`);

  // Step 3: 对 30 个抽样页面做三分类
  const results = [];
  for (const sample of SAMPLES) {
    const r = classify(sample, allPages, allComponents);
    results.push({
      vuePath: sample.vuePath,
      module: sample.module,
      desc: sample.desc,
      pathSlugs: sample.pathSlugs.join('|'),
      keywords: sample.keywords.join('|'),
      decision: r.decision,
      matchType: r.matchType,
      matchEvidence: r.matchEvidence,
      nextPath: r.nextPath,
      nextFile: r.nextFile,
    });
    console.log(`[Step 3] ${sample.vuePath} → ${r.decision} (${r.matchType})`);
  }

  // Step 4: 写 CSV
  const tsStr = ts();
  const csvPath = path.join(
    REPORTS_DIR,
    `migration-audit-edu-pages-sample-${tsStr}.csv`
  );
  const csvLines = [
    [
      'vue_path', 'module', 'desc', 'path_slugs', 'keywords',
      'decision', 'match_type', 'match_evidence', 'next_path', 'next_file',
    ].join(',')
  ];
  for (const r of results) {
    const row = [
      r.vuePath,
      r.module,
      r.desc,
      `"${r.pathSlugs}"`,
      `"${r.keywords}"`,
      r.decision,
      r.matchType,
      `"${r.matchEvidence.replace(/"/g, '""')}"`,
      r.nextPath,
      r.nextFile.replace(/\\/g, '/'),
    ];
    csvLines.push(row.join(','));
  }
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
  console.log(`[Step 4] CSV 写入: ${csvPath}`);

  // Step 5: 写 summary.json
  const decisionCount = { '已迁移': 0, '部分迁移': 0, '真实缺失': 0 };
  const moduleStat = {};
  for (const r of results) {
    decisionCount[r.decision] = (decisionCount[r.decision] || 0) + 1;
    if (!moduleStat[r.module]) {
      moduleStat[r.module] = { '已迁移': 0, '部分迁移': 0, '真实缺失': 0, total: 0 };
    }
    moduleStat[r.module][r.decision]++;
    moduleStat[r.module].total++;
  }
  const summary = {
    generatedAt: new Date().toISOString(),
    sourceCsv: SOURCE_CSV.replace(/\\/g, '/'),
    totalEduEditSubpages: eduPages.length,
    sampleSize: results.length,
    decisionCount,
    moduleStat,
    samples: results.map(r => ({
      vuePath: r.vuePath,
      module: r.module,
      desc: r.desc,
      decision: r.decision,
      matchType: r.matchType,
      matchEvidence: r.matchEvidence,
      nextPath: r.nextPath,
    })),
  };
  const summaryPath = path.join(
    REPORTS_DIR,
    'migration-audit-edu-pages-sample-summary.json'
  );
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`[Step 5] summary.json 写入: ${summaryPath}`);

  // Step 6: 控制台打印统计
  console.log('\n========= 抽样核对结果 =========');
  console.log(`抽样总数: ${results.length}`);
  console.log(`  已迁移:   ${decisionCount['已迁移']}`);
  console.log(`  部分迁移: ${decisionCount['部分迁移']}`);
  console.log(`  真实缺失: ${decisionCount['真实缺失']}`);
  console.log('按模块统计:');
  for (const [mod, s] of Object.entries(moduleStat)) {
    console.log(
      `  ${mod}: 总 ${s.total} / 已迁移 ${s['已迁移']} / 部分迁移 ${s['部分迁移']} / 真实缺失 ${s['真实缺失']}`
    );
  }
  console.log('================================\n');

  // 退出码 0(脚本不直接失败,即使是真实缺失,也只是审计结论)
  process.exit(0);
}

main();
