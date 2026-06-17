"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

type ThemePref = "light" | "dark" | "system";

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>("system");
  const [mounted, setMounted] = useState(false);

  // On mount, read stored preference and ensure the <html> class is correct
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);

    try {
      const stored = (localStorage.getItem("msgnexus-theme") as ThemePref | null) || "system";
      setPref(stored);
      applyTheme(stored);
    } catch {
      setPref("system");
      applyTheme("system");
    }
  }, []);

  function applyTheme(newPref: ThemePref) {
    const root = document.documentElement;

    if (newPref === "dark") {
      root.classList.add("dark");
      localStorage.setItem("msgnexus-theme", "dark");
    } else if (newPref === "light") {
      root.classList.remove("dark");
      localStorage.setItem("msgnexus-theme", "light");
    } else {
      // system - clear stored preference and follow OS
      localStorage.removeItem("msgnexus-theme");
      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }

  function cycleTheme() {
    let next: ThemePref;
    if (pref === "light") next = "dark";
    else if (pref === "dark") next = "system";
    else next = "light";

    setPref(next);
    applyTheme(next);
  }

  if (!mounted) {
    // Render the same as server to prevent hydration mismatch
    return (
      <button className="btn btn-ghost p-2" aria-label="Toggle theme">
        <Monitor size={16} />
      </button>
    );
  }

  const icon = pref === "dark" ? (
    <Moon size={16} />
  ) : pref === "light" ? (
    <Sun size={16} />
  ) : (
    <Monitor size={16} />
  );

  const label = `Theme: ${pref}`;

  return (
    <button
      onClick={cycleTheme}
      className="btn btn-ghost p-2"
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
