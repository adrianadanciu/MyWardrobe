import React, {useState, useEffect, useMemo} from 'react';
//textInput is for fields in which the user can write
//Alert is used for errors and confirmations
import {View, Text, ScrollView, TextInput, Pressable, Image, ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView, Platform} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {Camera, ImagePlus, RefreshCw, Check, TriangleAlert} from 'lucide-react-native';
import {CATEGORY, CATEGORY_ORDER, CLOTHING_CATEGORIES, BOTTOM_CATEGORIES, TOP_CATEGORIES, WARMTH, WARMTH_ORDER, CONDITION, CONDITION_ORDER, conditionFromScore} from '../constants/Wardrobe';
import {FIT_ORDER, FIT} from '../constants/BodyShapes';
import {OCCASION_ORDER, OCCASION} from '../constants/Occasions';
import {STYLE_ORDER, STYLE} from '../constants/Styles';
import {todayIso, normalizeDateInput} from '../utils/Dates';
import {loadItems, saveItems, loadProfile} from '../services/Storage';
import {persistPhoto} from '../services/PhotoStorage';
import {analyzeClothingPhoto} from '../services/PhotoAnalysis';
import {findPossibleDuplicates} from '../utils/DuplicateCheck';
import {getFitFlags} from '../utils/ColorTheory';
import {useTheme} from '../theme/ThemeContext';
import {radius} from '../theme/tokens';
const COLOR_PRESETS = [
    '#20242B', '#63697A', '#FFFFFF', '#DAD7CC', '#C1502E', '#E4572E', '#C99A3B', 
    '#D4B483', '#6E8763', '#4F6F52', '#4A6FA5', '#2E4A6B', '#7B4B94', '#A85CB0', 
    '#B23A6E', '#8C3B3B',
];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function buildAnalysisHint(analysis) {
    const fields = ['name', 'color', 'category', 'warmth'];
    if ([analysis.chestCmGuess, analysis.waistCmGuess, analysis.hipsCmGuess].some((v) => v != null)) {
        fields.push('measurements');
    }
    return `I've filled in the fields below. Check them and adjust if needed.`;
}
export default function AddItem({navigation}) {
    const {colors} = useTheme();
    const styles = useMemo(() => getStyles(colors), [colors]);
    const [photo, setPhoto] = useState(null); // { uri, base64 }
    const [analyzing, setAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [analysisError, setAnalysisError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [duplicateMatches, setDuplicateMatches] = useState([]);
    const [form, setForm] = useState({name: '', category: 'tshirt', warmth: 'medium', fit: 'relaxed', occasions: [], styles: [], measurements: {chest: '', waist: '', hips: ''}, colorHex: '#4A6FA5', dateAdded: todayIso(), measurementsOverride: false});
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
        () => fitFlags.filter((f) => f.type !== 'measurements' || !form.measurementsOverride),
        [fitFlags, form.measurementsOverride],
    );
    useEffect(() => {
        const unsub = navigation.addListener('beforeRemove', (e) => {
            if (!saving) return;
            e.preventDefault();
            Alert.alert('Please wait', "Still saving your item. This'll only take a moment.");
        });
        return unsub;
    }, [navigation, saving]);
    const checkForDuplicates = async (candidate) => {
        try{
            const items = await loadItems();
            setDuplicateMatches(findPossibleDuplicates(items, candidate));
        } 
        catch (e){
        }
    };
    const runAnalysis = async (base64) => {
        setAnalyzing(true);
        setAnalysisError(null);
        try {
            const result = await analyzeClothingPhoto({base64, mediaType: 'image/jpeg'});
            setAnalysis(result);
            const next = {
                ...form,
                name: form.name.trim() ? form.name : (result.nameGuess || form.name),
                colorHex: result.dominantColorHex || form.colorHex,
                category: result.categoryGuess || form.category,
                warmth: result.warmthGuess || form.warmth,
                fit: result.fitGuess || form.fit,
                occasions: form.occasions.length ? form.occasions : (result.occasionsGuess || form.occasions),
                measurements: {
                    chest: form.measurements.chest || (result.chestCmGuess != null ? String(result.chestCmGuess) : form.measurements.chest),
                    waist: form.measurements.waist || (result.waistCmGuess != null ? String(result.waistCmGuess) : form.measurements.waist),
                    hips: form.measurements.hips || (result.hipsCmGuess != null ? String(result.hipsCmGuess) : form.measurements.hips),
                },
            };
            setForm(next);
            checkForDuplicates(next);
        } catch (e) {
            setAnalysisError(e.message || 'The analysis failed.');
        } finally {
            setAnalyzing(false);
        }
    };
    const onPhotoCaptured = ({uri, base64}) => {
        setPhoto({uri, base64});
        setAnalysis(null);
        setAnalysisError(null);
        setDuplicateMatches([]);
        runAnalysis(base64);
    };
    const openCamera = () => {
        navigation.navigate('CustomCamera', {aspect: [3, 4], onCapture: onPhotoCaptured});
    };
    const pickFromLibrary = async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission needed', "Without gallery access I can't open your photos.");
                return;
            }
            const options = {mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 0.6, base64: true};
            const result = await ImagePicker.launchImageLibraryAsync(options);
            if (result.canceled) return;
            const asset = result.assets[0];
            //base64 contains the photo's description coded for the ai
            onPhotoCaptured({uri: asset.uri, base64: asset.base64});
        } 
        catch (e){
            Alert.alert('Error', String(e.message || e));
        }
    };
    const handleSave = async () => {
        if (!form.name.trim()) {
            Alert.alert('Missing name', 'Give the item a name before saving it.');
            return;
        }
        setSaving(true);
        try{
            const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            const photoUri = photo?.uri ? await persistPhoto(photo.uri, id) : null;
            const newItem = {
                id,
                name: form.name.trim(),
                category: form.category,
                colorHex: form.colorHex,
                warmth: form.warmth,
                fit: form.fit,
                occasions: form.occasions,
                styles: form.styles,
                measurements: {
                    chestCm: form.measurements.chest ? Number(form.measurements.chest) : null,
                    waistCm: form.measurements.waist ? Number(form.measurements.waist) : null,
                    hipsCm: form.measurements.hips ? Number(form.measurements.hips) : null,
                },
                measurementsOverride: form.measurementsOverride,
                dateAdded: normalizeDateInput(form.dateAdded) || todayIso(),
                lastWorn: null,
                wearCount: 0,
                photoUri,
                conditionScore: analysis?.conditionScore ?? null,
                conditionLabel: analysis?.conditionLabel ?? null,
                notes: analysis?.notes ?? null,
            };
            const current = await loadItems();
            await saveItems([...current, newItem]);
            await wait(350);
            setSaving(false);
            setSaveSuccess(true);
            await wait(550);
            navigation.goBack();
        } 
        catch (e){
            setSaving(false);
            Alert.alert('Error saving', String(e.message || e));
        }
    };
    const conditionKey = analysis ? conditionFromScore(analysis.conditionScore) : null;
    const condition = conditionKey ? CONDITION[conditionKey] : null;
    const analysisHint = analysis ? buildAnalysisHint(analysis) : '';
    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{flex: 1}}
            >
            <ScrollView contentContainerStyle={styles.scroll}>
                {photo ? (
                    //view is the container that holds the picture and button under it
                    <View>
                        <Image source={{uri: photo.uri}} style={styles.photoPreview} />
                        <Pressable style={styles.retakeBtn} onPress={openCamera}>
                            <RefreshCw size={13} color={colors.ink} />
                            <Text style={styles.retakeText}>change photo</Text>
                        </Pressable>
                    </View>
                ) : (
                    <View style={styles.photoPickRow}>
                        <Pressable style={styles.photoPickBtn} onPress={openCamera}>
                            <Camera size={22} color={colors.bg} />
                            <Text style={styles.photoPickText}>Take a photo</Text>
                        </Pressable>
                        <Pressable style={[styles.photoPickBtn, styles.photoPickBtnAlt]} onPress={pickFromLibrary}>
                            <ImagePlus size={22} color={colors.ink} />
                            <Text style={[styles.photoPickText, {color: colors.ink}]}>From gallery</Text>
                        </Pressable>
                    </View>
                )}
                {analyzing && (
                    <View style={styles.analyzingRow}>
                        <ActivityIndicator color={colors.accent} />
                        <Text style={styles.analyzingText}>Analyzing photo…</Text>
                    </View>
                )}
                {analysisError && (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{analysisError}</Text>
                        <Pressable onPress={() => runAnalysis(photo.base64)}>
                            <Text style={styles.retryText}>try again</Text>
                        </Pressable>
                    </View>
                )}
                {analysis && condition && (
                    <View style={[styles.analysisCard, {borderColor: condition.color}]}>
                        <Text style={styles.analysisTitle}>{analysis.conditionLabel || condition.label}</Text>
                        <View style={styles.conditionBar}>
                            {CONDITION_ORDER.map((tier, idx) => {
                                const tierIdx = CONDITION_ORDER.indexOf(conditionKey);
                                const filled = idx <= tierIdx;
                                return (
                                    <View
                                        key={tier}
                                        style={[
                                            styles.conditionSegment,
                                            {backgroundColor: filled ? CONDITION[tier].color : colors.line},
                                        ]}
                                    />
                                );
                            })}
                        </View>
                        <View style={styles.conditionScaleLabels}>
                            <Text style={styles.conditionScaleText}>Like new</Text>
                            <Text style={styles.conditionScaleText}>Very worn</Text>
                        </View>
                        {!!analysis.notes && <Text style={styles.analysisNotes}>{analysis.notes}</Text>}
                        <Text style={styles.analysisHint}>{analysisHint}</Text>
                    </View>
                )}
                {duplicateMatches.length > 0 && (
                    <View style={styles.duplicateBox}>
                        <Text style={styles.duplicateTitle}>
                            {duplicateMatches.length === 1 ? 'You might already have this' : `You might already have ${duplicateMatches.length} similar items`}
                        </Text>
                        {duplicateMatches.slice(0, 3).map((match) => (
                            <Pressable key={match.id} style={styles.duplicateRow} onPress={() => navigation.navigate('EditItem', {item: match})}>
                                {match.photoUri ? (
                                    <Image source={{uri: match.photoUri}} style={styles.duplicateThumb} />
                                ) : (
                                    <View style={[styles.duplicateThumb, {backgroundColor: match.colorHex}]} />
                                )}
                                <View style={{flex: 1}}>
                                    <Text style={styles.duplicateName}>{match.name}</Text>
                                    <Text style={styles.duplicateSub}>added {match.dateAdded}</Text>
                                </View>
                            </Pressable>
                        ))}
                        <Text style={styles.duplicateHint}>Same category and a very close color. Double-check before adding another.</Text>
                    </View>
                )}
                <View style={styles.field}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput style={styles.input} placeholder="e.g. Denim jacket" placeholderTextColor={colors.inkMuted} value={form.name} onChangeText={(v) => setForm({...form, name: v})} />
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
                    <Text style={styles.label}>Color {analysis?.dominantColorHex ? '(detected from photo, feel free to change it)' : ''}</Text>
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
                        <Text style={styles.label}>Fit {analysis?.fitGuess ? '(detected from photo)' : ''}</Text>
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
                        <Text style={styles.label}>Measurements in cm (optional: used to find your body shape)</Text>
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
                    <Text style={styles.label}>Occasions (optional: leave blank to use it anywhere{analysis?.occasionsGuess?.length ? ', detected from photo' : ''})</Text>
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
                    <Text style={styles.label}>Purchase date (YYYY-MM-DD, or just the year, e.g. 2022, if that's all you remember)</Text>
                    <TextInput style={styles.input} placeholder={todayIso()} placeholderTextColor={colors.inkMuted} value={form.dateAdded} onChangeText={(v) => setForm({...form, dateAdded: v})} />
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
                                <Text style={styles.overrideText}>This fits fine — don't warn me about the measurements again</Text>
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
                            <Text style={styles.saveBtnText}>Added!</Text>
                        </View>
                    ) : saving ? (
                        <ActivityIndicator color={colors.onAccent} />
                    ) : (
                        <Text style={styles.saveBtnText}>Add to wardrobe</Text>
                    )}
                </Pressable>
            </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
const getStyles = (colors) => StyleSheet.create({
    safe: {flex: 1, backgroundColor: colors.bg},
    scroll: {padding: 16, paddingBottom: 50},
    photoPickRow: {flexDirection: 'row', gap: 10, marginBottom: 16},
    photoPickBtn: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.ink, paddingVertical: 26, borderRadius: radius.lg},
    photoPickBtnAlt: {backgroundColor: colors.surfaceAlt},
    photoPickText: {color: colors.bg, fontWeight: '700', fontSize: 13},
    photoPreview: {width: '100%', height: 260, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt},
    retakeBtn: {flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 16, paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line},
    retakeText: {fontSize: 12, color: colors.ink, fontWeight: '500'},
    analyzingRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16},
    analyzingText: {fontSize: 12.5, color: colors.inkSoft, flexShrink: 1},
    errorBox: {backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: 12, marginBottom: 16},
    errorText: {fontSize: 12.5, color: colors.danger, marginBottom: 6},
    retryText: {fontSize: 12.5, color: colors.accent, fontWeight: '700'},
    analysisCard: {borderWidth: 1.5, borderRadius: radius.lg, padding: 13, marginBottom: 16, backgroundColor: colors.surface},
    analysisTitle: {fontWeight: '700', fontSize: 15, color: colors.ink, marginBottom: 8},
    conditionBar: {flexDirection: 'row', gap: 4},
    conditionSegment: {flex: 1, height: 7, borderRadius: radius.sm},
    conditionScaleLabels: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 8},
    conditionScaleText: {fontSize: 10, color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.3},
    analysisNotes: {fontSize: 12.5, color: colors.inkSoft, marginBottom: 6},
    analysisHint: {fontSize: 11, color: colors.warnSub, fontStyle: 'italic'},
    duplicateBox: {borderWidth: 1, borderColor: colors.warnBorder, backgroundColor: colors.warnBg, borderRadius: radius.lg, padding: 13, marginBottom: 16},
    duplicateTitle: {fontWeight: '700', fontSize: 13.5, color: colors.warnText, marginBottom: 8},
    duplicateRow: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6},
    duplicateThumb: {width: 38, height: 38, borderRadius: radius.sm},
    duplicateName: {fontSize: 13, fontWeight: '600', color: colors.warnText},
    duplicateSub: {fontSize: 11, color: colors.warnSub, marginTop: 1},
    duplicateHint: {fontSize: 11, color: colors.warnSub, fontStyle: 'italic', marginTop: 6},
    mismatchBox: {borderWidth: 1, borderColor: colors.warnBorder, backgroundColor: colors.warnBg, borderRadius: radius.lg, padding: 13, marginTop: 8, marginBottom: 8},
    mismatchTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6},
    mismatchTitle: {fontWeight: '700', fontSize: 13.5, color: colors.warnText, flexShrink: 1},
    mismatchMsg: {fontSize: 12, color: colors.warnText, lineHeight: 17, marginBottom: 3},
    mismatchHint: {fontSize: 11, color: colors.warnSub, fontStyle: 'italic', marginTop: 4},
    overrideRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 2},
    overrideCheckbox: {width: 18, height: 18, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.warnText, alignItems: 'center', justifyContent: 'center'},
    overrideCheckboxChecked: {backgroundColor: colors.accent, borderColor: colors.accent},
    overrideText: {flex: 1, fontSize: 11.5, color: colors.warnText, fontWeight: '600'},
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
    saveBtn: {backgroundColor: colors.accent, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', marginTop: 8},
    saveBtnDisabled: {opacity: 0.6},
    saveBtnSuccess: {backgroundColor: colors.success, opacity: 1},
    saveBtnRow: {flexDirection: 'row', alignItems: 'center', gap: 7},
    saveBtnText: {color: colors.onAccent, fontWeight: '700', fontSize: 14.5},
});