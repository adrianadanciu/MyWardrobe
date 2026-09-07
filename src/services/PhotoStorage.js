import {File} from 'expo-file-system';
import {auth} from './FirebaseConfig';
import {supabase, PHOTOS_BUCKET} from './SupabaseConfig';
function requireUserId() {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('You need to be signed in first.');
    return userId;
}
//this function uploads the photo taken by the user on supabase
export async function persistPhoto(tempUri, itemId) {
    const userId = requireUserId();
    const path = `${userId}/${itemId}.jpg`;
    const data = await new File(tempUri).arrayBuffer();
    const {error} = await supabase.storage.from(PHOTOS_BUCKET).upload(path, data, {contentType: 'image/jpeg', upsert: true});
    if (error) 
        throw error;
    return supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
}
export async function deletePhoto(uri) {
    if (!uri) return;
    try{
        const marker = `/${PHOTOS_BUCKET}/`;
        const idx = uri.indexOf(marker);
        if (idx === -1) return;
        const path = uri.slice(idx + marker.length);
        await supabase.storage.from(PHOTOS_BUCKET).remove([path]);
    }
    catch (e){
        console.warn('Could not delete the photo', e);
    }
}
