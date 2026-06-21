"""分类字典路由注册"""
from fastapi import APIRouter

from app.api.v1.category_dictionary.category_dictionary import router as category_dict_router

router = APIRouter()
router.include_router(category_dict_router, prefix="/category-dictionary", tags=["Category Dictionary"])
