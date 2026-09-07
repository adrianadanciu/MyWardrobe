import {WARMTH_RULES} from '../constants/Wardrobe';
//returns today's date
export const todayIso = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};
//if the user writes only the year, the first of july is auto-filled because it's in the middle of the year, for better 
//calculations
export function normalizeDateInput(value) {
    const trimmed = (value || '').trim();
    if (/^\d{4}$/.test(trimmed)) return `${trimmed}-07-01`;
    return trimmed;
}
//calculates how many dates has been since a specific date
export function daysBetween(iso) {
    if (!iso) return null;
    const d = new Date(iso + 'T00:00:00');
    const now = new Date();
    return Math.floor((now - d) / 86400000);
}
export function ageLabel(iso) {
    const days = daysBetween(iso);
    if (days === null) return '-';
    if (days < 1) return 'today';
    if (days < 30) return `${days} day${days === 1 ? '' : 's'}`;
    if (days < 365) {
        const m = Math.floor(days / 30);
        return `${m} month${m === 1 ? '' : 's'}`;
    }
    const y = Math.floor(days / 365);
    const remM = Math.floor((days % 365) / 30);
    return `${y} year${y === 1 ? '' : 's'}${remM ? ` ${remM} month${remM === 1 ? '' : 's'}` : ''}`;
}
export function lastWornLabel(iso) {
    if (!iso) return 'never worn';
    const days = daysBetween(iso);
    if (days === 0) return 'worn today';
    if (days === 1) return 'worn yesterday';
    return `worn ${days} days ago`;
}
export const NEGLECT_THRESHOLD_DAYS = 120;
export function isNeglectedItem(item, thresholdDays = NEGLECT_THRESHOLD_DAYS, currentBracket = null){
    if (item.neglectDismissed) 
        return false;
    const daysOwned = daysBetween(item.dateAdded);
    if (daysOwned === null || daysOwned < thresholdDays) 
        return false;
    const daysSinceWorn = item.lastWorn ? daysBetween(item.lastWorn) : daysOwned;
    if (daysSinceWorn < thresholdDays) 
        return false;
    if (currentBracket && item.warmth) {
        const rules = WARMTH_RULES[currentBracket]?.[item.category] || WARMTH_RULES[currentBracket]?.top;
        if (rules && !rules.includes(item.warmth)) 
            return false;
    }
    return true;
}
