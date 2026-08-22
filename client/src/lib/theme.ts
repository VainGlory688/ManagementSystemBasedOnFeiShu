export type ThemePreference = 'light' | 'dark' | 'system' | 'custom';

export interface CustomThemeColors {
  background: string;
  card: string;
  foreground: string;
  primary: string;
  border: string;
}

export const THEME_STORAGE_KEY = 'management-system-theme';
export const CUSTOM_THEME_STORAGE_KEY = 'management-system-custom-theme';

export const DEFAULT_CUSTOM_THEME: CustomThemeColors = {
  background: '#000000',
  card: '#0b0d10',
  foreground: '#e8edf4',
  primary: '#2d79bf',
  border: '#26313b',
};

const CUSTOM_VARIABLES: Record<keyof CustomThemeColors, string> = {
  background: '--background',
  card: '--card',
  foreground: '--foreground',
  primary: '--primary',
  border: '--border',
};

const CUSTOM_RELATED_VARIABLES = [
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--input',
  '--ring',
  '--scrollbar-track',
  '--scrollbar-thumb',
  '--scrollbar-thumb-hover',
];

export function getStoredTheme(): ThemePreference {
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === 'light' || value === 'dark' || value === 'system' || value === 'custom'
    ? value
    : 'system';
}

export function getStoredCustomTheme(): CustomThemeColors {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY) || '{}',
    ) as Partial<CustomThemeColors>;
    return { ...DEFAULT_CUSTOM_THEME, ...value };
  } catch {
    return DEFAULT_CUSTOM_THEME;
  }
}

export function applyTheme(
  preference: ThemePreference,
  customTheme = getStoredCustomTheme(),
): void {
  const root = document.documentElement;
  const useDarkTheme = preference === 'dark'
    || preference === 'custom'
    || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  root.classList.toggle('dark', useDarkTheme);
  root.dataset.theme = preference;

  [...Object.values(CUSTOM_VARIABLES), ...CUSTOM_RELATED_VARIABLES]
    .forEach((variable) => root.style.removeProperty(variable));
  if (preference === 'custom') {
    (Object.keys(CUSTOM_VARIABLES) as Array<keyof CustomThemeColors>).forEach((key) => {
      root.style.setProperty(CUSTOM_VARIABLES[key], customTheme[key]);
    });
    root.style.setProperty('--card-foreground', customTheme.foreground);
    root.style.setProperty('--popover', customTheme.card);
    root.style.setProperty('--popover-foreground', customTheme.foreground);
    root.style.setProperty('--input', customTheme.border);
    root.style.setProperty('--ring', customTheme.primary);
    root.style.setProperty('--scrollbar-track', customTheme.background);
    root.style.setProperty('--scrollbar-thumb', customTheme.border);
    root.style.setProperty('--scrollbar-thumb-hover', customTheme.primary);
  }
}
