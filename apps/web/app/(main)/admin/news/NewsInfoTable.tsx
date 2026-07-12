'use client'

import {
  Download,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Info,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Input,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

import { inputSm } from './types'
import type { useNewsInformation } from './useNewsInformation'

type Props = ReturnType<typeof useNewsInformation>

export function NewsInfoTable(props: Props) {
  const {
    infoSearch,
    setInfoSearch,
    infoPage,
    setInfoPage,
    infoTotal,
    infoTotalPages,
    infoList,
    infoLoading,
    infoError,
    hasInfoSearch,
    openCreateInfo,
    openEditInfo,
    handleDeleteInfo,
    deleteInfoMut,
  } = props

  function handleExport() {
    const list = infoList as unknown as Record<string, unknown>[]
    exportToExcel(
      'AI信息库',
      [
        { key: 'id', title: 'ID' },
        { key: 'title', title: '标题' },
        { key: 'type', title: '类型' },
        { key: 'url', title: 'URL' },
        { key: 'sourceName', title: '来源名称' },
        { key: 'sourceUrl', title: '来源URL' },
        { key: 'sourceCreator', title: '来源作者' },
        { key: 'sourceTime', title: '来源时间' },
        { key: 'insertTime', title: '录入时间' },
        { key: 'browse', title: '浏览量' },
        { key: 'creator', title: '创建人' },
        { key: 'crearedTime', title: '创建时间' },
      ],
      list,
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <HasPermi code="ai:information:export">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
        </HasPermi>
        <HasPermi code="ai:information:add">
          <Button size="sm" onClick={openCreateInfo} className="ml-auto">
            <Plus className="h-4 w-4" />
            新增信息
          </Button>
        </HasPermi>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={infoSearch.title}
          onChange={(e) => setInfoSearch({ ...infoSearch, title: e.target.value })}
          placeholder="标题"
          className={cn('w-32', inputSm)}
        />
        <Input
          value={infoSearch.url}
          onChange={(e) => setInfoSearch({ ...infoSearch, url: e.target.value })}
          placeholder="URL"
          className={cn('w-32', inputSm)}
        />
        <Input
          value={infoSearch.sourceName}
          onChange={(e) => setInfoSearch({ ...infoSearch, sourceName: e.target.value })}
          placeholder="来源名称"
          className={cn('w-32', inputSm)}
        />
        <Input
          value={infoSearch.sourceUrl}
          onChange={(e) => setInfoSearch({ ...infoSearch, sourceUrl: e.target.value })}
          placeholder="来源URL"
          className={cn('w-32', inputSm)}
        />
        <Input
          value={infoSearch.sourceCreator}
          onChange={(e) => setInfoSearch({ ...infoSearch, sourceCreator: e.target.value })}
          placeholder="来源作者"
          className={cn('w-28', inputSm)}
        />
        <Input
          value={infoSearch.browse}
          onChange={(e) => setInfoSearch({ ...infoSearch, browse: e.target.value })}
          placeholder="浏览量"
          className={cn('w-24', inputSm)}
        />
        <Input
          type="date"
          value={infoSearch.sourceTime}
          onChange={(e) => setInfoSearch({ ...infoSearch, sourceTime: e.target.value })}
          className={cn('w-36', inputSm)}
          aria-label="来源时间"
        />
        <Input
          type="date"
          value={infoSearch.insertTime}
          onChange={(e) => setInfoSearch({ ...infoSearch, insertTime: e.target.value })}
          className={cn('w-36', inputSm)}
          aria-label="录入时间"
        />
        {hasInfoSearch && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setInfoSearch({
                title: '',
                url: '',
                sourceName: '',
                sourceUrl: '',
                sourceCreator: '',
                sourceTime: '',
                insertTime: '',
                browse: '',
              })
            }
            className="h-8 text-xs"
          >
            重置
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-3 py-2 text-xs">ID</TableHead>
              <TableHead className="px-3 py-2 text-xs">标题</TableHead>
              <TableHead className="px-3 py-2 text-xs">类型</TableHead>
              <TableHead className="px-3 py-2 text-xs">URL</TableHead>
              <TableHead className="px-3 py-2 text-xs">来源名称</TableHead>
              <TableHead className="px-3 py-2 text-xs">来源作者</TableHead>
              <TableHead className="px-3 py-2 text-xs">来源时间</TableHead>
              <TableHead className="px-3 py-2 text-xs">浏览量</TableHead>
              <TableHead className="px-3 py-2 text-xs text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {infoLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : infoError ? (
              <TableRow>
                <TableCell colSpan={9} className="px-3 py-10 text-center text-destructive">
                  {(infoError as Error).message}
                </TableCell>
              </TableRow>
            ) : infoList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  <Info className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无信息
                </TableCell>
              </TableRow>
            ) : (
              infoList.map((info) => (
                <TableRow key={info.id} className="hover:bg-muted/30">
                  <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                    {info.id}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <div className="max-w-[200px] truncate font-medium" title={info.title}>
                      {info.title}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    {info.type ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    {info.url ? (
                      <a
                        href={info.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {info.url}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    {info.sourceName ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    {info.sourceCreator ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                    {info.sourceTime ?? '—'}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">{info.browse ?? 0}</TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <HasPermi code="ai:information:edit">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditInfo(info)}
                          title="编辑"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                      <HasPermi code="ai:information:remove">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteInfo(info)}
                          title="删除"
                          className="text-destructive hover:text-destructive"
                          disabled={deleteInfoMut.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {infoTotal} 条</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={infoPage <= 1}
            onClick={() => setInfoPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {infoPage} / {infoTotalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={infoPage >= infoTotalPages}
            onClick={() => setInfoPage((p) => p + 1)}
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  )
}
