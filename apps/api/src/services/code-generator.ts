/**
 * Admin 工具代码生成器服务。
 *
 * 支持 4 种模板:
 *  - list:    列表页(table + 分页 + 搜索)
 *  - page:    CRUD 页面(列表 + 新建/编辑对话框)
 *  - detail:  详情页(只读字段展示)
 *  - dialog:  表单对话框(独立弹窗)
 *
 * 模板基于真实项目惯例编写,生成可直接复制到 apps/web 下的 .tsx 文件。
 * 不依赖任何运行时状态,纯函数,易于单元测试。
 */

export type GenType = 'list' | 'page' | 'detail' | 'dialog'

export const GEN_TYPES: GenType[] = ['list', 'page', 'detail', 'dialog']

export interface GenField {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date'
  label?: string
  required?: boolean
}

export interface GenInput {
  type: GenType
  name: string
  fields: GenField[]
  options?: {
    withSearch?: boolean
    withPagination?: boolean
    withActions?: boolean
  }
}

export interface GenResult {
  type: GenType
  moduleName: string
  files: { path: string; content: string }[]
  /** 合并所有文件,方便前端单预览框展示 */
  combined: string
}

const DEFAULT_OPTIONS: Required<NonNullable<GenInput['options']>> = {
  withSearch: true,
  withPagination: true,
  withActions: true,
}

function toPascal(s: string): string {
  return s
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (_, c) => c.toUpperCase())
}

function toKebab(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
}

function defaultLabel(name: string): string {
  // userName -> User Name
  return toPascal(name).replace(/([A-Z])/g, ' $1').trim()
}

function tsType(t: GenField['type']): string {
  return t === 'boolean' ? 'boolean' : t === 'number' ? 'number' : t === 'date' ? 'string' : 'string'
}

function renderTableHeader(fields: GenField[]): string {
  return fields
    .map((f) => `              <TableHead>${f.label ?? defaultLabel(f.name)}</TableHead>`)
    .join('\n')
}

function renderTableCell(fields: GenField[]): string {
  return fields
    .map((f) => `              <TableCell>{item.${f.name}}</TableCell>`)
    .join('\n')
}

function renderFormFields(fields: GenField[]): string {
  return fields
    .map((f) => {
      const label = f.label ?? defaultLabel(f.name)
      const required = f.required ? ' *' : ''
      if (f.type === 'boolean') {
        return `            <div className="space-y-2">\n              <Label>${label}${required}</Label>\n              <Switch checked={form.${f.name}} onCheckedChange={(v) => setForm({ ...form, ${f.name}: v })} />\n            </div>`
      }
      if (f.type === 'date') {
        return `            <div className="space-y-2">\n              <Label>${label}${required}</Label>\n              <Input type="datetime-local" value={form.${f.name}} onChange={(e) => setForm({ ...form, ${f.name}: e.target.value })} />\n            </div>`
      }
      const inputType = f.type === 'number' ? 'number' : 'text'
      return `            <div className="space-y-2">\n              <Label>${label}${required}</Label>\n              <Input type="${inputType}" value={form.${f.name}} onChange={(e) => setForm({ ...form, ${f.name}: e.target.value })} />\n            </div>`
    })
    .join('\n')
}

function renderDetailRows(fields: GenField[]): string {
  return fields
    .map((f) => {
      const label = f.label ?? defaultLabel(f.name)
      return `              <div className="flex justify-between border-b py-2">\n                <span className="text-muted-foreground">${label}</span>\n                <span>{item.${f.name}}</span>\n              </div>`
    })
    .join('\n')
}

function genList(input: GenInput, opts: Required<NonNullable<GenInput['options']>>): string {
  const { name, fields } = input
  const pascal = toPascal(name)
  const tableHeader = renderTableHeader(fields)
  const tableCell = renderTableCell(fields)
  const searchBox = opts.withSearch
    ? `          <div className="flex gap-2">\n            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索..." className="max-w-sm" />\n          </div>`
    : ''
  const pagination = opts.withPagination
    ? `      <Pagination current={page} total={total} pageSize={pageSize} onChange={setPage} />`
    : ''
  return `import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Pagination } from '@ihui/ui'

interface ${pascal} {
${fields.map((f) => `  ${f.name}: ${tsType(f.type)}`).join('\n')}
}

export default function ${pascal}ListPage() {
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [pageSize] = React.useState(20)
  const [total] = React.useState(0)
  const [list] = React.useState<${pascal}[]>([])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">${pascal}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>${pascal}</CardTitle>
        </CardHeader>
        <CardContent>
${searchBox}
          <Table>
            <TableHeader>
              <TableRow>
${tableHeader}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((item) => (
                <TableRow key={item.${fields[0]?.name ?? 'id'}}>
${tableCell}
                </TableRow>
              ))}
            </TableBody>
          </Table>
${pagination}
        </CardContent>
      </Card>
    </div>
  )
}
`
}

function genPage(input: GenInput, opts: Required<NonNullable<GenInput['options']>>): string {
  const { name, fields } = input
  const pascal = toPascal(name)
  const formFields = renderFormFields(fields)
  const tableHeader = renderTableHeader(fields)
  const tableCell = renderTableCell(fields)
  const actionButtons = opts.withActions
    ? `            <Button variant="outline" size="sm" onClick={() => onEdit(item)}>编辑</Button>\n            <Button variant="destructive" size="sm" onClick={() => onDelete(item)}>删除</Button>`
    : ''
  return `import * as React from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ihui/ui'

interface ${pascal} {
${fields.map((f) => `  ${f.name}: ${tsType(f.type)}`).join('\n')}
}

const emptyForm: ${pascal} = {
${fields.map((f) => `  ${f.name}: ${f.type === 'boolean' ? 'false' : f.type === 'number' ? '0' : "''"}`).join(',\n')}
}

export default function ${pascal}Page() {
  const [list, setList] = React.useState<${pascal}[]>([])
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<${pascal}>(emptyForm)

  function onAdd() { setForm(emptyForm); setOpen(true) }
  function onEdit(item: ${pascal}) { setForm(item); setOpen(true) }
  function onDelete(item: ${pascal}) { setList(list.filter((x) => x !== item)) }
  function onSave() { setList([...list, form]); setOpen(false) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">${pascal}</h1>
        <Button onClick={onAdd}>新增</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>${pascal}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
${tableHeader}
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((item) => (
                <TableRow key={item.${fields[0]?.name ?? 'id'}}>
${tableCell}
                  <TableCell className="flex gap-2">
${actionButtons}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>${pascal}</DialogTitle></DialogHeader>
          <div className="space-y-4">
${formFields}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={onSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
`
}

function genDetail(input: GenInput): string {
  const { name, fields } = input
  const pascal = toPascal(name)
  const detailRows = renderDetailRows(fields)
  return `import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

interface ${pascal} {
${fields.map((f) => `  ${f.name}: ${tsType(f.type)}`).join('\n')}
}

export default function ${pascal}DetailPage({ item }: { item: ${pascal} }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">${pascal} 详情</h1>
      <Card>
        <CardHeader><CardTitle>${pascal}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1">
${detailRows}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
`
}

function genDialog(input: GenInput): string {
  const { name, fields } = input
  const pascal = toPascal(name)
  const formFields = renderFormFields(fields)
  return `import * as React from 'react'
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label } from '@ihui/ui'

interface ${pascal} {
${fields.map((f) => `  ${f.name}: ${tsType(f.type)}`).join('\n')}
}

const emptyForm: ${pascal} = {
${fields.map((f) => `  ${f.name}: ${f.type === 'boolean' ? 'false' : f.type === 'number' ? '0' : "''"}`).join(',\n')}
}

export function ${pascal}FormDialog({
  open, onOpenChange, onSubmit,
}: { open: boolean; onOpenChange: (v: boolean) => void; onSubmit: (v: ${pascal}) => void }) {
  const [form, setForm] = React.useState<${pascal}>(emptyForm)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>${pascal}</DialogTitle></DialogHeader>
        <div className="space-y-4">
${formFields}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => { onSubmit(form); onOpenChange(false) }}>提交</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
`
}

export function generate(input: GenInput): GenResult {
  const opts = { ...DEFAULT_OPTIONS, ...(input.options ?? {}) }
  const pascal = toPascal(input.name)
  const kebab = toKebab(input.name)

  let content = ''
  switch (input.type) {
    case 'list':
      content = genList(input, opts)
      break
    case 'page':
      content = genPage(input, opts)
      break
    case 'detail':
      content = genDetail(input)
      break
    case 'dialog':
      content = genDialog(input)
      break
    default:
      throw new Error(`Unsupported gen type: ${String((input as { type: string }).type)}`)
  }

  const files: Array<{ path: string; content: string }> = [
    {
      path: `apps/web/app/(main)/admin/${kebab}/page.tsx`,
      content,
    },
  ]
  if (input.type === 'dialog') {
    // dialog 模板额外生成 form-fields schema 文件
    const fieldsForSchema = input.fields
      .map(
        (f) =>
          `  ${f.name}: z.${f.type === 'number' ? 'number()' : f.type === 'boolean' ? 'boolean()' : 'string()'}${f.required ? '' : '.optional()'},`,
      )
      .join('\n')
    files.push({
      path: `apps/web/src/lib/form-schemas/${kebab}.ts`,
      content: `import { z } from 'zod'\n\nexport const ${pascal}FormSchema = z.object({\n${fieldsForSchema}\n})\n`,
    })
  }

  const combined = files.map((f) => `// === ${f.path} ===\n${f.content}`).join('\n\n')
  return {
    type: input.type,
    moduleName: input.name,
    files,
    combined,
  }
}

/** GET 接口的元信息:支持哪些 type + 每个 type 的字段类型 */
export function describeTypes(): Array<{
  type: GenType
  label: string
  description: string
  fieldTypes: GenField['type'][]
  defaultFields: GenField[]
}> {
  return [
    {
      type: 'list',
      label: '列表页',
      description: '表格 + 分页 + 搜索',
      fieldTypes: ['string', 'number', 'boolean', 'date'],
      defaultFields: [
        { name: 'id', type: 'string', label: 'ID' },
        { name: 'name', type: 'string', label: '名称', required: true },
        { name: 'createdAt', type: 'date', label: '创建时间' },
      ],
    },
    {
      type: 'page',
      label: 'CRUD 页面',
      description: '列表 + 新建/编辑对话框',
      fieldTypes: ['string', 'number', 'boolean', 'date'],
      defaultFields: [
        { name: 'name', type: 'string', label: '名称', required: true },
        { name: 'description', type: 'string', label: '描述' },
        { name: 'enabled', type: 'boolean', label: '启用' },
      ],
    },
    {
      type: 'detail',
      label: '详情页',
      description: '只读字段展示',
      fieldTypes: ['string', 'number', 'boolean', 'date'],
      defaultFields: [
        { name: 'id', type: 'string', label: 'ID' },
        { name: 'name', type: 'string', label: '名称' },
        { name: 'description', type: 'string', label: '描述' },
      ],
    },
    {
      type: 'dialog',
      label: '表单对话框',
      description: '独立弹窗 + Zod schema',
      fieldTypes: ['string', 'number', 'boolean', 'date'],
      defaultFields: [
        { name: 'name', type: 'string', label: '名称', required: true },
        { name: 'value', type: 'string', label: '值' },
      ],
    },
  ]
}
