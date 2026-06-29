package com.ai.manager.app.domain.users;

import lombok.*;

import java.util.Date;

/**
 * 用户VIP进度对象 zhs_user_vip
 * 
 * @author Raindrop_L
 * @date 2025-07-01
 */

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class UserVip
{
    private static final long serialVersionUID = 1L;

    /** $column.columnComment */
    private String id;

    /** 用户id */
    private String userUuid;

    /** 用户登记表 */
    private String vipId;

    /** vip进度 */
    private Long progress;

    /** 创建人 */
    private String creator;

    /** 创建时间 */
    private Date createdTime;

    /** 修改人 */
    private String updator;

    /** 修改时间 */
    private Date updatedTime;

    /** 是否生效 0失效 | 1生效 */
    private Long isValid;

}
