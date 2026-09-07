import {CATEGORY, BRACKET_LABEL} from '../constants/Wardrobe';
import {SEASON} from '../constants/ColorSeasons';
import {BODY_SHAPE} from '../constants/BodyShapes';
import {OCCASION} from '../constants/Occasions';
import {getBracket} from '../utils/ColorTheory';
import {isDirty} from '../utils/Laundry';
import {callAI} from './AiProvider';
const CATEGORY_LIST = Object.keys(CATEGORY).join(', ');
function describeWardrobe(items){
    if (!items.length) 
        return 'The wardrobe is currently empty.';
    return items
        .map((i) => `- id:${i.id} | ${i.category} | "${i.name}" | color:${i.colorHex} | fit:${i.fit || 'unspecified'} | warmth:${i.warmth || 'n/a'}`)
        .join('\n');
}
function describeProfile(season, bodyShape){
    const parts = [];
    if (season && SEASON[season]){
        parts.push(`Color palette: ${SEASON[season].label} (undertone: ${SEASON[season].undertone}).`);
    }
    if (bodyShape && BODY_SHAPE[bodyShape]){
        parts.push(`Body shape: ${BODY_SHAPE[bodyShape].label} — ${BODY_SHAPE[bodyShape].description} ${BODY_SHAPE[bodyShape].guidance}`);
    }
    return parts.length ? parts.join(' ') : 'No color palette or body shape set — give general, broadly-flattering guidance.';
}
//used for "get suggestions"
const SYSTEM_PROMPT = `You are a helpful, practical personal stylist working from a photo inventory of someone's real wardrobe. 
You are given: their wardrobe items, their color palette and/or body shape (if known), the current weather and a free-text 
request. Your job:
1. If existing wardrobe items reasonably fulfill the request, pick them (2-5 items, ideally covering top+bottom at minimum when
relevant). Only ever use itemId values that appear in the provided wardrobe list, never invent one. If the request explicitly 
says the wardrobe was already checked and has nothing for this need, leave this empty instead.
2. If the wardrobe genuinely lacks something needed for the request (wrong category entirely missing, wrong
weather-appropriateness, or nothing suits the occasion), suggest up to 5 items to shop for, each with a specific product type
(e.g. "cropped wrap cardigan", "zip-up track jacket", "wide-leg joggers" — 2-4 words, no brand names), a general category, an 
approximate color (name + hex) and a fit, matched to their palette/body shape when known. NEVER invent brand names, product 
names, prices or links, you have no real product data. Keep suggestions empty if the wardrobe already covers the request well.
3. If an OCCASION is given, every pick and every shopping suggestion's "type" must genuinely fit that occasion's dress code — 
a gym/athletic occasion calls for performance-wear vocabulary (zip-up hoodie, track jacket, joggers), 
never general-fashion pieces like a cardigan, blazer, even if the color/fit/weather would otherwise match. The occasion overrides
generic weather-only reasoning.
4. The given temperature is the ambient/outdoor one — never assume a specific indoor destination has air conditioning or heating 
unless the request says so. Dress for the given temperature itself, not an imagined indoor comfort level.
Valid categories: ${CATEGORY_LIST}
Valid fits: fitted, structured, relaxed
Respond with STRICTLY a JSON object with exactly these fields:
{
  "summary": "1-3 sentences in English directly addressing the request",
  "useExisting": [{ "itemId": "...", "reason": "short reason, under 12 words" }],
  "shoppingSuggestions": [{ "type": "specific product type, 2-4 words", "category": "...", "colorName": "...", "colorHex": "#RRGGBB", "fit": "...", "reason": "short reason, under 15 words" }]
}`;
export async function getStyleAdvice({requestText, items, temp, season, bodyShape, occasion = null, skipExisting = false}){
    const wearableItems = items.filter((i) => !isDirty(i));
    const bracket = getBracket(temp);
    const occasionLabel = occasion && OCCASION[occasion] ? OCCASION[occasion].label : null;
    //\u2019 represents the ' character
    const userText = `WARDROBE:
${describeWardrobe(wearableItems)}
PROFILE: ${describeProfile(season, bodyShape)}
WEATHER: ${temp}°C (${BRACKET_LABEL[bracket]}).
${occasionLabel ? `\nOCCASION: ${occasionLabel}\n` : ''}
REQUEST: ${requestText && requestText.trim() ? requestText.trim() : 'Suggest what would complete my wardrobe for today\u2019s weather.'}${skipExisting ? '\n\nNOTE: The wardrobe has already been checked against this specific need and confirmed to have nothing suitable \u2014 do not list anything under "useExisting" for this request, even a partial or loosely-related match. Go straight to shopping suggestions.' : ''}`;
    const parsed = await callAI({systemPrompt: SYSTEM_PROMPT, userText});
    const validIds = new Set(wearableItems.map((i) => i.id));
    const useExisting = Array.isArray(parsed.useExisting)
        ? parsed.useExisting
                .filter((u) => u && validIds.has(u.itemId))
                .map((u) => ({item: wearableItems.find((i) => i.id === u.itemId), reason: u.reason || ''}))
        : [];
    const validCategories = new Set(Object.keys(CATEGORY));
    const validFits = new Set(['fitted', 'structured', 'relaxed']);
    const shoppingSuggestions = Array.isArray(parsed.shoppingSuggestions)
        ? parsed.shoppingSuggestions
                .filter((s) => s && validCategories.has(s.category) && /^#[0-9a-fA-F]{6}$/.test(s.colorHex || ''))
                .map((s) => ({
                    type: (s.type || '').trim(),
                    category: s.category,
                    colorName: s.colorName || '',
                    colorHex: s.colorHex,
                    fit: validFits.has(s.fit) ? s.fit : null,
                    reason: s.reason || '',
                }))
        : [];
    return {
        summary: parsed.summary || '',
        useExisting,
        shoppingSuggestions,
    };
}
