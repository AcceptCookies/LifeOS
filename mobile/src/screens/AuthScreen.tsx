import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, savedCreds } from '../api';

const MONO = 'Courier New';

interface Props {
  onAuth: () => void;
}

export default function AuthScreen({ onAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberCreds, setRememberCreds] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const savedEmail = await savedCreds.getEmail();
      const savedPassword = await savedCreds.getPassword();
      if (savedEmail && savedPassword) {
        setEmail(savedEmail);
        setPassword(savedPassword);
        setRememberCreds(true);
        try {
          await api.login(savedEmail, savedPassword);
          onAuth();
          return;
        } catch {
          // fall through to show form
        }
      } else if (savedEmail) {
        setEmail(savedEmail);
        setRememberCreds(true);
      }
      setLoading(false);
    })();
  }, []);

  async function submit() {
    if (!email.trim() || !password.trim()) return;
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        if (rememberCreds) {
          await savedCreds.set(email.trim(), password);
        } else {
          await savedCreds.clear();
        }
        await api.login(email.trim(), password);
      } else {
        if (password.length < 8) {
          setError('Heslo musí mať aspoň 8 znakov');
          setLoading(false);
          return;
        }
        await api.register(email.trim(), password);
      }
      onAuth();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={S.page}>
        <ActivityIndicator color="#22c55e" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.page}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled">
          <View style={S.box}>
            <Text style={S.title}>LifeOS</Text>
            <Text style={S.subtitle}>
              {mode === 'login' ? 'Prihlásiť sa' : 'Registrovať sa'}
            </Text>

            <TextInput
              style={S.input}
              placeholder="Email"
              placeholderTextColor="#333"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={S.input}
              placeholder="Heslo"
              placeholderTextColor="#333"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              onSubmitEditing={submit}
              returnKeyType="done"
            />

            {mode === 'login' && (
              <TouchableOpacity style={S.checkRow} onPress={() => setRememberCreds(v => !v)}>
                <View style={[S.checkbox, rememberCreds && S.checkboxChecked]}>
                  {rememberCreds && <Text style={S.checkmark}>✓</Text>}
                </View>
                <Text style={S.checkLabel}>Pamätať prihlasov. údaje</Text>
              </TouchableOpacity>
            )}

            {!!error && <Text style={S.error}>{error}</Text>}

            <TouchableOpacity style={S.btn} onPress={submit} disabled={loading}>
              <Text style={S.btnText}>
                {mode === 'login' ? 'Prihlásiť' : 'Registrovať'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={S.toggle}
              onPress={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}
            >
              <Text style={S.toggleText}>
                {mode === 'login' ? 'Nemáš účet? Registruj sa' : 'Už máš účet? Prihlás sa'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  box: {
    width: '100%',
    maxWidth: 360,
    padding: 32,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 5,
    fontFamily: MONO,
    color: '#f0f0f0',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#444',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#0c0c0c',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: '#e8e8e8',
    fontSize: 15,
    marginBottom: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#333',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: '#22c55e',
    backgroundColor: '#0a1a0a',
  },
  checkmark: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  checkLabel: { color: '#555', fontSize: 12 },
  error: {
    color: '#ef4444',
    fontSize: 13,
    paddingVertical: 8,
  },
  btn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#22c55e33',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  btnText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
  toggle: {
    marginTop: 24,
    alignItems: 'center',
  },
  toggleText: {
    color: '#333',
    fontSize: 12,
  },
});
