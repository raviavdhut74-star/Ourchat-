import React from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from './src/store.js';
import { CallProvider } from './src/CallProvider.js';
import { Toast } from './src/ui.js';
import { pickMedia, uploadFile } from './src/media.js';
import Login from './src/screens/Login.js';
import Home from './src/screens/Home.js';
import Reels from './src/screens/Reels.js';
import Chats from './src/screens/Chats.js';
import Chat from './src/screens/Chat.js';
import Profile, { OwnProfile } from './src/screens/Profile.js';
import { Comments, Forward, Gallery, Hub, Tag, Viewer } from './src/screens/Misc.js';

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const Nothing = () => null;

function TabIcon({ glyph, focused }) {
  const { colors } = useApp();
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55, color: colors.c1 }}>{glyph}</Text>;
}

function MainTabs() {
  const { t, api, colors, toast, errText, bump } = useApp();

  // the middle "Post" button opens the picker instead of a screen
  const newPost = async (navigation) => {
    const f = await pickMedia({ kind: 'all' });
    if (!f) return;
    toast(t('uploading'));
    try {
      const up = await uploadFile(api, f);
      await api.createPost({ url: up.url, kind: f.isVideo ? 'video' : 'image', caption: '' });
      toast(t('postAdded')); bump(); navigation.navigate('Home');
    } catch (e) { toast(errText(e)); }
  };

  return (
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.c1, tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line }, lazy: true }}>
      <Tabs.Screen name="Home" component={Home} options={{ title: t('navHome'), tabBarIcon: (p) => <TabIcon glyph="🏠" {...p} /> }} />
      <Tabs.Screen name="Reels" component={Reels} options={{ title: t('navReels'), tabBarIcon: (p) => <TabIcon glyph="🎬" {...p} /> }} />
      <Tabs.Screen name="Post" component={Nothing} options={{ title: t('navPost'), tabBarIcon: (p) => <TabIcon glyph="➕" {...p} /> }}
        listeners={({ navigation }) => ({ tabPress: (e) => { e.preventDefault(); newPost(navigation); } })} />
      <Tabs.Screen name="Chats" component={Chats} options={{ title: t('navChats'), tabBarIcon: (p) => <TabIcon glyph="💬" {...p} /> }} />
      <Tabs.Screen name="Profile" component={OwnProfile} options={{ title: t('navProfile'), tabBarIcon: (p) => <TabIcon glyph="👤" {...p} /> }} />
    </Tabs.Navigator>
  );
}

function Root() {
  const { ready, token, me, dark, colors } = useApp();
  if (!ready || (token && !me)) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}><ActivityIndicator color={colors.c1} size="large" /></View>;
  }
  if (!token || !me) return <Login />;

  const base = dark ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: colors.bg, card: colors.card, text: colors.text, border: colors.line, primary: colors.c1 } };
  return (
    <NavigationContainer theme={theme}>
      <CallProvider>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Chat" component={Chat} />
          <Stack.Screen name="User" component={Profile} />
          <Stack.Screen name="Comments" component={Comments} options={{ presentation: 'modal' }} />
          <Stack.Screen name="Forward" component={Forward} options={{ presentation: 'modal' }} />
          <Stack.Screen name="Hub" component={Hub} />
          <Stack.Screen name="Tag" component={Tag} />
          <Stack.Screen name="Gallery" component={Gallery} />
          <Stack.Screen name="Viewer" component={Viewer} options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        </Stack.Navigator>
      </CallProvider>
    </NavigationContainer>
  );
}

function Shell() {
  const { dark } = useApp();
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Root />
      <Toast />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </SafeAreaProvider>
  );
}
