import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native'
import { useNotificationStore } from '../stores/notification'

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

export default function NotificationPanel() {
  const { notifications, visible, markAllRead, setVisible, clearAll } = useNotificationStore()

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => setVisible(false)}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
        <TouchableOpacity
          style={styles.panel}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={styles.title}>通知</Text>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.btn} onPress={markAllRead}>
                <Text style={styles.btnText}>全部已读</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={clearAll}>
                <Text style={styles.btnText}>清空</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setVisible(false)}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={[styles.item, !item.isRead && styles.itemUnread]}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                {item.content ? <Text style={styles.itemContent}>{item.content}</Text> : null}
                <Text style={styles.itemTime}>{formatTime(item.createdAt)}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>暂无通知</Text>}
            contentContainerStyle={styles.list}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    minHeight: '40%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  btnText: {
    fontSize: 12,
    color: '#374151',
  },
  closeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  closeText: {
    fontSize: 20,
    color: '#6b7280',
    lineHeight: 22,
  },
  list: {
    padding: 8,
  },
  empty: {
    paddingVertical: 40,
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 13,
  },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  itemUnread: {
    backgroundColor: '#f3f4f6',
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  itemContent: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  itemTime: {
    fontSize: 11,
    color: '#9ca3af',
  },
})
