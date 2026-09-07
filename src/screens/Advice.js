import React, {useState, useMemo} from 'react';
//Linking is the API which opens links outside the app
import {View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, Alert, Linking, StyleSheet, KeyboardAvoidingView, Platform} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Sparkles, ShoppingBag, ExternalLink} from 'lucide-react-native';
import {CATEGORY} from '../constants/Wardrobe';
import {getStyleAdvice} from '../services/StyleAdvisor';
import {useTheme} from '../theme/ThemeContext';
import {radius} from '../theme/tokens';
//function is used for local functions, used just in this file
//export is used when the function is used in other files: default is used for only one function per file
function shopSearchUrl({colorName, fit, type, category, categoryLabel}) {
    const query = [colorName, fit, type || categoryLabel || category].filter(Boolean).join(' ');
    return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
}
export default function Advice({route, navigation}) {
    const {colors} = useTheme();
    const styles = useMemo(() => getStyles(colors), [colors]);
    const initialRequest = route?.params?.initialRequest || '';
    const items = route?.params?.items || [];
    const temp = route?.params?.temp ?? 18;
    const season = route?.params?.season ?? null;
    const bodyShape = route?.params?.bodyShape ?? null;
    const occasion = route?.params?.occasion ?? null;
    const skipExisting = route?.params?.skipExisting || false;
    const [requestText, setRequestText] = useState(initialRequest);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const handleAsk = async () => {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const advice = await getStyleAdvice({requestText, items, temp, season, bodyShape, occasion, skipExisting});
            setResult(advice);
        } catch (e) {
            setError(e.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };
    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{flex: 1}}
            >
            <ScrollView contentContainerStyle={styles.scroll}>
                <Text style={styles.intro}>
                    Describe what you need and the app will either pick from your wardrobe, either suggest what to shop for if nothing quite fits.
                </Text>
                <TextInput
                    style={styles.input}
                    multiline
                    placeholder="e.g. something to go to the store"
                    placeholderTextColor={colors.inkMuted}
                    value={requestText}
                    onChangeText={setRequestText}
                />
                <Pressable style={[styles.askBtn, loading && styles.askBtnDisabled]} onPress={handleAsk} disabled={loading}>
                    {loading ? <ActivityIndicator color={colors.onAccent} /> : (
                        <View style={styles.askBtnRow}>
                            <Sparkles size={16} color={colors.onAccent} />
                            <Text style={styles.askBtnText}>Get suggestions</Text>
                        </View>
                    )}
                </Pressable>
                {error && <Text style={styles.errorText}>{error}</Text>}
                {result && (
                    <View style={styles.resultsWrap}>
                        {!!result.summary && <Text style={styles.summary}>{result.summary}</Text>}

                        {result.useExisting.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>From your wardrobe</Text>
                                {result.useExisting.map(({item, reason}) => (
                                    <View key={item.id} style={styles.existingRow}>
                                        <View style={[styles.swatch, {backgroundColor: item.colorHex}]} />
                                        <View style={{flex: 1}}>
                                            <Text style={styles.existingName}>{item.name}</Text>
                                            {!!reason && <Text style={styles.existingReason}>{reason}</Text>}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                        {result.shoppingSuggestions.length > 0 && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeaderRow}>
                                    <ShoppingBag size={14} color={colors.ink} />
                                    <Text style={styles.sectionTitle}>Consider adding to your wardrobe</Text>
                                </View>
                                {result.shoppingSuggestions.map((s, idx) => (
                                    <View key={idx} style={styles.suggestionCard}>
                                        <View style={[styles.swatch, {backgroundColor: s.colorHex}]} />
                                        <View style={{flex: 1}}>
                                            <Text style={styles.suggestionTitle}>
                                                {s.colorName ? `${s.colorName} ` : ''}{s.type || CATEGORY[s.category]?.label || s.category}
                                            </Text>
                                            <Text style={styles.suggestionSub}>
                                                {CATEGORY[s.category]?.label || s.category}{s.fit ? ` · ${s.fit}` : ''}
                                            </Text>
                                            {!!s.reason && <Text style={styles.existingReason}>{s.reason}</Text>}
                                            <Pressable
                                                style={styles.shopLink}
                                                onPress={() => Linking.openURL(shopSearchUrl({colorName: s.colorName, fit: s.fit, type: s.type, category: s.category, categoryLabel: CATEGORY[s.category]?.label}))}
                                            >
                                                <ExternalLink size={11} color={colors.accent} />
                                                <Text style={styles.shopLinkText}>Shop this</Text>
                                            </Pressable>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                        {result.useExisting.length === 0 && result.shoppingSuggestions.length === 0 && (
                            <Text style={styles.emptyNote}>No specific picks this time. Try rephrasing your request.</Text>
                        )}
                    </View>
                )}
            </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
const getStyles = (colors) => StyleSheet.create({
    safe: {flex: 1, backgroundColor: colors.bg},
    scroll: {padding: 16, paddingBottom: 50},
    intro: {fontSize: 13, color: colors.inkSoft, marginBottom: 16, lineHeight: 18},
    input: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12, fontSize: 14, color: colors.ink, minHeight: 90, textAlignVertical: 'top', marginBottom: 12},
    askBtn: {backgroundColor: colors.accent, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center'},
    askBtnDisabled: {opacity: 0.6},
    askBtnRow: {flexDirection: 'row', alignItems: 'center', gap: 7},
    askBtnText: {color: colors.onAccent, fontWeight: '700', fontSize: 14},
    errorText: {fontSize: 12.5, color: colors.danger, marginTop: 14},
    resultsWrap: {marginTop: 20},
    summary: {fontSize: 14, color: colors.ink, lineHeight: 20, marginBottom: 18, fontStyle: 'italic'},
    section: {marginBottom: 20},
    sectionHeaderRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2},
    sectionTitle: {fontSize: 12.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', color: colors.ink, marginBottom: 8},
    shoppingDisclaimer: {fontSize: 11, color: colors.inkMuted, fontStyle: 'italic', marginBottom: 10},
    existingRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 11, marginBottom: 8},
    existingName: {fontWeight: '600', fontSize: 13.5, color: colors.ink},
    existingReason: {fontSize: 12, color: colors.inkSoft, marginTop: 2},
    suggestionCard: {flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 11, marginBottom: 8},
    suggestionTitle: {fontWeight: '700', fontSize: 13.5, color: colors.ink, textTransform: 'capitalize'},
    suggestionSub: {fontSize: 11.5, color: colors.inkMuted, marginTop: 1, textTransform: 'capitalize'},
    shopLink: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6},
    shopLinkText: {fontSize: 12, color: colors.accent, fontWeight: '700'},
    swatch: {width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)', marginTop: 1},
    emptyNote: {fontSize: 13, color: colors.inkSoft, textAlign: 'center'},
});
