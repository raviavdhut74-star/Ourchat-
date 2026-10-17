import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useApp, THEMES } from '../store.js';
import { ActionSheet, Avatar, Btn, Empty, Header, IconBtn, Input, Screen } from '../ui.js';
import { Grid } from './Misc.js';
import { pickMedia, uploadFile } from '../media.js';
import { LANGUAGES } from '../shared/i18n/index.js';

/** Profile of any user. Used as the "Profile" tab (own) and as the "User" screen (route param id). */
export default function Profile({ own: ownTab }) {
  const route = useRoute();
  const nav = useNavigation();
  const { t, api, me, setMe, colors, toast, errText, ver, bump, refreshSocial, logout, dark, toggleDark, lang, setLang, themeKey, setThemeKey, storyAud, setStoryAud, requests, notifs } = useApp();
  const id = ownTab ? me.id : route.params.id;
  const own = id === me.id;
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [sheet, setSheet] = useState(null); // 'menu' | 'more' | 'lang' | 'theme'
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio || '');

  const load = useCallback(async () => {
    try {
      const d = await api.user(id); setData(d);
      const r = await api.userPosts(id, tab === 'reels'); setPosts(r.posts);
    } catch (e) { toast(errText(e)); if (!own) nav.goBack(); }
  }, [api, id, tab, own]); // eslint-disable-line
  useFocusEffect(useCallback(() => { load(); }, [load, ver]));
  useEffect(() => { if (!own) api.addHistory({ type: 'profile', refId: id }).catch(() => {}); }, [id]); // eslint-disable-line

  const act = async (fn) => { try { await fn(); await load(); refreshSocial(); bump(); } catch (e) { toast(errText(e)); } };
  const rel = data && data.relation;
  const unread = notifs.filter((n) => !n.read).length;

  const changePhoto = async () => {
    const f = await pickMedia({ kind: 'image' }); if (!f) return;
    try { const up = await uploadFile(api, f); const r = await api.updateMe({ avatarUrl: up.url }); setMe((m) => ({ ...m, ...r.user })); load(); } catch (e) { toast(errText(e)); }
  };
  const saveProfile = async () => {
    try { const r = await api.updateMe({ name, bio }); setMe((m) => ({ ...m, ...r.user })); setEditing(false); load(); } catch (e) { toast(errText(e)); }
  };
  const togglePrivate = async () => {
    try { const r = await api.updateMe({ isPrivate: !me.private }); setMe((m) => ({ ...m, ...r.user })); toast(!me.private ? t('accountNowPrivate') : t('accountNowPublic')); } catch (e) { toast(errText(e)); }
  };
  const download = async () => {
    try { const d = await api.exportData(); await Share.share({ message: JSON.stringify(d, null, 2), title: 'kshan-data.json' }); } catch (e) { toast(errText(e)); }
  };
  const confirmDo = (title, fn) => Alert.alert(title, '', [{ text: t('cancel'), style: 'cancel' }, { text: t('yes'), onPress: fn }]);
  const hub = (mode) => () => nav.navigate('Hub', { mode });
  const who = storyAud === 'close' ? t('closeFriendsShort') : t('everyone');

  if (!data) return <Screen><Header title="" onBack={own ? undefined : () => nav.goBack()} /><Empty>{t('loading')}</Empty></Screen>;
  const u = own ? { ...data.user, ...me } : data.user;

  return (
    <Screen>
      <Header title={u.username} logo onBack={own ? undefined : () => nav.goBack()}
        right={<IconBtn dot={own && unread + requests.length > 0} onPress={() => setSheet(own ? 'menu' : 'more')}>{own ? '☰' : '⋯'}</IconBtn>} />
      <ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, padding: 16 }}>
          <Avatar user={u} size={86} ring />
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
            {[[data.counts.posts, 'statPosts'], [data.counts.followers, 'statFollowers'], [data.counts.following, 'statFollowing']].map(([n, k]) => (
              <View key={k} style={{ alignItems: 'center' }}><Text style={{ color: colors.text, fontWeight: '700', fontSize: 18 }}>{n}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{t(k)}</Text></View>
            ))}
          </View>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{u.name}</Text>
          {!!u.bio && <Text style={{ color: colors.text, marginTop: 2 }}>{u.bio}</Text>}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, padding: 14 }}>
          {own && <><Btn style={{ flex: 1 }} title={t('editProfile')} onPress={() => { setName(me.name); setBio(me.bio || ''); setEditing(true); }} /><Btn style={{ flex: 1 }} title={t('changePhoto')} onPress={changePhoto} /></>}
          {!own && !rel.blocked && (
            <>
              {rel.following ? <Btn style={{ flex: 1 }} title={t('followingBtn')} onPress={() => act(() => api.unfollow(id))} />
                : rel.requested ? <Btn style={{ flex: 1 }} title={t('requested')} onPress={() => act(() => api.unfollow(id))} />
                  : <Btn primary style={{ flex: 1 }} title={t('follow')} onPress={() => act(() => api.follow(id))} />}
              {(rel.following || rel.followsMe) && <Btn style={{ flex: 1 }} title={t('message')} onPress={() => nav.navigate('Chat', { peer: u })} />}
            </>
          )}
          {!own && rel.blocked && <Btn style={{ flex: 1 }} title={t('unblock')} onPress={() => act(() => api.unblock(id))} />}
        </View>
        {editing && (
          <View style={{ paddingHorizontal: 14, gap: 8, paddingBottom: 12 }}>
            <Input value={name} onChangeText={setName} placeholder={t('namePh')} maxLength={30} />
            <Input value={bio} onChangeText={setBio} placeholder={t('bioPh')} maxLength={80} />
            <Btn primary title={t('save')} onPress={saveProfile} />
          </View>
        )}
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line }}>
          {[['posts', 'tabPosts'], ['reels', 'tabReels']].map(([k, key]) => (
            <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, padding: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: tab === k ? colors.c1 : 'transparent' }}>
              <Text style={{ color: tab === k ? colors.text : colors.muted, fontWeight: '600' }}>{t(key)}</Text>
            </Pressable>
          ))}
        </View>
        {!data.canSee ? <Empty>🔒 {t('privateLocked')}</Empty> : !posts.length ? <Empty>{t('noPostsYet')}</Empty>
          : <Grid posts={posts} onOpen={(p) => nav.navigate('Viewer', { items: [{ url: p.url, kind: p.kind, title: '@' + p.username + ' ' + (p.caption || '') }] })} />}
      </ScrollView>

      <ActionSheet visible={sheet === 'menu'} onClose={() => setSheet(null)} items={[
        [t('menuLanguage'), () => setTimeout(() => setSheet('lang'), 250)],
        [t('menuTheme'), () => setTimeout(() => setSheet('theme'), 250)],
        [dark ? t('menuDark') + ' ✓' : t('menuDark'), toggleDark],
        [t('menuActivity') + (unread ? ` (${unread})` : ''), hub('activity')],
        [t('menuRequests') + (requests.length ? ` (${requests.length})` : ''), hub('requests')],
        [t('menuPrivate', { state: me.private ? t('on') : t('off') }), togglePrivate],
        [t('menuStoryFor', { who }), () => { const v = storyAud === 'close' ? 'all' : 'close'; setStoryAud(v); toast(t('storyNowFor', { who: v === 'close' ? t('closeFriendsShort') : t('everyone') })); }],
        [t('menuClose'), hub('close')],
        [t('menuLimits'), hub('limits')],
        [t('menuSaved'), hub('saved')],
        [t('menuHistory'), hub('history')],
        [t('menuBlocked'), hub('blocked')],
        [t('menuData'), download],
        [t('menuDeactivate'), () => confirmDo(t('deactivateConfirm'), async () => { await api.deactivate().catch(() => {}); logout(); })],
        [t('menuLogout'), () => confirmDo(t('logoutConfirm'), logout)],
      ]} />
      <ActionSheet visible={sheet === 'lang'} title={t('language')} onClose={() => setSheet(null)} items={LANGUAGES.map((l) => [(l.code === lang ? '✓ ' : '') + l.name, () => setLang(l.code)])} />
      <ActionSheet visible={sheet === 'theme'} title={t('themeTitle')} onClose={() => setSheet(null)} items={Object.entries(THEMES).map(([k, th]) => [(k === themeKey ? '✓ ' : '') + th.n, () => setThemeKey(k)])} />
      <ActionSheet visible={sheet === 'more'} onClose={() => setSheet(null)} items={[
        rel && rel.blocked ? [t('unblock'), () => act(() => api.unblock(id))] : [t('block'), () => confirmDo(t('blockConfirm'), () => act(() => api.block(id)))],
        ...(rel && rel.followsMe ? [[t('removeFollower'), () => act(() => api.removeFollower(id))]] : []),
      ]} />
    </Screen>
  );
}

export const OwnProfile = () => <Profile own />;
