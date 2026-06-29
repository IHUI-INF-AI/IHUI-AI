package com.ai.manager.app.domain.users;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.util.Date;

/**
 * 用户认证身份信息对象 user_auth_info
 * 
 * @author Raindrop_L
 * @date 2025-06-25
 */

@Data
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class UserAuthInfo
{
    private static final long serialVersionUID = 1L;

    /**  */
    private Long id;

    /** 用户UUID */
    private String userUuid;

    /** 用户名 */
    private String username;

    /** 手机号 mobile */
    private String phone;

    /** 身份证号 */
    private String certificate;

    /** 邮箱 */
    private String email;

    /** 国 */
    private String country;

    /** 省 */
    private String province;

    /** 市 */
    private String city;

    /** 创建时间 */
    private Date createdAt;

    /** 创建时间 */
    private Date updatedAt;

    /** 生日 */
    private Date birthday;


}
