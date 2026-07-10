import { eq, and, desc, asc, sql, ilike } from 'drizzle-orm';
import { db } from './index.js';
import {
  memberGroups,
  memberPosts,
  memberTags,
  memberTypes,
  companyTypes,
  type MemberGroup,
  type MemberPost,
  type MemberTag,
  type MemberType,
  type CompanyType,
} from '@ihui/database';

// =============================================================================
// 会员分组 Groups
// =============================================================================

export interface GroupListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  keyword?: string;
}

export async function findGroupList(
  query: GroupListQuery,
): Promise<{ list: MemberGroup[]; total: number; page: number; pageSize: number }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const conds = [];
  if (query.status) conds.push(eq(memberGroups.status, query.status));
  if (query.keyword) conds.push(ilike(memberGroups.name, `%${query.keyword}%`));
  const where = conds.length ? and(...conds) : undefined;
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(memberGroups)
      .where(where)
      .orderBy(asc(memberGroups.sort), desc(memberGroups.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(memberGroups).where(where),
  ]);
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize };
}

export async function findGroupById(id: string): Promise<MemberGroup | undefined> {
  const rows = await db.select().from(memberGroups).where(eq(memberGroups.id, id)).limit(1);
  return rows[0];
}

export interface CreateGroupInput {
  name: string;
  description?: string | null;
  sort?: number;
  status?: string;
}

export async function createGroup(data: CreateGroupInput): Promise<MemberGroup | undefined> {
  const rows = await db
    .insert(memberGroups)
    .values({
      name: data.name,
      description: data.description,
      sort: data.sort,
      status: data.status,
    })
    .returning();
  return rows[0];
}

export interface UpdateGroupInput {
  name?: string;
  description?: string | null;
  sort?: number;
  status?: string;
}

export async function updateGroup(
  id: string,
  patch: UpdateGroupInput,
): Promise<MemberGroup | undefined> {
  const rows = await db
    .update(memberGroups)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(memberGroups.id, id))
    .returning();
  return rows[0];
}

export async function deleteGroup(id: string): Promise<MemberGroup | undefined> {
  const rows = await db.delete(memberGroups).where(eq(memberGroups.id, id)).returning();
  return rows[0];
}

// =============================================================================
// 会员岗位 Posts
// =============================================================================

export interface PostListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  keyword?: string;
}

export async function findPostList(
  query: PostListQuery,
): Promise<{ list: MemberPost[]; total: number; page: number; pageSize: number }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const conds = [];
  if (query.status) conds.push(eq(memberPosts.status, query.status));
  if (query.keyword) conds.push(ilike(memberPosts.name, `%${query.keyword}%`));
  const where = conds.length ? and(...conds) : undefined;
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(memberPosts)
      .where(where)
      .orderBy(asc(memberPosts.sort), desc(memberPosts.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(memberPosts).where(where),
  ]);
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize };
}

export async function findPostById(id: string): Promise<MemberPost | undefined> {
  const rows = await db.select().from(memberPosts).where(eq(memberPosts.id, id)).limit(1);
  return rows[0];
}

export interface CreatePostInput {
  name: string;
  code?: string | null;
  sort?: number;
  status?: string;
}

export async function createPost(data: CreatePostInput): Promise<MemberPost | undefined> {
  const rows = await db
    .insert(memberPosts)
    .values({
      name: data.name,
      code: data.code,
      sort: data.sort,
      status: data.status,
    })
    .returning();
  return rows[0];
}

export interface UpdatePostInput {
  name?: string;
  code?: string | null;
  sort?: number;
  status?: string;
}

export async function updatePost(
  id: string,
  patch: UpdatePostInput,
): Promise<MemberPost | undefined> {
  const rows = await db
    .update(memberPosts)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(memberPosts.id, id))
    .returning();
  return rows[0];
}

export async function deletePost(id: string): Promise<MemberPost | undefined> {
  const rows = await db.delete(memberPosts).where(eq(memberPosts.id, id)).returning();
  return rows[0];
}

// =============================================================================
// 会员标签 Tags
// =============================================================================

export interface TagListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

export async function findTagList(
  query: TagListQuery,
): Promise<{ list: MemberTag[]; total: number; page: number; pageSize: number }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const conds = [];
  if (query.keyword) conds.push(ilike(memberTags.name, `%${query.keyword}%`));
  const where = conds.length ? and(...conds) : undefined;
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(memberTags)
      .where(where)
      .orderBy(asc(memberTags.sort), desc(memberTags.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(memberTags).where(where),
  ]);
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize };
}

export async function findTagById(id: string): Promise<MemberTag | undefined> {
  const rows = await db.select().from(memberTags).where(eq(memberTags.id, id)).limit(1);
  return rows[0];
}

export interface CreateTagInput {
  name: string;
  color?: string | null;
  sort?: number;
}

export async function createTag(data: CreateTagInput): Promise<MemberTag | undefined> {
  const rows = await db
    .insert(memberTags)
    .values({
      name: data.name,
      color: data.color,
      sort: data.sort,
    })
    .returning();
  return rows[0];
}

export interface UpdateTagInput {
  name?: string;
  color?: string | null;
  sort?: number;
}

export async function updateTag(
  id: string,
  patch: UpdateTagInput,
): Promise<MemberTag | undefined> {
  const rows = await db
    .update(memberTags)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(memberTags.id, id))
    .returning();
  return rows[0];
}

export async function deleteTag(id: string): Promise<MemberTag | undefined> {
  const rows = await db.delete(memberTags).where(eq(memberTags.id, id)).returning();
  return rows[0];
}

// =============================================================================
// 会员类型 Types
// =============================================================================

export interface TypeListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  keyword?: string;
}

export async function findTypeList(
  query: TypeListQuery,
): Promise<{ list: MemberType[]; total: number; page: number; pageSize: number }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const conds = [];
  if (query.status) conds.push(eq(memberTypes.status, query.status));
  if (query.keyword) conds.push(ilike(memberTypes.name, `%${query.keyword}%`));
  const where = conds.length ? and(...conds) : undefined;
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(memberTypes)
      .where(where)
      .orderBy(asc(memberTypes.sort), desc(memberTypes.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(memberTypes).where(where),
  ]);
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize };
}

export async function findTypeById(id: string): Promise<MemberType | undefined> {
  const rows = await db.select().from(memberTypes).where(eq(memberTypes.id, id)).limit(1);
  return rows[0];
}

export interface CreateTypeInput {
  name: string;
  code?: string | null;
  sort?: number;
  status?: string;
}

export async function createType(data: CreateTypeInput): Promise<MemberType | undefined> {
  const rows = await db
    .insert(memberTypes)
    .values({
      name: data.name,
      code: data.code,
      sort: data.sort,
      status: data.status,
    })
    .returning();
  return rows[0];
}

export interface UpdateTypeInput {
  name?: string;
  code?: string | null;
  sort?: number;
  status?: string;
}

export async function updateType(
  id: string,
  patch: UpdateTypeInput,
): Promise<MemberType | undefined> {
  const rows = await db
    .update(memberTypes)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(memberTypes.id, id))
    .returning();
  return rows[0];
}

export async function deleteType(id: string): Promise<MemberType | undefined> {
  const rows = await db.delete(memberTypes).where(eq(memberTypes.id, id)).returning();
  return rows[0];
}

// =============================================================================
// 企业类型 CompanyTypes
// =============================================================================

export interface CompanyTypeListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  keyword?: string;
}

export async function findCompanyTypeList(
  query: CompanyTypeListQuery,
): Promise<{ list: CompanyType[]; total: number; page: number; pageSize: number }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const conds = [];
  if (query.status) conds.push(eq(companyTypes.status, query.status));
  if (query.keyword) conds.push(ilike(companyTypes.name, `%${query.keyword}%`));
  const where = conds.length ? and(...conds) : undefined;
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(companyTypes)
      .where(where)
      .orderBy(asc(companyTypes.sort), desc(companyTypes.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(companyTypes).where(where),
  ]);
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize };
}

export async function findCompanyTypeById(id: string): Promise<CompanyType | undefined> {
  const rows = await db.select().from(companyTypes).where(eq(companyTypes.id, id)).limit(1);
  return rows[0];
}

export interface CreateCompanyTypeInput {
  name: string;
  code?: string | null;
  sort?: number;
  status?: string;
}

export async function createCompanyType(
  data: CreateCompanyTypeInput,
): Promise<CompanyType | undefined> {
  const rows = await db
    .insert(companyTypes)
    .values({
      name: data.name,
      code: data.code,
      sort: data.sort,
      status: data.status,
    })
    .returning();
  return rows[0];
}

export interface UpdateCompanyTypeInput {
  name?: string;
  code?: string | null;
  sort?: number;
  status?: string;
}

export async function updateCompanyType(
  id: string,
  patch: UpdateCompanyTypeInput,
): Promise<CompanyType | undefined> {
  const rows = await db
    .update(companyTypes)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(companyTypes.id, id))
    .returning();
  return rows[0];
}

export async function deleteCompanyType(id: string): Promise<CompanyType | undefined> {
  const rows = await db.delete(companyTypes).where(eq(companyTypes.id, id)).returning();
  return rows[0];
}

/** 启用企业类型。 */
export async function enableCompanyType(id: string): Promise<CompanyType | undefined> {
  const rows = await db
    .update(companyTypes)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(companyTypes.id, id))
    .returning();
  return rows[0];
}

/** 禁用企业类型。 */
export async function disableCompanyType(id: string): Promise<CompanyType | undefined> {
  const rows = await db
    .update(companyTypes)
    .set({ status: 'inactive', updatedAt: new Date() })
    .where(eq(companyTypes.id, id))
    .returning();
  return rows[0];
}
