import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Banner, Button, card } from '../components/DebugUI';
import { useTheme } from '../components/theme';
import { login } from '../lib/api';

/** Accounts are created by the admin — no signup here, by design. */
export default function LoginScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={card(theme)}>
        <Text style={[styles.title, { color: theme.text }]}>Log in</Text>
        <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 12 }}>
          Use the account your admin created for you.
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text }]}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text }]}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={theme.muted}
          secureTextEntry
          onSubmitEditing={submit}
        />
        {error && <Banner color={theme.danger} text={error} />}
        <Button label="Log in" loading={busy} disabled={!email || !password} onPress={submit} />
        <Button label="Server settings" variant="ghost" onPress={onOpenSettings} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginTop: 8,
  },
});
