import React, {useState, useEffect, useMemo, useCallback, useRef} from 'react';
import {View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, Alert, StyleSheet , KeyboardAvoidingView, Platform} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {CalendarDays, MapPin, Droplet, Plane, Moon, Bookmark, Trash2, Clock, Square, CheckSquare, ListChecks, ShoppingBag} from 'lucide-react-native';
import {generateOutfit} from '../utils/ColorTheory';
import {getCurrentCoords, fetchForecast, fetchDailyHourlyWindows, geocodeCity} from '../services/Weather';
import {loadBeautyItems, loadSavedPlans, saveSavedPlans, loadItems, loadProfile} from '../services/Storage';
import {ROUTINE, ROUTINE_ORDER, routineStepValue} from '../constants/Beauty';
import {TRIP_ESSENTIAL_GROUPS} from '../constants/TripEssentials';
import {OCCASION_ORDER, OCCASION} from '../constants/Occasions';
import {useTheme} from '../theme/ThemeContext';
import {radius} from '../theme/tokens';
const formatHour12 = (h) => {
    const hh = ((h % 24) + 24) % 24;
    const period = hh >= 12 ? 'pm' : 'am';
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${h12}${period}`;
};
function defaultPlanLabel(numDays, destination, dayOffset) {
    if (numDays === 1) {
        const dayLabel = dayOffset === 0 ? 'Today' : dayOffset === 1 ? 'Tomorrow' : `In ${dayOffset} days`;
        return destination ? `${dayLabel} in ${destination}` : dayLabel;
    }
    return destination ? `${destination} trip` : `${numDays}-day trip`;
}
const DAY_AHEAD_OPTIONS = [
    {value: 0, label: 'Today'},
    {value: 1, label: 'Tomorrow'},
    {value: 2, label: 'In 2 days'},
    {value: 3, label: 'In 3 days'},
    {value: 4, label: 'In 4 days'},
    {value: 5, label: 'In 5 days'},
    {value: 6, label: 'In 6 days'},
];
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export default function Plan({navigation}) {
    const {colors} = useTheme();
    const styles = useMemo(() => getStyles(colors), [colors]);
    //plan is a bottom tab now, not a screen pushed from home with params, so it loads the wardrobe/profile itself and refreshes on focus
    const [items, setItems] = useState([]);
    const [season, setSeason] = useState(null);
    const [bodyShape, setBodyShape] = useState(null);
    const [personalStyle, setPersonalStyle] = useState([]);
    const [bodyMeasurements, setBodyMeasurements] = useState(null);
    const reloadWardrobe = useCallback(async () => {
        const [storedItems, profile] = await Promise.all([loadItems(), loadProfile()]);
        setItems(storedItems);
        setSeason(profile.season || null);
        setBodyShape(profile.bodyShape || null);
        setPersonalStyle(profile.personalStyle || []);
        setBodyMeasurements(
            profile.bustCm || profile.waistCm || profile.hipsCm
                ? {bustCm: profile.bustCm || null, waistCm: profile.waistCm || null, hipsCm: profile.hipsCm || null}
                : null
        );
    }, []);
    useFocusEffect(useCallback(() => {reloadWardrobe();}, [reloadWardrobe]));
    const [planMode, setPlanMode] = useState('outfit');
    const [dayOffset, setDayOffset] = useState(0);
    const [occasion, setOccasion] = useState(null);
    const [days, setDays] = useState('3');
    const [destination, setDestination] = useState('');
    const [flying, setFlying] = useState(false);
    const [washHairOverride, setWashHairOverride] = useState(null);
    const [hoursOut, setHoursOut] = useState(null);
    const [departureHour, setDepartureHour] = useState(8);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [plan, setPlan] = useState(null); 
    const [planId, setPlanId] = useState(null); 
    const [planLabel, setPlanLabel] = useState('');
    const [beautyItems, setBeautyItems] = useState([]);
    const [savedPlans, setSavedPlans] = useState([]);
    //remembers the items the last generated plan picked, so pressing "Plan outfits" again with the same
    //settings nudges the generator away from repeating the exact same combo instead of just returning it again
    const lastPlanItemIdsRef = useRef([]);
    useEffect(() => {loadBeautyItems().then(setBeautyItems);}, []);
    const reloadSavedPlans = useCallback(() => {loadSavedPlans().then(setSavedPlans);}, []);
    useFocusEffect(useCallback(() => {reloadSavedPlans();}, [reloadSavedPlans]));
    const routineGroups = useMemo(() => {
        const groups = {};
        const placed = new Set();
        const customNames = [...new Set(
            beautyItems.filter((i) => !i.retired).flatMap((i) => (i.routines || []).filter((r) => !ROUTINE_ORDER.includes(r)))
        )].sort();
        const order = [...ROUTINE_ORDER, ...customNames];
        order.forEach((r) => {
            const inGroup = beautyItems
                .filter((i) => !i.retired && !placed.has(i.id) && i.routines?.includes(r))
                .sort((a, b) => routineStepValue(a) - routineStepValue(b));
            inGroup.forEach((i) => placed.add(i.id));
            groups[r] = inGroup;
        });
        const situationalTools = beautyItems
            .filter((i) => !i.retired && !placed.has(i.id) && i.isTool)
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        situationalTools.forEach((i) => placed.add(i.id));
        const untaggedFrequent = beautyItems
            .filter((i) => !i.retired && !placed.has(i.id) && (!i.routines || i.routines.length === 0) && i.lastUsed)
            .sort((a, b) => (b.useCount || 0) - (a.useCount || 0) || (b.lastUsed < a.lastUsed ? -1 : 1))
            .slice(0, 4);
        untaggedFrequent.forEach((i) => placed.add(i.id));
        return {groups, order, untaggedFrequent, situationalTools};
    }, [beautyItems]);
    const routineVisibleForPlan = (r) => {
        if (r === 'hairWash') return plan?.washHair !== false;
        if (r === 'hairStyling') return plan?.washHair === false;
        return true;
    };
    const hasRoutine = routineGroups.order.some((r) => routineVisibleForPlan(r) && routineGroups.groups[r].length > 0) || routineGroups.untaggedFrequent.length > 0 || routineGroups.situationalTools.length > 0;
    const beautyPackingItems = routineGroups.order
        .filter(routineVisibleForPlan)
        .flatMap((r) => routineGroups.groups[r])
        .concat(routineGroups.untaggedFrequent)
        .concat(routineGroups.situationalTools);
    const TOOTHBRUSH_KEYWORDS = ['toothbrush'];
    const TOOTHPASTE_KEYWORDS = ['toothpaste'];
    const hasDentalItemNamed = (keywords) => beautyPackingItems.some((i) => i.category === 'dental' && keywords.some((k) => (i.name || '').toLowerCase().includes(k)));
    const hasToothbrushPacked = hasDentalItemNamed(TOOTHBRUSH_KEYWORDS);
    const hasToothpastePacked = hasDentalItemNamed(TOOTHPASTE_KEYWORDS);
    const essentialGroups = TRIP_ESSENTIAL_GROUPS
        .map((g) => ({...g, items: g.items.filter((it) => {
            if (it.dentalCheck === 'toothbrush') return !hasToothbrushPacked;
            if (it.dentalCheck === 'toothpaste') return !hasToothpastePacked;
            return true;
        })}))
        .filter((g) => g.items.length > 0);
    const resolveItems = (ids) => (ids || []).map((id) => items.find((i) => i.id === id)).filter(Boolean);
    const numDaysForWashHair = Math.max(1, Math.min(14, parseInt(days, 10) || 1));
    const washHairDefault = numDaysForWashHair >= 4;
    const washHairValue = washHairOverride !== null ? washHairOverride : washHairDefault;
    const handlePlan = async () => {
        //calculates for how many days we need the meteo prognosis
        const numDays = planMode === 'outfit' ? dayOffset + 1 : Math.max(1, Math.min(14, parseInt(days, 10) || 1));
        setLoading(true);
        setError(null);
        setPlan(null);
        setPlanId(null);
        try{
            let coords, locationLabel;
            if (destination.trim()){
                const geo = await geocodeCity(destination);
                if (!geo) {setError(`Couldn't find "${destination}". Check the spelling, or leave it blank to use your current location.`); setLoading(false); return;}
                coords = geo;
                locationLabel = geo.displayName;
            } 
            else{
                const c = await getCurrentCoords();
                if (c.error) {setError("Couldn't get your location. Try entering a destination city instead."); setLoading(false); return;}
                coords = c;
                locationLabel = 'your current location';
            }
            const effectiveHoursOut = typeof hoursOut === 'number' ? hoursOut : null;
            const effectiveDepartureHour = typeof departureHour === 'number' ? departureHour : 8;
            let dayTemps; // [{date, temp, tempRange}]
            if (effectiveHoursOut){
                const {windows, error: wErr} = await fetchDailyHourlyWindows({latitude: coords.latitude, longitude: coords.longitude, days: numDays, hoursOut: effectiveHoursOut, startHour: effectiveDepartureHour});
                if (wErr || !windows.length) {setError("Couldn't fetch the hourly forecast. Please try again."); setLoading(false); return;}
                dayTemps = windows.map((w) => ({date: w.date, temp: Math.round((w.min + w.max) / 2), tempRange: {min: w.min, max: w.max}}));
            } 
            else{
                const {forecast, error: fErr} = await fetchForecast({latitude: coords.latitude, longitude: coords.longitude, days: numDays});
                if (fErr || !forecast.length) {setError("Couldn't fetch the forecast. Please try again."); setLoading(false); return;}
                dayTemps = forecast.map((f) => ({date: f.date, temp: f.temp, tempRange: null}));
            }
            if (planMode === 'outfit') dayTemps = dayTemps.slice(-1);
            const dayOccasion = planMode === 'outfit' ? occasion : null;
            //seeded with whatever the last press picked, so hitting "Plan outfits" again with unchanged
            //settings is nudged toward a different combo instead of the same one every time
            const usedThisTrip = new Set(lastPlanItemIdsRef.current);
            const planDays = [];
            for (const day of dayTemps){
                const result = generateOutfit(items, day.temp, season, bodyShape, dayOccasion, day.tempRange, false, false, usedThisTrip, personalStyle, bodyMeasurements, flying);
                const itemIds = result.error ? [] : [result.top, result.dress, result.bottom, result.outer, result.shoe, result.accessory, result.jewelry, result.bag].filter(Boolean).map((i) => i.id);
                planDays.push({date: day.date, temp: day.temp, tempRange: day.tempRange, itemIds, error: result.error || null});
                itemIds.forEach((id) => usedThisTrip.add(id));
            }
            const buildCommute = (dayTemp) => {
                const cResult = generateOutfit(items, dayTemp.temp, season, bodyShape, 'travel', dayTemp.tempRange, true, false, usedThisTrip, personalStyle, bodyMeasurements, flying);
                const itemIds = cResult.error ? [] : [cResult.top, cResult.dress, cResult.bottom, cResult.outer, cResult.shoe, cResult.accessory, cResult.jewelry, cResult.bag].filter(Boolean).map((i) => i.id);
                itemIds.forEach((id) => usedThisTrip.add(id));
                return {temp: dayTemp.temp, tempRange: dayTemp.tempRange, itemIds, error: cResult.error || null};
            };
            let commute = null;
            let commuteReturn = null;
            if (planMode === 'trip' && dayTemps.length){
                commute = buildCommute(dayTemps[0]);
                if (dayTemps.length > 1) commuteReturn = buildCommute(dayTemps[dayTemps.length - 1]);
            }
            let eveningArrival = null;
            if (planMode === 'trip' && dayTemps.length){
                const first = dayTemps[0];
                const eResult = generateOutfit(items, first.temp, season, bodyShape, null, first.tempRange, false, true, usedThisTrip, personalStyle, bodyMeasurements, flying);
                const itemIds = eResult.error ? [] : [eResult.top, eResult.dress, eResult.bottom, eResult.outer, eResult.shoe, eResult.accessory, eResult.jewelry, eResult.bag].filter(Boolean).map((i) => i.id);
                eveningArrival = {temp: first.temp, tempRange: first.tempRange, itemIds, error: eResult.error || null};
            }
            setPlan({locationLabel, days: planDays, commute, commuteReturn, eveningArrival, washHair: planMode === 'trip' ? washHairValue : true});
            setPlanLabel(defaultPlanLabel(planMode === 'outfit' ? 1 : numDays, destination.trim(), dayOffset));
            lastPlanItemIdsRef.current = Array.from(usedThisTrip);
        } 
        catch (e){
            setError(e.message || 'Something went wrong.');
        } 
        finally{
            setLoading(false);
        }
    };
    const handleSavePlan = async () => {
        const entry = {id: genId(), label: planLabel.trim() || 'Saved plan', createdAt: new Date().toISOString(), locationLabel: plan.locationLabel, flying, planMode, ...plan};
        const next = [entry, ...savedPlans];
        setSavedPlans(next);
        setPlanId(entry.id);
        try{
            await saveSavedPlans(next);
        } 
        catch (e){
            Alert.alert('Could not save', "This plan didn't get saved. Please try again.");
        }
    };
    const openSavedPlan = (saved) => {
        setPlan({locationLabel: saved.locationLabel, days: saved.days, commute: saved.commute || null, commuteReturn: saved.commuteReturn || null, eveningArrival: saved.eveningArrival || null, checkedBeauty: saved.checkedBeauty || [], checkedEssentials: saved.checkedEssentials || [], washHair: saved.washHair !== undefined ? saved.washHair : true});
        setPlanMode(saved.planMode || (saved.commute ? 'trip' : 'outfit'));
        setPlanLabel(saved.label);
        setPlanId(saved.id);
        setError(null);
    };
    const toggleBeautyChecked = (id) => {
        setPlan((prev) => {
            if (!prev) return prev;
            const current = new Set(prev.checkedBeauty || []);
            if (current.has(id)) current.delete(id); else current.add(id);
            const next = {...prev, checkedBeauty: Array.from(current)};
            if (planId) {
                setSavedPlans((sp) => {
                    const updated = sp.map((p) => (p.id === planId ? {...p, checkedBeauty: next.checkedBeauty} : p));
                    saveSavedPlans(updated).catch(() => {});
                    return updated;
                });
            }
            return next;
        });
    };
    const toggleEssentialChecked = (key) => {
        setPlan((prev) => {
            if (!prev) return prev;
            const current = new Set(prev.checkedEssentials || []);
            if (current.has(key)) current.delete(key); else current.add(key);
            const next = {...prev, checkedEssentials: Array.from(current)};
            if (planId) {
                setSavedPlans((sp) => {
                    const updated = sp.map((p) => (p.id === planId ? {...p, checkedEssentials: next.checkedEssentials} : p));
                    saveSavedPlans(updated).catch(() => {});
                    return updated;
                });
            }
            return next;
        });
    };
    const deleteSavedPlan = (id) => {
        Alert.alert('Delete this plan?', "This can't be undone.", [
            {text: 'Cancel', style: 'cancel'},
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    const next = savedPlans.filter((p) => p.id !== id);
                    setSavedPlans(next);
                    if (planId === id) {setPlan(null); setPlanId(null);}
                    try {await saveSavedPlans(next);} catch (e) {/* best effort */}
                },
            },
        ]);
    };
    const packingList = useMemo(() => {
        if (!plan) return [];
        const seen = new Map();
        resolveItems(plan.commute?.itemIds).forEach((i) => {if (!seen.has(i.id)) seen.set(i.id, i);});
        resolveItems(plan.commuteReturn?.itemIds).forEach((i) => {if (!seen.has(i.id)) seen.set(i.id, i);});
        resolveItems(plan.eveningArrival?.itemIds).forEach((i) => {if (!seen.has(i.id)) seen.set(i.id, i);});
        plan.days.forEach((d) => {
            resolveItems(d.itemIds).forEach((i) => {if (!seen.has(i.id)) seen.set(i.id, i);});
        });
        return Array.from(seen.values());
    }, [plan, items]);
    return(
        <SafeAreaView style={styles.safe} edges={[]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{flex: 1}}
            >
            <ScrollView contentContainerStyle={styles.scroll}>
                {savedPlans.length > 0 && (
                    <View style={styles.savedSection}>
                        <Text style={styles.savedTitle}>Saved plans</Text>
                        {savedPlans.map((p) => (
                            <View key={p.id} style={[styles.savedRow, planId === p.id && styles.savedRowActive]}>
                                <Pressable style={styles.savedRowMain} onPress={() => openSavedPlan(p)}>
                                    <Bookmark size={13} color={colors.accent} />
                                    <View style={{flex: 1}}>
                                        <Text style={styles.savedLabel} numberOfLines={1}>{p.label}</Text>
                                        <Text style={styles.savedSub}>{p.days.length} day{p.days.length === 1 ? '' : 's'} · {p.locationLabel}</Text>
                                    </View>
                                </Pressable>
                                <Pressable onPress={() => deleteSavedPlan(p.id)} hitSlop={8}>
                                    <Trash2 size={14} color={colors.accent} />
                                </Pressable>
                            </View>
                        ))}
                    </View>
                )}
                <View style={styles.field}>
                    <Text style={styles.label}>What are you planning?</Text>
                    <View style={styles.flyRow}>
                        <Pressable style={[styles.flyPill, planMode === 'outfit' && styles.flyPillActive]} onPress={() => setPlanMode('outfit')}>
                            <Text style={[styles.flyPillText, planMode === 'outfit' && styles.flyPillTextActive]}>One outfit</Text>
                        </Pressable>
                        <Pressable style={[styles.flyPill, planMode === 'trip' && styles.flyPillActive]} onPress={() => setPlanMode('trip')}>
                            <Text style={[styles.flyPillText, planMode === 'trip' && styles.flyPillTextActive]}>A trip</Text>
                        </Pressable>
                    </View>
                </View>
                {planMode === 'outfit' && (
                    <View style={styles.field}>
                        <Text style={styles.label}>Which day?</Text>
                        <View style={styles.occasionRow}>
                            {DAY_AHEAD_OPTIONS.map((opt) => (
                                <Pressable key={opt.value} style={[styles.occasionPill, dayOffset === opt.value && styles.occasionPillActive]} onPress={() => setDayOffset(opt.value)}>
                                    <Text style={[styles.occasionPillText, dayOffset === opt.value && styles.occasionPillTextActive]}>{opt.label}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                )}
                {planMode === 'outfit' && (
                    <View style={styles.field}>
                        <Text style={styles.label}>Occasion (optional)</Text>
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
                    </View>
                )}
                {planMode === 'trip' && (
                    <View style={styles.field}>
                        <Text style={styles.label}>How many days?</Text>
                        <TextInput style={styles.input} keyboardType="numeric" value={days} onChangeText={setDays} placeholder="3" placeholderTextColor={colors.inkMuted} />
                    </View>
                )}
                <View style={styles.field}>
                    <Text style={styles.label}>Destination</Text>
                    <TextInput style={styles.input} value={destination} onChangeText={setDestination} placeholder="e.g. Lisbon" placeholderTextColor={colors.inkMuted} />
                </View>
                <View style={styles.field}>
                    <Text style={styles.label}>How many hours will you be out each day? (optional)</Text>
                    <View style={styles.hoursRow}>
                        <Pressable style={[styles.hoursPill, !hoursOut && styles.hoursPillActive]} onPress={() => setHoursOut(null)}>
                            <Text style={[styles.hoursPillText, !hoursOut && styles.hoursPillTextActive]}>Whole day</Text>
                        </Pressable>
                        <Pressable style={[styles.hoursPill, hoursOut != null && styles.hoursPillActive]} onPress={() => setHoursOut((h) => h ?? 8)}>
                            <Clock size={12} color={hoursOut != null ? colors.onAccent : colors.ink} />
                            <Text style={[styles.hoursPillText, hoursOut != null && styles.hoursPillTextActive]}>A specific window</Text>
                        </Pressable>
                    </View>
                    {hoursOut != null && (
                        <>
                            <View style={styles.hourInputRow}>
                                <View style={styles.hourInputCol}>
                                    <Text style={styles.miniLabel}>Leaving at (0-23h, {formatHour12(departureHour)})</Text>
                                    <TextInput
                                        style={styles.input}
                                        keyboardType="numeric"
                                        value={String(departureHour)}
                                        onChangeText={(v) => setDepartureHour(v === '' ? '' : Math.max(0, Math.min(23, parseInt(v, 10) || 0)))}
                                        onBlur={() => setDepartureHour((h) => (h === '' || h == null ? 8 : h))}
                                    />
                                </View>
                                <View style={styles.hourInputCol}>
                                    <Text style={styles.miniLabel}>Hours out (1-24)</Text>
                                    <TextInput
                                        style={styles.input}
                                        keyboardType="numeric"
                                        value={String(hoursOut)}
                                        onChangeText={(v) => setHoursOut(v === '' ? '' : Math.max(1, Math.min(24, parseInt(v, 10) || 1)))}
                                        onBlur={() => setHoursOut((h) => (h === '' || h == null ? 8 : h))}
                                    />
                                </View>
                            </View>
                        </>
                    )}
                </View>
                {planMode === 'trip' && (
                    <View style={styles.field}>
                        <Text style={styles.label}>Flying there?</Text>
                        <View style={styles.flyRow}>
                            <Pressable style={[styles.flyPill, !flying && styles.flyPillActive]} onPress={() => setFlying(false)}>
                                <Text style={[styles.flyPillText, !flying && styles.flyPillTextActive]}>No</Text>
                            </Pressable>
                            <Pressable style={[styles.flyPill, flying && styles.flyPillActive]} onPress={() => setFlying(true)}>
                                <Plane size={13} color={flying ? colors.onAccent : colors.ink} />
                                <Text style={[styles.flyPillText, flying && styles.flyPillTextActive]}>Yes, pack light</Text>
                            </Pressable>
                        </View>
                        {flying && (
                            <Text style={styles.flyHint}>Outfits below will reuse the same versatile pieces across days instead of a fresh combo daily, to keep your bag light. Remember carry-on liquid limits for any beauty products you bring.</Text>
                        )}
                    </View>
                )}
                {planMode === 'trip' && (
                    <View style={styles.field}>
                        <Text style={styles.label}>Washing your hair on this trip?</Text>
                        <View style={styles.flyRow}>
                            <Pressable style={[styles.flyPill, !washHairValue && styles.flyPillActive]} onPress={() => setWashHairOverride(false)}>
                                <Text style={[styles.flyPillText, !washHairValue && styles.flyPillTextActive]}>No</Text>
                            </Pressable>
                            <Pressable style={[styles.flyPill, washHairValue && styles.flyPillActive]} onPress={() => setWashHairOverride(true)}>
                                <Droplet size={13} color={washHairValue ? colors.onAccent : colors.ink} />
                                <Text style={[styles.flyPillText, washHairValue && styles.flyPillTextActive]}>Yes</Text>
                            </Pressable>
                        </View>
                        <Text style={styles.flyHint}>
                            {washHairOverride === null ? `Defaulted to ${washHairDefault ? 'yes' : 'no'} for a ${numDaysForWashHair}-day trip. Tap to change it. ` : ''}
                            {washHairValue ? 'Hair-wash products will be included in your packing checklist.' : "Hair-wash products won't be added to your packing checklist."}
                        </Text>
                    </View>
                )}
                {planMode === 'outfit' && (
                    <Pressable
                        style={styles.askRow}
                        onPress={() => navigation.navigate('Advice', {items, season, bodyShape, occasion})}
                    >
                        <ShoppingBag size={14} color={colors.ink} />
                        <Text style={styles.askText}>Ask for something specific</Text>
                    </Pressable>
                )}
                <Pressable style={[styles.planBtn, loading && styles.planBtnDisabled]} onPress={handlePlan} disabled={loading}>
                    {loading ? <ActivityIndicator color={colors.onAccent} /> : (
                        <View style={styles.planBtnRow}>
                            <CalendarDays size={16} color={colors.onAccent} />
                            <Text style={styles.planBtnText}>Plan outfits</Text>
                        </View>
                    )}
                </Pressable>
                {error && <Text style={styles.errorText}>{error}</Text>}
                {plan && (
                    <View style={styles.results}>
                        <View style={styles.locationRow}>
                            <MapPin size={13} color={colors.inkSoft} />
                            <Text style={styles.locationText}>Forecast for {plan.locationLabel}</Text>
                        </View>
                        {plan.commute && (
                            <View style={[styles.dayCard, styles.commuteCard]}>
                                <View style={styles.dayHeaderRow}>
                                    <View style={styles.commuteTitleRow}>
                                        <Plane size={13} color={colors.accent} />
                                        <Text style={styles.dayDate}>Getting there</Text>
                                    </View>
                                    <Text style={styles.dayTemp}>{plan.commute.tempRange ? `${plan.commute.tempRange.min}°–${plan.commute.tempRange.max}°C` : `${plan.commute.temp}°C`}</Text>
                                </View>
                                {plan.commute.itemIds?.length > 0 ? (
                                    <View style={styles.chipRow}>
                                        {resolveItems(plan.commute.itemIds).map((p) => (
                                            <View key={p.id} style={styles.chip}>
                                                <View style={[styles.chipSwatch, {backgroundColor: p.colorHex}]} />
                                                <Text style={styles.chipText}>{p.name}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <Text style={styles.dayError}>{plan.commute.error || "Couldn't put together a travel-day outfit."}</Text>
                                )}
                                <Text style={styles.commuteHint}>What to wear for the journey: comfortable and practical, separate from your day-by-day outfits. Tag items "Travel" in occasions to include them here.</Text>
                            </View>
                        )}
                        {plan.eveningArrival?.itemIds?.length > 0 && (
                            <View style={[styles.dayCard, styles.eveningCard]}>
                                <View style={styles.dayHeaderRow}>
                                    <View style={styles.commuteTitleRow}>
                                        <Moon size={13} color={colors.accent} />
                                        <Text style={styles.dayDate}>Evening plans</Text>
                                    </View>
                                    <Text style={styles.dayTemp}>{plan.eveningArrival.tempRange ? `${plan.eveningArrival.tempRange.min}°–${plan.eveningArrival.tempRange.max}°C` : `${plan.eveningArrival.temp}°C`}</Text>
                                </View>
                                <View style={styles.chipRow}>
                                    {resolveItems(plan.eveningArrival.itemIds).map((p) => (
                                        <View key={p.id} style={styles.chip}>
                                            <View style={[styles.chipSwatch, {backgroundColor: p.colorHex}]} />
                                            <Text style={styles.chipText}>{p.name}</Text>
                                        </View>
                                    ))}
                                </View>
                                <Text style={styles.commuteHint}>Optional: something a little dressier for once you've arrived and settled in, if you have plans that evening.</Text>
                            </View>
                        )}
                        {plan.days.map((d) => (
                            <View key={d.date} style={styles.dayCard}>
                                <View style={styles.dayHeaderRow}>
                                    <Text style={styles.dayDate}>{d.date}</Text>
                                    <Text style={styles.dayTemp}>{d.tempRange ? `${d.tempRange.min}°–${d.tempRange.max}°C` : `${d.temp}°C`}</Text>
                                </View>
                                {d.itemIds?.length > 0 ? (
                                    <View style={styles.chipRow}>
                                        {resolveItems(d.itemIds).map((p) => (
                                            <View key={p.id} style={styles.chip}>
                                                <View style={[styles.chipSwatch, {backgroundColor: p.colorHex}]} />
                                                <Text style={styles.chipText}>{p.name}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <Text style={styles.dayError}>{d.error || "Couldn't put together an outfit for this day."}</Text>
                                )}
                            </View>
                        ))}
                        {plan.commuteReturn && (
                            <View style={[styles.dayCard, styles.commuteCard]}>
                                <View style={styles.dayHeaderRow}>
                                    <View style={styles.commuteTitleRow}>
                                        <Plane size={13} color={colors.accent} style={styles.planeReturn} />
                                        <Text style={styles.dayDate}>Heading back</Text>
                                    </View>
                                    <Text style={styles.dayTemp}>{plan.commuteReturn.tempRange ? `${plan.commuteReturn.tempRange.min}°–${plan.commuteReturn.tempRange.max}°C` : `${plan.commuteReturn.temp}°C`}</Text>
                                </View>
                                {plan.commuteReturn.itemIds?.length > 0 ? (
                                    <View style={styles.chipRow}>
                                        {resolveItems(plan.commuteReturn.itemIds).map((p) => (
                                            <View key={p.id} style={styles.chip}>
                                                <View style={[styles.chipSwatch, {backgroundColor: p.colorHex}]} />
                                                <Text style={styles.chipText}>{p.name}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <Text style={styles.dayError}>{plan.commuteReturn.error || "Couldn't put together a travel-day outfit."}</Text>
                                )}
                                <Text style={styles.commuteHint}>What to wear for the trip home</Text>
                            </View>
                        )}
                        {planMode === 'trip' && packingList.length > 0 && (
                            <View style={styles.packCard}>
                                <Text style={styles.packTitle}>Pack these ({packingList.length} items)</Text>
                                <View style={styles.chipRow}>
                                    {packingList.map((p) => (
                                        <View key={p.id} style={styles.chip}>
                                            <View style={[styles.chipSwatch, {backgroundColor: p.colorHex}]} />
                                            <Text style={styles.chipText}>{p.name}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                        {planMode === 'trip' && hasRoutine && (
                            <View style={[styles.packCard, styles.beautyCard]}>
                                <View style={styles.beautyTitleRow}>
                                    <Droplet size={14} color={colors.ink} />
                                    <Text style={styles.packTitle}>Beauty essentials to pack</Text>
                                </View>
                                <Text style={styles.beautySub}>Check things off as you pack them.</Text>
                                {plan.washHair === false && routineGroups.groups.hairWash?.length > 0 && (
                                    <Text style={styles.beautySub}>Hair wash skipped, showing hair styling instead, if you've tagged anything there.</Text>
                                )}
                                {routineGroups.order.map((r) => (
                                    routineVisibleForPlan(r) && routineGroups.groups[r].length > 0 && (
                                        <View key={r} style={styles.beautyGroup}>
                                            <Text style={styles.beautyGroupLabel}>{ROUTINE[r]?.label || r}</Text>
                                            {routineGroups.groups[r].map((p) => {
                                                const checked = (plan.checkedBeauty || []).includes(p.id);
                                                return (
                                                    <Pressable key={p.id} style={styles.checkRow} onPress={() => toggleBeautyChecked(p.id)}>
                                                        {checked ? <CheckSquare size={16} color={colors.success} /> : <Square size={16} color={colors.inkMuted} />}
                                                        <Text style={[styles.checkText, checked && styles.checkTextDone]}>{p.name}</Text>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    )
                                ))}
                                {routineGroups.untaggedFrequent.length > 0 && (
                                    <View style={styles.beautyGroup}>
                                        <Text style={styles.beautyGroupLabel}>Other frequently used</Text>
                                        {routineGroups.untaggedFrequent.map((p) => {
                                            const checked = (plan.checkedBeauty || []).includes(p.id);
                                            return (
                                                <Pressable key={p.id} style={styles.checkRow} onPress={() => toggleBeautyChecked(p.id)}>
                                                    {checked ? <CheckSquare size={16} color={colors.success} /> : <Square size={16} color={colors.inkMuted} />}
                                                    <Text style={[styles.checkText, checked && styles.checkTextDone]}>{p.name}</Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                )}
                                {routineGroups.situationalTools.length > 0 && (
                                    <View style={styles.beautyGroup}>
                                        <Text style={styles.beautyGroupLabel}>Good to have just in case</Text>
                                        <Text style={styles.beautySub}>Tools worth having if something comes up.</Text>
                                        {routineGroups.situationalTools.map((p) => {
                                            const checked = (plan.checkedBeauty || []).includes(p.id);
                                            return (
                                                <Pressable key={p.id} style={styles.checkRow} onPress={() => toggleBeautyChecked(p.id)}>
                                                    {checked ? <CheckSquare size={16} color={colors.success} /> : <Square size={16} color={colors.inkMuted} />}
                                                    <Text style={[styles.checkText, checked && styles.checkTextDone]}>{p.name}</Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        )}
                        {planMode === 'trip' && essentialGroups.length > 0 && (
                            <View style={[styles.packCard, styles.beautyCard]}>
                                <View style={styles.beautyTitleRow}>
                                    <ListChecks size={14} color={colors.ink} />
                                    <Text style={styles.packTitle}>Trip essentials</Text>
                                </View>
                                <Text style={styles.beautySub}>Easy to forget</Text>
                                {essentialGroups.map((g) => (
                                    <View key={g.key} style={styles.beautyGroup}>
                                        <Text style={styles.beautyGroupLabel}>{g.label}</Text>
                                        {g.items.map((it) => {
                                            const checked = (plan.checkedEssentials || []).includes(it.key);
                                            return (
                                                <Pressable key={it.key} style={styles.checkRow} onPress={() => toggleEssentialChecked(it.key)}>
                                                    {checked ? <CheckSquare size={16} color={colors.success} /> : <Square size={16} color={colors.inkMuted} />}
                                                    <Text style={[styles.checkText, checked && styles.checkTextDone]}>{it.label}</Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                ))}
                            </View>
                        )}
                        {planId ? (
                            <View style={styles.savedBadgeRow}>
                                <Bookmark size={13} color={colors.success} />
                                <Text style={styles.savedBadgeText}>Saved</Text>
                            </View>
                        ) : (
                            <View style={styles.saveRow}>
                                <TextInput style={styles.saveInput} value={planLabel} onChangeText={setPlanLabel} placeholder="Name this plan" placeholderTextColor={colors.inkMuted} />
                                <Pressable style={styles.saveBtn} onPress={handleSavePlan}>
                                    <Bookmark size={14} color={colors.onAccent} />
                                    <Text style={styles.saveBtnText}>Save</Text>
                                </Pressable>
                            </View>
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
    savedSection: {marginBottom: 22},
    savedTitle: {fontSize: 12.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', color: colors.ink, marginBottom: 8},
    savedRow: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 10, marginBottom: 6},
    savedRowActive: {borderColor: colors.accent, borderWidth: 1.5},
    savedRowMain: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8},
    savedLabel: {fontWeight: '600', fontSize: 13.5, color: colors.ink},
    savedSub: {fontSize: 11, color: colors.inkSoft, marginTop: 1},
    field: {marginBottom: 14},
    label: {fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: colors.inkSoft, fontWeight: '700', marginBottom: 7},
    input: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.ink},
    hoursRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
    hoursPill: {flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 13},
    hoursPillActive: {backgroundColor: colors.accent, borderColor: colors.accent},
    hoursPillText: {fontSize: 12.5, fontWeight: '600', color: colors.ink},
    hoursPillTextActive: {color: colors.onAccent},
    hoursHint: {fontSize: 11, color: colors.inkMuted, fontStyle: 'italic', marginTop: 8, lineHeight: 15},
    hourInputRow: {flexDirection: 'row', gap: 10, marginTop: 10},
    hourInputCol: {flex: 1},
    miniLabel: {fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3, color: colors.inkMuted, fontWeight: '700', marginBottom: 5},
    flyRow: {flexDirection: 'row', gap: 8},
    flyPill: {flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14},
    flyPillActive: {backgroundColor: colors.accent, borderColor: colors.accent},
    flyPillText: {fontSize: 12.5, fontWeight: '600', color: colors.ink},
    flyPillTextActive: {color: colors.onAccent},
    flyHint: {fontSize: 11, color: colors.inkMuted, fontStyle: 'italic', marginTop: 8, lineHeight: 15},
    occasionRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
    occasionPill: {borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingVertical: 5, paddingHorizontal: 11, borderRadius: radius.pill},
    occasionPillActive: {backgroundColor: colors.ink, borderColor: colors.ink},
    occasionPillText: {fontSize: 11.5, fontWeight: '500', color: colors.ink},
    occasionPillTextActive: {color: colors.bg},
    planBtn: {backgroundColor: colors.accent, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center', marginTop: 4},
    planBtnDisabled: {opacity: 0.6},
    planBtnRow: {flexDirection: 'row', alignItems: 'center', gap: 7},
    planBtnText: {color: colors.onAccent, fontWeight: '700', fontSize: 14},
    errorText: {fontSize: 12.5, color: colors.danger, marginTop: 14},
    results: {marginTop: 22},
    locationRow: {flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12},
    locationText: {fontSize: 12, color: colors.inkSoft, fontStyle: 'italic'},
    askRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14},
    askText: {fontSize: 12.5, fontWeight: '600', color: colors.ink, textDecorationLine: 'underline'},
    dayCard: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12, marginBottom: 10},
    dayHeaderRow: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8},
    dayDate: {fontWeight: '700', fontSize: 13.5, color: colors.ink},
    dayTemp: {fontWeight: '700', fontSize: 13.5, color: colors.accent},
    dayError: {fontSize: 12, color: colors.danger},
    commuteCard: {borderColor: colors.accent, borderWidth: 1.5},
    planeReturn: {transform: [{scaleX: -1}]},
    //dashed instead of solid so it reads as optional, unlike the "getting there"/"heading back" cards which are always needed
    eveningCard: {borderColor: colors.inkSoft, borderWidth: 1.5, borderStyle: 'dashed'},
    commuteTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
    commuteHint: {fontSize: 11, color: colors.inkMuted, fontStyle: 'italic', marginTop: 8, lineHeight: 15},
    chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
    chip: {flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.bg, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 9},
    chipSwatch: {width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)'},
    chipText: {fontSize: 11.5, color: colors.ink, fontWeight: '500'},
    packCard: {backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.success, borderRadius: radius.lg, padding: 13, marginTop: 4},
    packTitle: {fontWeight: '700', fontSize: 13.5, color: colors.ink, marginBottom: 8},
    beautyCard: {borderColor: colors.line, marginTop: 12},
    beautyTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2},
    beautySub: {fontSize: 11, color: colors.inkMuted, fontStyle: 'italic', marginBottom: 10},
    beautyGroup: {marginBottom: 8},
    beautyGroupLabel: {fontSize: 10.5, color: colors.inkSoft, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 5},
    checkRow: {flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5},
    checkText: {fontSize: 13, color: colors.ink, fontWeight: '500'},
    checkTextDone: {color: colors.inkMuted, textDecorationLine: 'line-through'},
    saveRow: {flexDirection: 'row', gap: 8, marginTop: 14},
    saveInput: {flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, fontSize: 13.5, color: colors.ink},
    saveBtn: {flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 10},
    saveBtnText: {color: colors.onAccent, fontWeight: '700', fontSize: 13},
    savedBadgeRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, justifyContent: 'center'},
    savedBadgeText: {fontSize: 11.5, color: colors.success, fontStyle: 'italic'},
});
