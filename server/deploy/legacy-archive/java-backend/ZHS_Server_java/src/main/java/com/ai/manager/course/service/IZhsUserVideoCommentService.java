package com.ai.manager.course.service;

import java.util.List;
import com.ai.manager.course.domain.ZhsUserVideoComment;

/**
 * 用户评论Service接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
public interface IZhsUserVideoCommentService
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
    public int add(ZhsUserVideoComment zhsUserVideoComment);

    /**
     * 修改用户评论
     * 
     * @param zhsUserVideoComment 用户评论
     * @return 结果
     */
    public int edit(ZhsUserVideoComment zhsUserVideoComment);

    /**
     * 批量删除用户评论
     *
     * @param ids    需要删除的用户评论主键集合
     * @param userId
     * @return 结果
     */
    public int delByIds(String[] ids, String userId);

    /**
     * 删除用户评论信息
     * 
     * @param id 用户评论主键
     * @return 结果
     */
    public int delById(String id);

    List<ZhsUserVideoComment> getListByParentIds(String number);
}
