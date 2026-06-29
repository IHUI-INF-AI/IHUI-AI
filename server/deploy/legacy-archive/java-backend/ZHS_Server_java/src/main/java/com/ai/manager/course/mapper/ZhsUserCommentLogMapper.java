package com.ai.manager.course.mapper;

import java.util.List;
import com.ai.manager.course.domain.ZhsUserCommentLog;
import com.baomidou.dynamic.datasource.annotation.DS;

/**
 * 用户评论点赞记录Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@DS("course")
public interface ZhsUserCommentLogMapper 
{
    /**
     * 查询用户评论点赞记录
     * 
     * @param id 用户评论点赞记录主键
     * @return 用户评论点赞记录
     */
    public ZhsUserCommentLog getById(Integer id);

    /**
     * 查询用户评论点赞记录列表
     * 
     * @param zhsUserCommentLog 用户评论点赞记录
     * @return 用户评论点赞记录集合
     */
    public List<ZhsUserCommentLog> getList(ZhsUserCommentLog zhsUserCommentLog);

    /**
     * 新增用户评论点赞记录
     * 
     * @param zhsUserCommentLog 用户评论点赞记录
     * @return 结果
     */
    public int addZhsUserCommentLog(ZhsUserCommentLog zhsUserCommentLog);

    /**
     * 修改用户评论点赞记录
     * 
     * @param zhsUserCommentLog 用户评论点赞记录
     * @return 结果
     */
    public int edit(ZhsUserCommentLog zhsUserCommentLog);

    /**
     * 删除用户评论点赞记录
     * 
     * @param id 用户评论点赞记录主键
     * @return 结果
     */
    public int delById(Integer id);

    /**
     * 批量删除用户评论点赞记录
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int delByIds(Integer[] ids);
}
