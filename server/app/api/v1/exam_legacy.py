"""Exam Legacy Routes - 1:1 兼容 Java 历史项目.

完整迁移自 H:\\ihui-ai-edu-exam-service:
  - PaperController               (7 端点)
  - PaperQuestionController       (1 端点)
  - QuestionController            (5 端点)
  - ExamChapterController         (2 端点)
  - ExamChapterSectionController  (1 端点)
  - WrongQuestionController       (1 端点)
  - ExamPaperRecordController     (5 端点)
  - ExamStatisticsController      (1 端点)

合计 ~23 个端点.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.security import get_current_user_id_flexible, require_login
from app.services import exam_business

router = APIRouter(prefix="", tags=["Exam-Paper-Legacy"])


def _ok(data: Any = None, msg: str = "ok") -> dict[str, Any]:
    return {"code": 0, "data": data, "msg": msg}


def _err(status: int, msg: str) -> HTTPException:
    return HTTPException(status_code=status, detail=msg)


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class PaperCreateReq(BaseModel):
    title: str
    code: str | None = None
    description: str | None = None
    categoryId: int | None = None
    courseId: int | None = None
    cover: str | None = None
    totalScore: float = 100
    passScore: float = 60
    duration: int = 60
    type: int = 1
    difficulty: int = 1
    isFree: bool = True
    price: float = 0


class PaperUpdateReq(BaseModel):
    id: int
    title: str | None = None
    description: str | None = None
    categoryId: int | None = None
    courseId: int | None = None
    cover: str | None = None
    totalScore: float | None = None
    passScore: float | None = None
    duration: int | None = None
    difficulty: int | None = None
    isFree: bool | None = None
    price: float | None = None


class PaperIdReq(BaseModel):
    id: int


class QuestionCreateReq(BaseModel):
    paperId: int
    type: int
    title: str | None = None
    content: str | None = None
    note: str | None = None
    options: str | None = None
    answer: str | None = None
    referenceAnswer: str | None = None
    analysis: str | None = None
    score: float = 1
    difficulty: int = 1


class QuestionUpdateReq(BaseModel):
    id: int
    title: str | None = None
    content: str | None = None
    note: str | None = None
    options: str | None = None
    answer: str | None = None
    referenceAnswer: str | None = None
    analysis: str | None = None
    score: float | None = None
    difficulty: int | None = None
    status: int | None = None


class QuestionDeleteReq(BaseModel):
    id: int


class QuestionGetListReq(BaseModel):
    page: int = 1
    pageSize: int = 20
    categoryId: int | None = None
    type: int | None = None
    difficulty: int | None = None
    status: int | None = None
    title: str | None = None


class ChapterCreateReq(BaseModel):
    title: str
    paperId: int | None = None
    description: str | None = None
    cover: str | None = None
    sortOrder: int = 0


class ChapterSortOrderReq(BaseModel):
    id: int
    sortOrder: int


class SectionCreateReq(BaseModel):
    title: str
    chapterId: int | None = None
    paperId: int | None = None
    description: str | None = None
    mediaUrl: str | None = None
    content: str | None = None
    sortOrder: int = 0
    duration: int = 0


class WrongQuestionAddReq(BaseModel):
    questionId: int
    paperId: int
    userAnswer: str | None = None
    rightAnswer: str | None = None


class ExamPaperRecordCreateReq(BaseModel):
    examId: int
    paperId: int
    paperTitle: str | None = None
    userName: str | None = None
    lessonId: int | None = None


class ExamPaperRecordSubmitReq(BaseModel):
    id: int
    answerData: str
    score: float = 0
    totalScore: float = 0


class ExamPaperRecordDraftReq(BaseModel):
    id: int
    draftData: str


class ExamPaperRecordMarkReq(BaseModel):
    id: int
    score: float


# ===========================================================================
# PaperController (7 端点)
# ===========================================================================

@router.get("/paper", summary="[Paper]获取试卷详情")
def paper_get(id: int | None = None):
    if id is not None:
        return _ok(exam_business.get_paper(id))
    return _ok({})


@router.get("/auth-api/paper", summary="[Paper]获取试卷详情(需登录)")
def paper_auth_get(id: int | None = None, _user: str = Depends(require_login)):
    if id is not None:
        return _ok(exam_business.get_paper(id))
    return _ok({})


@router.get("/paper/list", summary="[Paper]获取试卷列表")
def paper_list(
    page: int = 1,
    pageSize: int = 20,
    title: str | None = None,
    status: int | None = None,
    categoryId: int | None = None,
    isFree: bool | None = None,
):
    return _ok(exam_business.list_papers(
        page=page, page_size=pageSize, title=title, status=status,
        category_id=categoryId, is_free=isFree,
    ))


@router.post("/paper", summary="[Paper]添加试卷")
def paper_create(req: PaperCreateReq):
    try:
        return _ok(exam_business.create_paper(
            title=req.title, code=req.code, description=req.description,
            category_id=req.categoryId, course_id=req.courseId, cover=req.cover,
            total_score=req.totalScore, pass_score=req.passScore, duration=req.duration,
            type=req.type, difficulty=req.difficulty, is_free=req.isFree, price=req.price,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/paper", summary="[Paper]修改试卷")
def paper_update(req: PaperUpdateReq):
    if req.id <= 0:
        raise _err(400, "id需大于0")
    return _ok(exam_business.update_paper(
        paper_id=req.id, title=req.title, description=req.description,
        category_id=req.categoryId, course_id=req.courseId, cover=req.cover,
        total_score=req.totalScore, pass_score=req.passScore, duration=req.duration,
        difficulty=req.difficulty, is_free=req.isFree, price=req.price,
    ))


@router.delete("/paper", summary="[Paper]删除试卷")
def paper_delete(req: PaperIdReq):
    exam_business.delete_paper(req.id)
    return _ok()


@router.put("/paper/publish", summary="[Paper]发布试卷")
def paper_publish(req: PaperIdReq):
    exam_business.publish_paper(req.id)
    return _ok()


@router.put("/paper/un-publish", summary="[Paper]取消发布试卷")
def paper_unpublish(req: PaperIdReq):
    exam_business.unpublish_paper(req.id)
    return _ok()


# ===========================================================================
# PaperQuestionController (1 端点)
# ===========================================================================

@router.get("/paper/question/by-paper-id", summary="[PaperQ]按试卷ID获取题目")
def paper_questions(paperId: int):
    return _ok({"list": exam_business.list_paper_questions(paperId)})


# ===========================================================================
# QuestionController (5 端点)
# ===========================================================================

@router.get("/question-lib/question/{id}", summary="[Question]获取题目详情")
def question_get(id: int):
    return _ok(exam_business.get_question(id))


@router.get("/question-lib/question", summary="[Question]获取题目列表")
def question_list(
    page: int = 1,
    pageSize: int = 20,
    categoryId: int | None = None,
    type: int | None = None,
    difficulty: int | None = None,
    status: int | None = None,
    title: str | None = None,
):
    return _ok(exam_business.list_questions(
        page=page, page_size=pageSize, category_id=categoryId, type=type,
        difficulty=difficulty, status=status, title=title,
    ))


@router.post("/question-lib/question", summary="[Question]创建题目")
def question_create(req: QuestionCreateReq):
    try:
        return _ok(exam_business.create_question(
            paper_id=req.paperId, type=req.type, title=req.title, content=req.content,
            note=req.note, options=req.options, answer=req.answer,
            reference_answer=req.referenceAnswer, analysis=req.analysis,
            score=req.score, difficulty=req.difficulty,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/question-lib/question", summary="[Question]修改题目")
def question_update(req: QuestionUpdateReq):
    if req.id <= 0:
        raise _err(400, "id需大于0")
    return _ok(exam_business.update_question(
        question_id=req.id, title=req.title, content=req.content, note=req.note,
        options=req.options, answer=req.answer, reference_answer=req.referenceAnswer,
        analysis=req.analysis, score=req.score, difficulty=req.difficulty, status=req.status,
    ))


@router.delete("/question-lib/question", summary="[Question]删除题目")
def question_delete(req: QuestionDeleteReq):
    exam_business.delete_question(req.id)
    return _ok()


# ===========================================================================
# ExamChapterController (2 端点)
# ===========================================================================

@router.get("/exam/chapter", summary="[ExamChapter]获取章节列表")
def exam_chapter_list(paperId: int | None = None):
    return _ok({"list": exam_business.list_exam_chapters(paperId)})


@router.post("/exam/chapter", summary="[ExamChapter]添加章节")
def exam_chapter_create(req: ChapterCreateReq):
    return _ok(exam_business.create_exam_chapter(
        title=req.title, paper_id=req.paperId, description=req.description,
        cover=req.cover, sort_order=req.sortOrder,
    ))


@router.put("/exam/chapter/sort-order", summary="[ExamChapter]修改排序")
def exam_chapter_sort_order(req: ChapterSortOrderReq):
    exam_business.update_exam_chapter_sort_order(req.id, req.sortOrder)
    return _ok()


# ===========================================================================
# ExamChapterSectionController (1 端点)
# ===========================================================================

@router.get("/exam/chapter-section", summary="[ExamSection]获取小节列表")
def exam_section_list(chapterId: int | None = None, paperId: int | None = None):
    return _ok({"list": exam_business.list_exam_chapter_sections(chapterId, paperId)})


@router.post("/exam/chapter-section", summary="[ExamSection]添加小节")
def exam_section_create(req: SectionCreateReq):
    return _ok(exam_business.create_exam_chapter_section(
        title=req.title, chapter_id=req.chapterId, paper_id=req.paperId,
        description=req.description, media_url=req.mediaUrl, content=req.content,
        sort_order=req.sortOrder, duration=req.duration,
    ))


# ===========================================================================
# WrongQuestionController (1 端点)
# ===========================================================================

@router.post("/auth-api/wrong-question", summary="[WrongQ]添加错题")
def wrong_question_add(req: WrongQuestionAddReq, _user: str = Depends(require_login)):
    try:
        user_id = str(get_current_user_id_flexible())
        return _ok(exam_business.add_wrong_question(
            user_id=user_id, question_id=req.questionId, paper_id=req.paperId,
            user_answer=req.userAnswer, right_answer=req.rightAnswer,
        ))
    except Exception as e:
        raise _err(500, str(e))


# ===========================================================================
# ExamPaperRecordController (5 端点)
# ===========================================================================

@router.get("/auth-api/exampaper/record", summary="[PaperRecord]获取考试记录")
def paper_record_list(
    examId: int | None = None,
    paperId: int | None = None,
    _user: str = Depends(require_login),
):
    member_id = get_current_user_id_flexible()
    return _ok({"list": exam_business.list_exam_paper_records(
        member_id=member_id, exam_id=examId, paper_id=paperId,
    )})


@router.post("/auth-api/exampaper/record", summary="[PaperRecord]创建考试记录")
def paper_record_create(req: ExamPaperRecordCreateReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(exam_business.create_exam_paper_record(
            exam_id=req.examId, member_id=member_id, paper_id=req.paperId,
            paper_title=req.paperTitle, user_name=req.userName, lesson_id=req.lessonId,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.post("/auth-api/exampaper/record/draft", summary="[PaperRecord]保存草稿")
def paper_record_draft(req: ExamPaperRecordDraftReq, _user: str = Depends(require_login)):
    exam_business.save_exam_paper_draft(req.id, req.draftData)
    return _ok()


@router.post("/auth-api/exampaper/record/submit", summary="[PaperRecord]提交答卷")
def paper_record_submit(req: ExamPaperRecordSubmitReq, _user: str = Depends(require_login)):
    return _ok(exam_business.submit_exam_paper_record(
        record_id=req.id, answer_data=req.answerData, score=req.score, total_score=req.totalScore,
    ))


@router.get("/auth-api/exampaper/record/check-submitted", summary="[PaperRecord]检查是否已提交")
def paper_record_check_submitted(examId: int, _user: str = Depends(require_login)):
    member_id = get_current_user_id_flexible()
    records = exam_business.list_exam_paper_records(member_id=member_id, exam_id=examId, status=1)
    return _ok({"submitted": len(records) > 0, "count": len(records)})


@router.post("/exampaper/record/manual/mark/paper", summary="[PaperRecord]手动批改")
def paper_record_mark(req: ExamPaperRecordMarkReq):
    exam_business.manual_mark_paper(req.id, req.score)
    return _ok()


# ===========================================================================
# ExamStatisticsController (1 端点)
# ===========================================================================

@router.get("/statistics", summary="[ExamStat]考试统计")
def exam_statistics():
    return _ok(exam_business.exam_statistics())
