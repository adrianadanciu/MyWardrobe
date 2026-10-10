import React, {useState, useEffect, useMemo} from 'react';
import {View, Text, ScrollView, TextInput, Pressable, Image, ActivityIndicator, Alert, Modal, StyleSheet , KeyboardAvoidingView, Platform} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {Camera, ImagePlus, Check, TriangleAlert, X} from 'lucide-react-native';
import {CATEGORY, CATEGORY_ORDER, CLOTHING_CATEGORIES, BOTTOM_CATEGORIES, TOP_CATEGORIES, WARMTH, WARMTH_ORDER, CONDITION, CONDITION_ORDER, conditionFromScore, scoreForCondition} from '../constants/Wardrobe';
import {FIT_ORDER, FIT} from '../constants/BodyShapes';
import {OCCASION_ORDER, OCCASION} from '../constants/Occasions';
import {STYLE_ORDER, STYLE} from '../constants/Styles';
import {todayIso, normalizeDateInput} from '../utils/Dates';
import {loadItems, saveItems, loadProfile} from '../services/Storage';
import {persistPhoto} from '../services/PhotoStorage';
import {getFitFlags, filterOverriddenFlags} from '../utils/ColorTheory';
import {useTheme} from '../theme/ThemeContext';
import {radius} from '../theme/tokens';
const COLOR_PRESETS = [
    '#20242B', '#63697A', '#FFFFFF', '#DAD7CC', '#C1502E', '#E4572E', '#C99A3B', 
    '#D4B483', '#6E8763', '#4F6F52', '#4A6FA5', '#2E4A6B', '#7B4B94', '#A85CB0', 
    '#B23A6E', '#8C3B3B',
];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export default function EditItem({navigation, route}) {
    const {colors} = useTheme();
    const styles = useMemo(() => getStyles(colors), [colors]);
    const original = route?.params?.item;
    const [photoUri, setPhotoUri] = useState(original?.photoUri || null);
    const [showFullPhoto, setShowFullPhoto] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [form, setForm] = useState({
        name: original?.name || '',
        category: original?.category || 'tshirt',
        colorHex: original?.colorHex || '#4A6FA5',
        warmth: original?.warmth || 'medium',
        fit: original?.fit || 'relaxed',
        occasions: original?.occasions || [],
        styles: original?.styles || [],
        measurements: {
            chest: original?.measurements?.chestCm ? String(original.measurements.chestCm) : '',
            waist: original?.measurements?.waistCm ? String(original.measurements.waistCm) : '',
            hips: original?.measurements?.hipsCm ? String(original.measurements.hipsCm) : '',
        },
        dateAdded: original?.dateAdded || '',
        measurementsOverride: original?.measurementsOverride || false,
        shapeOverride: original?.shapeOverride || false,
        casualOnly: original?.casualOnly || false,
        condition: conditionFromScore(original?.conditionScore),
    });
    const [profile, setProfile] = useState(null);
    useEffect(() => {loadProfile().then(setProfile);}, []);
    const bodyMeasurements = useMemo(() => (
        profile && (profile.bustCm || profile.waistCm || profile.hipsCm)
            ? {bustCm: profile.bustCm || null, waistCm: profile.waistCm || null, hipsCm: profile.hipsCm || null}
            : null
    ), [profile]);
    const fitFlags = useMemo(() => {
        if (!profile) return [];
        const candidate = {
            category: form.category,
            colorHex: form.colorHex,
            fit: form.fit,
            measurements: {
                chestCm: form.measurements.chest ? Number(form.measurements.chest) : null,
                waistCm: form.measurements.waist ? Number(form.measurements.waist) : null,
                hipsCm: form.measurements.hips ? Number(form.measurements.hips) : null,
            },
        };
        return getFitFlags(candidate, {season: profile.season, bodyShape: profile.bodyShape, bodyMeasurements});
    }, [profile, form.category, form.colorHex, form.fit, form.measurements, bodyMeasurements]);
    const visibleFitFlags = useMemo(
        () => filterOverriddenFlags(fitFlags, form),
        [fitFlags, form.measurementsOverride, form.shapeOverride],
    );
    useEffect(() => {
        const unsub = navigation.addListener('beforeRemove', (e) => {
            if (!saving) return;
            e.preventDefault();
            Alert.alert('Please wait', "Still saving. This'll only take a moment.");
        });
        return unsub;
    }, [navigation, saving]);
    if (!original) {
        return (
            <SafeAreaView style={styles.safe}>
                <Text style={styles.errorText}>Couldn't find that item.</Text>
            </SafeAreaView>
        );
    }
    const pickFrom = async (source) => {
        try {
            const permission = source === 'camera'
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission needed', "Without access I can't open the camera or gallery.");
                return;
            }
            const options = {mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 0.6};
            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync(options)
                : await ImagePicker.launchImageLibraryAsync(options);
            if (result.canceled) return;
            const persisted = await persistPhoto(result.assets[0].uri, original.id);
            setPhotoUri(persisted);
        } catch (e) {
            Alert.alert('Error', String(e.message || e));
        }
    };
    const handleSave = async () => {
        if (!form.name.trim()) {
            Alert.alert('Missing name', 'Give the item a name before saving it.');
            return;
        }
        setSaving(true);
        try {
            const originalCondition = conditionFromScore(original.conditionScore);
            const conditionChanged = form.condition && form.condition !== originalCondition;
            const updated = {
                ...original,
                ...(conditionChanged
                    ? {conditionScore: scoreForCondition(form.condition), conditionLabel: CONDITION[form.condition].label}
                    : {}),
                name: form.name.trim(),
                category: form.category,
                colorHex: form.colorHex,
                warmth: form.warmth,
                fit: form.fit,
                occasions: form.occasions,
                styles: form.styles,
                casualOnly: form.casualOnly,
                measurements: {
                    chestCm: form.measurements.chest ? Number(form.measurements.chest) : null,
                    waistCm: form.measurements.waist ? Number(form.measurements.waist) : null,
                    hipsCm: form.measurements.hips ? Number(form.measurements.hips) : null,
                },
                measurementsOverride: form.measurementsOverride,
                shapeOverride: form.shapeOverride,
                dateAdded: normalizeDateInput(form.dateAdded) || original.dateAdded || todayIso(),
                photoUri,
            };
            const current = await loadItems();
            await saveItems(current.map((i) => (i.id === original.id ? updated : i)));
            await wait(300);
            setSaving(false);
            setSaveSuccess(true);
            await wait(450);
            navigation.goBack();
        } catch (e) {
            setSaving(false);
            Alert.alert('Error saving', String(e.message || e));
        }
    };
    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{flex: 1}}
            >
            <ScrollView contentContainerStyle={styles.scroll}>
                {photoUri ? (
                    <View>
                        <Pressable onPress={() => setShowFullPhoto(true)}>
                            <Image source={{uri: photoUri}} style={styles.photoPreview} />
                        </Pressable>
                        <View style={styles.photoPickRow}>
                            <Pressable style={styles.photoPickBtnSmall} onPress={() => pickFrom('camera')}>
                                <Camera size={16} color={colors.bg} />
                                <Text style={styles.photoPickText}>Retake</Text>
                            </Pressable>
                            <Pressable style={[styles.photoPickBtnSmall, styles.photoPickBtnAlt]} onPress={() => pickFrom('library')}>
                                <ImagePlus size={16} color={colors.ink} />
                                <Text style={[styles.photoPickText, {color: colors.ink}]}>Choose new</Text>
                            </Pressable>
                        </View>
                    </View>
                ) : (
                    <View style={styles.photoPickRow}>
                        <Pressable style={styles.photoPickBtn} onPress={() => pickFrom('camera')}>
                            <Camera size={22} color={colors.bg} />
                            <Text style={styles.photoPickText}>Take a photo</Text>
                        </Pressable>
                        <Pressable style={[styles.photoPickBtn, styles.photoPickBtnAlt]} onPress={() => pickFrom('library')}>
                            <ImagePlus size={22} color={colors.ink} />
                            <Text style={[styles.photoPickText, {color: colors.ink}]}>From gallery</Text>
                        </Pressable>
                    </View>
                )}
                <View style={styles.field}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm({...form, name: v})} />
                </View>
                <View style={styles.field}>
                    <Text style={styles.label}>Category</Text>
                    <View style={styles.segmented}>
                        {CATEGORY_ORDER.map((c) => (
                            <Pressable key={c} style={[styles.segBtn, form.category === c && styles.segBtnActive]} onPress={() => setForm({...form, category: c})}>
                                <Text style={[styles.segText, form.category === c && styles.segTextActive]}>{CATEGORY[c].short}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
                <View style={styles.field}>
                    <Text style={styles.label}>Color</Text>
                    <View style={styles.colorGrid}>
                        {COLOR_PRESETS.map((hex) => (
                            <Pressable
                                key={hex}
                                onPress={() => setForm({...form, colorHex: hex})}
                                style={[styles.colorSwatch, {backgroundColor: hex}, form.colorHex === hex && styles.colorSwatchActive]}
                            />
                        ))}
                    </View>
                    <View style={styles.colorPreviewRow}>
                        <View style={[styles.colorPreview, {backgroundColor: form.colorHex}]} />
                        <Text style={styles.colorPreviewText}>{form.colorHex}</Text>
                    </View>
                </View>
                {CLOTHING_CATEGORIES.includes(form.category) && (
                    <View style={styles.field}>
                        <Text style={styles.label}>Warmth</Text>
                        <View style={styles.segmented}>
                            {WARMTH_ORDER.map((w) => (
                                <Pressable key={w} style={[styles.segBtn, form.warmth === w && styles.segBtnActive]} onPress={() => setForm({...form, warmth: w})}>
                                    <Text style={[styles.segText, form.warmth === w && styles.segTextActive]}>{WARMTH[w]}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                )}
                {CLOTHING_CATEGORIES.includes(form.category) && (
                    <View style={styles.field}>
                        <Text style={styles.label}>Fit</Text>
                        <View style={styles.segmented}>
                            {FIT_ORDER.map((f) => (
                                <Pressable key={f} style={[styles.segBtn, form.fit === f && styles.segBtnActive]} onPress={() => setForm({...form, fit: f})}>
                                    <Text style={[styles.segText, form.fit === f && styles.segTextActive]}>{FIT[f]}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                )}
                {CLOTHING_CATEGORIES.includes(form.category) && (
                    <View style={styles.field}>
                        <Text style={styles.label}>Style (optional: which aesthetic this piece belongs to)</Text>
                        <View style={styles.segmented}>
                            {STYLE_ORDER.map((s) => {
                                const active = form.styles.includes(s);
                                return (
                                    <Pressable
                                        key={s}
                                        style={[styles.segBtn, active && styles.segBtnActive]}
                                        onPress={() => setForm({
                                            ...form,
                                            styles: active ? form.styles.filter((x) => x !== s) : [...form.styles, s],
                                        })}
                                    >
                                        <Text style={[styles.segText, active && styles.segTextActive]}>{STYLE[s].label}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                )}
                {CLOTHING_CATEGORIES.includes(form.category) && (
                    <View style={styles.field}>
                        <Text style={styles.label}>Measurements in cm (optional)</Text>
                        <View style={styles.measureRow}>
                            {!BOTTOM_CATEGORIES.includes(form.category) && (
                                <View style={styles.measureField}>
                                    <Text style={styles.measureLabel}>Chest</Text>
                                    <TextInput
                                        style={styles.measureInput}
                                        keyboardType="numeric"
                                        placeholder="cm"
                                        placeholderTextColor={colors.inkMuted}
                                        value={form.measurements.chest}
                                        onChangeText={(v) => setForm({...form, measurements: {...form.measurements, chest: v}})}
                                    />
                                </View>
                            )}
                            <View style={styles.measureField}>
                                <Text style={styles.measureLabel}>Waist</Text>
                                <TextInput
                                    style={styles.measureInput}
                                    keyboardType="numeric"
                                    placeholder="cm"
                                    placeholderTextColor={colors.inkMuted}
                                    value={form.measurements.waist}
                                    onChangeText={(v) => setForm({...form, measurements: {...form.measurements, waist: v}})}
                                />
                            </View>
                            {!TOP_CATEGORIES.includes(form.category) && (
                                <View style={styles.measureField}>
                                    <Text style={styles.measureLabel}>Hips</Text>
                                    <TextInput
                                        style={styles.measureInput}
                                        keyboardType="numeric"
                                        placeholder="cm"
                                        placeholderTextColor={colors.inkMuted}
                                        value={form.measurements.hips}
                                        onChangeText={(v) => setForm({...form, measurements: {...form.measurements, hips: v}})}
                                    />
                                </View>
                            )}
                        </View>
                    </View>
                )}
                <View style={styles.field}>
                    <Text style={styles.label}>Condition</Text>
                    <View style={styles.segmented}>
                        {CONDITION_ORDER.map((c) => (
                            <Pressable key={c} style={[styles.segBtn, form.condition === c && styles.segBtnActive]} onPress={() => setForm({...form, condition: c})}>
                                <Text style={[styles.segText, form.condition === c && styles.segTextActive]}>{CONDITION[c].label}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
                <View style={styles.field}>
                    <Text style={styles.label}>Occasions (optional: leave blank to use it anywhere)</Text>
                    <View style={styles.segmented}>
                        {OCCASION_ORDER.map((o) => {
                            const active = form.occasions.includes(o);
                            return (
                                <Pressable
                                    key={o}
                                    style={[styles.segBtn, active && styles.segBtnActive]}
                                    onPress={() => setForm({
                                        ...form,
                                        occasions: active ? form.occasions.filter((x) => x !== o) : [...form.occasions, o],
                                    })}
                                >
                                    <Text style={[styles.segText, active && styles.segTextActive]}>{OCCASION[o].label}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
                <View style={styles.field}>
                    <Text style={styles.label}>Purchase date (YYYY-MM-DD, or just the year e.g. 2022), since when you've had it</Text>
                    <TextInput
                        style={styles.input}
                        placeholder={todayIso()}
                        placeholderTextColor={colors.inkMuted}
                        value={form.dateAdded}
                        onChangeText={(v) => setForm({...form, dateAdded: v})}
                        onFocus={() => {if (!form.dateAdded) setForm((f) => ({...f, dateAdded: todayIso()}));}}
                    />
                </View>
                <View style={styles.field}>
                    <Pressable style={styles.casualRow} onPress={() => setForm({...form, casualOnly: !form.casualOnly})}>
                        <View style={[styles.casualCheckbox, form.casualOnly && styles.casualCheckboxChecked]}>
                            {form.casualOnly && <Check size={12} color={colors.onAccent} />}
                        </View>
                        <Text style={styles.casualText}>Not a favorite</Text>
                    </Pressable>
                </View>
                {visibleFitFlags.length > 0 && (
                    <View style={styles.mismatchBox}>
                        <View style={styles.mismatchTitleRow}>
                            <TriangleAlert size={15} color={colors.warnText} />
                            <Text style={styles.mismatchTitle}>This may not suit your profile</Text>
                        </View>
                        {visibleFitFlags.map((f) => (
                            <Text key={f.type} style={styles.mismatchMsg}>{f.message}</Text>
                        ))}
                        {fitFlags.some((f) => f.type === 'measurements') && (
                            <Pressable
                                style={styles.overrideRow}
                                onPress={() => setForm({...form, measurementsOverride: !form.measurementsOverride})}
                            >
                                <View style={[styles.overrideCheckbox, form.measurementsOverride && styles.overrideCheckboxChecked]}>
                                    {form.measurementsOverride && <Check size={12} color={colors.onAccent} />}
                                </View>
                                <Text style={styles.overrideText}>This fits fine</Text>
                            </Pressable>
                        )}
                        {fitFlags.some((f) => f.type === 'shape') && (
                            <Pressable
                                style={styles.overrideRow}
                                onPress={() => setForm({...form, shapeOverride: !form.shapeOverride})}
                            >
                                <View style={[styles.overrideCheckbox, form.shapeOverride && styles.overrideCheckboxChecked]}>
                                    {form.shapeOverride && <Check size={12} color={colors.onAccent} />}
                                </View>
                                <Text style={styles.overrideText}>Stop flagging the shape</Text>
                            </Pressable>
                        )}
                        <Text style={styles.mismatchHint}>Save it anyway if it's still worth keeping.</Text>
                    </View>
                )}
                <Pressable
                    style={[styles.saveBtn, saving && styles.saveBtnDisabled, saveSuccess && styles.saveBtnSuccess]}
                    onPress={handleSave}
                    disabled={saving || saveSuccess}
                >
                    {saveSuccess ? (
                        <View style={styles.saveBtnRow}>
                            <Check size={17} color={colors.onSuccess} />
                            <Text style={styles.saveBtnText}>Saved!</Text>
                        </View>
                    ) : saving ? (
                        <ActivityIndicator color={colors.onAccent} />
                    ) : (
                        <Text style={styles.saveBtnText}>Save changes</Text>
                    )}
                </Pressable>
            </ScrollView>
            </KeyboardAvoidingView>
            <Modal visible={showFullPhoto} animationType="fade" transparent onRequestClose={() => setShowFullPhoto(false)}>
                <Pressable style={styles.fullPhotoOverlay} onPress={() => setShowFullPhoto(false)}>
                    <Image source={{uri: photoUri}} style={styles.fullPhotoImage} resizeMode="contain" />
                    <Pressable style={styles.fullPhotoCloseBtn} onPress={() => setShowFullPhoto(false)} hitSlop={10}>
                        <X size={22} color="#fff" />
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}
const getStyles = (colors) => StyleSheet.create({
    safe: {flex: 1, backgroundColor: colors.bg},
    scroll: {padding: 16, paddingBottom: 50},
    errorText: {fontSize: 13, color: colors.danger, padding: 16},
    photoPickRow: {flexDirection: 'row', gap: 10, marginBottom: 16},
    photoPickBtn: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.ink, paddingVertical: 26, borderRadius: radius.lg},
    photoPickBtnSmall: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.ink, paddingVertical: 10, borderRadius: radius.md},
    photoPickBtnAlt: {backgroundColor: colors.surfaceAlt},
    fullPhotoOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center'},
    fullPhotoImage: {width: '100%', height: '100%'},
    fullPhotoCloseBtn: {position: 'absolute', top: 54, right: 20, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center'},
    photoPickText: {color: colors.bg, fontWeight: '700', fontSize: 13},
    photoPreview: {width: '100%', height: 220, borderRadius: radius.lg, marginBottom: 12, backgroundColor: colors.surfaceAlt},
    field: {marginBottom: 16},
    label: {fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.inkSoft, fontWeight: '700', marginBottom: 7},
    input: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.ink},
    segmented: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
    segBtn: {borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingVertical: 7, paddingHorizontal: 13, borderRadius: radius.pill},
    segBtnActive: {backgroundColor: colors.ink, borderColor: colors.ink},
    segText: {fontSize: 12.5, fontWeight: '500', color: colors.ink},
    segTextActive: {color: colors.bg},
    measureRow: {flexDirection: 'row', gap: 10},
    measureField: {flex: 1},
    measureLabel: {fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, color: colors.inkSoft, fontWeight: '700', marginBottom: 6},
    measureInput: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, color: colors.ink, textAlign: 'center'},
    colorGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
    colorSwatch: {width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)'},
    colorSwatchActive: {borderWidth: 3, borderColor: colors.ink},
    colorPreviewRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10},
    colorPreview: {width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)'},
    colorPreviewText: {fontSize: 12.5, color: colors.inkSoft},
    mismatchBox: {borderWidth: 1, borderColor: colors.warnBorder, backgroundColor: colors.warnBg, borderRadius: radius.lg, padding: 13, marginTop: 8, marginBottom: 8},
    mismatchTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6},
    mismatchTitle: {fontWeight: '700', fontSize: 13.5, color: colors.warnText, flexShrink: 1},
    mismatchMsg: {fontSize: 12, color: colors.warnText, lineHeight: 17, marginBottom: 3},
    mismatchHint: {fontSize: 11, color: colors.warnSub, fontStyle: 'italic', marginTop: 4},
    overrideRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 2},
    overrideCheckbox: {width: 18, height: 18, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.warnText, alignItems: 'center', justifyContent: 'center'},
    overrideCheckboxChecked: {backgroundColor: colors.accent, borderColor: colors.accent},
    overrideText: {flex: 1, fontSize: 11.5, color: colors.warnText, fontWeight: '600'},
    conditionHint: {fontSize: 11, color: colors.inkSoft, fontStyle: 'italic', lineHeight: 15, marginTop: 7},
    casualRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
    casualCheckbox: {width: 18, height: 18, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center'},
    casualCheckboxChecked: {backgroundColor: colors.accent, borderColor: colors.accent},
    casualText: {flex: 1, fontSize: 12, color: colors.inkSoft, fontWeight: '500'},
    saveBtn: {backgroundColor: colors.accent, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', marginTop: 8},
    saveBtnDisabled: {opacity: 0.6},
    saveBtnSuccess: {backgroundColor: colors.success, opacity: 1},
    saveBtnRow: {flexDirection: 'row', alignItems: 'center', gap: 7},
    saveBtnText: {color: colors.onAccent, fontWeight: '700', fontSize: 14.5},
});
