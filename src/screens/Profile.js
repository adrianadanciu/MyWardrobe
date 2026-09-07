import React, {useState, useCallback, useMemo} from 'react';
import {View, Text, ScrollView, TextInput, Pressable, Image, Alert, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import {Camera, ImagePlus, ChevronRight, Palette as PaletteIcon, Ruler, Shirt, User, LogOut, Moon, SunMedium, MonitorSmartphone} from 'lucide-react-native';
import {SEASON} from '../constants/ColorSeasons';
import {BODY_SHAPE} from '../constants/BodyShapes';
import {STYLE} from '../constants/Styles';
import {loadProfile, saveProfile} from '../services/Storage';
import {persistPhoto} from '../services/PhotoStorage';
import {useTheme} from '../theme/ThemeContext';
import {useAuth} from '../auth/AuthContext';
import {radius, spacing, fonts, getShadow} from '../theme/tokens';
import {haptics} from '../utils/Haptics';
const AVATAR_ID = 'profile-avatar';
export default function Profile({navigation}) {
    const {colors, resolvedScheme, mode, setMode} = useTheme();
    const {signOutUser} = useAuth();
    const styles = useMemo(() => getStyles(colors, resolvedScheme), [colors, resolvedScheme]);
    const [loaded, setLoaded] = useState(false);
    const [name, setName] = useState('');
    const [photoUri, setPhotoUri] = useState(null);
    const [season, setSeason] = useState(null);
    const [bodyShape, setBodyShape] = useState(null);
    const [personalStyle, setPersonalStyle] = useState([]);
    const [hasMeasurements, setHasMeasurements] = useState(false);
    const reload = useCallback(async () => {
        const profile = await loadProfile();
        setName(profile.name || '');
        setPhotoUri(profile.photoUri || null);
        setSeason(profile.season || null);
        setBodyShape(profile.bodyShape || null);
        setPersonalStyle(profile.personalStyle || []);
        setHasMeasurements(!!(profile.bustCm || profile.waistCm || profile.hipsCm));
        setLoaded(true);
    }, []);
    useFocusEffect(useCallback(() => {reload();}, [reload]));
    const persistName = async (next) => {
        try {
            const current = await loadProfile();
            await saveProfile({...current, name: next});
        } catch (e) {
            Alert.alert('Could not save', "Your name didn't get saved. Please try again.");
        }
    };
    const pickAvatar = async (source) => {
        try{
            const permission = source === 'camera'
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission needed', "Without access I can't open the camera or gallery.");
                return;
            }
            const options = {mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7};
            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync(options)
                : await ImagePicker.launchImageLibraryAsync(options);
            if (result.canceled) return;
            const persisted = await persistPhoto(result.assets[0].uri, AVATAR_ID);
            setPhotoUri(persisted);
            const current = await loadProfile();
            await saveProfile({...current, photoUri: persisted});
        } 
        catch (e){
            Alert.alert('Error', String(e.message || e));
        }
    };
    const handleSignOut = () => {
        haptics.tap();
        signOutUser();
    };
    const cycleAppearance = () => {
        haptics.tap();
        setMode(mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system');
    };
    const AppearanceIcon = mode === 'system' ? MonitorSmartphone : resolvedScheme === 'dark' ? Moon : SunMedium;
    const appearanceLabel = mode === 'system' ? 'System' : mode === 'light' ? 'Light' : 'Dark';
    if (!loaded) return <SafeAreaView style={styles.safe} />;
    return(
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.avatarRow}>
                    <Pressable onPress={() => pickAvatar('library')}>
                        {photoUri ? (
                            <Image source={{uri: photoUri}} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <User size={30} color={colors.inkMuted} />
                            </View>
                        )}
                    </Pressable>
                    <View style={styles.avatarActions}>
                        <Pressable style={({pressed}) => [styles.avatarBtn, pressed && styles.pressed]} onPress={() => { haptics.tap(); pickAvatar('camera'); }}>
                            <Camera size={13} color={colors.bg} />
                            <Text style={styles.avatarBtnText}>Photo</Text>
                        </Pressable>
                        <Pressable style={({pressed}) => [styles.avatarBtn, styles.avatarBtnAlt, pressed && styles.pressed]} onPress={() => { haptics.tap(); pickAvatar('library'); }}>
                            <ImagePlus size={13} color={colors.ink} />
                            <Text style={[styles.avatarBtnText, {color: colors.ink}]}>Gallery</Text>
                        </Pressable>
                    </View>
                </View>
                <View style={styles.field}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Your name"
                        placeholderTextColor={colors.inkMuted}
                        value={name}
                        onChangeText={setName}
                        onBlur={() => persistName(name.trim())}
                    />
                </View>
                <Text style={styles.sectionTitle}>About you</Text>
                <Pressable style={({pressed}) => [styles.row, pressed && styles.pressed]} onPress={() => navigation.navigate('Palette')}>
                    <View style={styles.rowIcon}><PaletteIcon size={17} color={colors.ink} /></View>
                    <View style={{flex: 1}}>
                        <Text style={styles.rowLabel}>My Palette</Text>
                        <Text style={styles.rowValue}>{season ? SEASON[season].label : 'Not set'}</Text>
                    </View>
                    <ChevronRight size={17} color={colors.inkMuted} />
                </Pressable>
                <Pressable style={({pressed}) => [styles.row, pressed && styles.pressed]} onPress={() => navigation.navigate('BodyShape')}>
                    <View style={styles.rowIcon}><Ruler size={17} color={colors.ink} /></View>
                    <View style={{flex: 1}}>
                        <Text style={styles.rowLabel}>Fit & Shape</Text>
                        <Text style={styles.rowValue}>
                            {bodyShape ? BODY_SHAPE[bodyShape].label : 'Not set'}{hasMeasurements ? ' · measurements saved' : ''}
                        </Text>
                    </View>
                    <ChevronRight size={17} color={colors.inkMuted} />
                </Pressable>
                <Pressable style={({pressed}) => [styles.row, pressed && styles.pressed]} onPress={() => navigation.navigate('Style')}>
                    <View style={styles.rowIcon}><Shirt size={17} color={colors.ink} /></View>
                    <View style={{flex: 1}}>
                        <Text style={styles.rowLabel}>My Style</Text>
                        <Text style={styles.rowValue}>{personalStyle.length ? personalStyle.map((s) => STYLE[s].label).join(', ') : 'Not set'}</Text>
                    </View>
                    <ChevronRight size={17} color={colors.inkMuted} />
                </Pressable>
                <Text style={styles.sectionTitle}>Account</Text>
                <Pressable style={({pressed}) => [styles.row, pressed && styles.pressed]} onPress={cycleAppearance}>
                    <View style={styles.rowIcon}><AppearanceIcon size={17} color={colors.ink} /></View>
                    <View style={{flex: 1}}>
                        <Text style={styles.rowLabel}>Appearance</Text>
                        <Text style={styles.rowValue}>{appearanceLabel}</Text>
                    </View>
                    <ChevronRight size={17} color={colors.inkMuted} />
                </Pressable>
                <Pressable style={({pressed}) => [styles.row, pressed && styles.pressed]} onPress={handleSignOut}>
                    <View style={styles.rowIcon}><LogOut size={17} color={colors.ink} /></View>
                    <View style={{flex: 1}}>
                        <Text style={styles.rowLabel}>Sign out</Text>
                    </View>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}
const getStyles = (colors, scheme) => StyleSheet.create({
    safe: {flex: 1, backgroundColor: colors.bg},
    scroll: {padding: spacing.lg, paddingBottom: 50},
    pressed: {opacity: 0.8},
    avatarRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.xl - 2},
    avatar: {width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceAlt},
    avatarPlaceholder: {width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line},
    avatarActions: {flex: 1, gap: spacing.sm},
    avatarBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.ink, paddingVertical: 9, borderRadius: radius.md, ...getShadow(scheme).button},
    avatarBtnAlt: {backgroundColor: colors.surfaceAlt, shadowOpacity: 0, elevation: 0},
    avatarBtnText: {fontFamily: fonts.textSemibold, color: colors.bg, fontSize: 12.5},
    field: {marginBottom: spacing.xl - 2},
    label: {fontFamily: fonts.textSemibold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.inkSoft, marginBottom: 7},
    input: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 14, color: colors.ink},
    sectionTitle: {fontFamily: fonts.displaySemibold, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.ink, marginBottom: spacing.xs},
    sectionSub: {fontSize: 12, color: colors.inkSoft, marginBottom: spacing.md + 2},
    row: {flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md + 1, marginBottom: spacing.sm + 2, ...getShadow(scheme).card},
    rowIcon: {width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center'},
    rowLabel: {fontFamily: fonts.textSemibold, fontSize: 14, color: colors.ink},
    rowValue: {fontSize: 12, color: colors.inkSoft, marginTop: 2},
});
