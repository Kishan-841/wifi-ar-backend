import { Pressable, StyleSheet, Text, View } from 'react-native';

export function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, big && styles.rowValueBig]}>{value}</Text>
    </View>
  );
}

export function Banner({ color, text }: { color: string; text: string }) {
  return (
    <View style={[styles.banner, { backgroundColor: color }]}>
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

export function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export const palette = {
  bg: '#0b1d2a',
  card: '#122b3d',
  accent: '#4fc3f7',
  muted: '#90a4ae',
  warn: '#e65100',
  error: '#b71c1c',
};

export const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowLabel: {
    color: palette.muted,
    fontSize: 14,
  },
  rowValue: {
    color: '#ffffff',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  rowValueBig: {
    fontSize: 22,
    fontWeight: 'bold',
    color: palette.accent,
  },
  banner: {
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 13,
  },
  button: {
    backgroundColor: '#1565c0',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
