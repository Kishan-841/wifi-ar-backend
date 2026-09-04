import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { FadeSlideIn, PressableScale } from './anim';

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
    <FadeSlideIn style={[styles.banner, { backgroundColor: color }]}>
      <Text style={styles.bannerText}>{text}</Text>
    </FadeSlideIn>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <PressableScale
      onPress={loading ? undefined : onPress}
      disabled={disabled || loading}
      style={[styles.button, styles[variant]]}
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" size="small" />
      ) : (
        <Text style={[styles.buttonText, variant === 'ghost' && styles.ghostText]}>{label}</Text>
      )}
    </PressableScale>
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
    fontSize: 24,
    fontWeight: '700',
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
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  primary: {
    backgroundColor: '#1565c0',
  },
  danger: {
    backgroundColor: '#b71c1c',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2a4a63',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  ghostText: {
    color: palette.muted,
  },
});
