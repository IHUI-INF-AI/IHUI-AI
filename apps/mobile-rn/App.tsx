import { AppRegistry, View, Text } from 'react-native'

function App() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>IHUI AI - RN Test</Text>
    </View>
  )
}

AppRegistry.registerComponent('main', () => App)
