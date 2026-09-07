export const BEAUTY_CATEGORY = {
    skincare: {label: 'Skincare'},
    makeup: {label: 'Makeup'},
    haircare: {label: 'Haircare'},
    fragrance: {label: 'Fragrance'},
    dental: {label: 'Dental Care'},
    body: {label: 'Body Care'},
    nail: {label: 'Nail Care'},
};
export const BEAUTY_CATEGORY_ORDER = ['skincare', 'makeup', 'haircare', 'fragrance', 'dental', 'body', 'nail'];
//products can belong in more than one routine
export const ROUTINE = {
    morning: {label: 'Morning'},
    night: {label: 'Night'},
    makeup: {label: 'Makeup'},
    makeupRemoval: {label: 'Makeup removal'},
    hairWash: {label: 'Hair wash'},
    hairStyling: {label: 'Hair styling'},
    weekly: {label: 'Weekly / as needed'},
};
export const ROUTINE_ORDER = ['morning', 'night', 'makeup', 'makeupRemoval', 'hairWash', 'hairStyling', 'weekly'];
export const LEVEL = {
    full: {label: 'Full', color: '#61ae3f'},
    half: {label: 'Half', color: '#c9c43b'},
    low: {label: 'Low', color: '#cd6517'},
    empty: {label: 'Empty', color: '#ff0000'},
};
export const LEVEL_ORDER = ['full', 'half', 'low', 'empty'];
//the number of miliseconds in a day
//javascript works only with miliseconds
const dayMs = 86400000;
//represents a string in iso format, used for calendar dates
const daysSince = (iso) => (iso ? Math.floor((new Date() - new Date(iso + 'T00:00:00')) / dayMs) : null);
export function openedLabel(iso) {
    const days = daysSince(iso);
    if (days === null) return 'not opened yet';
    if (days < 1) return 'opened today';
    if (days < 30) return `opened ${days} day${days === 1 ? '' : 's'} ago`;
    const m = Math.floor(days / 30);
    return `opened ${m} month${m === 1 ? '' : 's'} ago`;
}
//if a product is opened, it's obviously used, so lastUsed is also updated
export function usedLabel(item) {
    const usedDays = daysSince(item.lastUsed);
    const days = usedDays !== null ? usedDays : daysSince(item.dateOpened);
    if (days === null) return 'never used';
    if (days === 0) return 'used today';
    if (days === 1) return 'used yesterday';
    return `used ${days} days ago`;
}
//period after opening, won't work if the item is a tool
export function expiryStatus(item) {
    if (item.isTool || !item.dateOpened || !item.paoMonths) return null;
    const opened = new Date(item.dateOpened + 'T00:00:00');
    const expiry = new Date(opened);
    expiry.setMonth(expiry.getMonth() + item.paoMonths);
    const daysLeft = Math.floor((expiry - new Date()) / dayMs);
    if (daysLeft < 0) return 'expired';
    if (daysLeft <= 30) return 'expiring-soon';
    return 'fresh';
}
export function expiryLabel(item) {
    const status = expiryStatus(item);
    if (!status) return null;
    if (status === 'expired') return 'Expired';
    if (status === 'expiring-soon') return 'Expiring soon';
    return null; //so it doesn't clutter the user interface when everything is fine
}
export function lowOrExpired(item) {
    if (item.isTool) return false;
    if (item.level === 'empty' || item.level === 'low') return true;
    return expiryStatus(item) === 'expired';
}
//asks user if they want to restock a low/expired product
export function restockPending(item) {
    if (item.retired) return false;
    if (!lowOrExpired(item)) return false;
    return item.restockConfirmed !== true && item.restockConfirmed !== false;
}
export function needsRestock(item) {
    if (item.retired) return false;
    if (!lowOrExpired(item)) return false;
    return item.restockConfirmed === true;
}
//beauty products become unused after 90 days
export const BEAUTY_NEGLECT_THRESHOLD_DAYS = 90;
//neglected products are only ones which have been already used at least once
export function isNeglectedProduct(item, thresholdDays = BEAUTY_NEGLECT_THRESHOLD_DAYS) {
    if (item.retired || !item.dateOpened) return false;
    const daysOpened = daysSince(item.dateOpened);
    if (daysOpened === null || daysOpened < thresholdDays) return false;
    const daysSinceUsed = item.lastUsed ? daysSince(item.lastUsed) : daysOpened;
    return daysSinceUsed >= thresholdDays;
}
//suggests what to do with the neglected product
export const NEGLECT_REASONS = [
    {key: 'mismatch', label: "Doesn't suit me"},
    {key: 'forgot', label: 'Forgot I had it'},
    {key: 'expired', label: 'Might be off/expired'},
    {key: 'duplicate', label: 'I have a similar one'},
];
//rough, typical period-after-opening (in months) by product type
const ESTIMATED_PAO_KEYWORDS = [
    [9, ['foundation', 'bb cream', 'cc cream', 'concealer', 'mascara', 'liquid eyeliner', 'cream blush', 'cream contour', 'primer']],
    [24, ['eyeshadow', 'palette', 'powder', 'blush', 'bronzer', 'contour', 'highlighter', 'eyebrow']],
    [15, ['lipstick', 'lip liner', 'gloss']],
];
//category-level fallback
const ESTIMATED_PAO_CATEGORY_DEFAULT = {skincare: 9, makeup: 18, haircare: 18, body: 18, nail: 12};
function estimatedPaoMonths(item) {
    if (item.isTool) return null;
    const searchText = `${item.type || ''} ${item.name || ''}`.toLowerCase();
    const match = ESTIMATED_PAO_KEYWORDS.find(([, keywords]) => keywords.some((k) => searchText.includes(k)));
    if (match) return match[0];
    return ESTIMATED_PAO_CATEGORY_DEFAULT[item.category] ?? null;
}

export function expiryEstimate(item) {
    if (item.isTool || !item.dateOpened) return null;
    if (item.paoMonths) {
        const status = expiryStatus(item);
        return status ? {status, months: item.paoMonths, confirmed: true} : null;
    }
    const months = estimatedPaoMonths(item);
    if (!months) return null;
    const opened = new Date(item.dateOpened + 'T00:00:00');
    const expiry = new Date(opened);
    expiry.setMonth(expiry.getMonth() + months);
    const daysLeft = Math.floor((expiry - new Date()) / dayMs);
    const status = daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'expiring-soon' : 'fresh';
    return {status, months, confirmed: false};
}
//concrete next-step advice for a neglected product
export function neglectReasonAdvice(item, reasonKey) {
    if (reasonKey === 'mismatch') {
        return "If the shade or formula never worked for you, that's not going to change. Worth giving it away or selling it rather than letting it take up space.";
    }
    if (reasonKey === 'forgot') {
        return "Easy fix, work it back into your routine this week so it's not out of sight again. If it still doesn't stick after that, it's probably not one to keep.";
    }
    if (reasonKey === 'expired') {
        const estimate = expiryEstimate(item);
        if (!estimate) {
            return "No open date on file, so there's nothing to check it against. If the texture or smell seems off at all, it's safer to toss it than risk it.";
        }
        const monthsLabel = `${estimate.months} month${estimate.months === 1 ? '' : 's'}`;
        if (estimate.status === 'expired') {
            return estimate.confirmed
                ? `Past its ${monthsLabel} use-by window, probably not safe on your skin anymore. Worth tossing rather then deciding if it's worth restocking.`
                : `Products like this typically last around ${monthsLabel} once opened and this one's well past that. Probably expired, check the texture and smell before using it again and toss it if anything's off.`;
        }
        if (estimate.status === 'expiring-soon') {
            return `Getting close to its typical ${monthsLabel} shelf life. Use it up over the next few weeks, or let it go before it turns.`;
        }
        return `Still within its typical ${monthsLabel} shelf life, so it's probably not the product itself. Check the texture and smell to be sure, and if it's fine, maybe the real issue is the shade or the routine.`;
    }
    if (reasonKey === 'duplicate') {
        return 'No need to keep two of the same thing in rotation. Worth giving this one away or selling it instead of storing it unused.';
    }
    return null;
}
//each category has a counting block so they don't interfere with each other
const ROUTINE_STEP_CATEGORY_BASE = {
    skincare: 0,
    makeup: 20,
    haircare: 40,
    body: 50,
    dental: 60,
    nail: 70,
    fragrance: 80,
};
//common application order within each category
const ROUTINE_STEP_KEYWORDS = {
    skincare: [
        ['cleanser', 'cleansing', 'wash', 'makeup remover', 'micellar', 'cleansing balm', 'cleansing oil'],
        ['exfoliant', 'peeling', 'scrub'],
        ['toner', 'tonic', 'essence'],
        ['serum'],
        ['eye cream'],
        ['spot treatment'],
        ['moisturizer', 'moisturiser'],
        ['facial oil'],
        ['spf', 'sunscreen'],
    ],
    makeup: [
        ['primer'],
        ['foundation', 'bb cream', 'cc cream'],
        ['concealer'],
        ['powder'],
        ['contour', 'bronzer', 'highlighter'],
        ['blush'],
        ['eyeshadow', 'eyeliner', 'mascara'],
        ['eyebrow'],
        ['lipstick', 'lip liner', 'gloss'],
        ['setting spray'],
    ],
    haircare: [
        ['shampoo'],
        ['conditioner'],
        ['hair mask'],
        ['leave-in', 'treatment'],
        ['styling'],
    ],
};
//in case a product doesn't fit any routines
const ROUTINE_STEP_UNKNOWN_OFFSET = 15;
//guess position of a product within its routine's real application order
export function guessRoutineStep(item){
    //in case a product doesn't fit any routine, it uses 90 as a fallback
    const base = ROUTINE_STEP_CATEGORY_BASE[item.category] ?? 90;
    const steps = ROUTINE_STEP_KEYWORDS[item.category];
    if (!steps) return base;
    //searches for a name which can predict the order in the routine
    const searchText = `${item.type || ''} ${item.name || ''}`.toLowerCase();
    //searches for the position in the routine order
    //it verifies if at least one k word appears in the routine set beforehand
    const idx = steps.findIndex((keywords) => keywords.some((k) => searchText.includes(k)));
    return idx === -1 ? base + ROUTINE_STEP_UNKNOWN_OFFSET : base + idx;
}
//user keyboard based routine
export function routineStepValue(item) {
    return typeof item.routineStep === 'number' && !Number.isNaN(item.routineStep)
        ? item.routineStep
        : guessRoutineStep(item);
}
