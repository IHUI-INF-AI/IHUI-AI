package com.ai.manager.mcp.domain;

import com.ai.manager.small.domain.dto.PageBean;
import lombok.*;

import java.util.Date;

/**
 * AIGC专区管理对象 ai_gc
 * 
 * @author Raindrop_L
 * @date 2025-07-24
 */

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class AiGc extends PageBean
{
    private static final long serialVersionUID = 1L;

    /** uuid */
    private String id;

    /** 标题 */
    private String title;

    /** 副标题 */
    private String subtitle;

    /** 正文 */
    private String context;

    /** 文件上传路径 */
    private String fileUrl;

    /** 文件类型 0图片 1视频 */
    private Integer fileType;

    /** 封面图地址 */
    private String coverUrl;

    /** 赛道类型 */
    private String type;

    /** 是否弃用 0否，1是 */
    private Integer isDeprecated;

    /** $column.columnComment */
    private String field1;

    /** $column.columnComment */
    private String field2;

    /** 创建人 */
    private String creator;

    /** 创建时间 */
    private Date createdAt;

    /** 修改人 */
    private String updator;

    /** 修改时间 */
    private Date updatedAt;

}
