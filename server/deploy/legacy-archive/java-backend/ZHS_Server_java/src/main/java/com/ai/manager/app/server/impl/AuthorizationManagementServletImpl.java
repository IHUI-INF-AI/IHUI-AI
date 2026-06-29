package com.ai.manager.app.server.impl;

import com.ai.manager.app.domain.UserThirdPartyAccounts;
import com.ai.manager.app.domain.users.UserVip;
import com.ai.manager.app.domain.users.UsersVO;
import com.ai.manager.app.domain.users.VipLevelVO;
import com.ai.manager.app.mapper.UserThirdPartyAccountsMapper;
import com.ai.manager.app.server.AuthorizationManagementServlet;
import com.ai.manager.core.config.ResponseResultInfo;
import org.apache.commons.lang3.StringUtils;
import org.assertj.core.util.DateUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class AuthorizationManagementServletImpl implements AuthorizationManagementServlet {
    @Autowired
    private UserThirdPartyAccountsMapper mapper;

    @Override
    public ResponseResultInfo getList(String uuid) {
        List<UserThirdPartyAccounts> list = mapper.selectUserThirdPartyAccountsList(UserThirdPartyAccounts.builder().userUuid(uuid).build());
        return ResponseResultInfo.success(list);
    }

    @Override
    public ResponseResultInfo delAuth(String uuid, String platform) {
        int i = mapper.delAuth(uuid, platform);
        return getList(uuid);
    }

    @Override
    public List<UsersVO> getTeam(String search, String begin, String end, String platform, String uuid) {

        // 时间转化
        Long beginTime = null, endTime = null;
        if(StringUtils.isNotBlank(begin)){
            ZonedDateTime zonedDateTime = DateUtil.parse(begin).toInstant().atZone(ZoneId.systemDefault());
            beginTime = zonedDateTime.with(LocalTime.MIN).toInstant().getEpochSecond();
        }
        if(StringUtils.isNotBlank(end)){
            ZonedDateTime zonedDateTime = DateUtil.parse(end).toInstant().atZone(ZoneId.systemDefault());
            endTime = zonedDateTime.with(LocalTime.MIN).toInstant().getEpochSecond();
        }

        // 获取我的团队信息
        List<UsersVO> myTeam = mapper.getMyTeam(uuid, search, beginTime, endTime, platform);
        List<String> uuids = myTeam.stream().map(UsersVO::getUuid).collect(Collectors.toList());
        List<UserThirdPartyAccounts> thirdPartyAccounts  = mapper.getByUserUuidsBasic(uuids, platform);

        List<VipLevelVO> vipLevelVOS  = mapper.getVIPInfoByUserUuids(uuids);
        Map<String, UserThirdPartyAccounts> thirdByUuid = thirdPartyAccounts.stream()
                .collect(Collectors.groupingBy(
                        UserThirdPartyAccounts::getUserUuid, Collectors.collectingAndThen(Collectors.toList(), item -> item.get(0))
                ));
        Map<String, VipLevelVO> vipByUuid = vipLevelVOS.stream()
                .collect(Collectors.groupingBy(
                        thirdUuid -> {
                            UserVip userVip = thirdUuid.getUserVip();
                            if(Objects.isNull(userVip)) return "";
                            return userVip.getUserUuid();
                        },
                        Collectors.collectingAndThen(Collectors.toList(), item -> item.get(0))
                ));

        myTeam.forEach(item -> {
            item.setThirdPartyAccounts(thirdByUuid.get(item.getUuid()));
            item.setVipLevelVO(vipByUuid.get(item.getUuid()));
            if(Objects.isNull(item.getThirdPartyAccounts())){
                item.setThirdPartyAccounts(UserThirdPartyAccounts.builder().build());
            }
            if(Objects.isNull(item.getVipLevelVO())){
                item.setVipLevelVO(VipLevelVO.builder().build());
            }
        });
        return myTeam;
    }

    @Override
    public Long getTeamSize(String platform, String uuid) {
        return mapper.getTeamSize(platform, uuid);
    }
}
