import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../store.js';
import { Btn, Input } from '../ui.js';
import { LANGUAGES } from '../shared/i18n/index.js';

export function LangChips() {
  const { lang, setLang, colors } = useApp();
  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginVertical: 6 }}>
      {LANGUAGES.map((l) => (
        <Pressable key={l.code} onPress={() => setLang(l.code)} style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, backgroundColor: l.code === lang ? colors.c1 : colors.chip }}>
          <Text style={{ color: l.code === lang ? '#fff' : colors.text, fontWeight: '600' }}>{l.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function Login() {
  const { t, api, signIn, errText, lang, colors } = useApp();
  const [reg, setReg] = useState(false);
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState({ text: '', ok: false });
  const [busy, setBusy] = useState(false);
  useEffect(() => setMsg({ text: '', ok: false }), [lang, reg]);

  async function submit() {
    if (busy) return;
    if (!id.trim() || !pw) return setMsg({ text: t('e_missing_fields'), ok: false });
    setBusy(true);
    try {
      const r = reg
        ? await api.register({ email: id.trim(), password: pw, name, username, phone, lang })
        : await api.login(id.trim(), pw);
      await signIn(r.token, r.user);
    } catch (e) { setMsg({ text: errText(e), ok: false }); }
    setBusy(false);
  }
  async function forgot() {
    if (!id.trim()) return setMsg({ text: t('enterIdFirst'), ok: false });
    try { const r = await api.forgot(id.trim()); setMsg({ text: t('resetSent', { email: r.email }), ok: true }); }
    catch (e) { setMsg({ text: errText(e), ok: false }); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 10 }} keyboardShouldPersistTaps="handled">
          <Image source={require('../../assets/icon.png')} style={{ width: 84, height: 84, borderRadius: 22, alignSelf: 'center' }} />
          <Text style={{ fontSize: 34, fontWeight: '700', color: colors.c1, textAlign: 'center' }}>{t('appName')}</Text>
          <Text style={{ color: colors.muted, textAlign: 'center' }}>{t('tagline')}</Text>
          <LangChips />
          <Input placeholder={reg ? t('email') : t('loginId')} value={id} onChangeText={setId} autoCapitalize="none" keyboardType={reg ? 'email-address' : 'default'} />
          {reg && <Input placeholder={t('yourName')} value={name} onChangeText={setName} maxLength={30} />}
          {reg && <Input placeholder={t('username')} value={username} onChangeText={setUsername} autoCapitalize="none" />}
          {reg && <Input placeholder={t('mobileOptional')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />}
          <Input placeholder={t('password')} value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" onSubmitEditing={submit} />
          <Btn primary title={reg ? t('register') : t('login')} onPress={submit} disabled={busy} />
          {!reg && <Pressable onPress={forgot}><Text style={{ color: colors.c1, textAlign: 'center', padding: 6 }}>{t('forgot')}</Text></Pressable>}
          <Pressable onPress={() => setReg(!reg)}><Text style={{ color: colors.c1, textAlign: 'center', padding: 6 }}>{reg ? t('haveAccount') : t('newHere')}</Text></Pressable>
          {!!msg.text && <Text style={{ color: msg.ok ? '#1a9d6c' : '#e5484d', textAlign: 'center' }}>{msg.text}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
