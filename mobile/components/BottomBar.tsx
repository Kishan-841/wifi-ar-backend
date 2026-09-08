import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from './anim';
import { useTheme } from './theme';

export type TabItem = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap };

/** Bottom navigation: icon + label per tab, active in the primary color. */
export default function BottomBar({
  items,
  active,
  onChange,
}: {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        // Sit above the system navigation bar (edge-to-edge on Android 15).
        { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: insets.bottom + 8 },
      ]}
    >
      {items.map((it) => {
        const isActive = it.key === active;
        const color = isActive ? theme.primary : theme.muted;
        return (
          <PressableScale key={it.key} onPress={() => onChange(it.key)} style={styles.item}>
            <Ionicons name={it.icon} size={22} color={color} />
            <Text style={[styles.label, { color, fontWeight: isActive ? '700' : '500' }]}>{it.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  label: {
    fontSize: 11,
  },
});
