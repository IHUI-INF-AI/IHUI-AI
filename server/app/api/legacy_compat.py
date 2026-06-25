"""
Java 历史项目 API 兼容层 (Legacy Compatibility Layer) - STUB
============================================================

为 Java 旧 API 路径提供 URL 1:1 兼容, 内部实现状态:
- alias 路由: 调用现有 Python handler (URL 重写, 0 业务代码重复)
- stub 路由: 抛 NotImplementedError, 业务实现标记为 TODO

生成时间: 2026-06-26
总路由数: 488
  - alias 路由 (复用现有): 0
  - stub 路由 (待实现): 488
目标 Java 服务: 22 个

后续迭代计划:
- 按 Controller 优先级分批实现 stub 路由的真实业务逻辑
- 每个 Controller 实现完成后, 移除其 stub, 改为真实 handler
"""
from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException
from loguru import logger

router = APIRouter(prefix="", tags=["legacy-compat"], include_in_schema=False)


def _not_implemented(java_path: str, controller: str):
    """Stub handler - 标记待实现."""
    logger.warning(f"[legacy-stub] Not implemented: {{java_path}} ({{controller}})")
    raise HTTPException(
        status_code=501,
        detail=f"Legacy endpoint not yet implemented: {{java_path}} ({{controller}})"
    )


# 导入目标 handler (alias 路由使用)



# === 路由定义 (488 个) ===
@router.get("/category/{id}", include_in_schema=False)
async def legacy_stub_get_category__id_38137(request: Request):
    """Legacy stub: /category/{id} (CategoryController)"""
    return _not_implemented("/category/{id}", "CategoryController")

@router.delete("/category/{id}", include_in_schema=False)
async def legacy_stub_delete_category__id_73537(request: Request):
    """Legacy stub: /category/{id} (CategoryController)"""
    return _not_implemented("/category/{id}", "CategoryController")

@router.put("/role/authority/update", include_in_schema=False)
async def legacy_stub_put_role_authority_update_82761(request: Request):
    """Legacy stub: /role/authority/update (RoleController)"""
    return _not_implemented("/role/authority/update", "RoleController")

@router.get("/category/{id}", include_in_schema=False)
async def legacy_stub_get_category__id_38137(request: Request):
    """Legacy stub: /category/{id} (CategoryController)"""
    return _not_implemented("/category/{id}", "CategoryController")

@router.delete("/category/{id}", include_in_schema=False)
async def legacy_stub_delete_category__id_73537(request: Request):
    """Legacy stub: /category/{id} (CategoryController)"""
    return _not_implemented("/category/{id}", "CategoryController")

@router.get("/category/{id}", include_in_schema=False)
async def legacy_stub_get_category__id_38137(request: Request):
    """Legacy stub: /category/{id} (CategoryController)"""
    return _not_implemented("/category/{id}", "CategoryController")

@router.delete("/category/{id}", include_in_schema=False)
async def legacy_stub_delete_category__id_73537(request: Request):
    """Legacy stub: /category/{id} (CategoryController)"""
    return _not_implemented("/category/{id}", "CategoryController")

@router.get("/category/{id}", include_in_schema=False)
async def legacy_stub_get_category__id_38137(request: Request):
    """Legacy stub: /category/{id} (CategoryController)"""
    return _not_implemented("/category/{id}", "CategoryController")

@router.delete("/category/{id}", include_in_schema=False)
async def legacy_stub_delete_category__id_73537(request: Request):
    """Legacy stub: /category/{id} (CategoryController)"""
    return _not_implemented("/category/{id}", "CategoryController")

@router.get("/paper/category/{id}", include_in_schema=False)
async def legacy_stub_get_paper_category__id_34461(request: Request):
    """Legacy stub: /paper/category/{id} (PaperCategoryController)"""
    return _not_implemented("/paper/category/{id}", "PaperCategoryController")

@router.delete("/paper/category/{id}", include_in_schema=False)
async def legacy_stub_delete_paper_category__id_13048(request: Request):
    """Legacy stub: /paper/category/{id} (PaperCategoryController)"""
    return _not_implemented("/paper/category/{id}", "PaperCategoryController")

@router.get("/question-lib/category/{id}", include_in_schema=False)
async def legacy_stub_get_question_lib_category__id_29979(request: Request):
    """Legacy stub: /question-lib/category/{id} (QuestionCategoryController)"""
    return _not_implemented("/question-lib/category/{id}", "QuestionCategoryController")

@router.delete("/question-lib/category/{id}", include_in_schema=False)
async def legacy_stub_delete_question_lib_category__id_87773(request: Request):
    """Legacy stub: /question-lib/category/{id} (QuestionCategoryController)"""
    return _not_implemented("/question-lib/category/{id}", "QuestionCategoryController")

@router.get("/question-lib/question/{id}", include_in_schema=False)
async def legacy_stub_get_question_lib_question__id_10163(request: Request):
    """Legacy stub: /question-lib/question/{id} (QuestionController)"""
    return _not_implemented("/question-lib/question/{id}", "QuestionController")

@router.get("/category/{id}", include_in_schema=False)
async def legacy_stub_get_category__id_38137(request: Request):
    """Legacy stub: /category/{id} (CategoryController)"""
    return _not_implemented("/category/{id}", "CategoryController")

@router.delete("/category/{id}", include_in_schema=False)
async def legacy_stub_delete_category__id_73537(request: Request):
    """Legacy stub: /category/{id} (CategoryController)"""
    return _not_implemented("/category/{id}", "CategoryController")

@router.get("/topic/category/{id}", include_in_schema=False)
async def legacy_stub_get_topic_category__id_25105(request: Request):
    """Legacy stub: /topic/category/{id} (TopicCategoryController)"""
    return _not_implemented("/topic/category/{id}", "TopicCategoryController")

@router.delete("/topic/category/{id}", include_in_schema=False)
async def legacy_stub_delete_topic_category__id_86020(request: Request):
    """Legacy stub: /topic/category/{id} (TopicCategoryController)"""
    return _not_implemented("/topic/category/{id}", "TopicCategoryController")

@router.get("/category/{id}", include_in_schema=False)
async def legacy_stub_get_category__id_38137(request: Request):
    """Legacy stub: /category/{id} (CategoryController)"""
    return _not_implemented("/category/{id}", "CategoryController")

@router.delete("/category/{id}", include_in_schema=False)
async def legacy_stub_delete_category__id_73537(request: Request):
    """Legacy stub: /category/{id} (CategoryController)"""
    return _not_implemented("/category/{id}", "CategoryController")

@router.get("/channel/{id}", include_in_schema=False)
async def legacy_stub_get_channel__id_8748(request: Request):
    """Legacy stub: /channel/{id} (ChannelController)"""
    return _not_implemented("/channel/{id}", "ChannelController")

@router.get("/channel/stream-info/{id}", include_in_schema=False)
async def legacy_stub_get_channel_stream_info__id_64091(request: Request):
    """Legacy stub: /channel/stream-info/{id} (ChannelController)"""
    return _not_implemented("/channel/stream-info/{id}", "ChannelController")

@router.get("/category/{id}", include_in_schema=False)
async def legacy_stub_get_category__id_38137(request: Request):
    """Legacy stub: /category/{id} (CategoryController)"""
    return _not_implemented("/category/{id}", "CategoryController")

@router.delete("/posts/{id}", include_in_schema=False)
async def legacy_stub_delete_posts__id_83758(request: Request):
    """Legacy stub: /posts/{id} (PostController)"""
    return _not_implemented("/posts/{id}", "PostController")

@router.get("/posts/{id}", include_in_schema=False)
async def legacy_stub_get_posts__id_58165(request: Request):
    """Legacy stub: /posts/{id} (PostController)"""
    return _not_implemented("/posts/{id}", "PostController")

@router.post("/auth-api/answer", include_in_schema=False)
async def legacy_stub_post_auth_api_answer_93359(request: Request):
    """Legacy stub: /auth-api/answer (AnswerController)"""
    return _not_implemented("/auth-api/answer", "AnswerController")

@router.put("/auth-api/answer", include_in_schema=False)
async def legacy_stub_put_auth_api_answer_23404(request: Request):
    """Legacy stub: /auth-api/answer (AnswerController)"""
    return _not_implemented("/auth-api/answer", "AnswerController")

@router.delete("/auth-api/answer", include_in_schema=False)
async def legacy_stub_delete_auth_api_answer_97808(request: Request):
    """Legacy stub: /auth-api/answer (AnswerController)"""
    return _not_implemented("/auth-api/answer", "AnswerController")

@router.get("/public-api/answer/list/by-ids", include_in_schema=False)
async def legacy_stub_get_public_api_answer_list_by_ids_8923(request: Request):
    """Legacy stub: /public-api/answer/list/by-ids (AnswerController)"""
    return _not_implemented("/public-api/answer/list/by-ids", "AnswerController")

@router.get("/public-api/answer", include_in_schema=False)
async def legacy_stub_get_public_api_answer_88019(request: Request):
    """Legacy stub: /public-api/answer (AnswerController)"""
    return _not_implemented("/public-api/answer", "AnswerController")

@router.post("/category", include_in_schema=False)
async def legacy_stub_post_category_31377(request: Request):
    """Legacy stub: /category (CategoryController)"""
    return _not_implemented("/category", "CategoryController")

@router.put("/category", include_in_schema=False)
async def legacy_stub_put_category_82948(request: Request):
    """Legacy stub: /category (CategoryController)"""
    return _not_implemented("/category", "CategoryController")

@router.post("/category/image", include_in_schema=False)
async def legacy_stub_post_category_image_97195(request: Request):
    """Legacy stub: /category/image (CategoryController)"""
    return _not_implemented("/category/image", "CategoryController")

@router.delete("/category/image", include_in_schema=False)
async def legacy_stub_delete_category_image_35743(request: Request):
    """Legacy stub: /category/image (CategoryController)"""
    return _not_implemented("/category/image", "CategoryController")

@router.post("/auth-api/question", include_in_schema=False)
async def legacy_stub_post_auth_api_question_71004(request: Request):
    """Legacy stub: /auth-api/question (QuestionController)"""
    return _not_implemented("/auth-api/question", "QuestionController")

@router.put("/auth-api/question", include_in_schema=False)
async def legacy_stub_put_auth_api_question_67331(request: Request):
    """Legacy stub: /auth-api/question (QuestionController)"""
    return _not_implemented("/auth-api/question", "QuestionController")

@router.delete("/auth-api/question", include_in_schema=False)
async def legacy_stub_delete_auth_api_question_86933(request: Request):
    """Legacy stub: /auth-api/question (QuestionController)"""
    return _not_implemented("/auth-api/question", "QuestionController")

@router.get("/public-api/question/list/by-ids", include_in_schema=False)
async def legacy_stub_get_public_api_question_list_by_ids_31952(request: Request):
    """Legacy stub: /public-api/question/list/by-ids (QuestionController)"""
    return _not_implemented("/public-api/question/list/by-ids", "QuestionController")

@router.get("/public-api/question", include_in_schema=False)
async def legacy_stub_get_public_api_question_11797(request: Request):
    """Legacy stub: /public-api/question (QuestionController)"""
    return _not_implemented("/public-api/question", "QuestionController")

@router.get("/statistics", include_in_schema=False)
async def legacy_stub_get_statistics_75798(request: Request):
    """Legacy stub: /statistics (AskStatisticsController)"""
    return _not_implemented("/statistics", "AskStatisticsController")

@router.get("/authorities", include_in_schema=False)
async def legacy_stub_get_authorities_89625(request: Request):
    """Legacy stub: /authorities (AuthorityController)"""
    return _not_implemented("/authorities", "AuthorityController")

@router.get("/authorities/tree", include_in_schema=False)
async def legacy_stub_get_authorities_tree_47181(request: Request):
    """Legacy stub: /authorities/tree (AuthorityController)"""
    return _not_implemented("/authorities/tree", "AuthorityController")

@router.get("/public-api/auth-code", include_in_schema=False)
async def legacy_stub_get_public_api_auth_code_95480(request: Request):
    """Legacy stub: /public-api/auth-code (AuthController)"""
    return _not_implemented("/public-api/auth-code", "AuthController")

@router.post("/public-api/auth-code/check", include_in_schema=False)
async def legacy_stub_post_public_api_auth_code_check_82339(request: Request):
    """Legacy stub: /public-api/auth-code/check (AuthController)"""
    return _not_implemented("/public-api/auth-code/check", "AuthController")

@router.post("/role", include_in_schema=False)
async def legacy_stub_post_role_7300(request: Request):
    """Legacy stub: /role (RoleController)"""
    return _not_implemented("/role", "RoleController")

@router.put("/role", include_in_schema=False)
async def legacy_stub_put_role_75233(request: Request):
    """Legacy stub: /role (RoleController)"""
    return _not_implemented("/role", "RoleController")

@router.delete("/role", include_in_schema=False)
async def legacy_stub_delete_role_42179(request: Request):
    """Legacy stub: /role (RoleController)"""
    return _not_implemented("/role", "RoleController")

@router.put("/role/user/list", include_in_schema=False)
async def legacy_stub_put_role_user_list_26432(request: Request):
    """Legacy stub: /role/user/list (RoleController)"""
    return _not_implemented("/role/user/list", "RoleController")

@router.delete("/auth-api/comment", include_in_schema=False)
async def legacy_stub_delete_auth_api_comment_33568(request: Request):
    """Legacy stub: /auth-api/comment (CommentController)"""
    return _not_implemented("/auth-api/comment", "CommentController")

@router.get("/public-api/comment/list/by-ids", include_in_schema=False)
async def legacy_stub_get_public_api_comment_list_by_ids_49220(request: Request):
    """Legacy stub: /public-api/comment/list/by-ids (CommentController)"""
    return _not_implemented("/public-api/comment/list/by-ids", "CommentController")

@router.get("/public-api/reply-comment/list/by-ids", include_in_schema=False)
async def legacy_stub_get_public_api_reply_comment_list_by_ids_83469(request: Request):
    """Legacy stub: /public-api/reply-comment/list/by-ids (CommentController)"""
    return _not_implemented("/public-api/reply-comment/list/by-ids", "CommentController")

@router.delete("/auth-api/reply/comment", include_in_schema=False)
async def legacy_stub_delete_auth_api_reply_comment_27294(request: Request):
    """Legacy stub: /auth-api/reply/comment (CommentController)"""
    return _not_implemented("/auth-api/reply/comment", "CommentController")

@router.get("/public-api/comment/count", include_in_schema=False)
async def legacy_stub_get_public_api_comment_count_18040(request: Request):
    """Legacy stub: /public-api/comment/count (CommentController)"""
    return _not_implemented("/public-api/comment/count", "CommentController")

@router.delete("/auth-api/favorite", include_in_schema=False)
async def legacy_stub_delete_auth_api_favorite_59643(request: Request):
    """Legacy stub: /auth-api/favorite (FavoriteController)"""
    return _not_implemented("/auth-api/favorite", "FavoriteController")

@router.get("/public-api/favorite/count", include_in_schema=False)
async def legacy_stub_get_public_api_favorite_count_83348(request: Request):
    """Legacy stub: /public-api/favorite/count (FavoriteController)"""
    return _not_implemented("/public-api/favorite/count", "FavoriteController")

@router.put("/auth-api/like", include_in_schema=False)
async def legacy_stub_put_auth_api_like_69055(request: Request):
    """Legacy stub: /auth-api/like (LikeController)"""
    return _not_implemented("/auth-api/like", "LikeController")

@router.get("/public-api/like/count", include_in_schema=False)
async def legacy_stub_get_public_api_like_count_54623(request: Request):
    """Legacy stub: /public-api/like/count (LikeController)"""
    return _not_implemented("/public-api/like/count", "LikeController")

@router.post("/sensitive-word", include_in_schema=False)
async def legacy_stub_post_sensitive_word_38292(request: Request):
    """Legacy stub: /sensitive-word (WordController)"""
    return _not_implemented("/sensitive-word", "WordController")

@router.put("/sensitive-word", include_in_schema=False)
async def legacy_stub_put_sensitive_word_90911(request: Request):
    """Legacy stub: /sensitive-word (WordController)"""
    return _not_implemented("/sensitive-word", "WordController")

@router.delete("/sensitive-word", include_in_schema=False)
async def legacy_stub_delete_sensitive_word_73185(request: Request):
    """Legacy stub: /sensitive-word (WordController)"""
    return _not_implemented("/sensitive-word", "WordController")

@router.post("/public-api/watch", include_in_schema=False)
async def legacy_stub_post_public_api_watch_92667(request: Request):
    """Legacy stub: /public-api/watch (WatchController)"""
    return _not_implemented("/public-api/watch", "WatchController")

@router.get("/public-api/watch/count", include_in_schema=False)
async def legacy_stub_get_public_api_watch_count_10060(request: Request):
    """Legacy stub: /public-api/watch/count (WatchController)"""
    return _not_implemented("/public-api/watch/count", "WatchController")

@router.get("/public-api/watch/count/group-by", include_in_schema=False)
async def legacy_stub_get_public_api_watch_count_group_by_84788(request: Request):
    """Legacy stub: /public-api/watch/count/group-by (WatchController)"""
    return _not_implemented("/public-api/watch/count/group-by", "WatchController")

@router.post("/category", include_in_schema=False)
async def legacy_stub_post_category_31377(request: Request):
    """Legacy stub: /category (CategoryController)"""
    return _not_implemented("/category", "CategoryController")

@router.put("/category", include_in_schema=False)
async def legacy_stub_put_category_82948(request: Request):
    """Legacy stub: /category (CategoryController)"""
    return _not_implemented("/category", "CategoryController")

@router.post("/category/image", include_in_schema=False)
async def legacy_stub_post_category_image_97195(request: Request):
    """Legacy stub: /category/image (CategoryController)"""
    return _not_implemented("/category/image", "CategoryController")

@router.delete("/category/image", include_in_schema=False)
async def legacy_stub_delete_category_image_35743(request: Request):
    """Legacy stub: /category/image (CategoryController)"""
    return _not_implemented("/category/image", "CategoryController")

@router.put("/category/is-show", include_in_schema=False)
async def legacy_stub_put_category_is_show_69268(request: Request):
    """Legacy stub: /category/is-show (CategoryController)"""
    return _not_implemented("/category/is-show", "CategoryController")

@router.put("/category/is-show-index", include_in_schema=False)
async def legacy_stub_put_category_is_show_index_37314(request: Request):
    """Legacy stub: /category/is-show-index (CategoryController)"""
    return _not_implemented("/category/is-show-index", "CategoryController")

@router.post("/auth-api/circle", include_in_schema=False)
async def legacy_stub_post_auth_api_circle_30984(request: Request):
    """Legacy stub: /auth-api/circle (CircleController)"""
    return _not_implemented("/auth-api/circle", "CircleController")

@router.put("/auth-api/circle", include_in_schema=False)
async def legacy_stub_put_auth_api_circle_40727(request: Request):
    """Legacy stub: /auth-api/circle (CircleController)"""
    return _not_implemented("/auth-api/circle", "CircleController")

@router.delete("/auth-api/circle", include_in_schema=False)
async def legacy_stub_delete_auth_api_circle_67536(request: Request):
    """Legacy stub: /auth-api/circle (CircleController)"""
    return _not_implemented("/auth-api/circle", "CircleController")

@router.get("/public-api/circle/list/by-ids", include_in_schema=False)
async def legacy_stub_get_public_api_circle_list_by_ids_35309(request: Request):
    """Legacy stub: /public-api/circle/list/by-ids (CircleController)"""
    return _not_implemented("/public-api/circle/list/by-ids", "CircleController")

@router.get("/public-api/circle", include_in_schema=False)
async def legacy_stub_get_public_api_circle_20220(request: Request):
    """Legacy stub: /public-api/circle (CircleController)"""
    return _not_implemented("/public-api/circle", "CircleController")

@router.get("/public-api/circle/member/count", include_in_schema=False)
async def legacy_stub_get_public_api_circle_member_count_21353(request: Request):
    """Legacy stub: /public-api/circle/member/count (CircleController)"""
    return _not_implemented("/public-api/circle/member/count", "CircleController")

@router.post("/auth-api/member", include_in_schema=False)
async def legacy_stub_post_auth_api_member_16958(request: Request):
    """Legacy stub: /auth-api/member (CircleMemberController)"""
    return _not_implemented("/auth-api/member", "CircleMemberController")

@router.delete("/auth-api/member", include_in_schema=False)
async def legacy_stub_delete_auth_api_member_56707(request: Request):
    """Legacy stub: /auth-api/member (CircleMemberController)"""
    return _not_implemented("/auth-api/member", "CircleMemberController")

@router.get("/public-api/member", include_in_schema=False)
async def legacy_stub_get_public_api_member_7139(request: Request):
    """Legacy stub: /public-api/member (CircleMemberController)"""
    return _not_implemented("/public-api/member", "CircleMemberController")

@router.get("/public-api/member/count", include_in_schema=False)
async def legacy_stub_get_public_api_member_count_44711(request: Request):
    """Legacy stub: /public-api/member/count (CircleMemberController)"""
    return _not_implemented("/public-api/member/count", "CircleMemberController")

@router.post("/auth-api/dynamic", include_in_schema=False)
async def legacy_stub_post_auth_api_dynamic_13393(request: Request):
    """Legacy stub: /auth-api/dynamic (DynamicController)"""
    return _not_implemented("/auth-api/dynamic", "DynamicController")

@router.put("/auth-api/dynamic", include_in_schema=False)
async def legacy_stub_put_auth_api_dynamic_19413(request: Request):
    """Legacy stub: /auth-api/dynamic (DynamicController)"""
    return _not_implemented("/auth-api/dynamic", "DynamicController")

@router.delete("/dynamic", include_in_schema=False)
async def legacy_stub_delete_dynamic_26936(request: Request):
    """Legacy stub: /dynamic (DynamicController)"""
    return _not_implemented("/dynamic", "DynamicController")

@router.delete("/auth-api/dynamic", include_in_schema=False)
async def legacy_stub_delete_auth_api_dynamic_87854(request: Request):
    """Legacy stub: /auth-api/dynamic (DynamicController)"""
    return _not_implemented("/auth-api/dynamic", "DynamicController")

@router.get("/public-api/dynamic/list/by-ids", include_in_schema=False)
async def legacy_stub_get_public_api_dynamic_list_by_ids_18123(request: Request):
    """Legacy stub: /public-api/dynamic/list/by-ids (DynamicController)"""
    return _not_implemented("/public-api/dynamic/list/by-ids", "DynamicController")

@router.get("/public-api/dynamic", include_in_schema=False)
async def legacy_stub_get_public_api_dynamic_16488(request: Request):
    """Legacy stub: /public-api/dynamic (DynamicController)"""
    return _not_implemented("/public-api/dynamic", "DynamicController")

@router.get("/public-api/dynamic/count", include_in_schema=False)
async def legacy_stub_get_public_api_dynamic_count_39452(request: Request):
    """Legacy stub: /public-api/dynamic/count (DynamicController)"""
    return _not_implemented("/public-api/dynamic/count", "DynamicController")

@router.get("/statistics", include_in_schema=False)
async def legacy_stub_get_statistics_75798(request: Request):
    """Legacy stub: /statistics (CircleStatisticsController)"""
    return _not_implemented("/statistics", "CircleStatisticsController")

@router.post("/auth-api/article", include_in_schema=False)
async def legacy_stub_post_auth_api_article_18962(request: Request):
    """Legacy stub: /auth-api/article (ArticleController)"""
    return _not_implemented("/auth-api/article", "ArticleController")

@router.put("/auth-api/article", include_in_schema=False)
async def legacy_stub_put_auth_api_article_52024(request: Request):
    """Legacy stub: /auth-api/article (ArticleController)"""
    return _not_implemented("/auth-api/article", "ArticleController")

@router.delete("/auth-api/article", include_in_schema=False)
async def legacy_stub_delete_auth_api_article_33804(request: Request):
    """Legacy stub: /auth-api/article (ArticleController)"""
    return _not_implemented("/auth-api/article", "ArticleController")

@router.get("/public-api/article/list/by-ids", include_in_schema=False)
async def legacy_stub_get_public_api_article_list_by_ids_61408(request: Request):
    """Legacy stub: /public-api/article/list/by-ids (ArticleController)"""
    return _not_implemented("/public-api/article/list/by-ids", "ArticleController")

@router.get("/public-api/article", include_in_schema=False)
async def legacy_stub_get_public_api_article_15511(request: Request):
    """Legacy stub: /public-api/article (ArticleController)"""
    return _not_implemented("/public-api/article", "ArticleController")

@router.post("/article/recommend", include_in_schema=False)
async def legacy_stub_post_article_recommend_65449(request: Request):
    """Legacy stub: /article/recommend (ArticleController)"""
    return _not_implemented("/article/recommend", "ArticleController")

@router.delete("/article/recommend", include_in_schema=False)
async def legacy_stub_delete_article_recommend_27216(request: Request):
    """Legacy stub: /article/recommend (ArticleController)"""
    return _not_implemented("/article/recommend", "ArticleController")

@router.post("/article/top", include_in_schema=False)
async def legacy_stub_post_article_top_40018(request: Request):
    """Legacy stub: /article/top (ArticleController)"""
    return _not_implemented("/article/top", "ArticleController")

@router.delete("/article/top", include_in_schema=False)
async def legacy_stub_delete_article_top_26114(request: Request):
    """Legacy stub: /article/top (ArticleController)"""
    return _not_implemented("/article/top", "ArticleController")

@router.get("/public-api/article/member/count", include_in_schema=False)
async def legacy_stub_get_public_api_article_member_count_99843(request: Request):
    """Legacy stub: /public-api/article/member/count (ArticleController)"""
    return _not_implemented("/public-api/article/member/count", "ArticleController")

@router.post("/category", include_in_schema=False)
async def legacy_stub_post_category_31377(request: Request):
    """Legacy stub: /category (CategoryController)"""
    return _not_implemented("/category", "CategoryController")

@router.put("/category", include_in_schema=False)
async def legacy_stub_put_category_82948(request: Request):
    """Legacy stub: /category (CategoryController)"""
    return _not_implemented("/category", "CategoryController")

@router.post("/category/image", include_in_schema=False)
async def legacy_stub_post_category_image_97195(request: Request):
    """Legacy stub: /category/image (CategoryController)"""
    return _not_implemented("/category/image", "CategoryController")

@router.delete("/category/image", include_in_schema=False)
async def legacy_stub_delete_category_image_35743(request: Request):
    """Legacy stub: /category/image (CategoryController)"""
    return _not_implemented("/category/image", "CategoryController")

@router.put("/category/is-show", include_in_schema=False)
async def legacy_stub_put_category_is_show_69268(request: Request):
    """Legacy stub: /category/is-show (CategoryController)"""
    return _not_implemented("/category/is-show", "CategoryController")

@router.put("/category/is-show-index", include_in_schema=False)
async def legacy_stub_put_category_is_show_index_37314(request: Request):
    """Legacy stub: /category/is-show-index (CategoryController)"""
    return _not_implemented("/category/is-show-index", "CategoryController")

@router.post("/news", include_in_schema=False)
async def legacy_stub_post_news_53537(request: Request):
    """Legacy stub: /news (NewsController)"""
    return _not_implemented("/news", "NewsController")

@router.put("/news", include_in_schema=False)
async def legacy_stub_put_news_3452(request: Request):
    """Legacy stub: /news (NewsController)"""
    return _not_implemented("/news", "NewsController")

@router.delete("/news", include_in_schema=False)
async def legacy_stub_delete_news_24672(request: Request):
    """Legacy stub: /news (NewsController)"""
    return _not_implemented("/news", "NewsController")

@router.get("/public-api/news/list/by-ids", include_in_schema=False)
async def legacy_stub_get_public_api_news_list_by_ids_38664(request: Request):
    """Legacy stub: /public-api/news/list/by-ids (NewsController)"""
    return _not_implemented("/public-api/news/list/by-ids", "NewsController")

@router.post("/news/recommend", include_in_schema=False)
async def legacy_stub_post_news_recommend_36688(request: Request):
    """Legacy stub: /news/recommend (NewsController)"""
    return _not_implemented("/news/recommend", "NewsController")

@router.delete("/news/recommend", include_in_schema=False)
async def legacy_stub_delete_news_recommend_59211(request: Request):
    """Legacy stub: /news/recommend (NewsController)"""
    return _not_implemented("/news/recommend", "NewsController")

@router.post("/news/top", include_in_schema=False)
async def legacy_stub_post_news_top_97463(request: Request):
    """Legacy stub: /news/top (NewsController)"""
    return _not_implemented("/news/top", "NewsController")

@router.delete("/news/top", include_in_schema=False)
async def legacy_stub_delete_news_top_92827(request: Request):
    """Legacy stub: /news/top (NewsController)"""
    return _not_implemented("/news/top", "NewsController")

@router.get("/statistics", include_in_schema=False)
async def legacy_stub_get_statistics_75798(request: Request):
    """Legacy stub: /statistics (ContentStatisticsController)"""
    return _not_implemented("/statistics", "ContentStatisticsController")

@router.post("/category", include_in_schema=False)
async def legacy_stub_post_category_31377(request: Request):
    """Legacy stub: /category (CategoryController)"""
    return _not_implemented("/category", "CategoryController")

@router.put("/category", include_in_schema=False)
async def legacy_stub_put_category_82948(request: Request):
    """Legacy stub: /category (CategoryController)"""
    return _not_implemented("/category", "CategoryController")

@router.post("/category/image", include_in_schema=False)
async def legacy_stub_post_category_image_97195(request: Request):
    """Legacy stub: /category/image (CategoryController)"""
    return _not_implemented("/category/image", "CategoryController")

@router.delete("/category/image", include_in_schema=False)
async def legacy_stub_delete_category_image_35743(request: Request):
    """Legacy stub: /category/image (CategoryController)"""
    return _not_implemented("/category/image", "CategoryController")

@router.put("/category/is-show", include_in_schema=False)
async def legacy_stub_put_category_is_show_69268(request: Request):
    """Legacy stub: /category/is-show (CategoryController)"""
    return _not_implemented("/category/is-show", "CategoryController")

@router.put("/category/is-show-index", include_in_schema=False)
async def legacy_stub_put_category_is_show_index_37314(request: Request):
    """Legacy stub: /category/is-show-index (CategoryController)"""
    return _not_implemented("/category/is-show-index", "CategoryController")

@router.post("/exam/chapter", include_in_schema=False)
async def legacy_stub_post_exam_chapter_40794(request: Request):
    """Legacy stub: /exam/chapter (ExamChapterController)"""
    return _not_implemented("/exam/chapter", "ExamChapterController")

@router.put("/exam/chapter", include_in_schema=False)
async def legacy_stub_put_exam_chapter_41866(request: Request):
    """Legacy stub: /exam/chapter (ExamChapterController)"""
    return _not_implemented("/exam/chapter", "ExamChapterController")

@router.delete("/exam/chapter", include_in_schema=False)
async def legacy_stub_delete_exam_chapter_17841(request: Request):
    """Legacy stub: /exam/chapter (ExamChapterController)"""
    return _not_implemented("/exam/chapter", "ExamChapterController")

@router.put("/exam/chapter/sort-order", include_in_schema=False)
async def legacy_stub_put_exam_chapter_sort_order_93537(request: Request):
    """Legacy stub: /exam/chapter/sort-order (ExamChapterController)"""
    return _not_implemented("/exam/chapter/sort-order", "ExamChapterController")

@router.post("/exam/chapter-section", include_in_schema=False)
async def legacy_stub_post_exam_chapter_section_37868(request: Request):
    """Legacy stub: /exam/chapter-section (ExamChapterSectionController)"""
    return _not_implemented("/exam/chapter-section", "ExamChapterSectionController")

@router.put("/exam/chapter-section", include_in_schema=False)
async def legacy_stub_put_exam_chapter_section_32993(request: Request):
    """Legacy stub: /exam/chapter-section (ExamChapterSectionController)"""
    return _not_implemented("/exam/chapter-section", "ExamChapterSectionController")

@router.delete("/exam/chapter-section", include_in_schema=False)
async def legacy_stub_delete_exam_chapter_section_26900(request: Request):
    """Legacy stub: /exam/chapter-section (ExamChapterSectionController)"""
    return _not_implemented("/exam/chapter-section", "ExamChapterSectionController")

@router.post("/exam", include_in_schema=False)
async def legacy_stub_post_exam_25847(request: Request):
    """Legacy stub: /exam (ExamController)"""
    return _not_implemented("/exam", "ExamController")

@router.put("/exam", include_in_schema=False)
async def legacy_stub_put_exam_74331(request: Request):
    """Legacy stub: /exam (ExamController)"""
    return _not_implemented("/exam", "ExamController")

@router.get("/exam", include_in_schema=False)
async def legacy_stub_get_exam_28317(request: Request):
    """Legacy stub: /exam (ExamController)"""
    return _not_implemented("/exam", "ExamController")

@router.get("/public-api/exam", include_in_schema=False)
async def legacy_stub_get_public_api_exam_47814(request: Request):
    """Legacy stub: /public-api/exam (ExamController)"""
    return _not_implemented("/public-api/exam", "ExamController")

@router.delete("/exam", include_in_schema=False)
async def legacy_stub_delete_exam_77548(request: Request):
    """Legacy stub: /exam (ExamController)"""
    return _not_implemented("/exam", "ExamController")

@router.put("/exam/publish", include_in_schema=False)
async def legacy_stub_put_exam_publish_21978(request: Request):
    """Legacy stub: /exam/publish (ExamController)"""
    return _not_implemented("/exam/publish", "ExamController")

@router.put("/exam/un-publish", include_in_schema=False)
async def legacy_stub_put_exam_un_publish_60850(request: Request):
    """Legacy stub: /exam/un-publish (ExamController)"""
    return _not_implemented("/exam/un-publish", "ExamController")

@router.get("/public-api/recommend", include_in_schema=False)
async def legacy_stub_get_public_api_recommend_59360(request: Request):
    """Legacy stub: /public-api/recommend (ExamController)"""
    return _not_implemented("/public-api/recommend", "ExamController")

@router.get("/public-api/hot", include_in_schema=False)
async def legacy_stub_get_public_api_hot_94306(request: Request):
    """Legacy stub: /public-api/hot (ExamController)"""
    return _not_implemented("/public-api/hot", "ExamController")

@router.get("/public-api/list/by-ids", include_in_schema=False)
async def legacy_stub_get_public_api_list_by_ids_49673(request: Request):
    """Legacy stub: /public-api/list/by-ids (ExamController)"""
    return _not_implemented("/public-api/list/by-ids", "ExamController")

@router.post("/paper/category", include_in_schema=False)
async def legacy_stub_post_paper_category_87592(request: Request):
    """Legacy stub: /paper/category (PaperCategoryController)"""
    return _not_implemented("/paper/category", "PaperCategoryController")

@router.put("/paper/category", include_in_schema=False)
async def legacy_stub_put_paper_category_517(request: Request):
    """Legacy stub: /paper/category (PaperCategoryController)"""
    return _not_implemented("/paper/category", "PaperCategoryController")

@router.put("/paper/category/is-show", include_in_schema=False)
async def legacy_stub_put_paper_category_is_show_20012(request: Request):
    """Legacy stub: /paper/category/is-show (PaperCategoryController)"""
    return _not_implemented("/paper/category/is-show", "PaperCategoryController")

@router.put("/paper/category/is-show-index", include_in_schema=False)
async def legacy_stub_put_paper_category_is_show_index_3437(request: Request):
    """Legacy stub: /paper/category/is-show-index (PaperCategoryController)"""
    return _not_implemented("/paper/category/is-show-index", "PaperCategoryController")

@router.get("/paper", include_in_schema=False)
async def legacy_stub_get_paper_76640(request: Request):
    """Legacy stub: /paper (PaperController)"""
    return _not_implemented("/paper", "PaperController")

@router.get("/auth-api/paper", include_in_schema=False)
async def legacy_stub_get_auth_api_paper_25451(request: Request):
    """Legacy stub: /auth-api/paper (PaperController)"""
    return _not_implemented("/auth-api/paper", "PaperController")

@router.put("/paper", include_in_schema=False)
async def legacy_stub_put_paper_90024(request: Request):
    """Legacy stub: /paper (PaperController)"""
    return _not_implemented("/paper", "PaperController")

@router.delete("/paper", include_in_schema=False)
async def legacy_stub_delete_paper_90725(request: Request):
    """Legacy stub: /paper (PaperController)"""
    return _not_implemented("/paper", "PaperController")

@router.put("/paper/publish", include_in_schema=False)
async def legacy_stub_put_paper_publish_41970(request: Request):
    """Legacy stub: /paper/publish (PaperController)"""
    return _not_implemented("/paper/publish", "PaperController")

@router.put("/paper/un-publish", include_in_schema=False)
async def legacy_stub_put_paper_un_publish_96472(request: Request):
    """Legacy stub: /paper/un-publish (PaperController)"""
    return _not_implemented("/paper/un-publish", "PaperController")

@router.get("/paper/question/by-paper-id", include_in_schema=False)
async def legacy_stub_get_paper_question_by_paper_id_26340(request: Request):
    """Legacy stub: /paper/question/by-paper-id (PaperQuestionController)"""
    return _not_implemented("/paper/question/by-paper-id", "PaperQuestionController")

@router.post("/question-lib/category", include_in_schema=False)
async def legacy_stub_post_question_lib_category_15797(request: Request):
    """Legacy stub: /question-lib/category (QuestionCategoryController)"""
    return _not_implemented("/question-lib/category", "QuestionCategoryController")

@router.put("/question-lib/category", include_in_schema=False)
async def legacy_stub_put_question_lib_category_75123(request: Request):
    """Legacy stub: /question-lib/category (QuestionCategoryController)"""
    return _not_implemented("/question-lib/category", "QuestionCategoryController")

@router.put("/question-lib/category/is-show", include_in_schema=False)
async def legacy_stub_put_question_lib_category_is_show_92613(request: Request):
    """Legacy stub: /question-lib/category/is-show (QuestionCategoryController)"""
    return _not_implemented("/question-lib/category/is-show", "QuestionCategoryController")

@router.put("/question-lib/category/is-show-index", include_in_schema=False)
async def legacy_stub_put_question_lib_category_is_show_index_11701(request: Request):
    """Legacy stub: /question-lib/category/is-show-index (QuestionCategoryController)"""
    return _not_implemented("/question-lib/category/is-show-index", "QuestionCategoryController")

@router.put("/question-lib/question", include_in_schema=False)
async def legacy_stub_put_question_lib_question_12605(request: Request):
    """Legacy stub: /question-lib/question (QuestionController)"""
    return _not_implemented("/question-lib/question", "QuestionController")

@router.delete("/question-lib/question", include_in_schema=False)
async def legacy_stub_delete_question_lib_question_46455(request: Request):
    """Legacy stub: /question-lib/question (QuestionController)"""
    return _not_implemented("/question-lib/question", "QuestionController")

@router.get("/question-lib/question", include_in_schema=False)
async def legacy_stub_get_question_lib_question_27318(request: Request):
    """Legacy stub: /question-lib/question (QuestionController)"""
    return _not_implemented("/question-lib/question", "QuestionController")

@router.post("/auth-api/record", include_in_schema=False)
async def legacy_stub_post_auth_api_record_90047(request: Request):
    """Legacy stub: /auth-api/record (RecordController)"""
    return _not_implemented("/auth-api/record", "RecordController")

@router.put("/auth-api/record", include_in_schema=False)
async def legacy_stub_put_auth_api_record_47875(request: Request):
    """Legacy stub: /auth-api/record (RecordController)"""
    return _not_implemented("/auth-api/record", "RecordController")

@router.put("/auth-api/record/submit", include_in_schema=False)
async def legacy_stub_put_auth_api_record_submit_49435(request: Request):
    """Legacy stub: /auth-api/record/submit (RecordController)"""
    return _not_implemented("/auth-api/record/submit", "RecordController")

@router.get("/auth-api/record", include_in_schema=False)
async def legacy_stub_get_auth_api_record_54024(request: Request):
    """Legacy stub: /auth-api/record (RecordController)"""
    return _not_implemented("/auth-api/record", "RecordController")

@router.put("/record/manual/mark/paper", include_in_schema=False)
async def legacy_stub_put_record_manual_mark_paper_6574(request: Request):
    """Legacy stub: /record/manual/mark/paper (RecordController)"""
    return _not_implemented("/record/manual/mark/paper", "RecordController")

@router.get("/auth-api/record/check-submitted", include_in_schema=False)
async def legacy_stub_get_auth_api_record_check_submitted_71887(request: Request):
    """Legacy stub: /auth-api/record/check-submitted (RecordController)"""
    return _not_implemented("/auth-api/record/check-submitted", "RecordController")

@router.post("/auth-api/sign-up", include_in_schema=False)
async def legacy_stub_post_auth_api_sign_up_38003(request: Request):
    """Legacy stub: /auth-api/sign-up (SignUpController)"""
    return _not_implemented("/auth-api/sign-up", "SignUpController")

@router.delete("/auth-api/sign-up", include_in_schema=False)
async def legacy_stub_delete_auth_api_sign_up_61875(request: Request):
    """Legacy stub: /auth-api/sign-up (SignUpController)"""
    return _not_implemented("/auth-api/sign-up", "SignUpController")

@router.get("/public-api/sign-up", include_in_schema=False)
async def legacy_stub_get_public_api_sign_up_45976(request: Request):
    """Legacy stub: /public-api/sign-up (SignUpController)"""
    return _not_implemented("/public-api/sign-up", "SignUpController")

@router.get("/statistics", include_in_schema=False)
async def legacy_stub_get_statistics_75798(request: Request):
    """Legacy stub: /statistics (ExamStatisticsController)"""
    return _not_implemented("/statistics", "ExamStatisticsController")

@router.post("/auth-api/wrong-question", include_in_schema=False)
async def legacy_stub_post_auth_api_wrong_question_70278(request: Request):
    """Legacy stub: /auth-api/wrong-question (WrongQuestionController)"""
    return _not_implemented("/auth-api/wrong-question", "WrongQuestionController")

@router.delete("/auth-api/wrong-question", include_in_schema=False)
async def legacy_stub_delete_auth_api_wrong_question_21247(request: Request):
    """Legacy stub: /auth-api/wrong-question (WrongQuestionController)"""
    return _not_implemented("/auth-api/wrong-question", "WrongQuestionController")

@router.put("/lesson/access", include_in_schema=False)
async def legacy_stub_put_lesson_access_9936(request: Request):
    """Legacy stub: /lesson/access (LessonAccessController)"""
    return _not_implemented("/lesson/access", "LessonAccessController")

@router.post("/category", include_in_schema=False)
async def legacy_stub_post_category_31377(request: Request):
    """Legacy stub: /category (CategoryController)"""
    return _not_implemented("/category", "CategoryController")

@router.put("/category", include_in_schema=False)
async def legacy_stub_put_category_82948(request: Request):
    """Legacy stub: /category (CategoryController)"""
    return _not_implemented("/category", "CategoryController")

@router.put("/category/is-show", include_in_schema=False)
async def legacy_stub_put_category_is_show_69268(request: Request):
    """Legacy stub: /category/is-show (CategoryController)"""
    return _not_implemented("/category/is-show", "CategoryController")

@router.put("/category/is-show-index", include_in_schema=False)
async def legacy_stub_put_category_is_show_index_37314(request: Request):
    """Legacy stub: /category/is-show-index (CategoryController)"""
    return _not_implemented("/category/is-show-index", "CategoryController")

@router.post("/certificate", include_in_schema=False)
async def legacy_stub_post_certificate_13202(request: Request):
    """Legacy stub: /certificate (CertificateController)"""
    return _not_implemented("/certificate", "CertificateController")

@router.get("/certificate", include_in_schema=False)
async def legacy_stub_get_certificate_38121(request: Request):
    """Legacy stub: /certificate (CertificateController)"""
    return _not_implemented("/certificate", "CertificateController")

@router.delete("/certificate", include_in_schema=False)
async def legacy_stub_delete_certificate_32654(request: Request):
    """Legacy stub: /certificate (CertificateController)"""
    return _not_implemented("/certificate", "CertificateController")

@router.put("/certificate/valid", include_in_schema=False)
async def legacy_stub_put_certificate_valid_52521(request: Request):
    """Legacy stub: /certificate/valid (CertificateController)"""
    return _not_implemented("/certificate/valid", "CertificateController")

@router.put("/certificate/suspended", include_in_schema=False)
async def legacy_stub_put_certificate_suspended_59812(request: Request):
    """Legacy stub: /certificate/suspended (CertificateController)"""
    return _not_implemented("/certificate/suspended", "CertificateController")

@router.put("/certificate/revoked", include_in_schema=False)
async def legacy_stub_put_certificate_revoked_14551(request: Request):
    """Legacy stub: /certificate/revoked (CertificateController)"""
    return _not_implemented("/certificate/revoked", "CertificateController")

@router.put("/certificate/cancelled", include_in_schema=False)
async def legacy_stub_put_certificate_cancelled_15646(request: Request):
    """Legacy stub: /certificate/cancelled (CertificateController)"""
    return _not_implemented("/certificate/cancelled", "CertificateController")

@router.put("/certificate/expired", include_in_schema=False)
async def legacy_stub_put_certificate_expired_79667(request: Request):
    """Legacy stub: /certificate/expired (CertificateController)"""
    return _not_implemented("/certificate/expired", "CertificateController")

@router.get("/auth-api/certificate", include_in_schema=False)
async def legacy_stub_get_auth_api_certificate_93987(request: Request):
    """Legacy stub: /auth-api/certificate (CertificateController)"""
    return _not_implemented("/auth-api/certificate", "CertificateController")

@router.get("/auth-api/certificate/byLessonId", include_in_schema=False)
async def legacy_stub_get_auth_api_certificate_byLessonId_51152(request: Request):
    """Legacy stub: /auth-api/certificate/byLessonId (CertificateController)"""
    return _not_implemented("/auth-api/certificate/byLessonId", "CertificateController")

@router.post("/certificate-template", include_in_schema=False)
async def legacy_stub_post_certificate_template_69042(request: Request):
    """Legacy stub: /certificate-template (CertificateTemplateController)"""
    return _not_implemented("/certificate-template", "CertificateTemplateController")

@router.put("/certificate-template", include_in_schema=False)
async def legacy_stub_put_certificate_template_77205(request: Request):
    """Legacy stub: /certificate-template (CertificateTemplateController)"""
    return _not_implemented("/certificate-template", "CertificateTemplateController")

@router.get("/certificate-template", include_in_schema=False)
async def legacy_stub_get_certificate_template_42308(request: Request):
    """Legacy stub: /certificate-template (CertificateTemplateController)"""
    return _not_implemented("/certificate-template", "CertificateTemplateController")

@router.delete("/certificate-template", include_in_schema=False)
async def legacy_stub_delete_certificate_template_19343(request: Request):
    """Legacy stub: /certificate-template (CertificateTemplateController)"""
    return _not_implemented("/certificate-template", "CertificateTemplateController")

@router.put("/certificate-template/active", include_in_schema=False)
async def legacy_stub_put_certificate_template_active_75436(request: Request):
    """Legacy stub: /certificate-template/active (CertificateTemplateController)"""
    return _not_implemented("/certificate-template/active", "CertificateTemplateController")

@router.put("/certificate-template/inactive", include_in_schema=False)
async def legacy_stub_put_certificate_template_inactive_32216(request: Request):
    """Legacy stub: /certificate-template/inactive (CertificateTemplateController)"""
    return _not_implemented("/certificate-template/inactive", "CertificateTemplateController")

@router.get("/auth-api/certificate-template", include_in_schema=False)
async def legacy_stub_get_auth_api_certificate_template_88357(request: Request):
    """Legacy stub: /auth-api/certificate-template (CertificateTemplateController)"""
    return _not_implemented("/auth-api/certificate-template", "CertificateTemplateController")

@router.post("/auth-api/exampaper/record", include_in_schema=False)
async def legacy_stub_post_auth_api_exampaper_record_41793(request: Request):
    """Legacy stub: /auth-api/exampaper/record (ExamPaperRecordController)"""
    return _not_implemented("/auth-api/exampaper/record", "ExamPaperRecordController")

@router.put("/auth-api/exampaper/record", include_in_schema=False)
async def legacy_stub_put_auth_api_exampaper_record_15162(request: Request):
    """Legacy stub: /auth-api/exampaper/record (ExamPaperRecordController)"""
    return _not_implemented("/auth-api/exampaper/record", "ExamPaperRecordController")

@router.put("/auth-api/exampaper/record/submit", include_in_schema=False)
async def legacy_stub_put_auth_api_exampaper_record_submit_43902(request: Request):
    """Legacy stub: /auth-api/exampaper/record/submit (ExamPaperRecordController)"""
    return _not_implemented("/auth-api/exampaper/record/submit", "ExamPaperRecordController")

@router.get("/auth-api/exampaper/record", include_in_schema=False)
async def legacy_stub_get_auth_api_exampaper_record_54989(request: Request):
    """Legacy stub: /auth-api/exampaper/record (ExamPaperRecordController)"""
    return _not_implemented("/auth-api/exampaper/record", "ExamPaperRecordController")

@router.get("/auth-api/exampaper/record/draft", include_in_schema=False)
async def legacy_stub_get_auth_api_exampaper_record_draft_13521(request: Request):
    """Legacy stub: /auth-api/exampaper/record/draft (ExamPaperRecordController)"""
    return _not_implemented("/auth-api/exampaper/record/draft", "ExamPaperRecordController")

@router.put("/exampaper/record/manual/mark/paper", include_in_schema=False)
async def legacy_stub_put_exampaper_record_manual_mark_paper_95937(request: Request):
    """Legacy stub: /exampaper/record/manual/mark/paper (ExamPaperRecordController)"""
    return _not_implemented("/exampaper/record/manual/mark/paper", "ExamPaperRecordController")

@router.get("/auth-api/exampaper/record/check-submitted", include_in_schema=False)
async def legacy_stub_get_auth_api_exampaper_record_check_submitte_15667(request: Request):
    """Legacy stub: /auth-api/exampaper/record/check-submitted (ExamPaperRecordController)"""
    return _not_implemented("/auth-api/exampaper/record/check-submitted", "ExamPaperRecordController")

@router.post("/lesson/homework", include_in_schema=False)
async def legacy_stub_post_lesson_homework_88934(request: Request):
    """Legacy stub: /lesson/homework (HomeworkController)"""
    return _not_implemented("/lesson/homework", "HomeworkController")

@router.put("/lesson/homework", include_in_schema=False)
async def legacy_stub_put_lesson_homework_53135(request: Request):
    """Legacy stub: /lesson/homework (HomeworkController)"""
    return _not_implemented("/lesson/homework", "HomeworkController")

@router.get("/lesson/homework", include_in_schema=False)
async def legacy_stub_get_lesson_homework_78801(request: Request):
    """Legacy stub: /lesson/homework (HomeworkController)"""
    return _not_implemented("/lesson/homework", "HomeworkController")

@router.post("/auth-api/homework/record", include_in_schema=False)
async def legacy_stub_post_auth_api_homework_record_22374(request: Request):
    """Legacy stub: auth-api/homework/record (HomeworkRecordController)"""
    return _not_implemented("auth-api/homework/record", "HomeworkRecordController")

@router.put("/auth-api/homework/record", include_in_schema=False)
async def legacy_stub_put_auth_api_homework_record_80845(request: Request):
    """Legacy stub: auth-api/homework/record (HomeworkRecordController)"""
    return _not_implemented("auth-api/homework/record", "HomeworkRecordController")

@router.put("/homework/record/approval/pass", include_in_schema=False)
async def legacy_stub_put_homework_record_approval_pass_91745(request: Request):
    """Legacy stub: homework/record/approval/pass (HomeworkRecordController)"""
    return _not_implemented("homework/record/approval/pass", "HomeworkRecordController")

@router.put("/homework/record/approval/reject", include_in_schema=False)
async def legacy_stub_put_homework_record_approval_reject_17355(request: Request):
    """Legacy stub: homework/record/approval/reject (HomeworkRecordController)"""
    return _not_implemented("homework/record/approval/reject", "HomeworkRecordController")

@router.get("/auth-api/homework/record", include_in_schema=False)
async def legacy_stub_get_auth_api_homework_record_9752(request: Request):
    """Legacy stub: auth-api/homework/record (HomeworkRecordController)"""
    return _not_implemented("auth-api/homework/record", "HomeworkRecordController")

@router.post("/learn-map", include_in_schema=False)
async def legacy_stub_post_learn_map_32149(request: Request):
    """Legacy stub: /learn-map (LearnMapController)"""
    return _not_implemented("/learn-map", "LearnMapController")

@router.put("/learn-map", include_in_schema=False)
async def legacy_stub_put_learn_map_35060(request: Request):
    """Legacy stub: /learn-map (LearnMapController)"""
    return _not_implemented("/learn-map", "LearnMapController")

@router.get("/learn-map", include_in_schema=False)
async def legacy_stub_get_learn_map_42815(request: Request):
    """Legacy stub: /learn-map (LearnMapController)"""
    return _not_implemented("/learn-map", "LearnMapController")

@router.delete("/learn-map", include_in_schema=False)
async def legacy_stub_delete_learn_map_36690(request: Request):
    """Legacy stub: /learn-map (LearnMapController)"""
    return _not_implemented("/learn-map", "LearnMapController")

@router.put("/learn-map/un-publish", include_in_schema=False)
async def legacy_stub_put_learn_map_un_publish_39639(request: Request):
    """Legacy stub: /learn-map/un-publish (LearnMapController)"""
    return _not_implemented("/learn-map/un-publish", "LearnMapController")

@router.get("/public-api/learn-map/hot", include_in_schema=False)
async def legacy_stub_get_public_api_learn_map_hot_52199(request: Request):
    """Legacy stub: /public-api/learn-map/hot (LearnMapController)"""
    return _not_implemented("/public-api/learn-map/hot", "LearnMapController")

@router.get("/public-api/learn-map", include_in_schema=False)
async def legacy_stub_get_public_api_learn_map_39936(request: Request):
    """Legacy stub: /public-api/learn-map (LearnMapController)"""
    return _not_implemented("/public-api/learn-map", "LearnMapController")

@router.post("/lesson/chapter", include_in_schema=False)
async def legacy_stub_post_lesson_chapter_19884(request: Request):
    """Legacy stub: /lesson/chapter (LessonChapterController)"""
    return _not_implemented("/lesson/chapter", "LessonChapterController")

@router.put("/lesson/chapter", include_in_schema=False)
async def legacy_stub_put_lesson_chapter_99278(request: Request):
    """Legacy stub: /lesson/chapter (LessonChapterController)"""
    return _not_implemented("/lesson/chapter", "LessonChapterController")

@router.delete("/lesson/chapter", include_in_schema=False)
async def legacy_stub_delete_lesson_chapter_2423(request: Request):
    """Legacy stub: /lesson/chapter (LessonChapterController)"""
    return _not_implemented("/lesson/chapter", "LessonChapterController")

@router.put("/lesson/chapter/sort-order", include_in_schema=False)
async def legacy_stub_put_lesson_chapter_sort_order_13015(request: Request):
    """Legacy stub: /lesson/chapter/sort-order (LessonChapterController)"""
    return _not_implemented("/lesson/chapter/sort-order", "LessonChapterController")

@router.post("/lesson/chapter-section", include_in_schema=False)
async def legacy_stub_post_lesson_chapter_section_14158(request: Request):
    """Legacy stub: /lesson/chapter-section (LessonChapterSectionController)"""
    return _not_implemented("/lesson/chapter-section", "LessonChapterSectionController")

@router.put("/lesson/chapter-section", include_in_schema=False)
async def legacy_stub_put_lesson_chapter_section_25670(request: Request):
    """Legacy stub: /lesson/chapter-section (LessonChapterSectionController)"""
    return _not_implemented("/lesson/chapter-section", "LessonChapterSectionController")

@router.delete("/lesson/chapter-section", include_in_schema=False)
async def legacy_stub_delete_lesson_chapter_section_4431(request: Request):
    """Legacy stub: /lesson/chapter-section (LessonChapterSectionController)"""
    return _not_implemented("/lesson/chapter-section", "LessonChapterSectionController")

@router.post("/lesson", include_in_schema=False)
async def legacy_stub_post_lesson_6384(request: Request):
    """Legacy stub: /lesson (LessonController)"""
    return _not_implemented("/lesson", "LessonController")

@router.put("/lesson", include_in_schema=False)
async def legacy_stub_put_lesson_2557(request: Request):
    """Legacy stub: /lesson (LessonController)"""
    return _not_implemented("/lesson", "LessonController")

@router.put("/lesson/certificate", include_in_schema=False)
async def legacy_stub_put_lesson_certificate_71592(request: Request):
    """Legacy stub: /lesson/certificate (LessonController)"""
    return _not_implemented("/lesson/certificate", "LessonController")

@router.put("/lesson/exampaper", include_in_schema=False)
async def legacy_stub_put_lesson_exampaper_92043(request: Request):
    """Legacy stub: /lesson/exampaper (LessonController)"""
    return _not_implemented("/lesson/exampaper", "LessonController")

@router.get("/lesson", include_in_schema=False)
async def legacy_stub_get_lesson_50224(request: Request):
    """Legacy stub: /lesson (LessonController)"""
    return _not_implemented("/lesson", "LessonController")

@router.delete("/lesson", include_in_schema=False)
async def legacy_stub_delete_lesson_85800(request: Request):
    """Legacy stub: /lesson (LessonController)"""
    return _not_implemented("/lesson", "LessonController")

@router.put("/lesson/un-publish", include_in_schema=False)
async def legacy_stub_put_lesson_un_publish_77318(request: Request):
    """Legacy stub: /lesson/un-publish (LessonController)"""
    return _not_implemented("/lesson/un-publish", "LessonController")

@router.get("/public-api/lesson", include_in_schema=False)
async def legacy_stub_get_public_api_lesson_6824(request: Request):
    """Legacy stub: /public-api/lesson (LessonController)"""
    return _not_implemented("/public-api/lesson", "LessonController")

@router.get("/public-api/lesson/list/by-ids", include_in_schema=False)
async def legacy_stub_get_public_api_lesson_list_by_ids_10314(request: Request):
    """Legacy stub: /public-api/lesson/list/by-ids (LessonController)"""
    return _not_implemented("/public-api/lesson/list/by-ids", "LessonController")

@router.post("/auth-api/lesson/order", include_in_schema=False)
async def legacy_stub_post_auth_api_lesson_order_49304(request: Request):
    """Legacy stub: /auth-api/lesson/order (LessonOrderController)"""
    return _not_implemented("/auth-api/lesson/order", "LessonOrderController")

@router.post("/auth-api/lesson/order/payment", include_in_schema=False)
async def legacy_stub_post_auth_api_lesson_order_payment_88580(request: Request):
    """Legacy stub: /auth-api/lesson/order/payment (LessonOrderController)"""
    return _not_implemented("/auth-api/lesson/order/payment", "LessonOrderController")

@router.post("/public-api/order/payment/callback", include_in_schema=False)
async def legacy_stub_post_public_api_order_payment_callback_88698(request: Request):
    """Legacy stub: /public-api/order/payment/callback (LessonOrderController)"""
    return _not_implemented("/public-api/order/payment/callback", "LessonOrderController")

@router.post("/auth-api/lesson/rate", include_in_schema=False)
async def legacy_stub_post_auth_api_lesson_rate_58783(request: Request):
    """Legacy stub: /auth-api/lesson/rate (RateController)"""
    return _not_implemented("/auth-api/lesson/rate", "RateController")

@router.get("/lesson/rate", include_in_schema=False)
async def legacy_stub_get_lesson_rate_4026(request: Request):
    """Legacy stub: /lesson/rate (RateController)"""
    return _not_implemented("/lesson/rate", "RateController")

@router.delete("/lesson/rate", include_in_schema=False)
async def legacy_stub_delete_lesson_rate_68217(request: Request):
    """Legacy stub: /lesson/rate (RateController)"""
    return _not_implemented("/lesson/rate", "RateController")

@router.get("/auth-api/lesson/rate", include_in_schema=False)
async def legacy_stub_get_auth_api_lesson_rate_37532(request: Request):
    """Legacy stub: /auth-api/lesson/rate (RateController)"""
    return _not_implemented("/auth-api/lesson/rate", "RateController")

@router.post("/auth-api/record", include_in_schema=False)
async def legacy_stub_post_auth_api_record_90047(request: Request):
    """Legacy stub: /auth-api/record (RecordController)"""
    return _not_implemented("/auth-api/record", "RecordController")

@router.put("/auth-api/record", include_in_schema=False)
async def legacy_stub_put_auth_api_record_47875(request: Request):
    """Legacy stub: /auth-api/record (RecordController)"""
    return _not_implemented("/auth-api/record", "RecordController")

@router.get("/auth-api/record", include_in_schema=False)
async def legacy_stub_get_auth_api_record_54024(request: Request):
    """Legacy stub: /auth-api/record (RecordController)"""
    return _not_implemented("/auth-api/record", "RecordController")

@router.get("/report/lesson/sign", include_in_schema=False)
async def legacy_stub_get_report_lesson_sign_783(request: Request):
    """Legacy stub: /report/lesson/sign (ReportController)"""
    return _not_implemented("/report/lesson/sign", "ReportController")

@router.get("/report/lesson/study", include_in_schema=False)
async def legacy_stub_get_report_lesson_study_57802(request: Request):
    """Legacy stub: /report/lesson/study (ReportController)"""
    return _not_implemented("/report/lesson/study", "ReportController")

@router.get("/report/member/study", include_in_schema=False)
async def legacy_stub_get_report_member_study_39077(request: Request):
    """Legacy stub: /report/member/study (ReportController)"""
    return _not_implemented("/report/member/study", "ReportController")

@router.post("/auth-api/sign-up", include_in_schema=False)
async def legacy_stub_post_auth_api_sign_up_38003(request: Request):
    """Legacy stub: /auth-api/sign-up (SignUpController)"""
    return _not_implemented("/auth-api/sign-up", "SignUpController")

@router.post("/auth-api/sign-up/batch", include_in_schema=False)
async def legacy_stub_post_auth_api_sign_up_batch_30406(request: Request):
    """Legacy stub: /auth-api/sign-up/batch (SignUpController)"""
    return _not_implemented("/auth-api/sign-up/batch", "SignUpController")

@router.post("/public-api/sign-up", include_in_schema=False)
async def legacy_stub_post_public_api_sign_up_15505(request: Request):
    """Legacy stub: /public-api/sign-up (SignUpController)"""
    return _not_implemented("/public-api/sign-up", "SignUpController")

@router.delete("/auth-api/sign-up", include_in_schema=False)
async def legacy_stub_delete_auth_api_sign_up_61875(request: Request):
    """Legacy stub: /auth-api/sign-up (SignUpController)"""
    return _not_implemented("/auth-api/sign-up", "SignUpController")

@router.get("/public-api/sign-up", include_in_schema=False)
async def legacy_stub_get_public_api_sign_up_45976(request: Request):
    """Legacy stub: /public-api/sign-up (SignUpController)"""
    return _not_implemented("/public-api/sign-up", "SignUpController")

@router.get("/auth-api/sign-up/total-learn-time", include_in_schema=False)
async def legacy_stub_get_auth_api_sign_up_total_learn_time_28605(request: Request):
    """Legacy stub: /auth-api/sign-up/total-learn-time (SignUpController)"""
    return _not_implemented("/auth-api/sign-up/total-learn-time", "SignUpController")

@router.get("/auth-api/sign-up/today-learn-time", include_in_schema=False)
async def legacy_stub_get_auth_api_sign_up_today_learn_time_41328(request: Request):
    """Legacy stub: /auth-api/sign-up/today-learn-time (SignUpController)"""
    return _not_implemented("/auth-api/sign-up/today-learn-time", "SignUpController")

@router.get("/auth-api/sign-up/learn-time-rank-percent", include_in_schema=False)
async def legacy_stub_get_auth_api_sign_up_learn_time_rank_percent_71547(request: Request):
    """Legacy stub: /auth-api/sign-up/learn-time-rank-percent (SignUpController)"""
    return _not_implemented("/auth-api/sign-up/learn-time-rank-percent", "SignUpController")

@router.get("/sign-up/checkAndUpdateStatus", include_in_schema=False)
async def legacy_stub_get_sign_up_checkAndUpdateStatus_64487(request: Request):
    """Legacy stub: /sign-up/checkAndUpdateStatus (SignUpController)"""
    return _not_implemented("/sign-up/checkAndUpdateStatus", "SignUpController")

@router.post("/lesson/task", include_in_schema=False)
async def legacy_stub_post_lesson_task_24059(request: Request):
    """Legacy stub: /lesson/task (LessonTaskController)"""
    return _not_implemented("/lesson/task", "LessonTaskController")

@router.put("/lesson/task", include_in_schema=False)
async def legacy_stub_put_lesson_task_78653(request: Request):
    """Legacy stub: /lesson/task (LessonTaskController)"""
    return _not_implemented("/lesson/task", "LessonTaskController")

@router.delete("/lesson/task", include_in_schema=False)
async def legacy_stub_delete_lesson_task_80689(request: Request):
    """Legacy stub: /lesson/task (LessonTaskController)"""
    return _not_implemented("/lesson/task", "LessonTaskController")

@router.get("/lesson/task", include_in_schema=False)
async def legacy_stub_get_lesson_task_86002(request: Request):
    """Legacy stub: /lesson/task (LessonTaskController)"""
    return _not_implemented("/lesson/task", "LessonTaskController")

@router.get("/auth-api/lesson/task/list/member-progress", include_in_schema=False)
async def legacy_stub_get_auth_api_lesson_task_list_member_progres_28547(request: Request):
    """Legacy stub: /auth-api/lesson/task/list/member-progress (LessonTaskController)"""
    return _not_implemented("/auth-api/lesson/task/list/member-progress", "LessonTaskController")

@router.put("/topic", include_in_schema=False)
async def legacy_stub_put_topic_62919(request: Request):
    """Legacy stub: /topic (TopicController)"""
    return _not_implemented("/topic", "TopicController")

@router.get("/topic", include_in_schema=False)
async def legacy_stub_get_topic_30537(request: Request):
    """Legacy stub: /topic (TopicController)"""
    return _not_implemented("/topic", "TopicController")

@router.delete("/topic", include_in_schema=False)
async def legacy_stub_delete_topic_90332(request: Request):
    """Legacy stub: /topic (TopicController)"""
    return _not_implemented("/topic", "TopicController")

@router.put("/topic/un-publish", include_in_schema=False)
async def legacy_stub_put_topic_un_publish_83494(request: Request):
    """Legacy stub: /topic/un-publish (TopicController)"""
    return _not_implemented("/topic/un-publish", "TopicController")

@router.get("/public-api/topic/hot", include_in_schema=False)
async def legacy_stub_get_public_api_topic_hot_57299(request: Request):
    """Legacy stub: /public-api/topic/hot (TopicController)"""
    return _not_implemented("/public-api/topic/hot", "TopicController")

@router.get("/public-api/topic", include_in_schema=False)
async def legacy_stub_get_public_api_topic_74382(request: Request):
    """Legacy stub: /public-api/topic (TopicController)"""
    return _not_implemented("/public-api/topic", "TopicController")

@router.post("/topic/category", include_in_schema=False)
async def legacy_stub_post_topic_category_31592(request: Request):
    """Legacy stub: /topic/category (TopicCategoryController)"""
    return _not_implemented("/topic/category", "TopicCategoryController")

@router.put("/topic/category", include_in_schema=False)
async def legacy_stub_put_topic_category_50370(request: Request):
    """Legacy stub: /topic/category (TopicCategoryController)"""
    return _not_implemented("/topic/category", "TopicCategoryController")

@router.put("/topic/category/is-show", include_in_schema=False)
async def legacy_stub_put_topic_category_is_show_72782(request: Request):
    """Legacy stub: /topic/category/is-show (TopicCategoryController)"""
    return _not_implemented("/topic/category/is-show", "TopicCategoryController")

@router.put("/topic/category/is-show-index", include_in_schema=False)
async def legacy_stub_put_topic_category_is_show_index_26552(request: Request):
    """Legacy stub: /topic/category/is-show-index (TopicCategoryController)"""
    return _not_implemented("/topic/category/is-show-index", "TopicCategoryController")

@router.put("/channel", include_in_schema=False)
async def legacy_stub_put_channel_56483(request: Request):
    """Legacy stub: /channel (ChannelController)"""
    return _not_implemented("/channel", "ChannelController")

@router.get("/public-api/channel", include_in_schema=False)
async def legacy_stub_get_public_api_channel_57086(request: Request):
    """Legacy stub: /public-api/channel (ChannelController)"""
    return _not_implemented("/public-api/channel", "ChannelController")

@router.delete("/channel", include_in_schema=False)
async def legacy_stub_delete_channel_86447(request: Request):
    """Legacy stub: /channel (ChannelController)"""
    return _not_implemented("/channel", "ChannelController")

@router.get("/auth-api/subscribe/by-channel-id-and-member-id", include_in_schema=False)
async def legacy_stub_get_auth_api_subscribe_by_channel_id_and_mem_29705(request: Request):
    """Legacy stub: /auth-api/subscribe//by-channel-id-and-member-id (SubscribeController)"""
    return _not_implemented("/auth-api/subscribe//by-channel-id-and-member-id", "SubscribeController")

@router.get("/tencent/cloud/live/stream", include_in_schema=False)
async def legacy_stub_get_tencent_cloud_live_stream_90786(request: Request):
    """Legacy stub: /tencent/cloud/live/stream (TencentCloudLiveStreamController)"""
    return _not_implemented("/tencent/cloud/live/stream", "TencentCloudLiveStreamController")

@router.get("/tencent/cloud/live/stream/channel-id", include_in_schema=False)
async def legacy_stub_get_tencent_cloud_live_stream_channel_id_22048(request: Request):
    """Legacy stub: /tencent/cloud/live/stream/channel-id (TencentCloudLiveStreamController)"""
    return _not_implemented("/tencent/cloud/live/stream/channel-id", "TencentCloudLiveStreamController")

@router.get("/list", include_in_schema=False)
async def legacy_stub_get_list_13989(request: Request):
    """Legacy stub: /list (MemberController)"""
    return _not_implemented("/list", "MemberController")

@router.get("/unaudited/list", include_in_schema=False)
async def legacy_stub_get_unaudited_list_7488(request: Request):
    """Legacy stub: /unaudited/list (MemberController)"""
    return _not_implemented("/unaudited/list", "MemberController")

@router.get("/auth-api/by-mobile", include_in_schema=False)
async def legacy_stub_get_auth_api_by_mobile_92739(request: Request):
    """Legacy stub: /auth-api/by-mobile (MemberController)"""
    return _not_implemented("/auth-api/by-mobile", "MemberController")

@router.post("/auth-api/create", include_in_schema=False)
async def legacy_stub_post_auth_api_create_65143(request: Request):
    """Legacy stub: /auth-api/create (MemberController)"""
    return _not_implemented("/auth-api/create", "MemberController")

@router.put("/auth-api/update/avatar", include_in_schema=False)
async def legacy_stub_put_auth_api_update_avatar_58067(request: Request):
    """Legacy stub: /auth-api/update/avatar (MemberController)"""
    return _not_implemented("/auth-api/update/avatar", "MemberController")

@router.put("/auth-api/update/avatar/v2", include_in_schema=False)
async def legacy_stub_put_auth_api_update_avatar_v2_47100(request: Request):
    """Legacy stub: /auth-api/update/avatar/v2 (MemberController)"""
    return _not_implemented("/auth-api/update/avatar/v2", "MemberController")

@router.put("/auth-api/update/idphoto", include_in_schema=False)
async def legacy_stub_put_auth_api_update_idphoto_805(request: Request):
    """Legacy stub: /auth-api/update/idphoto (MemberController)"""
    return _not_implemented("/auth-api/update/idphoto", "MemberController")

@router.put("/auth-api/update/name", include_in_schema=False)
async def legacy_stub_put_auth_api_update_name_78254(request: Request):
    """Legacy stub: /auth-api/update/name (MemberController)"""
    return _not_implemented("/auth-api/update/name", "MemberController")

@router.put("/auth-api/update/mobile", include_in_schema=False)
async def legacy_stub_put_auth_api_update_mobile_78445(request: Request):
    """Legacy stub: /auth-api/update/mobile (MemberController)"""
    return _not_implemented("/auth-api/update/mobile", "MemberController")

@router.put("/auth-api/update/pwd", include_in_schema=False)
async def legacy_stub_put_auth_api_update_pwd_30843(request: Request):
    """Legacy stub: /auth-api/update/pwd (MemberController)"""
    return _not_implemented("/auth-api/update/pwd", "MemberController")

@router.put("/auth-api/update/email", include_in_schema=False)
async def legacy_stub_put_auth_api_update_email_21723(request: Request):
    """Legacy stub: /auth-api/update/email (MemberController)"""
    return _not_implemented("/auth-api/update/email", "MemberController")

@router.put("/auth-api/update/password", include_in_schema=False)
async def legacy_stub_put_auth_api_update_password_28417(request: Request):
    """Legacy stub: /auth-api/update/password (MemberController)"""
    return _not_implemented("/auth-api/update/password", "MemberController")

@router.post("/create", include_in_schema=False)
async def legacy_stub_post_create_6564(request: Request):
    """Legacy stub: /create (MemberController)"""
    return _not_implemented("/create", "MemberController")

@router.post("/public-api/register", include_in_schema=False)
async def legacy_stub_post_public_api_register_69722(request: Request):
    """Legacy stub: /public-api/register (MemberController)"""
    return _not_implemented("/public-api/register", "MemberController")

@router.post("/public-api/register/mobile", include_in_schema=False)
async def legacy_stub_post_public_api_register_mobile_25669(request: Request):
    """Legacy stub: /public-api/register/mobile (MemberController)"""
    return _not_implemented("/public-api/register/mobile", "MemberController")

@router.post("/public-api/send/auth-code", include_in_schema=False)
async def legacy_stub_post_public_api_send_auth_code_81227(request: Request):
    """Legacy stub: /public-api/send/auth-code (MemberController)"""
    return _not_implemented("/public-api/send/auth-code", "MemberController")

@router.get("/public-api/by-ids", include_in_schema=False)
async def legacy_stub_get_public_api_by_ids_44880(request: Request):
    """Legacy stub: /public-api/by-ids (MemberController)"""
    return _not_implemented("/public-api/by-ids", "MemberController")

@router.get("/auth-api/by-id", include_in_schema=False)
async def legacy_stub_get_auth_api_by_id_30006(request: Request):
    """Legacy stub: /auth-api/by-id (MemberController)"""
    return _not_implemented("/auth-api/by-id", "MemberController")

@router.get("/auth-api/list", include_in_schema=False)
async def legacy_stub_get_auth_api_list_24000(request: Request):
    """Legacy stub: /auth-api/list (MemberController)"""
    return _not_implemented("/auth-api/list", "MemberController")

@router.put("/auth-api/update/level", include_in_schema=False)
async def legacy_stub_put_auth_api_update_level_62828(request: Request):
    """Legacy stub: /auth-api/update/level (MemberController)"""
    return _not_implemented("/auth-api/update/level", "MemberController")

@router.post("/public-api/pwd/send/auth-code", include_in_schema=False)
async def legacy_stub_post_public_api_pwd_send_auth_code_20972(request: Request):
    """Legacy stub: /public-api/pwd/send/auth-code (MemberController)"""
    return _not_implemented("/public-api/pwd/send/auth-code", "MemberController")

@router.post("/public-api/pwd/check/auth-code", include_in_schema=False)
async def legacy_stub_post_public_api_pwd_check_auth_code_42884(request: Request):
    """Legacy stub: /public-api/pwd/check/auth-code (MemberController)"""
    return _not_implemented("/public-api/pwd/check/auth-code", "MemberController")

@router.put("/public-api/pwd/reset", include_in_schema=False)
async def legacy_stub_put_public_api_pwd_reset_27947(request: Request):
    """Legacy stub: /public-api/pwd/reset (MemberController)"""
    return _not_implemented("/public-api/pwd/reset", "MemberController")

@router.put("/pwd/reset", include_in_schema=False)
async def legacy_stub_put_pwd_reset_85319(request: Request):
    """Legacy stub: /pwd/reset (MemberController)"""
    return _not_implemented("/pwd/reset", "MemberController")

@router.put("/seal", include_in_schema=False)
async def legacy_stub_put_seal_33888(request: Request):
    """Legacy stub: /seal (MemberController)"""
    return _not_implemented("/seal", "MemberController")

@router.put("/unseal", include_in_schema=False)
async def legacy_stub_put_unseal_57659(request: Request):
    """Legacy stub: /unseal (MemberController)"""
    return _not_implemented("/unseal", "MemberController")

@router.put("/update", include_in_schema=False)
async def legacy_stub_put_update_26791(request: Request):
    """Legacy stub: /update (MemberController)"""
    return _not_implemented("/update", "MemberController")

@router.delete("/delete", include_in_schema=False)
async def legacy_stub_delete_delete_71218(request: Request):
    """Legacy stub: /delete (MemberController)"""
    return _not_implemented("/delete", "MemberController")

@router.put("/auth-api/update/realname", include_in_schema=False)
async def legacy_stub_put_auth_api_update_realname_91380(request: Request):
    """Legacy stub: /auth-api/update/realname (MemberController)"""
    return _not_implemented("/auth-api/update/realname", "MemberController")

@router.put("/auth-api/update/name/v2", include_in_schema=False)
async def legacy_stub_put_auth_api_update_name_v2_28812(request: Request):
    """Legacy stub: /auth-api/update/name/v2 (MemberController)"""
    return _not_implemented("/auth-api/update/name/v2", "MemberController")

@router.put("/approved", include_in_schema=False)
async def legacy_stub_put_approved_97487(request: Request):
    """Legacy stub: /approved (MemberController)"""
    return _not_implemented("/approved", "MemberController")

@router.put("/reject", include_in_schema=False)
async def legacy_stub_put_reject_64965(request: Request):
    """Legacy stub: /reject (MemberController)"""
    return _not_implemented("/reject", "MemberController")

@router.post("/auth-api/createbywechatuserinfo", include_in_schema=False)
async def legacy_stub_post_auth_api_createbywechatuserinfo_10568(request: Request):
    """Legacy stub: /auth-api/createbywechatuserinfo (MemberController)"""
    return _not_implemented("/auth-api/createbywechatuserinfo", "MemberController")

@router.post("/import/excel", include_in_schema=False)
async def legacy_stub_post_import_excel_3603(request: Request):
    """Legacy stub: /import/excel (MemberController)"""
    return _not_implemented("/import/excel", "MemberController")

@router.get("/statistics", include_in_schema=False)
async def legacy_stub_get_statistics_75798(request: Request):
    """Legacy stub: /statistics (MemberController)"""
    return _not_implemented("/statistics", "MemberController")

@router.post("/auth-api/check-in", include_in_schema=False)
async def legacy_stub_post_auth_api_check_in_47847(request: Request):
    """Legacy stub: /auth-api/check-in (CheckInController)"""
    return _not_implemented("/auth-api/check-in", "CheckInController")

@router.get("/public-api/check-in", include_in_schema=False)
async def legacy_stub_get_public_api_check_in_93675(request: Request):
    """Legacy stub: /public-api/check-in (CheckInController)"""
    return _not_implemented("/public-api/check-in", "CheckInController")

@router.put("/company", include_in_schema=False)
async def legacy_stub_put_company_69484(request: Request):
    """Legacy stub: /company (MemberCompanyController)"""
    return _not_implemented("/company", "MemberCompanyController")

@router.get("/company/list", include_in_schema=False)
async def legacy_stub_get_company_list_50182(request: Request):
    """Legacy stub: /company/list (MemberCompanyController)"""
    return _not_implemented("/company/list", "MemberCompanyController")

@router.get("/public-api/company/list", include_in_schema=False)
async def legacy_stub_get_public_api_company_list_63008(request: Request):
    """Legacy stub: /public-api/company/list (MemberCompanyController)"""
    return _not_implemented("/public-api/company/list", "MemberCompanyController")

@router.delete("/company", include_in_schema=False)
async def legacy_stub_delete_company_82526(request: Request):
    """Legacy stub: /company (MemberCompanyController)"""
    return _not_implemented("/company", "MemberCompanyController")

@router.get("/company", include_in_schema=False)
async def legacy_stub_get_company_80161(request: Request):
    """Legacy stub: /company (MemberCompanyController)"""
    return _not_implemented("/company", "MemberCompanyController")

@router.put("/company/enable", include_in_schema=False)
async def legacy_stub_put_company_enable_72243(request: Request):
    """Legacy stub: /company/enable (MemberCompanyController)"""
    return _not_implemented("/company/enable", "MemberCompanyController")

@router.put("/company/disable", include_in_schema=False)
async def legacy_stub_put_company_disable_75886(request: Request):
    """Legacy stub: /company/disable (MemberCompanyController)"""
    return _not_implemented("/company/disable", "MemberCompanyController")

@router.post("/company/type", include_in_schema=False)
async def legacy_stub_post_company_type_65621(request: Request):
    """Legacy stub: /company/type (MemberCompanyTypeController)"""
    return _not_implemented("/company/type", "MemberCompanyTypeController")

@router.put("/company/type", include_in_schema=False)
async def legacy_stub_put_company_type_2217(request: Request):
    """Legacy stub: /company/type (MemberCompanyTypeController)"""
    return _not_implemented("/company/type", "MemberCompanyTypeController")

@router.delete("/company/type", include_in_schema=False)
async def legacy_stub_delete_company_type_26467(request: Request):
    """Legacy stub: /company/type (MemberCompanyTypeController)"""
    return _not_implemented("/company/type", "MemberCompanyTypeController")

@router.get("/company/type", include_in_schema=False)
async def legacy_stub_get_company_type_92081(request: Request):
    """Legacy stub: /company/type (MemberCompanyTypeController)"""
    return _not_implemented("/company/type", "MemberCompanyTypeController")

@router.put("/company/type/enable", include_in_schema=False)
async def legacy_stub_put_company_type_enable_38717(request: Request):
    """Legacy stub: /company/type/enable (MemberCompanyTypeController)"""
    return _not_implemented("/company/type/enable", "MemberCompanyTypeController")

@router.put("/company/type/disable", include_in_schema=False)
async def legacy_stub_put_company_type_disable_49613(request: Request):
    """Legacy stub: /company/type/disable (MemberCompanyTypeController)"""
    return _not_implemented("/company/type/disable", "MemberCompanyTypeController")

@router.get("/company/type/list", include_in_schema=False)
async def legacy_stub_get_company_type_list_38699(request: Request):
    """Legacy stub: /company/type/list (MemberCompanyTypeController)"""
    return _not_implemented("/company/type/list", "MemberCompanyTypeController")

@router.get("/auth-api/follow/list", include_in_schema=False)
async def legacy_stub_get_auth_api_follow_list_74194(request: Request):
    """Legacy stub: /auth-api/follow/list (FollowController)"""
    return _not_implemented("/auth-api/follow/list", "FollowController")

@router.get("/auth-api/follow/fans/list", include_in_schema=False)
async def legacy_stub_get_auth_api_follow_fans_list_54228(request: Request):
    """Legacy stub: /auth-api/follow/fans/list (FollowController)"""
    return _not_implemented("/auth-api/follow/fans/list", "FollowController")

@router.put("/auth-api/follow", include_in_schema=False)
async def legacy_stub_put_auth_api_follow_89341(request: Request):
    """Legacy stub: /auth-api/follow (FollowController)"""
    return _not_implemented("/auth-api/follow", "FollowController")

@router.get("/auth-api/follow", include_in_schema=False)
async def legacy_stub_get_auth_api_follow_57410(request: Request):
    """Legacy stub: /auth-api/follow (FollowController)"""
    return _not_implemented("/auth-api/follow", "FollowController")

@router.get("/public-api/follow/member/count", include_in_schema=False)
async def legacy_stub_get_public_api_follow_member_count_41200(request: Request):
    """Legacy stub: /public-api/follow/member/count (FollowController)"""
    return _not_implemented("/public-api/follow/member/count", "FollowController")

@router.get("/group/list", include_in_schema=False)
async def legacy_stub_get_group_list_70476(request: Request):
    """Legacy stub: /group/list (MemberGroupController)"""
    return _not_implemented("/group/list", "MemberGroupController")

@router.put("/group", include_in_schema=False)
async def legacy_stub_put_group_52858(request: Request):
    """Legacy stub: /group (MemberGroupController)"""
    return _not_implemented("/group", "MemberGroupController")

@router.delete("/group", include_in_schema=False)
async def legacy_stub_delete_group_81816(request: Request):
    """Legacy stub: /group (MemberGroupController)"""
    return _not_implemented("/group", "MemberGroupController")

@router.put("/group/enable", include_in_schema=False)
async def legacy_stub_put_group_enable_85457(request: Request):
    """Legacy stub: /group/enable (MemberGroupController)"""
    return _not_implemented("/group/enable", "MemberGroupController")

@router.put("/group/disable", include_in_schema=False)
async def legacy_stub_put_group_disable_36054(request: Request):
    """Legacy stub: /group/disable (MemberGroupController)"""
    return _not_implemented("/group/disable", "MemberGroupController")

@router.get("/level/list", include_in_schema=False)
async def legacy_stub_get_level_list_37457(request: Request):
    """Legacy stub: /level/list (MemberLevelController)"""
    return _not_implemented("/level/list", "MemberLevelController")

@router.get("/level", include_in_schema=False)
async def legacy_stub_get_level_53986(request: Request):
    """Legacy stub: /level (MemberLevelController)"""
    return _not_implemented("/level", "MemberLevelController")

@router.put("/level", include_in_schema=False)
async def legacy_stub_put_level_20027(request: Request):
    """Legacy stub: /level (MemberLevelController)"""
    return _not_implemented("/level", "MemberLevelController")

@router.delete("/level", include_in_schema=False)
async def legacy_stub_delete_level_7295(request: Request):
    """Legacy stub: /level (MemberLevelController)"""
    return _not_implemented("/level", "MemberLevelController")

@router.get("/post/list", include_in_schema=False)
async def legacy_stub_get_post_list_25268(request: Request):
    """Legacy stub: /post/list (MemberPostController)"""
    return _not_implemented("/post/list", "MemberPostController")

@router.put("/post", include_in_schema=False)
async def legacy_stub_put_post_1766(request: Request):
    """Legacy stub: /post (MemberPostController)"""
    return _not_implemented("/post", "MemberPostController")

@router.delete("/post", include_in_schema=False)
async def legacy_stub_delete_post_7536(request: Request):
    """Legacy stub: /post (MemberPostController)"""
    return _not_implemented("/post", "MemberPostController")

@router.put("/post/enable", include_in_schema=False)
async def legacy_stub_put_post_enable_57909(request: Request):
    """Legacy stub: /post/enable (MemberPostController)"""
    return _not_implemented("/post/enable", "MemberPostController")

@router.put("/post/disable", include_in_schema=False)
async def legacy_stub_put_post_disable_78870(request: Request):
    """Legacy stub: /post/disable (MemberPostController)"""
    return _not_implemented("/post/disable", "MemberPostController")

@router.get("/tag/list", include_in_schema=False)
async def legacy_stub_get_tag_list_26450(request: Request):
    """Legacy stub: /tag/list (MemberTagController)"""
    return _not_implemented("/tag/list", "MemberTagController")

@router.put("/tag", include_in_schema=False)
async def legacy_stub_put_tag_46587(request: Request):
    """Legacy stub: /tag (MemberTagController)"""
    return _not_implemented("/tag", "MemberTagController")

@router.delete("/tag", include_in_schema=False)
async def legacy_stub_delete_tag_48166(request: Request):
    """Legacy stub: /tag (MemberTagController)"""
    return _not_implemented("/tag", "MemberTagController")

@router.put("/announcement", include_in_schema=False)
async def legacy_stub_put_announcement_25891(request: Request):
    """Legacy stub: /announcement (AnnouncementController)"""
    return _not_implemented("/announcement", "AnnouncementController")

@router.delete("/announcement", include_in_schema=False)
async def legacy_stub_delete_announcement_67121(request: Request):
    """Legacy stub: /announcement (AnnouncementController)"""
    return _not_implemented("/announcement", "AnnouncementController")

@router.get("/announcement", include_in_schema=False)
async def legacy_stub_get_announcement_81278(request: Request):
    """Legacy stub: /announcement (AnnouncementController)"""
    return _not_implemented("/announcement", "AnnouncementController")

@router.get("/public-api/announcement", include_in_schema=False)
async def legacy_stub_get_public_api_announcement_25302(request: Request):
    """Legacy stub: /public-api/announcement (AnnouncementController)"""
    return _not_implemented("/public-api/announcement", "AnnouncementController")

@router.post("/notice", include_in_schema=False)
async def legacy_stub_post_notice_43837(request: Request):
    """Legacy stub: /notice (NoticeController)"""
    return _not_implemented("/notice", "NoticeController")

@router.delete("/notice", include_in_schema=False)
async def legacy_stub_delete_notice_21850(request: Request):
    """Legacy stub: /notice (NoticeController)"""
    return _not_implemented("/notice", "NoticeController")

@router.put("/public-api/notice/read", include_in_schema=False)
async def legacy_stub_put_public_api_notice_read_41020(request: Request):
    """Legacy stub: /public-api/notice/read (NoticeController)"""
    return _not_implemented("/public-api/notice/read", "NoticeController")

@router.post("/auth-api/private-letter", include_in_schema=False)
async def legacy_stub_post_auth_api_private_letter_64569(request: Request):
    """Legacy stub: /auth-api/private-letter (PrivateLetterController)"""
    return _not_implemented("/auth-api/private-letter", "PrivateLetterController")

@router.delete("/auth-api/private-letter", include_in_schema=False)
async def legacy_stub_delete_auth_api_private_letter_76828(request: Request):
    """Legacy stub: /auth-api/private-letter (PrivateLetterController)"""
    return _not_implemented("/auth-api/private-letter", "PrivateLetterController")

@router.get("/auth-api/private-letter", include_in_schema=False)
async def legacy_stub_get_auth_api_private_letter_83777(request: Request):
    """Legacy stub: /auth-api/private-letter (PrivateLetterController)"""
    return _not_implemented("/auth-api/private-letter", "PrivateLetterController")

@router.get("/auth-api/private-letter/member", include_in_schema=False)
async def legacy_stub_get_auth_api_private_letter_member_33249(request: Request):
    """Legacy stub: /auth-api/private-letter/member (PrivateLetterController)"""
    return _not_implemented("/auth-api/private-letter/member", "PrivateLetterController")

@router.get("/statistics", include_in_schema=False)
async def legacy_stub_get_statistics_75798(request: Request):
    """Legacy stub: /statistics (MessageStatisticsController)"""
    return _not_implemented("/statistics", "MessageStatisticsController")

@router.put("/template", include_in_schema=False)
async def legacy_stub_put_template_24889(request: Request):
    """Legacy stub: /template (TemplateController)"""
    return _not_implemented("/template", "TemplateController")

@router.post("/public-api/mail/send/html", include_in_schema=False)
async def legacy_stub_post_public_api_mail_send_html_85760(request: Request):
    """Legacy stub: /public-api/mail/send/html (MailController)"""
    return _not_implemented("/public-api/mail/send/html", "MailController")

@router.post("/auth-api/invoice/application", include_in_schema=False)
async def legacy_stub_post_auth_api_invoice_application_38434(request: Request):
    """Legacy stub: /auth-api/invoice/application (InvoiceApplicationController)"""
    return _not_implemented("/auth-api/invoice/application", "InvoiceApplicationController")

@router.post("/invoice/application", include_in_schema=False)
async def legacy_stub_post_invoice_application_49369(request: Request):
    """Legacy stub: /invoice/application (InvoiceApplicationController)"""
    return _not_implemented("/invoice/application", "InvoiceApplicationController")

@router.put("/auth-api/invoice/application", include_in_schema=False)
async def legacy_stub_put_auth_api_invoice_application_4797(request: Request):
    """Legacy stub: /auth-api/invoice/application (InvoiceApplicationController)"""
    return _not_implemented("/auth-api/invoice/application", "InvoiceApplicationController")

@router.put("/invoice/application", include_in_schema=False)
async def legacy_stub_put_invoice_application_42990(request: Request):
    """Legacy stub: /invoice/application (InvoiceApplicationController)"""
    return _not_implemented("/invoice/application", "InvoiceApplicationController")

@router.get("/auth-api/invoice/application", include_in_schema=False)
async def legacy_stub_get_auth_api_invoice_application_87809(request: Request):
    """Legacy stub: /auth-api/invoice/application (InvoiceApplicationController)"""
    return _not_implemented("/auth-api/invoice/application", "InvoiceApplicationController")

@router.delete("/auth-api/invoice/application", include_in_schema=False)
async def legacy_stub_delete_auth_api_invoice_application_68720(request: Request):
    """Legacy stub: /auth-api/invoice/application (InvoiceApplicationController)"""
    return _not_implemented("/auth-api/invoice/application", "InvoiceApplicationController")

@router.delete("/invoice/application", include_in_schema=False)
async def legacy_stub_delete_invoice_application_73813(request: Request):
    """Legacy stub: /invoice/application (InvoiceApplicationController)"""
    return _not_implemented("/invoice/application", "InvoiceApplicationController")

@router.post("/invoice/application/approved", include_in_schema=False)
async def legacy_stub_post_invoice_application_approved_79278(request: Request):
    """Legacy stub: /invoice/application/approved (InvoiceApplicationController)"""
    return _not_implemented("/invoice/application/approved", "InvoiceApplicationController")

@router.post("/invoice/application/rejected", include_in_schema=False)
async def legacy_stub_post_invoice_application_rejected_14430(request: Request):
    """Legacy stub: /invoice/application/rejected (InvoiceApplicationController)"""
    return _not_implemented("/invoice/application/rejected", "InvoiceApplicationController")

@router.post("/invoice/application/invoicing", include_in_schema=False)
async def legacy_stub_post_invoice_application_invoicing_65226(request: Request):
    """Legacy stub: /invoice/application/invoicing (InvoiceApplicationController)"""
    return _not_implemented("/invoice/application/invoicing", "InvoiceApplicationController")

@router.post("/invoice/application/invoiced", include_in_schema=False)
async def legacy_stub_post_invoice_application_invoiced_90501(request: Request):
    """Legacy stub: /invoice/application/invoiced (InvoiceApplicationController)"""
    return _not_implemented("/invoice/application/invoiced", "InvoiceApplicationController")

@router.post("/invoice/application/canceled", include_in_schema=False)
async def legacy_stub_post_invoice_application_canceled_46501(request: Request):
    """Legacy stub: /invoice/application/canceled (InvoiceApplicationController)"""
    return _not_implemented("/invoice/application/canceled", "InvoiceApplicationController")

@router.post("/auth-api/invoice/title", include_in_schema=False)
async def legacy_stub_post_auth_api_invoice_title_81932(request: Request):
    """Legacy stub: /auth-api/invoice/title (InvoiceTitleController)"""
    return _not_implemented("/auth-api/invoice/title", "InvoiceTitleController")

@router.post("/invoice/title", include_in_schema=False)
async def legacy_stub_post_invoice_title_56024(request: Request):
    """Legacy stub: /invoice/title (InvoiceTitleController)"""
    return _not_implemented("/invoice/title", "InvoiceTitleController")

@router.put("/auth-api/invoice/title", include_in_schema=False)
async def legacy_stub_put_auth_api_invoice_title_88722(request: Request):
    """Legacy stub: /auth-api/invoice/title (InvoiceTitleController)"""
    return _not_implemented("/auth-api/invoice/title", "InvoiceTitleController")

@router.put("/invoice/title", include_in_schema=False)
async def legacy_stub_put_invoice_title_8077(request: Request):
    """Legacy stub: /invoice/title (InvoiceTitleController)"""
    return _not_implemented("/invoice/title", "InvoiceTitleController")

@router.get("/auth-api/invoice/title", include_in_schema=False)
async def legacy_stub_get_auth_api_invoice_title_83653(request: Request):
    """Legacy stub: /auth-api/invoice/title (InvoiceTitleController)"""
    return _not_implemented("/auth-api/invoice/title", "InvoiceTitleController")

@router.delete("/auth-api/invoice/title", include_in_schema=False)
async def legacy_stub_delete_auth_api_invoice_title_19296(request: Request):
    """Legacy stub: /auth-api/invoice/title (InvoiceTitleController)"""
    return _not_implemented("/auth-api/invoice/title", "InvoiceTitleController")

@router.delete("/invoice/title", include_in_schema=False)
async def legacy_stub_delete_invoice_title_28782(request: Request):
    """Legacy stub: /invoice/title (InvoiceTitleController)"""
    return _not_implemented("/invoice/title", "InvoiceTitleController")

@router.post("/auth-api/order", include_in_schema=False)
async def legacy_stub_post_auth_api_order_11113(request: Request):
    """Legacy stub: /auth-api/order (OrderController)"""
    return _not_implemented("/auth-api/order", "OrderController")

@router.get("/auth-api/order", include_in_schema=False)
async def legacy_stub_get_auth_api_order_7528(request: Request):
    """Legacy stub: /auth-api/order (OrderController)"""
    return _not_implemented("/auth-api/order", "OrderController")

@router.post("/public-api/order/update/status", include_in_schema=False)
async def legacy_stub_post_public_api_order_update_status_5365(request: Request):
    """Legacy stub: /public-api/order/update/status (OrderController)"""
    return _not_implemented("/public-api/order/update/status", "OrderController")

@router.post("/auth-api/order/pre-get-order-amount", include_in_schema=False)
async def legacy_stub_post_auth_api_order_pre_get_order_amount_95754(request: Request):
    """Legacy stub: /auth-api/order/pre-get-order-amount (OrderController)"""
    return _not_implemented("/auth-api/order/pre-get-order-amount", "OrderController")

@router.post("/auth-api/order/get-order-amount", include_in_schema=False)
async def legacy_stub_post_auth_api_order_get_order_amount_57421(request: Request):
    """Legacy stub: /auth-api/order/get-order-amount (OrderController)"""
    return _not_implemented("/auth-api/order/get-order-amount", "OrderController")

@router.post("/auth-api/order/payment", include_in_schema=False)
async def legacy_stub_post_auth_api_order_payment_59217(request: Request):
    """Legacy stub: /auth-api/order/payment (OrderController)"""
    return _not_implemented("/auth-api/order/payment", "OrderController")

@router.post("/auth-api/{service}/{module}/{fileType}", include_in_schema=False)
async def legacy_stub_post_auth_api__service___module___fileType_45448(request: Request):
    """Legacy stub: /auth-api/{service}/{module}/{fileType} (OssController)"""
    return _not_implemented("/auth-api/{service}/{module}/{fileType}", "OssController")

@router.delete("/file", include_in_schema=False)
async def legacy_stub_delete_file_42502(request: Request):
    """Legacy stub: /file (OssController)"""
    return _not_implemented("/file", "OssController")

@router.post("/auth-api/base64/{service}/{module}/{fileType}", include_in_schema=False)
async def legacy_stub_post_auth_api_base64__service___module___file_40571(request: Request):
    """Legacy stub: /auth-api/base64/{service}/{module}/{fileType} (OssController)"""
    return _not_implemented("/auth-api/base64/{service}/{module}/{fileType}", "OssController")

@router.get("/to-base64", include_in_schema=False)
async def legacy_stub_get_to_base64_39245(request: Request):
    """Legacy stub: /to-base64 (OssController)"""
    return _not_implemented("/to-base64", "OssController")

@router.post("/auth-api/trade/payment", include_in_schema=False)
async def legacy_stub_post_auth_api_trade_payment_52794(request: Request):
    """Legacy stub: /auth-api/trade/payment (TradeController)"""
    return _not_implemented("/auth-api/trade/payment", "TradeController")

@router.post("/public-api/wechatpay/notify/v3", include_in_schema=False)
async def legacy_stub_post_public_api_wechatpay_notify_v3_13614(request: Request):
    """Legacy stub: /public-api/wechatpay/notify/v3 (WechatpayNotifyController)"""
    return _not_implemented("/public-api/wechatpay/notify/v3", "WechatpayNotifyController")

@router.get("/channel/all", include_in_schema=False)
async def legacy_stub_get_channel_all_439(request: Request):
    """Legacy stub: /channel/all (ChannelController)"""
    return _not_implemented("/channel/all", "ChannelController")

@router.get("/channel", include_in_schema=False)
async def legacy_stub_get_channel_86622(request: Request):
    """Legacy stub: /channel (ChannelController)"""
    return _not_implemented("/channel", "ChannelController")

@router.post("/channel", include_in_schema=False)
async def legacy_stub_post_channel_91949(request: Request):
    """Legacy stub: /channel (ChannelController)"""
    return _not_implemented("/channel", "ChannelController")

@router.put("/channel", include_in_schema=False)
async def legacy_stub_put_channel_56483(request: Request):
    """Legacy stub: /channel (ChannelController)"""
    return _not_implemented("/channel", "ChannelController")

@router.delete("/channel", include_in_schema=False)
async def legacy_stub_delete_channel_86447(request: Request):
    """Legacy stub: /channel (ChannelController)"""
    return _not_implemented("/channel", "ChannelController")

@router.put("/point/channel/relation", include_in_schema=False)
async def legacy_stub_put_point_channel_relation_95208(request: Request):
    """Legacy stub: /point/channel/relation (PointChannelRelationController)"""
    return _not_implemented("/point/channel/relation", "PointChannelRelationController")

@router.post("/point", include_in_schema=False)
async def legacy_stub_post_point_46936(request: Request):
    """Legacy stub: /point (PointController)"""
    return _not_implemented("/point", "PointController")

@router.put("/point", include_in_schema=False)
async def legacy_stub_put_point_49644(request: Request):
    """Legacy stub: /point (PointController)"""
    return _not_implemented("/point", "PointController")

@router.delete("/point", include_in_schema=False)
async def legacy_stub_delete_point_78249(request: Request):
    """Legacy stub: /point (PointController)"""
    return _not_implemented("/point", "PointController")

@router.get("/point", include_in_schema=False)
async def legacy_stub_get_point_32574(request: Request):
    """Legacy stub: /point (PointController)"""
    return _not_implemented("/point", "PointController")

@router.post("/record/increase", include_in_schema=False)
async def legacy_stub_post_record_increase_57032(request: Request):
    """Legacy stub: /record/increase (RecordController)"""
    return _not_implemented("/record/increase", "RecordController")

@router.post("/record/decrease", include_in_schema=False)
async def legacy_stub_post_record_decrease_10779(request: Request):
    """Legacy stub: /record/decrease (RecordController)"""
    return _not_implemented("/record/decrease", "RecordController")

@router.post("/record/fallback", include_in_schema=False)
async def legacy_stub_post_record_fallback_58542(request: Request):
    """Legacy stub: /record/fallback (RecordController)"""
    return _not_implemented("/record/fallback", "RecordController")

@router.post("/record/recycle", include_in_schema=False)
async def legacy_stub_post_record_recycle_62179(request: Request):
    """Legacy stub: /record/recycle (RecordController)"""
    return _not_implemented("/record/recycle", "RecordController")

@router.get("/public-api/member/point", include_in_schema=False)
async def legacy_stub_get_public_api_member_point_81512(request: Request):
    """Legacy stub: /public-api/member/point (RecordController)"""
    return _not_implemented("/public-api/member/point", "RecordController")

@router.get("/statistics", include_in_schema=False)
async def legacy_stub_get_statistics_75798(request: Request):
    """Legacy stub: /statistics (PointStatisticsController)"""
    return _not_implemented("/statistics", "PointStatisticsController")

@router.get("/category/admin/list", include_in_schema=False)
async def legacy_stub_get_category_admin_list_87989(request: Request):
    """Legacy stub: /category/admin/list (CategoryController)"""
    return _not_implemented("/category/admin/list", "CategoryController")

@router.post("/category", include_in_schema=False)
async def legacy_stub_post_category_31377(request: Request):
    """Legacy stub: /category (CategoryController)"""
    return _not_implemented("/category", "CategoryController")

@router.put("/category", include_in_schema=False)
async def legacy_stub_put_category_82948(request: Request):
    """Legacy stub: /category (CategoryController)"""
    return _not_implemented("/category", "CategoryController")

@router.delete("/category/{id}", include_in_schema=False)
async def legacy_stub_delete_category__id_73537(request: Request):
    """Legacy stub: /category/{id} (CategoryController)"""
    return _not_implemented("/category/{id}", "CategoryController")

@router.post("/category/image", include_in_schema=False)
async def legacy_stub_post_category_image_97195(request: Request):
    """Legacy stub: /category/image (CategoryController)"""
    return _not_implemented("/category/image", "CategoryController")

@router.delete("/category/image", include_in_schema=False)
async def legacy_stub_delete_category_image_35743(request: Request):
    """Legacy stub: /category/image (CategoryController)"""
    return _not_implemented("/category/image", "CategoryController")

@router.put("/category/is-show", include_in_schema=False)
async def legacy_stub_put_category_is_show_69268(request: Request):
    """Legacy stub: /category/is-show (CategoryController)"""
    return _not_implemented("/category/is-show", "CategoryController")

@router.put("/category/is-show-index", include_in_schema=False)
async def legacy_stub_put_category_is_show_index_37314(request: Request):
    """Legacy stub: /category/is-show-index (CategoryController)"""
    return _not_implemented("/category/is-show-index", "CategoryController")

@router.get("/public-api/category/list", include_in_schema=False)
async def legacy_stub_get_public_api_category_list_71520(request: Request):
    """Legacy stub: /public-api/category/list (CategoryController)"""
    return _not_implemented("/public-api/category/list", "CategoryController")

@router.post("/resource/product", include_in_schema=False)
async def legacy_stub_post_resource_product_19110(request: Request):
    """Legacy stub: /resource/product (ResourceProductController)"""
    return _not_implemented("/resource/product", "ResourceProductController")

@router.put("/resource/product", include_in_schema=False)
async def legacy_stub_put_resource_product_58492(request: Request):
    """Legacy stub: /resource/product (ResourceProductController)"""
    return _not_implemented("/resource/product", "ResourceProductController")

@router.delete("/resource/product", include_in_schema=False)
async def legacy_stub_delete_resource_product_70850(request: Request):
    """Legacy stub: /resource/product (ResourceProductController)"""
    return _not_implemented("/resource/product", "ResourceProductController")

@router.get("/resource/product/page/list", include_in_schema=False)
async def legacy_stub_get_resource_product_page_list_90773(request: Request):
    """Legacy stub: /resource/product/page/list (ResourceProductController)"""
    return _not_implemented("/resource/product/page/list", "ResourceProductController")

@router.get("/resource/product/list", include_in_schema=False)
async def legacy_stub_get_resource_product_list_69924(request: Request):
    """Legacy stub: /resource/product/list (ResourceProductController)"""
    return _not_implemented("/resource/product/list", "ResourceProductController")

@router.get("/public-api/resource/product/list", include_in_schema=False)
async def legacy_stub_get_public_api_resource_product_list_51069(request: Request):
    """Legacy stub: /public-api/resource/product/list (ResourceProductController)"""
    return _not_implemented("/public-api/resource/product/list", "ResourceProductController")

@router.get("/public-api/resource/product", include_in_schema=False)
async def legacy_stub_get_public_api_resource_product_12198(request: Request):
    """Legacy stub: /public-api/resource/product (ResourceProductController)"""
    return _not_implemented("/public-api/resource/product", "ResourceProductController")

@router.put("/resource/product/update-status", include_in_schema=False)
async def legacy_stub_put_resource_product_update_status_80356(request: Request):
    """Legacy stub: /resource/product/update-status (ResourceProductController)"""
    return _not_implemented("/resource/product/update-status", "ResourceProductController")

@router.post("/auth-api/resource", include_in_schema=False)
async def legacy_stub_post_auth_api_resource_45194(request: Request):
    """Legacy stub: /auth-api/resource (ResourceController)"""
    return _not_implemented("/auth-api/resource", "ResourceController")

@router.put("/auth-api/resource", include_in_schema=False)
async def legacy_stub_put_auth_api_resource_38730(request: Request):
    """Legacy stub: /auth-api/resource (ResourceController)"""
    return _not_implemented("/auth-api/resource", "ResourceController")

@router.delete("/auth-api/resource", include_in_schema=False)
async def legacy_stub_delete_auth_api_resource_20871(request: Request):
    """Legacy stub: /auth-api/resource (ResourceController)"""
    return _not_implemented("/auth-api/resource", "ResourceController")

@router.get("/resource/list", include_in_schema=False)
async def legacy_stub_get_resource_list_14958(request: Request):
    """Legacy stub: /resource/list (ResourceController)"""
    return _not_implemented("/resource/list", "ResourceController")

@router.get("/public-api/resource/list", include_in_schema=False)
async def legacy_stub_get_public_api_resource_list_55677(request: Request):
    """Legacy stub: /public-api/resource/list (ResourceController)"""
    return _not_implemented("/public-api/resource/list", "ResourceController")

@router.get("/auth-api/resource/list", include_in_schema=False)
async def legacy_stub_get_auth_api_resource_list_30776(request: Request):
    """Legacy stub: /auth-api/resource/list (ResourceController)"""
    return _not_implemented("/auth-api/resource/list", "ResourceController")

@router.get("/public-api/resource/list/by-ids", include_in_schema=False)
async def legacy_stub_get_public_api_resource_list_by_ids_10083(request: Request):
    """Legacy stub: /public-api/resource/list/by-ids (ResourceController)"""
    return _not_implemented("/public-api/resource/list/by-ids", "ResourceController")

@router.get("/public-api/resource", include_in_schema=False)
async def legacy_stub_get_public_api_resource_24303(request: Request):
    """Legacy stub: /public-api/resource (ResourceController)"""
    return _not_implemented("/public-api/resource", "ResourceController")

@router.post("/auth-api/resource/download", include_in_schema=False)
async def legacy_stub_post_auth_api_resource_download_50162(request: Request):
    """Legacy stub: /auth-api/resource/download (ResourceController)"""
    return _not_implemented("/auth-api/resource/download", "ResourceController")

@router.get("/public-api/resource/type/list", include_in_schema=False)
async def legacy_stub_get_public_api_resource_type_list_35766(request: Request):
    """Legacy stub: /public-api/resource/type/list (ResourceController)"""
    return _not_implemented("/public-api/resource/type/list", "ResourceController")

@router.put("/public-api/resource/published", include_in_schema=False)
async def legacy_stub_put_public_api_resource_published_43083(request: Request):
    """Legacy stub: /public-api/resource/published (ResourceController)"""
    return _not_implemented("/public-api/resource/published", "ResourceController")

@router.get("/auth-api/member/resource/list", include_in_schema=False)
async def legacy_stub_get_auth_api_member_resource_list_20409(request: Request):
    """Legacy stub: /auth-api/member/resource/list (ResourceController)"""
    return _not_implemented("/auth-api/member/resource/list", "ResourceController")

@router.get("/auth-api/member/download/resource/list", include_in_schema=False)
async def legacy_stub_get_auth_api_member_download_resource_list_3378(request: Request):
    """Legacy stub: /auth-api/member/download/resource/list (ResourceController)"""
    return _not_implemented("/auth-api/member/download/resource/list", "ResourceController")

@router.get("/auth-api/member/last-search-record", include_in_schema=False)
async def legacy_stub_get_auth_api_member_last_search_record_69471(request: Request):
    """Legacy stub: /auth-api/member/last-search-record (ResourceController)"""
    return _not_implemented("/auth-api/member/last-search-record", "ResourceController")

@router.get("/public-api/resource/recommend-list", include_in_schema=False)
async def legacy_stub_get_public_api_resource_recommend_list_93480(request: Request):
    """Legacy stub: /public-api/resource/recommend-list (ResourceController)"""
    return _not_implemented("/public-api/resource/recommend-list", "ResourceController")

@router.get("/statistics", include_in_schema=False)
async def legacy_stub_get_statistics_75798(request: Request):
    """Legacy stub: /statistics (ResourceStatisticsController)"""
    return _not_implemented("/statistics", "ResourceStatisticsController")

@router.post("/resource/tag", include_in_schema=False)
async def legacy_stub_post_resource_tag_99392(request: Request):
    """Legacy stub: /resource/tag (ResourceTagController)"""
    return _not_implemented("/resource/tag", "ResourceTagController")

@router.put("/resource/tag", include_in_schema=False)
async def legacy_stub_put_resource_tag_43975(request: Request):
    """Legacy stub: /resource/tag (ResourceTagController)"""
    return _not_implemented("/resource/tag", "ResourceTagController")

@router.delete("/resource/tag", include_in_schema=False)
async def legacy_stub_delete_resource_tag_51205(request: Request):
    """Legacy stub: /resource/tag (ResourceTagController)"""
    return _not_implemented("/resource/tag", "ResourceTagController")

@router.get("/resource/tag/page/list", include_in_schema=False)
async def legacy_stub_get_resource_tag_page_list_25048(request: Request):
    """Legacy stub: /resource/tag/page/list (ResourceTagController)"""
    return _not_implemented("/resource/tag/page/list", "ResourceTagController")

@router.get("/resource/tag/list", include_in_schema=False)
async def legacy_stub_get_resource_tag_list_8037(request: Request):
    """Legacy stub: /resource/tag/list (ResourceTagController)"""
    return _not_implemented("/resource/tag/list", "ResourceTagController")

@router.get("/public-api/resource/tag/list", include_in_schema=False)
async def legacy_stub_get_public_api_resource_tag_list_10120(request: Request):
    """Legacy stub: /public-api/resource/tag/list (ResourceTagController)"""
    return _not_implemented("/public-api/resource/tag/list", "ResourceTagController")

@router.get("/public-api/resource/tag", include_in_schema=False)
async def legacy_stub_get_public_api_resource_tag_72232(request: Request):
    """Legacy stub: /public-api/resource/tag (ResourceTagController)"""
    return _not_implemented("/public-api/resource/tag", "ResourceTagController")

@router.put("/resource/tag/update-status", include_in_schema=False)
async def legacy_stub_put_resource_tag_update_status_16815(request: Request):
    """Legacy stub: /resource/tag/update-status (ResourceTagController)"""
    return _not_implemented("/resource/tag/update-status", "ResourceTagController")

@router.get("/watch", include_in_schema=False)
async def legacy_stub_get_watch_11556(request: Request):
    """Legacy stub: /watch (WatchController)"""
    return _not_implemented("/watch", "WatchController")

@router.post("/public-api/content", include_in_schema=False)
async def legacy_stub_post_public_api_content_36563(request: Request):
    """Legacy stub: /public-api/content (ContentController)"""
    return _not_implemented("/public-api/content", "ContentController")

@router.put("/public-api/content", include_in_schema=False)
async def legacy_stub_put_public_api_content_60574(request: Request):
    """Legacy stub: /public-api/content (ContentController)"""
    return _not_implemented("/public-api/content", "ContentController")

@router.delete("/public-api/content", include_in_schema=False)
async def legacy_stub_delete_public_api_content_67014(request: Request):
    """Legacy stub: /public-api/content (ContentController)"""
    return _not_implemented("/public-api/content", "ContentController")

@router.get("/public-api/content", include_in_schema=False)
async def legacy_stub_get_public_api_content_20126(request: Request):
    """Legacy stub: /public-api/content (ContentController)"""
    return _not_implemented("/public-api/content", "ContentController")

@router.get("/public-api/content/type", include_in_schema=False)
async def legacy_stub_get_public_api_content_type_89267(request: Request):
    """Legacy stub: /public-api/content/type (ContentController)"""
    return _not_implemented("/public-api/content/type", "ContentController")

@router.post("/hot-word", include_in_schema=False)
async def legacy_stub_post_hot_word_27587(request: Request):
    """Legacy stub: /hot-word (HotWordController)"""
    return _not_implemented("/hot-word", "HotWordController")

@router.put("/hot-word", include_in_schema=False)
async def legacy_stub_put_hot_word_18475(request: Request):
    """Legacy stub: /hot-word (HotWordController)"""
    return _not_implemented("/hot-word", "HotWordController")

@router.delete("/hot-word", include_in_schema=False)
async def legacy_stub_delete_hot_word_49876(request: Request):
    """Legacy stub: /hot-word (HotWordController)"""
    return _not_implemented("/hot-word", "HotWordController")

@router.post("/agreement", include_in_schema=False)
async def legacy_stub_post_agreement_76817(request: Request):
    """Legacy stub: agreement (AgreementController)"""
    return _not_implemented("agreement", "AgreementController")

@router.put("/agreement", include_in_schema=False)
async def legacy_stub_put_agreement_9044(request: Request):
    """Legacy stub: agreement (AgreementController)"""
    return _not_implemented("agreement", "AgreementController")

@router.get("/public-api/agreement", include_in_schema=False)
async def legacy_stub_get_public_api_agreement_11881(request: Request):
    """Legacy stub: public-api/agreement (AgreementController)"""
    return _not_implemented("public-api/agreement", "AgreementController")

@router.get("/agreement/page", include_in_schema=False)
async def legacy_stub_get_agreement_page_6703(request: Request):
    """Legacy stub: agreement/page (AgreementController)"""
    return _not_implemented("agreement/page", "AgreementController")

@router.get("/public-api/carousel", include_in_schema=False)
async def legacy_stub_get_public_api_carousel_62035(request: Request):
    """Legacy stub: /public-api/carousel (CarouselController)"""
    return _not_implemented("/public-api/carousel", "CarouselController")

@router.post("/carousel", include_in_schema=False)
async def legacy_stub_post_carousel_83145(request: Request):
    """Legacy stub: /carousel (CarouselController)"""
    return _not_implemented("/carousel", "CarouselController")

@router.post("/company", include_in_schema=False)
async def legacy_stub_post_company_37623(request: Request):
    """Legacy stub: /company (CompanyController)"""
    return _not_implemented("/company", "CompanyController")

@router.put("/company", include_in_schema=False)
async def legacy_stub_put_company_69484(request: Request):
    """Legacy stub: /company (CompanyController)"""
    return _not_implemented("/company", "CompanyController")

@router.post("/department", include_in_schema=False)
async def legacy_stub_post_department_14681(request: Request):
    """Legacy stub: /department (DepartmentController)"""
    return _not_implemented("/department", "DepartmentController")

@router.get("/department", include_in_schema=False)
async def legacy_stub_get_department_33775(request: Request):
    """Legacy stub: /department (DepartmentController)"""
    return _not_implemented("/department", "DepartmentController")

@router.put("/department", include_in_schema=False)
async def legacy_stub_put_department_47851(request: Request):
    """Legacy stub: /department (DepartmentController)"""
    return _not_implemented("/department", "DepartmentController")

@router.delete("/department", include_in_schema=False)
async def legacy_stub_delete_department_25018(request: Request):
    """Legacy stub: /department (DepartmentController)"""
    return _not_implemented("/department", "DepartmentController")

@router.get("/department/by-user-id", include_in_schema=False)
async def legacy_stub_get_department_by_user_id_34607(request: Request):
    """Legacy stub: /department/by-user-id (DepartmentController)"""
    return _not_implemented("/department/by-user-id", "DepartmentController")

@router.post("/posts", include_in_schema=False)
async def legacy_stub_post_posts_18375(request: Request):
    """Legacy stub: /posts (PostController)"""
    return _not_implemented("/posts", "PostController")

@router.put("/posts", include_in_schema=False)
async def legacy_stub_put_posts_77218(request: Request):
    """Legacy stub: /posts (PostController)"""
    return _not_implemented("/posts", "PostController")

@router.get("/posts", include_in_schema=False)
async def legacy_stub_get_posts_81601(request: Request):
    """Legacy stub: /posts (PostController)"""
    return _not_implemented("/posts", "PostController")

@router.get("/auth-api/by-mobile", include_in_schema=False)
async def legacy_stub_get_auth_api_by_mobile_92739(request: Request):
    """Legacy stub: /auth-api/by-mobile (UserController)"""
    return _not_implemented("/auth-api/by-mobile", "UserController")

@router.get("/auth-api/by-id", include_in_schema=False)
async def legacy_stub_get_auth_api_by_id_30006(request: Request):
    """Legacy stub: /auth-api/by-id (UserController)"""
    return _not_implemented("/auth-api/by-id", "UserController")

@router.put("/user", include_in_schema=False)
async def legacy_stub_put_user_15652(request: Request):
    """Legacy stub: /user (UserController)"""
    return _not_implemented("/user", "UserController")

@router.put("/user/info", include_in_schema=False)
async def legacy_stub_put_user_info_26980(request: Request):
    """Legacy stub: /user/info (UserController)"""
    return _not_implemented("/user/info", "UserController")

@router.put("/user/pwd", include_in_schema=False)
async def legacy_stub_put_user_pwd_59567(request: Request):
    """Legacy stub: /user/pwd (UserController)"""
    return _not_implemented("/user/pwd", "UserController")

@router.delete("/user", include_in_schema=False)
async def legacy_stub_delete_user_79329(request: Request):
    """Legacy stub: /user (UserController)"""
    return _not_implemented("/user", "UserController")

@router.put("/user/reset/pwd", include_in_schema=False)
async def legacy_stub_put_user_reset_pwd_85834(request: Request):
    """Legacy stub: /user/reset/pwd (UserController)"""
    return _not_implemented("/user/reset/pwd", "UserController")

@router.get("/public-api/ding-talk/user/by-code", include_in_schema=False)
async def legacy_stub_get_public_api_ding_talk_user_by_code_12201(request: Request):
    """Legacy stub: /public-api/ding-talk/user/by-code (DingTalkController)"""
    return _not_implemented("/public-api/ding-talk/user/by-code", "DingTalkController")

@router.post("/lecturer", include_in_schema=False)
async def legacy_stub_post_lecturer_41923(request: Request):
    """Legacy stub: /lecturer (LecturerController)"""
    return _not_implemented("/lecturer", "LecturerController")

@router.put("/lecturer", include_in_schema=False)
async def legacy_stub_put_lecturer_47981(request: Request):
    """Legacy stub: /lecturer (LecturerController)"""
    return _not_implemented("/lecturer", "LecturerController")

@router.delete("/lecturer", include_in_schema=False)
async def legacy_stub_delete_lecturer_7384(request: Request):
    """Legacy stub: /lecturer (LecturerController)"""
    return _not_implemented("/lecturer", "LecturerController")

@router.get("/lecturer", include_in_schema=False)
async def legacy_stub_get_lecturer_18951(request: Request):
    """Legacy stub: /lecturer (LecturerController)"""
    return _not_implemented("/lecturer", "LecturerController")

@router.get("/public-api/lecturer", include_in_schema=False)
async def legacy_stub_get_public_api_lecturer_94800(request: Request):
    """Legacy stub: /public-api/lecturer (LecturerController)"""
    return _not_implemented("/public-api/lecturer", "LecturerController")

@router.get("/statistics", include_in_schema=False)
async def legacy_stub_get_statistics_75798(request: Request):
    """Legacy stub: /statistics (UserCenterStatisticsController)"""
    return _not_implemented("/statistics", "UserCenterStatisticsController")

@router.get("/public-api/wechat/oauth-config", include_in_schema=False)
async def legacy_stub_get_public_api_wechat_oauth_config_92446(request: Request):
    """Legacy stub: /public-api/wechat/oauth-config (WechatOauthController)"""
    return _not_implemented("/public-api/wechat/oauth-config", "WechatOauthController")

@router.get("/public-api/wechat/oauth-config/userinfo-bycode", include_in_schema=False)
async def legacy_stub_get_public_api_wechat_oauth_config_userinfo__46168(request: Request):
    """Legacy stub: /public-api/wechat/oauth-config/userinfo-bycode (WechatOauthController)"""
    return _not_implemented("/public-api/wechat/oauth-config/userinfo-bycode", "WechatOauthController")

@router.get("/work-we-chat/token", include_in_schema=False)
async def legacy_stub_get_work_we_chat_token_71630(request: Request):
    """Legacy stub: /work-we-chat/token (WorkWeChatController)"""
    return _not_implemented("/work-we-chat/token", "WorkWeChatController")

@router.get("/public-api/work-we-chat/user/by-code", include_in_schema=False)
async def legacy_stub_get_public_api_work_we_chat_user_by_code_73371(request: Request):
    """Legacy stub: /public-api/work-we-chat/user/by-code (WorkWeChatController)"""
    return _not_implemented("/public-api/work-we-chat/user/by-code", "WorkWeChatController")

@router.post("/public-api/visit-log", include_in_schema=False)
async def legacy_stub_post_public_api_visit_log_52498(request: Request):
    """Legacy stub: /public-api/visit-log (VisitLogController)"""
    return _not_implemented("/public-api/visit-log", "VisitLogController")

@router.get("/visit-log/summary", include_in_schema=False)
async def legacy_stub_get_visit_log_summary_47618(request: Request):
    """Legacy stub: /visit-log/summary (VisitLogController)"""
    return _not_implemented("/visit-log/summary", "VisitLogController")

