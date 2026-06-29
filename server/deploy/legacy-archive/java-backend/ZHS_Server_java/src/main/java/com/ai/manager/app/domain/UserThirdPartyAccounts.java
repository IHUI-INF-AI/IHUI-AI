package com.ai.manager.app.domain;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;

import java.io.Serializable;
import java.util.Date;

/**
 * 第三方账号关联对象 user_third_party_accounts
 * 
 * @author Raindrop_L
 * @date 2025-06-25
 */

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class UserThirdPartyAccounts implements Serializable {
    private static final long serialVersionUID = 1L;

    /** $column.columnComment */
    private Long id;

    /** 用户UUID */
    private String userUuid;

    /** 平台来源(wechat,alipay,qq,douyin等) */
    private String platform;

    /** 第三方平台唯一标识 */
    private String openId;

    /** 平台名称(如微信) */
    private String platformName;

    /** 访问令牌 */
    private String accessToken;

    /** 刷新令牌 */
    private String refreshToken;

    /** 令牌过期时间 */
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date expiresAt;
    /** 令牌过期时间 */
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date refreshExpiresAt;

    /** 第三方平台昵称 */
    private String nickname;

    /** 第三方平台头像 */
    private String avatar;

    private String card;

    /** 绑定时间 */
    private Date bindTime;

}
