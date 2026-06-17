import { View, Text, StyleSheet } from 'react-native'

export default function Dashboard() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SigortaOS</Text>

      <View style={styles.card}>
        <Text style={styles.number}>0</Text>
        <Text>Yeni Talep</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.number}>0</Text>
        <Text>Aktif Müşteri</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.number}>0</Text>
        <Text>Poliçe</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fb',
    padding: 20,
    paddingTop: 80,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 30,
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
  },
  number: {
    fontSize: 32,
    fontWeight: '700',
  },
})
