/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export type AppThemeName = 'light' | 'dark';

export const AppTheme = {
  light: {
    background: '#FFFFFF',
    chatBackground: '#EFEAE2',
    panel: '#FFFFFF',
    panelSoft: '#F0F2F5',
    text: '#111B21',
    textSecondary: '#667781',
    border: '#E9EDEF',
    primary: '#00A884',
    primaryDark: '#008069',
    secondary: '#25D366',
    accent: '#53BDEB',
    incomingBubble: '#FFFFFF',
    outgoingBubble: '#D9FDD3',
    outgoingText: '#111B21',
    disabled: '#E9EDEF',
  },
  dark: {
    background: '#0B141A',
    chatBackground: '#0B141A',
    panel: '#111B21',
    panelSoft: '#1F2C34',
    text: '#E9EDEF',
    textSecondary: '#8696A0',
    border: '#222E35',
    primary: '#00A884',
    primaryDark: '#005C4B',
    secondary: '#25D366',
    accent: '#53BDEB',
    incomingBubble: '#1F2C34',
    outgoingBubble: '#005C4B',
    outgoingText: '#E9EDEF',
    disabled: '#2A3942',
  },
};

const tintColorLight = AppTheme.light.primary;
const tintColorDark = AppTheme.dark.primary;

export const Colors = {
  light: {
    text: AppTheme.light.text,
    background: AppTheme.light.background,
    tint: tintColorLight,
    icon: AppTheme.light.textSecondary,
    tabIconDefault: AppTheme.light.textSecondary,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: AppTheme.dark.text,
    background: AppTheme.dark.background,
    tint: tintColorDark,
    icon: AppTheme.dark.textSecondary,
    tabIconDefault: AppTheme.dark.textSecondary,
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
