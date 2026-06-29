package com.ai.manager.small.domain;

import lombok.*;

import java.io.Serializable;
import java.util.Date;

/**
 * 用户VIP进度对象 zhs_user_vip
 * 
 * @author Raindrop_L
 * @date 2025-06-09
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@ToString
@Builder
public class ZhsUserVip implements Serializable
{
    private static final long serialVersionUID = 1L;

    /** $column.columnComment */
    private String id;

    /** 用户id */
    private String userId;

    /** 用户小程序open_id */
    private String openId;

    /** 用户登记表 */
    private String vipId;

    /** vip进度 */
    private Integer progress;

    /** 创建人 */
    private String creator;

    /** 创建时间 */
    private Date createdTime;

    /** 修改人 */
    private String updator;

    /** 修改时间 */
    private Date updatedTime;

}
