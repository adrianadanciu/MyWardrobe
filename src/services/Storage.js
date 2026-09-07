import {auth, db} from './FirebaseConfig';
import {doc, getDoc, setDoc, collection, getDocs, writeBatch} from 'firebase/firestore';
function requireUserId() {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('You need to be signed in first.');
    return userId;
}
async function loadAll(collectionName){
    const userId = requireUserId();
    const snap = await getDocs(collection(db, 'users', userId, collectionName));
    return snap.docs.map((d) => ({id: d.id, ...d.data()}));
}
async function saveAll(collectionName, items){
    const userId = requireUserId();
    const col = collection(db, 'users', userId, collectionName);
    const existing = await getDocs(col);
    const nextIds = new Set(items.map((i) => i.id));
    const batch = writeBatch(db);
    //deletes anything that's in firestore but not in the new list anymore
    existing.docs.forEach((d) => {
        if (!nextIds.has(d.id)) batch.delete(d.ref);
    });
    items.forEach((item) => {
        const {id, ...rest} = item;
        batch.set(doc(col, id), rest);
    });
    await batch.commit();
}
export async function loadItems(){
    try{
        return await loadAll('items');
    }
    catch (e){
        console.warn('Could not load the wardrobe', e);
        return [];
    }
}
export async function saveItems(items){
    await saveAll('items', items);
}
const PROFILE_DEFAULTS = {name: null, photoUri: null, season: null, bodyShape: null, personalStyle: [], bustCm: null, waistCm: null, hipsCm: null, shoulderVsHips: null};
export async function loadProfile(){
    try{
        const userId = requireUserId();
        const snap = await getDoc(doc(db, 'users', userId));
        const parsed = snap.exists() ? snap.data() : {};
        const profile = {...PROFILE_DEFAULTS, ...parsed};
        if (typeof profile.personalStyle === 'string'){
            profile.personalStyle = [profile.personalStyle];
        }
        else if (!Array.isArray(profile.personalStyle)){
            profile.personalStyle = [];
        }
        return profile;
    }
    catch (e){
        console.warn('Could not load the profile', e);
        return {...PROFILE_DEFAULTS};
    }
}
export async function saveProfile(profile){
    const userId = requireUserId();
    await setDoc(doc(db, 'users', userId), profile);
}
export async function loadBeautyItems(){
    try{
        return await loadAll('beautyItems');
    }
    catch (e){
        console.warn('Could not load beauty products', e);
        return [];
    }
}
export async function saveBeautyItems(items) {
    await saveAll('beautyItems', items);
}
export async function loadJournal(){
    try{
        return await loadAll('journal');
    }
    catch (e){
        console.warn('Could not load the journal', e);
        return [];
    }
}
export async function saveJournal(entries){
    const userId = requireUserId();
    const col = collection(db, 'users', userId, 'journal');
    const existing = await getDocs(col);
    const nextDates = new Set(entries.map((e) => e.date));
    const batch = writeBatch(db);
    existing.docs.forEach((d) => {
        if (!nextDates.has(d.id)) batch.delete(d.ref);
    });
    entries.forEach((entry) => {
        batch.set(doc(col, entry.date), entry);
    });
    await batch.commit();
}
export async function saveJournalEntry(date, itemIds, extra = {}) {
    const userId = requireUserId();
    const ref = doc(db, 'users', userId, 'journal', date);
    const existingSnap = await getDoc(ref);
    const existing = existingSnap.exists() ? existingSnap.data() : null;
    //quick unique id, don't need anything fancier than this
    const id = existing?.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
    await setDoc(ref, {id, date, itemIds, hairstyle: existing?.hairstyle || '', notes: existing?.notes || '', ...extra});
    return loadJournal();
}
export async function loadSavedPlans() {
    try {
        return await loadAll('plans');
    } catch (e) {
        console.warn('Could not load saved plans', e);
        return [];
    }
}
export async function saveSavedPlans(plans) {
    await saveAll('plans', plans);
}
