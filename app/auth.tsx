import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../src/services/firebase';
import { useAuth } from '../src/contexts/AuthContext';
import { Colors } from '../src/constants/Colors';

/**
 * Handles the OAuth deep link callback: spotfly://auth?id_token=...
 * Extracts the id_token, signs into Firebase, then redirects to home.
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ id_token?: string }>();
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function handleToken() {
      const idToken = params.id_token;

      if (idToken) {
        try {
          const credential = GoogleAuthProvider.credential(idToken);
          await signInWithCredential(auth, credential);
          // onAuthStateChanged in AuthContext will pick up the user
        } catch (e) {
          console.error('Auth callback error:', e);
        }
      }

      // Wait a bit for auth state to settle, then redirect
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 500);
    }

    handleToken();
  }, []);

  // If auth state updates before redirect, navigate immediately
  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/(tabs)');
    }
  }, [user, isLoading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
