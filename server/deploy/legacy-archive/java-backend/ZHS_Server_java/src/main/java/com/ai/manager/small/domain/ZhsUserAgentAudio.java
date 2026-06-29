package com.ai.manager.small.domain;

import com.ai.manager.small.domain.dto.PageBean;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;

import java.util.Date;

/**
 * 用户音色对象 zhs_user_agent_audio
 * 
 * @author Raindrop_L
 * @date 2025-09-20
 */

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsUserAgentAudio extends PageBean
{
    private static final long serialVersionUID = 1L;

    /** $column.columnComment */
    private String id;

    /** 用户唯一标识 */
    private String uuid;

    /** 用户音频唯一标识 */
    private String audioId;

    /** 关联智能体id */
    private String agentId;

    /** 本地音频路径 */
    private String audioPath;

    /** 智能体来源 */
    private String source;

    /** 平台类型 */
    private String platform;

    /** 预留字段 */
    private String field1;

    /** 逻辑删除 0保留 | 1删除 */
    private Integer isDel;

    /** 创建时间 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:dd")
    private Date createdAt;

    /** 修改时间 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:dd")
    private Date updateAt;

    private String name;
    private String remark;

}
