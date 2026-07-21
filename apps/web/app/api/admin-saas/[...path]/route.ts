/**
 * P1-2.2: SaaS Admin API 代理 Route Handler
 * 透传 5 个 HTTP 方法到 admin-api
 */
import { type NextRequest, NextResponse } from 'next/server'

import { forwardToAdminApi, type HttpMethod } from '@/lib/saas-admin-proxy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function handle(request: NextRequest, method: HttpMethod): Promise<NextResponse> {
  return forwardToAdminApi(request, method)
}

export async function GET(request: NextRequest) {
  return handle(request, 'GET')
}
export async function POST(request: NextRequest) {
  return handle(request, 'POST')
}
export async function PATCH(request: NextRequest) {
  return handle(request, 'PATCH')
}
export async function PUT(request: NextRequest) {
  return handle(request, 'PUT')
}
export async function DELETE(request: NextRequest) {
  return handle(request, 'DELETE')
}
