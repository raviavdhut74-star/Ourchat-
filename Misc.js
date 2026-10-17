import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, Text, View, Alert, Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp, useFmt } from '../store.js';
import { Avatar, Empty, Header, Input, Loading, Row, Screen } from '../ui.js';

const W = Dimensions.get('window').width;

/* ---------- media grid (profile, saved, tag, gallery) ---------- */
export function Grid({ posts, onOpen }) {
  const { api, colors } = useApp();
  const size = (W - 4) / 3;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      {posts.map((p, i) => (
        <Pressable key={p.id || i} onPress={() => onOpen(p)} style={{ width: size, height: size, backgroundColor: colors.chip }}>
          {p.kind === 'video'
            ? <Video source={{ uri: api.abs(p.url) }} style={{ width: size, height: size }} resizeMode={ResizeMode.COVER} isMuted shouldPlay={false} />
            : <Image source={{ uri: api.abs(p.url) }} style={{ width: size, height: size }} />}
          {p.kind === 'video' && <Text style={{ position: 'absolute', right: 6, top: 4, color: '#fff' }}>▶</Text>}
        </Pressable>
      ))}
    </View>
  );
}

/* ---------- full-screen viewer: stories, view-once snaps, single media ---------- */
export function Viewer() {
  const { items, index = 0, secs = 0 } = useRoute().params;
  const nav = useNavigation();
  const { api, bump, t } = useApp();
  const [i, setI] = useState(index);
  const [left, setLeft] = useState(secs);
  const it = items[i];
  const timer = useRef(null);

  const next = useCallback(() => { clearTimeout(timer.current); if (i + 1 >= items.length) nav.goBack(); else setI(i + 1); }, [i, items.length, nav]);

  useEffect(() => {
    if (!it) return undefined;
    if (it.story && !it.mine && !it.seen) api.seeStory(it.id).catch(() => {});
    if (it.story && it.mine) api.seeStory(it.id).catch(() => {});
    if (secs) {
      setLeft(secs);
      const iv = setInterval(() => setLeft((n) => { if (n <= 1) { clearInterval(iv); nav.goBack(); return 0; } return n - 1; }), 1000);
      return () => clearInterval(iv);
    }
    if (it.kind !== 'video') { timer.current = setTimeout(next, 5000); return () => clearTimeout(timer.current); }
    return undefined;
  }, [i]); // eslint-disable-line

  if (!it) return null;
  const del = () => Alert.alert(t('confirmDelete'), '', [
    { text: t('cancel'), style: 'cancel' },
    { text: t('delete'), style: 'destructive', onPress: () => api.deleteStory(it.id).then(() => { bump(); nav.goBack(); }).catch(() => {}) },
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
      <Pressable style={{ flex: 1, justifyContent: 'center' }} onPress={() => (items.length > 1 ? next() : nav.goBack())}>
        {it.kind === 'video'
          ? <Video source={{ uri: api.abs(it.url) }} style={{ width: '100%', height: '100%' }} resizeMode={ResizeMode.CONTAIN} shouldPlay useNativeControls={!secs} onPlaybackStatusUpdate={(s) => { if (s.didJustFinish) next(); }} />
          : <Image source={{ uri: api.abs(it.url) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />}
      </Pressable>
      <View style={{ position: 'absolute', top: 50, left: 14, right: 14 }}>
        {items.length > 1 && (
          <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8 }}>
            {items.map((_, k) => <View key={k} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: k <= i ? '#fff' : 'rgba(255,255,255,0.35)' }} />)}
          </View>
        )}
        <Text style={{ color: '#fff', fontWeight: '600' }}>{it.title}{secs ? ' · ' + left + 's' : ''}</Text>
      </View>
      <Pressable onPress={() => nav.goBack()} style={{ position: 'absolute', top: 44, right: 14, padding: 8 }}><Text style={{ color: '#fff', fontSize: 22 }}>✕</Text></Pressable>
      {it.story && it.mine && <Pressable onPress={del} style={{ position: 'absolute', bottom: 40, right: 20, padding: 12 }}><Text style={{ fontSize: 24 }}>🗑️</Text></Pressable>}
    </View>
  );
}

/* ---------- send something to a chat ---------- */
export function Forward() {
  const { payload } = useRoute().params;
  const nav = useNavigation();
  const { t, api, toast, errText, colors } = useApp();
  const [chats, setChats] = useState(null);
  useEffect(() => { api.chats().then((r) => setChats(r.chats)).catch(() => setChats([])); }, [api]);
  const send = async (u) => { try { await api.sendMessage(u.id, payload); toast(t('sentToChat')); nav.goBack(); } catch (e) { toast(errText(e)); } };
  return (
    <Screen>
      <Header title={t('forwardTo')} onBack={() => nav.goBack()} />
      {chats === null ? <Loading /> : !chats.length ? <Empty>{t('noChats')}</Empty> : (
        <FlatList data={chats} keyExtractor={(c) => c.user.id} renderItem={({ item }) => <Row user={item.user} title={item.user.name} sub={'@' + item.user.username} onPress={() => send(item.user)} />} />
      )}
    </Screen>
  );
}

/* ---------- comments ---------- */
export function Comments() {
  const { post } = useRoute().params;
  const nav = useNavigation();
  const { t, api, me, colors, toast, errText, bump } = useApp();
  const [list, setList] = useState(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const load = useCallback(() => api.comments(post.id).then((r) => setList(r.comments)).catch((e) => { toast(errText(e)); setList([]); }), [api, post.id, toast, errText]);
  useEffect(() => { load(); }, [load]);

  const send = async () => {
    const v = text.trim(); if (!v) return;
    setText('');
    try { await api.addComment(post.id, v, replyTo && replyTo.id); setReplyTo(null); await load(); bump(); } catch (e) { toast(errText(e)); setText(v); }
  };
  const rows = useMemo(() => {
    if (!list) return [];
    const tops = list.filter((c) => !c.parentId);
    return tops.flatMap((c) => [{ ...c, reply: false }, ...list.filter((k) => k.parentId === c.id).map((k) => ({ ...k, reply: true }))]);
  }, [list]);

  return (
    <Screen>
      <Header title={t('comments')} onBack={() => nav.goBack()} />
      {list === null ? <Loading /> : !rows.length ? <Empty>{t('noComments')}</Empty> : (
        <FlatList data={rows} keyExtractor={(c) => c.id} renderItem={({ item: c }) => (
          <View style={{ flexDirection: 'row', gap: 10, padding: 12, paddingLeft: c.reply ? 44 : 12 }}>
            <Avatar user={{ name: c.name, photo: c.photo }} size={30} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text }}><Text style={{ fontWeight: '700' }}>{c.name} </Text>{c.text}</Text>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                <Text style={{ color: colors.muted }} onPress={() => api.likeComment(c.id).then(load).catch((e) => toast(errText(e)))}>{c.liked ? '❤️' : '🤍'}{c.likes ? ' ' + c.likes : ''}</Text>
                {!c.reply && <Text style={{ color: colors.muted }} onPress={() => setReplyTo({ id: c.id, name: c.name })}>{t('mReply')}</Text>}
                {(c.uid === me.id || post.uid === me.id) && <Text style={{ color: colors.muted }} onPress={() => api.deleteComment(c.id).then(() => { load(); bump(); }).catch((e) => toast(errText(e)))}>✕</Text>}
              </View>
            </View>
          </View>
        )} />
      )}
      <View style={{ flexDirection: 'row', gap: 8, padding: 10, alignItems: 'center' }}>
        <Input style={{ flex: 1 }} value={text} onChangeText={setText} placeholder={replyTo ? t('replyingToUser', { name: replyTo.name }) : t('writeComment')} maxLength={300} onSubmitEditing={send} />
        <Pressable onPress={send}><Text style={{ color: colors.c1, fontSize: 24 }}>➤</Text></Pressable>
      </View>
    </Screen>
  );
}

/* ---------- #tag results ---------- */
export function Tag() {
  const { tag } = useRoute().params;
  const nav = useNavigation();
  const { t, api, toast, errText } = useApp();
  const [posts, setPosts] = useState(null);
  useEffect(() => { api.tag(tag).then((r) => setPosts(r.posts)).catch((e) => { toast(errText(e)); setPosts([]); }); }, [api, tag]); // eslint-disable-line
  const open = (p) => nav.navigate('Viewer', { items: [{ url: p.url, kind: p.kind, title: '@' + (p.username || p.name) + ' ' + (p.caption || '') }] });
  return (
    <Screen>
      <Header title={posts ? t('tagResults', { tag, n: posts.length }) : '#' + tag} onBack={() => nav.goBack()} />
      {posts === null ? <Loading /> : !posts.length ? <Empty>{t('search_noResults')}</Empty> : <ScrollView><Grid posts={posts} onOpen={open} /></ScrollView>}
    </Screen>
  );
}

/* ---------- photos / videos of one chat ---------- */
export function Gallery() {
  const { items } = useRoute().params;
  const nav = useNavigation();
  const { t, colors } = useApp();
  const [f, setF] = useState('all');
  const list = useMemo(() => items.filter((x) => f === 'all' || x.kind === f).slice().reverse().map((x, i) => ({ ...x, id: 'g' + i })), [items, f]);
  return (
    <Screen>
      <Header title={t('gallery')} onBack={() => nav.goBack()} />
      <View style={{ flexDirection: 'row', gap: 8, padding: 10 }}>
        {[['all', 'galAll'], ['image', 'galPhotos'], ['video', 'galVideos']].map(([k, key]) => (
          <Pressable key={k} onPress={() => setF(k)} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 14, backgroundColor: f === k ? colors.c1 : colors.chip }}>
            <Text style={{ color: f === k ? '#fff' : colors.text }}>{t(key)}</Text>
          </Pressable>
        ))}
      </View>
      {!list.length ? <Empty>{t('galEmpty')}</Empty> : <ScrollView><Grid posts={list} onOpen={(x) => nav.navigate('Viewer', { items: [{ url: x.url, kind: x.kind, title: x.name || '' }] })} /></ScrollView>}
    </Screen>
  );
}

/* ---------- Saved / History / Blocked / Requests / Activity / Close friends / Muted & restricted ---------- */
export function Hub() {
  const { mode } = useRoute().params;
  const nav = useNavigation();
  const { t, api, users, me, blocks, rel, requests, notifs, setNotifs, refreshSocial, toast, errText, colors } = useApp();
  const fmt = useFmt();
  const [saved, setSaved] = useState(null);
  const [history, setHistory] = useState(null);
  const loadSaved = useCallback(() => api.saved().then((r) => setSaved(r.posts)).catch(() => setSaved([])), [api]);
  const loadHistory = useCallback(() => api.history().then((r) => setHistory(r.history)).catch(() => setHistory([])), [api]);

  useEffect(() => {
    if (mode === 'saved') loadSaved();
    if (mode === 'history') loadHistory();
    if (mode === 'activity') { refreshSocial(); api.readNotifications().then(() => setNotifs((l) => l.map((n) => ({ ...n, read: true })))).catch(() => {}); }
    if (['requests', 'close', 'limits'].includes(mode)) refreshSocial();
  }, [mode]); // eslint-disable-line

  const titles = { saved: 'hubSaved', history: 'hubHistory', blocked: 'hubBlocked', requests: 'hubRequests', activity: 'hubActivity', close: 'hubClose', limits: 'hubLimits' };
  const fail = (e) => toast(errText(e));
  const openMedia = (p) => nav.navigate('Viewer', { items: [{ url: p.url, kind: p.kind || p.mediaKind || 'video', title: (p.username ? '@' + p.username + ' ' : '') + (p.caption || '') }] });
  const people = Object.values(users).filter((u) => u.id !== me.id);
  const notifText = (n) => {
    const map = { follow: 'nFollow', request: 'nRequest', accepted: 'nAccepted', like: 'nLike', comment: 'nComment', reply: 'nReply', clike: 'nClike' };
    return t(map[n.type] || 'nOther', { name: n.fromName || t('someone'), text: n.text || '' });
  };

  let body = null;
  if (mode === 'saved') body = saved === null ? <Loading /> : !saved.length ? <Empty>{t('nothingSaved')}{'\n'}{t('savedHint')}</Empty> : <ScrollView><Grid posts={saved} onOpen={openMedia} /></ScrollView>;
  else if (mode === 'history') body = history === null ? <Loading /> : !history.length ? <Empty>{t('noHistory')}</Empty> : (
    <FlatList data={history} keyExtractor={(h) => h.id} renderItem={({ item: h }) => {
      const main = h.type === 'search' ? '🔍 ' + h.text : h.type === 'profile' ? '👤 ' + (h.name || t('unknown')) : '🎬 ' + (h.caption || t('navReels'));
      const go = h.type === 'profile' && users[h.refId] ? () => nav.navigate('User', { id: h.refId }) : h.type === 'watch' && h.url ? () => openMedia({ url: h.url, kind: h.mediaKind, caption: h.caption }) : undefined;
      return <Row title={main} sub={fmt.dateTime(h.createdAt)} onPress={go} buttons={[['✕', () => api.deleteHistory(h.id).then(loadHistory).catch(fail)]]} />;
    }} />
  );
  else if (mode === 'blocked') body = !blocks.length ? <Empty>{t('noBlocked')}</Empty> : <FlatList data={blocks} keyExtractor={(u) => u.id} renderItem={({ item: u }) => <Row user={u} title={u.name} sub={'@' + u.username} buttons={[[t('unblock'), () => api.unblock(u.id).then(refreshSocial).catch(fail)]]} />} />;
  else if (mode === 'requests') body = !requests.length ? <Empty>{t('noRequests')}</Empty> : <FlatList data={requests} keyExtractor={(u) => u.id} renderItem={({ item: u }) => <Row user={u} title={u.name} sub={'@' + u.username} onPress={() => nav.navigate('User', { id: u.id })} buttons={[[t('accept'), () => api.acceptRequest(u.id).then(refreshSocial).catch(fail)], [t('decline'), () => api.declineRequest(u.id).then(refreshSocial).catch(fail)]]} />} />;
  else if (mode === 'activity') body = !notifs.length ? <Empty>{t('noActivity')}</Empty> : <FlatList data={notifs} keyExtractor={(n) => n.id} renderItem={({ item: n }) => <Row user={{ name: n.fromName, photo: n.photo }} title={notifText(n)} sub={fmt.dateTime(n.createdAt)} onPress={() => n.from && users[n.from] && nav.navigate('User', { id: n.from })} />} />;
  else {
    const kinds = mode === 'close' ? [['close', 'add', 'remove']] : [['muted', 'mute', 'unmute'], ['restricted', 'restrict', 'unrestrict']];
    body = (
      <FlatList data={people} keyExtractor={(u) => u.id} ListHeaderComponent={<Text style={{ color: colors.muted, padding: 14 }}>{t(mode === 'close' ? 'closeHint' : 'limitsHint')}</Text>}
        renderItem={({ item: u }) => <Row user={u} title={u.name} sub={'@' + u.username} buttons={kinds.map(([k, on, off]) => [t(rel[k].includes(u.id) ? off : on), () => api.toggleRelation(k, u.id).then(refreshSocial).catch(fail)])} />} />
    );
  }

  return (
    <Screen>
      <Header title={t(titles[mode])} onBack={() => nav.goBack()}
        right={mode === 'history' && history && history.length ? <Text style={{ color: colors.c1, fontWeight: '700' }} onPress={() => Alert.alert(t('clearHistoryConfirm'), '', [{ text: t('cancel'), style: 'cancel' }, { text: t('yes'), onPress: () => api.clearHistory().then(loadHistory).catch(fail) }])}>{t('clearAll')}</Text> : null} />
      {body}
    </Screen>
  );
}
