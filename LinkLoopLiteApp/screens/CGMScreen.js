import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Dimensions, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import TYPE from '../config/typography';
import { haptic } from '../config/haptics';
import { FadeIn, stagger } from '../config/animations';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { alertsAPI, dexcomAPI, glucoseAPI, nightscoutAPI, notesAPI } from '../services/api';

const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes — matches Dexcom G7 update interval

const { width } = Dimensions.get('window');

const TREND_OPTIONS = [
  { value: 'rising_fast', arrow: '↑↑', label: 'Rising Fast' },
  { value: 'rising', arrow: '↑', label: 'Rising' },
  { value: 'stable', arrow: '→', label: 'Stable' },
  { value: 'falling', arrow: '↓', label: 'Falling' },
  { value: 'falling_fast', arrow: '↓↓', label: 'Falling Fast' },
];

export default function CGMScreen({ navigation }) {
  const { user } = useAuth();
  const { getAccent } = useTheme();
  const isMember = user?.role === 'member';
  const accent = getAccent(isMember);

  // Use the warrior's personal thresholds if set, otherwise standard defaults
  const lowThreshold = user?.settings?.lowThreshold ?? 70;
  const highThreshold = user?.settings?.highThreshold ?? 180;

  const [currentGlucose, setCurrentGlucose] = useState(null);
  const [readings, setReadings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [newTrend, setNewTrend] = useState('stable');
  const [newNotes, setNewNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [shareStatus, setShareStatus] = useState({ connected: false, username: null, lastSync: null, region: 'us' });
  const [shareSyncing, setShareSyncing] = useState(false);
  const [warriorName, setWarriorName] = useState('');

  // Nightscout
  const [nsStatus, setNsStatus] = useState({ connected: false, url: null, lastSync: null });
  const [nsSyncing, setNsSyncing] = useState(false);
  const [showNsConnect, setShowNsConnect] = useState(false);
  const [nsUrl, setNsUrl] = useState('');
  const [nsSecret, setNsSecret] = useState('');
  const [nsConnecting, setNsConnecting] = useState(false);

  // Notes
  const [notes, setNotes] = useState([]);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      if (isMember && user?.linkedOwnerId) {
        // Loop Member: fetch the linked warrior's data in one call
        const data = await glucoseAPI.getMemberView(user.linkedOwnerId, 24);
        setReadings(data.readings || []);
        setCurrentGlucose(data.latest || null);
        setStats(data.stats || null);
        if (data.ownerName) setWarriorName(data.ownerName);
      } else {
        // T1D Warrior: fetch own data
        const [readingsData, statsData, shareStatusData, nsStatusData] = await Promise.allSettled([
          glucoseAPI.getReadings(24),
          glucoseAPI.getStats(24),
          dexcomAPI.getShareStatus(),
          nightscoutAPI.getStatus(),
        ]);
        if (readingsData.status === 'fulfilled') {
          const r = readingsData.value;
          setReadings(r);
          if (r.length > 0) setCurrentGlucose(r[0]);
        }
        if (statsData.status === 'fulfilled') setStats(statsData.value);
        if (shareStatusData.status === 'fulfilled') setShareStatus(shareStatusData.value);
        if (nsStatusData.status === 'fulfilled') setNsStatus(nsStatusData.value);
      }
      // Load notes for the timeline
      try {
        const notesData = await notesAPI.getAll(24);
        setNotes(Array.isArray(notesData) ? notesData : []);
      } catch (e) { /* notes are optional */ }
    } catch (err) {
      console.log('CGM load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isMember, user?.linkedOwnerId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 5 min while screen is open — matches Dexcom G7 update interval
  useEffect(() => {
    const interval = setInterval(() => { loadData(); }, AUTO_REFRESH_MS);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') loadData(); // also refresh when user returns to app
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleAddReading = async () => {
    const val = parseInt(newValue);
    if (!val || val < 20 || val > 600) {
      Alert.alert('Invalid', 'Enter a glucose value between 20-600 mg/dL');
      return;
    }
    setSaving(true);
    try {
      await glucoseAPI.addReading(val, newTrend, 'manual', newNotes);
      // Auto-trigger alert check for this reading
      alertsAPI.triggerCheck(val).catch(() => {});
      setShowAddModal(false);
      setNewValue('');
      setNewNotes('');
      setNewTrend('stable');
      loadData();
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save reading');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncShare = async () => {
    setShareSyncing(true);
    try {
      const result = await dexcomAPI.syncShare();
      Alert.alert('Sync Complete', result.message || `Synced ${result.synced} readings`);
      // Trigger alert check for the latest reading after sync
      if (result.latestValue) alertsAPI.triggerCheck(result.latestValue).catch(() => {});
      loadData();
    } catch (err) {
      Alert.alert('Sync Failed', err.message || 'Could not sync via Dexcom Share');
    } finally {
      setShareSyncing(false);
    }
  };

  const handleDisconnectShare = () => {
    Alert.alert(
      'Disconnect Dexcom Share',
      'This will remove your Dexcom Share credentials. Your existing readings will be kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await dexcomAPI.disconnectShare();
              setShareStatus({ connected: false, username: null, lastSync: null, region: 'us' });
              Alert.alert('Disconnected', 'Dexcom Share has been disconnected.');
            } catch (err) {
              Alert.alert('Error', err.message || 'Could not disconnect');
            }
          },
        },
      ]
    );
  };

  // ── Nightscout handlers ────────────────────────────────────────────────────
  const handleNsConnect = async () => {
    if (!nsUrl.trim()) {
      Alert.alert('Required', 'Enter your Nightscout site URL');
      return;
    }
    setNsConnecting(true);
    try {
      const result = await nightscoutAPI.connect(nsUrl.trim(), nsSecret.trim() || null);
      setNsStatus({ connected: true, url: result.url, lastSync: null });
      setShowNsConnect(false);
      setNsUrl('');
      setNsSecret('');
      Alert.alert('Connected!', 'Nightscout is connected. Tap Sync Now to pull your latest readings.');
    } catch (err) {
      Alert.alert('Connection Failed', err.message || 'Could not connect to Nightscout');
    } finally {
      setNsConnecting(false);
    }
  };

  const handleNsSync = async () => {
    setNsSyncing(true);
    try {
      const result = await nightscoutAPI.sync();
      Alert.alert('Sync Complete', result.message || `Synced ${result.synced} readings`);
      // Trigger alert check for the latest reading after sync
      if (result.latestValue) alertsAPI.triggerCheck(result.latestValue).catch(() => {});
      loadData();
    } catch (err) {
      Alert.alert('Sync Failed', err.message || 'Could not sync from Nightscout');
    } finally {
      setNsSyncing(false);
    }
  };

  const handleNsDisconnect = () => {
    Alert.alert(
      'Disconnect Nightscout',
      'This will remove your Nightscout URL. Your existing readings will be kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await nightscoutAPI.disconnect();
              setNsStatus({ connected: false, url: null, lastSync: null });
              Alert.alert('Disconnected', 'Nightscout has been disconnected.');
            } catch (err) {
              Alert.alert('Error', err.message || 'Could not disconnect');
            }
          },
        },
      ]
    );
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;
    haptic.medium();
    setNoteSaving(true);
    try {
      await notesAPI.add(newNoteText.trim());
      setNewNoteText('');
      setShowNoteModal(false);
      loadData();
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save note');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleDeleteNote = (id) => {
    haptic.warning();
    Alert.alert('Delete Note', 'Remove this note?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await notesAPI.remove(id); loadData(); }
        catch (err) { Alert.alert('Error', 'Could not delete note'); }
      }},
    ]);
  };

  const getGlucoseColor = (value) => {
    if (!value) return accent;
    if (value < lowThreshold) return '#FF6B6B';
    if (value > highThreshold) return '#FFA500';
    return accent;
  };

  const getGlucoseStatus = (value) => {
    if (!value) return '';
    if (value < lowThreshold) return 'LOW';
    if (value > highThreshold) return 'HIGH';
    return 'IN RANGE';
  };

  const getTrendArrow = () => {
    if (!currentGlucose) return '→';
    const t = TREND_OPTIONS.find(o => o.value === currentGlucose.trend);
    return t ? t.arrow : (currentGlucose.trendArrow || '→');
  };

  // Returns minutes since last reading, or null if no reading
  const minutesSinceReading = () => {
    if (!currentGlucose?.timestamp) return null;
    return Math.floor((Date.now() - new Date(currentGlucose.timestamp).getTime()) / 60000);
  };
  const minsOld = minutesSinceReading();
  const isStale = minsOld !== null && minsOld > 30;

  const glucoseValue = currentGlucose ? currentGlucose.value : '--';
  const glucoseColor = getGlucoseColor(currentGlucose?.value);
  const chartReadings = readings.slice(0, 12).reverse();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[accent]} />}
    >
      <LinearGradient
        colors={[glucoseColor, glucoseColor, '#111111']}
        style={styles.headerGradient}
        locations={[0, 0.6, 1]}
      >
      {isMember && (
          <Text style={styles.memberBanner}>
            👁 Watching {warriorName || 'your warrior'}'s loop
          </Text>
        )}
        {isStale && (
          <View style={styles.staleBanner}>
            <Text style={styles.staleBannerText}>
              ⚠️ Data is {minsOld} min old — {isMember ? 'warrior may be offline' : 'app may be in background'}
            </Text>
          </View>
        )}
        <View style={styles.currentReading}>
          <Text style={styles.glucoseValue}>{glucoseValue}</Text>
          <Text style={styles.glucoseUnit}>mg/dL</Text>
          <Text style={styles.trendArrow}>{getTrendArrow()}</Text>
        </View>
        {currentGlucose && (
          <>
            <Text style={styles.statusText}>{getGlucoseStatus(currentGlucose.value)}</Text>
            <Text style={styles.lastUpdate}>
              {currentGlucose.source === 'dexcom' ? '🩸 Dexcom · ' : currentGlucose.source === 'nightscout' ? '🌐 Nightscout · ' : '📱 Manual · '}
              {new Date(currentGlucose.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </>
        )}
        {!currentGlucose && !loading && (
          <Text style={styles.lastUpdate}>
            {isMember ? 'No readings from your warrior yet' : 'No readings yet — tap + to log one'}
          </Text>
        )}
      </LinearGradient>

      <View style={styles.content}>
        {/* Warriors only: log reading button */}
        {!isMember && (
          <FadeIn delay={stagger(0, 100)}>
          <TouchableOpacity style={[styles.addButton, { backgroundColor: accent }]} onPress={() => setShowAddModal(true)}>
            <Text style={styles.addButtonIcon}>➕</Text>
            <Text style={styles.addButtonText}>Log Glucose Reading</Text>
          </TouchableOpacity>
          </FadeIn>
        )}

        <FadeIn delay={stagger(1, 100)}>
        <View style={styles.chartContainer}>
          <Text style={styles.sectionTitle}>Today's Readings</Text>
          {loading ? (
            <ActivityIndicator size="small" color={accent} style={{ paddingVertical: 40 }} />
          ) : chartReadings.length > 0 ? (
            <View style={styles.chartArea}>
              <View style={styles.chartGrid}>
                <View style={[styles.gridLine, styles.highLine]} />
                <Text style={styles.gridLabel}>180</Text>
                <View style={[styles.gridLine, styles.targetLine, { borderColor: accent }]} />
                <Text style={[styles.gridLabel, styles.targetLabel]}>Target</Text>
                <View style={[styles.gridLine, styles.lowLine]} />
                <Text style={styles.gridLabel}>70</Text>
              </View>
              <View style={styles.pointsContainer}>
                {chartReadings.map((reading, index) => {
                  const position = ((reading.value - 50) / 150) * 100;
                  return (
                    <View key={index} style={[styles.dataPoint, { bottom: `${Math.min(Math.max(position, 5), 95)}%` }]}>
                      <View style={[styles.point, { backgroundColor: getGlucoseColor(reading.value) }]} />
                    </View>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyEmoji}>📊</Text>
              <Text style={styles.emptyText}>No readings in the last 24 hours</Text>
            </View>
          )}
          {chartReadings.length > 0 && (
            <View style={styles.timeLabels}>
              {chartReadings.map((reading, index) => (
                <Text key={index} style={styles.timeLabel}>
                  {new Date(reading.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Text>
              ))}
            </View>
          )}
        </View>
        </FadeIn>

        <FadeIn delay={stagger(2, 100)}>
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Today's Stats</Text>
          {stats && stats.count > 0 ? (
            <View style={styles.statsGrid}>
              <StatCard label="Time in Range" value={stats.timeInRange + '%'} color={accent} />
              <StatCard label="Avg Glucose" value={'' + stats.average} color="#666" />
              <StatCard label="High Events" value={'' + stats.high} color="#FFA500" />
              <StatCard label="Low Events" value={'' + stats.low} color="#FF6B6B" />
            </View>
          ) : (
            <Text style={styles.noDataText}>Log readings to see your stats</Text>
          )}
        </View>
        </FadeIn>

        {/* Notes Timeline */}
        <FadeIn delay={stagger(3, 100)}>
        <View style={styles.notesContainer}>
          <View style={styles.notesHeader}>
            <Text style={styles.sectionTitle}>📝 Notes</Text>
            <TouchableOpacity style={[styles.addNoteBtn, { borderColor: accent }]} onPress={() => setShowNoteModal(true)}>
              <Text style={[styles.addNoteBtnText, { color: accent }]}>+ Add Note</Text>
            </TouchableOpacity>
          </View>
          {notes.length > 0 ? (
            notes.slice(0, 5).map((n) => (
              <TouchableOpacity key={n._id} style={styles.noteCard} onLongPress={() => handleDeleteNote(n._id)}>
                <View style={styles.noteHeader}>
                  <Text style={[styles.noteAuthor, { color: accent }]}>{n.authorEmoji || '📝'} {n.authorName}</Text>
                  <Text style={styles.noteTime}>
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.noteText}>{n.text}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.noNotesText}>No notes today — add one to share with your circle</Text>
          )}
        </View>
        </FadeIn>

        {/* Warriors only: connected devices & Dexcom controls */}
        {!isMember && (
          <FadeIn delay={stagger(4, 100)}>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>🔗 Connected Devices</Text>

            {/* Manual Entry */}
            <View style={styles.deviceItem}>
              <Text style={styles.deviceEmoji}>📱</Text>
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>Manual Entry</Text>
                <Text style={[styles.deviceStatus, { color: accent }]}>
                  {currentGlucose ? 'Last log: ' + new Date(currentGlucose.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No data yet'}
                </Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: currentGlucose ? accent : '#ccc' }]} />
            </View>

            {/* Dexcom Share — the one and only CGM integration */}
            <View style={styles.deviceDivider} />
            {shareStatus.connected ? (
              <>
                <View style={styles.deviceItem}>
                  <Text style={styles.deviceEmoji}>🩸</Text>
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>Dexcom CGM · Live</Text>
                    <Text style={[styles.deviceStatus, { color: '#00D4AA' }]}>
                      {shareStatus.lastSync
                        ? '⚡ Last sync: ' + new Date(shareStatus.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : `⚡ Connected as ${shareStatus.username}`}
                    </Text>
                  </View>
                  <View style={[styles.statusDot, { backgroundColor: '#00D4AA' }]} />
                </View>
                <View style={styles.dexcomActions}>
                  <TouchableOpacity style={[styles.dexcomSyncButton, { backgroundColor: '#00D4AA' }]} onPress={handleSyncShare} disabled={shareSyncing}>
                    {shareSyncing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.dexcomButtonIcon}>⚡</Text>
                        <Text style={styles.dexcomSyncText}>Sync Now</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dexcomDisconnectButton} onPress={handleDisconnectShare}>
                    <Text style={styles.dexcomDisconnectText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.shareNote}>⚡ Real-time via Dexcom Share · syncs every 5 min</Text>
              </>
            ) : (
              <TouchableOpacity
                style={styles.connectDexcomButton}
                onPress={() => navigation.navigate('DexcomConnect')}
              >
                <Text style={styles.connectDexcomIcon}>🩸</Text>
                <View style={styles.connectDexcomInfo}>
                  <Text style={styles.connectDexcomTitle}>Connect Dexcom CGM</Text>
                  <Text style={styles.connectDexcomSub}>Real-time · Same feed as the Follow app</Text>
                </View>
                <Text style={styles.connectChevron}>›</Text>
              </TouchableOpacity>
            )}

            {/* Nightscout — universal CGM bridge */}
            <View style={styles.deviceDivider} />
            {nsStatus.connected ? (
              <>
                <View style={styles.deviceItem}>
                  <Text style={styles.deviceEmoji}>🌐</Text>
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>Nightscout · Live</Text>
                    <Text style={[styles.deviceStatus, { color: '#9B59B6' }]}>
                      {nsStatus.lastSync
                        ? '⚡ Last sync: ' + new Date(nsStatus.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '⚡ Connected'}
                    </Text>
                  </View>
                  <View style={[styles.statusDot, { backgroundColor: '#9B59B6' }]} />
                </View>
                <View style={styles.dexcomActions}>
                  <TouchableOpacity style={[styles.dexcomSyncButton, { backgroundColor: '#9B59B6' }]} onPress={handleNsSync} disabled={nsSyncing}>
                    {nsSyncing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.dexcomButtonIcon}>⚡</Text>
                        <Text style={styles.dexcomSyncText}>Sync Now</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dexcomDisconnectButton} onPress={handleNsDisconnect}>
                    <Text style={styles.dexcomDisconnectText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.shareNote, { color: '#9B59B6' }]}>🌐 Supports Dexcom, Libre, Medtronic & more</Text>
              </>
            ) : (
              <TouchableOpacity
                style={styles.connectDexcomButton}
                onPress={() => setShowNsConnect(true)}
              >
                <Text style={styles.connectDexcomIcon}>🌐</Text>
                <View style={styles.connectDexcomInfo}>
                  <Text style={styles.connectDexcomTitle}>Connect Nightscout</Text>
                  <Text style={styles.connectDexcomSub}>Universal · Dexcom, Libre, Medtronic & more</Text>
                </View>
                <Text style={styles.connectChevron}>›</Text>
              </TouchableOpacity>
            )}
          </View>
          </FadeIn>
        )}

      </View>

      {/* Add Reading Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Log Glucose Reading</Text>
            <Text style={styles.inputLabel}>Glucose Value (mg/dL)</Text>
            <TextInput style={styles.input} placeholder="e.g. 120" keyboardType="numeric" value={newValue} onChangeText={setNewValue} maxLength={3} />
            <Text style={styles.inputLabel}>Trend</Text>
            <View style={styles.trendRow}>
              {TREND_OPTIONS.map(t => (
                <TouchableOpacity key={t.value} style={[styles.trendButton, newTrend === t.value && [styles.trendButtonActive, { backgroundColor: accent, borderColor: accent }]]} onPress={() => setNewTrend(t.value)}>
                  <Text style={[styles.trendButtonText, newTrend === t.value && styles.trendButtonTextActive]}>{t.arrow}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput style={[styles.input, { height: 60 }]} placeholder="After lunch, before exercise..." value={newNotes} onChangeText={setNewNotes} multiline />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: accent }]} onPress={handleAddReading} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Nightscout Connect Modal */}
      <Modal visible={showNsConnect} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Connect Nightscout</Text>
            <Text style={{ fontSize: 13, color: '#A0A0A0', textAlign: 'center', marginBottom: 16, lineHeight: 19 }}>
              Works with Dexcom, Freestyle Libre, Medtronic, and any CGM connected to your Nightscout site.
            </Text>
            <Text style={styles.inputLabel}>Nightscout URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://mysite.herokuapp.com"
              placeholderTextColor="#555"
              value={nsUrl}
              onChangeText={setNsUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Text style={styles.inputLabel}>API Secret (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Leave blank if not required"
              placeholderTextColor="#555"
              value={nsSecret}
              onChangeText={setNsSecret}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Text style={{ fontSize: 11, color: '#666', marginTop: 6 }}>
              Your API secret is stored securely and only used to read glucose data from your Nightscout site.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowNsConnect(false); setNsUrl(''); setNsSecret(''); }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: '#9B59B6' }]} onPress={handleNsConnect} disabled={nsConnecting}>
                {nsConnecting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Connect</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Note Modal */}
      <Modal visible={showNoteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📝 Add a Note</Text>
            <Text style={{ fontSize: 13, color: '#A0A0A0', textAlign: 'center', marginBottom: 16, lineHeight: 19 }}>
              Notes appear on the glucose timeline and are visible to your Care Circle.
            </Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              placeholder="e.g. Had pizza for dinner, feeling tired..."
              placeholderTextColor="#555"
              value={newNoteText}
              onChangeText={setNewNoteText}
              multiline
              maxLength={500}
              autoFocus
            />
            <Text style={{ fontSize: 11, color: '#555', textAlign: 'right', marginTop: 4, marginBottom: 12 }}>{newNoteText.length}/500</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowNoteModal(false); setNewNoteText(''); }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: accent }]} onPress={handleAddNote} disabled={noteSaving || !newNoteText.trim()}>
                {noteSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Note</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

function StatCard({ label, value, color }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  headerGradient: { padding: 30, alignItems: 'center', paddingBottom: 40 },
  memberBanner: { fontSize: 13, color: '#fff', opacity: 0.85, marginBottom: 10, backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  staleBanner: { backgroundColor: 'rgba(255,165,0,0.25)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,165,0,0.5)' },
  staleBannerText: { fontSize: 13, color: '#FFA500', fontWeight: TYPE.semibold, textAlign: 'center' },
  currentReading: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  glucoseValue: { fontSize: TYPE.mega, fontWeight: TYPE.bold, color: '#fff' },
  glucoseUnit: { fontSize: 20, color: '#fff', opacity: 0.9, marginLeft: 5 },
  trendArrow: { fontSize: 40, marginLeft: 15, color: '#fff' },
  statusText: { fontSize: TYPE.xl, fontWeight: TYPE.bold, color: '#fff', marginBottom: 5 },
  lastUpdate: { fontSize: TYPE.md, color: '#fff', opacity: 0.8 },
  content: { padding: 20 },
  addButton: { backgroundColor: '#4A90D9', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  addButtonIcon: { fontSize: 20, marginRight: 10 },
  addButtonText: { color: '#fff', fontSize: TYPE.lg, fontWeight: TYPE.bold },
  chartContainer: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#2C2C2E', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  sectionTitle: { fontSize: TYPE.xl, fontWeight: TYPE.bold, color: '#fff', marginBottom: 15 },
  chartArea: { height: 200, position: 'relative', borderLeftWidth: 2, borderBottomWidth: 2, borderColor: '#3A3A3C' },
  chartGrid: { position: 'absolute', width: '100%', height: '100%' },
  gridLine: { position: 'absolute', width: '100%', height: 1, borderStyle: 'dashed', borderWidth: 1 },
  highLine: { borderColor: '#FFA500', top: '20%' },
  targetLine: { borderColor: '#4A90D9', top: '50%' },
  lowLine: { borderColor: '#FF6B6B', top: '80%' },
  gridLabel: { position: 'absolute', right: 5, fontSize: TYPE.xs, color: '#888' },
  targetLabel: { top: '48%' },
  pointsContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end' },
  dataPoint: { position: 'absolute', width: width / 12 },
  point: { width: 12, height: 12, borderRadius: 6, alignSelf: 'center' },
  timeLabels: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  timeLabel: { fontSize: 11, color: '#A0A0A0' },
  emptyChart: { alignItems: 'center', paddingVertical: 30 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: TYPE.md, color: '#888' },
  statsContainer: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#2C2C2E', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { width: '48%', alignItems: 'center', padding: 15, backgroundColor: '#2C2C2E', borderRadius: 8, marginBottom: 10 },
  statValue: { fontSize: TYPE.h2, fontWeight: TYPE.bold, marginBottom: 5 },
  statLabel: { fontSize: TYPE.sm, color: '#A0A0A0', textAlign: 'center' },
  noDataText: { fontSize: TYPE.md, color: '#888', textAlign: 'center', paddingVertical: 15 },
  infoCard: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#2C2C2E', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  infoCardTitle: { fontSize: TYPE.lg, fontWeight: TYPE.bold, color: '#fff', marginBottom: 15 },
  deviceItem: { flexDirection: 'row', alignItems: 'center' },
  deviceEmoji: { fontSize: 30, marginRight: 15 },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: TYPE.lg, fontWeight: TYPE.semibold, color: '#fff', marginBottom: 3 },
  deviceStatus: { fontSize: 13, color: '#4A90D9' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  deviceDivider: { height: 1, backgroundColor: '#2C2C2E', marginVertical: 12 },
  dexcomActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  dexcomSyncButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4A90D9', borderRadius: 8, paddingVertical: 10, gap: 6 },
  dexcomButtonIcon: { fontSize: 16 },
  dexcomSyncText: { fontSize: TYPE.md, fontWeight: TYPE.bold, color: '#fff' },
  dexcomDisconnectButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2A1A1A', borderWidth: 1, borderColor: '#3A2020', justifyContent: 'center' },
  dexcomDisconnectText: { fontSize: 13, color: '#FF6B6B', fontWeight: TYPE.semibold },
  connectDexcomButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  connectDexcomIcon: { fontSize: 30, marginRight: 15 },
  connectDexcomInfo: { flex: 1 },
  connectDexcomTitle: { fontSize: TYPE.lg, fontWeight: TYPE.semibold, color: '#fff', marginBottom: 3 },
  connectDexcomSub: { fontSize: 13, color: '#A0A0A0' },
  connectChevron: { fontSize: TYPE.h3, color: '#555', fontWeight: '300' },
  shareNote: { fontSize: TYPE.sm, color: '#00D4AA', textAlign: 'center', marginTop: 8, marginBottom: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 25, paddingBottom: 40 },
  modalTitle: { fontSize: TYPE.xxl, fontWeight: TYPE.bold, color: '#fff', marginBottom: 20, textAlign: 'center' },
  inputLabel: { fontSize: TYPE.md, fontWeight: TYPE.semibold, color: '#E0E0E0', marginBottom: 8, marginTop: 10 },
  input: { backgroundColor: '#2C2C2E', borderRadius: 10, padding: 14, fontSize: TYPE.lg, borderWidth: 1, borderColor: '#3A3A3C', color: '#fff' },
  trendRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  trendButton: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#2C2C2E', alignItems: 'center', borderWidth: 1, borderColor: '#3A3A3C' },
  trendButtonActive: { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  trendButtonText: { fontSize: 20, color: '#A0A0A0' },
  trendButtonTextActive: { color: '#fff' },
  modalButtons: { flexDirection: 'row', marginTop: 25, gap: 12 },
  cancelButton: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#2C2C2E', alignItems: 'center' },
  cancelButtonText: { fontSize: TYPE.lg, color: '#A0A0A0', fontWeight: TYPE.semibold },
  saveButton: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#4A90D9', alignItems: 'center' },
  saveButtonText: { fontSize: TYPE.lg, color: '#fff', fontWeight: TYPE.bold },

  // Notes
  notesContainer: { marginBottom: 20 },
  notesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addNoteBtn: { backgroundColor: '#1A2235', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#4A90D9' },
  addNoteBtnText: { color: '#4A90D9', fontSize: 13, fontWeight: TYPE.semibold },
  noteCard: { backgroundColor: '#1C1C1E', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#2C2C2E', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  noteAuthor: { fontSize: 13, color: '#4A90D9', fontWeight: TYPE.semibold },
  noteTime: { fontSize: 11, color: '#666' },
  noteText: { fontSize: TYPE.md, color: '#D0D0D0', lineHeight: 20 },
  noNotesText: { fontSize: 13, color: '#666', textAlign: 'center', paddingVertical: 15 },
});
