import { useState, useEffect } from 'react';

export interface WeatherData {
  temperature: number;
  humidity: number;
  apparentTemp: number;
  weatherCode: number;
  windSpeed: number;
}

let cachedWeather: WeatherData | null = null;
let cachedAqi: number | null = null;
let lastWeatherFetch = 0;
let lastAqiFetch = 0;

const WEATHER_CACHE_MS = 5 * 60 * 1000; // 5 min
const AQI_CACHE_MS = 10 * 60 * 1000; // 10 min

const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach(l => l());
};

export const fetchWeatherAndAqi = async () => {
  const now = Date.now();
  let updated = false;

  if (!cachedWeather || now - lastWeatherFetch > WEATHER_CACHE_MS) {
    try {
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=39.67&longitude=-8.14' +
        '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m'
      );
      const d = await res.json();
      const c = d.current;
      cachedWeather = {
        temperature: Math.round(c.temperature_2m),
        humidity: c.relative_humidity_2m,
        apparentTemp: Math.round(c.apparent_temperature),
        weatherCode: c.weather_code,
        windSpeed: Math.round(c.wind_speed_10m),
      };
      lastWeatherFetch = now;
      updated = true;
    } catch (e) {
      console.warn('Weather fetch failed, using cache:', e);
    }
  }

  if (cachedAqi === null || now - lastAqiFetch > AQI_CACHE_MS) {
    try {
      const res = await fetch(
        'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=39.67&longitude=-8.14&current=european_aqi'
      );
      const d = await res.json();
      cachedAqi = Math.round(d.current?.european_aqi ?? 0);
      lastAqiFetch = now;
      updated = true;
    } catch (e) {
      console.warn('AQI fetch failed, using cache:', e);
    }
  }

  if (updated) {
    notify();
  }
};

let intervalId: any = null;
const startPolling = () => {
  if (!intervalId) {
    fetchWeatherAndAqi();
    intervalId = setInterval(fetchWeatherAndAqi, 30 * 1000); // Check cache every 30s
  }
};

const stopPolling = () => {
  if (intervalId && listeners.size === 0) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

export const useWeather = () => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    listeners.add(listener);
    startPolling();

    return () => {
      listeners.delete(listener);
      stopPolling();
    };
  }, []);

  return {
    weather: cachedWeather,
    aqi: cachedAqi,
    refetch: fetchWeatherAndAqi,
  };
};
