import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Banner, Button, card } from '../components/DebugUI';
import { useTheme } from '../components/theme';
import { useKeyboardHeight } from '../components/useKeyboard';
import { adminCreateUser } from '../lib/api';

export default function CreateUserScreen({ onDone, onCancel }: { onDone: (name: string) => void; onCancel: () => void }) {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    if (keyboardHeight > 0) scrollRef.current?.scrollToEnd({ animated: true });
  }, [keyboardHeight]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const u = await adminCreateUser(name, email, password);
      onDone(u.name);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: theme.inputBg, color: theme.text }];

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[styles.scroll, { paddingBottom: 40 + keyboardHeight }]}
      keyboardShouldPersistTaps="handled"
    >
      <Button label="← Users" variant="ghost" onPress={onCancel} />
      <View style={card(theme)}>
        <Text style={[styles.title, { color: theme.text }]}>New user</Text>
        <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 4 }}>
          They'll log in with this email and password. There's no self-signup.
        </Text>
        <Text style={[styles.label, { color: theme.muted }]}>Name</Text>
        <TextInput style={inputStyle} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={theme.muted} />
        <Text style={[styles.label, { color: theme.muted }]}>Email</Text>
        <TextInput
          style={inputStyle}
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <Text style={[styles.label, { color: theme.muted }]}>Password</Text>
        <TextInput
          style={inputStyle}
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          placeholderTextColor={theme.muted}
          secureTextEntry
        />
        {error && <Banner color={theme.danger} text={error} />}
        <Button
          label="Create user"
          loading={busy}
          disabled={!name.trim() || !email.trim() || password.length < 8}
          onPress={create}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
});
