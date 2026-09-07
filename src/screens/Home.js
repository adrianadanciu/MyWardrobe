import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {View, Text, ScrollView, Pressable, Image, StyleSheet, ActivityIndicator, TextInput, Alert, Modal, KeyboardAvoidingView, Platform} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Plus, Sparkles, Sun, CloudSun, Cloud, Snowflake, User, ShoppingBag, Archive, X, Shirt} from 'lucide-react-native';
import {CATEGORY, CATEGORY_ORDER, BRACKET_LABEL} from '../constants/Wardrobe';
import {SEASON} from '../constants/ColorSeasons';
import {BODY_SHAPE} from '../constants/BodyShapes';
import {STYLE} from '../constants/Styles';
import {OCCASION_ORDER, OCCASION} from '../constants/Occasions';
import {isNeglectedItem, lastWornLabel, todayIso} from '../utils/Dates';
import {generateOutfit, getBracket} from '../utils/ColorTheory';
import {loadItems, saveItems, loadProfile, saveJournalEntry} from '../services/Storage';
import {fetchCurrentTemperature, getCurrentCoords, fetchHourlyWindow} from '../services/Weather';
import {deletePhoto} from '../services/PhotoStorage';
import {useTheme} from '../theme/ThemeContext';
import ItemCard from '../components/ItemCard';
import OutfitResult from '../components/OutfitResult';
import SkeletonBlock from '../components/Skeleton';
import {radius, spacing, fonts, getShadow} from '../theme/tokens';
import {haptics} from '../utils/Haptics';
const BRACKET_ICON = {hot: Sun, warm: CloudSun, cool: Cloud, cold: Snowflake};
const WARDROBE_SEASON_ORDER = ['summer', 'spring', 'fall', 'winter'];
const WARDROBE_SEASON = {
    summer: {label: 'Summer'},
    spring: {label: 'Spring'},
    fall: {label: 'Fall'},
    winter: {label: 'Winter'},
};
const INDOOR_COMFORT_TEMP = 25;
const WEATHER_ERROR_MESSAGES = {
    'permission-denied': "location access denied, so enter today's temperature manually",
    'location-failed': "couldn't get a location fix, so enter today's temperature manually",
    'network-failed': "couldn't reach the weather service, so enter today's temperature manually",
    default: "couldn't detect the temperature automatically, so enter it manually",
};
export default function Home({navigation}) {
    const {colors, resolvedScheme} = useTheme();
    const styles = useMemo(() => getStyles(colors, resolvedScheme), [colors, resolvedScheme]);
    const [items, setItems] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [temp, setTemp] = useState(18);
    const [weatherNote, setWeatherNote] = useState('detecting your location…');
    const [outfit, setOutfit] = useState(null);
    const [genMessage, setGenMessage] = useState(null);
    const [occasion, setOccasion] = useState(null);
    const [hoursOutText, setHoursOutText] = useState('');
    const [willGoIndoors, setWillGoIndoors] = useState(false);
    const [coords, setCoords] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [season, setSeason] = useState(null);
    const [bodyShape, setBodyShape] = useState(null);
    const [personalStyle, setPersonalStyle] = useState([]);
    const [bodyMeasurements, setBodyMeasurements] = useState(null);
    const [name, setName] = useState('');
    const [photoUri, setPhotoUri] = useState(null);
    const [neglectOpen, setNeglectOpen] = useState(false);
    const loadSeq = useRef(0);
    const reloadItems = useCallback(async () => {
        const mySeq = ++loadSeq.current;
        const stored = await loadItems();
        const profile = await loadProfile();
        if (mySeq !== loadSeq.current) 
            return;
        setItems(stored);
        setSeason(profile.season || null);
        setBodyShape(profile.bodyShape || null);
        setPersonalStyle(profile.personalStyle || []);
        setName(profile.name || '');
        setPhotoUri(profile.photoUri || null);
        setBodyMeasurements(
            profile.bustCm || profile.waistCm || profile.hipsCm
                ? {bustCm: profile.bustCm || null, waistCm: profile.waistCm || null, hipsCm: profile.hipsCm || null}
                : null
        );
        setLoaded(true);
    }, []);
    useEffect(() => {
        reloadItems();
    }, [reloadItems]);
    useEffect(() => {
        (async () => {
            const c = await getCurrentCoords();
            const {temp: t, error} = await fetchCurrentTemperature(c.error ? null : c);
            if (!c.error) setCoords(c);
            if (t !== null) {
                setTemp(t);
                setWeatherNote(null);
            } else {
                setWeatherNote(WEATHER_ERROR_MESSAGES[error] || WEATHER_ERROR_MESSAGES.default);
            }
        })();
    }, []);
    useEffect(() => {
        const unsub = navigation.addListener('focus', reloadItems);
        return unsub;
    }, [navigation, reloadItems]);
    const bracket = getBracket(temp);
    const BracketIcon = BRACKET_ICON[bracket];
    const hoursOut = hoursOutText.trim() ? Math.max(1, Math.min(24, parseInt(hoursOutText, 10) || 1)) : null;
    const highlightIds = useMemo(() => {
        if (!outfit) return [];
        return [outfit.top, outfit.dress, outfit.bottom, outfit.outer, outfit.shoe, outfit.accessory, outfit.jewelry, outfit.bag].filter(Boolean).map((i) => i.id);
    }, [outfit]);
    const [recentOutfitIds, setRecentOutfitIds] = useState([]);
    const handleGenerate = useCallback(async () => {
        let tempRange = null;
        if (hoursOut) {
            if (!coords) {
                setOutfit(null);
                setGenMessage("Can't check the weather ahead without your location: turn on location, or just generate for right now.");
                return;
            }
            setGenerating(true);
            const {min, max, error} = await fetchHourlyWindow({latitude: coords.latitude, longitude: coords.longitude, hours: hoursOut});
            setGenerating(false);
            if (error){
                setOutfit(null);
                setGenMessage("Couldn't check the weather ahead. Try again, or generate for right now.");
                return;
            }
            tempRange = {min, max};
            if (willGoIndoors){
                tempRange = {min: Math.min(tempRange.min, INDOOR_COMFORT_TEMP), max: Math.max(tempRange.max, INDOOR_COMFORT_TEMP)};
            }
        }
        const avoidIds = recentOutfitIds.length ? new Set(recentOutfitIds.flat()) : null;
        const result = generateOutfit(items, temp, season, bodyShape, occasion, tempRange, false, false, avoidIds, personalStyle, bodyMeasurements);
        if (result.error) {setOutfit(null); setGenMessage(result.error); return;}
        setGenMessage(null);
        setOutfit(result);
        const resultIds = [result.top, result.dress, result.bottom, result.outer, result.shoe, result.accessory, result.jewelry, result.bag].filter(Boolean).map((i) => i.id);
        setRecentOutfitIds((prev) => [...prev, resultIds].slice(-2));
    }, [items, temp, season, bodyShape, occasion, hoursOut, coords, willGoIndoors, personalStyle, bodyMeasurements, recentOutfitIds]);
    const applyItems = (next) => {
        setItems(next);
        saveItems(next).catch((e) => {
            console.warn('Could not save the wardrobe', e);
            Alert.alert('Could not save', "Your change didn't get saved. Please try again.");
        });
    };
    const markOutfitWorn = () => {
        if (!outfit) 
            return;
        const ids = new Set(highlightIds);
        applyItems(items.map((i) => (ids.has(i.id) ? {...i, lastWorn: todayIso(), wearCount: (i.wearCount || 0) + 1, neglectDismissed: false} : i)));
        saveJournalEntry(todayIso(), Array.from(ids)).catch((e) => console.warn('Could not log to journal', e));
    };
    const dismissNeglect = (id) => {
        applyItems(items.map((i) => (i.id === id ? {...i, neglectDismissed: true} : i)));
    };
    const deleteItem = (id) => {
        Alert.alert('Delete this item?', "This can't be undone.", [
            {text: 'Cancel', style: 'cancel'},
            {
                text: 'Delete', style: 'destructive', onPress: () => {
                    haptics.warn();
                    const target = items.find((i) => i.id === id);
                    if (target?.photoUri) deletePhoto(target.photoUri);
                    applyItems(items.filter((i) => i.id !== id));
                    setOutfit(null);
                },
            },
        ]);
    };
    const grouped = useMemo(() => {
        const g = {};
        CATEGORY_ORDER.forEach((c) => (g[c] = items.filter((i) => i.category === c)));
        return g;
    }, [items]);
    const seasonGrouped = useMemo(() => {
        const g = {summer: [], spring: [], fall: [], winter: []};
        const yearRound = [];
        items.forEach((i) => {
            if (i.warmth === 'light') g.summer.push(i);
            else if (i.warmth === 'lightMedium') g.spring.push(i);
            else if (i.warmth === 'mediumHeavy') g.fall.push(i);
            else if (i.warmth === 'medium') {g.spring.push(i); g.fall.push(i);}
            else if (i.warmth === 'heavy') g.winter.push(i);
            else yearRound.push(i);
        });
        return {...g, yearRound};
    }, [items]);
    const [wardrobeView, setWardrobeView] = useState('category');
    const neglectedItems = useMemo(() => items.filter((i) => isNeglectedItem(i, undefined, bracket)), [items, bracket]);
    if (!loaded) {
        return (
            <SafeAreaView style={styles.safe} edges={['top']}>
                <View style={styles.scroll}>
                    <View style={styles.mastTop}>
                        <SkeletonBlock width={150} height={26} radius={radius.sm} />
                        <View style={{flexDirection: 'row', gap: spacing.sm}}>
                            <SkeletonBlock width={38} height={38} radius={radius.pill} />
                            <SkeletonBlock width={38} height={38} radius={radius.pill} />
                        </View>
                    </View>
                    <SkeletonBlock width={190} height={13} style={{marginTop: spacing.md, marginBottom: spacing.lg}} />
                    <SkeletonBlock width="100%" height={72} radius={radius.lg} style={{marginBottom: spacing.lg}} />
                    <SkeletonBlock width="100%" height={46} radius={radius.pill} style={{marginBottom: spacing.lg}} />
                    <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md}}>
                        {[0, 1, 2, 3].map((i) => (
                            <SkeletonBlock key={i} width="48%" height={150} radius={radius.md} />
                        ))}
                    </View>
                </View>
            </SafeAreaView>
        );
    }
    return(
        <SafeAreaView style={styles.safe} edges={['top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{flex: 1}}
            >
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.mastTop}>
                    <Pressable
                        style={styles.avatarBtn}
                        onPress={() => navigation.navigate('Profile')}
                        accessibilityLabel="Open your profile"
                    >
                        {photoUri ? (
                            <Image source={{uri: photoUri}} style={styles.avatarImg} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <User size={16} color={colors.ink} />
                            </View>
                        )}
                    </Pressable>
                    <View style={styles.mastActions}>
                        {neglectedItems.length > 0 && (
                            <Pressable style={[styles.iconBtn, styles.iconBtnAlt]} onPress={() => setNeglectOpen(true)}>
                                <Archive size={17} color={colors.ink} />
                                <View style={styles.iconBadge}>
                                    <Text style={styles.iconBadgeText}>{neglectedItems.length}</Text>
                                </View>
                            </Pressable>
                        )}
                        <Pressable style={({pressed}) => [styles.iconBtn, pressed && styles.pressed]} onPress={() => { haptics.tap(); navigation.navigate('AddItem'); }}>
                            <Plus size={20} color={colors.bg} />
                        </Pressable>
                    </View>
                    {/*centered so the wordmark sits dead-center of the header no matter how wide the left/right content is
                        pointerEvents="none" so taps still fall through to the avatar or action icons underneath it*/}
                    <View style={styles.mastTitleWrap} pointerEvents="none">
                        <Text style={styles.mastTitle} numberOfLines={1}>MyWardrobe</Text>
                    </View>
                </View>
                <Text style={styles.stats}>
                    {name ? `${name} · ` : ''}{items.length} item{items.length === 1 ? '' : 's'}
                    {season ? ` · ${SEASON[season].label} palette` : ''}
                    {bodyShape ? ` · ${BODY_SHAPE[bodyShape].label} shape` : ''}
                    {personalStyle.length ? ` · ${personalStyle.map((s) => STYLE[s].label).join('/')} style` : ''}
                </Text>
                <View style={styles.weatherCard}>
                    <View style={styles.weatherLeft}>
                        <BracketIcon size={24} color={colors.ink} />
                        <View>
                            <Text style={styles.tempValue}>{temp}°C</Text>
                            <Text style={styles.bracketLabel}>{BRACKET_LABEL[bracket]}</Text>
                        </View>
                    </View>
                    <View style={styles.tempManual}>
                        <Text style={styles.tempManualLabel}>manual</Text>
                        <TextInput
                            style={styles.tempInput}
                            keyboardType="numeric"
                            value={String(temp)}
                            onChangeText={(v) => {setTemp(Number(v.replace(/[^0-9-]/g, '')) || 0); setWeatherNote(null);}}
                        />
                    </View>
                </View>
                {weatherNote && <Text style={styles.weatherNote}>{weatherNote}</Text>}
                <View style={styles.wheelSection}>
                    <Text style={styles.pickerLabel}>Occasion</Text>
                    <View style={styles.occasionRow}>
                        <Pressable style={[styles.occasionPill, !occasion && styles.occasionPillActive]} onPress={() => setOccasion(null)}>
                            <Text style={[styles.occasionPillText, !occasion && styles.occasionPillTextActive]}>Any</Text>
                        </Pressable>
                        {OCCASION_ORDER.map((o) => (
                            <Pressable key={o} style={[styles.occasionPill, occasion === o && styles.occasionPillActive]} onPress={() => setOccasion(o)}>
                                <Text style={[styles.occasionPillText, occasion === o && styles.occasionPillTextActive]}>{OCCASION[o].label}</Text>
                            </Pressable>
                        ))}
                    </View>
                    <Text style={styles.pickerLabel}>How long will you be outside?</Text>
                    <View style={styles.occasionRow}>
                        <Pressable style={[styles.occasionPill, !hoursOutText && styles.occasionPillActive]} onPress={() => setHoursOutText('')}>
                            <Text style={[styles.occasionPillText, !hoursOutText && styles.occasionPillTextActive]}>Right now</Text>
                        </Pressable>
                        <Pressable style={[styles.occasionPill, !!hoursOutText && styles.occasionPillActive]} onPress={() => setHoursOutText((t) => t || '3')}>
                            <Text style={[styles.occasionPillText, !!hoursOutText && styles.occasionPillTextActive]}>For a while</Text>
                        </Pressable>
                    </View>
                    {!!hoursOutText && (
                        <View style={styles.hoursField}>
                            <Text style={styles.hoursFieldLabel}>Exactly how many hours?</Text>
                            <TextInput
                                style={styles.hoursInput}
                                keyboardType="numeric"
                                value={hoursOutText}
                                onChangeText={setHoursOutText}
                                placeholder="3"
                                placeholderTextColor={colors.inkMuted}
                            />
                        </View>
                    )}
                    {hoursOut != null && (
                        <>
                            <Text style={styles.pickerLabel}>Will you go indoors at some point (work, school, a shop)?</Text>
                            <View style={styles.occasionRow}>
                                <Pressable style={[styles.occasionPill, !willGoIndoors && styles.occasionPillActive]} onPress={() => setWillGoIndoors(false)}>
                                    <Text style={[styles.occasionPillText, !willGoIndoors && styles.occasionPillTextActive]}>No, outside the whole time</Text>
                                </Pressable>
                                <Pressable style={[styles.occasionPill, willGoIndoors && styles.occasionPillActive]} onPress={() => setWillGoIndoors(true)}>
                                    <Text style={[styles.occasionPillText, willGoIndoors && styles.occasionPillTextActive]}>Yes</Text>
                                </Pressable>
                            </View>
                        </>
                    )}
                    <Pressable
                        style={({pressed}) => [styles.generateBtn, (items.length < 2 || generating) && styles.generateBtnDisabled, pressed && styles.pressed]}
                        onPress={() => { haptics.light(); handleGenerate(); }}
                        disabled={items.length < 2 || generating}
                    >
                        {generating ? <ActivityIndicator color={colors.onAccent} /> : (
                            <>
                                <Sparkles size={17} color={colors.onAccent} />
                                <Text style={styles.generateBtnText}>Generate an outfit</Text>
                            </>
                        )}
                    </Pressable>
                    <Pressable style={styles.askBtn} onPress={() => navigation.navigate('Advice', {items, temp, season, bodyShape, occasion})}>
                        <ShoppingBag size={14} color={colors.ink} />
                        <Text style={styles.askBtnText}>Ask for something specific</Text>
                    </Pressable>
                    {genMessage && !outfit && (
                        <View style={styles.genMessageWrap}>
                            <Text style={styles.genMessage}>{genMessage}</Text>
                            <Pressable
                                style={styles.genMessageBtn}
                                onPress={() => navigation.navigate('Advice', {
                                    items, temp, season, bodyShape, occasion,
                                    initialRequest: `My wardrobe is missing something: ${genMessage} What should I look for while shopping?`,
                                    skipExisting: true,
                                })}
                            >
                                <Text style={styles.genMessageBtnText}>Get shopping suggestions</Text>
                            </Pressable>
                        </View>
                    )}
                    {outfit && (
                        <OutfitResult
                            outfit={outfit}
                            onMarkWorn={markOutfitWorn}
                            onShopForLayer={outfit.layeringGap ? () => navigation.navigate('Advice', {
                                items, temp, season, bodyShape, occasion,
                                initialRequest: `The weather might swing between ${outfit.tempRange.min}°C and ${outfit.tempRange.max}°C while I'm out today and I don't have a light layer in my wardrobe to bring for that. What should I look for while shopping?`,
                                skipExisting: true,
                            }) : undefined}
                        />
                    )}
                </View>
                <View style={styles.wardrobeHeaderRow}>
                    <Text style={styles.sectionTitle}>Wardrobe</Text>
                    {items.length > 0 && (
                        <View style={styles.viewToggleRow}>
                            <Pressable style={[styles.viewTogglePill, wardrobeView === 'category' && styles.viewTogglePillActive]} onPress={() => { haptics.tap(); setWardrobeView('category'); }}>
                                <Text style={[styles.viewToggleText, wardrobeView === 'category' && styles.viewToggleTextActive]}>Category</Text>
                            </Pressable>
                            <Pressable style={[styles.viewTogglePill, wardrobeView === 'season' && styles.viewTogglePillActive]} onPress={() => { haptics.tap(); setWardrobeView('season'); }}>
                                <Text style={[styles.viewToggleText, wardrobeView === 'season' && styles.viewToggleTextActive]}>Season</Text>
                            </Pressable>
                        </View>
                    )}
                </View>
                {items.length === 0 ? (
                    <View style={styles.empty}>
                        <View style={styles.emptyIconWrap}>
                            <Shirt size={26} color={colors.inkMuted} />
                        </View>
                        <Text style={styles.emptyText}>Your wardrobe is empty. Add your first item and start keeping track.</Text>
                        <Pressable
                            style={({pressed}) => [styles.emptyBtn, pressed && styles.pressed]}
                            onPress={() => { haptics.tap(); navigation.navigate('AddItem'); }}
                        >
                            <Text style={styles.emptyBtnText}>+ Add your first item</Text>
                        </Pressable>
                    </View>
                ) : wardrobeView === 'season' ? (
                    <>
                        {WARDROBE_SEASON_ORDER.map((s) => (
                            seasonGrouped[s].length > 0 && (
                                <View key={s} style={styles.categoryBlock}>
                                    <Text style={styles.categoryTitle}>{WARDROBE_SEASON[s].label} · {seasonGrouped[s].length}</Text>
                                    <View style={styles.grid}>
                                        {seasonGrouped[s].map((item) => (
                                            <ItemCard key={item.id} item={item} onDelete={deleteItem} onPress={() => navigation.navigate('EditItem', {item})} season={season} bodyShape={bodyShape} bodyMeasurements={bodyMeasurements} />
                                        ))}
                                    </View>
                                </View>
                            )
                        ))}
                        {seasonGrouped.yearRound.length > 0 && (
                            <View style={styles.categoryBlock}>
                                <Text style={styles.categoryTitle}>Accessories · All Year · {seasonGrouped.yearRound.length}</Text>
                                <View style={styles.grid}>
                                    {seasonGrouped.yearRound.map((item) => (
                                        <ItemCard key={item.id} item={item} onDelete={deleteItem} onPress={() => navigation.navigate('EditItem', {item})} season={season} bodyShape={bodyShape} bodyMeasurements={bodyMeasurements} />
                                    ))}
                                </View>
                            </View>
                        )}
                    </>
                ) : (
                    CATEGORY_ORDER.map((cat) => {
                        const list = grouped[cat];
                        if (!list.length) return null;
                        return (
                            <View key={cat} style={styles.categoryBlock}>
                                <Text style={styles.categoryTitle}>{CATEGORY[cat].label} · {list.length}</Text>
                                <View style={styles.grid}>
                                    {list.map((item) => (
                                        <ItemCard key={item.id} item={item} onDelete={deleteItem} onPress={() => navigation.navigate('EditItem', {item})} season={season} bodyShape={bodyShape} bodyMeasurements={bodyMeasurements} />
                                    ))}
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>
            </KeyboardAvoidingView>
            <Modal visible={neglectOpen} animationType="slide" transparent onRequestClose={() => setNeglectOpen(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Haven't worn in a while</Text>
                            <Pressable onPress={() => setNeglectOpen(false)} hitSlop={8}>
                                <X size={20} color={colors.ink} />
                            </Pressable>
                        </View>
                        <Text style={styles.modalSub}>Owned 4+ months, unworn just as long, and not just sitting out its off-season right now. Tap × on any piece to stop flagging it.</Text>
                        <ScrollView style={styles.modalScroll}>
                            {neglectedItems.length === 0 ? (
                                <Text style={styles.modalEmpty}>All clear. Nothing flagged right now.</Text>
                            ) : (
                                <View style={styles.chipRow}>
                                    {neglectedItems.map((i) => (
                                        <View key={i.id} style={styles.neglectChip}>
                                            <View style={[styles.neglectSwatch, {backgroundColor: i.colorHex}]} />
                                            <Text style={styles.neglectChipText}>{i.name} · {lastWornLabel(i.lastWorn)}</Text>
                                            <Pressable onPress={() => dismissNeglect(i.id)} hitSlop={8}>
                                                <X size={12} color={colors.warnSub} />
                                            </Pressable>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </ScrollView>
                        {neglectedItems.length > 0 && (
                            <Pressable
                                style={styles.neglectBtn}
                                onPress={() => {
                                    setNeglectOpen(false);
                                    navigation.navigate('Advice', {
                                        items, temp, season, bodyShape, occasion,
                                        initialRequest: `I haven't worn these in months: ${neglectedItems.map((i) => i.name).join(', ')}. Suggest how I could style them to bring them back into rotation, or whether I should consider donating, selling or repairing any of them.`,
                                    });
                                }}
                            >
                                <Text style={styles.neglectBtnText}>Ask for ideas</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
const getStyles = (colors, scheme) => StyleSheet.create({
    safe: {flex: 1, backgroundColor: colors.bg},
    center: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg},
    scroll: {padding: spacing.lg, paddingBottom: 60},
    pressed: {opacity: 0.8},
    mastTop: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44, position: 'relative'},
    mastActions: {flexDirection: 'row', gap: spacing.sm},
    mastTitleWrap: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center'},
    mastTitle: {fontFamily: fonts.brand, fontSize: 26, letterSpacing: 0.2, color: colors.ink},
    iconBtn: {backgroundColor: colors.ink, width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', ...getShadow(scheme).button},
    iconBtnAlt: {backgroundColor: colors.surfaceAlt, shadowOpacity: 0, elevation: 0},
    avatarBtn: {width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: colors.accent, overflow: 'hidden'},
    avatarImg: {width: '100%', height: '100%'},
    avatarPlaceholder: {width: '100%', height: '100%', borderRadius: 19, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center'},
    iconBadge: {position: 'absolute', top: -4, right: -4, backgroundColor: colors.danger, minWidth: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3},
    iconBadgeText: {color: '#fff', fontFamily: fonts.textSemibold, fontSize: 10},
    stats: {fontFamily: fonts.textSemibold, fontSize: 12, color: colors.inkSoft, marginTop: spacing.xs, marginBottom: spacing.md},
    weatherCard: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md + 2, marginBottom: spacing.lg, ...getShadow(scheme).card},
    weatherLeft: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2},
    tempValue: {fontFamily: fonts.displaySemibold, fontSize: 20, color: colors.ink},
    bracketLabel: {fontSize: 11, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5},
    tempManual: {alignItems: 'flex-end'},
    tempManualLabel: {fontSize: 10, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3},
    tempInput: {width: 56, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, textAlign: 'center', paddingVertical: 5, fontSize: 14, color: colors.ink},
    weatherNote: {fontSize: 11.5, color: colors.warnSub, marginTop: -8, marginBottom: spacing.lg},
    wheelSection: {alignItems: 'center', marginBottom: spacing.sm},
    pickerLabel: {fontFamily: fonts.textSemibold, fontSize: 11, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6},
    occasionRow: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginBottom: spacing.md + 2},
    hoursField: {marginBottom: spacing.md + 2},
    hoursFieldLabel: {fontFamily: fonts.textSemibold, fontSize: 11, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6},
    hoursInput: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 14, color: colors.ink},
    occasionPill: {borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingVertical: 5, paddingHorizontal: 11, borderRadius: radius.pill},
    occasionPillActive: {backgroundColor: colors.ink, borderColor: colors.ink},
    occasionPillText: {fontFamily: fonts.textSemibold, fontSize: 11.5, color: colors.ink},
    occasionPillTextActive: {color: colors.bg},
    generateBtn: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.accent, paddingHorizontal: spacing.xl - 2, paddingVertical: 11, borderRadius: radius.pill, marginTop: spacing.md + 2, ...getShadow(scheme).button},
    generateBtnDisabled: {opacity: 0.4, shadowOpacity: 0, elevation: 0},
    generateBtnText: {fontFamily: fonts.textSemibold, color: colors.onAccent, fontSize: 14},
    askBtn: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm + 2},
    askBtnText: {fontFamily: fonts.textSemibold, fontSize: 12.5, color: colors.ink, textDecorationLine: 'underline'},
    genMessageWrap: {alignItems: 'center', marginTop: spacing.md},
    genMessage: {fontSize: 13, color: colors.inkSoft, textAlign: 'center', maxWidth: 280},
    genMessageBtn: {marginTop: spacing.sm + 2, backgroundColor: colors.ink, paddingVertical: 9, paddingHorizontal: spacing.md + 4, borderRadius: radius.pill},
    genMessageBtnText: {fontFamily: fonts.textSemibold, color: colors.bg, fontSize: 12.5},
    modalOverlay: {flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end'},
    modalSheet: {backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg + 2, maxHeight: '75%', ...getShadow(scheme).raised},
    modalHeaderRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm},
    modalTitle: {fontFamily: fonts.displaySemibold, fontSize: 17, color: colors.ink},
    modalSub: {fontSize: 11.5, color: colors.warnSub, fontStyle: 'italic', marginBottom: spacing.md + 2, lineHeight: 16},
    modalScroll: {maxHeight: 380},
    modalEmpty: {fontSize: 13.5, color: colors.inkSoft, textAlign: 'center', paddingVertical: 30},
    chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
    neglectChip: {flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: spacing.sm + 2},
    neglectSwatch: {width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)'},
    neglectChipText: {fontFamily: fonts.textSemibold, fontSize: 11.5, color: colors.ink},
    neglectBtn: {backgroundColor: colors.warnSub, borderRadius: radius.md, paddingVertical: spacing.sm + 2, alignItems: 'center', marginTop: spacing.md + 2},
    neglectBtnText: {fontFamily: fonts.textSemibold, color: colors.bg, fontSize: 13},
    sectionTitle: {fontFamily: fonts.displaySemibold, fontSize: 15, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.ink},
    wardrobeHeaderRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl - 2, marginBottom: spacing.sm + 2},
    viewToggleRow: {flexDirection: 'row', gap: 6},
    viewTogglePill: {borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11},
    viewTogglePillActive: {backgroundColor: colors.ink, borderColor: colors.ink},
    viewToggleText: {fontFamily: fonts.textSemibold, fontSize: 11.5, color: colors.ink},
    viewToggleTextActive: {color: colors.bg},
    empty: {alignItems: 'center', padding: spacing.xl + 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed', borderRadius: radius.lg},
    emptyIconWrap: {width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md},
    emptyText: {fontSize: 14, color: colors.inkSoft, textAlign: 'center', marginBottom: spacing.md + 2},
    emptyBtn: {backgroundColor: colors.accent, paddingHorizontal: spacing.lg + 2, paddingVertical: 11, borderRadius: radius.md, ...getShadow(scheme).button},
    emptyBtnText: {fontFamily: fonts.textSemibold, color: colors.onAccent, fontSize: 13},
    categoryBlock: {marginBottom: spacing.lg + 2},
    categoryTitle: {fontSize: 13, fontStyle: 'italic', color: colors.inkSoft, marginBottom: spacing.sm},
    grid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2},
});
