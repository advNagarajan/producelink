"use client";

import { useState, useEffect } from "react";

interface WeatherData {
    current: {
        temp: number;
        feels_like: number;
        humidity: number;
        description: string;
        icon: string;
        wind_speed: number;
        city: string;
    };
    forecast: {
        dt: string;
        temp: number;
        description: string;
        icon: string;
    }[];
}

export default function WeatherWidget({ location }: { location: string }) {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!location) return;
        const fetchWeather = async () => {
            try {
                const res = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
                if (res.ok) {
                    setWeather(await res.json());
                } else {
                    setError(true);
                }
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        };
        fetchWeather();
    }, [location]);

    if (loading) {
        return (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-5 animate-pulse">
                <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-700 rounded mb-3" />
                <div className="h-8 w-16 bg-neutral-100 dark:bg-neutral-800 rounded mb-2" />
                <div className="h-3 w-32 bg-neutral-100 dark:bg-neutral-800 rounded" />
            </div>
        );
    }

    if (error || !weather) {
        return (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-5 text-center text-sm text-neutral-400">
                Weather data unavailable
            </div>
        );
    }

    const { current, forecast } = weather;

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-5">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <div className="text-xs text-neutral-400 font-medium">{current.city}</div>
                    <div className="text-3xl font-bold text-black dark:text-white">{Math.round(current.temp)}&deg;C</div>
                    <div className="text-sm text-neutral-500 capitalize">{current.description}</div>
                </div>
                <img
                    src={`https://openweathermap.org/img/wn/${current.icon}@2x.png`}
                    alt={current.description}
                    className="w-16 h-16"
                />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg py-2">
                    <div className="text-neutral-400">Feels like</div>
                    <div className="font-medium text-black dark:text-white">{Math.round(current.feels_like)}&deg;</div>
                </div>
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg py-2">
                    <div className="text-neutral-400">Humidity</div>
                    <div className="font-medium text-black dark:text-white">{current.humidity}%</div>
                </div>
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg py-2">
                    <div className="text-neutral-400">Wind</div>
                    <div className="font-medium text-black dark:text-white">{current.wind_speed} m/s</div>
                </div>
            </div>
            {forecast.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pt-3 border-t border-neutral-100 dark:border-neutral-800">
                    {forecast.slice(0, 5).map((f, i) => (
                        <div key={i} className="flex flex-col items-center text-xs min-w-[52px]">
                            <span className="text-neutral-400">{new Date(f.dt).getHours()}:00</span>
                            <img src={`https://openweathermap.org/img/wn/${f.icon}.png`} alt="" className="w-8 h-8" />
                            <span className="font-medium text-black dark:text-white">{Math.round(f.temp)}&deg;</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
