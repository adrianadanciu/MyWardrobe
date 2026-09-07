import React, {useState, useEffect, useMemo} from 'react';
import {View, Text, ScrollView, Pressable, Image, ActivityIndicator, Alert, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {Camera, ImagePlus, Check, X} from 'lucide-react-native';
import {SEASON_ORDER, SEASON} from '../constants/ColorSeasons';
import {loadProfile, saveProfile} from '../services/Storage';
import {analyzeUserPalette} from '../services/PhotoAnalysis';
import {useTheme} from '../theme/ThemeContext';
import {radius, getShadow} from '../theme/tokens';
export default function Palette({navigation}) {
    const {colors, resolvedScheme} = useTheme();
    const styles = useMemo(() => getStyles(colors, resolvedScheme), [colors, resolvedScheme]);
    const [season, setSeason] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [photo, setPhoto] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState(null);
    const [suggestion, setSuggestion] = useState(null);
    useEffect(() => {
        (async () => {
            const profile = await loadProfile();
            setSeason(profile.season || null);
            setLoaded(true);
        })();
    }, []);
    const persist = async (next) => {
        setSeason(next);
        try {
            const current = await loadProfile();
            await saveProfile({...current, season: next});
        } catch (e) {
            Alert.alert('Could not save', "Your palette choice didn't get saved. Please try again.");
        }
    };
    const pickFrom = async (source) => {
        try {
            const permission = source === 'camera'
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission needed', "Without access I can't open the camera or gallery.");
                return;
            }
            const options = {mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true};
            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync(options)
                : await ImagePicker.launchImageLibraryAsync(options);
            if (result.canceled) return;
            const asset = result.assets[0];
            setPhoto({uri: asset.uri});
            setSuggestion(null);
            setAnalysisError(null);
            setAnalyzing(true);
            try {
                const result2 = await analyzeUserPalette({base64: asset.base64, mediaType: 'image/jpeg'});
                if (!result2.season) throw new Error("Couldn't confidently tell from this photo. Try a well-lit, makeup-free selfie, or pick manually below.");
                setSuggestion(result2);
            } catch (e) {
                setAnalysisError(e.message || 'The analysis failed.');
            } finally {
                setAnalyzing(false);
            }
        } catch (e) {
            Alert.alert('Error', String(e.message || e));
        }
    };
    if (!loaded) {
        return (
            <SafeAreaView style={styles.center}>
                <ActivityIndicator color={colors.accent} />
            </SafeAreaView>
        );
    }
    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <Text style={styles.sectionTitle}>Not sure? Analyze a photo</Text>
                {photo && (
                    <Image source={{uri: photo.uri}} style={styles.photoPreview} />
                )}
                <View style={styles.photoPickRow}>
                    <Pressable style={styles.photoPickBtn} onPress={() => pickFrom('camera')}>
                        <Camera size={20} color={colors.bg} />
                        <Text style={styles.photoPickText}>Take a photo</Text>
                    </Pressable>
                    <Pressable style={[styles.photoPickBtn, styles.photoPickBtnAlt]} onPress={() => pickFrom('library')}>
                        <ImagePlus size={20} color={colors.ink} />
                        <Text style={[styles.photoPickText, {color: colors.ink}]}>From gallery</Text>
                    </Pressable>
                </View>
                {analyzing && (
                    <View style={styles.analyzingRow}>
                        <ActivityIndicator color={colors.accent} />
                        <Text style={styles.analyzingText}>Analyzing your coloring…</Text>
                    </View>
                )}
                {analysisError && <Text style={styles.errorText}>{analysisError}</Text>}
                {suggestion && (
                    <View style={styles.suggestionCard}>
                        <Text style={styles.suggestionTitle}>We think you're: {SEASON[suggestion.season].label}</Text>
                        {suggestion.confidence && <Text style={styles.suggestionConfidence}>{suggestion.confidence} confidence</Text>}
                        {!!suggestion.notes && <Text style={styles.suggestionNotes}>{suggestion.notes}</Text>}
                        <View style={styles.suggestionSwatchRow}>
                            {SEASON[suggestion.season].swatches.map((hex) => (
                                <View key={hex} style={[styles.suggestionSwatch, {backgroundColor: hex}]} />
                            ))}
                        </View>
                        <Pressable style={styles.useSuggestionBtn} onPress={() => persist(suggestion.season)}>
                            <Check size={15} color={colors.onSuccess} />
                            <Text style={styles.useSuggestionText}>Use this palette</Text>
                        </Pressable>
                    </View>
                )}
                <Text style={[styles.sectionTitle, {marginTop: 26}]}>Or choose manually</Text>
                <View style={styles.grid}>
                    {SEASON_ORDER.map((id) => {
                        const seasonInfo = SEASON[id];
                        const selected = season === id;
                        return (
                            <Pressable key={id} style={[styles.card, selected && styles.cardSelected]} onPress={() => persist(id)}>
                                {selected && (
                                    <View style={styles.selectedBadge}>
                                        <Check size={11} color={colors.onAccent} />
                                    </View>
                                )}
                                <Text style={styles.cardLabel}>{seasonInfo.label}</Text>
                                <Text style={styles.cardGroup}>{seasonInfo.group}</Text>
                                <View style={styles.cardSwatchRow}>
                                    {seasonInfo.swatches.map((hex) => (
                                        <View key={hex} style={[styles.cardSwatch, {backgroundColor: hex}]} />
                                    ))}
                                </View>
                            </Pressable>
                        );
                    })}
                </View>
                {season && (
                    <Pressable style={styles.clearBtn} onPress={() => persist(null)}>
                        <X size={13} color={colors.inkSoft} />
                        <Text style={styles.clearText}>Don't use a palette</Text>
                    </Pressable>
                )}
                <Pressable style={styles.doneBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.doneBtnText}>Done</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}
const getStyles = (colors, scheme) => StyleSheet.create({
    safe: {flex: 1, backgroundColor: colors.bg},
    center: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg},
    scroll: {padding: 16, paddingBottom: 50},
    intro: {fontSize: 13, color: colors.inkSoft, marginBottom: 22, lineHeight: 18},
    sectionTitle: {fontSize: 13, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.ink, marginBottom: 4},
    sectionSub: {fontSize: 12, color: colors.inkSoft, marginBottom: 12},
    photoPreview: {width: 140, height: 140, borderRadius: 70, alignSelf: 'center', marginBottom: 14, backgroundColor: colors.surfaceAlt},
    photoPickRow: {flexDirection: 'row', gap: 10, marginBottom: 8},
    photoPickBtn: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.ink, paddingVertical: 14, borderRadius: radius.md},
    photoPickBtnAlt: {backgroundColor: colors.surfaceAlt},
    photoPickText: {color: colors.bg, fontWeight: '700', fontSize: 13},
    analyzingRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12},
    analyzingText: {fontSize: 12.5, color: colors.inkSoft},
    errorText: {fontSize: 12.5, color: colors.danger, marginTop: 12},
    suggestionCard: {borderWidth: 1.5, borderColor: colors.accent, borderRadius: radius.lg, padding: 14, marginTop: 14, backgroundColor: colors.surface},
    suggestionTitle: {fontWeight: '700', fontSize: 15, color: colors.ink},
    suggestionConfidence: {fontSize: 11, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2},
    suggestionNotes: {fontSize: 12.5, color: colors.inkSoft, marginTop: 6},
    suggestionSwatchRow: {flexDirection: 'row', gap: 8, marginTop: 10},
    suggestionSwatch: {width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)'},
    useSuggestionBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: 10, marginTop: 12},
    useSuggestionText: {color: colors.onSuccess, fontWeight: '700', fontSize: 13},
    grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
    card: {flexBasis: '47%', backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.lg, padding: 12, ...getShadow(scheme).card},
    cardSelected: {borderColor: colors.accent},
    selectedBadge: {position: 'absolute', top: 10, right: 10, backgroundColor: colors.accent, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
    cardLabel: {fontWeight: '700', fontSize: 13.5, color: colors.ink},
    cardGroup: {fontSize: 10.5, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8},
    cardSwatchRow: {flexDirection: 'row', gap: 5},
    cardSwatch: {width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)'},
    clearBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 18},
    clearText: {fontSize: 12.5, color: colors.inkSoft, textDecorationLine: 'underline'},
    doneBtn: {backgroundColor: colors.ink, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', marginTop: 22},
    doneBtnText: {color: colors.bg, fontWeight: '700', fontSize: 14.5},
});
