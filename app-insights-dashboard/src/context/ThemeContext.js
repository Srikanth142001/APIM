import { createContext, useContext, useState, useEffect } from "react";

export const THEMES = {
  dark: {
    bg:            "#0b0d14",
    surface:       "#111217",
    panel:         "#181b24",
    border:        "#22263a",
    border2:       "#2d3148",
    text:          "#d4d8e8",
    textSub:       "#8b92a5",
    muted:         "#6b7280",
    dim:           "#4b5563",
    gridLine:      "#22263a",
    chartBg:       "#111217",
    sidebarBg:     "#12141c",
    sidebarBorder: "#1e2130",
    red:           "#f2495c",
    orange:        "#f5a623",
    green:         "#73bf69",
    blue:          "#5794f2",
    cyan:          "#22d3ee",
    inputBg:       "#0b0d14",
  },
  light: {
    bg:            "#e8eaf2",
    surface:       "#f0f2fa",
    panel:         "#e4e6f0",
    border:        "#c8cce0",
    border2:       "#b0b4cc",
    text:          "#1e2140",
    textSub:       "#4a5080",
    muted:         "#6070a0",
    dim:           "#7880a0",
    gridLine:      "#c8cce0",
    chartBg:       "#f0f2fa",
    sidebarBg:     "#d8daea",
    sidebarBorder: "#c0c4d8",
    red:           "#e0253a",
    orange:        "#c47a00",
    green:         "#2d8a28",
    blue:          "#1a4faa",
    cyan:          "#0891b2",
    inputBg:       "#e4e6f0",
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(() => {
    try { return localStorage.getItem("app-theme") || "dark"; } catch { return "dark"; }
  });

  const T = THEMES[themeKey] || THEMES.dark;

  // Apply data-theme to <html> so CSS attribute selectors work globally
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeKey);
    try { localStorage.setItem("app-theme", themeKey); } catch {}
  }, [themeKey]);

  const toggleTheme = () =>
    setThemeKey(prev => (prev === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ themeKey, T, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
