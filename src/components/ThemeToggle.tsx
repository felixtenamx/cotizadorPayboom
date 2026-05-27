"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "system";

const KEY = "payboom-theme";

function apply(theme: Theme) {
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export default function ThemeToggle({ compact }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Theme) || "system";
    setTheme(saved);
    apply(saved);
    setMounted(true);

    // Reaccionar a cambios del OS cuando el usuario está en "system"
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if ((localStorage.getItem(KEY) || "system") === "system") apply("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function set(t: Theme) {
    setTheme(t);
    localStorage.setItem(KEY, t);
    apply(t);
  }

  if (!mounted) return <div className={compact ? "w-9 h-9" : "h-10"} />;

  if (compact) {
    // Botón único cíclico para topbar móvil
    const cycle = () => set(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
    return (
      <button
        type="button"
        onClick={cycle}
        className="p-2 rounded-lg text-teal-100 hover:bg-teal-900"
        title={`Tema: ${theme}`}
      >
        {theme === "light" ? <Sun size={16} /> : theme === "dark" ? <Moon size={16} /> : <Monitor size={16} />}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-teal-900/40 border border-teal-800/50">
      <ThemeBtn current={theme} value="light" set={set} icon={<Sun size={14} />} label="Claro" />
      <ThemeBtn current={theme} value="dark" set={set} icon={<Moon size={14} />} label="Oscuro" />
      <ThemeBtn current={theme} value="system" set={set} icon={<Monitor size={14} />} label="Auto" />
    </div>
  );
}

function ThemeBtn({ current, value, set, icon, label }: {
  current: Theme; value: Theme; set: (t: Theme) => void; icon: React.ReactNode; label: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => set(value)}
      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition ${
        active ? "bg-white dark:bg-ink-900 text-teal-950 shadow-sm" : "text-teal-100 hover:bg-teal-800/40"
      }`}
      title={label}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
