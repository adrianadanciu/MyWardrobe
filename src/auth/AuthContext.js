import React, {createContext, useContext, useEffect, useState} from 'react';
import {
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    signInWithCredential,
    GoogleAuthProvider,
} from 'firebase/auth';
import {auth} from '../services/FirebaseConfig';
const AuthContext = createContext(null);
export function AuthProvider({children}) {
    const [user, setUser] = useState(null);
    const [initializing, setInitializing] = useState(true);
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            setInitializing(false);
        });
        return unsubscribe;
    }, []);
    const signUp = (email, password) => createUserWithEmailAndPassword(auth, email, password);
    const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
    const signOutUser = () => signOut(auth);
    const signInWithGoogleToken = (idToken) => signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return (
        <AuthContext.Provider value={{user, initializing, signUp, signIn, signOutUser, signInWithGoogleToken}}>
            {children}
        </AuthContext.Provider>
    );
}
export function useAuth() {
    return useContext(AuthContext);
}
