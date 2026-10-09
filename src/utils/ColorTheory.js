import {WARMTH_RULES, WARMTH_ORDER, TOP_CATEGORIES, PANTS_CATEGORIES, BOTTOM_CATEGORIES} from '../constants/Wardrobe';
import {SEASON} from '../constants/ColorSeasons';
import {BODY_SHAPE, FIT} from '../constants/BodyShapes';
import {STRICT_OCCASIONS} from '../constants/Occasions';
import {daysBetween} from './Dates';
import {isDirty} from './Laundry';
//this function transform a color from the hexazecimal format to hue, saturation and lightness
export function hexToHsl(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            default: h = (r - g) / d + 4;
        }
        h *= 60;
    }
    return {h, s: s * 100, l: l * 100};
}
//decides if a color is neutral
export const isNeutral = (hsl) => hsl.s < 12 || hsl.l > 92 || hsl.l < 10;
//the chromatic circle has a 360 degree
const hueDiff = (a, b) => {const d = Math.abs(a - b); return Math.min(d, 360 - d);};
//this function classifies the visual relationship between two colors
export function classifyPair(hexA, hexB) {
    const a = hexToHsl(hexA), b = hexToHsl(hexB);
    if (isNeutral(a) || isNeutral(b)) 
        return {type: 'neutral', score: 3};
    const d = hueDiff(a.h, b.h);
    if (d <= 10) 
        return {type: 'monochromatic', score: 4.5};
    if (d <= 30) 
        return {type: 'analogous', score: 4};
    if (d >= 150) 
        return {type: 'complementary', score: 5};
    if (d >= 100) 
        return {type: 'triadic', score: 3.5};
    return {type: 'free contrast', score: 1.5};
}
//shifted 5 degrees colder than a plain thermometer reading: she runs cold, so it takes more heat to count as "warm"
export function getBracket(t) {
    if (t >= 29) return 'hot';
    if (t >= 22) return 'warm';
    if (t >= 14) return 'cool';
    return 'cold';
}
const WARMTH_POINTS = {light: 1, lightMedium: 2, medium: 3, mediumHeavy: 4, heavy: 5};
const COVERAGE = {
    tank: 0.4, bodysuit: 0.7, tshirt: 0.7, shirt: 0.9, blouse: 0.9, sweater: 1.3, hoodie: 1.3,
    dress: 1.6,
    jeans: 1, trousers: 1, leggings: 0.8, skirt: 0.6,
    outerwear: 1.4,
};
const CROPPED_KEYWORDS = ['shrug', 'bolero', 'crop'];
export function itemWarmthPoints(item) {
    if (!item) return 0;
    const base = WARMTH_POINTS[item.warmth] ?? 2;
    let coverage = COVERAGE[item.category] ?? 0.8;
    if (CROPPED_KEYWORDS.some((k) => (item.name || '').toLowerCase().includes(k))) coverage = Math.min(coverage, 0.5);
    return base * coverage;
}
//a curve over the actual low rather than one figure per bracket
export function warmthNeededFor(lowTemp) {
    if (lowTemp == null) return 0;
    if (lowTemp >= 24) return 0;
    if (lowTemp >= 20) return (24 - lowTemp) * 1.35;
    return Math.min(10, 5.4 + (20 - lowTemp) * 0.45);
}
const hueWarmth = (h) => Math.cos((h - 30) * Math.PI / 180);
const rangeDistance = (v, [min, max]) => (v < min ? min - v : v > max ? v - max : 0);
//calculates if a color fits a season
export function seasonFitScore(hex, seasonId) {
    const profile = SEASON[seasonId];
    if (!profile) 
        return 0;
    const hsl = hexToHsl(hex);
    if (isNeutral(hsl)) 
        return 3.5;
    let score = 0;
    const warmth = hueWarmth(hsl.h);
    if (profile.undertone === 'warm') score += warmth > 0.15 ? 3 : warmth > -0.15 ? 1 : -1;
    else if (profile.undertone === 'cool') score += warmth < -0.15 ? 3 : warmth < 0.15 ? 1 : -1;
    else score += 1.5;
    score += Math.max(0, 2 - rangeDistance(hsl.l, profile.lightnessRange) / 18);
    score += Math.max(0, 2 - rangeDistance(hsl.s, profile.saturationRange) / 22);
    return score;
}
export function fitFlatteryScore(item, bodyShapeId){
    const shape = BODY_SHAPE[bodyShapeId];
    if (!shape || !item.fit) 
        return 0;
    const wantedFits = BOTTOM_CATEGORIES.includes(item.category) ? shape.fitPreference.bottom : shape.fitPreference.top;
    return wantedFits.includes(item.fit) ? 2.5 : 0;
}
const EASE_RANGES = {fitted: [0, 8], structured: [4, 12], relaxed: [10, 24]};
//calculates if an item fits a person well
function easeScore(garmentCm, bodyCm) {
    if (!garmentCm || !bodyCm)
        return null;
    const ease = garmentCm - bodyCm;
    //the item is smaller than the user
    if (ease < 0)
        return -3;
    //decides an item is mislabled in the ease ranges
    const fitsSomeCut = Object.values(EASE_RANGES).some(([min, max]) => ease >= min && ease <= max);
    if (fitsSomeCut)
        return 2;
    //too loose for every real cut, including relaxed
    return -1;
}
//calculates a score for each piece of clothing
export function measurementFitScore(item, bodyMeasurements){
    if (!item.measurements || !bodyMeasurements) 
        return 0;
    const scores = [];
    const add = (garmentCm, bodyCm) => {
        const s = easeScore(garmentCm, bodyCm);
        if (s !== null) scores.push(s);
    };
    if (BOTTOM_CATEGORIES.includes(item.category)){
        add(item.measurements.waistCm, bodyMeasurements.waistCm);
        add(item.measurements.hipsCm, bodyMeasurements.hipsCm);
    } 
    else if (item.category === 'dress'){
        add(item.measurements.chestCm, bodyMeasurements.bustCm);
        add(item.measurements.waistCm, bodyMeasurements.waistCm);
        add(item.measurements.hipsCm, bodyMeasurements.hipsCm);
    } 
    else{
        add(item.measurements.chestCm, bodyMeasurements.bustCm);
    }
    if(!scores.length) 
        return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
}
const UNDERTONE_CLASH_MARGIN = 0.8;
const LIGHTNESS_CLASH_MARGIN = 45;
const SATURATION_CLASH_MARGIN = 32;
//this function generates a warning in which it tells the user the color of the item may not go with their color palette
function colorClashReason(hex, seasonId) {
    const profile = SEASON[seasonId];
    if (!profile) 
        return null;
    const hsl = hexToHsl(hex);
    if (isNeutral(hsl)) 
        return null;
    if (profile.undertone !== 'neutral'){
        const warmth = hueWarmth(hsl.h);
        const undertoneClash = profile.undertone === 'warm' ? warmth < -UNDERTONE_CLASH_MARGIN : warmth > UNDERTONE_CLASH_MARGIN;
        if (undertoneClash){
            const colorLean = profile.undertone === 'warm' ? 'cool' : 'warm';
            return `This color leans ${colorLean}. Your ${profile.label} palette tends to be ${profile.undertone}-toned.`;
        }
    }
    const lDist = rangeDistance(hsl.l, profile.lightnessRange);
    const sDist = rangeDistance(hsl.s, profile.saturationRange);
    if (lDist > LIGHTNESS_CLASH_MARGIN || sDist > SATURATION_CLASH_MARGIN){
        if (lDist >= sDist){
            const direction = hsl.l > profile.lightnessRange[1] ? 'lighter' : 'darker';
            return `This color runs ${direction} than your ${profile.label} palette tends to call for.`;
        }
        const direction = hsl.s > profile.saturationRange[1] ? 'more vivid' : 'more muted';
        return `This color runs ${direction} than your ${profile.label} palette tends to call for.`;
    }
    return null;
}
const MEASUREMENT_MISMATCH_THRESHOLD = -0.4;
export function getFitFlags(item, {season = null, bodyShape = null, bodyMeasurements = null} = {}){
    const flags = [];
    if (season && item.colorHex && SEASON[season]){
        const reason = colorClashReason(item.colorHex, season);
        if (reason) flags.push({type: 'color', message: reason});
    }
    if (bodyShape && item.fit && BODY_SHAPE[bodyShape]){
        const shape = BODY_SHAPE[bodyShape];
        const wantedFits = BOTTOM_CATEGORIES.includes(item.category) ? shape.fitPreference.bottom : shape.fitPreference.top;
        if (wantedFits.length && !wantedFits.includes(item.fit)){
            const wantedLabel = wantedFits.map((f) => FIT[f].toLowerCase()).join(' or ');
            flags.push({type: 'shape', message: `A ${wantedLabel} fit tends to flatter your ${shape.label} shape more than ${FIT[item.fit].toLowerCase()}.`});
        }
    }
    if (bodyMeasurements && item.measurements){
        if (measurementFitScore(item, bodyMeasurements) < MEASUREMENT_MISMATCH_THRESHOLD){
            flags.push({type: 'measurements', message: "It might not fit."});
        }
    }
    return flags;
}
export function generateOutfit(items, temp, userSeason = null, bodyShape = null, occasion = null, tempRange = null, preferComfort = false, preferElegant = false, avoidIds = null, personalStyle = null, bodyMeasurements = null, packLight = false) {
    const styleList = Array.isArray(personalStyle) ? personalStyle : personalStyle ? [personalStyle] : [];
    //decides the maximum temperature for the day
    const warmBracket = getBracket(tempRange ? tempRange.max : temp);
    //decides the minimum temperature for the day
    const coldBracket = getBracket(tempRange ? tempRange.min : temp);
    const baseRules = WARMTH_RULES[coldBracket];
    const outerRules = WARMTH_RULES[coldBracket];
    const layeringAdvised = warmBracket !== coldBracket;
    const strictOccasion = occasion && STRICT_OCCASIONS.includes(occasion);
    const clean = items.filter((i) => !isDirty(i));
    const eligible = occasion
        ? clean.filter((i) => (strictOccasion
            ? i.occasions?.includes(occasion)
            : (!i.occasions || !i.occasions.length || i.occasions.includes(occasion))))
        : clean;
    const isLowKeyOccasion = !occasion || occasion === 'loungewear';
    const eligibleForOccasion = isLowKeyOccasion ? eligible : eligible.filter((i) => !i.casualOnly);
    const byCategory = (category) => eligibleForOccasion.filter((i) => i.category === category);
    const warmthRank = (item) => WARMTH_ORDER.indexOf(item.warmth); 
    const filterWarmth = (list, allowed) => (allowed ? list.filter((i) => allowed.includes(i.warmth)) : list);
    const warmestOf = (list) => {
        if (!list.length) return list;
        const warmestRank = Math.max(...list.map(warmthRank));
        return list.filter((i) => warmthRank(i) === warmestRank);
    };
    const buildSlot = (categories) => {
        const strict = categories.flatMap((category) => filterWarmth(byCategory(category), baseRules[category]));
        if (strict.length) return strict;
        return warmestOf(categories.flatMap((category) => byCategory(category)));
    };
    const SHORTS_KEYWORDS = ['shorts'];
    const isShortsItem = (item) => SHORTS_KEYWORDS.some((k) => (item.name || '').toLowerCase().includes(k));
    const coldBracketIsChilly = coldBracket === 'cool' || coldBracket === 'cold';
    const excludeShortsIfChilly = (list) => {
        if (!coldBracketIsChilly) return list;
        const f = list.filter((i) => !isShortsItem(i));
        return f.length ? f : list;
    };
    const tops = buildSlot(TOP_CATEGORIES);
    const pantsOptions = buildSlot(PANTS_CATEGORIES);
    const skirtOptions = buildSlot(['skirt']);
    const skirtsAllowedWhenChilly = !coldBracketIsChilly || pantsOptions.length === 0;
    const bottoms = excludeShortsIfChilly([...pantsOptions, ...(skirtsAllowedWhenChilly ? skirtOptions : [])]);
    const dresses = buildSlot(['dress']);
    const outerFiltered = filterWarmth(byCategory('outerwear'), outerRules.outerwear);
    const shoesList = byCategory('shoes');
    const accessories = byCategory('accessory');
    const jewelryList = byCategory('jewelry');
    const bagsList = byCategory('bag');
    const hasTopBottom = tops.length > 0 && bottoms.length > 0;
    if (!hasTopBottom && dresses.length === 0) {
        return {error: strictOccasion
            ? `You don't have tops and bottoms or a dress tagged "${occasion}" yet. Tag a few pieces, or try a different occasion.`
            : occasion
                ? `You don't have enough items tagged (or untagged/universal) for "${occasion}" and this weather. Try another occasion, or add some items.`
                : 'You need at least one top and one pair of pants or a skirt in your wardrobe, or a dress.'};
    }
    let outerOptions;
    if (coldBracket === 'hot') outerOptions = [null];
    else if (coldBracket === 'cold') outerOptions = outerFiltered.length ? outerFiltered : (byCategory('outerwear').length ? byCategory('outerwear') : [null]);
    else outerOptions = outerFiltered.length ? [...outerFiltered, null] : [null];
    const SHRUG_KEYWORDS = ['shrug', 'bolero'];
    const isShrugItem = (item) => SHRUG_KEYWORDS.some((k) => (item.name || '').toLowerCase().includes(k));
    const shrugFitsOverTop = (top) => top.category === 'tank';
    const onlyShrugsAvailable = outerOptions.length > 0 && outerOptions.every((o) => o && isShrugItem(o));
    //so you don't favour the same items every day
    const recencyBonus = (item) => {
        const d = daysBetween(item.lastWorn);
        return d === null ? 3 : Math.min(d / 12, 3);
    };
    //gives a smaller score to worn-out items
    const conditionPenalty = (item) => (item.conditionScore ? (item.conditionScore / 100) * 1.5 : 0);
    const seasonBonus = (item) => (userSeason ? seasonFitScore(item.colorHex, userSeason) * 0.5 : 0);
    const fitBonus = (item) => (bodyShape ? fitFlatteryScore(item, bodyShape) : 0);
    const isTaggedForOccasion = (item) => !!(occasion && item.occasions?.includes(occasion));
    const comfortMode = preferComfort || occasion === 'travel' || occasion === 'beach';
    const comfortPenalty = (item) => {
        if (!comfortMode || isTaggedForOccasion(item)) return 0;
        return item.fit === 'relaxed' ? 0 : 1.5;
    };
    const avoidPenalty = (item, slot) => {
        if (!avoidIds || !avoidIds.has(item.id)) return 0;
        if (packLight && (slot === 'bottom' || slot === 'outer')) return 0;
        return 5;
    };
    const styleBonus = (item) => (styleList.length && item.styles?.some((s) => styleList.includes(s)) ? 2 : 0);
    const measureBonus = (item) => measurementFitScore(item, bodyMeasurements);
    const warmthNeeded = warmthNeededFor(tempRange ? tempRange.min : temp);
    const outfitWarmth = (...pieces) => pieces.reduce((sum, p) => sum + itemWarmthPoints(p), 0);
    const warmthShortfall = (...pieces) => Math.max(0, warmthNeeded - outfitWarmth(...pieces));
    const HIGH_NECK_KEYWORDS = ['turtleneck', 'polo neck', 'mock neck'];
    const isBaseLayerCandidate = (item) => (
        (item.category === 'tank' || item.category === 'bodysuit'
            || (item.category === 'tshirt' && (item.warmth === 'light' || item.warmth === 'lightMedium')))
        && !HIGH_NECK_KEYWORDS.some((k) => (item.name || '').toLowerCase().includes(k))
    );
    const LAYERS_OVER_A_BASE = ['shirt', 'blouse', 'sweater', 'hoodie'];
    const baseLayerOptions = coldBracket === 'hot' ? [] : eligibleForOccasion.filter(isBaseLayerCandidate);
    const baseLayersFor = (top, bottom, outer) => {
        if (!LAYERS_OVER_A_BASE.includes(top.category) || !baseLayerOptions.length) return [null];
        if (warmthShortfall(top, bottom, outer) <= 0) return [null];
        return [null, ...baseLayerOptions];
    };
    let bestTB = null;
    if (hasTopBottom){
        for (const top of tops){
            for (const bottom of bottoms){
                for (const outer of outerOptions){
                    if (!onlyShrugsAvailable && outer && isShrugItem(outer) && !shrugFitsOverTop(top)) continue;
                    for (const base of baseLayersFor(top, bottom, outer)){
                        if (base && base.id === top.id) continue;
                        const pairTB = classifyPair(top.colorHex, bottom.colorHex);
                        let score = pairTB.score;
                        if (outer) {
                            score += classifyPair(top.colorHex, outer.colorHex).score * 0.6;
                            score += classifyPair(bottom.colorHex, outer.colorHex).score * 0.6;
                        }
                        if (base) score += classifyPair(top.colorHex, base.colorHex).score * 0.4;
                        score += recencyBonus(top) + recencyBonus(bottom) + (outer ? recencyBonus(outer) : 0);
                        score -= conditionPenalty(top) + conditionPenalty(bottom) + (outer ? conditionPenalty(outer) : 0);
                        score += seasonBonus(top) + seasonBonus(bottom) + (outer ? seasonBonus(outer) : 0);
                        score += fitBonus(top) + fitBonus(bottom) + (outer ? fitBonus(outer) : 0);
                        score -= comfortPenalty(top) + comfortPenalty(bottom) + (outer ? comfortPenalty(outer) : 0);
                        score -= avoidPenalty(top, 'top') + avoidPenalty(bottom, 'bottom') + (outer ? avoidPenalty(outer, 'outer') : 0);
                        score += styleBonus(top) + styleBonus(bottom) + (outer ? styleBonus(outer) : 0);
                        score += measureBonus(top) + measureBonus(bottom) + (outer ? measureBonus(outer) : 0);
                        if (base) score -= conditionPenalty(base) + avoidPenalty(base, 'top');
                        if (base) score -= 0.75;
                        if (layeringAdvised && outer) score += 2;
                        score -= warmthShortfall(top, bottom, outer, base) * 4;
                        score += Math.random() * 0.05;
                        if (!bestTB || score > bestTB.score) bestTB = {top, bottom, outer, base, score, mainType: pairTB.type};
                    }
                }
            }
        }
    }
    let bestDress = null;
    if (dresses.length > 0){
        for (const dress of dresses){
            for (const outer of outerOptions){
                let score = 4.5;
                if (outer) 
                    score += classifyPair(dress.colorHex, outer.colorHex).score * 0.6 * 2;
                score += recencyBonus(dress) * 2;
                score -= conditionPenalty(dress) * 2;
                score += seasonBonus(dress) * 2;
                score += fitBonus(dress) * 2;
                score -= comfortPenalty(dress) * 2;
                score -= avoidPenalty(dress, 'top') * 2;
                if (outer) 
                    score -= avoidPenalty(outer, 'outer') * 2;
                score += styleBonus(dress) * 2;
                score += measureBonus(dress) * 2;
                if (comfortMode && !isTaggedForOccasion(dress)) 
                    score -= 2;
                if (preferElegant) 
                    score += 3;
                if (layeringAdvised && outer)
                    score += 2;
                score -= warmthShortfall(dress, outer) * 4 * 2;
                score += Math.random() * 0.05;
                if (!bestDress || score > bestDress.score)
                    bestDress = {dress, outer, score};
            }
        }
    }
    const useDress = bestDress && (!bestTB || bestDress.score > bestTB.score);
    const chosenOuter = useDress ? bestDress.outer : bestTB.outer;
    const mainAnchor = useDress ? bestDress.dress : bestTB.top;
    const secondAnchor = useDress ? bestDress.dress : bestTB.bottom;
    const pickBestAccent = (pool, ...anchors) => {
        if (!pool.length) 
            return null;
        let bestPick = null;
        for (const candidate of pool){
            const sc = anchors.reduce((sum, anchor, i) => sum + classifyPair(candidate.colorHex, anchor.colorHex).score * (i === 0 ? 1 : 0.5), 0);
            if (!bestPick || sc > bestPick.sc) bestPick = {item: candidate, sc};
        }
        return bestPick.item;
    };
    const BELT_KEYWORDS = ['belt'];
    const isBeltItem = (item) => BELT_KEYWORDS.some((k) => (item.name || '').toLowerCase().includes(k));
    const beltHasSomewhereToGo = !useDress && PANTS_CATEGORIES.includes(bestTB.bottom.category) && (bestTB.bottom.fit === 'fitted' || bestTB.bottom.fit === 'structured');
    const accessoryPool = accessories.filter((a) => !isBeltItem(a) || beltHasSomewhereToGo);
    const shoe = pickBestAccent(shoesList, secondAnchor, mainAnchor);
    const accessory = pickBestAccent(accessoryPool, mainAnchor);
    const jewelry = pickBestAccent(jewelryList, mainAnchor);
    const bag = pickBestAccent(bagsList, mainAnchor, secondAnchor);
    return {
        top: useDress ? null : bestTB.top,
        baseLayer: useDress ? null : (bestTB.base || null),
        bottom: useDress ? null : bestTB.bottom,
        dress: useDress ? bestDress.dress : null,
        outer: chosenOuter, shoe, accessory, jewelry, bag,
        //if the user is chosen a dress, there is no need to calculate the harmony of the outfit
        harmonyType: useDress ? 'monochromatic' : bestTB.mainType,
        bracket: warmBracket, coldBracket, layeringAdvised,
        layeringGap: layeringAdvised && !chosenOuter,
        warmthShortfall: useDress
            ? warmthShortfall(bestDress.dress, chosenOuter)
            : warmthShortfall(bestTB.top, bestTB.bottom, chosenOuter, bestTB.base),
        tempRange: tempRange || null,
    };
}
