//useState holds an object that can change and re-renders with each change
//useEffect renders secondary code after the object is updated
import React, {useMemo, useState, useEffect} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {Check, ShoppingBag} from 'lucide-react-native';
import {useTheme} from '../theme/ThemeContext';
import {radius, spacing, fonts, getShadow} from '../theme/tokens';
import {haptics} from '../utils/Haptics';
export default function OutfitResult({outfit, onMarkWorn, onShopForLayer}) {
    const {colors, resolvedScheme} = useTheme();
    const styles = useMemo(() => getStyles(colors, resolvedScheme), [colors, resolvedScheme]);
    //here is created a state loop, which keep tracks of whether a piece of clothing has been already logged
    const [logged, setLogged] = useState(false);
    const pieces = [outfit.top, outfit.dress, outfit.bottom, outfit.outer, outfit.shoe, outfit.accessory, outfit.jewelry, outfit.bag].filter(Boolean);
    const tiredPiece = pieces.find((p) => p.conditionScore != null && p.conditionScore >= 70);
    //a newly generated outfit is a fresh object each time, so the confirmation is reseted
    useEffect(() => {setLogged(false);}, [outfit]);
    //this is a handler, a function which is triggered by the user
    //logs that a piece of clothing has been worn
    const handlePress = () => {
        haptics.success();
        onMarkWorn();
        setLogged(true);
    };
    return (
        <View style={styles.card}>
            {outfit.layeringAdvised && outfit.tempRange && outfit.outer && (
                <Text style={styles.layeringNote}>
                    Weather may swing {outfit.tempRange.min}°–{outfit.tempRange.max}°C while you're out, so the {outfit.outer.name} gives you a layer to put on or take off as needed.
                </Text>
            )}
            {/*if layeringGap is true, then a piece of layering clothing is missing*/}
            {outfit.layeringGap && outfit.tempRange && (
                <View style={styles.layeringGapBox}>
                    <Text style={styles.layeringGapText}>
                        Weather may swing {outfit.tempRange.min}°–{outfit.tempRange.max}°C while you're out and you don't have a light layer in your wardrobe to bring for that.
                    </Text>
                    {onShopForLayer && (
                        <Pressable style={({pressed}) => [styles.layeringGapBtn, pressed && styles.pressed]} onPress={onShopForLayer}>
                            <ShoppingBag size={13} color={colors.ink} />
                            <Text style={styles.layeringGapBtnText}>Get layer suggestions</Text>
                        </Pressable>
                    )}
                </View>
            )}
            {/*prints the clothes with a small bubble for color and their name*/}
            <View style={styles.chipRow}>
                {pieces.map((p) => (
                    <View style={styles.chip} key={p.id}>
                        <View style={[styles.swatch, {backgroundColor: p.colorHex}]} />
                        <Text style={styles.chipText}>{p.name}</Text>
                    </View>
                ))}
            </View>
            {tiredPiece && (
                <Text style={styles.warning}>Heads up: {tiredPiece.name} looks pretty worn, so it might be time for a replacement.</Text>
            )}
            <Pressable
                style={({pressed}) => [styles.mark, logged && styles.markLogged, pressed && !logged && styles.pressed]}
                onPress={handlePress}
                disabled={logged}
            >
                <Check size={15} color={colors.onSuccess} />
                <Text style={styles.markText}>{logged ? 'Logged, saved to your Journal' : 'Wore this today'}</Text>
            </Pressable>
        </View>
    );
}
const getStyles = (colors, scheme) => StyleSheet.create({
    card: {width: '100%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg, ...getShadow(scheme).card},
    pressed: {opacity: 0.85},
    layeringNote: {fontSize: 11.5, color: colors.success, fontStyle: 'italic', marginBottom: spacing.md - 2},
    layeringGapBox: {backgroundColor: colors.warnBg, borderWidth: 1, borderColor: colors.warnBorder, borderRadius: radius.md, padding: spacing.sm + 2, marginBottom: spacing.md},
    layeringGapText: {fontSize: 11.5, color: colors.warnText, lineHeight: 16},
    layeringGapBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 7, marginTop: spacing.sm},
    layeringGapBtnText: {fontFamily: fonts.textSemibold, fontSize: 12, color: colors.ink},
    chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md},
    chip: {flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: spacing.sm + 2},
    swatch: {width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)'},
    chipText: {fontFamily: fonts.textSemibold, fontSize: 12.5, color: colors.ink},
    warning: {fontSize: 12, color: colors.accent, marginBottom: spacing.md},
    mark: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: spacing.sm + 2, ...getShadow(scheme).button},
    markLogged: {opacity: 0.65, shadowOpacity: 0, elevation: 0},
    markText: {fontFamily: fonts.textSemibold, color: colors.onSuccess, fontSize: 13},
});
