"""AI 教育模块 - 5 张定制表 CRUD (政策/师资认证/AIGC工具/K12课标/高校课程)"""

from datetime import datetime

from fastapi import APIRouter, Query
from loguru import logger

from app.database import get_session
from app.models.ai_education_models import (
    AiEducationPolicy,
    AigcToolDetail,
    AiTeacherCertification,
    K12AiCurriculum,
    UniversityAiCourse,
)
from app.schemas.common import error, success

router = APIRouter(prefix="/ai-education", tags=["AI Education"])


# ============ AI 教育政策 ============


def _policy_to_dict(p: AiEducationPolicy) -> dict:
    return {
        "id": p.id,
        "policy_name": p.policy_name,
        "issuing_authority": p.issuing_authority,
        "issue_date": p.issue_date.isoformat() if p.issue_date else None,
        "effective_date": p.effective_date.isoformat() if p.effective_date else None,
        "policy_level": p.policy_level,
        "target_group": p.target_group,
        "summary": p.summary,
        "key_points": p.key_points,
        "implementation": p.implementation,
        "goals": p.goals,
        "supporting_measures": p.supporting_measures,
        "related_policies": p.related_policies,
        "source_url": p.source_url,
        "status": p.status,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/policy/list", summary="AI教育政策列表")
async def list_policies(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    keyword: str | None = None,
    status: str | None = None,
    policy_level: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(AiEducationPolicy).filter(AiEducationPolicy.deleted_at.is_(None))
            if keyword:
                q = q.filter(AiEducationPolicy.policy_name.like(f"%{keyword}%"))
            if status:
                q = q.filter(AiEducationPolicy.status == status)
            if policy_level:
                q = q.filter(AiEducationPolicy.policy_level == policy_level)
            total = q.count()
            items = q.order_by(AiEducationPolicy.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_policy_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"ai education policy list error: {e}")
            return error(str(e))


@router.get("/policy/{pid}", summary="AI教育政策详情")
async def get_policy(pid: int):
    with get_session() as db:
        try:
            p = (
                db.query(AiEducationPolicy)
                .filter(AiEducationPolicy.id == pid, AiEducationPolicy.deleted_at.is_(None))
                .first()
            )
            if not p:
                return error("政策不存在", "404")
            return success(_policy_to_dict(p))
        except Exception as e:
            logger.error(f"ai education policy get error: {e}")
            return error(str(e))


@router.post("/policy", summary="创建AI教育政策")
async def create_policy(
    policy_name: str = Query(..., min_length=1, max_length=300),
    issuing_authority: str = Query(..., min_length=1, max_length=200),
    issue_date: str | None = None,
    effective_date: str | None = None,
    policy_level: str | None = None,
    target_group: str | None = None,
    summary: str | None = None,
    key_points: str | None = None,
    implementation: str | None = None,
    goals: str | None = None,
    supporting_measures: str | None = None,
    related_policies: str | None = None,
    source_url: str | None = None,
    status: str = "active",
):
    with get_session() as db:
        try:
            p = AiEducationPolicy(
                policy_name=policy_name,
                issuing_authority=issuing_authority,
                issue_date=datetime.fromisoformat(issue_date).date() if issue_date else None,
                effective_date=datetime.fromisoformat(effective_date).date() if effective_date else None,
                policy_level=policy_level,
                target_group=target_group,
                summary=summary,
                key_points=key_points,
                implementation=implementation,
                goals=goals,
                supporting_measures=supporting_measures,
                related_policies=related_policies,
                source_url=source_url,
                status=status,
            )
            db.add(p)
            db.flush()
            return success({"id": p.id})
        except Exception as e:
            logger.error(f"ai education policy create error: {e}")
            return error(str(e))


@router.put("/policy/{pid}", summary="修改AI教育政策")
async def update_policy(
    pid: int,
    policy_name: str | None = None,
    issuing_authority: str | None = None,
    issue_date: str | None = None,
    effective_date: str | None = None,
    policy_level: str | None = None,
    target_group: str | None = None,
    summary: str | None = None,
    key_points: str | None = None,
    implementation: str | None = None,
    goals: str | None = None,
    supporting_measures: str | None = None,
    related_policies: str | None = None,
    source_url: str | None = None,
    status: str | None = None,
):
    with get_session() as db:
        try:
            p = (
                db.query(AiEducationPolicy)
                .filter(AiEducationPolicy.id == pid, AiEducationPolicy.deleted_at.is_(None))
                .first()
            )
            if not p:
                return error("政策不存在", "404")
            if policy_name is not None:
                p.policy_name = policy_name
            if issuing_authority is not None:
                p.issuing_authority = issuing_authority
            if issue_date is not None:
                p.issue_date = datetime.fromisoformat(issue_date).date()
            if effective_date is not None:
                p.effective_date = datetime.fromisoformat(effective_date).date()
            if policy_level is not None:
                p.policy_level = policy_level
            if target_group is not None:
                p.target_group = target_group
            if summary is not None:
                p.summary = summary
            if key_points is not None:
                p.key_points = key_points
            if implementation is not None:
                p.implementation = implementation
            if goals is not None:
                p.goals = goals
            if supporting_measures is not None:
                p.supporting_measures = supporting_measures
            if related_policies is not None:
                p.related_policies = related_policies
            if source_url is not None:
                p.source_url = source_url
            if status is not None:
                p.status = status
            return success({"id": p.id})
        except Exception as e:
            logger.error(f"ai education policy update error: {e}")
            return error(str(e))


@router.delete("/policy/{pid}", summary="删除AI教育政策")
async def delete_policy(pid: int):
    with get_session() as db:
        try:
            p = (
                db.query(AiEducationPolicy)
                .filter(AiEducationPolicy.id == pid, AiEducationPolicy.deleted_at.is_(None))
                .first()
            )
            if not p:
                return error("政策不存在", "404")
            p.deleted_at = datetime.utcnow()
            return success()
        except Exception as e:
            logger.error(f"ai education policy delete error: {e}")
            return error(str(e))


# ============ AI 师资认证 ============


def _cert_to_dict(c: AiTeacherCertification) -> dict:
    return {
        "id": c.id,
        "cert_name": c.cert_name,
        "issuing_authority": c.issuing_authority,
        "target_teachers": c.target_teachers,
        "level": c.level,
        "training_hours": c.training_hours,
        "training_content": c.training_content,
        "assessment_method": c.assessment_method,
        "certification_requirements": c.certification_requirements,
        "validity": c.validity,
        "benefits": c.benefits,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/teacher-certification/list", summary="AI师资认证列表")
async def list_certifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    keyword: str | None = None,
    level: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(AiTeacherCertification).filter(AiTeacherCertification.deleted_at.is_(None))
            if keyword:
                q = q.filter(AiTeacherCertification.cert_name.like(f"%{keyword}%"))
            if level:
                q = q.filter(AiTeacherCertification.level == level)
            total = q.count()
            items = q.order_by(AiTeacherCertification.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_cert_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"ai teacher certification list error: {e}")
            return error(str(e))


@router.get("/teacher-certification/{cid}", summary="AI师资认证详情")
async def get_certification(cid: int):
    with get_session() as db:
        try:
            c = (
                db.query(AiTeacherCertification)
                .filter(AiTeacherCertification.id == cid, AiTeacherCertification.deleted_at.is_(None))
                .first()
            )
            if not c:
                return error("师资认证不存在", "404")
            return success(_cert_to_dict(c))
        except Exception as e:
            logger.error(f"ai teacher certification get error: {e}")
            return error(str(e))


@router.post("/teacher-certification", summary="创建AI师资认证")
async def create_certification(
    cert_name: str = Query(..., min_length=1, max_length=200),
    issuing_authority: str = Query(..., min_length=1, max_length=200),
    target_teachers: str | None = None,
    level: str | None = None,
    training_hours: int | None = None,
    training_content: str | None = None,
    assessment_method: str | None = None,
    certification_requirements: str | None = None,
    validity: str | None = None,
    benefits: str | None = None,
):
    with get_session() as db:
        try:
            c = AiTeacherCertification(
                cert_name=cert_name,
                issuing_authority=issuing_authority,
                target_teachers=target_teachers,
                level=level,
                training_hours=training_hours,
                training_content=training_content,
                assessment_method=assessment_method,
                certification_requirements=certification_requirements,
                validity=validity,
                benefits=benefits,
            )
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"ai teacher certification create error: {e}")
            return error(str(e))


@router.put("/teacher-certification/{cid}", summary="修改AI师资认证")
async def update_certification(
    cid: int,
    cert_name: str | None = None,
    issuing_authority: str | None = None,
    target_teachers: str | None = None,
    level: str | None = None,
    training_hours: int | None = None,
    training_content: str | None = None,
    assessment_method: str | None = None,
    certification_requirements: str | None = None,
    validity: str | None = None,
    benefits: str | None = None,
):
    with get_session() as db:
        try:
            c = (
                db.query(AiTeacherCertification)
                .filter(AiTeacherCertification.id == cid, AiTeacherCertification.deleted_at.is_(None))
                .first()
            )
            if not c:
                return error("师资认证不存在", "404")
            if cert_name is not None:
                c.cert_name = cert_name
            if issuing_authority is not None:
                c.issuing_authority = issuing_authority
            if target_teachers is not None:
                c.target_teachers = target_teachers
            if level is not None:
                c.level = level
            if training_hours is not None:
                c.training_hours = training_hours
            if training_content is not None:
                c.training_content = training_content
            if assessment_method is not None:
                c.assessment_method = assessment_method
            if certification_requirements is not None:
                c.certification_requirements = certification_requirements
            if validity is not None:
                c.validity = validity
            if benefits is not None:
                c.benefits = benefits
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"ai teacher certification update error: {e}")
            return error(str(e))


@router.delete("/teacher-certification/{cid}", summary="删除AI师资认证")
async def delete_certification(cid: int):
    with get_session() as db:
        try:
            c = (
                db.query(AiTeacherCertification)
                .filter(AiTeacherCertification.id == cid, AiTeacherCertification.deleted_at.is_(None))
                .first()
            )
            if not c:
                return error("师资认证不存在", "404")
            c.deleted_at = datetime.utcnow()
            return success()
        except Exception as e:
            logger.error(f"ai teacher certification delete error: {e}")
            return error(str(e))


# ============ AIGC 工具详情 ============


def _tool_to_dict(t: AigcToolDetail) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "name_cn": t.name_cn,
        "category": t.category,
        "subcategory": t.subcategory,
        "provider": t.provider,
        "url": t.url,
        "description": t.description,
        "core_features": t.core_features,
        "use_cases": t.use_cases,
        "pricing_model": t.pricing_model,
        "pricing_detail": t.pricing_detail,
        "free_tier": t.free_tier,
        "generation_speed": t.generation_speed,
        "output_quality": t.output_quality,
        "chinese_support": t.chinese_support,
        "learning_curve": t.learning_curve,
        "api_available": t.api_available,
        "mobile_app": t.mobile_app,
        "pros": t.pros,
        "cons": t.cons,
        "tips": t.tips,
        "alternatives": t.alternatives,
        "rating": float(t.rating) if t.rating is not None else None,
        "user_count": t.user_count,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.get("/aigc-tool/list", summary="AIGC工具列表")
async def list_tools(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    keyword: str | None = None,
    category: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(AigcToolDetail).filter(AigcToolDetail.deleted_at.is_(None))
            if keyword:
                q = q.filter(AigcToolDetail.name.like(f"%{keyword}%"))
            if category:
                q = q.filter(AigcToolDetail.category == category)
            total = q.count()
            items = q.order_by(AigcToolDetail.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_tool_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"aigc tool list error: {e}")
            return error(str(e))


@router.get("/aigc-tool/{tid}", summary="AIGC工具详情")
async def get_tool(tid: int):
    with get_session() as db:
        try:
            t = (
                db.query(AigcToolDetail)
                .filter(AigcToolDetail.id == tid, AigcToolDetail.deleted_at.is_(None))
                .first()
            )
            if not t:
                return error("AIGC工具不存在", "404")
            return success(_tool_to_dict(t))
        except Exception as e:
            logger.error(f"aigc tool get error: {e}")
            return error(str(e))


@router.post("/aigc-tool", summary="创建AIGC工具")
async def create_tool(
    name: str = Query(..., min_length=1, max_length=100),
    category: str = Query(..., min_length=1, max_length=50),
    name_cn: str | None = None,
    subcategory: str | None = None,
    provider: str | None = None,
    url: str | None = None,
    description: str | None = None,
    core_features: str | None = None,
    use_cases: str | None = None,
    pricing_model: str | None = None,
    pricing_detail: str | None = None,
    free_tier: str | None = None,
    generation_speed: str | None = None,
    output_quality: str | None = None,
    chinese_support: str | None = None,
    learning_curve: str | None = None,
    api_available: bool = False,
    mobile_app: bool = False,
    pros: str | None = None,
    cons: str | None = None,
    tips: str | None = None,
    alternatives: str | None = None,
    rating: float | None = None,
    user_count: str | None = None,
):
    with get_session() as db:
        try:
            t = AigcToolDetail(
                name=name,
                category=category,
                name_cn=name_cn,
                subcategory=subcategory,
                provider=provider,
                url=url,
                description=description,
                core_features=core_features,
                use_cases=use_cases,
                pricing_model=pricing_model,
                pricing_detail=pricing_detail,
                free_tier=free_tier,
                generation_speed=generation_speed,
                output_quality=output_quality,
                chinese_support=chinese_support,
                learning_curve=learning_curve,
                api_available=api_available,
                mobile_app=mobile_app,
                pros=pros,
                cons=cons,
                tips=tips,
                alternatives=alternatives,
                rating=rating,
                user_count=user_count,
            )
            db.add(t)
            db.flush()
            return success({"id": t.id})
        except Exception as e:
            logger.error(f"aigc tool create error: {e}")
            return error(str(e))


@router.put("/aigc-tool/{tid}", summary="修改AIGC工具")
async def update_tool(
    tid: int,
    name: str | None = None,
    name_cn: str | None = None,
    category: str | None = None,
    subcategory: str | None = None,
    provider: str | None = None,
    url: str | None = None,
    description: str | None = None,
    core_features: str | None = None,
    use_cases: str | None = None,
    pricing_model: str | None = None,
    pricing_detail: str | None = None,
    free_tier: str | None = None,
    generation_speed: str | None = None,
    output_quality: str | None = None,
    chinese_support: str | None = None,
    learning_curve: str | None = None,
    api_available: bool | None = None,
    mobile_app: bool | None = None,
    pros: str | None = None,
    cons: str | None = None,
    tips: str | None = None,
    alternatives: str | None = None,
    rating: float | None = None,
    user_count: str | None = None,
):
    with get_session() as db:
        try:
            t = (
                db.query(AigcToolDetail)
                .filter(AigcToolDetail.id == tid, AigcToolDetail.deleted_at.is_(None))
                .first()
            )
            if not t:
                return error("AIGC工具不存在", "404")
            if name is not None:
                t.name = name
            if name_cn is not None:
                t.name_cn = name_cn
            if category is not None:
                t.category = category
            if subcategory is not None:
                t.subcategory = subcategory
            if provider is not None:
                t.provider = provider
            if url is not None:
                t.url = url
            if description is not None:
                t.description = description
            if core_features is not None:
                t.core_features = core_features
            if use_cases is not None:
                t.use_cases = use_cases
            if pricing_model is not None:
                t.pricing_model = pricing_model
            if pricing_detail is not None:
                t.pricing_detail = pricing_detail
            if free_tier is not None:
                t.free_tier = free_tier
            if generation_speed is not None:
                t.generation_speed = generation_speed
            if output_quality is not None:
                t.output_quality = output_quality
            if chinese_support is not None:
                t.chinese_support = chinese_support
            if learning_curve is not None:
                t.learning_curve = learning_curve
            if api_available is not None:
                t.api_available = api_available
            if mobile_app is not None:
                t.mobile_app = mobile_app
            if pros is not None:
                t.pros = pros
            if cons is not None:
                t.cons = cons
            if tips is not None:
                t.tips = tips
            if alternatives is not None:
                t.alternatives = alternatives
            if rating is not None:
                t.rating = rating
            if user_count is not None:
                t.user_count = user_count
            return success({"id": t.id})
        except Exception as e:
            logger.error(f"aigc tool update error: {e}")
            return error(str(e))


@router.delete("/aigc-tool/{tid}", summary="删除AIGC工具")
async def delete_tool(tid: int):
    with get_session() as db:
        try:
            t = (
                db.query(AigcToolDetail)
                .filter(AigcToolDetail.id == tid, AigcToolDetail.deleted_at.is_(None))
                .first()
            )
            if not t:
                return error("AIGC工具不存在", "404")
            t.deleted_at = datetime.utcnow()
            return success()
        except Exception as e:
            logger.error(f"aigc tool delete error: {e}")
            return error(str(e))


# ============ K12 AI 课程标准 ============


def _k12_to_dict(k: K12AiCurriculum) -> dict:
    return {
        "id": k.id,
        "stage": k.stage,
        "grade_range": k.grade_range,
        "course_name": k.course_name,
        "hours_per_year": k.hours_per_year,
        "course_type": k.course_type,
        "learning_objectives": k.learning_objectives,
        "content_modules": k.content_modules,
        "key_concepts": k.key_concepts,
        "skill_requirements": k.skill_requirements,
        "teaching_methods": k.teaching_methods,
        "assessment_methods": k.assessment_methods,
        "tools_resources": k.tools_resources,
        "integration_subjects": k.integration_subjects,
        "created_at": k.created_at.isoformat() if k.created_at else None,
    }


@router.get("/k12-curriculum/list", summary="K12 AI课程标准列表")
async def list_k12_curriculums(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    keyword: str | None = None,
    stage: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(K12AiCurriculum).filter(K12AiCurriculum.deleted_at.is_(None))
            if keyword:
                q = q.filter(K12AiCurriculum.course_name.like(f"%{keyword}%"))
            if stage:
                q = q.filter(K12AiCurriculum.stage == stage)
            total = q.count()
            items = q.order_by(K12AiCurriculum.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_k12_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"k12 ai curriculum list error: {e}")
            return error(str(e))


@router.get("/k12-curriculum/{kid}", summary="K12 AI课程标准详情")
async def get_k12_curriculum(kid: int):
    with get_session() as db:
        try:
            k = (
                db.query(K12AiCurriculum)
                .filter(K12AiCurriculum.id == kid, K12AiCurriculum.deleted_at.is_(None))
                .first()
            )
            if not k:
                return error("课程标准不存在", "404")
            return success(_k12_to_dict(k))
        except Exception as e:
            logger.error(f"k12 ai curriculum get error: {e}")
            return error(str(e))


@router.post("/k12-curriculum", summary="创建K12 AI课程标准")
async def create_k12_curriculum(
    stage: str = Query(..., min_length=1, max_length=50),
    grade_range: str | None = None,
    course_name: str | None = None,
    hours_per_year: int | None = None,
    course_type: str | None = None,
    learning_objectives: str | None = None,
    content_modules: str | None = None,
    key_concepts: str | None = None,
    skill_requirements: str | None = None,
    teaching_methods: str | None = None,
    assessment_methods: str | None = None,
    tools_resources: str | None = None,
    integration_subjects: str | None = None,
):
    with get_session() as db:
        try:
            k = K12AiCurriculum(
                stage=stage,
                grade_range=grade_range,
                course_name=course_name,
                hours_per_year=hours_per_year,
                course_type=course_type,
                learning_objectives=learning_objectives,
                content_modules=content_modules,
                key_concepts=key_concepts,
                skill_requirements=skill_requirements,
                teaching_methods=teaching_methods,
                assessment_methods=assessment_methods,
                tools_resources=tools_resources,
                integration_subjects=integration_subjects,
            )
            db.add(k)
            db.flush()
            return success({"id": k.id})
        except Exception as e:
            logger.error(f"k12 ai curriculum create error: {e}")
            return error(str(e))


@router.put("/k12-curriculum/{kid}", summary="修改K12 AI课程标准")
async def update_k12_curriculum(
    kid: int,
    stage: str | None = None,
    grade_range: str | None = None,
    course_name: str | None = None,
    hours_per_year: int | None = None,
    course_type: str | None = None,
    learning_objectives: str | None = None,
    content_modules: str | None = None,
    key_concepts: str | None = None,
    skill_requirements: str | None = None,
    teaching_methods: str | None = None,
    assessment_methods: str | None = None,
    tools_resources: str | None = None,
    integration_subjects: str | None = None,
):
    with get_session() as db:
        try:
            k = (
                db.query(K12AiCurriculum)
                .filter(K12AiCurriculum.id == kid, K12AiCurriculum.deleted_at.is_(None))
                .first()
            )
            if not k:
                return error("课程标准不存在", "404")
            if stage is not None:
                k.stage = stage
            if grade_range is not None:
                k.grade_range = grade_range
            if course_name is not None:
                k.course_name = course_name
            if hours_per_year is not None:
                k.hours_per_year = hours_per_year
            if course_type is not None:
                k.course_type = course_type
            if learning_objectives is not None:
                k.learning_objectives = learning_objectives
            if content_modules is not None:
                k.content_modules = content_modules
            if key_concepts is not None:
                k.key_concepts = key_concepts
            if skill_requirements is not None:
                k.skill_requirements = skill_requirements
            if teaching_methods is not None:
                k.teaching_methods = teaching_methods
            if assessment_methods is not None:
                k.assessment_methods = assessment_methods
            if tools_resources is not None:
                k.tools_resources = tools_resources
            if integration_subjects is not None:
                k.integration_subjects = integration_subjects
            return success({"id": k.id})
        except Exception as e:
            logger.error(f"k12 ai curriculum update error: {e}")
            return error(str(e))


@router.delete("/k12-curriculum/{kid}", summary="删除K12 AI课程标准")
async def delete_k12_curriculum(kid: int):
    with get_session() as db:
        try:
            k = (
                db.query(K12AiCurriculum)
                .filter(K12AiCurriculum.id == kid, K12AiCurriculum.deleted_at.is_(None))
                .first()
            )
            if not k:
                return error("课程标准不存在", "404")
            k.deleted_at = datetime.utcnow()
            return success()
        except Exception as e:
            logger.error(f"k12 ai curriculum delete error: {e}")
            return error(str(e))


# ============ 高校 AI 通识课程 ============


def _uni_to_dict(u: UniversityAiCourse) -> dict:
    return {
        "id": u.id,
        "course_name": u.course_name,
        "course_type": u.course_type,
        "target_major": u.target_major,
        "credits": float(u.credits) if u.credits is not None else None,
        "hours": u.hours,
        "university": u.university,
        "description": u.description,
        "modules": u.modules,
        "prerequisites": u.prerequisites,
        "textbooks": u.textbooks,
        "teaching_team": u.teaching_team,
        "assessment": u.assessment,
        "is_required": u.is_required,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


@router.get("/university-course/list", summary="高校AI通识课程列表")
async def list_university_courses(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    keyword: str | None = None,
    university: str | None = None,
    course_type: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(UniversityAiCourse).filter(UniversityAiCourse.deleted_at.is_(None))
            if keyword:
                q = q.filter(UniversityAiCourse.course_name.like(f"%{keyword}%"))
            if university:
                q = q.filter(UniversityAiCourse.university == university)
            if course_type:
                q = q.filter(UniversityAiCourse.course_type == course_type)
            total = q.count()
            items = q.order_by(UniversityAiCourse.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_uni_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"university ai course list error: {e}")
            return error(str(e))


@router.get("/university-course/{uid}", summary="高校AI通识课程详情")
async def get_university_course(uid: int):
    with get_session() as db:
        try:
            u = (
                db.query(UniversityAiCourse)
                .filter(UniversityAiCourse.id == uid, UniversityAiCourse.deleted_at.is_(None))
                .first()
            )
            if not u:
                return error("课程不存在", "404")
            return success(_uni_to_dict(u))
        except Exception as e:
            logger.error(f"university ai course get error: {e}")
            return error(str(e))


@router.post("/university-course", summary="创建高校AI通识课程")
async def create_university_course(
    course_name: str = Query(..., min_length=1, max_length=200),
    course_type: str | None = None,
    target_major: str | None = None,
    credits: float | None = None,
    hours: int | None = None,
    university: str | None = None,
    description: str | None = None,
    modules: str | None = None,
    prerequisites: str | None = None,
    textbooks: str | None = None,
    teaching_team: str | None = None,
    assessment: str | None = None,
    is_required: bool = False,
):
    with get_session() as db:
        try:
            u = UniversityAiCourse(
                course_name=course_name,
                course_type=course_type,
                target_major=target_major,
                credits=credits,
                hours=hours,
                university=university,
                description=description,
                modules=modules,
                prerequisites=prerequisites,
                textbooks=textbooks,
                teaching_team=teaching_team,
                assessment=assessment,
                is_required=is_required,
            )
            db.add(u)
            db.flush()
            return success({"id": u.id})
        except Exception as e:
            logger.error(f"university ai course create error: {e}")
            return error(str(e))


@router.put("/university-course/{uid}", summary="修改高校AI通识课程")
async def update_university_course(
    uid: int,
    course_name: str | None = None,
    course_type: str | None = None,
    target_major: str | None = None,
    credits: float | None = None,
    hours: int | None = None,
    university: str | None = None,
    description: str | None = None,
    modules: str | None = None,
    prerequisites: str | None = None,
    textbooks: str | None = None,
    teaching_team: str | None = None,
    assessment: str | None = None,
    is_required: bool | None = None,
):
    with get_session() as db:
        try:
            u = (
                db.query(UniversityAiCourse)
                .filter(UniversityAiCourse.id == uid, UniversityAiCourse.deleted_at.is_(None))
                .first()
            )
            if not u:
                return error("课程不存在", "404")
            if course_name is not None:
                u.course_name = course_name
            if course_type is not None:
                u.course_type = course_type
            if target_major is not None:
                u.target_major = target_major
            if credits is not None:
                u.credits = credits
            if hours is not None:
                u.hours = hours
            if university is not None:
                u.university = university
            if description is not None:
                u.description = description
            if modules is not None:
                u.modules = modules
            if prerequisites is not None:
                u.prerequisites = prerequisites
            if textbooks is not None:
                u.textbooks = textbooks
            if teaching_team is not None:
                u.teaching_team = teaching_team
            if assessment is not None:
                u.assessment = assessment
            if is_required is not None:
                u.is_required = is_required
            return success({"id": u.id})
        except Exception as e:
            logger.error(f"university ai course update error: {e}")
            return error(str(e))


@router.delete("/university-course/{uid}", summary="删除高校AI通识课程")
async def delete_university_course(uid: int):
    with get_session() as db:
        try:
            u = (
                db.query(UniversityAiCourse)
                .filter(UniversityAiCourse.id == uid, UniversityAiCourse.deleted_at.is_(None))
                .first()
            )
            if not u:
                return error("课程不存在", "404")
            u.deleted_at = datetime.utcnow()
            return success()
        except Exception as e:
            logger.error(f"university ai course delete error: {e}")
            return error(str(e))
