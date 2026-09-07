//shown right after the native splash hands off to js, not theme-aware on purpose so it looks the same in light or dark mode
import React, {useEffect, useRef} from 'react';
import {View, Text, Animated, StyleSheet} from 'react-native';
import {Shirt} from 'lucide-react-native';
import {fonts, spacing} from '../theme/tokens';
const BG = '#14161A';
const FG = '#F4F3EE';
const ACCENT = '#5FB0B8';
export default function LaunchScreen() {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(16)).current;
    const iconScale = useRef(new Animated.Value(0.7)).current;
    useEffect(() => {
        Animated.sequence([
            Animated.spring(iconScale, {toValue: 1, friction: 5, tension: 60, useNativeDriver: true}),
            Animated.parallel([
                Animated.timing(opacity, {toValue: 1, duration: 420, useNativeDriver: true}),
                Animated.timing(translateY, {toValue: 0, duration: 420, useNativeDriver: true}),
            ]),
        ]).start();
    }, [opacity, translateY, iconScale]);
    return (
        <View style={styles.screen}>
            <Animated.View style={{transform: [{scale: iconScale}]}}>
                <View style={styles.iconWrap}>
                    <Shirt size={28} color={BG} strokeWidth={2.4} />
                </View>
            </Animated.View>
            <Animated.View style={{opacity, transform: [{translateY}], alignItems: 'center'}}>
                <Text style={styles.wordmark}>MYWARDROBE</Text>
                <Text style={styles.tagline}>your closet, curated</Text>
            </Animated.View>
        </View>
    );
}
const styles = StyleSheet.create({
    screen: {flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center'},
    iconWrap: {
        width: 64, height: 64, borderRadius: 32, backgroundColor: ACCENT,
        alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
    },
    wordmark: {fontFamily: fonts.brandBlack, fontSize: 32, color: FG, letterSpacing: 2},
    tagline: {fontFamily: fonts.textRegular, fontSize: 11.5, color: 'rgba(244,243,238,0.55)', marginTop: 8, letterSpacing: 2, textTransform: 'uppercase'},
});
