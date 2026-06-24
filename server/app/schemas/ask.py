"""
问答社区 Pydantic Schema
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class CategoryCreate(BaseModel):
    pid: int = 0
    name: str = Field(..., min_length=1, max_length=100)
    sort_order: int = 0
    is_show: bool = True
    is_show_index: bool = False
    image: str | None = None


class CategoryUpdate(BaseModel):
    id: int
    pid: int | None = None
    name: str | None = None
    sort_order: int | None = None
    is_show: bool | None = None
    is_show_index: bool | None = None
    image: str | None = None


class CategoryOut(BaseModel):
    id: int
    pid: int
    name: str
    sort_order: int
    is_show: bool
    is_show_index: bool
    image: str | None
    level: int
    create_time: datetime | None
    update_time: datetime | None


class QuestionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)
    image: str | None = None
    cid_list: list[int] | None = []


class QuestionUpdate(BaseModel):
    id: int
    title: str | None = None
    content: str | None = None
    image: str | None = None
    status: str | None = None
    cid_list: list[int] | None = None


class QuestionPageRequest(BaseModel):
    page: int = 1
    limit: int = 10
    keyword: str | None = None
    status: str | None = None
    cid: int | None = None
    member_id: str | None = None
    id_list: list[int] | None = None
    order_column: str | None = "create_time"
    order_direction: Literal["asc", "desc"] | None = "desc"

    @field_validator("order_column")
    @classmethod
    def validate_order_column(cls, v: str | None) -> str | None:
        if v is None:
            return v
        allowed = {
            "id",
            "create_time",
            "update_time",
            "favorite_num",
            "like_num",
            "comment_num",
            "watch_num",
            "answer_num",
        }
        if v not in allowed:
            raise ValueError(f"order_column 不允许: {v}")
        return v


class QuestionOut(BaseModel):
    id: int
    title: str
    content: str
    image: str | None
    member_id: str
    member_name: str | None
    member_avatar: str | None
    status: str
    favorite_num: int
    like_num: int
    comment_num: int
    watch_num: int
    answer_num: int
    is_top: bool
    is_essence: bool
    cid_list: list[int]
    category_list: list[dict]
    create_time: datetime | None
    update_time: datetime | None


class AnswerCreate(BaseModel):
    question_id: int
    content: str = Field(..., min_length=1)


class AnswerUpdate(BaseModel):
    id: int
    content: str | None = None


class AnswerPageRequest(BaseModel):
    page: int = 1
    limit: int = 10
    question_id: int | None = None
    member_id: str | None = None


class AnswerOut(BaseModel):
    id: int
    question_id: int
    content: str
    member_id: str
    member_name: str | None
    member_avatar: str | None
    favorite_num: int
    like_num: int
    comment_num: int
    is_adopted: bool
    is_top: bool
    create_time: datetime | None
    update_time: datetime | None


class CommentCreate(BaseModel):
    target_type: str = Field(..., pattern="^(question|answer)$")
    target_id: int
    content: str = Field(..., min_length=1)
    pid: int = 0
