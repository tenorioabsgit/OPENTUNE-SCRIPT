import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../src/constants/Colors';
import { Layout } from '../../src/constants/Layout';
import { useAuth } from '../../src/contexts/AuthContext';
import { usePlayer } from '../../src/contexts/PlayerContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Track } from '../../src/types';
import { getAllCopyleftTracks } from '../../src/services/firestore';
import {
  tracks as mockTracks,
  defaultPlaylists,
  artists,
  albums,
} from '../../src/data/mockData';
import PlaylistCard from '../../src/components/PlaylistCard';
import RecentCard from '../../src/components/RecentCard';
import SectionHeader from '../../src/components/SectionHeader';
import TrackRow from '../../src/components/TrackRow';
import LanguageToggle from '../../src/components/LanguageToggle';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type FilterType = 'all' | 'music' | 'playlists';

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const { playTrack } = usePlayer();
  const { t } = useLanguage();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');
  const [communityTracks, setCommunityTracks] = useState<Track[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);

  const greeting = getGreeting();

  useEffect(() => {
    loadCommunityTracks();
  }, []);

  async function loadCommunityTracks() {
    try {
      const tracks = await getAllCopyleftTracks(20);
      setCommunityTracks(tracks);
    } catch (e) {
      console.error('Error loading community tracks:', e);
    } finally {
      setIsLoadingTracks(false);
    }
  }

  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.goodMorning');
    if (hour < 18) return t('home.goodAfternoon');
    return t('home.goodEvening');
  }

  const recentItems = useMemo(() => shuffle(defaultPlaylists.slice(0, 6)), [communityTracks]);
  const madeForYou = useMemo(() => shuffle(defaultPlaylists.slice(0, 4)), [communityTracks]);
  const allTracks = communityTracks.length > 0 ? communityTracks : mockTracks.slice(0, 8);
  const trendingTracks = useMemo(() => shuffle(allTracks.slice(0, 8)), [allTracks]);
  const newReleases = useMemo(() => shuffle(albums.slice(0, 6)), [communityTracks]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#1a3a2a', Colors.background, Colors.background]}
        style={styles.gradient}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.greeting}>{greeting}</Text>
            <View style={styles.headerIcons}>
              <LanguageToggle />
              <TouchableOpacity
                style={styles.headerIcon}
                onPress={() => router.push('/upload')}
              >
                <Ionicons name="add-circle-outline" size={28} color={Colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIcon}
                onPress={() => {
                  if (Platform.OS === 'web') {
                    if (window.confirm('Deseja sair da sua conta?')) {
                      signOut();
                    }
                  } else {
                    Alert.alert('Sair', 'Deseja sair da sua conta?', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Sair', style: 'destructive', onPress: () => signOut() },
                    ]);
                  }
                }}
              >
                <Ionicons name="log-out-outline" size={26} color="#ff5252" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter chips */}
          <View style={styles.filterRow}>
            {(['all', 'music', 'playlists'] as FilterType[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, filter === f && styles.filterChipActive]}
                onPress={() => setFilter(f)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filter === f && styles.filterChipTextActive,
                  ]}
                >
                  {f === 'all' ? t('home.all') : f === 'music' ? t('home.music') : t('home.playlists')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Recent items grid (2 columns) */}
          {filter !== 'music' && (
            <View style={styles.recentGrid}>
              {recentItems.map((item) => (
                <RecentCard
                  key={item.id}
                  title={item.title}
                  artwork={item.artwork}
                  onPress={() => router.push(`/playlist/${item.id}`)}
                />
              ))}
            </View>
          )}

          {/* Made For You */}
          {filter !== 'music' && (
            <>
              <SectionHeader title={t('home.madeForYou')} />
              <FlatList
                data={madeForYou}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <PlaylistCard playlist={item} showDescription />
                )}
              />
            </>
          )}

          {/* Community Tracks */}
          {filter !== 'playlists' && communityTracks.length > 0 && (
            <>
              <SectionHeader title={t('home.communityCopyleft')} />
              <View style={styles.trackSection}>
                {communityTracks.slice(0, 5).map((track, index) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    trackList={communityTracks}
                    index={index}
                  />
                ))}
              </View>
            </>
          )}

          {/* Trending */}
          {filter !== 'playlists' && (
            <>
              <SectionHeader title={t('home.trending')} />
              {isLoadingTracks ? (
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
              ) : (
                <View style={styles.trackSection}>
                  {trendingTracks.slice(0, 5).map((track, index) => (
                    <TrackRow
                      key={track.id}
                      track={track}
                      trackList={trendingTracks}
                      index={index}
                    />
                  ))}
                </View>
              )}
            </>
          )}

          {/* New Releases */}
          {filter !== 'playlists' && (
            <>
              <SectionHeader title={t('home.newReleases')} />
              <FlatList
                data={newReleases}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.albumCard}>
                    <Image
                      source={{ uri: item.artwork }}
                      style={styles.albumArtwork}
                    />
                    <Text style={styles.albumTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.albumArtist} numberOfLines={1}>
                      {item.artist}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </>
          )}

          {/* Popular Artists */}
          {filter !== 'playlists' && (
            <>
              <SectionHeader title={t('home.popularArtists')} />
              <FlatList
                data={artists.slice(0, 6)}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.artistCard}>
                    <Image
                      source={{ uri: item.image }}
                      style={styles.artistImage}
                    />
                    <Text style={styles.artistName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.artistLabel}>{t('home.artist')}</Text>
                  </TouchableOpacity>
                )}
              />
            </>
          )}

          {/* Copyleft Banner */}
          <View style={styles.banner}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bannerGradient}
            >
              <View style={styles.bannerContent}>
                <Text style={styles.bannerSlogan}>{t('home.bannerSlogan')}</Text>
                <Text style={styles.bannerTitle}>{t('home.bannerTitle')}</Text>
                <Text style={styles.bannerSubtitle}>{t('home.bannerSubtitle')}</Text>
                <TouchableOpacity
                  style={styles.bannerButton}
                  onPress={() => router.push('/upload')}
                >
                  <Ionicons name="cloud-upload" size={18} color={Colors.primary} />
                  <Text style={styles.bannerButtonText}>{t('home.bannerButton')}</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>

          {/* Bottom padding for mini player */}
          <View style={{ height: Layout.miniPlayerHeight + 20 }} />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Layout.padding.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Layout.padding.md,
    paddingTop: Layout.padding.md,
    paddingBottom: Layout.padding.sm,
  },
  greeting: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginLeft: Layout.padding.md,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Layout.padding.md,
    paddingVertical: Layout.padding.sm,
    gap: Layout.padding.sm,
  },
  filterChip: {
    paddingHorizontal: Layout.padding.md,
    paddingVertical: Layout.padding.sm,
    borderRadius: Layout.borderRadius.round,
    backgroundColor: Colors.surfaceLight,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: Colors.background,
    fontWeight: '700',
  },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Layout.padding.sm,
    marginTop: Layout.padding.sm,
  },
  horizontalList: {
    paddingHorizontal: Layout.padding.md,
  },
  trackSection: {
    marginTop: Layout.padding.xs,
  },
  albumCard: {
    width: 150,
    marginRight: Layout.padding.sm,
  },
  albumArtwork: {
    width: 150,
    height: 150,
    borderRadius: Layout.borderRadius.md,
    backgroundColor: Colors.surfaceElevated,
  },
  albumTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: Layout.padding.sm,
  },
  albumArtist: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  artistCard: {
    width: 130,
    alignItems: 'center',
    marginRight: Layout.padding.sm,
  },
  artistImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surfaceElevated,
  },
  artistName: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: Layout.padding.sm,
    textAlign: 'center',
  },
  artistLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  banner: {
    marginHorizontal: Layout.padding.md,
    marginTop: Layout.padding.xl,
    borderRadius: Layout.borderRadius.lg,
    overflow: 'hidden',
  },
  bannerGradient: {
    padding: Layout.padding.lg,
  },
  bannerContent: {
    alignItems: 'center',
  },
  bannerSlogan: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  bannerTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
    opacity: 0.9,
  },
  bannerSubtitle: {
    color: Colors.textPrimary,
    fontSize: 12,
    opacity: 0.85,
    marginTop: Layout.padding.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
  bannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.textPrimary,
    borderRadius: Layout.borderRadius.round,
    paddingHorizontal: Layout.padding.lg,
    paddingVertical: Layout.padding.sm,
    marginTop: Layout.padding.md,
  },
  bannerButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: Layout.padding.xs,
  },
});
