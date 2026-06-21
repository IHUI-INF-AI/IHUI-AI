"""Content schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class AboutUsOut(BaseModel):
    id: int
    title: str | None = None
    content: str | None = None
    status: int | None = None
    model_config = {"from_attributes": True}


class NewsCreate(BaseModel):
    title: str = Field(..., max_length=300)
    subtitle: str | None = None
    content: str | None = None
    cover_image: str | None = None
    author: str | None = None
    category: str | None = None


class NewsOut(BaseModel):
    id: int
    title: str | None = None
    subtitle: str | None = None
    cover_image: str | None = None
    author: str | None = None
    view_count: int | None = None
    status: int | None = None
    publish_time: datetime | None = None
    model_config = {"from_attributes": True}


class BannerOut(BaseModel):
    id: int
    title: str | None = None
    image_url: str | None = None
    link_url: str | None = None
    position: str | None = None
    status: int | None = None
    sort: int | None = None
    model_config = {"from_attributes": True}


class FeedbackCreate(BaseModel):
    content: str
    images: str | None = None
    type: str | None = None


class AppVersionOut(BaseModel):
    id: int
    version_code: str | None = None
    version_name: str | None = None
    download_url: str | None = None
    description: str | None = None
    platform: str | None = None
    force_update: int | None = None
    model_config = {"from_attributes": True}
