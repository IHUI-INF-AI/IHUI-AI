package com.ai.manager.app.domain.users;

import lombok.*;

import java.util.Date;

/**
 * 用户资金账户对象 user_fund_info
 * 
 * @author Raindrop_L
 * @date 2025-06-25
 */

@Data
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class UserFundInfo
{
    private static final long serialVersionUID = 1L;

    /** $column.columnComment */
    private Long id;

    /** 用户UUID */
    private String userUuid;

    /** 卡号 */
    private String card;

    /** 归属银行 */
    private String belong;

    /** 开户行头 */
    private String title;

    /** 卡信息 */
    private String message;

    /** 创建时间 */
    private Date createdAt;

    /** 创建时间 */
    private Date updatedAt;

}
