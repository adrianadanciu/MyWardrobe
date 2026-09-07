import {WASHABLE_CATEGORIES, WASH_THRESHOLD} from '../constants/Wardrobe';
export function isWashable(item){
    return WASHABLE_CATEGORIES.includes(item.category);
}
export function isDirty(item){
    if (!isWashable(item)) return false;
    if (item.dirty) return true;
    const threshold = WASH_THRESHOLD[item.category] ?? 1;
    return (item.wearsSinceWash || 0) >= threshold;
}
export function wearsUntilWash(item){
    if (!isWashable(item)) return null;
    if (item.dirty) return 0;
    const threshold = WASH_THRESHOLD[item.category] ?? 1;
    return Math.max(0, threshold - (item.wearsSinceWash || 0));
}
export function recordWearForLaundry(item){
    if (!isWashable(item)) return item;
    return {...item, wearsSinceWash: (item.wearsSinceWash || 0) + 1};
}
export function markWashed(item) {
    return {...item, wearsSinceWash: 0, dirty: false};
}
export function markDirty(item) {
    return {...item, dirty: true};
}
