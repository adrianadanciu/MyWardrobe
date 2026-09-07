//this file handles the visual analysis of the photos sent by the user
import {SEASON_ORDER} from '../constants/ColorSeasons';
import {OCCASION_ORDER} from '../constants/Occasions';
import {WARMTH_ORDER, CATEGORY_ORDER} from '../constants/Wardrobe';
import {callAI} from './AiProvider';
async function callVisionAI({base64, mediaType, systemPrompt, userText}) {
    return callAI({systemPrompt, userText, base64, mediaType});
}
//this function validates and rounds float numbers, usually found in measurements
function numInRange(v, min, max) {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
}
//shared guidance for "categoryGuess", used by both prompts to tell top/bottom garment types apart since they used to be one flat bucket each
const CATEGORY_GUESS_GUIDE = `Use 'dress' for any one-piece garment covering both torso and legs (dresses, jumpsuits, rompers).
For a top, pick 'tshirt' (casual knit top, crew or v-neck, no collar or button-front), 'shirt' (woven top with a collar and
buttons down the front, e.g. a button-up or dress shirt), 'blouse' (a lighter, often flowy woven top — ties, ruffles or sheer
fabric, no heavy button-front), 'sweater' (knitted, pulled over, no front buttons), 'hoodie' (has a hood, usually with a
drawstring), 'tank' (sleeveless, thin or wide straps), or 'bodysuit' (one-piece top that closes at the crotch). For bottoms
with two separate leg openings, pick 'jeans' (denim), 'trousers' (tailored/dress pants, non-denim) or 'leggings' (very
stretchy, skin-tight). Use 'skirt' for anything without leg separation that isn't a dress.`;
const CLOTHING_SYSTEM_PROMPT = `You assess the visual condition of a single clothing item from one photo, for a personal wardrobe
app. Look for signs of wear: fading, holes, loose threads, stains, stretched fabric. Ignore the background and focus on the item 
itself. Also consider which occasions this item is obviously suited for, from exactly this list: ${OCCASION_ORDER.join(', ')}. Be
conservative and only include an occasion when the item is unmistakably and specifically made for it (e.g. a sports bra, athletic
leggings or running shoes -> gym; a tailored blazer -> work and/or formal; a swimsuit -> beach). Most everyday items (a plain
t-shirt, jeans, a basic sweater) aren't specific to any one occasion and should get an empty list — guessing wrong is worse than
guessing nothing, since it can make the item look eligible for something it really isn't suited for. Also give a rough estimate of 
the garment's OWN measurements in centimeters (chest/bust, waist and hips), whichever actually apply to this type of garment: a 
top, dress or outerwear has a chest measurement; a dress, pants or skirt has waist and hips; shoes, accessories, jewelry and bags
have none of these. There's no scale or tape measure in the photo, so this is only a rough visual estimate from the garment's 
apparent size and proportions, a starting point the person can correct, not a precise reading.
Respond with STRICTLY a JSON object with exactly these fields:
{
  "nameGuess": "a short, natural item name, 2-4 words, e.g. 'Denim Jacket', 'White Sneakers', 'Black Wool Sweater' — include a distinguishing color or material word, but keep it short like a person would name it themselves",
  "dominantColorHex": "#RRGGBB (the item's dominant color, as accurate as possible)",
  "categoryGuess": "one of: ${CATEGORY_ORDER.join(', ')}. ${CATEGORY_GUESS_GUIDE}",
  "warmthGuess": "one of: ${WARMTH_ORDER.join(', ')}",
  "fitGuess": "one of: fitted, relaxed, structured — how the garment sits on the body (fitted = close to the body, relaxed = loose/soft/flowy, structured = defined shape, e.g. blazers, stiff fabric, tailored pieces)",
  "occasionsGuess": "an array of 0-2 occasions from the list above — empty [] for anything generic/versatile",
  "chestCmGuess": "approximate chest/bust circumference of the garment in cm (typically 60-140), or null if not applicable to this category or not estimable",
  "waistCmGuess": "approximate waist circumference of the garment in cm (typically 50-130), or null if not applicable to this category or not estimable",
  "hipsCmGuess": "approximate hip circumference of the garment in cm (typically 60-140), or null if not applicable to this category or not estimable",
  "conditionScore": 0-100 (0 = like new, 100 = very worn / time to toss),
  "conditionLabel": "short label in English, e.g. 'Good', 'Slightly worn', 'Very worn'",
  "notes": "1-2 sentences in English about what specifically shows wear, or 'Nothing visible.' if the item looks to be in good condition."
}`;
export async function analyzeClothingPhoto({base64, mediaType = 'image/jpeg'}) {
    const parsed = await callVisionAI({
        base64,
        mediaType,
        systemPrompt: CLOTHING_SYSTEM_PROMPT,
        userText: 'Analyze the photo of this clothing item and reply with only the requested JSON.',
    });
    const hex = typeof parsed.dominantColorHex === 'string' ? parsed.dominantColorHex.trim() : '';
    const nameGuess = typeof parsed.nameGuess === 'string' ? parsed.nameGuess.trim() : '';
    const occasionsGuess = Array.isArray(parsed.occasionsGuess)
        ? parsed.occasionsGuess.filter((o) => OCCASION_ORDER.includes(o)).slice(0, 2)
        : [];
    return {
        nameGuess: nameGuess && nameGuess.length <= 40 ? nameGuess : null,
        dominantColorHex: /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : null,
        categoryGuess: CATEGORY_ORDER.includes(parsed.categoryGuess) ? parsed.categoryGuess : null,
        warmthGuess: WARMTH_ORDER.includes(parsed.warmthGuess) ? parsed.warmthGuess : null,
        fitGuess: ['fitted', 'relaxed', 'structured'].includes(parsed.fitGuess) ? parsed.fitGuess : null,
        occasionsGuess,
        chestCmGuess: numInRange(parsed.chestCmGuess, 50, 180),
        waistCmGuess: numInRange(parsed.waistCmGuess, 40, 170),
        hipsCmGuess: numInRange(parsed.hipsCmGuess, 50, 180),
        conditionScore: typeof parsed.conditionScore === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.conditionScore))) : null,
        conditionLabel: parsed.conditionLabel || null,
        notes: parsed.notes || null,
    };
}
const OUTFIT_LOG_SYSTEM_PROMPT = `You look at a photo of what someone is wearing right now, for a personal wardrobe app's daily 
log. You're given a list of their existing wardrobe items (id, category, name, color). Your job:
1. Decide which of those existing items are visible in the photo. Only ever use id values that appear in the provided list, never
invent one. Match on category, color and style, being reasonably permissive (lighting and camera angle change how a color reads),
but don't force a match when nothing in the list is a plausible fit for something visible.
2. For anything visible in the photo that isn't a good match for any listed item, describe it as a new piece: short name, category, 
dominant color, warmth and fit. Only list genuinely new pieces, never a second entry for something already matched in step 1.
Valid categories: ${CATEGORY_ORDER.join(', ')}
${CATEGORY_GUESS_GUIDE}
Valid warmth: ${WARMTH_ORDER.join(', ')}
Valid fits: fitted, relaxed, structured
Respond with STRICTLY a JSON object with exactly these fields:
{
  "matchedItemIds": ["...", "..."],
  "newItems": [{ "nameGuess": "short, natural item name, 2-4 words", "categoryGuess": "...", "dominantColorHex": "#RRGGBB", "warmthGuess": "...", "fitGuess": "..." }]
}`;
export async function analyzeOutfitPhoto({base64, mediaType = 'image/jpeg', wardrobe}){
    const validIds = new Set(wardrobe.map((i) => i.id));
    const wardrobeText = wardrobe.length
        ? wardrobe.map((i) => `- id:${i.id} | ${i.category} | "${i.name}" | color:${i.colorHex}`).join('\n')
        : 'The wardrobe is currently empty.';
    const parsed = await callVisionAI({
        base64,
        mediaType,
        systemPrompt: OUTFIT_LOG_SYSTEM_PROMPT,
        userText: `EXISTING WARDROBE:\n${wardrobeText}\n\nWhich of these are visible in the photo and is anything visible not in this list? Reply with only the requested JSON.`,
    });
    const matchedItemIds = Array.isArray(parsed.matchedItemIds)
        ? parsed.matchedItemIds.filter((id) => validIds.has(id))
        : [];
    const newItems = Array.isArray(parsed.newItems)
        ? parsed.newItems
                .filter((n) => n && CATEGORY_ORDER.includes(n.categoryGuess))
                .map((n) => {
                    const hex = typeof n.dominantColorHex === 'string' ? n.dominantColorHex.trim() : '';
                    const nameGuess = typeof n.nameGuess === 'string' ? n.nameGuess.trim() : '';
                    return {
                        nameGuess: nameGuess && nameGuess.length <= 40 ? nameGuess : null,
                        categoryGuess: n.categoryGuess,
                        dominantColorHex: /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : null,
                        warmthGuess: WARMTH_ORDER.includes(n.warmthGuess) ? n.warmthGuess : null,
                        fitGuess: ['fitted', 'relaxed', 'structured'].includes(n.fitGuess) ? n.fitGuess : null,
                    };
                })
        : [];
    return {matchedItemIds, newItems};
}
const PALETTE_SYSTEM_PROMPT = `You are a personal color analyst. Look at this photo of a person's face and estimate their seasonal color palette using the standard 12-season 
color analysis system, based on their apparent skin undertone, hair color, eye color and overall contrast level between features.
Respond with STRICTLY a JSON object with exactly these fields:
{
  "season": "one of: ${SEASON_ORDER.join(', ')}",
  "confidence": "one of: low, medium, high",
  "notes": "1-2 sentences in English explaining the reasoning — undertone, depth and contrast."
}`;
export async function analyzeUserPalette({base64, mediaType = 'image/jpeg'}) {
    const parsed = await callVisionAI({
        base64,
        mediaType,
        systemPrompt: PALETTE_SYSTEM_PROMPT,
        userText: "Analyze this person's coloring and reply with only the requested JSON.",
    });
    return {
        season: SEASON_ORDER.includes(parsed.season) ? parsed.season : null,
        confidence: ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : null,
        notes: parsed.notes || null,
    };
}
const BEAUTY_SYSTEM_PROMPT = `You examine a photo of a single personal-care product (skincare, makeup, haircare, fragrance, dental care, body care or nail care) for a personal
inventory app. Read whatever is printed on the packaging (brand, product name, product type) and look specifically for the PAO ("period after opening") symbol, a small open-jar 
icon containing a number and "M", e.g. "12M" or "6M", which many cosmetics print somewhere on the label. Fragrances and some other categories often don't have one; that's 
expected, just leave it null in that case. Also look critically for physical evidence of actual use, the same way you'd size up a pencil to tell if it's new or half-used, not 
just what's printed on the label:
- A lip/eye liner or similar pencil: is the tip visibly shortened, worn down, or freshly sharpened compared to a full-length new pencil?
- A bottle, tube or jar: if it's translucent or partially see-through, can you see the fill level? Is the tube visibly squeezed/dented from use?
- A lipstick or balm: is the bullet worn into an angled/flattened shape rather than a fresh flat or pointed top?
- A palette or pan product: is there a visible dip, smudge or fingerprint mark in the product itself?
Use whatever's actually visible, most of the time some of this won't be checkable from a single photo, and that's fine, just don't guess. Also decide whether this is a reusable
TOOL rather than a consumable, something ike tweezers, a hairbrush or comb, nail clippers, an eyelash curler, a makeup sponge/brush or similar: it doesn't get used up or 
expire, so amount-left and expiry tracking don't apply to it. Anything you apply, spray or otherwise use up (creams, polish, spray, powder, liquid) is a consumable, not a tool,
even if the container itself is reusable.
Respond with STRICTLY a JSON object with exactly these fields:
{
  "nameGuess": "brand + product name if legible, e.g. 'CeraVe Moisturizing Cream', otherwise a short generic description like 'Unmarked white jar cream'",
  "categoryGuess": "one of: skincare, makeup, haircare, fragrance, dental, body, nail",
  "typeGuess": "a short product type, e.g. 'Moisturizer', 'Mascara', 'Shampoo', 'Serum', 'Foundation', 'Eau de Parfum', 'Toothpaste', 'Body Lotion', 'Nail Polish', 'Tweezers', 'Hairbrush'",
  "paoMonthsGuess": "the number from the PAO jar symbol if visible (just the number, e.g. 12), otherwise null — always null for a tool",
  "levelGuess": "one of: full, half, low, empty — your best estimate of how much is left, based on the physical evidence described above. Default to 'full' only if it genuinely looks unused; if you can't tell either way, still default to 'full' rather than guessing low. Ignored for a tool — still fill in your best guess anyway.",
  "isToolGuess": "true if this is a reusable tool as described above, false if it's a consumable",
  "notes": "1-2 sentences on what specifically looks used or unused (e.g. 'The tip is rounded and worn down, so it's clearly been sharpened and used before.' or 'The fill level in the jar is noticeably low.') — or 'Looks new, no signs of use.' if nothing suggests otherwise."
}`;
const BODY_MEASUREMENTS_SYSTEM_PROMPT = `You estimate approximate body measurements from a single full-length photo of a person, for a personal wardrobe app that compares them 
against garment measurements to gauge fit. This is a rough visual estimate, not a real measurement, there's no tape measure or scale reference in the photo, so treat this as a
best-guess starting point the person can freely correct, not a precise reading. Judge proportions from typical human body ratios (shoulder width, head-to-body ratio, apparent 
height if inferable from the framing) rather than guessing arbitrary numbers. Also judge how the shoulders compare in width to the hips, purely visual, not a measurement, since
shoulder width and hip circumference aren't the same kind of measurement and can't be reduced to one number together.
Respond with STRICTLY a JSON object with exactly these fields:
{
  "bustCm": a number (approximate bust/chest circumference in cm, typically 75-125 for adults),
  "waistCm": a number (approximate natural waist circumference in cm, typically 60-110),
  "hipsCm": a number (approximate hip circumference in cm, typically 80-130),
  "shoulderWidthGuess": "one of: narrower, similar, wider — how the shoulders read compared to the hips",
  "confidence": "one of: low, medium, high — how confident you are given the photo (a clear, front-facing, fitted-clothing full-body shot deserves higher confidence than a loose/baggy or partial one)",
  "notes": "1 sentence in English on what limited the estimate (e.g. loose clothing, partial framing, angle) or 'Clear front-facing view.' if nothing did."
}`;
export async function analyzeBodyMeasurements({base64, mediaType = 'image/jpeg'}) {
    const parsed = await callVisionAI({
        base64,
        mediaType,
        systemPrompt: BODY_MEASUREMENTS_SYSTEM_PROMPT,
        userText: 'Estimate this person’s approximate body measurements and reply with only the requested JSON.',
    });
    return {
        bustCm: numInRange(parsed.bustCm, 50, 180),
        waistCm: numInRange(parsed.waistCm, 40, 170),
        hipsCm: numInRange(parsed.hipsCm, 50, 180),
        shoulderWidthGuess: ['narrower', 'similar', 'wider'].includes(parsed.shoulderWidthGuess) ? parsed.shoulderWidthGuess : null,
        confidence: ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : null,
        notes: parsed.notes || null,
    };
}
export async function analyzeBeautyProduct({base64, mediaType = 'image/jpeg'}) {
    const parsed = await callVisionAI({
        base64,
        mediaType,
        systemPrompt: BEAUTY_SYSTEM_PROMPT,
        userText: 'Analyze the photo of this product and reply with only the requested JSON.',
    });
    const nameGuess = typeof parsed.nameGuess === 'string' ? parsed.nameGuess.trim() : '';
    const typeGuess = typeof parsed.typeGuess === 'string' ? parsed.typeGuess.trim() : '';
    const pao = Number(parsed.paoMonthsGuess);
    return {
        nameGuess: nameGuess && nameGuess.length <= 60 ? nameGuess : null,
        categoryGuess: ['skincare', 'makeup', 'haircare', 'fragrance', 'dental', 'body', 'nail'].includes(parsed.categoryGuess) ? parsed.categoryGuess : null,
        typeGuess: typeGuess && typeGuess.length <= 30 ? typeGuess : null,
        paoMonthsGuess: Number.isFinite(pao) && pao > 0 && pao <= 60 ? Math.round(pao) : null,
        levelGuess: ['full', 'half', 'low', 'empty'].includes(parsed.levelGuess) ? parsed.levelGuess : null,
        isToolGuess: typeof parsed.isToolGuess === 'boolean' ? parsed.isToolGuess : null,
        notes: parsed.notes || null,
    };
}
