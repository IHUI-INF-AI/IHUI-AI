import { eq, and, desc, asc, sql, ilike, inArray, gt } from 'drizzle-orm'
import { db } from './index.js'
import {
  resourceCategories,
  resources,
  resourceProducts,
  resourceTags,
  resourceDownloads,
  orders,
  userVips,
  type ResourceCategory,
  type Resource,
  type ResourceProduct,
  type ResourceTag,
} from '@ihui/database'

// =============================================================================
// Categories 分类
// =============================================================================

/** 按 pid 查询子分类(公开仅启用,admin 可全部)。 */
export async function findCategoriesByPid(
  pid: string | null,
  fetchAll = false,
): Promise<ResourceCategory[]> {
  const conds = []
  if (pid !== null) conds.push(eq(resourceCategories.pid, pid))
  if (!fetchAll) conds.push(eq(resourceCategories.status, 1))
  return db
    .select()
    .from(resourceCategories)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(resourceCategories.sort), asc(resourceCategories.id))
}

export async function findCategoryById(id: string): Promise<ResourceCategory | undefined> {
  const rows = await db
    .select()
    .from(resourceCategories)
    .where(eq(resourceCategories.id, id))
    .limit(1)
  return rows[0]
}

export interface CreateResourceCategoryInput {
  name: string
  pid?: string | null
  sort?: number
  status?: number
}

export async function createResourceCategory(
  data: CreateResourceCategoryInput,
): Promise<ResourceCategory> {
  const rows = await db
    .insert(resourceCategories)
    .values({
      name: data.name,
      pid: data.pid,
      sort: data.sort,
      status: data.status,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建资源分类失败')
  return row
}

export interface UpdateResourceCategoryInput {
  name?: string
  pid?: string | null
  sort?: number
  status?: number
}

export async function updateResourceCategory(
  id: string,
  data: UpdateResourceCategoryInput,
): Promise<ResourceCategory | undefined> {
  const rows = await db
    .update(resourceCategories)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.pid !== undefined ? { pid: data.pid } : {}),
      ...(data.sort !== undefined ? { sort: data.sort } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(resourceCategories.id, id))
    .returning()
  return rows[0]
}

export async function deleteResourceCategory(id: string): Promise<void> {
  await db.delete(resourceCategories).where(eq(resourceCategories.id, id))
}

// =============================================================================
// Resources 资源
// =============================================================================

export interface FindResourcesOpts {
  page: number
  pageSize: number
  title?: string
  categoryId?: string
  isPublished?: boolean
  status?: number
}

/** 分页查询资源列表(列表不返回 intro)。 */
export async function findResources(
  opts: FindResourcesOpts,
): Promise<{ list: Resource[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, title, categoryId, isPublished, status } = opts
  const conds = []
  if (title) conds.push(ilike(resources.title, `%${title}%`))
  if (categoryId) conds.push(eq(resources.categoryId, categoryId))
  if (isPublished !== undefined) conds.push(eq(resources.isPublished, isPublished))
  if (status !== undefined) conds.push(eq(resources.status, status))
  const where = conds.length ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(resources)
      .where(where)
      .orderBy(desc(resources.sort), desc(resources.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(resources)
      .where(where),
  ])

  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}

/** 资源详情(含 intro),并自增浏览量。 */
export async function findResourceByIdAndIncrementView(id: string): Promise<Resource | undefined> {
  await db
    .update(resources)
    .set({ viewCount: sql<number>`${resources.viewCount} + 1` })
    .where(eq(resources.id, id))
  const rows = await db.select().from(resources).where(eq(resources.id, id)).limit(1)
  return rows[0]
}

/** Admin 用：按 ID 查询资源(不限状态,不自增浏览量)。 */
export async function findResourceById(id: string): Promise<Resource | undefined> {
  const rows = await db.select().from(resources).where(eq(resources.id, id)).limit(1)
  return rows[0]
}

/** 按 ID 列表批量查询资源(列表不返回 intro)。 */
export async function findResourcesByIds(ids: string[]): Promise<Resource[]> {
  if (ids.length === 0) return []
  return db.select().from(resources).where(inArray(resources.id, ids)).orderBy(desc(resources.id))
}

export interface CreateResourceInput {
  title: string
  coverImage?: string | null
  intro?: string | null
  categoryId?: string | null
  fileUrl?: string | null
  fileType?: string | null
  fileSize?: number
  isPublished?: boolean
  sort?: number
  status?: number
  type?: string | null
  productId?: string | null
  tagIdList?: string[] | null
  image?: string | null
  introduction?: string | null
  cidList?: string[] | null
}

export async function createResource(data: CreateResourceInput): Promise<Resource> {
  const rows = await db
    .insert(resources)
    .values({
      title: data.title,
      coverImage: data.coverImage,
      intro: data.intro,
      categoryId: data.categoryId,
      fileUrl: data.fileUrl,
      fileType: data.fileType,
      fileSize: data.fileSize,
      isPublished: data.isPublished,
      sort: data.sort,
      status: data.status,
      type: data.type,
      productId: data.productId,
      tagIdList: data.tagIdList,
      image: data.image,
      introduction: data.introduction,
      cidList: data.cidList,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建资源失败')
  return row
}

export interface UpdateResourceInput {
  title?: string
  coverImage?: string | null
  intro?: string | null
  categoryId?: string | null
  fileUrl?: string | null
  fileType?: string | null
  fileSize?: number
  sort?: number
  status?: number
  type?: string | null
  productId?: string | null
  tagIdList?: string[] | null
  image?: string | null
  introduction?: string | null
  cidList?: string[] | null
}

export async function updateResource(
  id: string,
  data: UpdateResourceInput,
): Promise<Resource | undefined> {
  const rows = await db
    .update(resources)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.coverImage !== undefined ? { coverImage: data.coverImage } : {}),
      ...(data.intro !== undefined ? { intro: data.intro } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.fileUrl !== undefined ? { fileUrl: data.fileUrl } : {}),
      ...(data.fileType !== undefined ? { fileType: data.fileType } : {}),
      ...(data.fileSize !== undefined ? { fileSize: data.fileSize } : {}),
      ...(data.sort !== undefined ? { sort: data.sort } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.productId !== undefined ? { productId: data.productId } : {}),
      ...(data.tagIdList !== undefined ? { tagIdList: data.tagIdList } : {}),
      ...(data.image !== undefined ? { image: data.image } : {}),
      ...(data.introduction !== undefined ? { introduction: data.introduction } : {}),
      ...(data.cidList !== undefined ? { cidList: data.cidList } : {}),
      updatedAt: new Date(),
    })
    .where(eq(resources.id, id))
    .returning()
  return rows[0]
}

export async function deleteResource(id: string): Promise<void> {
  await db.delete(resources).where(eq(resources.id, id))
}

/** 发布/取消发布资源。 */
export async function publishResource(
  id: string,
  isPublished: boolean,
): Promise<Resource | undefined> {
  const rows = await db
    .update(resources)
    .set({ isPublished, updatedAt: new Date() })
    .where(eq(resources.id, id))
    .returning()
  return rows[0]
}

// =============================================================================
// Products 资源产品
// =============================================================================

export interface FindProductsOpts {
  page: number
  pageSize: number
  resourceId?: string
  name?: string
  isPublished?: boolean
  status?: number
}

export async function findProducts(
  opts: FindProductsOpts,
): Promise<{ list: ResourceProduct[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, resourceId, name, isPublished, status } = opts
  const conds = []
  if (resourceId) conds.push(eq(resourceProducts.resourceId, resourceId))
  if (name) conds.push(ilike(resourceProducts.name, `%${name}%`))
  if (isPublished !== undefined) conds.push(eq(resourceProducts.isPublished, isPublished))
  if (status !== undefined) conds.push(eq(resourceProducts.status, status))
  const where = conds.length ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(resourceProducts)
      .where(where)
      .orderBy(desc(resourceProducts.sort), desc(resourceProducts.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(resourceProducts)
      .where(where),
  ])

  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}

export async function findProductById(id: string): Promise<ResourceProduct | undefined> {
  const rows = await db.select().from(resourceProducts).where(eq(resourceProducts.id, id)).limit(1)
  return rows[0]
}

export interface CreateProductInput {
  resourceId: string
  name: string
  price?: string
  originalPrice?: string | null
  description?: string | null
  isPublished?: boolean
  sort?: number
  status?: number
}

export async function createProduct(data: CreateProductInput): Promise<ResourceProduct> {
  const rows = await db
    .insert(resourceProducts)
    .values({
      resourceId: data.resourceId,
      name: data.name,
      price: data.price,
      originalPrice: data.originalPrice,
      description: data.description,
      isPublished: data.isPublished,
      sort: data.sort,
      status: data.status,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建资源产品失败')
  return row
}

export interface UpdateProductInput {
  resourceId?: string
  name?: string
  price?: string
  originalPrice?: string | null
  description?: string | null
  isPublished?: boolean
  sort?: number
  status?: number
}

export async function updateProduct(
  id: string,
  data: UpdateProductInput,
): Promise<ResourceProduct | undefined> {
  const rows = await db
    .update(resourceProducts)
    .set({
      ...(data.resourceId !== undefined ? { resourceId: data.resourceId } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.price !== undefined ? { price: data.price } : {}),
      ...(data.originalPrice !== undefined ? { originalPrice: data.originalPrice } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
      ...(data.sort !== undefined ? { sort: data.sort } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(resourceProducts.id, id))
    .returning()
  return rows[0]
}

export async function deleteProduct(id: string): Promise<void> {
  await db.delete(resourceProducts).where(eq(resourceProducts.id, id))
}

// =============================================================================
// Tags 资源标签
// =============================================================================

export interface FindTagsOpts {
  page: number
  pageSize: number
  name?: string
  pid?: string | null
  status?: number
}

export async function findTags(
  opts: FindTagsOpts,
): Promise<{ list: ResourceTag[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, name, pid, status } = opts
  const conds = []
  if (name) conds.push(ilike(resourceTags.name, `%${name}%`))
  if (pid !== undefined && pid !== null) conds.push(eq(resourceTags.pid, pid))
  if (status !== undefined) conds.push(eq(resourceTags.status, status))
  const where = conds.length ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(resourceTags)
      .where(where)
      .orderBy(asc(resourceTags.sort), desc(resourceTags.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(resourceTags)
      .where(where),
  ])

  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}

export async function findTagById(id: string): Promise<ResourceTag | undefined> {
  const rows = await db.select().from(resourceTags).where(eq(resourceTags.id, id)).limit(1)
  return rows[0]
}

export interface CreateTagInput {
  name: string
  pid?: string | null
  sort?: number
  status?: number
}

export async function createTag(data: CreateTagInput): Promise<ResourceTag> {
  const rows = await db
    .insert(resourceTags)
    .values({ name: data.name, pid: data.pid, sort: data.sort, status: data.status })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建资源标签失败')
  return row
}

export interface UpdateTagInput {
  name?: string
  pid?: string | null
  sort?: number
  status?: number
}

export async function updateTag(
  id: string,
  data: UpdateTagInput,
): Promise<ResourceTag | undefined> {
  const rows = await db
    .update(resourceTags)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.pid !== undefined ? { pid: data.pid } : {}),
      ...(data.sort !== undefined ? { sort: data.sort } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(resourceTags.id, id))
    .returning()
  return rows[0]
}

export async function deleteTag(id: string): Promise<void> {
  await db.delete(resourceTags).where(eq(resourceTags.id, id))
}

// =============================================================================
// Download 下载（权限校验 + 记录写入）
// =============================================================================

/** 查询已发布资源（isPublished=true 且 status=1），不存在返回 undefined。 */
export async function findPublishedResourceById(id: string): Promise<Resource | undefined> {
  const rows = await db
    .select()
    .from(resources)
    .where(and(eq(resources.id, id), eq(resources.isPublished, true), eq(resources.status, 1)))
    .limit(1)
  return rows[0]
}

/** 判断资源是否付费：存在已发布且 price > 0 的关联产品即为付费资源。 */
export async function isResourcePaid(resourceId: string): Promise<boolean> {
  const rows = await db
    .select({ id: resourceProducts.id })
    .from(resourceProducts)
    .where(
      and(
        eq(resourceProducts.resourceId, resourceId),
        eq(resourceProducts.isPublished, true),
        eq(resourceProducts.status, 1),
        gt(resourceProducts.price, '0'),
      ),
    )
    .limit(1)
  return rows.length > 0
}

/** 检查用户是否已购买该资源（orders 表中存在 status=paid 且 productId 指向 resourceId 的订单）。 */
export async function hasUserPurchasedResource(
  userId: string,
  resourceId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(eq(orders.userId, userId), eq(orders.productId, resourceId), eq(orders.status, 'paid')),
    )
    .limit(1)
  return rows.length > 0
}

/** 检查用户是否为有效 VIP（status=1 且 endTime > 当前时间）。 */
export async function isUserActiveVip(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: userVips.id })
    .from(userVips)
    .where(
      and(eq(userVips.userId, userId), eq(userVips.status, 1), gt(userVips.endTime, new Date())),
    )
    .limit(1)
  return rows.length > 0
}

export interface DownloadPermissionResult {
  allowed: boolean
  reason: string
}

/** 下载权限校验：免费资源直接放行；付费资源需购买记录或有效 VIP。 */
export async function checkDownloadPermission(
  userId: string,
  resourceId: string,
): Promise<DownloadPermissionResult> {
  const paid = await isResourcePaid(resourceId)
  if (!paid) return { allowed: true, reason: 'free' }
  const purchased = await hasUserPurchasedResource(userId, resourceId)
  if (purchased) return { allowed: true, reason: 'purchased' }
  const vip = await isUserActiveVip(userId)
  if (vip) return { allowed: true, reason: 'vip' }
  return { allowed: false, reason: '未购买且非 VIP' }
}

export interface CreateDownloadRecordInput {
  resourceId: string
  userId: string
  ip?: string | null
  userAgent?: string | null
}

/** 写入下载记录。 */
export async function createDownloadRecord(data: CreateDownloadRecordInput): Promise<void> {
  await db.insert(resourceDownloads).values({
    resourceId: data.resourceId,
    userId: data.userId,
    ip: data.ip ?? null,
    userAgent: data.userAgent ?? null,
  })
}

/** 自增资源下载量。 */
export async function incrementResourceDownloadCount(resourceId: string): Promise<void> {
  await db
    .update(resources)
    .set({ downloadCount: sql<number>`${resources.downloadCount} + 1` })
    .where(eq(resources.id, resourceId))
}
