package com.ai.manager.course.mapper;

import java.util.List;
import com.ai.manager.course.domain.ZhsUserVideoComment;
import com.baomidou.dynamic.datasource.annotation.DS;
import org.apache.ibatis.annotations.Param;

/**
 * 用户评论Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@DS("course")
public interface ZhsUserVideoCommentMapper 
{
    /**
     * 查询用户评论
     * 
     * @param id 用户评论主键
     * @return 用户评论
     */
    public ZhsUserVideoComment getById(String id);

    /**
     * 查询用户评论列表
     * 
     * @param zhsUserVideoComment 用户评论
     * @return 用户评论集合
     */
    public List<ZhsUserVideoComment> getList(ZhsUserVideoComment zhsUserVideoComment);

    /**
     * 新增用户评论
     * 
     * @param zhsUserVideoComment 用户评论
     * @return 结果
     */
    public int addZhsUserVideoComment(ZhsUserVideoComment zhsUserVideoComment);

    /**
     * 修改用户评论
     * 
     * @param zhsUserVideoComment 用户评论
     * @return 结果
     */
    public int edit(ZhsUserVideoComment zhsUserVideoComment);

    /**
     * 删除用户评论
     * 
     * @param id 用户评论主键
     * @return 结果
     */
    public int delById(String id);

    /**
     * 批量删除用户评论
     *
     * @param ids    需要删除的数据主键集合
     * @param userId
     * @return 结果
     */
    public int delByIds(@Param("ids") String[] ids, @Param("userId") String userId);

    List<ZhsUserVideoComment> getListByParentIds(@Param("parentIds") List<String> parentIds);
}
