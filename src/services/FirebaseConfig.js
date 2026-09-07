import {initializeApp, getApps} from 'firebase/app';
//getReactNativePersistence saves the sessions and the user who is logged in
import {initializeAuth, getReactNativePersistence, getAuth} from 'firebase/auth';
import {initializeFirestore, getFirestore, persistentLocalCache} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
let authInstance;
try{
    authInstance = initializeAuth(firebaseApp, {persistence: getReactNativePersistence(AsyncStorage)});
} 
catch (e){
    authInstance = getAuth(firebaseApp);
}
export const auth = authInstance;
let dbInstance;
try{
    dbInstance = initializeFirestore(firebaseApp, {localCache: persistentLocalCache({})});
} 
catch (e){
    dbInstance = getFirestore(firebaseApp);
}
export const db = dbInstance;
