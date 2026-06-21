from enum import StrEnum

from pydantic import BaseModel


class WatermarkPosition(StrEnum):
    CENTER = "center"
    TILE = "tile"
    DIAGONAL = "diagonal"

class WatermarkType(StrEnum):
    TEXT = "text"
    IMAGE = "image"

class SignatureRequest(BaseModel):
    name: str
    reason: str | None = None
    location: str | None = None
    page_number: int = 1
    x: float = 0
    y: float = 0
    width: float = 150
    height: float = 75

class SignatureResponse(BaseModel):
    id: str
    name: str
    date: str
    reason: str | None
    location: str | None
    page_number: int
    verified: bool
    download_url: str | None = None

class TextWatermarkRequest(BaseModel):
    content: str
    font_size: int = 48
    font_family: str = "Helvetica"
    color: str = "#808080"
    opacity: float = 0.3
    rotation: int = -45
    position: WatermarkPosition = WatermarkPosition.DIAGONAL
    pages: list[int] | None = None

class ImageWatermarkRequest(BaseModel):
    opacity: float = 0.3
    position: WatermarkPosition = WatermarkPosition.CENTER
    scale: float = 1.0
    pages: list[int] | None = None

class WatermarkResponse(BaseModel):
    id: str
    type: WatermarkType
    download_url: str

class PageRange(BaseModel):
    start: int
    end: int

class SplitRequest(BaseModel):
    ranges: list[PageRange]

class MergeResponse(BaseModel):
    download_url: str
    page_count: int

class SplitResponse(BaseModel):
    files: list[dict]

class PrintSettings(BaseModel):
    paper_size: str = "a4"
    orientation: str = "portrait"
    scale: str = "fit"
    custom_scale: int | None = 100
    pages: str = "all"
    copies: int = 1
    duplex: bool = False
    header: str | None = None
    footer: str | None = None
    show_page_numbers: bool = True

class PrintPreviewResponse(BaseModel):
    preview_url: str
    page_count: int

class TaskStatus(BaseModel):
    task_id: str
    status: str
    progress: int
    result_url: str | None = None
    error: str | None = None
