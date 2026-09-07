import React, {useState, useEffect, useMemo} from 'react';
import {View, Text, ScrollView, TextInput, Pressable, Alert, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {Check, X, Ruler, Camera, ImagePlus} from 'lucide-react-native';
import {BODY_SHAPE_ORDER, BODY_SHAPE, SHOULDER_VS_HIPS_ORDER, SHOULDER_VS_HIPS, computeBodyShape} from '../constants/BodyShapes';
import {loadProfile, saveProfile} from '../services/Storage';
import {analyzeBodyMeasurements} from '../services/PhotoAnalysis';
import {useTheme} from '../theme/ThemeContext';
import {radius, getShadow} from '../theme/tokens';
const UNITS = ['cm', 'in'];
const toCm = (v, unit) => (unit === 'in' ? v * 2.54 : v);
export default function BodyShape({navigation}) {
    const {colors, resolvedScheme} = useTheme();
    const styles = useMemo(() => getStyles(colors, resolvedScheme), [colors, resolvedScheme]);
    //the algorithm creates a variable bodyShape which can be changed with the function setBodyShape
    const [bodyShape, setBodyShape] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [unit, setUnit] = useState('cm');
    const [measurements, setMeasurements] = useState({bust: '', waist: '', hip: ''});
    const [shoulderVsHips, setShoulderVsHips] = useState(null);
    const [computed, setComputed] = useState(null);
    const [estimating, setEstimating] = useState(false);
    const [estimateNote, setEstimateNote] = useState(null);
    useEffect(() => {
        (async () => {
            const profile = await loadProfile();
            setBodyShape(profile.bodyShape || null);
            setShoulderVsHips(profile.shoulderVsHips || null);
            if (profile.bustCm || profile.waistCm || profile.hipsCm) {
                setMeasurements({
                    bust: profile.bustCm ? String(profile.bustCm) : '',
                    waist: profile.waistCm ? String(profile.waistCm) : '',
                    hip: profile.hipsCm ? String(profile.hipsCm) : '',
                });
            }
            setLoaded(true);
        })();
    }, []);
    const persistMeasurementsCm = async (bust, waist, hip, sourceUnit) => {
        try{
            const current = await loadProfile();
            await saveProfile({
                ...current,
                bustCm: Math.round(toCm(bust, sourceUnit)),
                waistCm: Math.round(toCm(waist, sourceUnit)),
                hipsCm: Math.round(toCm(hip, sourceUnit)),
            });
        } 
        catch (e){
        }
    };
    const persistShoulderVsHips = async (next) => {
        setShoulderVsHips(next);
        try{
            const current = await loadProfile();
            await saveProfile({...current, shoulderVsHips: next});
        } 
        catch (e){
        }
    };

    const pickForEstimate = async (source) => {
        try{
            const permission = source === 'camera'
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission needed', "Without access I can't open the camera or gallery.");
                return;
            }
            const options = {mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 0.7, base64: true};
            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync(options)
                : await ImagePicker.launchImageLibraryAsync(options);
            if (result.canceled) return;
            setEstimating(true);
            setEstimateNote(null);
            try {
                const est = await analyzeBodyMeasurements({base64: result.assets[0].base64, mediaType: 'image/jpeg'});
                if (!est.bustCm && !est.waistCm && !est.hipsCm) {
                    Alert.alert("Couldn't estimate", "The photo didn't give enough to estimate from. Try a clearer, front-facing, full-length photo.");
                    return;
                }
                setUnit('cm');
                setMeasurements({
                    bust: est.bustCm ? String(est.bustCm) : measurements.bust,
                    waist: est.waistCm ? String(est.waistCm) : measurements.waist,
                    hip: est.hipsCm ? String(est.hipsCm) : measurements.hip,
                });
                if (est.shoulderWidthGuess) persistShoulderVsHips(est.shoulderWidthGuess);
                setEstimateNote(`AI estimate, ${est.confidence || 'unknown'} confidence${est.notes ? `: ${est.notes}` : ''}. This is a rough guess from one photo, not a real measurement. Adjust any number below before calculating.`);
            } 
            catch (e){
                Alert.alert('Estimate failed', e.message || 'Something went wrong.');
            } 
            finally{
                setEstimating(false);
            }
        } 
        catch (e){
            Alert.alert('Error', String(e.message || e));
        }
    };
    const persist = async (next) => {
        setBodyShape(next);
        try{
            const current = await loadProfile();
            await saveProfile({...current, bodyShape: next});
        } 
        catch (e){
            Alert.alert('Could not save', "Your body shape choice didn't get saved. Please try again.");
        }
    };
    const handleCompute = () => {
        const bust = parseFloat(measurements.bust);
        const waist = parseFloat(measurements.waist);
        const hip = parseFloat(measurements.hip);
        if (!bust || !waist || !hip) {
            Alert.alert('Missing a measurement', 'Fill in all three measurements to calculate your shape.');
            return;
        }
        const result = computeBodyShape({bust, waist, hip, shoulderVsHips, unit});
        setComputed(result);
        persistMeasurementsCm(bust, waist, hip, unit);
    };
    if (!loaded) return <SafeAreaView style={styles.safe} />;
    const currentShape = bodyShape ? BODY_SHAPE[bodyShape] : null;
    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{flex: 1}}
            >
            <ScrollView contentContainerStyle={styles.scroll}>
                <Text style={styles.intro}>
                    Set your body shape to help improve outfit suggestions.
                </Text>
                {currentShape && (
                    <View style={styles.currentCard}>
                        <Text style={styles.currentLabel}>Currently set: {currentShape.label}</Text>
                        <Text style={styles.currentTips}>{currentShape.guidance}</Text>
                    </View>
                )}
                <Text style={styles.sectionTitle}>Calculate from measurements</Text>
                <Text style={styles.sectionSub}>Bust/chest, waist and hip: type them in, or estimate from a photo below.</Text>
                <View style={styles.estimateRow}>
                    <Pressable style={[styles.estimateBtn, {flex: 1.2}]} onPress={() => pickForEstimate('camera')} disabled={estimating}>
                        <Camera size={14} color={colors.bg} />
                        <Text style={styles.estimateBtnText}>Estimate from a photo</Text>
                    </Pressable>
                    <Pressable style={[styles.estimateBtn, styles.estimateBtnAlt, {flex: 1}]} onPress={() => pickForEstimate('library')} disabled={estimating}>
                        <ImagePlus size={14} color={colors.ink} />
                        <Text style={[styles.estimateBtnText, {color: colors.ink}]}>From gallery</Text>
                    </Pressable>
                </View>
                {estimating && (
                    <View style={styles.estimatingRow}>
                        <ActivityIndicator color={colors.ink} />
                        <Text style={styles.estimatingText}>Estimating from your photo…</Text>
                    </View>
                )}
                {estimateNote && <Text style={styles.estimateNote}>{estimateNote}</Text>}
                <View style={styles.unitRow}>
                    {UNITS.map((u) => (
                        <Pressable key={u} style={[styles.unitBtn, unit === u && styles.unitBtnActive]} onPress={() => setUnit(u)}>
                            <Text style={[styles.unitText, unit === u && styles.unitTextActive]}>{u}</Text>
                        </Pressable>
                    ))}
                </View>
                <View style={styles.measureRow}>
                    <View style={styles.measureField}>
                        <Text style={styles.measureLabel}>Bust/Chest</Text>
                        <TextInput
                            style={styles.measureInput}
                            keyboardType="numeric"
                            placeholder={unit}
                            value={measurements.bust}
                            onChangeText={(v) => setMeasurements({...measurements, bust: v})}
                        />
                    </View>
                    <View style={styles.measureField}>
                        <Text style={styles.measureLabel}>Waist</Text>
                        <TextInput
                            style={styles.measureInput}
                            keyboardType="numeric"
                            placeholder={unit}
                            value={measurements.waist}
                            onChangeText={(v) => setMeasurements({...measurements, waist: v})}
                        />
                    </View>
                    <View style={styles.measureField}>
                        <Text style={styles.measureLabel}>Hip</Text>
                        <TextInput
                            style={styles.measureInput}
                            keyboardType="numeric"
                            placeholder={unit}
                            value={measurements.hip}
                            onChangeText={(v) => setMeasurements({...measurements, hip: v})}
                        />
                    </View>
                </View>
                <Text style={styles.measureLabel}>Shoulders, compared to your hips (optional)</Text>
                <Text style={styles.sectionSub}>Only needed to tell an Apple shape apart from a Diamond one.</Text>
                <View style={styles.shoulderRow}>
                    {SHOULDER_VS_HIPS_ORDER.map((key) => (
                        <Pressable key={key} style={[styles.shoulderChip, shoulderVsHips === key && styles.shoulderChipActive]} onPress={() => persistShoulderVsHips(shoulderVsHips === key ? null : key)}>
                            <Text style={[styles.shoulderChipText, shoulderVsHips === key && styles.shoulderChipTextActive]}>{SHOULDER_VS_HIPS[key]}</Text>
                        </Pressable>
                    ))}
                </View>
                <Pressable style={styles.calcBtn} onPress={handleCompute}>
                    <Ruler size={15} color={colors.bg} />
                    <Text style={styles.calcBtnText}>Calculate my shape</Text>
                </Pressable>
                {computed && (
                    <View style={styles.suggestionCard}>
                        <Text style={styles.suggestionTitle}>That works out to: {BODY_SHAPE[computed].label}</Text>
                        <Text style={styles.suggestionTips}>{BODY_SHAPE[computed].guidance}</Text>
                        <Pressable style={styles.useSuggestionBtn} onPress={() => persist(computed)}>
                            <Check size={15} color={colors.onSuccess} />
                            <Text style={styles.useSuggestionText}>Use this shape</Text>
                        </Pressable>
                    </View>
                )}
                <Text style={[styles.sectionTitle, {marginTop: 26}]}>Or choose directly</Text>
                <View style={styles.grid}>
                    {BODY_SHAPE_ORDER.map((id) => {
                        const shapeInfo = BODY_SHAPE[id];
                        const selected = bodyShape === id;
                        return (
                            <Pressable key={id} style={[styles.card, selected && styles.cardSelected]} onPress={() => persist(id)}>
                                {selected && (
                                    <View style={styles.selectedBadge}>
                                        <Check size={11} color={colors.onAccent} />
                                    </View>
                                )}
                                <Text style={styles.cardLabel}>{shapeInfo.label}</Text>
                                <Text style={styles.cardDesc}>{shapeInfo.description}</Text>
                            </Pressable>
                        );
                    })}
                </View>
                {bodyShape && (
                    <Pressable style={styles.clearBtn} onPress={() => persist(null)}>
                        <X size={13} color={colors.inkSoft} />
                        <Text style={styles.clearText}>Don't use a body shape</Text>
                    </Pressable>
                )}
                <Pressable style={styles.doneBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.doneBtnText}>Done</Text>
                </Pressable>
            </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
const getStyles = (colors, scheme) => StyleSheet.create({
    safe: {flex: 1, backgroundColor: colors.bg},
    scroll: {padding: 16, paddingBottom: 50},
    intro: {fontSize: 13, color: colors.inkSoft, marginBottom: 18, lineHeight: 18},
    currentCard: {backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.accent, borderRadius: radius.lg, padding: 13, marginBottom: 22},
    currentLabel: {fontWeight: '700', fontSize: 14, color: colors.ink, marginBottom: 4},
    currentTips: {fontSize: 12.5, color: colors.inkSoft, lineHeight: 17},
    sectionTitle: {fontSize: 13, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.ink, marginBottom: 4},
    sectionSub: {fontSize: 12, color: colors.inkSoft, marginBottom: 14},
    estimateRow: {flexDirection: 'row', gap: 10, marginBottom: 10},
    estimateBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.ink, paddingVertical: 11, paddingHorizontal: 4, borderRadius: radius.md},
    estimateBtnAlt: {backgroundColor: colors.surfaceAlt},
    estimateBtnText: {color: colors.bg, fontWeight: '700', fontSize: 11.5},
    estimatingRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10},
    estimatingText: {fontSize: 12, color: colors.inkSoft},
    estimateNote: {fontSize: 11, color: colors.inkMuted, fontStyle: 'italic', marginBottom: 14, lineHeight: 15},
    unitRow: {flexDirection: 'row', gap: 6, marginBottom: 14},
    unitBtn: {borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingVertical: 6, paddingHorizontal: 14, borderRadius: radius.pill},
    unitBtnActive: {backgroundColor: colors.ink, borderColor: colors.ink},
    unitText: {fontSize: 12.5, fontWeight: '600', color: colors.ink},
    unitTextActive: {color: colors.bg},
    measureRow: {flexDirection: 'row', gap: 10, marginBottom: 14},
    measureField: {flex: 1},
    measureLabel: {fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, color: colors.inkSoft, fontWeight: '700', marginBottom: 6},
    measureInput: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, color: colors.ink, textAlign: 'center'},
    shoulderRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18},
    shoulderChip: {borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill},
    shoulderChipActive: {backgroundColor: colors.ink, borderColor: colors.ink},
    shoulderChipText: {fontSize: 12, fontWeight: '600', color: colors.ink},
    shoulderChipTextActive: {color: colors.bg},
    calcBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.ink, paddingVertical: 13, borderRadius: radius.md},
    calcBtnText: {color: colors.bg, fontWeight: '700', fontSize: 13.5},
    suggestionCard: {borderWidth: 1.5, borderColor: colors.accent, borderRadius: radius.lg, padding: 14, marginTop: 14, backgroundColor: colors.surface},
    suggestionTitle: {fontWeight: '700', fontSize: 15, color: colors.ink, marginBottom: 6},
    suggestionTips: {fontSize: 12.5, color: colors.inkSoft, lineHeight: 17},
    useSuggestionBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: 10, marginTop: 12},
    useSuggestionText: {color: colors.onSuccess, fontWeight: '700', fontSize: 13},
    grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
    card: {flexBasis: '47%', backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.lg, padding: 12, ...getShadow(scheme).card},
    cardSelected: {borderColor: colors.accent},
    selectedBadge: {position: 'absolute', top: 10, right: 10, backgroundColor: colors.accent, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
    cardLabel: {fontWeight: '700', fontSize: 13.5, color: colors.ink, marginBottom: 4},
    cardDesc: {fontSize: 11.5, color: colors.inkSoft, lineHeight: 15},
    clearBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 18},
    clearText: {fontSize: 12.5, color: colors.inkSoft, textDecorationLine: 'underline'},
    doneBtn: {backgroundColor: colors.ink, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', marginTop: 22},
    doneBtnText: {color: colors.bg, fontWeight: '700', fontSize: 14.5},
});
