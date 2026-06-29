package com.ai.manager.app.server;

import com.ai.manager.app.domain.users.UsersVO;
import com.ai.manager.core.config.ResponseResultInfo;

import java.util.List;

public interface AuthorizationManagementServlet {
    ResponseResultInfo getList(String uuid);

    ResponseResultInfo delAuth(String uuid, String platform);

    List<UsersVO> getTeam(String search, String begin, String end, String authorization, String uuid);

    Long getTeamSize(String platform, String uuid);
}
