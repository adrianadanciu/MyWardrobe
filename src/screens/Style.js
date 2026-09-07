import React, {useState, useEffect, useMemo} from 'react';
import {View, Text, ScrollView, Pressable, Alert, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Check, X} from 'lucide-react-native';
import {STYLE_ORDER, STYLE} from '../constants/Styles';
import {loadProfile, saveProfile} from '../services/Storage';
import {useTheme} from '../theme/ThemeContext';
import {radius, getShadow} from '../theme/tokens';
export default function Style({navigation}) {
    const {colors, resolvedScheme} = useTheme();
    const styles = useMemo(() => getStyles(colors, resolvedScheme), [colors, resolvedScheme]);
    const [personalStyle, setPersonalStyle] = useState([]);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        (async () => {
            const profile = await loadProfile();
            setPersonalStyle(profile.personalStyle || []);
            setLoaded(true);
        })();
    }, []);
    const persist = async (next) => {
        setPersonalStyle(next);
        try{
            const current = await loadProfile();
            await saveProfile({...current, personalStyle: next});
        } 
        catch (e){
            Alert.alert('Could not save', "Your style choice didn't get saved. Please try again.");
        }
    };
    const toggleStyle = (id) => {
        persist(personalStyle.includes(id) ? personalStyle.filter((s) => s !== id) : [...personalStyle, id]);
    };
    if (!loaded) 
        return <SafeAreaView style={styles.safe} />;
    return(
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.scroll}>
                {personalStyle.length > 0 && (
                    <View style={styles.currentCard}>
                        <Text style={styles.currentLabel}>Currently set: {personalStyle.map((id) => STYLE[id].label).join(', ')}</Text>
                    </View>
                )}
                <Text style={styles.sectionTitle}>Choose your style</Text>
                <View style={styles.grid}>
                    {STYLE_ORDER.map((id) => {
                        const styleInfo = STYLE[id];
                        const selected = personalStyle.includes(id);
                        return (
                            <Pressable key={id} style={[styles.card, selected && styles.cardSelected]} onPress={() => toggleStyle(id)}>
                                {selected && (
                                    <View style={styles.selectedBadge}>
                                        <Check size={11} color={colors.onAccent} />
                                    </View>
                                )}
                                <Text style={styles.cardLabel}>{styleInfo.label}</Text>
                            </Pressable>
                        );
                    })}
                </View>
                {personalStyle.length > 0 && (
                    <Pressable style={styles.clearBtn} onPress={() => persist([])}>
                        <X size={13} color={colors.inkSoft} />
                        <Text style={styles.clearText}>Don't use a style preference</Text>
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
    scroll: {padding: 16, paddingBottom: 50},
    intro: {fontSize: 13, color: colors.inkSoft, marginBottom: 18, lineHeight: 18},
    currentCard: {backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.accent, borderRadius: radius.lg, padding: 13, marginBottom: 22},
    currentLabel: {fontWeight: '700', fontSize: 14, color: colors.ink, marginBottom: 4},
    currentTips: {fontSize: 12.5, color: colors.inkSoft, lineHeight: 17},
    sectionTitle: {fontSize: 13, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.ink, marginBottom: 4},
    sectionSub: {fontSize: 12, color: colors.inkSoft, marginBottom: 14},
    grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
    card: {flexBasis: '47%', backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.lg, padding: 12, ...getShadow(scheme).card},
    cardSelected: {borderColor: colors.accent},
    selectedBadge: {position: 'absolute', top: 10, right: 10, backgroundColor: colors.accent, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
    cardLabel: {fontWeight: '700', fontSize: 13.5, color: colors.ink, marginBottom: 4},
    clearBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 18},
    clearText: {fontSize: 12.5, color: colors.inkSoft, textDecorationLine: 'underline'},
    doneBtn: {backgroundColor: colors.ink, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', marginTop: 22},
    doneBtnText: {color: colors.bg, fontWeight: '700', fontSize: 14.5},
});
