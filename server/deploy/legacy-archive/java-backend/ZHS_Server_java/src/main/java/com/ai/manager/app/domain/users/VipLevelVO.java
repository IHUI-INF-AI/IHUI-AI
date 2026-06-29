package com.ai.manager.app.domain.users;

import lombok.*;

@EqualsAndHashCode(callSuper = true)
@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class VipLevelVO extends VipLevel {
    private UserVip userVip;
}
