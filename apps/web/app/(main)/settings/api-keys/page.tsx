'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { KeyRound, Plus } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { Container } from '@/components/layout'
import { ApiKeyListCard } from './ApiKeyListCard'
import { CreateKeyDialog } from './CreateKeyDialog'
import { SecretDisplayDialog } from './SecretDisplayDialog'
import { createApiKey, deleteApiKey, fetchApiKeys, rotateApiKeySecret } from './helpers'
import { EMPTY_FORM, type CreateFormState, type DialogState } from './types'

export default function ApiKeysSettingsPage() {
  const qc = useQueryClient()
  const [dialog, setDialog] = React.useState<DialogState>('idle')
  const [form, setForm] = React.useState<CreateFormState>(EMPTY_FORM)
  const [secret, setSecret] = React.useState('')
  const [secretTitle, setSecretTitle] = React.useState('密钥已创建')

  const keysQuery = useQuery({ queryKey: ['user-api-keys'], queryFn: fetchApiKeys })
  const list = keysQuery.data ?? []

  const createMut = useMutation({
    mutationFn: (f: CreateFormState) =>
      createApiKey({ name: f.name.trim(), permissions: f.permissions, rateLimit: f.rateLimit }),
    onSuccess: (res) => {
      toast.success('API 密钥创建成功')
      qc.invalidateQueries({ queryKey: ['user-api-keys'] })
      setSecretTitle('密钥已创建')
      setSecret(res.secret)
      setDialog('secret-display')
      setForm(EMPTY_FORM)
    },
    onError: (e: Error) => toast.error('创建失败', { description: e.message }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteApiKey(id),
    onSuccess: () => {
      toast.success('密钥已删除')
      qc.invalidateQueries({ queryKey: ['user-api-keys'] })
    },
    onError: (e: Error) => toast.error('删除失败', { description: e.message }),
  })

  const rotateMut = useMutation({
    mutationFn: (id: string) => rotateApiKeySecret(id),
    onSuccess: (res) => {
      toast.success('密钥已轮换,请保存新 secret')
      qc.invalidateQueries({ queryKey: ['user-api-keys'] })
      setSecretTitle('新 Secret 已生成')
      setSecret(res.secret)
      setDialog('secret-display')
    },
    onError: (e: Error) => toast.error('轮换失败', { description: e.message }),
  })

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setDialog('create')
  }

  return (
    <Container maxWidth="md" padding={false} className="space-y-6 py-6">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <KeyRound className="h-6 w-6 text-primary" />
            API 密钥管理
          </h1>
          <p className="text-sm text-muted-foreground">管理您的开发者 API 密钥,供第三方应用接入</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          <span>创建密钥</span>
        </Button>
      </header>

      <ApiKeyListCard
        list={list}
        isLoading={keysQuery.isLoading}
        error={keysQuery.error as Error | null}
        onRetry={() => keysQuery.refetch()}
        onCreate={openCreate}
        onDelete={async (id) => {
          await deleteMut.mutateAsync(id)
        }}
        onRotate={async (id) => {
          await rotateMut.mutateAsync(id)
        }}
        pendingDelete={deleteMut.isPending}
        pendingRotate={rotateMut.isPending}
      />

      <CreateKeyDialog
        open={dialog === 'create'}
        form={form}
        isPending={createMut.isPending}
        onFormChange={setForm}
        onClose={() => !createMut.isPending && setDialog('idle')}
        onSubmit={() => createMut.mutate(form)}
      />

      <SecretDisplayDialog
        open={dialog === 'secret-display'}
        secret={secret}
        title={secretTitle}
        onClose={() => setDialog('idle')}
      />
    </Container>
  )
}
