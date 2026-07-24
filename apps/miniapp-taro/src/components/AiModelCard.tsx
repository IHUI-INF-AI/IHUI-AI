import { View, Text, Image } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'

export interface AiModelCardProps {
  name: string
  description?: string
  icon?: string
  tags?: string[]
  extra?: string
  onClick?: () => void
  className?: string
}

export default function AiModelCard({
  name,
  description = '',
  icon,
  tags = [],
  extra,
  onClick,
  className = '',
}: AiModelCardProps) {
  return (
    <View
      className={cn(
        'rounded-lg border border-border bg-card p-3 active:opacity-80',
        className
      )}
      onClick={onClick}
    >
      <View className="flex items-center gap-3">
        {icon ? (
          <Image
            src={icon}
            mode="aspectFill"
            className="w-12 h-12 rounded-md bg-muted"
          />
        ) : (
          <View className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
            <Text className="text-base font-medium text-primary">
              {name.charAt(0)}
            </Text>
          </View>
        )}
        <View className="flex-1 min-w-0">
          <View className="flex items-center justify-between gap-2">
            <Text className="text-sm font-medium text-foreground truncate">
              {name}
            </Text>
            {extra && (
              <Text className="text-xs text-muted-foreground shrink-0">
                {extra}
              </Text>
            )}
          </View>
          {description && (
            <Text className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {description}
            </Text>
          )}
        </View>
      </View>
      {tags.length > 0 && (
        <View className="flex flex-wrap gap-1.5 mt-2">
          {tags.map((tag, index) => (
            <View key={index} className="px-2 py-0.5 rounded-sm bg-primary/10">
              <Text className="text-[10px] text-primary">{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
