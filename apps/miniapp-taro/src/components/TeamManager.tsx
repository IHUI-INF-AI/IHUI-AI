import { View, Text, ScrollView } from '@tarojs/components'
import EmptyState from './EmptyState'
import Avatar from './Avatar'

export interface TeamMember {
  id: string
  name: string
  avatar?: string
  level?: number
  joinedAt?: string
  earnings?: number
  status?: 'active' | 'inactive'
}

export interface TeamManagerProps {
  members?: TeamMember[]
  loading?: boolean
  totalCount?: number
  onViewDetail?: (member: TeamMember) => void
}

export default function TeamManager({
  members = [],
  loading = false,
  totalCount,
  onViewDetail,
}: TeamManagerProps) {
  return (
    <View className="bg-card mx-3 my-3 rounded-xl overflow-hidden">
      <View className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Text className="text-sm font-medium text-foreground">我的团队</Text>
        <Text className="text-xs text-muted-foreground">{totalCount ?? members.length} 人</Text>
      </View>

      <ScrollView scrollY style={{ maxHeight: '40vh' }}>
        {loading ? (
          <View className="py-8 text-center">
            <Text className="text-sm text-muted-foreground">加载中...</Text>
          </View>
        ) : members.length === 0 ? (
          <EmptyState text="暂无团队成员" />
        ) : (
          members.map((member) => (
            <View
              key={member.id}
              className="flex items-center px-4 py-3 border-b border-border"
              onClick={() => onViewDetail?.(member)}
            >
              <Avatar src={member.avatar} name={member.name} size="md" />
              <View className="flex-1 ml-3 min-w-0">
                <View className="flex items-center">
                  <Text className="text-sm font-medium text-foreground truncate">{member.name}</Text>
                  {member.level && (
                    <Text className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      L{member.level}
                    </Text>
                  )}
                </View>
                {member.joinedAt && (
                  <Text className="block text-xs text-muted-foreground mt-0.5">
                    加入于 {member.joinedAt}
                  </Text>
                )}
              </View>
              <View className="text-right">
                {member.earnings !== undefined && (
                  <Text className="block text-sm font-medium text-primary">
                    ¥{member.earnings.toFixed(2)}
                  </Text>
                )}
                <Text
                  className={`text-xs ${member.status === 'active' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {member.status === 'active' ? '活跃' : '不活跃'}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}
