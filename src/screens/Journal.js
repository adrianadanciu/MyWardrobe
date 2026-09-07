import React, {useState, useCallback, useMemo} from 'react';
import {View, Text, ScrollView, TextInput, Pressable, Image, Alert, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import {Plus, Trash2, Save, X, Camera, ImagePlus} from 'lucide-react-native';
import {CATEGORY_ORDER, CATEGORY} from '../constants/Wardrobe';
import {todayIso} from '../utils/Dates';
import {loadItems, saveItems, loadJournal, saveJournal} from '../services/Storage';
import {persistPhoto, deletePhoto} from '../services/PhotoStorage';
import {analyzeOutfitPhoto} from '../services/PhotoAnalysis';
import {recordWearForLaundry} from '../utils/Laundry';
import {useTheme} from '../theme/ThemeContext';
import {radius, getShadow} from '../theme/tokens';
//creates an unique id for each item
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export default function Journal() {
    const {colors, resolvedScheme} = useTheme();
    const styles = useMemo(() => getStyles(colors, resolvedScheme), [colors, resolvedScheme]);
    const [entries, setEntries] = useState([]);
    const [wardrobe, setWardrobe] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [creating, setCreating] = useState(false);
    const [loggingPhoto, setLoggingPhoto] = useState(false);
    const reload = useCallback(async () => {
        const [j, w] = await Promise.all([loadJournal(), loadItems()]);
        setEntries(j.slice().sort((a, b) => (a.date < b.date ? 1 : -1)));
        setWardrobe(w);
        setLoaded(true);
    }, []);
    useFocusEffect(useCallback(() => {reload();}, [reload]));
    const persist = async (next) => {
        setEntries(next.slice().sort((a, b) => (a.date < b.date ? 1 : -1)));
        try {
            await saveJournal(next);
        } catch (e) {
            Alert.alert('Could not save', "Your journal entry didn't get saved. Please try again.");
        }
    };
    const updateEntry = (id, patch) => {
        persist(entries.map((e) => (e.id === id ? {...e, ...patch} : e)));
    };
    const deleteEntry = (id) => {
        Alert.alert('Delete this entry?', "This can't be undone.", [
            {text: 'Cancel', style: 'cancel'},
            {
                text: 'Delete', style: 'destructive', onPress: () => {
                    const target = entries.find((e) => e.id === id);
                    if (target?.hairstylePhotoUri) deletePhoto(target.hairstylePhotoUri);
                    persist(entries.filter((e) => e.id !== id));
                },
            },
        ]);
    };
    const applyWearToItems = async (itemIds, date) => {
        if (!itemIds || !itemIds.length) return;
        try {
            const current = await loadItems();
            const idSet = new Set(itemIds);
            const next = current.map((i) => {
                if (!idSet.has(i.id)) return i;
                const isNewerOrEqual = !i.lastWorn || date >= i.lastWorn;
                return recordWearForLaundry({
                    ...i,
                    wearCount: (i.wearCount || 0) + 1,
                    lastWorn: isNewerOrEqual ? date : i.lastWorn,
                    neglectDismissed: false,
                });
            });
            await saveItems(next);
            setWardrobe(next);
        } catch (e) {
            console.warn('Could not update wear tracking on wardrobe items', e);
        }
    };
    const addEntry = (entry) => {
        persist([...entries, entry]);
        applyWearToItems(entry.itemIds, entry.date);
        setCreating(false);
    };
    const handleLogFromPhoto = async (source) => {
        try {
            const permission = source === 'camera'
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission needed', "Without access I can't open the camera or gallery.");
                return;
            }
            const options = {mediaTypes: ['images'], allowsEditing: false, quality: 0.6, base64: true};
            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync(options)
                : await ImagePicker.launchImageLibraryAsync(options);
            if (result.canceled) return;
            setLoggingPhoto(true);
            const current = await loadItems();
            const {matchedItemIds, newItems} = await analyzeOutfitPhoto({base64: result.assets[0].base64, mediaType: 'image/jpeg', wardrobe: current});
            const createdItems = newItems.map((n) => ({
                id: genId(),
                name: n.nameGuess || CATEGORY[n.categoryGuess]?.short || 'New item',
                category: n.categoryGuess,
                colorHex: n.dominantColorHex || '#4A6FA5',
                warmth: n.warmthGuess || 'medium',
                fit: n.fitGuess || 'relaxed',
                occasions: [],
                styles: [],
                measurements: {chestCm: null, waistCm: null, hipsCm: null},
                dateAdded: todayIso(),
                lastWorn: null,
                wearCount: 0,
                photoUri: null,
                conditionScore: null,
                conditionLabel: null,
                notes: null,
            }));
            if (createdItems.length > 0) {
                await saveItems([...current, ...createdItems]);
                setWardrobe([...current, ...createdItems]);
            }
            const itemIds = [...matchedItemIds, ...createdItems.map((i) => i.id)];
            if (itemIds.length === 0) {
                Alert.alert("Couldn't match anything", 'No wardrobe pieces were recognized in that photo. Try a clearer, well-lit shot, or log manually.');
                return;
            }
            addEntry({id: genId(), date: todayIso(), itemIds, hairstyle: '', hairstylePhotoUri: null, notes: ''});
            if (createdItems.length > 0) {
                Alert.alert('Logged', `Added ${createdItems.length} new item${createdItems.length === 1 ? '' : 's'} to your wardrobe and logged today.`);
            }
        } 
        catch (e){
            Alert.alert('Error', String(e.message || e));
        } 
        finally{
            setLoggingPhoto(false);
        }
    };
    const promptLogFromPhoto = () => {
        Alert.alert("Log today's outfit", 'Take a new photo or choose one from your gallery.', [
            {text: 'Cancel', style: 'cancel'},
            {text: 'Take Photo', onPress: () => handleLogFromPhoto('camera')},
            {text: 'Choose from Library', onPress: () => handleLogFromPhoto('library')},
        ]);
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
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{flex: 1}}
            >
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.topRow}>
                    <Text style={styles.stats}>{entries.length} day{entries.length === 1 ? '' : 's'} logged</Text>
                    <Pressable style={styles.addBtn} onPress={() => setCreating(true)}>
                        <Plus size={18} color={colors.bg} />
                    </Pressable>
                </View>
                <Text style={styles.intro}>
                    "Wore this today" from the generator logs itself here automatically. Log a day manually below.
                </Text>
                <Pressable style={[styles.logPhotoBtn, loggingPhoto && styles.logPhotoBtnDisabled]} onPress={promptLogFromPhoto} disabled={loggingPhoto}>
                    {loggingPhoto ? <ActivityIndicator color={colors.onAccent} /> : (
                        <>
                            <Camera size={16} color={colors.onAccent} />
                            <Text style={styles.logPhotoBtnText}>Log with a photo</Text>
                        </>
                    )}
                </Pressable>
                {creating && (
                    <EntryForm
                        wardrobe={wardrobe}
                        onCancel={() => setCreating(false)}
                        onSave={addEntry}
                    />
                )}
                {entries.length === 0 && !creating && (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No outfits logged yet. Mark a generated outfit as worn, or add a day manually.</Text>
                    </View>
                )}
                {entries.map((entry) => (
                    <EntryCard
                        key={entry.id}
                        entry={entry}
                        wardrobe={wardrobe}
                        editing={editingId === entry.id}
                        onEdit={() => setEditingId(entry.id)}
                        onCancelEdit={() => setEditingId(null)}
                        onSave={(patch) => {updateEntry(entry.id, patch); setEditingId(null);}}
                        onDelete={() => deleteEntry(entry.id)}
                    />
                ))}
            </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
function HairstylePhotoField({photoUri, onChange, idForFile}) {
    const {colors, resolvedScheme} = useTheme();
    const styles = useMemo(() => getStyles(colors, resolvedScheme), [colors, resolvedScheme]);
    const [busy, setBusy] = useState(false);
    const pick = async (source) => {
        try{
            const permission = source === 'camera'
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission needed', "Without access I can't open the camera or gallery.");
                return;
            }
            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync({mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6})
                : await ImagePicker.launchImageLibraryAsync({mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6});
            if (result.canceled) return;
            setBusy(true);
            const persisted = await persistPhoto(result.assets[0].uri, idForFile);
            onChange(persisted);
        } 
        catch (e){
            Alert.alert('Error', String(e.message || e));
        } 
        finally{
            setBusy(false);
        }
    };
    return(
        <View style={{marginBottom: 4}}>
            <Text style={styles.fieldLabel}>Hairstyle photo (optional)</Text>
            {photoUri ? (
                <View style={styles.hairPhotoRow}>
                    <Image source={{uri: photoUri}} style={styles.hairPhotoPreview} />
                    <Pressable onPress={() => {deletePhoto(photoUri); onChange(null);}}>
                        <Text style={styles.removeLink}>remove</Text>
                    </Pressable>
                </View>
            ) : busy ? (
                <ActivityIndicator color={colors.accent} style={{alignSelf: 'flex-start'}} />
            ) : (
                <View style={styles.miniPhotoRow}>
                    <Pressable style={styles.miniPhotoBtn} onPress={() => pick('camera')}>
                        <Camera size={13} color={colors.bg} />
                        <Text style={styles.miniPhotoBtnText}>Take photo</Text>
                    </Pressable>
                    <Pressable style={[styles.miniPhotoBtn, styles.miniPhotoBtnAlt]} onPress={() => pick('library')}>
                        <ImagePlus size={13} color={colors.ink} />
                        <Text style={[styles.miniPhotoBtnText, {color: colors.ink}]}>Gallery</Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}
function EntryCard({entry, wardrobe, editing, onEdit, onCancelEdit, onSave, onDelete}) {
    const {colors, resolvedScheme} = useTheme();
    const styles = useMemo(() => getStyles(colors, resolvedScheme), [colors, resolvedScheme]);
    const [hairstyle, setHairstyle] = useState(entry.hairstyle || '');
    const [notes, setNotes] = useState(entry.notes || '');
    const [photoUri, setPhotoUri] = useState(entry.hairstylePhotoUri || null);
    const pieces = (entry.itemIds || []).map((id) => wardrobe.find((w) => w.id === id)).filter(Boolean);
    if (editing) {
        return (
            <View style={styles.card}>
                <Text style={styles.cardDate}>{entry.date}</Text>
                <Text style={styles.fieldLabel}>Hairstyle</Text>
                <TextInput style={styles.input} placeholder="e.g. loose waves, half-up bun" placeholderTextColor={colors.inkMuted} value={hairstyle} onChangeText={setHairstyle} />
                <HairstylePhotoField photoUri={photoUri} onChange={setPhotoUri} idForFile={entry.id} />
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput style={[styles.input, styles.inputMultiline]} multiline placeholder="e.g. dinner with Ana, felt great in this" placeholderTextColor={colors.inkMuted} value={notes} onChangeText={setNotes} />
                <View style={styles.editActions}>
                    <Pressable style={styles.smallBtn} onPress={onCancelEdit}>
                        <X size={13} color={colors.ink} />
                        <Text style={styles.smallBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable style={[styles.smallBtn, styles.smallBtnPrimary]} onPress={() => onSave({hairstyle, notes, hairstylePhotoUri: photoUri})}>
                        <Save size={13} color={colors.onAccent} />
                        <Text style={[styles.smallBtnText, {color: colors.onAccent}]}>Save</Text>
                    </Pressable>
                </View>
            </View>
        );
    }
    return (
        <View style={styles.card}>
            <View style={styles.cardTopRow}>
                <Text style={styles.cardDate}>{entry.date}</Text>
                <View style={styles.cardActions}>
                    <Pressable onPress={onEdit}><Text style={styles.editLink}>edit</Text></Pressable>
                    <Pressable onPress={onDelete}><Trash2 size={13} color={colors.accent} /></Pressable>
                </View>
            </View>
            {pieces.length > 0 && (
                <View style={styles.chipRow}>
                    {pieces.map((p) => (
                        <View key={p.id} style={styles.chip}>
                            <View style={[styles.chipSwatch, {backgroundColor: p.colorHex}]} />
                            <Text style={styles.chipText}>{p.name}</Text>
                        </View>
                    ))}
                </View>
            )}
            <View style={styles.hairDisplayRow}>
                {!!entry.hairstylePhotoUri && <Image source={{uri: entry.hairstylePhotoUri}} style={styles.hairThumb} />}
                <View style={{flex: 1}}>
                    {!!entry.hairstyle && <Text style={styles.detailLine}>Hair: {entry.hairstyle}</Text>}
                    {!!entry.notes && <Text style={styles.detailLine}>{entry.notes}</Text>}
                </View>
            </View>
        </View>
    );
}
function EntryForm({wardrobe, onCancel, onSave}) {
    const {colors, resolvedScheme} = useTheme();
    const styles = useMemo(() => getStyles(colors, resolvedScheme), [colors, resolvedScheme]);
    const [entryId] = useState(() => genId());
    const [date, setDate] = useState(todayIso());
    const [selected, setSelected] = useState([]);
    const [hairstyle, setHairstyle] = useState('');
    const [photoUri, setPhotoUri] = useState(null);
    const [notes, setNotes] = useState('');
    const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    const grouped = {};
    CATEGORY_ORDER.forEach((c) => {grouped[c] = wardrobe.filter((i) => i.category === c);});
    return(
        <View style={styles.card}>
            <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={date} onChangeText={setDate} />
            <Text style={[styles.fieldLabel, {marginTop: 10}]}>What did you wear?</Text>
            {CATEGORY_ORDER.map((cat) => (
                grouped[cat].length > 0 && (
                    <View key={cat} style={{marginBottom: 8}}>
                        <Text style={styles.miniCategoryLabel}>{CATEGORY[cat].label}</Text>
                        <View style={styles.chipPickRow}>
                            {grouped[cat].map((item) => {
                                const active = selected.includes(item.id);
                                return (
                                    <Pressable key={item.id} style={[styles.pickChip, active && styles.pickChipActive]} onPress={() => toggle(item.id)}>
                                        <View style={[styles.chipSwatch, {backgroundColor: item.colorHex}]} />
                                        <Text style={[styles.pickChipText, active && styles.pickChipTextActive]}>{item.name}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                )
            ))}
            <Text style={styles.fieldLabel}>Hairstyle</Text>
            <TextInput style={styles.input} placeholder="e.g. loose waves" placeholderTextColor={colors.inkMuted} value={hairstyle} onChangeText={setHairstyle} />
            <HairstylePhotoField photoUri={photoUri} onChange={setPhotoUri} idForFile={entryId} />
            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput style={[styles.input, styles.inputMultiline]} multiline placeholder="optional" placeholderTextColor={colors.inkMuted} value={notes} onChangeText={setNotes} />
            <View style={styles.editActions}>
                <Pressable style={styles.smallBtn} onPress={onCancel}>
                    <X size={13} color={colors.ink} />
                    <Text style={styles.smallBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                    style={[styles.smallBtn, styles.smallBtnPrimary]}
                    onPress={() => {
                        if (!date.trim()) {Alert.alert('Missing date', 'Enter a date for this entry.'); return;}
                        onSave({id: entryId, date: date.trim(), itemIds: selected, hairstyle, hairstylePhotoUri: photoUri, notes});
                    }}
                >
                    <Save size={13} color={colors.onAccent} />
                    <Text style={[styles.smallBtnText, {color: colors.onAccent}]}>Log this day</Text>
                </Pressable>
            </View>
        </View>
    );
}
const getStyles = (colors, scheme) => StyleSheet.create({
    safe: {flex: 1, backgroundColor: colors.bg},
    center: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg},
    scroll: {padding: 16, paddingBottom: 50},
    topRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10},
    stats: {fontSize: 13, color: colors.inkSoft, fontWeight: '500'},
    addBtn: {backgroundColor: colors.ink, width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center'},
    intro: {fontSize: 12, color: colors.inkSoft, marginBottom: 12, lineHeight: 17},
    logPhotoBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 12, marginBottom: 16},
    logPhotoBtnDisabled: {opacity: 0.6},
    logPhotoBtnText: {color: colors.onAccent, fontWeight: '700', fontSize: 13.5},
    empty: {alignItems: 'center', padding: 36, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed', borderRadius: radius.lg},
    emptyText: {fontSize: 13.5, color: colors.inkSoft, textAlign: 'center'},
    card: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: 13, marginBottom: 12, ...getShadow(scheme).card},
    cardTopRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8},
    cardDate: {fontWeight: '700', fontSize: 14, color: colors.ink},
    cardActions: {flexDirection: 'row', alignItems: 'center', gap: 14},
    editLink: {fontSize: 12, color: colors.inkSoft, textDecorationLine: 'underline'},
    chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6},
    chip: {flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.bg, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 9},
    chipSwatch: {width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)'},
    chipText: {fontSize: 11.5, color: colors.ink, fontWeight: '500'},
    hairDisplayRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2},
    hairThumb: {width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt},
    detailLine: {fontSize: 12, color: colors.inkSoft, marginTop: 2},
    fieldLabel: {fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, color: colors.inkSoft, fontWeight: '700', marginBottom: 6, marginTop: 4},
    input: {backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13.5, color: colors.ink},
    inputMultiline: {minHeight: 60, textAlignVertical: 'top'},
    miniCategoryLabel: {fontSize: 10.5, color: colors.inkMuted, fontStyle: 'italic', marginBottom: 5},
    chipPickRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
    pickChip: {flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 9},
    pickChipActive: {backgroundColor: colors.ink, borderColor: colors.ink},
    pickChipText: {fontSize: 11.5, color: colors.ink},
    pickChipTextActive: {color: colors.bg},
    miniPhotoRow: {flexDirection: 'row', gap: 8},
    miniPhotoBtn: {flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.ink, borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 10},
    miniPhotoBtnAlt: {backgroundColor: colors.surfaceAlt},
    miniPhotoBtnText: {fontSize: 11.5, fontWeight: '600', color: colors.bg},
    hairPhotoRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
    hairPhotoPreview: {width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceAlt},
    removeLink: {fontSize: 11.5, color: colors.accent, textDecorationLine: 'underline'},
    editActions: {flexDirection: 'row', gap: 8, marginTop: 10},
    smallBtn: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, borderRadius: radius.md, paddingVertical: 9},
    smallBtnPrimary: {backgroundColor: colors.accent, borderColor: colors.accent},
    smallBtnText: {fontSize: 12.5, fontWeight: '600', color: colors.ink},
});
