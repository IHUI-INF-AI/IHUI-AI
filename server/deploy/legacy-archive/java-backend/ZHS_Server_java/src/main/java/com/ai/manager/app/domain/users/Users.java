package com.ai.manager.app.domain.users;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;

import java.util.Date;

/**
 * 用户中心对象 users
 * 
 * @author Raindrop_L
 * @date 2025-06-25
 */

@Data
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class Users
{
    private static final long serialVersionUID = 1L;

    /** 用户唯一标识 */
    private String uuid;

    /** 密码哈希值 */
    private String passwordHash;

    /** 密码盐值 */
    private String passwordSalt;

    /** 昵称 */
    private String nickname;

    /** 头像URL */
    private String avatar;

    /** 性别(0-沃尔玛购物袋,1-男,2-女) */
    private Integer gender = 0;

    /** 生日 */
    private Date birthday;

    /** 状态(0-禁用,1-正常,2-锁定) */
    private Integer status = 1;

    /** 分销邀请码（唯一） */
    private String inviteCode;

    /** 上级推荐人ID */
    private String parentId;

    /** 创建时间 */
    private Date createdAt;

    /** 更新时间 */
    private Date updatedAt;

    private Integer isVip = 0;

    public String getPasswordHash() {
        return null;
    }
    public String getPasswordSalt() {
        return null;
    }

    /**
     * 不对外部暴露密码信息
     * @return
     */
    @JsonIgnore
    public String getPasswordSaltByAuth() {
        return passwordSalt;
    }
    @JsonIgnore
    public String getPasswordHashByAuth() {
        return passwordHash;
    }
}
