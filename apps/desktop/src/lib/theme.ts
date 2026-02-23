export type ThemeMode = 'paper' | 'forest' | 'ios' | 'dark' | 'cyberpunk';

export type Colors = {
  background: string;
  surface: string;
  text: string;
  accent: string;
  placeholder: string;
};

export const palettes: Record<ThemeMode, Colors> = {
  paper: {
    background: '#f5f0e8',
    surface: '#ebe4d6',
    text: '#3b3228',
    accent: '#a0522d',
    placeholder: '#9e9585',
  },
  forest: {
    background: '#1a2e1a',
    surface: '#2d4a2d',
    text: '#d4e6d4',
    accent: '#5cb85c',
    placeholder: '#6b8f6b',
  },
  ios: {
    background: '#f2f2f7',
    surface: '#ffffff',
    text: '#1c1c1e',
    accent: '#007aff',
    placeholder: '#8e8e93',
  },
  dark: {
    background: '#25292e',
    surface: '#3a3f47',
    text: '#ffffff',
    accent: '#0a84ff',
    placeholder: '#888888',
  },
  cyberpunk: {
    background: '#0d0221',
    surface: '#1a0a2e',
    text: '#e0f7fa',
    accent: '#ff2d95',
    placeholder: '#6b4c8a',
  },
};

export const themeOrder: ThemeMode[] = ['paper', 'forest', 'ios', 'dark', 'cyberpunk'];

/** Convert '#rrggbb' to 'rgba(r, g, b, alpha)'. */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
