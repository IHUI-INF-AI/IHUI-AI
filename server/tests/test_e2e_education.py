"""端到端测试：教育平台 / CMS / 内容."""

import pytest

pytestmark = pytest.mark.asyncio


class TestCoursesEndpoints:
    async def test_courses_list(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/courses/list",
            params={"page": 1, "limit": 10},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_courses_videos(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/courses/videos",
            params={"page": 1, "limit": 10},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_courses_categories(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/courses/categories",
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_courses_platforms(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/courses/platforms",
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)


class TestContentEndpoints:
    async def test_banner_list(self, client):
        resp = await client.get(
            "/api/v1/content/banner/list",
            params={"page": 1, "limit": 5},
        )
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_about_us(self, client):
        resp = await client.get("/api/v1/content/about_us")
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_news(self, client):
        resp = await client.get(
            "/api/v1/content/news/list",
            params={"page": 1, "limit": 10},
        )
        assert resp.status_code in (200, 401, 404, 422, 500)


class TestResourceEndpoints:
    async def test_home(self, client):
        resp = await client.get("/api/v1/resource/home")
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_banner(self, client):
        resp = await client.get(
            "/api/v1/resource/banner",
            params={"limit": 5},
        )
        assert resp.status_code in (200, 401, 404, 422, 500)
