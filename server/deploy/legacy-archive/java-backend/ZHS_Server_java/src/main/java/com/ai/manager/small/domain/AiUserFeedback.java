package com.ai.manager.small.domain;

import com.ai.manager.small.domain.dto.PageBean;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;

import java.util.Date;

/**
 * 用户反馈对象 ai_user_feedback
 * 
 * @author Raindrop_L
 * @date 2025-09-12
 */

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class AiUserFeedback extends PageBean
{
    private static final long serialVersionUID = 1L;

    /** $column.columnComment */
    private Integer id;

    /** 标题 */
   
    private String title;

    /** 正文 */
   
    private String context;

    /** 图片（预留） */
   
    private String filePath;

    /** 状态 0反馈中 | 1敬请期待 | 2方案回答 | 3已解决 */
   
    private Integer status;

    /** 逻辑删除 0保留 | 1删除 */
    private Integer isDel;

    /** 回馈文本 */
   
    private String feedback;

    /** 回馈图片（预留） */
   
    private String feedbackPath;

    /** 创建人 */
   
    private String creator;

    /** 创建时间 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:dd")
   
    private Date createdAt;

    /** 处理时间 */
    private Date updatedAt;

    private String phone;
    private String username;

}
