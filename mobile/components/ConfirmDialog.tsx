import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from './DebugUI';
import { useTheme } from './theme';

/**
 * Themed confirmation dialog — replaces Alert.alert. Use via useConfirm():
 *   const { confirm, dialog } = useConfirm();
 *   if (await confirm({ title, message, icon, destructive })) …
 *   …and render {dialog} once in the screen.
 */
export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
};

export function ConfirmDialog({
  visible,
  options,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  options: ConfirmOptions;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { theme } = useTheme();
  const accent = options.destructive ? theme.danger : theme.primary;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={[styles.card, { backgroundColor: theme.card }]} onPress={() => {}}>
          {options.icon && (
            <View style={[styles.iconCircle, { backgroundColor: accent + '22' }]}>
              <Ionicons name={options.icon} size={26} color={accent} />
            </View>
          )}
          <Text style={[styles.title, { color: theme.text }]}>{options.title}</Text>
          {options.message ? (
            <Text style={[styles.message, { color: theme.muted }]}>{options.message}</Text>
          ) : null}
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button label="Cancel" variant="ghost" onPress={onCancel} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={options.confirmLabel ?? 'Confirm'}
                variant={options.destructive ? 'danger' : 'primary'}
                onPress={onConfirm}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function useConfirm(): {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ options, resolve })),
    []
  );

  const finish = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  const dialog = (
    <ConfirmDialog
      visible={pending !== null}
      options={pending?.options ?? { title: '' }}
      onCancel={() => finish(false)}
      onConfirm={() => finish(true)}
    />
  );

  return { confirm, dialog };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
    marginTop: 8,
  },
});
