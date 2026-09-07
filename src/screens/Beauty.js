import React, {useState, useCallback, useMemo} from 'react';
//Modal has the same role as Alert, but can be designed to wish
import {View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Modal, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {Plus, Archive, TriangleAlert, ShoppingBag, X, ChevronRight} from 'lucide-react-native';
import {BEAUTY_CATEGORY, BEAUTY_CATEGORY_ORDER, LEVEL, expiryLabel, restockPending, needsRestock, isNeglectedProduct} from '../constants/Beauty';
import {todayIso} from '../utils/Dates';
import {loadBeautyItems, saveBeautyItems} from '../services/Storage';
import {deletePhoto} from '../services/PhotoStorage';
import {useTheme} from '../theme/ThemeContext';
import BeautyRow from '../components/BeautyRow';
import {radius} from '../theme/tokens';
export default function Beauty({navigation}) {
    const {colors} = useTheme();
    const styles = useMemo(() => getStyles(colors), [colors]);
    const [items, setItems] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [shoppingOpen, setShoppingOpen] = useState(false);
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
    const confirmRestock = (id, wantsMore) => {
        applyItems(items.map((i) => (i.id === id
            ? {...i, restockConfirmed: wantsMore, retired: wantsMore ? i.retired : true}
            : i)));
    };
    const markRestocked = (id) => {
        applyItems(items.map((i) => (i.id === id
            ? {...i, level: 'full', dateOpened: null, lastUsed: null, restockConfirmed: null}
            : i)));
    };
    const deleteItemById = (id) => {
        Alert.alert('Delete this product?', "This can't be undone.", [
            //style is pre-defined by IOS/Android
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
    const active = items.filter((i) => !i.retired);
    const retired = items.filter((i) => i.retired);
    const pendingList = active.filter(restockPending);
    const restockList = active.filter(needsRestock);
    const neglectedList = active.filter((i) => isNeglectedProduct(i));
    const counts = {};
    BEAUTY_CATEGORY_ORDER.forEach((c) => {counts[c] = active.filter((i) => i.category === c).length;});
    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.topRow}>
                    <Text style={styles.stats}>{active.length} product{active.length === 1 ? '' : 's'} in rotation</Text>
                    <View style={styles.topRowActions}>
                        <Pressable style={styles.iconBtn} onPress={() => setShoppingOpen(true)}>
                            <ShoppingBag size={17} color={colors.ink} />
                            {restockList.length > 0 && (
                                <View style={styles.iconBadge}>
                                    <Text style={styles.iconBadgeText}>{restockList.length}</Text>
                                </View>
                            )}
                        </Pressable>
                        <Pressable style={styles.addBtn} onPress={() => navigation.navigate('AddBeautyItem')}>
                            <Plus size={18} color={colors.bg} />
                        </Pressable>
                    </View>
                </View>
                {pendingList.length > 0 && (
                    <View style={styles.pendingCard}>
                        <View style={styles.restockHeaderRow}>
                            <TriangleAlert size={15} color={colors.warnText} />
                            <Text style={styles.pendingTitle}>Running low: restock these?</Text>
                        </View>
                        {pendingList.map((i) => (
                            <View key={i.id} style={styles.pendingRow}>
                                <Text style={styles.pendingName} numberOfLines={1}>{i.name}</Text>
                                <Text style={styles.pendingSub}>{expiryLabel(i) || LEVEL[i.level].label}</Text>
                                <View style={styles.pendingActions}>
                                    <Pressable style={styles.pendingBtnYes} onPress={() => confirmRestock(i.id, true)}>
                                        <Text style={styles.pendingBtnYesText}>Yes, restock</Text>
                                    </Pressable>
                                    <Pressable style={styles.pendingBtnNo} onPress={() => confirmRestock(i.id, false)}>
                                        <Text style={styles.pendingBtnNoText}>No, I'm done</Text>
                                    </Pressable>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
                {neglectedList.length > 0 && (
                    <View style={styles.neglectCard}>
                        <View style={styles.neglectHeaderRow}>
                            <Archive size={15} color={colors.warnSub} />
                            <Text style={styles.neglectTitle}>Haven't reached for these in a while ({neglectedList.length})</Text>
                        </View>
                        {neglectedList.map((item) => (
                            <BeautyRow
                                key={item.id}
                                item={item}
                                onPress={() => navigation.navigate('EditBeautyItem', {item})}
                                onMarkUsed={markUsed}
                                onRetire={toggleRetired}
                                onDelete={deleteItemById}
                            />
                        ))}
                    </View>
                )}
                {active.length === 0 && (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No products yet. Add your skincare, makeup, or haircare to start tracking expiry and restocks.</Text>
                        <Pressable style={styles.emptyBtn} onPress={() => navigation.navigate('AddBeautyItem')}>
                            <Text style={styles.emptyBtnText}>+ Add your first product</Text>
                        </Pressable>
                    </View>
                )}
                <Text style={styles.sectionTitle}>Categories</Text>
                {BEAUTY_CATEGORY_ORDER.map((cat) => (
                    <Pressable key={cat} style={styles.categoryRow} onPress={() => navigation.navigate('BeautyCategory', {category: cat})}>
                        <View style={{flex: 1}}>
                            <Text style={styles.categoryRowLabel}>{BEAUTY_CATEGORY[cat].label}</Text>
                            <Text style={styles.categoryRowSub}>{counts[cat]} product{counts[cat] === 1 ? '' : 's'}</Text>
                        </View>
                        <ChevronRight size={17} color={colors.inkMuted} />
                    </Pressable>
                ))}
                {retired.length > 0 && (
                    <Pressable style={styles.categoryRow} onPress={() => navigation.navigate('BeautyCategory', {category: 'retired'})}>
                        <View style={{flex: 1}}>
                            <Text style={styles.categoryRowLabel}>No longer using</Text>
                            <Text style={styles.categoryRowSub}>{retired.length} product{retired.length === 1 ? '' : 's'}</Text>
                        </View>
                        <ChevronRight size={17} color={colors.inkMuted} />
                    </Pressable>
                )}
            </ScrollView>
            <Modal visible={shoppingOpen} animationType="slide" transparent onRequestClose={() => setShoppingOpen(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Shopping list</Text>
                            <Pressable onPress={() => setShoppingOpen(false)} hitSlop={8}>
                                <X size={20} color={colors.ink} />
                            </Pressable>
                        </View>
                        <ScrollView style={styles.modalScroll}>
                            {restockList.length === 0 ? (
                                <Text style={styles.modalEmpty}>Nothing to buy right now.</Text>
                            ) : (
                                restockList.map((i) => (
                                    <Pressable key={i.id} style={styles.checkRow} onPress={() => markRestocked(i.id)}>
                                        <View style={styles.checkbox} />
                                        <View style={{flex: 1}}>
                                            <Text style={styles.checkName}>{i.name}</Text>
                                            <Text style={styles.checkSub}>{expiryLabel(i) || LEVEL[i.level].label}</Text>
                                        </View>
                                    </Pressable>
                                ))
                            )}
                        </ScrollView>
                        <Text style={styles.modalHint}>Tap an item once you've bought it and it'll reset as freshly opened.</Text>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
const getStyles = (colors) => StyleSheet.create({
    safe: {flex: 1, backgroundColor: colors.bg},
    center: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg},
    scroll: {padding: 16, paddingBottom: 50},
    topRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14},
    topRowActions: {flexDirection: 'row', alignItems: 'center', gap: 8},
    stats: {fontSize: 13, color: colors.inkSoft, fontWeight: '500'},
    addBtn: {backgroundColor: colors.ink, width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center'},
    iconBtn: {backgroundColor: colors.surfaceAlt, width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center'},
    iconBadge: {position: 'absolute', top: -4, right: -4, backgroundColor: colors.danger, minWidth: 17, height: 17, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3},
    iconBadgeText: {color: '#fff', fontSize: 10, fontWeight: '700'},
    pendingCard: {backgroundColor: colors.warnBg, borderWidth: 1, borderColor: colors.warnBorder, borderRadius: radius.lg, padding: 13, marginBottom: 18},
    restockHeaderRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6},
    pendingTitle: {fontWeight: '700', fontSize: 13.5, color: colors.warnText},
    pendingRow: {backgroundColor: colors.surface, borderRadius: radius.md, padding: 10, marginTop: 8},
    pendingName: {fontWeight: '600', fontSize: 13, color: colors.ink},
    pendingSub: {fontSize: 11, color: colors.inkSoft, marginTop: 1, marginBottom: 8},
    pendingActions: {flexDirection: 'row', gap: 8},
    pendingBtnYes: {flex: 1, backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: 8, alignItems: 'center'},
    pendingBtnYesText: {color: colors.onAccent, fontWeight: '700', fontSize: 12},
    pendingBtnNo: {flex: 1, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, borderRadius: radius.sm, paddingVertical: 8, alignItems: 'center'},
    pendingBtnNoText: {color: colors.inkSoft, fontWeight: '600', fontSize: 12},
    neglectCard: {backgroundColor: colors.warnBg, borderWidth: 1, borderColor: colors.warnBorder, borderRadius: radius.lg, padding: 13, marginBottom: 18},
    neglectHeaderRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6},
    neglectTitle: {fontWeight: '700', fontSize: 13.5, color: colors.warnText},
    modalOverlay: {flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end'},
    modalSheet: {backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '75%'},
    modalHeaderRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14},
    modalTitle: {fontSize: 17, fontWeight: '800', color: colors.ink},
    modalScroll: {maxHeight: 420},
    modalEmpty: {fontSize: 13.5, color: colors.inkSoft, textAlign: 'center', paddingVertical: 30},
    modalHint: {fontSize: 11, color: colors.inkMuted, fontStyle: 'italic', marginTop: 12, textAlign: 'center'},
    checkRow: {flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12, marginBottom: 8},
    checkbox: {width: 22, height: 22, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.accent},
    checkName: {fontWeight: '600', fontSize: 14, color: colors.ink},
    checkSub: {fontSize: 11.5, color: colors.inkSoft, marginTop: 1},
    empty: {alignItems: 'center', padding: 36, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed', borderRadius: radius.lg, marginBottom: 10},
    emptyText: {fontSize: 13.5, color: colors.inkSoft, textAlign: 'center', marginBottom: 14},
    emptyBtn: {backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 11, borderRadius: radius.md},
    emptyBtnText: {color: colors.onAccent, fontWeight: '700', fontSize: 13},
    sectionTitle: {fontSize: 12.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', color: colors.ink, marginBottom: 8},
    categoryRow: {flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 13, marginBottom: 8},
    categoryRowLabel: {fontWeight: '600', fontSize: 14.5, color: colors.ink},
    categoryRowSub: {fontSize: 11.5, color: colors.inkSoft, marginTop: 2},
});
