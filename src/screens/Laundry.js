import React, {useState, useCallback, useMemo} from 'react';
import {View, Text, ScrollView, Pressable, Image, ActivityIndicator, Alert, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {Check} from 'lucide-react-native';
import {WASH_THRESHOLD} from '../constants/Wardrobe';
import {loadItems, saveItems} from '../services/Storage';
import {isWashable, isDirty, wearsUntilWash, markWashed, markDirty} from '../utils/Laundry';
import {useTheme} from '../theme/ThemeContext';
import {radius} from '../theme/tokens';
export default function Laundry() {
    const {colors} = useTheme();
    const styles = useMemo(() => getStyles(colors), [colors]);
    const [items, setItems] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const reload = useCallback(async () => {
        const all = await loadItems();
        setItems(all);
        setLoaded(true);
    }, []);
    useFocusEffect(useCallback(() => {reload();}, [reload]));
    const washable = useMemo(() => items.filter(isWashable), [items]);
    const dirty = useMemo(
        () => washable.filter(isDirty).sort((a, b) => (b.wearsSinceWash || 0) - (a.wearsSinceWash || 0)),
        [washable]
    );
    const clean = useMemo(
        () => washable.filter((i) => !isDirty(i)).sort((a, b) => wearsUntilWash(a) - wearsUntilWash(b)),
        [washable]
    );
    const applyItems = (next) => {
        setItems(next);
        saveItems(next).catch((e) => {
            console.warn('Could not save the wardrobe', e);
            Alert.alert('Could not save', "Your change didn't get saved. Please try again.");
        });
    };
    const handleMarkWashed = (id) => {
        applyItems(items.map((i) => (i.id === id ? markWashed(i) : i)));
    };
    const handleMarkDirty = (id) => {
        applyItems(items.map((i) => (i.id === id ? markDirty(i) : i)));
    };
    if (!loaded){
        return(
            <SafeAreaView style={styles.center}>
                <ActivityIndicator color={colors.accent} />
            </SafeAreaView>
        );
    }
    return(
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <Text style={styles.intro}>
                    Tracked automatically as you wear things: tops and dresses after 1 wear, pants and skirts after {WASH_THRESHOLD.pants},
                    outerwear after {WASH_THRESHOLD.outerwear}. Mark anything dirty or clean by hand any time. Shoes,
                    accessories, jewelry and bags aren't tracked here. Items waiting to be washed are left out of outfit suggestions.
                </Text>
                <Text style={styles.sectionTitle}>Needs washing ({dirty.length})</Text>
                {dirty.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>Nothing in the basket right now.</Text>
                    </View>
                ) : (
                    dirty.map((item) => {
                        const threshold = WASH_THRESHOLD[item.category] ?? 1;
                        const handFlagged = item.dirty && (item.wearsSinceWash || 0) < threshold;
                        return (
                            <View key={item.id} style={styles.row}>
                                {item.photoUri ? (
                                    <Image source={{uri: item.photoUri}} style={styles.thumb} />
                                ) : (
                                    <View style={[styles.thumb, {backgroundColor: item.colorHex}]} />
                                )}
                                <View style={{flex: 1}}>
                                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                                    <Text style={styles.itemSub}>{handFlagged ? 'marked by hand' : `worn ${item.wearsSinceWash || 0}x since last wash`}</Text>
                                </View>
                                <Pressable style={styles.washBtn} onPress={() => handleMarkWashed(item.id)}>
                                    <Check size={14} color={colors.onAccent} />
                                    <Text style={styles.washBtnText}>Washed</Text>
                                </Pressable>
                            </View>
                        );
                    })
                )}
                <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Clean ({clean.length})</Text>
                {clean.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No washable items yet. Add some tops, dresses, bottoms, or outerwear.</Text>
                    </View>
                ) : (
                    clean.map((item) => {
                        const left = wearsUntilWash(item);
                        return (
                            <View key={item.id} style={styles.row}>
                                {item.photoUri ? (
                                    <Image source={{uri: item.photoUri}} style={styles.thumb} />
                                ) : (
                                    <View style={[styles.thumb, {backgroundColor: item.colorHex}]} />
                                )}
                                <View style={{flex: 1}}>
                                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                                    <Text style={styles.itemSub}>{left === 0 ? 'due for a wash' : `${left} more wear${left === 1 ? '' : 's'} until due`}</Text>
                                </View>
                                <Pressable onPress={() => handleMarkDirty(item.id)} hitSlop={8}>
                                    <Text style={styles.dirtyLink}>mark dirty</Text>
                                </Pressable>
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
const getStyles = (colors) => StyleSheet.create({
    safe: {flex: 1, backgroundColor: colors.bg},
    center: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg},
    scroll: {padding: 16, paddingBottom: 50},
    intro: {fontSize: 12, color: colors.inkSoft, marginBottom: 18, lineHeight: 17},
    sectionTitle: {fontSize: 12.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', color: colors.ink, marginBottom: 10},
    sectionTitleSpaced: {marginTop: 22},
    empty: {alignItems: 'center', padding: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed', borderRadius: radius.lg, marginBottom: 6},
    emptyText: {fontSize: 12.5, color: colors.inkSoft, textAlign: 'center'},
    row: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 10, marginBottom: 8},
    thumb: {width: 42, height: 42, borderRadius: radius.sm},
    itemName: {fontWeight: '600', fontSize: 13.5, color: colors.ink},
    itemSub: {fontSize: 11, color: colors.inkSoft, marginTop: 2},
    washBtn: {flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 12},
    washBtnText: {fontSize: 11.5, fontWeight: '700', color: colors.onAccent},
    dirtyLink: {fontSize: 11.5, color: colors.accent, fontWeight: '600', textDecorationLine: 'underline'},
});
