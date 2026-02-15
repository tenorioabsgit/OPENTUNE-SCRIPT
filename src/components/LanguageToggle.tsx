import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { Colors } from '../constants/Colors';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.option, language === 'pt' && styles.optionActive]}
        onPress={() => setLanguage('pt')}
      >
        <Text style={[styles.text, language === 'pt' && styles.textActive]}>PT</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.option, language === 'en' && styles.optionActive]}
        onPress={() => setLanguage('en')}
      >
        <Text style={[styles.text, language === 'en' && styles.textActive]}>EN</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    padding: 2,
  },
  option: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  optionActive: {
    backgroundColor: Colors.primary,
  },
  text: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  textActive: {
    color: Colors.background,
  },
});
