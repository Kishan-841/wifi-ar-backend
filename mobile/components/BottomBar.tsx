import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

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
  return (
    <View style={[styles.bar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
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
    paddingBottom: 18,
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
