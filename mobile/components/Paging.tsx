import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from './DebugUI';
import { useTheme } from './theme';

/** Search field for paged lists: icon, clear button, no submit needed. */
export function SearchBar({
  value,
  onChange,
  placeholder = 'Search',
  busy,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  busy?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
      <Ionicons name="search-outline" size={18} color={theme.muted} />
      <TextInput
        style={[styles.searchInput, { color: theme.text }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
      />
      {busy ? (
        <ActivityIndicator size="small" color={theme.muted} />
      ) : value.length > 0 ? (
        <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={18} color={theme.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Footer for paged lists: "Showing 20 of 57" and a Load more button. */
export function LoadMore({
  shown,
  total,
  hasMore,
  loading,
  onPress,
  noun = 'items',
}: {
  shown: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  onPress: () => void;
  noun?: string;
}) {
  const { theme } = useTheme();
  if (total === 0) return null;
  return (
    <View style={styles.footer}>
      <Text style={[styles.count, { color: theme.muted }]}>
        Showing {shown} of {total} {noun}
      </Text>
      {hasMore && (
        <Button label="Load more" variant="ghost" loading={loading} onPress={onPress} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  footer: {
    alignItems: 'center',
    marginTop: 12,
    gap: 4,
  },
  count: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
