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
    <View className="bg-white mx-3 my-3 rounded-xl overflow-hidden">
      <View className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <Text className="text-sm font-medium text-gray-800">我的团队</Text>
        <Text className="text-xs text-gray-400">{totalCount ?? members.length} 人</Text>
      </View>

      <ScrollView scrollY style={{ maxHeight: '40vh' }}>
        {loading ? (
          <View className="py-8 text-center">
            <Text className="text-sm text-gray-400">加载中...</Text>
          </View>
        ) : members.length === 0 ? (
          <EmptyState text="暂无团队成员" />
        ) : (
          members.map((member) => (
            <View
              key={member.id}
              className="flex items-center px-4 py-3 border-b border-gray-50"
              onClick={() => onViewDetail?.(member)}
            >
              <Avatar src={member.avatar} name={member.name} size="md" />
              <View className="flex-1 ml-3 min-w-0">
                <View className="flex items-center">
                  <Text className="text-sm font-medium text-gray-800 truncate">{member.name}</Text>
                  {member.level && (
                    <Text className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500">
                      L{member.level}
                    </Text>
                  )}
                </View>
                {member.joinedAt && (
                  <Text className="block text-xs text-gray-400 mt-0.5">
                    加入于 {member.joinedAt}
                  </Text>
                )}
              </View>
              <View className="text-right">
                {member.earnings !== undefined && (
                  <Text className="block text-sm font-medium text-green-600">
                    ¥{member.earnings.toFixed(2)}
                  </Text>
                )}
                <Text
                  className={`text-xs ${member.status === 'active' ? 'text-green-500' : 'text-gray-400'}`}
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
