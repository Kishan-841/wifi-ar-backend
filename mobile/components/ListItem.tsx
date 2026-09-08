import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from './anim';
import { useTheme } from './theme';

/**
 * Material-style list items: leading avatar/icon, headline, supporting text,
 * trailing action — grouped in one container with hairline dividers.
 */

export function ListGroup({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>{children}</View>
  );
}

export function ListItem({
  leading,
  title,
  titleAccessory,
  subtitle,
  meta,
  trailing,
  onPress,
  last,
}: {
  leading?: ReactNode;
  title: string;
  titleAccessory?: ReactNode;
  subtitle?: string;
  meta?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const { theme } = useTheme();
  const body = (
    <View style={[styles.item, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
      {leading && <View style={styles.leading}>{leading}</View>}
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          {titleAccessory}
        </View>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text style={[styles.meta, { color: theme.muted }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing && <View style={styles.trailing}>{trailing}</View>}
    </View>
  );
  return onPress ? <PressableScale onPress={onPress}>{body}</PressableScale> : body;
}

/** Initials in a colored circle — a stable color per name. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const palette = ['#0EA5E9', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#14B8A6'];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const color = palette[h % palette.length];
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initials || '?'}</Text>
    </View>
  );
}

/** Icon in a tinted circle, for non-person items. */
export function IconBadge({ name, color, size = 40 }: { name: keyof typeof Ionicons.glyphMap; color: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color + '22' }]}>
      <Ionicons name={name} size={size * 0.5} color={color} />
    </View>
  );
}

/** Small round icon button for trailing actions (delete, chevron…). */
export function IconButton({
  name,
  color,
  onPress,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress?: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={styles.iconButton} disabled={!onPress}>
      <Ionicons name={name} size={20} color={color} />
    </PressableScale>
  );
}

export function Chip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: color }]}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  leading: {
    width: 40,
    alignItems: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 13,
  },
  meta: {
    fontSize: 12,
  },
  trailing: {
    marginLeft: 4,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
});
