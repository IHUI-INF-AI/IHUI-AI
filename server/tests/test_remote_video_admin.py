"""测试远程设备 / 远程三方 / 视频预读/断点 / RuoYi 通用管理."""


import pytest

# ---------------------------------------------------------------------------
# 远程设备
# ---------------------------------------------------------------------------


class TestRemoteDevice:
    async def test_my_team_uuid_required(self, client):
        # 路径参数 uuid 为空也能匹配到路径, 不会 404
        # 这里测 200 返回 (uuid 字符串)
        resp = await client.post("/api/v1/remote/myTeam/test-uuid")
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0

    async def test_get_info_user_not_exist(self, client):
        resp = await client.get("/api/v1/remote/info/non-exist-uuid")
        assert resp.status_code == 200
        data = resp.json()
        # 业务上 user 不存在 -> fail
        assert data["code"] != 0 or data.get("data") is None

    async def test_get_role_returns_list(self, client):
        resp = await client.get("/api/v1/remote/role")
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert isinstance(data["data"], list)

    async def test_agent_category(self, client):
        resp = await client.get("/api/v1/remote/agent/category")
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert isinstance(data["data"], list)

    async def test_agent_category2(self, client):
        resp = await client.get("/api/v1/remote/agent/category2")
        assert resp.status_code == 200

    async def test_agent_by_type(self, client):
        resp = await client.get("/api/v1/remote/agent/by/type?page=1&size=5")
        assert resp.status_code == 200
        data = resp.json()
        assert "list" in data["data"]
        assert "total" in data["data"]

    async def test_agent_by_collect_empty(self, client):
        resp = await client.get("/api/v1/remote/agent/by/collect/never-existed-uuid")
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["total"] == 0

    async def test_agent_by_pay(self, client):
        resp = await client.get("/api/v1/remote/agent/by/pay?uuid=test")
        assert resp.status_code == 200

    async def test_tencent_asr_no_config(self, client):
        from app.config import settings

        old_id = settings.TENCENT_SECRET_ID
        old_key = settings.TENCENT_SECRET_KEY
        settings.TENCENT_SECRET_ID = ""
        settings.TENCENT_SECRET_KEY = ""
        try:
            resp = await client.post(
                "/api/v1/remote/get/tencent/sentence",
                json={"file": "http://x/a.mp3"},
            )
            data = resp.json()
            assert data["code"] != 0
        finally:
            settings.TENCENT_SECRET_ID = old_id
            settings.TENCENT_SECRET_KEY = old_key

    async def test_get_true(self, client):
        resp = await client.get("/api/v1/remote/get/true")
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        # 可能为 True/False, 应当是 bool
        assert isinstance(data["data"], bool)

    async def test_upload_business_card_missing_fields(self, client):
        resp = await client.post(
            "/api/v1/remote/uploadBusinessCard",
            json={"id": "", "card": ""},
        )
        data = resp.json()
        assert data["code"] != 0

    async def test_my_team_date_format_error(self, client):
        resp = await client.post(
            "/api/v1/remote/myTeam/uuid-1",
            json={"begin": "bad-date", "end": "2024-01-01"},
        )
        data = resp.json()
        assert data["code"] != 0


class TestRemoteThird:
    async def test_group_list(self, client):
        resp = await client.get("/api/v1/remote/third/group/list")
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert "groups" in data["data"]


# ---------------------------------------------------------------------------
# 视频预读 / 断点
# ---------------------------------------------------------------------------


class TestVideoPreload:
    async def test_resolve_video_path_default(self, monkeypatch, tmp_path):
        from app.api.v1 import video as vmod

        monkeypatch.setattr(vmod, "VIDEO_ROOT", str(tmp_path))
        p = vmod._resolve_video_path("abc123")
        assert p == str(tmp_path / "abc123.mp4")

    def test_resolve_video_path_with_hint(self, tmp_path):
        from app.api.v1.video import _resolve_video_path

        real = tmp_path / "real.mp4"
        real.write_bytes(b"fake content")
        p = _resolve_video_path("abc", hint=str(real))
        assert p == str(real)

    def test_resolve_video_path_existing_default(self, monkeypatch, tmp_path):
        from app.api.v1 import video as vmod

        monkeypatch.setattr(vmod, "VIDEO_ROOT", str(tmp_path))
        f = tmp_path / "x.mp4"
        f.write_bytes(b"x")
        p = vmod._resolve_video_path("x")
        assert p == str(f)

    def test_has_ffmpeg(self):
        from app.api.v1.video import _has_ffmpeg

        # 仅验证函数可调用, 不强求 ffmpeg 存在
        r = _has_ffmpeg()
        assert isinstance(r, bool)

    async def test_preload_invalid_params(self, client):
        # preloadSeconds 0
        resp = await client.post(
            "/api/v1/video/preload",
            json={
                "videoId": "x",
                "startSeconds": 0,
                "preloadSeconds": 0,
            },
        )
        data = resp.json()
        assert data["code"] != 0

    async def test_preload_negative_start(self, client):
        resp = await client.post(
            "/api/v1/video/preload",
            json={
                "videoId": "x",
                "startSeconds": -1,
                "preloadSeconds": 10,
            },
        )
        data = resp.json()
        assert data["code"] != 0

    async def test_preload_too_long(self, client):
        resp = await client.post(
            "/api/v1/video/preload",
            json={
                "videoId": "x",
                "startSeconds": 0,
                "preloadSeconds": 600,
            },
        )
        data = resp.json()
        assert data["code"] != 0

    async def test_preload_video_not_found(self, client, tmp_path):
        from app.config import settings

        old = settings.VIDEO_ROOT
        settings.VIDEO_ROOT = str(tmp_path)
        try:
            resp = await client.post(
                "/api/v1/video/preload",
                json={
                    "videoId": "nope",
                    "startSeconds": 0,
                    "preloadSeconds": 10,
                },
            )
            data = resp.json()
            assert data["code"] != 0
        finally:
            settings.VIDEO_ROOT = old

    async def test_breakpoint_load_invalid(self, client):
        resp = await client.post(
            "/api/v1/video/breakpoint/load",
            json={
                "videoId": "x",
                "breakpointSeconds": -1,
                "preloadSeconds": 10,
            },
        )
        data = resp.json()
        assert data["code"] != 0

    async def test_breakpoint_load_too_long(self, client):
        resp = await client.post(
            "/api/v1/video/breakpoint/load",
            json={
                "videoId": "x",
                "breakpointSeconds": 10,
                "preloadSeconds": 999,
            },
        )
        data = resp.json()
        assert data["code"] != 0

    async def test_breakpoint_update_and_get(self, client):
        # redis 不可达时, 用 fakeredis 替代
        try:
            import fakeredis
        except ImportError:
            pytest.skip("fakeredis not installed")
        from app.api.v1 import video as vmod

        original_get_redis = vmod.get_redis
        fake = fakeredis.FakeRedis()
        vmod.get_redis = lambda: fake
        try:
            resp1 = await client.post(
                "/api/v1/video/breakpoint/update",
                json={
                    "videoId": "v1",
                    "userId": "u1",
                    "currentSeconds": 60.5,
                    "currentOffset": 1024,
                },
            )
            assert resp1.json()["code"] == 0
            resp2 = await client.get("/api/v1/video/breakpoint/get?userId=u1&videoId=v1")
            data = resp2.json()["data"]
            assert data["breakpointSeconds"] == 60.5
            assert data["currentOffset"] == 1024
        finally:
            vmod.get_redis = original_get_redis

    async def test_breakpoint_get_no_record(self, client):
        try:
            import fakeredis
        except ImportError:
            pytest.skip("fakeredis not installed")
        from app.api.v1 import video as vmod

        original_get_redis = vmod.get_redis
        fake = fakeredis.FakeRedis()
        vmod.get_redis = lambda: fake
        try:
            resp = await client.get("/api/v1/video/breakpoint/get?userId=none2&videoId=none2")
            data = resp.json()["data"]
            assert data["breakpointSeconds"] == 0
        finally:
            vmod.get_redis = original_get_redis


# ---------------------------------------------------------------------------
# RuoYi 通用管理
# ---------------------------------------------------------------------------


class TestSysUser:
    async def test_user_list(self, auth_client):
        resp = await auth_client.get("/api/v1/user/list?page=1&size=10")
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert "list" in data["data"]
        assert "total" in data["data"]

    async def test_user_info_not_exist(self, auth_client):
        resp = await auth_client.get("/api/v1/user/info/never-existed")
        data = resp.json()
        assert data["code"] != 0

    async def test_get_login_user_info(self, auth_client):
        resp = await auth_client.get("/api/v1/user/getInfo")
        data = resp.json()
        assert data["code"] == 0
        assert "user" in data["data"]
        assert "roles" in data["data"]

    async def test_user_create_and_delete(self, auth_client):
        # 创建一个用户
        resp = await auth_client.post(
            "/api/v1/user",
            json={
                "userName": "test_admin_user",
                "password": "test123456",
                "nickName": "Test",
                "email": "test@zhs.local",
                "phone": "13800000000",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        user_id = data["data"]["userId"]

        # 查询
        resp2 = await auth_client.get(f"/api/v1/user/{user_id}")
        assert resp2.json()["code"] == 0
        assert resp2.json()["data"]["userName"] == "test_admin_user"

        # 删除
        resp3 = await auth_client.delete(f"/api/v1/user/{user_id}")
        assert resp3.json()["code"] == 0

    async def test_user_create_duplicate(self, auth_client):
        body = {
            "userName": "dup_user",
            "password": "p",
            "nickName": "D",
        }
        r1 = await auth_client.post("/api/v1/user", json=body)
        r2 = await auth_client.post("/api/v1/user", json=body)
        assert r2.json()["code"] != 0
        # 清理
        if r1.json().get("code") == 0:
            uid = r1.json()["data"]["userId"]
            await auth_client.delete(f"/api/v1/user/{uid}")

    async def test_user_update(self, auth_client):
        # 创建
        r = await auth_client.post(
            "/api/v1/user",
            json={
                "userName": "update_user",
                "password": "p",
                "nickName": "old",
            },
        )
        uid = r.json()["data"]["userId"]
        # 更新
        r2 = await auth_client.put(f"/api/v1/user/{uid}", json={"nickName": "new"})
        assert r2.json()["code"] == 0
        # 验证
        r3 = await auth_client.get(f"/api/v1/user/{uid}")
        assert r3.json()["data"]["nickName"] == "new"
        # 清理
        await auth_client.delete(f"/api/v1/user/{uid}")

    async def test_user_auth_role(self, auth_client):
        # 真实存在的 user_id
        r = await auth_client.post(
            "/api/v1/user",
            json={
                "userName": "auth_role_user",
                "password": "p",
                "nickName": "AR",
            },
        )
        uid = r.json()["data"]["userId"]
        r2 = await auth_client.get(f"/api/v1/user/authRole/{uid}")
        data = r2.json()["data"]
        assert "user" in data
        assert "roles" in data
        await auth_client.delete(f"/api/v1/user/{uid}")

    async def test_dept_tree(self, auth_client):
        r = await auth_client.get("/api/v1/user/deptTree")
        assert r.json()["code"] == 0
        assert isinstance(r.json()["data"], list)


class TestSysRole:
    async def test_role_list(self, auth_client):
        r = await auth_client.get("/api/v1/role/list")
        assert r.json()["code"] == 0


class TestSysMenu:
    async def test_menu_list(self, auth_client):
        r = await auth_client.get("/api/v1/menu/list")
        assert r.json()["code"] == 0

    async def test_menu_treeselect(self, auth_client):
        r = await auth_client.get("/api/v1/menu/treeselect")
        assert r.json()["code"] == 0

    async def test_role_menu_treeselect(self, auth_client):
        r = await auth_client.get("/api/v1/menu/roleMenuTreeselect/1")
        data = r.json()["data"]
        assert "menus" in data
        assert "checkedKeys" in data

    async def test_get_routers(self, auth_client):
        r = await auth_client.get("/api/v1/menu/getRouters")
        assert r.json()["code"] == 0


class TestSysDept:
    async def test_dept_list(self, auth_client):
        r = await auth_client.get("/api/v1/dept/list")
        assert r.json()["code"] == 0

    async def test_dept_list_exclude(self, auth_client):
        r = await auth_client.get("/api/v1/dept/list/exclude/1")
        assert r.json()["code"] == 0


class TestSysPost:
    async def test_post_list(self, auth_client):
        r = await auth_client.get("/api/v1/post/list")
        assert r.json()["code"] == 0


class TestSysConfig:
    async def test_config_list(self, auth_client):
        r = await auth_client.get("/api/v1/config/list")
        assert r.json()["code"] == 0

    async def test_config_key_not_exist(self, auth_client):
        r = await auth_client.get("/api/v1/config/configKey/never-existed-key")
        assert r.json()["code"] != 0


class TestSysDict:
    async def test_dict_type_list(self, auth_client):
        r = await auth_client.get("/api/v1/dict/type/list")
        assert r.json()["code"] == 0

    async def test_dict_type_optionselect(self, auth_client):
        r = await auth_client.get("/api/v1/dict/type/optionselect")
        assert r.json()["code"] == 0

    async def test_dict_data_list(self, auth_client):
        r = await auth_client.get("/api/v1/dict/data/list")
        assert r.json()["code"] == 0

    async def test_dict_data_by_type(self, auth_client):
        r = await auth_client.get("/api/v1/dict/data/type/sys_user_sex")
        assert r.json()["code"] == 0


class TestSysLoginInfo:
    async def test_list(self, auth_client):
        r = await auth_client.get("/api/v1/logininfor/list")
        assert r.json()["code"] == 0

    async def test_clean(self, auth_client):
        r = await auth_client.delete("/api/v1/logininfor/clean")
        assert r.json()["code"] == 0

    async def test_unlock(self, auth_client):
        r = await auth_client.put("/api/v1/logininfor/unlock/some-user")
        assert r.json()["code"] == 0


class TestSysNotice:
    async def test_list(self, auth_client):
        r = await auth_client.get("/api/v1/notice/list")
        assert r.json()["code"] == 0


class TestSysJob:
    async def test_job_list(self, auth_client):
        r = await auth_client.get("/api/v1/job/list")
        assert r.json()["code"] == 0

    async def test_job_log_list(self, auth_client):
        r = await auth_client.get("/api/v1/job/log/list")
        assert r.json()["code"] == 0
