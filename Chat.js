import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Audio, Video, ResizeMode } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp, useFmt } from '../store.js';
import { ActionSheet, Avatar, Screen } from '../ui.js';
import { useCall } from '../CallProvider.js';
import { pickMedia, uploadFile } from '../media.js';
import { previewOf } from './Chats.js';

function AudioMsg({ url }) {
  const { api, colors } = useApp();
  const snd = useRef(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => { snd.current && snd.current.unloadAsync(); }, []);
  const toggle = async () => {
    if (!snd.current) {
      const { sound } = await Audio.Sound.createAsync({ uri: api.abs(url) }, { shouldPlay: true }, (st) => { if (st.didJustFinish) setPlaying(false); });
      snd.current = sound; setPlaying(true); return;
    }
    if (playing) { await snd.current.pauseAsync(); setPlaying(false); } else { await snd.current.replayAsync(); setPlaying(true); }
  };
  return <Pressable onPress={toggle}><Text style={{ color: colors.text, fontSize: 16 }}>{playing ? '⏸' : '▶️'} 🎤 ───────</Text></Pressable>;
}

const streakOf = (msgs) => {
  const days = {};
  msgs.forEach((m) => { const d = new Date(m.createdAt).toDateString(); (days[d] = days[d] || new Set()).add(m.from); });
  const ok = (x) => days[x.toDateString()] && days[x.toDateString()].size >= 2;
  const d = new Date(); let n = 0;
  if (!ok(d)) d.setDate(d.getDate() - 1);
  while (ok(d)) { n++; d.setDate(d.getDate() - 1); }
  return n;
};

export default function Chat() {
  const { peer } = useRoute().params;
  const { t, api, me, socket, rel, colors, toast, errText } = useApp();
  const nav = useNavigation();
  const { startCall } = useCall();
  const fmt = useFmt();
  const [msgs, setMsgs] = useState(null);
  const [peerRead, setPeerRead] = useState(null);
  const [presence, setPresence] = useState({ online: false, lastSeen: null });
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [menu, setMenu] = useState(null);
  const [more, setMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [needle, setNeedle] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(null);
  const list = useRef(null);
  const lastTap = useRef({ id: null, t: 0 });
  const typingOn = useRef(false);
  const typingTimer = useRef(null);
  const restricted = rel.restricted.includes(peer.id);

  const markRead = useCallback(() => api.markRead(peer.id).catch(() => {}), [api, peer.id]);
  const load = useCallback(async () => {
    try { const r = await api.messages(peer.id); setMsgs(r.messages); setPeerRead(r.peerLastRead); setPresence(r.peer); markRead(); }
    catch (e) { toast(errText(e)); setMsgs((m) => m || []); }
  }, [api, peer.id, markRead, toast, errText]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.emit('presence:watch', { userId: peer.id }, (res) => res && !res.error && setPresence(res));
    const inChat = (m) => m && m.chatId && m.chatId.split('_').includes(peer.id);
    const onNew = ({ message }) => { if (!inChat(message)) return; setMsgs((l) => (l && !l.some((x) => x.id === message.id) ? [...l, message] : l)); if (message.from !== me.id) markRead(); };
    const onUpd = ({ message }) => inChat(message) && setMsgs((l) => l && l.map((x) => (x.id === message.id ? message : x)));
    const onDel = ({ id }) => setMsgs((l) => l && l.filter((x) => x.id !== id));
    const onTyping = ({ from, typing: tp }) => { if (from === peer.id) setTyping(tp); };
    const onRead = ({ chatId, at }) => { if (chatId.split('_').includes(peer.id)) setPeerRead(at); };
    const onPres = (p) => { if (p.userId === peer.id) setPresence({ online: p.online, lastSeen: p.lastSeen || presence.lastSeen }); };
    socket.on('message:new', onNew); socket.on('message:update', onUpd); socket.on('message:delete', onDel);
    socket.on('typing', onTyping); socket.on('chat:read', onRead); socket.on('presence', onPres);
    return () => {
      socket.emit('presence:unwatch', { userId: peer.id });
      socket.off('message:new', onNew); socket.off('message:update', onUpd); socket.off('message:delete', onDel);
      socket.off('typing', onTyping); socket.off('chat:read', onRead); socket.off('presence', onPres);
    };
  }, [socket, peer.id]); // eslint-disable-line

  useEffect(() => { if (msgs && msgs.length) setTimeout(() => list.current && list.current.scrollToEnd({ animated: false }), 50); }, [msgs && msgs.length]); // eslint-disable-line

  const onType = (v) => {
    setText(v);
    if (!socket) return;
    if (!typingOn.current) { typingOn.current = true; socket.emit('typing', { to: peer.id, typing: true }); }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => { typingOn.current = false; socket.emit('typing', { to: peer.id, typing: false }); }, 2000);
  };

  const send = async (body) => {
    try {
      const r = await api.sendMessage(peer.id, { ...body, replyTo: replyTo ? { id: replyTo.id, name: replyTo.name, text: previewOf(t, { type: replyTo.type, text: replyTo.text }) } : undefined });
      setReplyTo(null);
      setMsgs((l) => (l && !l.some((x) => x.id === r.message.id) ? [...l, r.message] : l));
    } catch (e) { toast(errText(e)); throw e; }
  };
  const submit = async () => {
    const v = text.trim();
    if (!v) return;
    setText('');
    if (editing) { try { await api.editMessage(editing.id, v); } catch (e) { toast(errText(e)); } setEditing(null); return; }
    try { await send({ type: 'text', text: v }); } catch { setText(v); }
  };

  const attachMedia = async (camera) => {
    const f = await pickMedia({ kind: camera ? 'image' : 'all', camera });
    if (!f) return;
    setBusy(true);
    try { const up = await uploadFile(api, f); await send({ type: camera ? 'snap' : f.isVideo ? 'video' : 'image', url: up.url, fileName: f.name }); }
    catch (e) { toast(errText(e)); }
    setBusy(false);
  };
  const attachFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setBusy(true);
    try { const up = await uploadFile(api, { uri: a.uri, name: a.name, type: a.mimeType || 'application/octet-stream', size: a.size }); await send({ type: 'file', url: up.url, fileName: a.name }); }
    catch (e) { toast(errText(e)); }
    setBusy(false);
  };

  const toggleRec = async () => {
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI(); setRecording(null);
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        setBusy(true);
        const up = await uploadFile(api, { uri, name: 'voice.m4a', type: 'audio/mp4' });
        await send({ type: 'audio', url: up.url });
      } catch (e) { toast(errText(e)); }
      setBusy(false); setRecording(null);
      return;
    }
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return toast(t('micDenied'));
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
    } catch { toast(t('micDenied')); }
  };

  const openSnap = async (m) => {
    if (m.from === me.id || m.opened) return;
    try { const r = await api.openSnap(m.id); nav.navigate('Viewer', { items: [{ url: r.url, kind: 'image', title: '📸 ' + m.name }], secs: r.seconds || 5 }); }
    catch (e) { toast(errText(e)); }
  };

  const tap = (m) => {
    const now = Date.now();
    if (lastTap.current.id === m.id && now - lastTap.current.t < 350) { lastTap.current = { id: null, t: 0 }; api.react(m.id).catch(() => {}); return; }
    lastTap.current = { id: m.id, t: now };
  };

  const menuItems = (m) => {
    const mine = m.from === me.id;
    const items = [[t('mReply'), () => setReplyTo(m)]];
    if (m.type === 'text') items.push([t('mCopy'), () => { toast(t('copied')); }]);
    items.push([t('mForward'), () => nav.navigate('Forward', { payload: { type: m.type === 'snap' ? 'text' : m.type, text: m.text || '', url: m.url || undefined, fileName: m.fileName || undefined } })]);
    items.push([m.pinned ? t('mUnpin') : t('mPin'), () => api.pinMessage(m.id, !m.pinned).catch((e) => toast(errText(e)))]);
    if (mine && m.type === 'text') items.push([t('mEdit'), () => { setEditing(m); setText(m.text); }]);
    if (mine) items.push([t('mDelete'), () => api.deleteMessage(m.id).catch((e) => toast(errText(e)))]);
    return items;
  };

  const shown = useMemo(() => {
    if (!msgs) return [];
    const q = needle.trim().toLowerCase();
    return q ? msgs.filter((m) => ((m.text || '') + ' ' + (m.fileName || '') + ' ' + (m.name || '')).toLowerCase().includes(q)) : msgs;
  }, [msgs, needle]);
  const pinned = (msgs || []).find((m) => m.pinned);
  const media = (msgs || []).filter((m) => (m.type === 'image' || m.type === 'video') && m.url).map((m) => ({ url: m.url, kind: m.type, name: m.name }));
  const streak = msgs ? streakOf(msgs) : 0;
  const sub = typing ? t('typing') : presence.online ? t('online') : presence.lastSeen ? t('lastSeen', { time: fmt.dateTime(presence.lastSeen) }) : '';

  const body = (m) => {
    if (m.type === 'image') return <Pressable onPress={() => nav.navigate('Viewer', { items: [{ url: m.url, kind: 'image', title: m.name }] })}><Image source={{ uri: api.abs(m.url) }} style={{ width: 220, height: 220, borderRadius: 12 }} /></Pressable>;
    if (m.type === 'video') return <Video source={{ uri: api.abs(m.url) }} style={{ width: 220, height: 220, borderRadius: 12 }} useNativeControls resizeMode={ResizeMode.CONTAIN} />;
    if (m.type === 'audio') return <AudioMsg url={m.url} />;
    if (m.type === 'file') return <Text style={{ color: colors.c2, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(api.abs(m.url))}>📄 {m.fileName || t('msgFile')}</Text>;
    if (m.type === 'snap') {
      const mineSnap = m.from === me.id;
      return <Pressable onPress={() => openSnap(m)} style={{ borderWidth: 2, borderStyle: m.opened ? 'solid' : 'dashed', borderColor: colors.c1, borderRadius: 12, padding: 14, opacity: m.opened ? 0.5 : 1 }}><Text style={{ color: colors.text, textAlign: 'center' }}>{m.opened ? t('snapOpened') : mineSnap ? t('snapSent') : t('snapTap')}</Text></Pressable>;
    }
    return <Text selectable style={{ color: m.from === me.id ? '#fff' : colors.text, fontSize: 15.5 }}>{m.text}</Text>;
  };

  let lastDay = '';
  const renderItem = ({ item: m }) => {
    const mine = m.from === me.id;
    const day = new Date(m.createdAt).toDateString();
    const chip = day !== lastDay;
    lastDay = day;
    const seen = mine && peerRead && new Date(peerRead) >= new Date(m.createdAt);
    return (
      <View>
        {chip && <Text style={{ alignSelf: 'center', color: colors.muted, fontSize: 12, backgroundColor: colors.chip, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 3, marginVertical: 8 }}>{fmt.day(m.createdAt)}</Text>}
        <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', marginVertical: 2, paddingHorizontal: 10 }}>
          <Pressable onPress={() => tap(m)} onLongPress={() => setMenu(m)} delayLongPress={350}
            style={{ maxWidth: '80%', borderRadius: 18, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: mine ? colors.c1 : colors.card, borderWidth: mine ? 0 : 1, borderColor: colors.line }}>
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: mine ? 'rgba(255,255,255,0.85)' : colors.c1 }}>{m.pinned ? '📌 ' : ''}{m.name || t('unknown')}</Text>
            {m.replyTo && <Text numberOfLines={2} style={{ fontSize: 12.5, borderLeftWidth: 3, borderLeftColor: colors.c2, paddingLeft: 6, marginVertical: 3, color: mine ? '#fff' : colors.muted }}>{m.replyTo.name}: {m.replyTo.text}</Text>}
            {body(m)}
            <Text style={{ fontSize: 10.5, textAlign: 'right', marginTop: 2, color: mine ? 'rgba(255,255,255,0.75)' : colors.muted }}>{m.edited ? t('edited') + ' · ' : ''}{fmt.time(m.createdAt)}{mine ? (seen ? ' ✓✓' : ' ✓') : ''}</Text>
            {!!Object.values(m.reactions || {}).join('') && <Text style={{ position: 'absolute', right: 6, bottom: -12, fontSize: 14 }}>{Object.values(m.reactions).join('')}</Text>}
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderBottomWidth: 0.5, borderBottomColor: colors.line }}>
        <Pressable onPress={nav.goBack}><Text style={{ color: colors.c1, fontSize: 22 }}>←</Text></Pressable>
        <Avatar user={peer} size={40} onPress={() => nav.navigate('User', { id: peer.id })} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700', fontSize: 17 }}>{peer.name} {streak > 0 ? '🔥' + streak : ''}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{sub}</Text>
        </View>
        <Pressable onPress={() => { setSearching((s) => !s); setNeedle(''); }}><Text style={{ fontSize: 20 }}>🔍</Text></Pressable>
        <Pressable onPress={() => startCall(peer, false)}><Text style={{ fontSize: 20 }}>📞</Text></Pressable>
        <Pressable onPress={() => startCall(peer, true)}><Text style={{ fontSize: 20 }}>🎥</Text></Pressable>
        <Pressable onPress={() => setMore(true)}><Text style={{ fontSize: 20, color: colors.text }}>⋮</Text></Pressable>
      </View>
      {searching && <TextInput autoFocus value={needle} onChangeText={setNeedle} placeholder={t('searchMsgs')} placeholderTextColor={colors.muted} style={{ padding: 10, color: colors.text, backgroundColor: colors.card }} />}
      {pinned && <Pressable onPress={() => api.pinMessage(pinned.id, false).catch(() => {})} style={{ flexDirection: 'row', gap: 8, padding: 8, backgroundColor: colors.card }}><Text style={{ color: colors.text }}>{t('pinnedLabel')}</Text><Text numberOfLines={1} style={{ flex: 1, color: colors.muted }}>{previewOf(t, { type: pinned.type, text: pinned.text })}</Text></Pressable>}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList ref={list} data={shown} keyExtractor={(m) => m.id} renderItem={renderItem} contentContainerStyle={{ paddingVertical: 8 }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.muted, padding: 40 }}>{msgs === null ? t('loading') : t('noMessages')}</Text>}
          ListFooterComponent={typing ? <Text style={{ color: colors.muted, padding: 10 }}>…</Text> : null} />
        {(replyTo || editing) && (
          <View style={{ flexDirection: 'row', gap: 8, padding: 8, backgroundColor: colors.card, alignItems: 'center' }}>
            <Text numberOfLines={1} style={{ flex: 1, color: colors.text }}>{editing ? '✏️ ' + t('editPrompt') : '↩️ ' + t('replyingTo', { name: replyTo.name }) + ': ' + previewOf(t, { type: replyTo.type, text: replyTo.text })}</Text>
            <Pressable onPress={() => { setReplyTo(null); setEditing(null); setText(''); }}><Text style={{ color: colors.text }}>✕</Text></Pressable>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 26, backgroundColor: colors.input, paddingLeft: 14 }}>
            <TextInput value={text} onChangeText={onType} placeholder={recording ? t('recording') : t('msgPh')} placeholderTextColor={colors.muted} editable={!recording} style={{ flex: 1, paddingVertical: 10, color: colors.text }} onSubmitEditing={submit} />
            <Pressable disabled={busy} onPress={() => attachMedia(false)} onLongPress={attachFile} style={{ padding: 8 }}><Text style={{ fontSize: 18 }}>{busy ? '…' : '📎'}</Text></Pressable>
            <Pressable disabled={busy} onPress={() => attachMedia(true)} style={{ padding: 8 }}><Text style={{ fontSize: 18 }}>📷</Text></Pressable>
          </View>
          <Pressable onPress={toggleRec} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: recording ? '#e5484d' : colors.chip }}><Text style={{ fontSize: 18 }}>{recording ? '⏹' : '🎤'}</Text></Pressable>
          <Pressable onPress={submit} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.c1 }}><Text style={{ color: '#fff', fontSize: 18 }}>➤</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
      <ActionSheet visible={!!menu} items={menu ? menuItems(menu) : []} onClose={() => setMenu(null)} />
      <ActionSheet visible={more} onClose={() => setMore(false)} items={[
        [t('attachFile') === 'attachFile' ? '📄 ' + t('msgFile') : t('attachFile'), attachFile],
        [t('menuGallery'), () => nav.navigate('Gallery', { items: media })],
        [t('menuDeleteMine'), () => Alert.alert(t('menuDeleteMine') + '?', '', [{ text: t('cancel'), style: 'cancel' }, { text: t('delete'), style: 'destructive', onPress: () => api.deleteMyMessages(peer.id).then(load).catch((e) => toast(errText(e))) }])],
      ]} />
    </Screen>
  );
}
