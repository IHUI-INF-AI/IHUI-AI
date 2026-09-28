// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { eq, and, asc } from 'drizzle-orm'
import { db } from './index.js'
import { siteCategories, type SiteCategory } from '@ihui/database'

export async function findSiteCategories(opts: { type?: string }): Promise<SiteCategory[]> {
  const conds = [eq(siteCategories.status, 1)]
  if (opts.type) conds.push(eq(siteCategories.type, opts.type))
  return db
    .select()
    .from(siteCategories)
    .where(and(...conds))
    .orderBy(asc(siteCategories.sort), asc(siteCategories.createdAt))
}
