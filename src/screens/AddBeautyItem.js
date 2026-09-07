import React, {useState, useEffect, useMemo} from 'react';
//ActivityIndicator is the loading spinner, StyleSheet creates the styling objects
//KeyboardAvoidingView and Platform keep the screen visible when the keyboard appears
import {View, Text, ScrollView, TextInput, Pressable, Image, ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView, Platform} from 'react-native';
//SafeAreaView makes sure that all the components are in the visible part of the screen and don't end under the button bar
import {SafeAreaView} from 'react-native-safe-area-context';
//* is used to export all of the package expo-image-picker
import * as ImagePicker from 'expo-image-picker';
//components that all draw icons
import {Camera, ImagePlus, Check, Star} from 'lucide-react-native';
import {BEAUTY_CATEGORY, BEAUTY_CATEGORY_ORDER, LEVEL, LEVEL_ORDER, ROUTINE, ROUTINE_ORDER} from '../constants/Beauty';
import {todayIso, normalizeDateInput} from '../utils/Dates';
import {loadBeautyItems, saveBeautyItems} from '../services/Storage';
import {persistPhoto} from '../services/PhotoStorage';
import {analyzeBeautyProduct} from '../services/PhotoAnalysis';
import {useTheme} from '../theme/ThemeContext';
import {radius} from '../theme/tokens';
//waiting set so the server isn't overwhelmed
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function applyLevel(form, newLevel) {
    return {
        ...form,
        level: newLevel,
        dateOpened: (newLevel !== 'full' && !form.dateOpened) ? todayIso() : form.dateOpened,
    };
}
export default function AddBeautyItem({navigation, route}) {
    const {colors} = useTheme();
    const styles = useMemo(() => getStyles(colors), [colors]);
    const [photo, setPhoto] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [customRoutine, setCustomRoutine] = useState('');
    const addCustomRoutine = () => {
        const value = customRoutine.trim();
        if (!value) return;
        setForm((f) => (f.routines.includes(value) ? f : {...f, routines: [...f.routines, value]}));
        setCustomRoutine('');
    };
    //pre-fills the category if you got here from that category's plus button, so it doesn't make you re-pick skincare again
    const [form, setForm] = useState({
        name: '', category: route?.params?.initialCategory || 'skincare', type: '', isTool: false, dateOpened: '', paoMonths: '', level: 'full', routines: [], routineStep: '',
    });
    useEffect(() => {
        const unsub = navigation.addListener('beforeRemove', (e) => {
            if (!saving) return;
            e.preventDefault();
            Alert.alert('Please wait', "Still saving your product. This'll only take a moment.");
        });
        return unsub;
    }, [navigation, saving]);
    const runAnalysis = async (base64) => {
        setAnalyzing(true);
        setAnalysisError(null);
        try{
            const result = await analyzeBeautyProduct({base64, mediaType: 'image/jpeg'});
            setAnalysis(result);
            setForm((f) => {
                const withGuesses = {
                    ...f,
                    //if the user has already sent a name, that one is used, else the ai will come up with a name
                    name: f.name.trim() ? f.name : (result.nameGuess || f.name),
                    category: result.categoryGuess || f.category,
                    type: f.type.trim() ? f.type : (result.typeGuess || f.type),
                    isTool: typeof result.isToolGuess === 'boolean' ? result.isToolGuess : f.isTool,
                    paoMonths: f.paoMonths ? f.paoMonths : (result.paoMonthsGuess ? String(result.paoMonthsGuess) : f.paoMonths),
                };
                return result.levelGuess ? applyLevel(withGuesses, result.levelGuess) : withGuesses;
            });
        } 
        catch (e){
            setAnalysisError(e.message || 'The analysis failed.');
        } 
        finally{
            setAnalyzing(false);
        }
    };
    const onPhotoCaptured = ({uri, base64}) => {
        setPhoto({uri, base64});
        setAnalysisError(null);
        runAnalysis(base64);
    };
    const openCamera = () => {
        navigation.navigate('CustomCamera', {aspect: [1, 1], onCapture: onPhotoCaptured});
    };
    const pickFromLibrary = async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission needed', "Without gallery access I can't open your photos.");
                return;
            }
            const options = {mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true};
            const result = await ImagePicker.launchImageLibraryAsync(options);
            if (result.canceled) return;
            const asset = result.assets[0];
            onPhotoCaptured({uri: asset.uri, base64: asset.base64});
        } catch (e) {
            Alert.alert('Error', String(e.message || e));
        }
    };
    const handleSave = async () => {
        //the if-try-catch form is used to avoid infinte rendering, catch applies whether the action was finished successfully or not
        if(!form.name.trim()){
            Alert.alert('Missing name', 'Give the product a name before saving it.');
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
                type: form.type.trim() || BEAUTY_CATEGORY[form.category].label,
                isTool: form.isTool,
                dateOpened: form.isTool ? null : (normalizeDateInput(form.dateOpened) || null),
                paoMonths: form.isTool ? null : (form.paoMonths ? Number(form.paoMonths) : null),
                level: form.isTool ? null : form.level,
                routines: form.routines,
                routineStep: form.routineStep.trim() && !Number.isNaN(Number(form.routineStep)) ? Number(form.routineStep) : null,
                lastUsed: null,
                useCount: 0,
                retired: false,
                photoUri,
            };
            const current = await loadBeautyItems();
            await saveBeautyItems([...current, newItem]);
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
    return(
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{flex: 1}}
            >
            <ScrollView contentContainerStyle={styles.scroll}>
                {photo ? (
                    <Image source={{uri: photo.uri}} style={styles.photoPreview} />
                ) : (
                    <View style={styles.photoPickRow}>
                        <Pressable style={styles.photoPickBtn} onPress={openCamera}>
                            <Camera size={20} color={colors.bg} />
                            <Text style={styles.photoPickText}>Take a photo</Text>
                        </Pressable>
                        <Pressable style={[styles.photoPickBtn, styles.photoPickBtnAlt]} onPress={pickFromLibrary}>
                            <ImagePlus size={20} color={colors.ink} />
                            <Text style={[styles.photoPickText, {color: colors.ink}]}>From gallery</Text>
                        </Pressable>
                    </View>
                )}
                {analyzing && (
                    <View style={styles.analyzingRow}>
                        <ActivityIndicator color={colors.accent} />
                        <Text style={styles.analyzingText}>Reading the label and checking into categories…</Text>
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
                {analysis && (
                    <View style={styles.analysisCard}>
                        <Text style={styles.analysisTitle}>
                            {analysis.levelGuess && analysis.levelGuess !== 'full' ? `Looks ${LEVEL[analysis.levelGuess].label.toLowerCase()}` : 'Looks new'}
                        </Text>
                        {!!analysis.notes && <Text style={styles.analysisNotes}>{analysis.notes}</Text>}
                        {analysis.levelGuess && analysis.levelGuess !== 'full' && !form.dateOpened && (
                            <Text style={styles.analysisHint}>This looks used. If you roughly know when you started it, add a date opened below so expiry tracking works.</Text>
                        )}
                    </View>
                )}
                <View style={styles.field}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput style={styles.input} placeholder="e.g. CeraVe Moisturizing Cream" value={form.name} onChangeText={(v) => setForm({...form, name: v})} />
                </View>
                <View style={styles.field}>
                    <Text style={styles.label}>Category</Text>
                    <View style={styles.segmented}>
                        {BEAUTY_CATEGORY_ORDER.map((c) => (
                            <Pressable key={c} style={[styles.segBtn, form.category === c && styles.segBtnActive]} onPress={() => setForm({...form, category: c})}>
                                <Text style={[styles.segText, form.category === c && styles.segTextActive]}>{BEAUTY_CATEGORY[c].label}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
                <View style={styles.field}>
                    <Text style={styles.label}>Type</Text>
                    <TextInput style={styles.input} placeholder="e.g. Moisturizer, Mascara, Shampoo" value={form.type} onChangeText={(v) => setForm({...form, type: v})} />
                </View>
                <View style={styles.field}>
                    <Text style={styles.label}>Tracking {analysis && typeof analysis.isToolGuess === 'boolean' ? '(detected from photo)' : ''}</Text>
                    <View style={styles.segmented}>
                        <Pressable style={[styles.segBtn, !form.isTool && styles.segBtnActive]} onPress={() => setForm({...form, isTool: false})}>
                            <Text style={[styles.segText, !form.isTool && styles.segTextActive]}>Consumable</Text>
                        </Pressable>
                        <Pressable style={[styles.segBtn, form.isTool && styles.segBtnActive]} onPress={() => setForm({...form, isTool: true})}>
                            <Text style={[styles.segText, form.isTool && styles.segTextActive]}>Tool</Text>
                        </Pressable>
                    </View>
                    <Text style={styles.hint}>Tools, like tweezers, a brush or clippers, skip amount-left and expiry tracking below.</Text>
                </View>
                <View style={styles.field}>
                    <Text style={styles.label}>Routine (optional)</Text>
                    <View style={styles.segmented}>
                        {ROUTINE_ORDER.map((r) => {
                            const active = form.routines.includes(r);
                            return (
                                <Pressable
                                    key={r}
                                    style={[styles.routinePill, active && styles.routinePillActive]}
                                    onPress={() => setForm({
                                        ...form,
                                        routines: active ? form.routines.filter((x) => x !== r) : [...form.routines, r],
                                    })}
                                >
                                    <Star size={13} color={active ? colors.onAccent : colors.inkSoft} fill={active ? colors.onAccent : 'none'} />
                                    <Text style={[styles.routinePillText, active && styles.routinePillTextActive]}>{ROUTINE[r].label}</Text>
                                </Pressable>
                            );
                        })}
                        {form.routines.filter((r) => !ROUTINE_ORDER.includes(r)).map((r) => (
                            <Pressable
                                key={r}
                                style={[styles.routinePill, styles.routinePillActive]}
                                onPress={() => setForm({...form, routines: form.routines.filter((x) => x !== r)})}
                            >
                                <Star size={13} color={colors.onAccent} fill={colors.onAccent} />
                                <Text style={styles.routinePillTextActive}>{r}</Text>
                            </Pressable>
                        ))}
                    </View>
                    <View style={styles.customRoutineRow}>
                        <TextInput
                            style={[styles.input, styles.customRoutineInput]}
                            placeholder="Or type your own, e.g. 'Special occasion'"
                            placeholderTextColor={colors.inkMuted}
                            value={customRoutine}
                            onChangeText={setCustomRoutine}
                            onSubmitEditing={addCustomRoutine}
                        />
                        <Pressable style={styles.customRoutineBtn} onPress={addCustomRoutine}>
                            <Text style={styles.customRoutineBtnText}>Add</Text>
                        </Pressable>
                    </View>
                    <Text style={styles.hint}>Tag when this gets used, like in the morning or for hair wash. Anything tagged here is added automatically whenever you pack for a trip.</Text>
                </View>
                {form.routines.length > 0 && (
                    <View style={styles.field}>
                        <Text style={styles.label}>Step in routine (optional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. 1 for first, 2 for second..."
                            placeholderTextColor={colors.inkMuted}
                            keyboardType="number-pad"
                            value={form.routineStep}
                            onChangeText={(v) => setForm({...form, routineStep: v.replace(/[^0-9]/g, '')})}
                        />
                        <Text style={styles.hint}>Leave blank and the app will guess the position in the routine order, or set it yourself.</Text>
                    </View>
                )}
                {!form.isTool && (
                    <View style={styles.field}>
                        <Text style={styles.label}>Amount left {analysis?.levelGuess ? '(estimated from photo)' : ''}</Text>
                        <View style={styles.segmented}>
                            {LEVEL_ORDER.map((l) => (
                                <Pressable key={l} style={[styles.segBtn, form.level === l && styles.segBtnActive]} onPress={() => setForm((f) => applyLevel(f, l))}>
                                    <Text style={[styles.segText, form.level === l && styles.segTextActive]}>{LEVEL[l].label}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                )}
                {!form.isTool && (
                    <View style={styles.field}>
                        <Text style={styles.label}>Date opened (YYYY-MM-DD, or just the year e.g. 2022, leave blank if unopened)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder={todayIso()}
                            value={form.dateOpened}
                            onChangeText={(v) => setForm({...form, dateOpened: v})}
                            onFocus={() => {if (!form.dateOpened) setForm((f) => ({...f, dateOpened: todayIso()}));}}
                        />
                    </View>
                )}
                {!form.isTool && (
                    <View style={styles.field}>
                        <Text style={styles.label}>Period After Opening (PAO), in months {form.paoMonths ? '(from the jar symbol, if detected)' : ''}</Text>
                        <TextInput style={styles.input} placeholder="e.g. 12" keyboardType="numeric" value={form.paoMonths} onChangeText={(v) => setForm({...form, paoMonths: v})} />
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
                        <Text style={styles.saveBtnText}>Add to Beauty</Text>
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
    photoPreview: {width: 160, height: 160, borderRadius: radius.lg, alignSelf: 'center', marginBottom: 16, backgroundColor: colors.surfaceAlt},
    analyzingRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16},
    analyzingText: {fontSize: 12.5, color: colors.inkSoft},
    errorBox: {backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: 12, marginBottom: 16},
    errorText: {fontSize: 12.5, color: colors.danger, marginBottom: 6},
    retryText: {fontSize: 12.5, color: colors.accent, fontWeight: '700'},
    analysisCard: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12, marginBottom: 16},
    analysisTitle: {fontWeight: '700', fontSize: 13.5, color: colors.ink, marginBottom: 4},
    analysisNotes: {fontSize: 12.5, color: colors.inkSoft, lineHeight: 17},
    analysisHint: {fontSize: 11.5, color: colors.warnSub, fontStyle: 'italic', marginTop: 6},
    field: {marginBottom: 16},
    label: {fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.inkSoft, fontWeight: '700', marginBottom: 7},
    hint: {fontSize: 11.5, color: colors.inkMuted, marginTop: 6, lineHeight: 15},
    input: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.ink},
    segmented: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
    segBtn: {borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingVertical: 7, paddingHorizontal: 13, borderRadius: radius.pill},
    segBtnActive: {backgroundColor: colors.ink, borderColor: colors.ink},
    segText: {fontSize: 12.5, fontWeight: '500', color: colors.ink},
    segTextActive: {color: colors.bg},
    routinePill: {flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 13},
    routinePillActive: {backgroundColor: colors.accent, borderColor: colors.accent},
    routinePillText: {fontSize: 12.5, color: colors.inkSoft, fontWeight: '500'},
    routinePillTextActive: {color: colors.onAccent, fontWeight: '700'},
    customRoutineRow: {flexDirection: 'row', gap: 8, marginTop: 8},
    customRoutineInput: {flex: 1},
    customRoutineBtn: {backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: 16, justifyContent: 'center'},
    customRoutineBtnText: {fontSize: 12.5, fontWeight: '700', color: colors.ink},
    saveBtn: {backgroundColor: colors.accent, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', marginTop: 8},
    saveBtnDisabled: {opacity: 0.6},
    saveBtnSuccess: {backgroundColor: colors.success, opacity: 1},
    saveBtnRow: {flexDirection: 'row', alignItems: 'center', gap: 7},
    saveBtnText: {color: colors.onAccent, fontWeight: '700', fontSize: 14.5},
});