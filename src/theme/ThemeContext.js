import React, {createContext, useContext, useEffect, useState, useMemo} from 'react';
import {Appearance} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
const THEME_KEY = 'mywardrobe:theme'; 
const lightColors = {
    scheme: 'light',
    bg: '#F1F2ED',
    surface: '#FFFFFF',
    surfaceAlt: '#E9E7DE',
    ink: '#20242B',
    inkSoft: '#63697A',
    inkMuted: '#9A9488',
    line: '#DAD7CC',
    accent: '#2F6F77',
    onAccent: '#FFFFFF',
    success: '#6E8763',
    onSuccess: '#FFFFFF',
    danger: '#8C3B3B',
    dangerBg: '#F7E9E4',
    warnBg: '#FBEEF0',
    warnBorder: '#E6BFC9',
    warnText: '#7A3B49',
    warnSub: '#96606D',
    overlay: 'rgba(0,0,0,0.45)',
    statusBar: 'dark',
};
const darkColors = {
    scheme: 'dark',
    bg: '#16171A',
    surface: '#212327',
    surfaceAlt: '#2B2D32',
    ink: '#EDEDEC',
    inkSoft: '#A7ACB6',
    inkMuted: '#83878F',
    line: '#3A3C42',
    accent: '#5FB0B8',
    onAccent: '#16171A',
    success: '#8AB07F',
    onSuccess: '#16171A',
    danger: '#E08A82',
    dangerBg: '#3A2320',
    warnBg: '#332226',
    warnBorder: '#5C3A42',
    warnText: '#EFC9D1',
    warnSub: '#C99AA5',
    overlay: 'rgba(0,0,0,0.6)',
    statusBar: 'light',
};
const ThemeContext = createContext({colors: lightColors, mode: 'system', setMode: () => {}});
export function ThemeProvider({children}){
    const [mode, setModeState] = useState('system'); 
    const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme() || 'light');
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        AsyncStorage.getItem(THEME_KEY)
            .then((v) => {if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);})
            .catch(() => {})
            .finally(() => setLoaded(true));
    }, []);
    useEffect(() => {
        const sub = Appearance.addChangeListener(({colorScheme}) => setSystemScheme(colorScheme || 'light'));
        return () => sub.remove();
    }, []);
    const setMode = (next) => {
        setModeState(next);
        AsyncStorage.setItem(THEME_KEY, next).catch((e) => console.warn('Could not save theme preference', e));
    };
    const resolvedScheme = mode === 'system' ? systemScheme : mode;
    const colors = resolvedScheme === 'dark' ? darkColors : lightColors;
    const value = useMemo(() => ({colors, mode, setMode, resolvedScheme, loaded}), [colors, mode, resolvedScheme, loaded]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme(){
    return useContext(ThemeContext);
}
