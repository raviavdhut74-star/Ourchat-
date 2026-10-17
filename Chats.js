import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useApp, useFmt } from '../store.js';
import { Avatar, Empty, Header, Input, Row, Screen } from '../ui.js';

export const previewOf = (t, last) => {
  if (!last) return '';
  const p = { image: 'msgPhoto', video: 'msgVideo', audio: 'msgAudio', file: 'msgFile', snap: 'msgSnap' }[last.type];
  return (last.mine ? t('you') + ': ' : '') + (p ? t(p) : last.text);
};

export default function Chats() {
  const { t, api, users, me, socket, ver, colors } = useApp();
  const nav = useNavigation();
  const fmt = useFmt();
  const [term, setTerm] = useState('');
  const [chats, setChats] = useState(null);
  const [calls, setCalls] = useState([]);
  const load = useCallback(() => {
    api.chats().then((r) => setChats(r.chats)).catch(() => setChats((c) => c || []));
    api.calls().then((r) => setCalls(r.calls)).catch(() => {});
  }, [api]);
  useFocusEffect(useCallback(() => { load(); }, [load, ver]));
  useEffect(() => {
    if (!socket) return undefined;
    socket.on('message:new', load); socket.on('message:delete', load); socket.on('call:ended', load);
    return () => { socket.off('message:new', load); socket.off('message:delete', load); socket.off('call:ended', load); };
  }, [socket, load]);

  const q = term.trim().toLowerCase().replace(/^@/, '');
  const isTag = term.trim().startsWith('#');
  const found = useMemo(() => (q && !isTag ? Object.values(users).filter((u) => u.id !== me.id && (u.name.toLowerCase().includes(q) || u.username.includes(q))) : []), [q, isTag, users, me.id]);
  const callLabel = (c) => {
    const out = c.from === me.id;
    const st = c.status === 'missed' ? t('callMissed') : c.status === 'declined' ? t('callDeclined') : c.status === 'cancelled' ? t('callCancelled') : out ? t('callOut') : t('callIn');
    return [out ? c.toName : c.fromName, (c.video ? '🎥 ' : '📞 ') + st + ' · ' + fmt.dateTime(c.createdAt)];
  };

  return (
    <Screen>
      <Header title={t('chatsTitle')} onBack={nav.canGoBack() ? nav.goBack : undefined} />
      <Input placeholder={t('searchUsers')} value={term} onChangeText={setTerm} autoCapitalize="none" returnKeyType="search"
        onSubmitEditing={() => { if (isTag) nav.navigate('Tag', { tag: q.replace(/^#/, '') }); else if (q) api.addHistory({ type: 'search', text: term.trim() }).catch(() => {}); }} style={{ margin: 12 }} />
      {q && !isTag ? (
        <FlatList data={found} keyExtractor={(u) => u.id} ListEmptyComponent={<Empty>{t('search_noResults')}</Empty>}
          renderItem={({ item }) => <Row user={item} title={item.name} sub={'@' + item.username} onPress={() => nav.navigate('User', { id: item.id })} />} />
      ) : (
        <FlatList data={chats || []} keyExtractor={(c) => c.user.id}
          ListEmptyComponent={chats === null ? null : <Empty>{t('noChats')}</Empty>}
          renderItem={({ item: c }) => (
            <Row user={c.user} title={c.user.name} sub={previewOf(t, c.last)} onPress={() => nav.navigate('Chat', { peer: c.user })}
              right={c.unread > 0 ? <View style={{ backgroundColor: colors.c1, borderRadius: 99, minWidth: 22, paddingHorizontal: 7, paddingVertical: 2 }}><Text style={{ color: '#fff', textAlign: 'center', fontSize: 12 }}>{c.unread}</Text></View> : (c.online ? <Text style={{ color: '#2ee6a8' }}>●</Text> : null)} />
          )}
          ListFooterComponent={(
            <View>
              <Text style={{ color: colors.muted, fontWeight: '700', padding: 14 }}>{t('callsTitle')}</Text>
              {!calls.length && <Empty>{t('noCalls')}</Empty>}
              {calls.slice(0, 15).map((c) => { const [a, b] = callLabel(c); return <Row key={c.id} title={a} sub={b} />; })}
            </View>
          )} />
      )}
    </Screen>
  );
}
