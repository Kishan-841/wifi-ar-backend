import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PressableScale } from '../components/anim';
import { Banner, Button } from '../components/DebugUI';
import { useTheme } from '../components/theme';
import { useKeyboardHeight } from '../components/useKeyboard';
import { login } from '../lib/api';

/** Accounts are created by the admin — no signup here, by design. */
export default function LoginScreen() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    if (keyboardHeight > 0) scrollRef.current?.scrollToEnd({ animated: true });
  }, [keyboardHeight]);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
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

  const fieldStyle = [styles.field, { backgroundColor: theme.inputBg, borderColor: theme.border }];

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingBottom: 48 + keyboardHeight }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand mark — the one bold element on this screen */}
        <View style={styles.brand}>
          <View style={[styles.mark, { backgroundColor: theme.primary }]}>
            <Ionicons name="wifi" size={40} color="#ffffff" />
          </View>
          <Text style={[styles.appName, { color: theme.text }]}>WiFi AR</Text>
          <Text style={[styles.tagline, { color: theme.muted }]}>Map your Wi-Fi, room by room.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.heading, { color: theme.text }]}>Welcome back</Text>

          <Text style={[styles.label, { color: theme.muted }]}>Email</Text>
          <View style={fieldStyle}>
            <Ionicons name="mail-outline" size={18} color={theme.muted} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </View>

          <Text style={[styles.label, { color: theme.muted }]}>Password</Text>
          <View style={fieldStyle}>
            <Ionicons name="lock-closed-outline" size={18} color={theme.muted} />
            <TextInput
              ref={passwordRef}
              style={[styles.input, { color: theme.text }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor={theme.muted}
              secureTextEntry={!showPassword}
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <PressableScale onPress={() => setShowPassword((v) => !v)} style={styles.eye}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.muted} />
            </PressableScale>
          </View>

          {error && <Banner color={theme.danger} text={error} />}

          <Button label="Log in" loading={busy} disabled={!canSubmit} onPress={submit} />
        </View>

        <Text style={[styles.footer, { color: theme.muted }]}>
          Accounts are created by your admin. Ask them if you need one.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 48,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 28,
  },
  mark: {
    width: 84,
    height: 84,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    transform: [{ rotate: '-8deg' }],
  },
  appName: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  eye: {
    padding: 6,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 20,
  },
});
