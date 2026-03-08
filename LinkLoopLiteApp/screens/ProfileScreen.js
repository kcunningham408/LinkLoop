import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Linking, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import GlassCard from '../components/GlassCard';
import LinkLoopBanner from '../components/LinkLoopBanner';
import { FadeIn, stagger } from '../config/animations';
import { haptic } from '../config/haptics';
import TYPE from '../config/typography';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const APP_VERSION = Constants.expoConfig?.version || Constants.manifest?.version || '1.1.0';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, logout, deleteAccount, updateUser, checkAuth } = useAuth();
  const { palette, getGradient } = useTheme();
  const isMember = user?.role === 'member';
  const accent = isMember ? palette.member : palette.warrior;
  const gradient = getGradient(isMember);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [editingWarriorName, setEditingWarriorName] = useState(false);
  const [newWarriorName, setNewWarriorName] = useState(user?.warriorDisplayName || '');
  const [savingWarriorName, setSavingWarriorName] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await checkAuth(); } catch (e) {}
    setRefreshing(false);
  };

  const handleLogout = () => {
    haptic.warning();
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const handleDeleteAccount = () => {
    haptic.heavy();
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This will remove all your data including glucose readings, care circle, and mood entries. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'This is permanent. All your data will be deleted forever. Are you absolutely sure?',
              [
                { text: 'Keep Account', style: 'cancel' },
                {
                  text: 'Yes, Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteAccount();
                    } catch (err) {
                      Alert.alert('Error', err.message || 'Could not delete account. Please try again.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleSaveName = async () => {
    if (!newName.trim()) { Alert.alert('Error', 'Name cannot be empty'); return; }
    haptic.medium();
    setSavingName(true);
    try {
      await updateUser({ name: newName.trim() });
      haptic.success();
      setEditingName(false);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not update name');
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveWarriorName = async () => {
    haptic.medium();
    setSavingWarriorName(true);
    try {
      await updateUser({ warriorDisplayName: newWarriorName.trim() || null });
      setEditingWarriorName(false);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not update warrior name');
    } finally {
      setSavingWarriorName(false);
    }
  };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 90 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} colors={[accent]} />}
    >
      {/* ── Hero Banner ── */}
      <FadeIn delay={0} slideY={0}>
      <LinkLoopBanner accent={accent} secondary={gradient[1] || accent}>
        {/* Decorative circles */}
        <View style={styles.heroDecoCircle1} />
        <View style={styles.heroDecoCircle2} />

        {/* Avatar with glow ring */}
        <View style={[styles.avatarRing, { borderColor: accent + '80' }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || '∞'}</Text>
          </View>
        </View>

        <Text style={styles.heroName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{user?.name || 'LinkLoop User'}</Text>
        <Text style={styles.heroEmail} numberOfLines={1}>{user?.email || ''}</Text>

        {/* Role badge */}
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>
            {isMember ? '∞ Loop Member' : '💙 T1D Warrior'}
          </Text>
        </View>

        {/* Quick stats row */}
        <View style={styles.heroStatsRow}>
          {memberSince && (
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Joined</Text>
              <Text style={styles.heroStatValue} numberOfLines={1}>{memberSince}</Text>
            </View>
          )}
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Role</Text>
            <Text style={styles.heroStatValue} numberOfLines={1}>{isMember ? 'Member' : 'Warrior'}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Version</Text>
            <Text style={styles.heroStatValue} numberOfLines={1}>v{APP_VERSION}</Text>
          </View>
        </View>
      </LinkLoopBanner>
      </FadeIn>

      <View style={styles.content}>
        <FadeIn delay={stagger(1, 100)}>
        {/* Account Settings */}
        <GlassCard style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Account Settings</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingIcon}>{'\uD83D\uDC64'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Display Name</Text>
                {editingName ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <TextInput
                      style={[styles.nameInput, { borderColor: accent }]}
                      value={newName}
                      onChangeText={setNewName}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleSaveName}
                    />
                    <TouchableOpacity onPress={handleSaveName} disabled={savingName} style={[styles.nameSaveBtn, { backgroundColor: accent }]}>
                      <Text style={styles.nameSaveBtnText}>{savingName ? '...' : 'Save'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setEditingName(false); setNewName(user?.name || ''); }} style={styles.nameCancelBtn}>
                      <Text style={styles.nameCancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => setEditingName(true)}>
                    <Text style={[styles.settingValue, { color: accent }]}>{user?.name || 'Not set'} ✏️</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingIcon}>{'\uD83D\uDCE7'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Email</Text>
                <Text style={styles.settingValue} numberOfLines={1}>{user?.email || 'Not set'}</Text>
              </View>
            </View>
          </View>

          {/* Warrior Display Name — only visible to Loop Members */}
          {isMember && (
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingIcon}>💙</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingTitle}>Warrior Name</Text>
                  <Text style={styles.settingDescription}>Customize how your warrior's name appears</Text>
                  {editingWarriorName ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <TextInput
                        style={[styles.nameInput, { borderColor: accent }]}
                        value={newWarriorName}
                        onChangeText={setNewWarriorName}
                        placeholder="e.g. Shayla, My Daughter"
                        placeholderTextColor="#666"
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={handleSaveWarriorName}
                      />
                      <TouchableOpacity onPress={handleSaveWarriorName} disabled={savingWarriorName} style={[styles.nameSaveBtn, { backgroundColor: accent }]}>
                        <Text style={styles.nameSaveBtnText}>{savingWarriorName ? '...' : 'Save'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { setEditingWarriorName(false); setNewWarriorName(user?.warriorDisplayName || ''); }} style={styles.nameCancelBtn}>
                        <Text style={styles.nameCancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => setEditingWarriorName(true)}>
                      <Text style={[styles.settingValue, { color: accent }]}>{user?.warriorDisplayName || 'Use default name'} ✏️</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}
        </GlassCard>

        {/* ── Navigation Menu ── */}
        <GlassCard style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Quick Access</Text>

          {/* Apple Watch — prominent at top */}
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => { haptic.light(); navigation.navigate('WatchSync'); }}
            activeOpacity={0.65}
          >
            <View style={[styles.navIconCircle, { backgroundColor: accent + '20' }]}>
              <Text style={styles.navIcon}>⌚</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navRowTitle}>Apple Watch</Text>
              <Text style={styles.navRowSub}>Pair your watch · complications · live glucose</Text>
            </View>
            <Text style={[styles.chevron, { color: accent }]}>›</Text>
          </TouchableOpacity>

          {/* Settings */}
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => { haptic.light(); navigation.navigate('Settings'); }}
            activeOpacity={0.65}
          >
            <View style={[styles.navIconCircle, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={styles.navIcon}>⚙️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navRowTitle}>Settings</Text>
              <Text style={styles.navRowSub}>Thresholds · notifications · theme</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </GlassCard>

        {/* App Info */}
        <GlassCard style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>App Information</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingIcon}>📱</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Version</Text>
                <Text style={styles.settingValue}>{APP_VERSION}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.settingItem} onPress={() => Linking.openURL('https://kcunningham408.github.io/vibecmd-pages/linkloop/privacy.html')}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingIcon}>🔒</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Privacy Policy</Text>
                <Text style={styles.settingDescription}>View our privacy policy</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={() => Linking.openURL('https://kcunningham408.github.io/vibecmd-pages/linkloop/terms.html')}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingIcon}>📋</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Terms of Service</Text>
                <Text style={styles.settingDescription}>View terms and conditions</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={() => Linking.openURL('https://kcunningham408.github.io/vibecmd-pages/linkloop/support.html')}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingIcon}>💬</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Support</Text>
                <Text style={styles.settingDescription}>Get help or report an issue</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </GlassCard>

        {/* Sign Out */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutIcon}>🚪</Text>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity style={styles.deleteAccountButton} onPress={handleDeleteAccount}>
          <Text style={styles.deleteAccountIcon}>⚠️</Text>
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>

        {/* Disclaimer */}
        <GlassCard style={styles.disclaimerCard}>
          <Text style={styles.disclaimerIcon}>💚</Text>
          <Text style={styles.disclaimerText}>
            LinkLoop is a personal wellness journal for logging your T1D data. It is not a medical device and does not provide medical advice.
          </Text>
        </GlassCard>
        </FadeIn>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { padding: 20 },

  // ── Hero Banner ──
  heroDecoCircle1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  heroDecoCircle2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  avatar: {
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 42, fontWeight: TYPE.bold, color: '#fff' },
  heroName: { fontSize: TYPE.h2, fontWeight: TYPE.extrabold, color: '#fff', marginBottom: 4, letterSpacing: -0.3 },
  heroEmail: { fontSize: TYPE.md, color: 'rgba(255,255,255,0.7)', marginBottom: 12 },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 18,
  },
  heroBadgeText: { fontSize: TYPE.sm, fontWeight: TYPE.bold, color: '#fff' },
  heroStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    width: '100%',
    justifyContent: 'space-evenly',
  },
  heroStat: { alignItems: 'center', flex: 1 },
  heroStatLabel: { fontSize: TYPE.xs, color: 'rgba(255,255,255,0.6)', fontWeight: TYPE.medium, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroStatValue: { fontSize: TYPE.md, color: '#fff', fontWeight: TYPE.bold, textAlign: 'center' },

  settingsCard: { borderRadius: 12, padding: 20, marginBottom: 20 },
  sectionTitle: { fontSize: TYPE.xl, fontWeight: TYPE.bold, color: '#fff', marginBottom: 15 },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  settingInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  settingIcon: { fontSize: TYPE.h3, marginRight: 14 },
  settingTitle: { fontSize: 15, fontWeight: TYPE.semibold, color: '#fff', marginBottom: 2 },
  settingValue: { fontSize: 13, color: '#A0A0A0' },
  settingDescription: { fontSize: TYPE.sm, color: '#888' },
  chevron: { fontSize: TYPE.h3, color: '#555', fontWeight: '300' },

  // ── Navigation Menu ──
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  navIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  navIcon: { fontSize: 22 },
  navRowTitle: { fontSize: 16, fontWeight: TYPE.semibold, color: '#fff', marginBottom: 2 },
  navRowSub: { fontSize: TYPE.sm, color: '#888' },

  logoutButton: { backgroundColor: 'rgba(255,60,60,0.08)', borderRadius: 12, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,60,60,0.15)' },
  logoutIcon: { fontSize: 20, marginRight: 10 },
  logoutText: { fontSize: TYPE.lg, fontWeight: TYPE.bold, color: '#FF6B6B' },
  deleteAccountButton: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  deleteAccountIcon: { fontSize: TYPE.xl, marginRight: 10 },
  deleteAccountText: { fontSize: TYPE.md, fontWeight: TYPE.semibold, color: '#888' },
  disclaimerCard: { borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 30 },
  disclaimerIcon: { fontSize: 20, marginRight: 10, marginTop: 2 },
  disclaimerText: { fontSize: TYPE.sm, color: '#888', flex: 1, lineHeight: 18 },
  nameInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: TYPE.md, color: '#fff', borderWidth: 1, borderColor: '#4A90D9' },
  nameSaveBtn: { backgroundColor: '#4A90D9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 8 },
  nameSaveBtnText: { color: '#fff', fontSize: 13, fontWeight: TYPE.semibold },
  nameCancelBtn: { paddingHorizontal: 10, paddingVertical: 6, marginLeft: 4 },
  nameCancelBtnText: { color: '#888', fontSize: 13 },
});
