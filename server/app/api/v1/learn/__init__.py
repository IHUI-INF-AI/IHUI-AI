"""Learn 服务路由注册 (迁移自 edu server ihui-ai-edu-learn-service)

包含 16 个模块: lesson / signup / record / task / rate / report / statistics /
topic / category / homework / certificate / learnmap / access / exampaper
"""

from fastapi import APIRouter

from app.api.v1.learn.access import router as access_router
from app.api.v1.learn.category import router as category_router
from app.api.v1.learn.certificate import router as certificate_router
from app.api.v1.learn.exampaper import router as exampaper_router
from app.api.v1.learn.homework import router as homework_router
from app.api.v1.learn.learnmap import router as learnmap_router
from app.api.v1.learn.lesson import router as lesson_router
from app.api.v1.learn.rate import router as rate_router
from app.api.v1.learn.record import router as record_router
from app.api.v1.learn.report import router as report_router
from app.api.v1.learn.signup import router as signup_router
from app.api.v1.learn.statistics import router as statistics_router
from app.api.v1.learn.task import router as task_router
from app.api.v1.learn.topic import router as topic_router

router = APIRouter()
router.include_router(lesson_router, prefix="/learn/lesson", tags=["Learn-Lesson"])
router.include_router(signup_router, prefix="/learn/signup", tags=["Learn-SignUp"])
router.include_router(record_router, prefix="/learn/record", tags=["Learn-Record"])
router.include_router(task_router, prefix="/learn/task", tags=["Learn-Task"])
router.include_router(rate_router, prefix="/learn/rate", tags=["Learn-Rate"])
router.include_router(report_router, prefix="/learn/report", tags=["Learn-Report"])
router.include_router(statistics_router, prefix="/learn/statistics", tags=["Learn-Statistics"])
router.include_router(topic_router, prefix="/learn/topic", tags=["Learn-Topic"])
router.include_router(category_router, prefix="/learn/category", tags=["Learn-Category"])
router.include_router(homework_router, prefix="/learn/homework", tags=["Learn-Homework"])
router.include_router(certificate_router, prefix="/learn/certificate", tags=["Learn-Certificate"])
router.include_router(learnmap_router, prefix="/learn/learnmap", tags=["Learn-LearnMap"])
router.include_router(access_router, prefix="/learn/access", tags=["Learn-Access"])
router.include_router(exampaper_router, prefix="/learn/exampaper", tags=["Learn-ExamPaper"])
