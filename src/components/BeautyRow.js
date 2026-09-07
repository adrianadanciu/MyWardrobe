import React, {useState, useMemo} from 'react';
import {View, Text, Pressable, Image, StyleSheet} from 'react-native';
import {Check, Trash2, RotateCcw, Star, Lightbulb} from 'lucide-react-native';
import {expiryLabel, LEVEL, openedLabel, usedLabel, isNeglectedProduct, NEGLECT_REASONS, neglectReasonAdvice} from '../constants/Beauty';
import {useTheme} from '../theme/ThemeContext';
import {radius} from '../theme/tokens';
export default function BeautyRow({item, onPress, onMarkUsed, onRetire, onDelete, retiredView}) {
    const {colors} = useTheme();
    const styles = useMemo(() => getStyles(colors), [colors]);
    const expiry = expiryLabel(item);
    const levelInfo = LEVEL[item.level];
    const neglected = !retiredView && isNeglectedProduct(item);
    const [justUsed, setJustUsed] = useState(false);
    const [justToggled, setJustToggled] = useState(false);
    const [reason, setReason] = useState(null);
    const handleMarkUsed = () => {
        onMarkUsed(item.id);
        setJustUsed(true);
        setTimeout(() => setJustUsed(false), 1100);
    };
    const handleRetire = () => {
        onRetire(item.id);
        setJustToggled(true);
        setTimeout(() => setJustToggled(false), 1100);
    };
    return (
        <View style={[styles.rowCard, retiredView && styles.rowRetired]}>
            <View style={styles.row}>
                <Pressable style={styles.rowMain} onPress={onPress}>
                    {item.photoUri ? (
                        <Image source={{uri: item.photoUri}} style={styles.rowPhoto} />
                    ) : (
                        <View style={[styles.rowPhoto, styles.rowPhotoPlaceholder]} />
                    )}
                    <View style={{flex: 1}}>
                        <View style={styles.rowNameRow}>
                            {item.routines?.length > 0 && <Star size={11} color={colors.accent} fill={colors.accent} />}
                            <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                        </View>
                        <Text style={styles.rowType}>{item.type}</Text>
                        <View style={styles.badgeRow}>
                            {item.isTool ? (
                                <View style={[styles.badge, {backgroundColor: '#5C6470'}]}>
                                    <Text style={styles.badgeText}>Tool</Text>
                                </View>
                            ) : (
                                <>
                                    {levelInfo && (
                                        <View style={[styles.badge, {backgroundColor: levelInfo.color}]}>
                                            <Text style={styles.badgeText}>{levelInfo.label}</Text>
                                        </View>
                                    )}
                                    {expiry && (
                                        <View style={[styles.badge, {backgroundColor: '#8C3B3B'}]}>
                                            <Text style={styles.badgeText}>{expiry}</Text>
                                        </View>
                                    )}
                                </>
                            )}
                            {neglected && (
                                <View style={[styles.badge, {backgroundColor: '#8A7150'}]}>
                                    <Text style={styles.badgeText}>Unused</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.rowSub}>{item.isTool ? usedLabel(item) : `${openedLabel(item.dateOpened)} · ${usedLabel(item)}`}</Text>
                    </View>
                </Pressable>
                <View style={styles.rowActions}>
                    {!retiredView && (
                        <Pressable
                            style={({pressed}) => [styles.rowBtn, justUsed && styles.rowBtnConfirmed, pressed && styles.rowBtnPressed]}
                            hitSlop={{top: 6, bottom: 6, left: 16, right: 16}}
                            onPress={handleMarkUsed}
                        >
                            <Check size={18} color={justUsed ? colors.onAccent : colors.ink} />
                            <Text style={[styles.rowBtnText, justUsed && styles.rowBtnTextConfirmed]}>{justUsed ? 'Done!' : 'Used'}</Text>
                        </Pressable>
                    )}
                    <Pressable
                        style={({pressed}) => [styles.rowBtn, justToggled && styles.rowBtnConfirmed, pressed && styles.rowBtnPressed]}
                        hitSlop={{top: 6, bottom: 6, left: 16, right: 16}}
                        onPress={handleRetire}
                    >
                        <RotateCcw size={18} color={justToggled ? colors.onAccent : colors.ink} />
                        <Text style={[styles.rowBtnText, justToggled && styles.rowBtnTextConfirmed]}>
                            {justToggled ? 'Done!' : (retiredView ? 'Restore' : 'Retire')}
                        </Text>
                    </Pressable>
                    <Pressable
                        style={({pressed}) => [styles.rowBtn, styles.rowBtnDanger, pressed && styles.rowBtnPressed]}
                        hitSlop={{top: 6, bottom: 6, left: 16, right: 16}}
                        onPress={() => onDelete(item.id)}
                    >
                        <Trash2 size={18} color={colors.accent} />
                        <Text style={[styles.rowBtnText, styles.rowBtnTextDanger]}>Delete</Text>
                    </Pressable>
                </View>
            </View>
            {neglected && (
                <View style={styles.reasonBox}>
                    {reason ? (
                        <>
                            <View style={styles.reasonAdviceRow}>
                                <Lightbulb size={13} color={colors.inkSoft} />
                                <Text style={styles.hintText}>{neglectReasonAdvice(item, reason)}</Text>
                            </View>
                            <Pressable onPress={() => setReason(null)} hitSlop={8}>
                                <Text style={styles.reasonChangeLink}>Not it, pick a different reason</Text>
                            </Pressable>
                        </>
                    ) : (
                        <>
                            <Text style={styles.reasonPrompt}>Why aren't you reaching for this?</Text>
                            <View style={styles.reasonChipRow}>
                                {/*tools don't expire, so that reason wouldn't make sense for one*/}
                                {NEGLECT_REASONS.filter((r) => !(item.isTool && r.key === 'expired')).map((r) => (
                                    <Pressable key={r.key} style={styles.reasonChip} onPress={() => setReason(r.key)}>
                                        <Text style={styles.reasonChipText}>{r.label}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </>
                    )}
                </View>
            )}
        </View>
    );
}
const getStyles = (colors) => StyleSheet.create({
    rowCard: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, marginBottom: 8, overflow: 'hidden'},
    row: {flexDirection: 'row', gap: 10, padding: 9, alignItems: 'center'},
    rowMain: {flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center'},
    rowRetired: {opacity: 0.55},
    rowPhoto: {width: 46, height: 46, borderRadius: radius.sm},
    rowPhotoPlaceholder: {backgroundColor: colors.surfaceAlt},
    rowName: {fontWeight: '600', fontSize: 13.5, color: colors.ink, flexShrink: 1},
    rowNameRow: {flexDirection: 'row', alignItems: 'center', gap: 4},
    rowType: {fontSize: 11, color: colors.inkSoft},
    badgeRow: {flexDirection: 'row', gap: 5, marginTop: 4},
    badge: {paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill},
    badgeText: {color: '#fff', fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase'},
    rowSub: {fontSize: 10.5, color: colors.inkMuted, marginTop: 4},
    rowActions: {flexDirection: 'column', gap: 10},
    rowBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 46, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg},
    rowBtnPressed: {opacity: 0.55},
    rowBtnConfirmed: {backgroundColor: colors.accent, borderColor: colors.accent},
    rowBtnText: {fontSize: 13.5, fontWeight: '700', color: colors.ink},
    rowBtnTextConfirmed: {color: colors.onAccent},
    rowBtnDanger: {},
    rowBtnTextDanger: {color: colors.accent},
    reasonBox: {backgroundColor: colors.surfaceAlt, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 12, paddingVertical: 10, gap: 9},
    reasonPrompt: {fontSize: 12, fontWeight: '700', color: colors.ink},
    reasonChipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
    reasonChip: {paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface},
    reasonChipText: {fontSize: 12, fontWeight: '600', color: colors.ink},
    reasonAdviceRow: {flexDirection: 'row', gap: 7, alignItems: 'flex-start'},
    hintText: {flex: 1, fontSize: 11.5, lineHeight: 16, color: colors.inkSoft},
    reasonChangeLink: {fontSize: 11.5, fontWeight: '600', color: colors.accent},
});
