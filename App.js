import React, {useEffect, useState} from 'react';
import {Text, TextInput} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold} from '@expo-google-fonts/manrope';
import {PlayfairDisplay_800ExtraBold, PlayfairDisplay_900Black} from '@expo-google-fonts/playfair-display';
import {NavigationContainer, DefaultTheme, DarkTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider, SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {House, WashingMachine, Droplet, BookOpen, CalendarDays} from 'lucide-react-native';
import {ThemeProvider, useTheme} from './src/theme/ThemeContext';
import {fonts} from './src/theme/tokens';
import {AuthProvider, useAuth} from './src/auth/AuthContext';
import Auth from './src/screens/Auth';
import LaunchScreen from './src/screens/Launch';
import Home from './src/screens/Home';
import AddItem from './src/screens/AddItem';
import EditItem from './src/screens/EditItem';
import Palette from './src/screens/Palette';
import BodyShape from './src/screens/BodyShape';
import Style from './src/screens/Style';
import Profile from './src/screens/Profile';
import Advice from './src/screens/Advice';
import Beauty from './src/screens/Beauty';
import BeautyCategory from './src/screens/BeautyCategory';
import AddBeautyItem from './src/screens/AddBeautyItem';
import EditBeautyItem from './src/screens/EditBeautyItem';
import Journal from './src/screens/Journal';
import Laundry from './src/screens/Laundry';
import Plan from './src/screens/Plan';
import CustomCamera from './src/screens/CustomCamera';
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = [{fontFamily: fonts.textRegular}, Text.defaultProps.style];
TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.style = [{fontFamily: fonts.textRegular}, TextInput.defaultProps.style];
SplashScreen.preventAutoHideAsync().catch(() => {});
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const TAB_ICONS = {
    Home: House,
    Laundry: WashingMachine,
    Beauty: Droplet,
    Journal: BookOpen,
    Plan: CalendarDays,
};
function MainTabs() {
    const {colors} = useTheme();
    const insets = useSafeAreaInsets();
    return (
        <Tab.Navigator
            screenOptions={({route}) => ({
                headerShown: route.name !== 'Home',
                headerStyle: {backgroundColor: colors.bg},
                headerTintColor: colors.ink,
                headerShadowVisible: false,
                headerTitleStyle: {fontFamily: fonts.displaySemibold, fontSize: 17},
                tabBarActiveTintColor: colors.accent,
                tabBarInactiveTintColor: colors.inkMuted,
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.line,
                    borderTopWidth: 1,
                    height: 56 + insets.bottom,
                    paddingTop: 8,
                    paddingBottom: Math.max(insets.bottom, 8),
                },
                tabBarLabelStyle: {fontFamily: fonts.textSemibold, fontSize: 10.5},
                tabBarIcon: ({color, size}) => {
                    const Icon = TAB_ICONS[route.name] || House;
                    return <Icon color={color} size={size ?? 22} />;
                },
            })}
        >
            <Tab.Screen name="Home" component={Home} />
            <Tab.Screen name="Laundry" component={Laundry} options={{title: 'Laundry'}} />
            <Tab.Screen name="Beauty" component={Beauty} options={{title: 'Beauty'}} />
            <Tab.Screen name="Journal" component={Journal} options={{title: 'Outfit Journal', tabBarLabel: 'Journal'}} />
            <Tab.Screen name="Plan" component={Plan} options={{title: 'Plan Ahead', tabBarLabel: 'Plan'}} />
        </Tab.Navigator>
    );
}
function Navigation() {
    const {colors, resolvedScheme} = useTheme();
    const navTheme = resolvedScheme === 'dark'
        ? {...DarkTheme, colors: {...DarkTheme.colors, background: colors.bg, card: colors.bg, text: colors.ink, border: colors.line, primary: colors.accent}}
        : {...DefaultTheme, colors: {...DefaultTheme.colors, background: colors.bg, card: colors.bg, text: colors.ink, border: colors.line, primary: colors.accent}};
    return(
        <NavigationContainer theme={navTheme}>
            <Stack.Navigator
                screenOptions={{
                    headerStyle: {backgroundColor: colors.bg},
                    headerTintColor: colors.ink,
                    headerShadowVisible: false,
                    headerTitleStyle: {fontWeight: '700', fontFamily: fonts.displaySemibold},
                    contentStyle: {backgroundColor: colors.bg},
                }}
            >
                <Stack.Screen name="MainTabs" component={MainTabs} options={{headerShown: false}} />
                <Stack.Screen name="AddItem" component={AddItem} options={{title: 'New Item'}} />
                <Stack.Screen name="EditItem" component={EditItem} options={{title: 'Edit Item'}} />
                <Stack.Screen name="Palette" component={Palette} options={{title: 'My Palette'}} />
                <Stack.Screen name="BodyShape" component={BodyShape} options={{title: 'Fit & Shape'}} />
                <Stack.Screen name="Style" component={Style} options={{title: 'My Style'}} />
                <Stack.Screen name="Profile" component={Profile} options={{title: 'Profile'}} />
                <Stack.Screen name="Advice" component={Advice} options={{title: 'Ask for Ideas'}} />
                <Stack.Screen name="BeautyCategory" component={BeautyCategory} />
                <Stack.Screen name="AddBeautyItem" component={AddBeautyItem} options={{title: 'New Product'}} />
                <Stack.Screen name="EditBeautyItem" component={EditBeautyItem} options={{title: 'Edit Product'}} />
                <Stack.Screen
                    name="CustomCamera"
                    component={CustomCamera}
                    options={{headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom'}}
                />
            </Stack.Navigator>
            <StatusBar style={colors.statusBar} />
        </NavigationContainer>
    );
}
function Gate() {
    const {colors} = useTheme();
    const {user, initializing} = useAuth();
    if (initializing){
        return <SafeAreaView style={{flex: 1, backgroundColor: colors.bg}} />;
    }
    return user ? <Navigation /> : <Auth />;
}
const MIN_LAUNCH_MS = 1100;
function AppShell() {
    const {initializing} = useAuth();
    const [minTimeElapsed, setMinTimeElapsed] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setMinTimeElapsed(true), MIN_LAUNCH_MS);
        return () => clearTimeout(t);
    }, []);
    if (initializing || !minTimeElapsed) {
        return <LaunchScreen />;
    }
    return <Gate />;
}
export default function App() {
    const [fontsLoaded, fontError] = useFonts({
        Manrope_400Regular,
        Manrope_500Medium,
        Manrope_600SemiBold,
        Manrope_700Bold,
        Manrope_800ExtraBold,
        PlayfairDisplay_800ExtraBold,
        PlayfairDisplay_900Black,
    });
    useEffect(() => {
        if (fontError){
            console.warn('Font loading failed, falling back to system font:', fontError);
        }
    }, [fontError]);
    useEffect(() => {
        if (fontsLoaded || fontError) {
            SplashScreen.hideAsync().catch(() => {});
        }
    }, [fontsLoaded, fontError]);
    if (!fontsLoaded && !fontError){
        return null;
    }
    return(
        <SafeAreaProvider>
            <ThemeProvider>
                <AuthProvider>
                    <AppShell />
                </AuthProvider>
            </ThemeProvider>
        </SafeAreaProvider>
    );
}
