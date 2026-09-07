import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {View, Text, ScrollView, Pressable, ActivityIndicator, Alert, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {Plus} from 'lucide-react-native';
import {BEAUTY_CATEGORY} from '../constants/Beauty';
import {todayIso} from '../utils/Dates';
import {loadBeautyItems, saveBeautyItems} from '../services/Storage';
import {deletePhoto} from '../services/PhotoStorage';
import {useTheme} from '../theme/ThemeContext';
import BeautyRow from '../components/BeautyRow';
import {radius} from '../theme/tokens';
//shows one category's products at a time, "retired" isn't a real category, it's the "no longer using" pile that spans every category
export default function BeautyCategory({route, navigation}) {
    const {colors} = useTheme();
    const styles = useMemo(() => getStyles(colors), [colors]);
    const category = route?.params?.category;
    const isRetired = category === 'retired';
    const categoryLabel = isRetired ? 'No longer using' : (BEAUTY_CATEGORY[category]?.label || 'Products');
    const [items, setItems] = useState([]);
    const [loaded, setLoaded] = useState(false);
    //App.js can't know the category ahead of time, so the header title gets set here once it's known
    useEffect(() => {
        navigation.setOptions({title: categoryLabel});
    }, [navigation, categoryLabel]);
    const reload = useCallback(async () => {
        const stored = await loadBeautyItems();
        setItems(stored);
        setLoaded(true);
    }, []);
    useFocusEffect(useCallback(() => {reload();}, [reload]));
    const applyItems = (next) => {
        setItems(next);
        saveBeautyItems(next).catch((e) => {
            console.warn('Could not save beauty products', e);
            Alert.alert('Could not save', "Your change didn't get saved. Please try again.");
        });
    };
    const markUsed = (id) => {
        applyItems(items.map((i) => (i.id === id
            ? {...i, lastUsed: todayIso(), useCount: (i.useCount || 0) + 1, dateOpened: i.dateOpened || todayIso()}
            : i)));
    };
    const toggleRetired = (id) => {
        applyItems(items.map((i) => (i.id === id ? {...i, retired: !i.retired} : i)));
    };
    const deleteItemById = (id) => {
        Alert.alert('Delete this product?', "This can't be undone.", [
            {text: 'Cancel', style: 'cancel'},
            {
                text: 'Delete', style: 'destructive', onPress: () => {
                    const target = items.find((i) => i.id === id);
                    if (target?.photoUri) deletePhoto(target.photoUri);
                    applyItems(items.filter((i) => i.id !== id));
                },
            },
        ]);
    };
    if (!loaded) {
        return (
            <SafeAreaView style={styles.center}>
                <ActivityIndicator color={colors.accent} />
            </SafeAreaView>
        );
    }
    const list = isRetired
        ? items.filter((i) => i.retired)
        : items.filter((i) => !i.retired && i.category === category);
    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.scroll}>
                {!isRetired && (
                    <View style={styles.topRow}>
                        <Text style={styles.stats}>{list.length} product{list.length === 1 ? '' : 's'}</Text>
                        <Pressable style={styles.addBtn} onPress={() => navigation.navigate('AddBeautyItem', {initialCategory: category})}>
                            <Plus size={18} color={colors.bg} />
                        </Pressable>
                    </View>
                )}
                {list.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>
                            {isRetired ? "Nothing here yet." : `No ${categoryLabel.toLowerCase()} products yet.`}
                        </Text>
                        {!isRetired && (
                            <Pressable style={styles.emptyBtn} onPress={() => navigation.navigate('AddBeautyItem', {initialCategory: category})}>
                                <Text style={styles.emptyBtnText}>+ Add your first one</Text>
                            </Pressable>
                        )}
                    </View>
                ) : (
                    list.map((item) => (
                        <BeautyRow
                            key={item.id}
                            item={item}
                            onPress={() => navigation.navigate('EditBeautyItem', {item})}
                            onMarkUsed={markUsed}
                            onRetire={toggleRetired}
                            onDelete={deleteItemById}
                            retiredView={isRetired}
                        />
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
const getStyles = (colors) => StyleSheet.create({
    safe: {flex: 1, backgroundColor: colors.bg},
    center: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg},
    scroll: {padding: 16, paddingBottom: 50},
    topRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14},
    stats: {fontSize: 13, color: colors.inkSoft, fontWeight: '500'},
    addBtn: {backgroundColor: colors.ink, width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center'},
    empty: {alignItems: 'center', padding: 36, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed', borderRadius: radius.lg, marginBottom: 10},
    emptyText: {fontSize: 13.5, color: colors.inkSoft, textAlign: 'center', marginBottom: 14},
    emptyBtn: {backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 11, borderRadius: radius.md},
    emptyBtnText: {color: colors.onAccent, fontWeight: '700', fontSize: 13},
});
