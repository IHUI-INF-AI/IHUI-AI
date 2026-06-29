package com.ai.manager.course.domain;

import com.ai.manager.small.domain.dto.PageBean;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;

import java.util.Date;

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsUserVideoLog extends PageBean {
    private static final long serialVersionUID = 1L;

    /**
     * id
     */
    private Integer id;

    /**
     * 课程视频表id
     */

    private String videoId;

    /**
     * 用户唯一标识
     */

    private String userUuid;

    /**
     * 操作类型 0分享 | 1点赞 | 2收藏
     */

    private Integer type;

    /**
     * 平台唯一标识
     */

    private String platformId;

    /**
     * 用户操作时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date createdAt;

}
