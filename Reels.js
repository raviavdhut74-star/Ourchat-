import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, FlatList, Pressable, Text, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../store.js';
import { ActionSheet, Empty, Loading, Tagged } from '../ui.js';
import { pickMedia, uploadFile } from '../media.js';

function Reel({ item, active, height, muted, onMute, onDeleted }) {
  const { t, api, me, toast, errText, bump } = useApp();
  const nav = useNavigation();
  const [r, setR] = useState(item);
  const [rep, setRep] = useState(false);
  const like = async () => {
    setR((x) => ({ ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) }));
    try { const res = await api.likePost(r.id); setR((x) => ({ ...x, liked: res.liked, likes: res.likes })); } catch (e) { setR(item); toast(errText(e)); }
  };
  const save = () => api.savePost(r.id).then((res) => { setR((x) => ({ ...x, saved: res.saved })); toast(res.saved ? t('savedToast') : t('removedSaved')); }).catch((e) => toast(errText(e)));
  const del = () => Alert.alert(t('deleteReel'), '', [{ text: t('cancel'), style: 'cancel' }, { text: t('delete'), style: 'destructive', onPress: () => api.deletePost(r.id).then(() => { onDeleted(r.id); bump(); }).catch((e) => toast(errText(e))) }]);
  const side = { alignItems: 'center', marginBottom: 16 };
  return (
    <View style={{ height, backgroundColor: '#000' }}>
      <Video source={{ uri: api.abs(r.url) }} style={{ flex: 1 }} resizeMode={ResizeMode.CONTAIN} shouldPlay={active} isLooping isMuted={muted} />
      <View style={{ position: 'absolute', left: 14, right: 84, bottom: 40 }}>
        <Text onPress={() => nav.navigate('User', { id: r.uid })} style={{ color: '#fff', fontWeight: '700' }}>@{r.username || r.name}</Text>
        <Tagged style={{ color: '#fff' }} text={r.caption} onTag={(tag) => nav.navigate('Tag', { tag })} />
      </View>
      <View style={{ position: 'absolute', right: 10, bottom: 30 }}>
        <Pressable style={side} onPress={like}><Text style={{ fontSize: 26 }}>{r.liked ? '❤️' : '🤍'}</Text><Text style={{ color: '#fff' }}>{r.likes}</Text></Pressable>
        <Pressable style={side} onPress={() => nav.navigate('Comments', { post: r })}><Text style={{ fontSize: 26 }}>💬</Text><Text style={{ color: '#fff' }}>{r.comments}</Text></Pressable>
        <Pressable style={side} onPress={() => nav.navigate('Forward', { payload: { type: 'video', url: r.url, text: r.caption || '' } })}><Text style={{ fontSize: 26 }}>➤</Text></Pressable>
        <Pressable style={side} onPress={save}><Text style={{ fontSize: 26 }}>{r.saved ? '✅' : '🔖'}</Text></Pressable>
        {r.uid !== me.id && <Pressable style={side} onPress={() => setRep(true)}><Text style={{ fontSize: 24 }}>🚩</Text></Pressable>}
        <Pressable style={side} onPress={onMute}><Text style={{ fontSize: 24 }}>{muted ? '🔇' : '🔊'}</Text></Pressable>
        {r.uid === me.id && <Pressable style={side} onPress={del}><Text style={{ fontSize: 24 }}>🗑️</Text></Pressable>}
      </View>
      <ActionSheet visible={rep} title={t('reportTitle')} onClose={() => setRep(false)}
        items={[['spam', 'rSpam'], ['abusive', 'rAbusive'], ['nudity', 'rNudity'], ['scam', 'rScam'], ['other', 'rOther']].map(([reason, k]) => [t(k), () => api.report({ type: 'reel', targetId: r.id, targetUid: r.uid, reason }).then(() => toast(t('reportSent'))).catch((e) => toast(errText(e)))])} />
    </View>
  );
}

export default function Reels() {
  const { t, api, ver, bump, toast, errText } = useApp();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [reels, setReels] = useState(null);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [h, setH] = useState(Dimensions.get('window').height);
  const load = useCallback(() => api.reels().then((r) => setReels(r.posts)).catch(() => setReels((x) => x || [])), [api]);
  useEffect(() => { load(); }, [load, ver]);
  const onView = useRef(({ viewableItems }) => { if (viewableItems[0]) setIndex(viewableItems[0].index || 0); }).current;

  const add = async () => {
    const f = await pickMedia({ kind: 'video' });
    if (!f) return;
    toast(t('uploading'));
    try { const up = await uploadFile(api, f); await api.createPost({ url: up.url, kind: 'video', caption: '', reel: true }); toast(t('reelAdded')); bump(); }
    catch (e) { toast(errText(e)); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      {reels === null ? <Loading /> : !reels.length ? <Empty>{t('noReels')}{'\n'}{t('noReelsHint')}</Empty> : (
        <FlatList data={reels} keyExtractor={(r) => r.id} pagingEnabled snapToInterval={h} decelerationRate="fast"
          onViewableItemsChanged={onView} viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
          getItemLayout={(_, i) => ({ length: h, offset: h * i, index: i })}
          renderItem={({ item, index: i }) => <Reel item={item} height={h} active={focused && i === index} muted={muted} onMute={() => setMuted((m) => !m)} onDeleted={(id) => setReels((l) => l.filter((x) => x.id !== id))} />} />
      )}
      <View style={{ position: 'absolute', top: insets.top + 8, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 20 }}>{t('navReels')}</Text>
        <Pressable onPress={add} style={{ backgroundColor: 'rgba(0,0,0,0.45)', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 22 }}>+</Text></Pressable>
      </View>
    </View>
  );
}
