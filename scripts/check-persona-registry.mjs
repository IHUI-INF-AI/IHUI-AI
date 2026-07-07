#!/usr/bin/env node
/**
 * check-persona-registry.mjs
 *
 * Stage C-2 守门: Persona Registry — 140+ expert 角色。
 *
 * 验证项:
 *  1. persona_registry.py 存在 + 语法合法
 *  2. BUILTIN_PERSONAS 数量 ≥ 140
 *  3. 覆盖 6+ 类别 (engineering/creative/business/academic/legal/medical/specialty)
 *  4. Persona 数据类 + Registry + 持久化方法
 *  5. CRUD: add/update/delete/disable/enable
 *  6. 检索 (search) 加权算法
 *  7. routes.py 已注册 7 个端点
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PERSONA = join(ROOT, 'server/app/api/v1/workspace/persona_registry.py')
const ROUTES = join(ROOT, 'server/app/api/v1/workspace/routes.py')

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  const tag = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
  console.log(`  ${tag} ${name}${detail ? ' — ' + detail : ''}`)
}

console.log('\n\x1b[1m[Persona Registry] 守门\x1b[0m')

if (!existsSync(PERSONA)) {
  console.log(`  \x1b[31m✗\x1b[0m persona_registry.py 不存在`)
  process.exit(1)
}
check('persona_registry.py 存在', true)

try {
  execFileSync('python', ['-m', 'py_compile', PERSONA], { stdio: 'pipe' })
  check('Python 语法合法', true)
} catch (e) {
  check('Python 语法合法', false, e.message.slice(0, 100))
}

const src = readFileSync(PERSONA, 'utf8')

// 1. BUILTIN_PERSONAS 数量 (用更稳的方式: 统计 {"id": "..." 出现次数)
const idMatches = src.match(/\{\s*"id":\s*"[a-z0-9_-]+"/g) || []
const personaCount = idMatches.length
check(`BUILTIN_PERSONAS >= 140`, personaCount >= 140, `count=${personaCount}`)

// 2. 7 大类别 (engineering/creative/business/academic/legal/medical/specialty)
const categories = ['engineering', 'creative', 'business', 'academic', 'legal', 'medical', 'specialty']
categories.forEach((c) => {
  check(`类别 ${c}`, src.includes(`"category": "${c}"`))
})

// 3. 数据类
check('Persona dataclass', /@dataclass\s+class Persona:/.test(src))
check('Persona.to_dict', /def to_dict\(self\) -> dict\[str, Any\]:/.test(src))
check('Persona.from_dict', /@classmethod\s+def from_dict\(cls, data: dict\[str, Any\]\) -> Persona:/.test(src))

// 4. Registry 类
check('PersonaRegistry 类', /class PersonaRegistry:/.test(src))
check('单例 get_persona_registry', /def get_persona_registry\(\) -> PersonaRegistry:/.test(src))
check('JSON 持久化', /personas\.json/.test(src))

// 5. CRUD 方法
const crud = [
  ['list_all', /def list_all\(self, include_disabled: bool = False\)/],
  ['list_by_category', /def list_by_category\(self, category: str/],
  ['list_categories', /def list_categories\(self\) -> list/],
  ['get', /def get\(self, persona_id: str\) -> Persona \| None:/],
  ['add', /def add\(self, persona: Persona\) -> Persona:/],
  ['update', /def update\(self, persona_id: str, \*\*kwargs: Any\)/],
  ['delete', /def delete\(self, persona_id: str\) -> bool:/],
  ['disable', /def disable\(self, persona_id: str\) -> bool:/],
  ['enable', /def enable\(self, persona_id: str\) -> bool:/],
  ['search', /def search\(self, query: str, limit: int/],
  ['get_system_prompt', /def get_system_prompt\(self, persona_id: str\) -> str \| None:/],
]
crud.forEach(([name, re]) => check(`方法 ${name}`, re.test(src)))

// 6. 检索加权
check('search 加权 id (20)', /score \+= 20/.test(src))
check('search 加权 name (15)', /score \+= 15/.test(src))
check('search 加权 description (10)', /score \+= 10/.test(src))
check('search 加权 tags (8)', /score \+= 8/.test(src))

// 7. 内置保护
check('禁止删除内置 (ValueError)', /raise ValueError\(f"Persona \{persona_id\} 是内置/.test(src))

// 8. routes 端点 (7 个)
if (existsSync(ROUTES)) {
  const routesSrc = readFileSync(ROUTES, 'utf8')
  check('GET /workspace/personas', /@router\.get\("\/personas"\)/.test(routesSrc))
  check('GET /workspace/personas/categories', /@router\.get\("\/personas\/categories"\)/.test(routesSrc))
  check('GET /workspace/personas/search', /@router\.get\("\/personas\/search"\)/.test(routesSrc))
  check('GET /workspace/personas/{id}', /@router\.get\("\/personas\/\{persona_id\}"\)/.test(routesSrc))
  check('POST /workspace/personas', /@router\.post\("\/personas"\)/.test(routesSrc))
  check('PATCH /workspace/personas/{id}', /@router\.patch\("\/personas\/\{persona_id\}"\)/.test(routesSrc))
  check('DELETE /workspace/personas/{id}', /@router\.delete\("\/personas\/\{persona_id\}"\)/.test(routesSrc))
}

// summary
const failed = results.filter((r) => !r.ok)
console.log(`\n  总计: ${results.length}, 通过: ${results.length - failed.length}, 失败: ${failed.length}`)
if (failed.length > 0) {
  console.log('\n  \x1b[31m[失败明细]\x1b[0m')
  failed.forEach((f) => console.log(`    - ${f.name}: ${f.detail}`))
  process.exit(1)
}
console.log(`\n  \x1b[32m[ALL PASS]\x1b[0m Persona Registry 守门全部通过 (${personaCount} personas)`)
