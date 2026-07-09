import { eq, and, desc, asc, ilike, sql, inArray } from 'drizzle-orm';
import { db } from './index.js';
import {
  eduLessonTopics,
  lessons,
  type EduLessonTopic,
  type Lesson,
} from '@ihui/database';

// =============================================================================
// Topics（课程专题）
// =============================================================================

export interface FindTopicsOpts {
  page: number;
  pageSize: number;
  title?: string;
  isPublished?: boolean;
  status?: number;
  publishedOnly?: boolean;
}

export async function findTopics(
  opts: FindTopicsOpts,
): Promise<{ list: EduLessonTopic[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, title, isPublished, status, publishedOnly } = opts;
  const conds = [];
  if (publishedOnly) {
    conds.push(eq(eduLessonTopics.isPublished, true), eq(eduLessonTopics.status, 1));
  } else {
    // 与旧 Python 行为一致：未传 status 时默认筛选 status=1
    if (isPublished !== undefined) conds.push(eq(eduLessonTopics.isPublished, isPublished));
    conds.push(eq(eduLessonTopics.status, status ?? 1));
  }
  if (title) conds.push(ilike(eduLessonTopics.title, `%${title}%`));

  const rows = await db
    .select()
    .from(eduLessonTopics)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(eduLessonTopics.sort), desc(eduLessonTopics.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eduLessonTopics)
    .where(conds.length ? and(...conds) : undefined);
  const total = countRows[0]?.count ?? 0;

  return { list: rows, total, page, pageSize };
}

export async function findTopicById(id: string): Promise<EduLessonTopic | undefined> {
  const rows = await db.select().from(eduLessonTopics).where(eq(eduLessonTopics.id, id)).limit(1);
  return rows[0];
}

/** 专题详情需返回的关联课程简要信息。 */
export interface TopicLessonBrief {
  id: string;
  title: string;
  coverImage: string | null;
  intro: string | null;
  price: string;
  originalPrice: string | null;
  isFree: boolean;
  lessonCount: number;
  viewCount: number;
  signupCount: number;
}

export interface TopicDetail extends EduLessonTopic {
  lessons: TopicLessonBrief[];
}

/**
 * 查询专题详情，并按 lessonIds 顺序返回关联课程（仅 status=1 的课程）。
 */
export async function findTopicDetail(id: string): Promise<TopicDetail | undefined> {
  const topic = await findTopicById(id);
  if (!topic) return undefined;

  const ids = ((topic.lessonIds ?? []) as unknown[]).filter(
    (x): x is string => typeof x === 'string',
  );
  let topicLessons: TopicLessonBrief[] = [];
  if (ids.length > 0) {
    const rows: Lesson[] = await db
      .select()
      .from(lessons)
      .where(and(inArray(lessons.id, ids), eq(lessons.status, 1)));
    const map = new Map<string, Lesson>(rows.map((l) => [l.id, l]));
    topicLessons = ids
      .map((lid) => map.get(lid))
      .filter((l): l is Lesson => !!l)
      .map((l) => ({
        id: l.id,
        title: l.title,
        coverImage: l.coverImage,
        intro: l.intro,
        price: l.price,
        originalPrice: l.originalPrice,
        isFree: l.isFree,
        lessonCount: l.lessonCount,
        viewCount: l.viewCount,
        signupCount: l.signupCount,
      }));
  }

  return { ...topic, lessons: topicLessons };
}

export interface CreateTopicInput {
  title: string;
  coverImage?: string | null;
  description?: string | null;
  lessonIds?: string[] | null;
  isPublished?: boolean;
  sort?: number;
  status?: number;
}

export async function createTopic(data: CreateTopicInput): Promise<EduLessonTopic> {
  const rows = await db
    .insert(eduLessonTopics)
    .values({
      title: data.title,
      coverImage: data.coverImage,
      description: data.description,
      lessonIds: data.lessonIds,
      isPublished: data.isPublished,
      sort: data.sort,
      status: data.status,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建专题失败');
  return row;
}

export interface UpdateTopicInput {
  title?: string;
  coverImage?: string | null;
  description?: string | null;
  lessonIds?: string[] | null;
  isPublished?: boolean;
  sort?: number;
  status?: number;
}

export async function updateTopic(
  id: string,
  data: UpdateTopicInput,
): Promise<EduLessonTopic | undefined> {
  const rows = await db
    .update(eduLessonTopics)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.coverImage !== undefined ? { coverImage: data.coverImage } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.lessonIds !== undefined ? { lessonIds: data.lessonIds } : {}),
      ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
      ...(data.sort !== undefined ? { sort: data.sort } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(eduLessonTopics.id, id))
    .returning();
  return rows[0];
}

export async function deleteTopic(id: string): Promise<void> {
  await db.delete(eduLessonTopics).where(eq(eduLessonTopics.id, id));
}
