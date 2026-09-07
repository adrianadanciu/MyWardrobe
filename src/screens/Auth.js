import React, {useMemo, useState} from 'react';
import {View, Text, TextInput, Pressable, Alert, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import {useAuth} from '../auth/AuthContext';
import {useTheme} from '../theme/ThemeContext';
import GoogleSignInButton from './GoogleSignInButton';
import {radius} from '../theme/tokens';
WebBrowser.maybeCompleteAuthSession();
//the sign-in button stays hidden until the platform's google client id exists in .env, instead of crashing where it's not set up
const GOOGLE_CONFIGURED = Platform.select({
    ios: !!process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    android: !!process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    default: !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});
//turns a firebase error code into something readable instead of showing "auth/wrong-password" to the user
function authErrorMessage(e) {
    const code = e?.code || '';
    if (code.includes('email-already-in-use')) return 'An account already exists with this email.';
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Incorrect email or password.';
    if (code.includes('weak-password')) return 'Password should be at least 6 characters.';
    if (code.includes('invalid-email')) return 'That email address looks invalid.';
    return 'Something went wrong. Please try again.';
}
export default function Auth() {
    const {colors} = useTheme();
    const styles = useMemo(() => getStyles(colors), [colors]);
    const {signIn, signUp} = useAuth();
    const [mode, setMode] = useState('signIn'); // 'signIn' | 'signUp'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        if (!email.trim() || !password) {
            Alert.alert('Missing info', 'Please enter both an email and a password.');
            return;
        }
        setBusy(true);
        try {
            if (mode === 'signUp') {
                await signUp(email.trim(), password);
            } else {
                await signIn(email.trim(), password);
            }
        } catch (e) {
            Alert.alert(mode === 'signUp' ? "Couldn't create account" : "Couldn't sign in", authErrorMessage(e));
        } finally {
            setBusy(false);
        }
    };
    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.content}>
                    <Text style={styles.title}>MyWardrobe</Text>
                    <Text style={styles.subtitle}>{mode === 'signUp' ? 'Create your account' : 'Sign in to continue'}</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor={colors.inkSoft}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor={colors.inkSoft}
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />
                    <Pressable style={styles.primaryBtn} onPress={submit} disabled={busy}>
                        {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.primaryBtnText}>{mode === 'signUp' ? 'Create account' : 'Sign in'}</Text>}
                    </Pressable>
                    {GOOGLE_CONFIGURED && (
                        <GoogleSignInButton styles={styles} busy={busy} setBusy={setBusy} authErrorMessage={authErrorMessage} />
                    )}
                    <Pressable style={styles.switchBtn} onPress={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}>
                        <Text style={styles.switchText}>
                            {mode === 'signUp' ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
                        </Text>
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
const getStyles = (colors) => StyleSheet.create({
    safe: {flex: 1, backgroundColor: colors.bg},
    flex: {flex: 1},
    content: {flex: 1, justifyContent: 'center', padding: 24},
    title: {fontSize: 28, fontWeight: '800', color: colors.ink, textAlign: 'center', marginBottom: 6},
    subtitle: {fontSize: 14, color: colors.inkSoft, textAlign: 'center', marginBottom: 28},
    input: {backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, padding: 14, fontSize: 15, color: colors.ink, marginBottom: 12},
    primaryBtn: {backgroundColor: colors.ink, paddingVertical: 15, borderRadius: radius.md, alignItems: 'center', marginTop: 6},
    primaryBtnText: {color: colors.bg, fontWeight: '700', fontSize: 15},
    googleBtn: {backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, paddingVertical: 15, borderRadius: radius.md, alignItems: 'center', marginTop: 12},
    googleBtnText: {color: colors.ink, fontWeight: '700', fontSize: 15},
    switchBtn: {marginTop: 20, alignItems: 'center'},
    switchText: {color: colors.inkSoft, fontSize: 13, textDecorationLine: 'underline'},
});
