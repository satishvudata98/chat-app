import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppThemeName } from '../../constants/theme';
import { useAppTheme } from '../../store/ThemeContext';

export default function SettingsScreen() {
  const { colors, themeName, setThemeName } = useAppTheme();
  const options: { name: AppThemeName; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { name: 'light', label: 'Light', icon: 'sunny-outline' },
    { name: 'dark', label: 'Dark', icon: 'moon-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.row, { backgroundColor: colors.panel, borderColor: colors.border }]}>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>Theme</Text>
          <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>Stored on this device</Text>
        </View>

        <View style={styles.themeOptions}>
          {options.map((option) => {
            const selected = themeName === option.name;

            return (
              <TouchableOpacity
                key={option.name}
                style={[
                  styles.themeButton,
                  {
                    backgroundColor: selected ? colors.primary : colors.panelSoft,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setThemeName(option.name)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Use ${option.label} theme`}
              >
                <Ionicons
                  name={option.icon}
                  size={20}
                  color={selected ? '#fff' : colors.text}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  row: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  rowSubtitle: {
    fontSize: 13,
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  themeButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
