import { ActivityIndicator, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { FadeSlideIn, PressableScale } from './anim';
import { useTheme } from './theme';

export function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={layout.row}>
      <Text style={[layout.rowLabel, { color: theme.muted }]}>{label}</Text>
      <Text
        style={[
          layout.rowValue,
          { color: theme.text },
          big && [layout.rowValueBig, { color: theme.accent }],
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function Banner({ color, text }: { color: string; text: string }) {
  return (
    <FadeSlideIn style={[layout.banner, { backgroundColor: color }]}>
      <Text style={layout.bannerText}>{text}</Text>
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
  const { theme } = useTheme();
  const variantStyle: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: theme.primary }
      : variant === 'danger'
        ? { backgroundColor: theme.danger }
        : { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border };
  const textColor = variant === 'ghost' ? theme.muted : '#ffffff';

  return (
    <PressableScale
      onPress={loading ? undefined : onPress}
      disabled={disabled || loading}
      style={[layout.button, variantStyle]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? theme.accent : '#ffffff'} size="small" />
      ) : (
        <Text style={[layout.buttonText, { color: textColor }]}>{label}</Text>
      )}
    </PressableScale>
  );
}

/** Themed card style — use as: <View style={[card(theme)]}> */
export function card(theme: { card: string }): ViewStyle {
  return {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  };
}

/** Color-free layout constants shared across screens. */
export const layout = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowLabel: {
    fontSize: 14,
  },
  rowValue: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  rowValueBig: {
    fontSize: 24,
    fontWeight: '700',
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
  buttonText: {
    fontWeight: '600',
    fontSize: 15,
  },
});
