function hexToRgb(hex) {
    const clean = (hex || '').replace('#', '');
    if (clean.length !== 6) return null;
    const num = parseInt(clean, 16);
    if (Number.isNaN(num)) return null;
    return {r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255};
}
function colorDistance(hexA, hexB) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    if (!a || !b) return Infinity;
    return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}
const COLOR_MATCH_THRESHOLD = 10;
//normalizes the name so it can be compared
function normalizeName(name) {
    return (name || '').trim().toLowerCase();
}
function namesOverlap(nameA, nameB) {
    const a = normalizeName(nameA);
    const b = normalizeName(nameB);
    if (!a || !b) 
        return false;
    if (a === b || a.includes(b) || b.includes(a)) 
        return true;
    const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 2));
    const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 2));
    if (!wordsA.size || !wordsB.size) 
        return false;
    let shared = 0;
    wordsA.forEach((w) => {if (wordsB.has(w)) shared += 1;});
    return shared / Math.min(wordsA.size, wordsB.size) >= 0.5;
}
export function findPossibleDuplicates(items, candidate, excludeId = null){
    if (!candidate || !candidate.category) 
        return [];
    return items
        .filter((item) => item.id !== excludeId)
        .filter((item) => item.category === candidate.category)
        .filter((item) => colorDistance(item.colorHex, candidate.colorHex) <= COLOR_MATCH_THRESHOLD)
        .filter((item) => !candidate.name || !item.name || namesOverlap(item.name, candidate.name))
        .sort((a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || ''));
}