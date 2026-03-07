"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface ThemeContextType {
    dark: boolean;
    toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ dark: false, toggle: () => {} });

export function useTheme() {
    return useContext(ThemeContext);
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
    const [dark, setDark] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem("producelink-theme");
        if (saved === "dark") {
            setDark(true);
            document.documentElement.classList.add("dark");
        }
    }, []);

    const toggle = useCallback(() => {
        setDark((prev) => {
            const next = !prev;
            if (next) {
                document.documentElement.classList.add("dark");
                localStorage.setItem("producelink-theme", "dark");
            } else {
                document.documentElement.classList.remove("dark");
                localStorage.setItem("producelink-theme", "light");
            }
            return next;
        });
    }, []);

    return (
        <ThemeContext.Provider value={{ dark, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
}
