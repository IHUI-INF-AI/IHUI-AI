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
