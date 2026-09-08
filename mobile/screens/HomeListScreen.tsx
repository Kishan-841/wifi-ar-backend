import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useConfirm } from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { Banner, Button } from '../components/DebugUI';
import { IconBadge, IconButton, ListGroup, ListItem } from '../components/ListItem';
import { useTheme } from '../components/theme';
import { LayoutSummary, createLayout, deleteLayout, listLayouts } from '../lib/api';
import HomeScreen from './HomeScreen';

/** Home tab: your saved homes first, "add new home" below; tap one to edit. */
export default function HomeListScreen() {
  const { theme } = useTheme();
  const [homes, setHomes] = useState<LayoutSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setHomes(await listLayouts());
    } catch (e) {
      setError(String(e));
      setHomes([]);
    }
  }, []);

  useEffect(() => {
    if (!openId) refresh();
  }, [refresh, openId]);

  const create = useCallback(async () => {
    const name = nameDraft.trim();
    if (!name) return;
    setCreating(true);
    try {
      const lay = await createLayout(name, 32, 32);
      setNaming(false);
      setNameDraft('');
      setOpenId(lay.id);
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  }, [nameDraft]);

  if (openId) {
    return <HomeScreen layoutId={openId} onBack={() => setOpenId(null)} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {error && <Banner color={theme.danger} text={error} />}
        {homes === null && <ActivityIndicator color={theme.accent} size="large" />}
        {homes?.length === 0 && (
          <EmptyState
            icon="home-outline"
            title="No homes yet"
            message="Add a home, then place your scanned rooms on its map."
            actionLabel="+ Add new home"
            onAction={() => setNaming(true)}
          />
        )}
        {homes && homes.length > 0 && (
          <ListGroup>
            {homes.map((h, i) => (
              <ListItem
                key={h.id}
                last={i === homes.length - 1}
                leading={<IconBadge name="home-outline" color={theme.primary} />}
                title={h.name}
                subtitle={`${h.placementCount} room${h.placementCount === 1 ? '' : 's'} placed · grid ${h.cols}×${h.rows}`}
                onPress={() => setOpenId(h.id)}
                trailing={
                  <IconButton
                    name="trash-outline"
                    color={theme.danger}
                    onPress={async () => {
                      const ok = await confirm({
                        title: `Delete ${h.name}?`,
                        message: 'The home map layout will be removed. Room recordings are kept.',
                        confirmLabel: 'Delete',
                        icon: 'trash-outline',
                        destructive: true,
                      });
                      if (!ok) return;
                      try {
                        await deleteLayout(h.id);
                        refresh();
                      } catch (e) {
                        setError(String(e));
                      }
                    }}
                  />
                }
              />
            ))}
          </ListGroup>
        )}
        {homes && homes.length > 0 && (
          <>
            <View style={{ height: 14 }} />
            <Button label="+ Add new home" onPress={() => setNaming(true)} />
          </>
        )}
      </ScrollView>

      <Modal visible={naming} transparent animationType="fade" onRequestClose={() => setNaming(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Name this home</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text }]}
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="e.g. My flat"
              placeholderTextColor={theme.muted}
              autoFocus
              onSubmitEditing={create}
            />
            <Button label="Create" loading={creating} disabled={!nameDraft.trim()} onPress={create} />
            <Button label="Cancel" variant="ghost" onPress={() => setNaming(false)} />
          </View>
        </View>
      </Modal>
      {confirmDialog}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 32,
  },
  modalCard: {
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  modalInput: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
});
