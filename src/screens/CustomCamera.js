import React, {useState, useRef, useCallback} from 'react';
import {View, Text, Pressable, Image, StyleSheet, ActivityIndicator, Alert, Linking} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CameraView, useCameraPermissions} from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import {X, RotateCcw, Zap, ZapOff, Check, RefreshCw} from 'lucide-react-native';
import {radius} from '../theme/tokens';
async function cropToViewfinder(uri, photoWidth, photoHeight, aspectRatio) {
    const photoAspect = photoWidth / photoHeight;
    let cropWidth, cropHeight, originX, originY;
    if (photoAspect > aspectRatio) {
        cropHeight = photoHeight;
        cropWidth = Math.round(photoHeight * aspectRatio);
        originX = Math.round((photoWidth - cropWidth) / 2);
        originY = 0;
    } 
    else{
        cropWidth = photoWidth;
        cropHeight = Math.round(photoWidth / aspectRatio);
        originX = 0;
        originY = Math.round((photoHeight - cropHeight) / 2);
    }
    return ImageManipulator.manipulateAsync(
        uri,
        [{crop: {originX, originY, width: cropWidth, height: cropHeight}}],
        {compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true}
    );
}
const FLASH_ORDER = ['off', 'auto', 'on'];
export default function CustomCamera({navigation, route}) {
    const insets = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();
    const [facing, setFacing] = useState('back');
    const [flash, setFlash] = useState('off');
    const [wrapSize, setWrapSize] = useState(null);
    const [captured, setCaptured] = useState(null); 
    const [capturing, setCapturing] = useState(false);
    const [processing, setProcessing] = useState(false);
    const cameraRef = useRef(null);
    const aspect = route?.params?.aspect || [1, 1];
    const aspectRatio = aspect[0] / aspect[1];
    const onCapture = route?.params?.onCapture;
    const handleClose = useCallback(() => navigation.goBack(), [navigation]);
    const cycleFlash = () => {
        setFlash((f) => FLASH_ORDER[(FLASH_ORDER.indexOf(f) + 1) % FLASH_ORDER.length]);
    };
    const toggleFacing = () => setFacing((f) => (f === 'back' ? 'front' : 'back'));
    const handleCapture = async () => {
        if (!cameraRef.current || capturing) 
            return;
        setCapturing(true);
        try{
            const photo = await cameraRef.current.takePictureAsync({quality: 0.9, exif: false});
            setCaptured({uri: photo.uri, width: photo.width, height: photo.height});
        } 
        catch (e){
            Alert.alert('Error', "Couldn't take the photo. Try again.");
        } 
        finally{
            setCapturing(false);
        }
    };
    const handleRetake = () => setCaptured(null);
    const handleConfirm = async () => {
        if (!captured) return;
        setProcessing(true);
        try{
            const result = await cropToViewfinder(captured.uri, captured.width, captured.height, aspectRatio);
            onCapture && onCapture({uri: result.uri, base64: result.base64});
            navigation.goBack();
        } 
        catch (e){
            setProcessing(false);
            Alert.alert('Error', "Couldn't process the photo. Try again.");
        }
    };
    if (!permission) {
        return (
            <View style={[styles.root, styles.center]}>
                <ActivityIndicator color="#fff" />
            </View>
        );
    }
    if (!permission.granted) {
        return (
            <View style={[styles.root, styles.center, {padding: 24}]}>
                <Text style={styles.permissionTitle}>Camera access needed</Text>
                <Text style={styles.permissionText}>
                    Allow camera access so the app can take a photo of your item.
                </Text>
                <Pressable
                    style={styles.permissionBtn}
                    onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
                >
                    <Text style={styles.permissionBtnText}>
                        {permission.canAskAgain ? 'Allow camera access' : 'Open Settings'}
                    </Text>
                </Pressable>
                <Pressable style={styles.permissionCancel} onPress={handleClose}>
                    <Text style={styles.permissionCancelText}>Cancel</Text>
                </Pressable>
            </View>
        );
    }
    let boxWidth = 0;
    let boxHeight = 0;
    if (wrapSize) {
        boxWidth = wrapSize.width;
        boxHeight = boxWidth / aspectRatio;
        if (boxHeight > wrapSize.height) {
            boxHeight = wrapSize.height;
            boxWidth = boxHeight * aspectRatio;
        }
    }
    const FlashIcon = flash === 'off' ? ZapOff : Zap;
    return(
        <View style={styles.root}>
            <View style={[styles.topBar, {paddingTop: insets.top + 8}]}>
                <Pressable style={styles.iconBtn} onPress={handleClose} hitSlop={10}>
                    <X size={22} color="#fff" />
                </Pressable>
                <Text style={styles.title}>{captured ? 'Review photo' : 'Frame your shot'}</Text>
                {captured ? (
                    <View style={styles.iconBtn} />
                ) : (
                    <Pressable style={styles.iconBtn} onPress={cycleFlash} hitSlop={10}>
                        <FlashIcon size={20} color="#fff" />
                        <Text style={styles.flashLabel}>{flash}</Text>
                    </Pressable>
                )}
            </View>
            <View style={styles.viewfinderWrap} onLayout={(e) => setWrapSize(e.nativeEvent.layout)}>
                {wrapSize && (
                    captured ? (
                        <Image
                            source={{uri: captured.uri}}
                            style={[styles.box, {width: boxWidth, height: boxHeight}]}
                        />
                    ) : (
                        <CameraView
                            ref={cameraRef}
                            style={[styles.box, {width: boxWidth, height: boxHeight}]}
                            facing={facing}
                            flash={flash}
                            mode="picture"
                        >
                            <View pointerEvents="none" style={styles.gridOverlay}>
                                <View style={[styles.gridLine, styles.gridLineV, {left: '33.333%'}]} />
                                <View style={[styles.gridLine, styles.gridLineV, {left: '66.666%'}]} />
                                <View style={[styles.gridLine, styles.gridLineH, {top: '33.333%'}]} />
                                <View style={[styles.gridLine, styles.gridLineH, {top: '66.666%'}]} />
                            </View>
                        </CameraView>
                    )
                )}
            </View>
            <View style={[styles.bottomBar, {paddingBottom: insets.bottom + 20}]}>
                {captured ? (
                    <View style={styles.confirmRow}>
                        <Pressable style={styles.secondaryBtn} onPress={handleRetake} disabled={processing}>
                            <RefreshCw size={17} color="#fff" />
                            <Text style={styles.secondaryBtnText}>Retake</Text>
                        </Pressable>
                        <Pressable style={styles.primaryBtn} onPress={handleConfirm} disabled={processing}>
                            {processing ? (
                                <ActivityIndicator color="#16171A" />
                            ) : (
                                <>
                                    <Check size={17} color="#16171A" />
                                    <Text style={styles.primaryBtnText}>Use photo</Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                ) : (
                    <View style={styles.captureRow}>
                        <View style={styles.sideSpacer} />
                        <Pressable style={styles.shutterOuter} onPress={handleCapture} disabled={capturing}>
                            <View style={styles.shutterInner} />
                        </Pressable>
                        <Pressable style={styles.sideSpacer} onPress={toggleFacing} hitSlop={10}>
                            <RotateCcw size={24} color="#fff" />
                        </Pressable>
                    </View>
                )}
            </View>
        </View>
    );
}
const styles = StyleSheet.create({
    root: {flex: 1, backgroundColor: '#000'},
    center: {alignItems: 'center', justifyContent: 'center'},
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 10,
    },
    iconBtn: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
    title: {color: '#fff', fontSize: 14, fontWeight: '600'},
    flashLabel: {color: '#fff', fontSize: 9, textTransform: 'uppercase', marginTop: 1, letterSpacing: 0.5},
    viewfinderWrap: {flex: 1, alignItems: 'center', justifyContent: 'center'},
    box: {borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#111'},
    gridOverlay: {...StyleSheet.absoluteFillObject},
    gridLine: {position: 'absolute', backgroundColor: 'rgba(255,255,255,0.35)'},
    gridLineV: {top: 0, bottom: 0, width: StyleSheet.hairlineWidth},
    gridLineH: {left: 0, right: 0, height: StyleSheet.hairlineWidth},
    bottomBar: {paddingTop: 18, paddingHorizontal: 24},
    captureRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    sideSpacer: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
    shutterOuter: {
        width: 76, height: 76, borderRadius: 38,
        borderWidth: 4, borderColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center', justifyContent: 'center',
    },
    shutterInner: {width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff'},
    confirmRow: {flexDirection: 'row', gap: 12},
    secondaryBtn: {
        flex: 1, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderRadius: radius.md, paddingVertical: 13,
    },
    secondaryBtnText: {color: '#fff', fontWeight: '700', fontSize: 14},
    primaryBtn: {
        flex: 1, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#fff', borderRadius: radius.md, paddingVertical: 13,
    },
    primaryBtnText: {color: '#16171A', fontWeight: '700', fontSize: 14},
    permissionTitle: {color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 8, textAlign: 'center'},
    permissionText: {color: 'rgba(255,255,255,0.75)', fontSize: 13.5, textAlign: 'center', marginBottom: 20, lineHeight: 19},
    permissionBtn: {backgroundColor: '#fff', borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 28},
    permissionBtnText: {color: '#16171A', fontWeight: '700', fontSize: 14},
    permissionCancel: {marginTop: 14, paddingVertical: 8, paddingHorizontal: 20},
    permissionCancelText: {color: 'rgba(255,255,255,0.6)', fontSize: 13},
});