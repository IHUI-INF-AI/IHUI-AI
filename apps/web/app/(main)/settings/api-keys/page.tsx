// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { API_KEY_PERMISSIONS, type CreateApiKeyInput, type TFunction } from '@ihui/types'
import { ApiKeysScreen as SharedApiKeysScreen } from '@ihui/rn-app/features/api-keys/ApiKeysScreen'
import { BackButton, AuthGatePrompt } from '@/components/common'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { useConfirm } from '@/hooks/use-confirm'
import { Container } from '@/components/layout'
import {
  createApiKey,
  deleteApiKey,
  fetchApiKeys,
  fetchApiKeyUsage,
  rotateApiKeySecret,
} from './helpers'
import { PERM_LABELS } from './PermissionSelector'

/**
 * 与 RN `apps/mobile-rn/src/screens/ApiKeysScreen.tsx` 共用同一份渲染
 * (`@ihui/rn-app/features/api-keys/ApiKeysScreen`,react-native-web 承载)。
 * 本页只保留 web 侧数据编排与平台件:react-query、toast、useConfirm、clipboard。
 */
export default function ApiKeysSettingsPage() {
  const qc = useQueryClient()
  const t = useTranslations()
  const tp = useTranslations('apiKeyPerms')
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  // 2026-09-30 登录态门:未登录不发注定 401 的请求
  const { allow } = useAuthGate()
  const [secret, setSecret] = React.useState<{
    value: string
    source: 'create' | 'rotate'
  } | null>(null)

  const keysQuery = useQuery({ queryKey: ['user-api-keys'], queryFn: fetchApiKeys, enabled: allow })
  const list = React.useMemo(() => keysQuery.data ?? [], [keysQuery.data])

  const createMut = useMutation({
    mutationFn: (input: CreateApiKeyInput) =>
      createApiKey({
        name: input.name.trim(),
        permissions: input.permissions,
        rateLimit: input.rateLimit,
      }),
    onSuccess: (res) => {
      toast.success('API 密钥创建成功')
      qc.invalidateQueries({ queryKey: ['user-api-keys'] })
      setSecret({ value: res.secret, source: 'create' })
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
      setSecret({ value: res.secret, source: 'rotate' })
    },
    onError: (e: Error) => toast.error('轮换失败', { description: e.message }),
  })

  const permissionOptions = React.useMemo(
    () =>
      API_KEY_PERMISSIONS.map((perm) => ({
        value: perm,
        label: tp(PERM_LABELS[perm] ?? perm),
      })),
    [tp],
  )

  return (
    <Container maxWidth="full" padding={false} className="px-4 flex h-full flex-col py-4">
      <BackButton />
      {allow ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SharedApiKeysScreen
            t={t as unknown as TFunction}
            colorScheme="light"
            list={list}
            loading={keysQuery.isLoading}
            error={(keysQuery.error as Error | null)?.message ?? null}
            onReload={() => {
              void keysQuery.refetch()
            }}
            permissionOptions={permissionOptions}
            defaultPermissions={[]}
            onCreate={async (input) => {
              await createMut.mutateAsync(input)
            }}
            creating={createMut.isPending}
            createError={null}
            secret={secret}
            onCloseSecret={() => setSecret(null)}
            onRotate={async (id) => {
              await rotateMut.mutateAsync(id)
            }}
            onDelete={async (id) => {
              await deleteMut.mutateAsync(id)
            }}
            rotatingId={rotateMut.isPending ? (rotateMut.variables ?? null) : null}
            deletingId={deleteMut.isPending ? (deleteMut.variables ?? null) : null}
            onLoadUsage={(id) => fetchApiKeyUsage(id)}
            onCopy={async (text) => {
              try {
                await navigator.clipboard.writeText(text)
                toast.success('已复制')
              } catch {
                toast.error('复制失败,请手动选择文本复制')
              }
            }}
            onConfirm={(options) =>
              confirm({
                title: options.title,
                description: options.message,
                variant: options.destructive ? 'destructive' : 'default',
              })
            }
          />
        </div>
      ) : (
        <AuthGatePrompt message="请先登录后查看 API 密钥" />
      )}
      <ConfirmDialogRenderer />
    </Container>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
