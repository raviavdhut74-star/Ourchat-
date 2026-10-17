import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../store.js';
import { ActionSheet, Avatar, Empty, Header, IconBtn, Screen, Tagged } from '../ui.js';
import { pickMedia, uploadFile } from '../media.js';

export function PostCard({ post: initial, onDeleted }) {
  const { t, api, me, colors, toast, errText, bump } = useApp();
  const nav = useNavigation();
  const [p, setP] = useState(initial);
  const [rep, setRep] = useState(false);
  useEffect(() => setP(initial), [initial]);
  const mine = p.uid === me.id;

  const like = async () => {
    setP((x) => ({ ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) }));
    try { const r = await api.likePost(p.id); setP((x) => ({ ...x, liked: r.liked, likes: r.likes })); } catch (e) { setP(initial); toast(errText(e)); }
  };
  const save = () => api.savePost(p.id).then((r) => { setP((x) => ({ ...x, saved: r.saved })); toast(r.saved ? t('savedToast') : t('removedSaved')); }).catch((e) => toast(errText(e)));
  const del = () => Alert.alert(p.reel ? t('deleteReel') : t('deletePost'), '', [
    { text: t('cancel'), style: 'cancel' },
    { text: t('delete'), style: 'destructive', onPress: () => api.deletePost(p.id).then(() => { onDeleted && onDeleted(p.id); bump(); }).catch((e) => toast(errText(e))) },
  ]);
  const btn = { paddingHorizontal: 10, paddingVertical: 6 };

  return (
    <View style={{ backgroundColor: colors.card, marginBottom: 8 }}>
      <Pressable onPress={() => nav.navigate('User', { id: p.uid })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 }}>
        <Avatar user={{ name: p.name, photo: p.photo }} size={34} /><Text style={{ color: colors.text, fontWeight: '700' }}>{p.name}</Text>
      </Pressable>
      {p.kind === 'video'
        ? <Video source={{ uri: api.abs(p.url) }} style={{ width: '100%', aspectRatio: 1, backgroundColor: '#000' }} useNativeControls resizeMode={ResizeMode.CONTAIN} onPlaybackStatusUpdate={() => {}} />
        : <Pressable onPress={() => nav.navigate('Viewer', { items: [{ url: p.url, kind: 'image', title: p.name }] })}><Image source={{ uri: api.abs(p.url) }} style={{ width: '100%', aspectRatio: 1, backgroundColor: '#000' }} resizeMode="cover" /></Pressable>}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
        <Pressable style={btn} onPress={like}><Text style={{ color: p.liked ? colors.c1 : colors.text, fontSize: 18 }}>{p.liked ? '❤️' : '🤍'} {p.likes || ''}</Text></Pressable>
        <Pressable style={btn} onPress={() => nav.navigate('Comments', { post: p })}><Text style={{ color: colors.text, fontSize: 18 }}>💬 {p.comments || ''}</Text></Pressable>
        <Pressable style={btn} onPress={() => nav.navigate('Forward', { payload: { type: p.kind, url: p.url, text: p.caption || '' } })}><Text style={{ fontSize: 18 }}>➤</Text></Pressable>
        <Pressable style={btn} onPress={save}><Text style={{ fontSize: 18 }}>{p.saved ? '✅' : '🔖'}</Text></Pressable>
        {!mine && <Pressable style={btn} onPress={() => setRep(true)}><Text style={{ fontSize: 18 }}>🚩</Text></Pressable>}
        {mine && <Pressable style={[btn, { marginLeft: 'auto' }]} onPress={del}><Text style={{ fontSize: 18 }}>🗑️</Text></Pressable>}
      </View>
      {!!p.caption && <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}><Tagged style={{ color: colors.text, lineHeight: 21 }} text={p.name + ' ' + p.caption} onTag={(tag) => nav.navigate('Tag', { tag })} /></View>}
      <ActionSheet visible={rep} title={t('reportTitle')} onClose={() => setRep(false)}
        items={[['spam', 'rSpam'], ['abusive', 'rAbusive'], ['nudity', 'rNudity'], ['scam', 'rScam'], ['other', 'rOther']].map(([reason, k]) => [t(k), () => api.report({ type: p.reel ? 'reel' : 'post', targetId: p.id, targetUid: p.uid, reason }).then(() => toast(t('reportSent'))).catch((e) => toast(errText(e)))])} />
    </View>
  );
}

function Stories() {
  const { t, api, me, rel, storyAud, colors, toast, errText, ver, bump } = useApp();
  const nav = useNavigation();
  const [stories, setStories] = useState([]);
  const load = useCallback(() => api.stories().then((r) => setStories(r.stories)).catch(() => {}), [api]);
  useEffect(() => { load(); }, [load, ver]);
  const groups = useMemo(() => {
    const g = {}; stories.forEach((s) => { (g[s.uid] = g[s.uid] || []).push(s); });
    return Object.values(g).sort((a, b) => (b[0].uid === me.id) - (a[0].uid === me.id));
  }, [stories, me.id]);

  const add = async () => {
    if (storyAud === 'close' && !rel.close.length) return toast(t('e_no_close_friends'));
    const f = await pickMedia({ kind: 'all' });
    if (!f) return;
    toast(t('uploading'));
    try { const up = await uploadFile(api, f); await api.addStory({ url: up.url, kind: f.isVideo ? 'video' : 'image', closeOnly: storyAud === 'close' }); toast(t('storyAdded')); load(); }
    catch (e) { toast(errText(e)); }
  };
  const play = (arr) => nav.navigate('Viewer', {
    index: Math.max(0, arr.findIndex((s) => !s.seen)),
    items: arr.map((s) => ({ id: s.id, url: s.url, kind: s.kind, mine: s.uid === me.id, story: true, seen: s.seen, title: t('storyOfName', { name: s.uid === me.id ? t('you') : s.name }) + (s.close ? ' 💚' : '') })),
  });

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 12 }} style={{ flexGrow: 0 }}>
      <Pressable onPress={add} style={{ width: 66, alignItems: 'center' }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.c1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.c1, fontSize: 26 }}>+</Text></View>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 11.5, marginTop: 4 }}>{t('yourStory')}</Text>
      </Pressable>
      {groups.map((arr) => {
        const f = arr[arr.length - 1], seen = arr.every((s) => s.seen);
        return (
          <Pressable key={f.uid} onPress={() => play(arr)} style={{ width: 66, alignItems: 'center' }}>
            <View style={{ padding: 3, borderRadius: 30, backgroundColor: seen ? colors.line : colors.c1 }}>
              <Avatar user={{ name: f.name, photo: f.kind === 'image' ? f.url : f.photo }} size={50} />
            </View>
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 11.5, marginTop: 4 }}>{arr.some((s) => s.close) ? '💚 ' : ''}{f.uid === me.id ? t('you') : f.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function Home() {
  const { t, api, ver, notifs, colors } = useApp();
  const nav = useNavigation();
  const [posts, setPosts] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(() => api.feed().then((r) => setPosts(r.posts)).catch(() => setPosts((p) => p || [])), [api]);
  useEffect(() => { load(); }, [load, ver]);
  const unread = notifs.some((n) => !n.read);

  return (
    <Screen>
      <Header logo title={t('appName')} right={<View style={{ flexDirection: 'row', gap: 8 }}>
        <IconBtn dot={unread} onPress={() => nav.navigate('Hub', { mode: 'activity' })}>🔔</IconBtn>
        <IconBtn onPress={() => nav.navigate('Chats')}>➤</IconBtn>
      </View>} />
      <FlatList
        data={posts || []}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={<Stories />}
        ListEmptyComponent={posts === null ? null : <Empty>{t('noPosts')}{'\n'}{t('noPostsHint')}</Empty>}
        renderItem={({ item }) => <PostCard post={item} onDeleted={(id) => setPosts((l) => l.filter((x) => x.id !== id))} />}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.c1} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </Screen>
  );
}
