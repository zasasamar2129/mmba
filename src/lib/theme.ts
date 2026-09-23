export type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'mmba_theme';

export function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch (e) {
    // ignore
  }
  return 'dark'; // Cyber Security Obsidian Dark is default
}

export function updateThemeColorMeta(color: string): void {
  if (typeof document === 'undefined') return;
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;

  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
    body.classList.add('dark');
    body.classList.remove('light');
    root.style.colorScheme = 'dark';
    updateThemeColorMeta('#090d16');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    body.classList.remove('dark');
    body.classList.add('light');
    root.style.colorScheme = 'light';
    updateThemeColorMeta('#f8fafc');
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (e) {
    // ignore
  }

  window.dispatchEvent(new CustomEvent('mmba-theme-change', { detail: { theme } }));
}

export function toggleTheme(): ThemeMode {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const nextTheme: ThemeMode = isDark ? 'light' : 'dark';
  applyTheme(nextTheme);
  return nextTheme;
}
