import {Platform} from 'react-native';
import * as Haptics from 'expo-haptics';
const isSupported = Platform.OS === 'ios' || Platform.OS === 'android';
export const haptics = {
    tap: () => {
        if (!isSupported) return;
        Haptics.selectionAsync().catch(() => {});
    },
    success: () => {
        if (!isSupported) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    light: () => {
        if (!isSupported) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    warn: () => {
        if (!isSupported) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    },
};
