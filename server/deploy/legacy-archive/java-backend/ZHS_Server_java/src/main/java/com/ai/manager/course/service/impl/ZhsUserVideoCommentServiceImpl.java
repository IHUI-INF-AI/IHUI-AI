package com.ai.manager.course.service.impl;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.apache.commons.collections.CollectionUtils;
import org.assertj.core.util.Lists;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ai.manager.course.mapper.ZhsUserVideoCommentMapper;
import com.ai.manager.course.domain.ZhsUserVideoComment;
import com.ai.manager.course.service.IZhsUserVideoCommentService;

/**
 * 用户评论Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@Service
public class ZhsUserVideoCommentServiceImpl implements IZhsUserVideoCommentService 
{
    @Autowired
    private ZhsUserVideoCommentMapper zhsUserVideoCommentMapper;

    /**
     * 查询用户评论
     * 
     * @param id 用户评论主键
     * @return 用户评论
     */
    @Override
    public ZhsUserVideoComment getById(String id)
    {
        return zhsUserVideoCommentMapper.getById(id);
    }

    /**
     * 查询用户评论列表
     * 
     * @param zhsUserVideoComment 用户评论
     * @return 用户评论
     */
    @Override
    public List<ZhsUserVideoComment> getList(ZhsUserVideoComment zhsUserVideoComment)
    {
        List<ZhsUserVideoComment> list = zhsUserVideoCommentMapper.getList(zhsUserVideoComment);

        if(CollectionUtils.isNotEmpty(list)){
            List<String> parentIds = list.stream().map(ZhsUserVideoComment::getId).collect(Collectors.toList());
            List<ZhsUserVideoComment> clist = zhsUserVideoCommentMapper.getListByParentIds(parentIds);
            if(CollectionUtils.isNotEmpty(clist)) {
                Map<String, List<ZhsUserVideoComment>> collect = clist.stream().collect(Collectors.groupingBy(ZhsUserVideoComment::getParentId));
                list.forEach(item -> item.setVideoComments(collect.get(item.getId())));
            }
        }

        return list;
    }

    /**
     * 新增用户评论
     * 
     * @param zhsUserVideoComment 用户评论
     * @return 结果
     */
    @Override
    public int add(ZhsUserVideoComment zhsUserVideoComment)
    {
        return zhsUserVideoCommentMapper.addZhsUserVideoComment(zhsUserVideoComment);
    }

    /**
     * 修改用户评论
     * 
     * @param zhsUserVideoComment 用户评论
     * @return 结果
     */
    @Override
    public int edit(ZhsUserVideoComment zhsUserVideoComment)
    {
        return zhsUserVideoCommentMapper.edit(zhsUserVideoComment);
    }

    /**
     * 批量删除用户评论
     *
     * @param ids    需要删除的用户评论主键
     * @param userId
     * @return 结果
     */
    @Override
    public int delByIds(String[] ids, String userId)
    {
        return zhsUserVideoCommentMapper.delByIds(ids, userId);
    }

    /**
     * 删除用户评论信息
     * 
     * @param id 用户评论主键
     * @return 结果
     */
    @Override
    public int delById(String id)
    {
        return zhsUserVideoCommentMapper.delById(id);
    }

    @Override
    public List<ZhsUserVideoComment> getListByParentIds(String number) {

        return zhsUserVideoCommentMapper.getListByParentIds(Lists.newArrayList(number));
    }
}
