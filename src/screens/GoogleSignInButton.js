import React from 'react';
import {Text, Pressable, Alert} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import {useAuth} from '../auth/AuthContext';
//own component so Auth.js can skip mounting it when the client id isn't configured, since google's sign-in throws immediately if it's missing
export default function GoogleSignInButton({styles, busy, setBusy, authErrorMessage}) {
    const {signInWithGoogleToken} = useAuth();
    const [request, response, promptAsync] = Google.useAuthRequest({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    });
    React.useEffect(() => {
        if (response?.type === 'success') {
            const idToken = response.authentication?.idToken || response.params?.id_token;
            if (idToken) {
                setBusy(true);
                signInWithGoogleToken(idToken)
                    .catch((e) => Alert.alert('Could not sign in with Google', authErrorMessage(e)))
                    .finally(() => setBusy(false));
            }
        }
    }, [response]);
    return (
        <Pressable style={styles.googleBtn} onPress={() => promptAsync()} disabled={!request || busy}>
            <Text style={styles.googleBtnText}>Continue with Google</Text>
        </Pressable>
    );
}
