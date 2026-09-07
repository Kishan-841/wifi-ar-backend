import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FadeSlideIn, PressableScale } from '../components/anim';
import { Banner, Button, card } from '../components/DebugUI';
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
          <Banner color={theme.info} text="No homes yet — add one below, then place your scanned rooms." />
        )}
        {homes?.map((h, i) => (
          <FadeSlideIn key={h.id} delay={Math.min(i * 40, 200)}>
            <PressableScale onPress={() => setOpenId(h.id)} style={[card(theme), styles.homeCard]}>
              <View style={styles.homeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.homeTitle, { color: theme.accent }]}>{h.name}</Text>
                  <Text style={[styles.homeMeta, { color: theme.muted }]}>
                    {h.placementCount} room{h.placementCount === 1 ? '' : 's'} placed · grid {h.cols}×{h.rows}
                  </Text>
                </View>
                <Text
                  style={[styles.deleteX, { color: theme.muted }]}
                  onPress={async () => {
                    try {
                      await deleteLayout(h.id);
                      refresh();
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                >
                  ✕
                </Text>
              </View>
            </PressableScale>
          </FadeSlideIn>
        ))}

        <Button label="+ Add new home" onPress={() => setNaming(true)} />
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
  homeCard: {
    marginTop: 10,
  },
  homeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  homeTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  homeMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  deleteX: {
    fontSize: 18,
    paddingHorizontal: 10,
    paddingVertical: 4,
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
