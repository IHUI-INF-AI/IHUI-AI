// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { FileJson, Loader2, Plus, Settings2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import {
  previewOpenApi,
  type ConnectorAuthKind,
  type ConnectorCatalogResponse,
  type ConnectorEntry,
  type ConnectorOperation,
  type SaveConnectorConfigInput,
} from '@ihui/api-client/endpoints/connectors'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@ihui/ui-react'

import { CAPABILITY_LABEL_KEY, countCapabilities, toSlug } from './connector-utils'

const AUTH_OPTIONS: { value: ConnectorAuthKind; key: string }[] = [
  { value: 'none', key: 'authNone' },
  { value: 'bearer', key: 'authBearer' },
  { value: 'header', key: 'authHeader' },
  { value: 'basic', key: 'authBasic' },
  { value: 'query', key: 'authQuery' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: ConnectorEntry | null
  catalog: ConnectorCatalogResponse | undefined
  saving: boolean
  onSubmit: (input: SaveConnectorConfigInput) => void
}

/**
 * 连接器配置对话框(2026-11-23 重写)。
 *
 * preset 模式:选平台 → 填凭据 → 模板操作自动就位(写操作默认关闭)。
 * custom 模式:填 Base URL + 鉴权 + 操作清单(可导入 OpenAPI)。
 */
export function ConnectorConfigDialog({
  open,
  onOpenChange,
  editing,
  catalog,
  saving,
  onSubmit,
}: Props) {
  const t = useTranslations('connectors')
  const [type, setType] = React.useState('feishu')
  const [mode, setMode] = React.useState<'preset' | 'custom'>('preset')
  const [managed, setManaged] = React.useState(false)
  const [name, setName] = React.useState('')
  const [appId, setAppId] = React.useState('')
  const [appSecret, setAppSecret] = React.useState('')
  const [yuqueUser, setYuqueUser] = React.useState('')
  const [yuqueRepo, setYuqueRepo] = React.useState('')
  const [spaceId, setSpaceId] = React.useState('')
  const [folderToken, setFolderToken] = React.useState('')
  const [baseUrl, setBaseUrl] = React.useState('')
  const [authKind, setAuthKind] = React.useState<ConnectorAuthKind>('none')
  const [authName, setAuthName] = React.useState('Authorization')
  const [allowWrite, setAllowWrite] = React.useState(false)
  const [allowPrivate, setAllowPrivate] = React.useState(false)
  const [operations, setOperations] = React.useState<ConnectorOperation[]>([])

  // OpenAPI 导入
  const [openapiOpen, setOpenapiOpen] = React.useState(false)
  const [openapiRaw, setOpenapiRaw] = React.useState('')
  const [parsing, setParsing] = React.useState(false)

  // 单条操作编辑
  const [opOpen, setOpOpen] = React.useState(false)
  const [opEditingId, setOpEditingId] = React.useState<string | null>(null)
  const [opId, setOpId] = React.useState('')
  const [opName, setOpName] = React.useState('')
  const [opCapability, setOpCapability] = React.useState<ConnectorOperation['capability']>('list')
  const [opMethod, setOpMethod] = React.useState<ConnectorOperation['method']>('GET')
  const [opPath, setOpPath] = React.useState('')
  const [opQuery, setOpQuery] = React.useState('{}')
  const [opBody, setOpBody] = React.useState('{}')
  const [opResponsePath, setOpResponsePath] = React.useState('')
  const [opDescription, setOpDescription] = React.useState('')

  const template = catalog?.templates.find((item) => item.type === type)

  const applyTemplate = React.useCallback(
    (nextType: string) => {
      const tpl = catalog?.templates.find((item) => item.type === nextType)
      if (!tpl) return
      setBaseUrl(tpl.base_url)
      setAuthKind(tpl.auth_kind)
      setAuthName(tpl.auth_name || 'Authorization')
      setOperations(tpl.operations)
    },
    [catalog],
  )

  React.useEffect(() => {
    if (!open) return
    if (editing) {
      const tpl = catalog?.templates.find((item) => item.type === editing.type)
      setType(editing.type)
      setMode(editing.mode)
      setManaged(Boolean(editing.managed))
      setName(editing.name)
      setAppId('')
      setAppSecret('')
      setYuqueUser(editing.extra_fields?.user ?? '')
      setYuqueRepo(editing.extra_fields?.repo ?? '')
      setSpaceId(editing.extra_fields?.space_id ?? '')
      setFolderToken(editing.extra_fields?.folder_token ?? '')
      setBaseUrl(editing.spec?.base_url ?? tpl?.base_url ?? '')
      setAuthKind(editing.spec?.auth_kind ?? tpl?.auth_kind ?? 'none')
      setAuthName(editing.spec?.auth_name ?? tpl?.auth_name ?? 'Authorization')
      setAllowWrite(editing.spec?.allow_write ?? false)
      setAllowPrivate(editing.spec?.allow_private_hosts ?? false)
      setOperations(editing.operations?.length ? editing.operations : (tpl?.operations ?? []))
      return
    }
    setType('feishu')
    setMode('preset')
    setManaged(
      Boolean(catalog?.templates.find((item) => item.type === 'feishu')?.managed?.available),
    )
    setName('')
    setAppId('')
    setAppSecret('')
    setYuqueUser('')
    setYuqueRepo('')
    setSpaceId('')
    setFolderToken('')
    setAuthKind('none')
    setAuthName('Authorization')
    setAllowWrite(false)
    setAllowPrivate(false)
    setOperations([])
    applyTemplate('feishu')
  }, [open, editing, applyTemplate, catalog])

  const handleTypeChange = (next: string) => {
    setType(next)
    const nextMode = next === 'custom' ? 'custom' : 'preset'
    setMode(nextMode)
    if (editing) return
    if (next === 'custom') {
      setManaged(false)
      setBaseUrl('')
      setAuthKind('none')
      setAuthName('Authorization')
      setOperations([])
      return
    }
    const nextTpl = catalog?.templates.find((item) => item.type === next)
    setManaged(Boolean(nextTpl?.managed?.available))
    applyTemplate(next)
  }

  const handleImport = async () => {
    if (parsing) return
    if (!openapiRaw.trim()) {
      toast.error(t('openapiFailed'))
      return
    }
    setParsing(true)
    try {
      const result = await previewOpenApi({ raw: openapiRaw })
      if (result.success && result.data) {
        setBaseUrl(result.data.base_url)
        setOperations(result.data.operations)
        setMode('custom')
        toast.success(t('openapiParsed', { count: result.data.operation_count }))
        setOpenapiOpen(false)
        setOpenapiRaw('')
      } else {
        toast.error(result.error ?? t('openapiFailed'))
      }
    } catch {
      toast.error(t('openapiFailed'))
    } finally {
      setParsing(false)
    }
  }

  const openAddOperation = () => {
    setOpEditingId(null)
    setOpId('')
    setOpName('')
    setOpCapability('list')
    setOpMethod('GET')
    setOpPath('')
    setOpQuery('{}')
    setOpBody('{}')
    setOpResponsePath('')
    setOpDescription('')
    setOpOpen(true)
  }

  const openEditOperation = (op: ConnectorOperation) => {
    setOpEditingId(op.id)
    setOpId(op.id)
    setOpName(op.name)
    setOpCapability(op.capability)
    setOpMethod(op.method)
    setOpPath(op.path)
    setOpQuery(JSON.stringify(op.query ?? {}, null, 2))
    setOpBody(JSON.stringify(op.body ?? {}, null, 2))
    setOpResponsePath(op.response_path)
    setOpDescription(op.description)
    setOpOpen(true)
  }

  const saveOperation = () => {
    const id = opId.trim()
    const path = opPath.trim()
    if (!id || !path || !/^[A-Za-z0-9_.-]+$/.test(id)) {
      toast.error(t('operationRequired'))
      return
    }
    if (!path.startsWith('/')) {
      toast.error(t('operationRequired'))
      return
    }
    let query: Record<string, unknown> = {}
    let body: Record<string, unknown> | null = null
    try {
      query = opQuery.trim() ? (JSON.parse(opQuery) as Record<string, unknown>) : {}
      body =
        opBody.trim() && opBody.trim() !== '{}'
          ? (JSON.parse(opBody) as Record<string, unknown>)
          : null
      if (query === null || Array.isArray(query) || typeof query !== 'object')
        throw new Error('query')
      if (body !== null && (Array.isArray(body) || typeof body !== 'object'))
        throw new Error('body')
    } catch {
      toast.error(t('operationJsonInvalid'))
      return
    }
    const next: ConnectorOperation = {
      id,
      name: opName.trim() || id,
      capability: opCapability,
      method: opMethod,
      path,
      query,
      body,
      response_path: opResponsePath.trim(),
      confirm: false,
      description: opDescription.trim(),
    }
    setOperations((prev) =>
      opEditingId
        ? prev.map((op) => (op.id === opEditingId ? next : op))
        : [...prev.filter((op) => op.id !== id), next],
    )
    setOpOpen(false)
  }

  const removeOperation = (id: string) => {
    setOperations((prev) => prev.filter((op) => op.id !== id))
  }

  const submit = () => {
    const extra: Record<string, string> = {}
    if (type === 'yuque') {
      extra.user = yuqueUser.trim()
      extra.repo = yuqueRepo.trim()
      if (!extra.user || !extra.repo) {
        toast.error(t('actionFailed'))
        return
      }
    }
    if (type === 'feishu' && folderToken.trim()) extra.folder_token = folderToken.trim()
    if ((type === 'wecom' || type === 'dingtalk') && spaceId.trim()) {
      extra.space_id = spaceId.trim()
    }

    if (mode === 'custom') {
      if (!baseUrl.trim() || operations.length === 0) {
        toast.error(t('actionFailed'))
        return
      }
    } else if (type !== 'yuque' && !managed) {
      // preset 平台手动模式必须能从凭据换 token;编辑时密钥可留空保留旧值
      if (!editing && !appId.trim()) {
        toast.error(t('actionFailed'))
        return
      }
      if (!editing && !appSecret.trim()) {
        toast.error(t('actionFailed'))
        return
      }
    }
    if (!name.trim()) {
      toast.error(t('actionFailed'))
      return
    }

    const key = editing ? editing.key : `${type}:${toSlug(name) || toSlug(baseUrl) || 'c'}`
    onSubmit({
      key,
      type,
      name: name.trim(),
      app_id: appId.trim(),
      app_secret: appSecret,
      extra,
      mode,
      managed,
      spec: {
        base_url: baseUrl.trim() || template?.base_url || '',
        auth_kind: authKind,
        auth_name: authName.trim() || 'Authorization',
        allow_write: allowWrite,
        allow_private_hosts: allowPrivate,
      },
      operations,
    })
  }

  const counts = countCapabilities(operations)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('edit') : t('add')}</DialogTitle>
            <DialogDescription>{t('subtitle')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-label text-muted-foreground">{t('typeLabel')}</Label>
              <Select value={type} disabled={Boolean(editing)} onValueChange={handleTypeChange}>
                <SelectTrigger className="h-8 text-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(catalog?.templates ?? []).map((item) => (
                    <SelectItem key={item.type} value={item.type}>
                      {item.label}
                    </SelectItem>
                  ))}
                  {!catalog?.templates.some((item) => item.type === 'custom') && (
                    <SelectItem value="custom">{t('custom')}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {template?.description && (
                <p className="text-[11px] text-muted-foreground">{template.description}</p>
              )}
              {type === 'custom' && (
                <p className="text-[11px] text-muted-foreground">{t('customHint')}</p>
              )}
            </div>

            {mode === 'preset' && template?.managed?.supported ? (
              <div className="flex items-start justify-between gap-3 rounded-md border border-stroke-subtle bg-muted/20 p-3">
                <div className="space-y-0.5">
                  <p className="text-label font-medium">{t('managedToggle')}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {template.managed.available && managed
                      ? t('managedToggleHint')
                      : template.managed.available
                        ? t('managedToggleOffHint')
                        : t('managedMissing', {
                            keys: (template.managed.missing ?? []).join(', '),
                          })}
                  </p>
                </div>
                <Switch
                  checked={managed}
                  disabled={!template.managed.available || Boolean(editing)}
                  onCheckedChange={setManaged}
                  aria-label={t('managedToggle')}
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label className="text-label text-muted-foreground">{t('nameLabel')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                autoComplete="off"
              />
            </div>

            {type === 'yuque' ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-label text-muted-foreground">{t('yuqueUserLabel')}</Label>
                  <Input
                    value={yuqueUser}
                    onChange={(e) => setYuqueUser(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-label text-muted-foreground">{t('yuqueRepoLabel')}</Label>
                  <Input
                    value={yuqueRepo}
                    onChange={(e) => setYuqueRepo(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </>
            ) : (
              <>
                {!managed && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-label text-muted-foreground">{t('appIdLabel')}</Label>
                      <Input
                        value={appId}
                        onChange={(e) => setAppId(e.target.value)}
                        placeholder={t('appIdPlaceholder')}
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-label text-muted-foreground">
                        {mode === 'custom' ? 'Token / Secret' : t('appSecretLabel')}
                      </Label>
                      <Input
                        type="password"
                        value={appSecret}
                        onChange={(e) => setAppSecret(e.target.value)}
                        placeholder={editing ? t('secretKeepHint') : t('appSecretPlaceholder')}
                        autoComplete="new-password"
                      />
                    </div>
                  </>
                )}
                {type === 'feishu' && (
                  <div className="space-y-1.5">
                    <Label className="text-label text-muted-foreground">
                      {t('folderTokenLabel')}
                    </Label>
                    <Input
                      value={folderToken}
                      onChange={(e) => setFolderToken(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                )}
                {(type === 'wecom' || type === 'dingtalk') && (
                  <div className="space-y-1.5">
                    <Label className="text-label text-muted-foreground">{t('spaceIdLabel')}</Label>
                    <Input
                      value={spaceId}
                      onChange={(e) => setSpaceId(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                )}
              </>
            )}

            {(mode === 'custom' || type === 'custom' || editing?.mode === 'custom') && (
              <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                <div className="space-y-1.5">
                  <Label className="text-label text-muted-foreground">{t('baseUrlLabel')}</Label>
                  <Input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-label text-muted-foreground">{t('authKindLabel')}</Label>
                    <Select
                      value={authKind}
                      onValueChange={(v) => setAuthKind(v as ConnectorAuthKind)}
                    >
                      <SelectTrigger className="h-8 text-label">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AUTH_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.key)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-label text-muted-foreground">{t('authNameLabel')}</Label>
                    <Input
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-label">{t('allowWrite')}</Label>
                  <p className="text-[11px] text-muted-foreground">{t('allowWriteHint')}</p>
                </div>
                <Switch checked={allowWrite} onCheckedChange={setAllowWrite} />
              </div>
              {(mode === 'custom' || editing?.mode === 'custom') && (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-label">{t('allowPrivate')}</Label>
                    <p className="text-[11px] text-muted-foreground">{t('allowPrivateHint')}</p>
                  </div>
                  <Switch checked={allowPrivate} onCheckedChange={setAllowPrivate} />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-label font-medium">{t('operationsTitle')}</span>
                  <Badge variant="default">
                    {t('operationCount', { count: operations.length })}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" onClick={openAddOperation}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    {t('addOperation')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setOpenapiOpen(true)}>
                    <FileJson className="mr-1.5 h-3.5 w-3.5" />
                    {t('openapiImport')}
                  </Button>
                </div>
              </div>
              {operations.length === 0 ? (
                <p className="text-label text-muted-foreground">{t('operationsEmpty')}</p>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(counts) as (keyof typeof counts)[])
                      .filter((cap) => counts[cap] > 0)
                      .map((cap) => (
                        <Badge key={cap} variant={cap === 'action' ? 'destructive' : 'secondary'}>
                          {t(CAPABILITY_LABEL_KEY[cap])} {counts[cap]}
                        </Badge>
                      ))}
                  </div>
                  <ul className="max-h-40 space-y-1 overflow-y-auto">
                    {operations.map((op) => (
                      <li
                        key={op.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-1"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left text-label hover:text-primary"
                          onClick={() => openEditOperation(op)}
                        >
                          {op.name || op.id}
                        </button>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {op.method} {op.path}
                        </span>
                        <button
                          type="button"
                          aria-label={t('removeOperation')}
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeOperation(op.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {t('submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={opOpen} onOpenChange={setOpOpen}>
        <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{opEditingId ? t('editOperation') : t('addOperation')}</DialogTitle>
            <DialogDescription>{t('operationDialogHint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-label text-muted-foreground">{t('operationId')}</Label>
                <Input value={opId} onChange={(e) => setOpId(e.target.value)} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-label text-muted-foreground">{t('operationName')}</Label>
                <Input
                  value={opName}
                  onChange={(e) => setOpName(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-label text-muted-foreground">
                  {t('operationCapability')}
                </Label>
                <Select
                  value={opCapability}
                  onValueChange={(v) => setOpCapability(v as ConnectorOperation['capability'])}
                >
                  <SelectTrigger className="h-8 text-label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['list', 'search', 'fetch', 'action'] as const).map((cap) => (
                      <SelectItem key={cap} value={cap}>
                        {t(CAPABILITY_LABEL_KEY[cap])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-label text-muted-foreground">{t('operationMethod')}</Label>
                <Select
                  value={opMethod}
                  onValueChange={(v) => setOpMethod(v as ConnectorOperation['method'])}
                >
                  <SelectTrigger className="h-8 text-label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-label text-muted-foreground">{t('operationPath')}</Label>
              <Input
                value={opPath}
                onChange={(e) => setOpPath(e.target.value)}
                placeholder="/items/{id}"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-label text-muted-foreground">
                {t('operationResponsePath')}
              </Label>
              <Input
                value={opResponsePath}
                onChange={(e) => setOpResponsePath(e.target.value)}
                placeholder="data.items"
                autoComplete="off"
              />
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div className="space-y-1.5">
                <Label className="text-label text-muted-foreground">{t('operationQuery')}</Label>
                <textarea
                  value={opQuery}
                  onChange={(e) => setOpQuery(e.target.value)}
                  spellCheck={false}
                  className="h-20 w-full resize-y rounded-md border bg-background p-2 font-mono text-[11px] leading-relaxed outline-none focus:border-stroke-focus"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-label text-muted-foreground">{t('operationBody')}</Label>
                <textarea
                  value={opBody}
                  onChange={(e) => setOpBody(e.target.value)}
                  spellCheck={false}
                  className="h-24 w-full resize-y rounded-md border bg-background p-2 font-mono text-[11px] leading-relaxed outline-none focus:border-stroke-focus"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-label text-muted-foreground">
                {t('operationDescription')}
              </Label>
              <Input
                value={opDescription}
                onChange={(e) => setOpDescription(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={saveOperation}>{t('operationSave')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openapiOpen} onOpenChange={setOpenapiOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('openapiTitle')}</DialogTitle>
            <DialogDescription>{t('openapiHint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-label">
              <Upload className="h-4 w-4 text-muted-foreground" />
              {t('openapiFile')}
              <input
                type="file"
                accept=".json,.yaml,.yml,application/json,text/yaml"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) setOpenapiRaw(await file.text())
                }}
              />
            </label>
            <textarea
              value={openapiRaw}
              onChange={(e) => setOpenapiRaw(e.target.value)}
              placeholder={t('openapiPaste')}
              spellCheck={false}
              className="h-56 w-full resize-y rounded-md border bg-background p-2 font-mono text-[11px] leading-relaxed outline-none focus:border-stroke-focus"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenapiOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={() => void handleImport()} disabled={parsing}>
              {parsing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {t('openapiPreview')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
