import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Share,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../src/constants/Colors';
import { Layout } from '../../src/constants/Layout';
import { usePlayer } from '../../src/contexts/PlayerContext';
import { Track } from '../../src/types';
import TrackRow from '../../src/components/TrackRow';
import { getTracksByAlbum } from '../../src/services/firestore';

export default function AlbumScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const { playQueue } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlbum();
  }, [name]);

  async function loadAlbum() {
    if (!name) return;
    try {
      const result = await getTracksByAlbum(name);
      setTracks(result);
    } catch (e) {
      console.error('Error loading album:', e);
    } finally {
      setLoading(false);
    }
  }

  const artist = tracks.length > 0 ? tracks[0].artist : '';
  const artwork = tracks.length > 0 ? tracks[0].artwork : '';
  const genre = tracks.length > 0 ? tracks[0].genre : '';

  const totalDuration = useMemo(() => {
    const total = tracks.reduce((sum, t) => sum + t.duration, 0);
    const hours = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours} h ${mins} min`;
    return `${mins} min`;
  }, [tracks]);

  async function handleShare() {
    try {
      await Share.share({
        message: `Ouça "${name}" de ${artist} no Spotfly! 🎵\nShare, Build, Share!`,
      });
    } catch (e) {
      console.error('Error sharing:', e);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <LinearGradient
              colors={['#2a4a3a', Colors.background]}
              style={styles.headerGradient}
            >
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Ionicons name="chevron-back" size={28} color={Colors.textPrimary} />
              </TouchableOpacity>

              <View style={styles.artworkContainer}>
                <Image
                  source={{ uri: artwork }}
                  style={styles.artwork}
                />
              </View>

              <Text style={styles.albumTitle}>{name}</Text>
              <Text style={styles.albumArtist}>{artist}</Text>
              <Text style={styles.albumMeta}>
                {genre ? `${genre} · ` : ''}{tracks.length} músicas{totalDuration !== '0 min' ? `, ${totalDuration}` : ''}
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity onPress={handleShare}>
                  <Ionicons name="share-outline" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                  style={styles.shuffleButton}
                  onPress={() => {
                    if (tracks.length > 0) {
                      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
                      playQueue(shuffled);
                    }
                  }}
                >
                  <Ionicons name="shuffle" size={18} color={Colors.background} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.playButton}
                  onPress={() => {
                    if (tracks.length > 0) {
                      playQueue(tracks);
                    }
                  }}
                >
                  <Ionicons name="play" size={26} color={Colors.background} />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </>
        }
        renderItem={({ item, index }) => (
          <TrackRow
            track={item}
            trackList={tracks}
            index={index}
            showIndex
          />
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <View style={styles.licenseBanner}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
              <Text style={styles.licenseText}>
                Todas as músicas deste álbum são livres de royalties
              </Text>
            </View>
            <View style={{ height: Layout.miniPlayerHeight + Layout.tabBarHeight + 20 }} />
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  headerGradient: {
    paddingBottom: Layout.padding.md,
  },
  backButton: {
    paddingHorizontal: Layout.padding.md,
    paddingTop: Layout.padding.md,
    paddingBottom: Layout.padding.sm,
  },
  artworkContainer: {
    alignItems: 'center',
    paddingVertical: Layout.padding.md,
  },
  artwork: {
    width: 200,
    height: 200,
    borderRadius: Layout.borderRadius.md,
    backgroundColor: Colors.surfaceElevated,
  },
  albumTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: Layout.padding.md,
    marginTop: Layout.padding.sm,
  },
  albumArtist: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    paddingHorizontal: Layout.padding.md,
    marginTop: 4,
  },
  albumMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
    paddingHorizontal: Layout.padding.md,
    marginTop: Layout.padding.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.padding.md,
    paddingTop: Layout.padding.md,
    gap: Layout.padding.lg,
  },
  shuffleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 2,
  },
  footer: {
    paddingHorizontal: Layout.padding.md,
    paddingTop: Layout.padding.xl,
  },
  licenseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    padding: Layout.padding.md,
    borderRadius: Layout.borderRadius.md,
  },
  licenseText: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginLeft: Layout.padding.sm,
    flex: 1,
  },
});
