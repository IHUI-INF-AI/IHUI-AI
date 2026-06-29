package com.ai.manager.app.domain.users;

import com.ai.manager.app.domain.UserThirdPartyAccounts;
import lombok.*;

import java.util.List;
import java.util.Objects;

/**
 * 用户中心对象 users
 * 
 * @author Raindrop_L
 * @date 2025-06-25
 */

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class UsersVO extends Users
{
    private Integer identityTypy;

    /** 用户认证信息表 */
    private UserAuthInfo authInfo;

    /** 用户资产信息表 */
    private List<UserFundInfo> fundInfos;

    private UserThirdPartyAccounts thirdPartyAccounts;


    /** 用户vip级别信息*/
    private VipLevelVO vipLevelVO;

    /** 下级用户列表 */
    private List<Users> users;
}
