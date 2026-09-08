import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';

import { apiBase } from '../lib/api';
import { checkServer, getServerUrl, setServerUrl } from '../lib/settings';
import { Banner, Button } from './DebugUI';
import { useTheme } from './theme';

/** Where the app sends its data. Editable so a release build never needs a rebuild to follow the backend. */
export default function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    if (visible) {
      setDraft(getServerUrl() ?? '');
      setStatus('idle');
    }
  }, [visible]);

  const test = async () => {
    setStatus('testing');
    setStatus((await checkServer(draft || apiBase())) ? 'ok' : 'fail');
  };

  const save = async () => {
    await setServerUrl(draft);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.title, { color: theme.text }]}>Server</Text>
          <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 8 }}>
            Where scans and home maps are stored. Currently using: {apiBase()}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text }]}
            value={draft}
            onChangeText={(t) => {
              setDraft(t);
              setStatus('idle');
            }}
            placeholder="https://your-server.example.com"
            placeholderTextColor={theme.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          {status === 'ok' && <Banner color={theme.success} text="Connected ✓" />}
          {status === 'fail' && <Banner color={theme.danger} text="No response from that server" />}
          <Button label="Test connection" variant="ghost" loading={status === 'testing'} onPress={test} />
          <Button label="Save" onPress={save} />
          <Button
            label="Use built-in default"
            variant="ghost"
            onPress={async () => {
              await setServerUrl(null);
              onClose();
            }}
          />
          <Button label="Cancel" variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    borderRadius: 12,
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
});
