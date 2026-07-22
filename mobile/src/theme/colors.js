export const Colors = {
  primary: '#0f172a',
  secondary: '#1e293b',
  accent: '#10b981',
  accentHover: '#059669',
  bgDark: '#0b1120',
  bgCardDark: '#1e293b',
  borderDark: '#334155',
  textLight: '#f8fafc',
  textMutedLight: '#94a3b8',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

export const getThemeColors = (isDarkMode = true) => {
  if (isDarkMode) {
    return {
      bg: '#0b1120',
      card: '#1e293b',
      cardSub: '#0f172a',
      border: '#334155',
      text: '#ffffff',
      textMuted: '#94a3b8',
      accent: '#10b981',
      primary: '#0f172a',
      inputBg: '#0f172a',
    };
  }
  return {
    bg: '#f8fafc',
    card: '#ffffff',
    cardSub: '#f1f5f9',
    border: '#e2e8f0',
    text: '#0f172a',
    textMuted: '#64748b',
    accent: '#059669',
    primary: '#059669',
    inputBg: '#f1f5f9',
  };
};

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
};
