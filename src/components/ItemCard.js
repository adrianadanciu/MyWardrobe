import React, {useMemo} from 'react';
import {View, Text, Image, Pressable, StyleSheet} from 'react-native';
import {Trash2, TriangleAlert} from 'lucide-react-native';
import {WARMTH, CONDITION, conditionFromScore} from '../constants/Wardrobe';
import {FIT} from '../constants/BodyShapes';
import {OCCASION} from '../constants/Occasions';
import {ageLabel, lastWornLabel} from '../utils/Dates';
import {getFitFlags} from '../utils/ColorTheory';
import {useTheme} from '../theme/ThemeContext';
import {radius, spacing, fonts, getShadow} from '../theme/tokens';
import {haptics} from '../utils/Haptics';
//short versions of getFitFlags() messages
const FLAG_SHORT_LABEL = {color: 'Color mismatch', shape: 'Shape mismatch', measurements: 'Tight fit'};
export default function ItemCard({item, onDelete, onPress, season = null, bodyShape = null, bodyMeasurements = null}){
    const {colors, resolvedScheme} = useTheme();
    const styles = useMemo(() => getStyles(colors, resolvedScheme), [colors, resolvedScheme]);
    const conditionKey = conditionFromScore(item.conditionScore);
    const condition = conditionKey ? CONDITION[conditionKey] : null;
    const fitFlags = useMemo(
        () => getFitFlags(item, {season, bodyShape, bodyMeasurements}).filter((f) => f.type !== 'measurements' || !item.measurementsOverride),
        [item, season, bodyShape, bodyMeasurements]
    );
    const handleDelete = () => {
        haptics.tap();
        onDelete(item.id);
    };
    //the jsx code with the html elements
    return (
        <View style={styles.card}>
            <Pressable onPress={onPress} style={({pressed}) => pressed && styles.pressed}>
                {item.photoUri ? (
                    <Image source={{uri: item.photoUri}} style={styles.photo} />
                ) : (
                    <View style={[styles.photo, {backgroundColor: item.colorHex}]} />
                )}
                {condition && (
                    <View style={[styles.conditionBadge, {backgroundColor: condition.color}]}>
                        <Text style={styles.conditionBadgeText}>{condition.label}</Text>
                    </View>
                )}
                {/*if there are matching issues*/}
                {fitFlags.length > 0 && (
                    <View style={styles.mismatchBadge}>
                        <TriangleAlert size={12} color={colors.warnText} />
                    </View>
                )}

                <View style={styles.body}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.attrs}>{WARMTH[item.warmth]}{item.fit ? ` · ${FIT[item.fit]}` : ''}</Text>
                    <Text style={styles.sub}>owned for {ageLabel(item.dateAdded)}</Text>
                    {/*wearCount is either a number or 0, so it doesn't return undefined*/}
                    <Text style={styles.sub}>{lastWornLabel(item.lastWorn)} · x{item.wearCount || 0}</Text>
                    {/*the algorithm unites all of the occasions separated throughout a point, forcing them on one row*/}
                    {item.occasions?.length > 0 && (
                        <Text style={styles.occasions} numberOfLines={1}>{item.occasions.map((o) => OCCASION[o]?.label).join(' · ')}</Text>
                    )}
                    {fitFlags.length > 0 && (
                        <Text style={styles.mismatchText} numberOfLines={1}>
                            {fitFlags.map((f) => FLAG_SHORT_LABEL[f.type]).join(' · ')}
                        </Text>
                    )}
                </View>
            </Pressable>
            <View style={styles.footer}>
                <Pressable
                    style={({pressed}) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
                    onPress={handleDelete}
                    hitSlop={6}
                >
                    <Trash2 size={13} color={colors.accent} />
                </Pressable>
            </View>
        </View>
    );
}
const getStyles = (colors, scheme) => StyleSheet.create({
    card: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, overflow: 'hidden', flexBasis: '48%', ...getShadow(scheme).card},
    pressed: {opacity: 0.85},
    photo: {height: 100, width: '100%'},
    conditionBadge: {position: 'absolute', top: spacing.xs + 2, right: spacing.xs + 2, paddingHorizontal: spacing.xs + 3, paddingVertical: 3, borderRadius: radius.pill},
    conditionBadgeText: {color: '#fff', fontFamily: fonts.textSemibold, fontSize: 9, textTransform: 'uppercase'},
    mismatchBadge: {position: 'absolute', top: spacing.xs + 2, left: spacing.xs + 2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.warnBg, borderWidth: 1, borderColor: colors.warnBorder, alignItems: 'center', justifyContent: 'center'},
    body: {padding: spacing.sm, paddingBottom: spacing.xs, gap: 2},
    name: {fontFamily: fonts.textSemibold, fontSize: 13, color: colors.ink},
    attrs: {fontSize: 10, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.3},
    sub: {fontSize: 11, color: colors.inkSoft},
    occasions: {fontSize: 10, color: colors.warnSub, marginTop: 1},
    mismatchText: {fontFamily: fonts.textSemibold, fontSize: 10, color: colors.warnText, marginTop: 2},
    footer: {flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, paddingTop: 2},
    deleteBtn: {width: 26, height: 26, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center'},
    deleteBtnPressed: {opacity: 0.6},
});
