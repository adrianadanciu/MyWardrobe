//pulsing placeholder block shown while data is loading instead of a spinner, feels like "this is about to load" instead of "it's stuck"
import React, {useEffect, useRef} from 'react';
import {Animated} from 'react-native';
import {useTheme} from '../theme/ThemeContext';
import {radius} from './../theme/tokens';
export default function SkeletonBlock({width = '100%', height = 16, radius: cornerRadius = radius.sm, style}) {
    const {colors} = useTheme();
    const opacity = useRef(new Animated.Value(0.45)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {toValue: 1, duration: 750, useNativeDriver: true}),
                Animated.timing(opacity, {toValue: 0.45, duration: 750, useNativeDriver: true}),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [opacity]);
    return (
        <Animated.View
            style={[{width, height, borderRadius: cornerRadius, backgroundColor: colors.surfaceAlt, opacity}, style]}
        />
    );
}
