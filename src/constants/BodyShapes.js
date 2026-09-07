export const BODY_SHAPE_ORDER = ['hourglass', 'pear', 'invertedTriangle', 'apple', 'diamond', 'rectangle'];
export const BODY_SHAPE = {
    hourglass: {
        label: 'Hourglass',
        description: 'Bust and hips are close in width, with a clearly defined waist.',
        guidance: 'Fitted styles that follow your natural waistline tend to look great.',
        fitPreference: {top: ['fitted', 'structured'], bottom: ['fitted', 'structured']},
    },
    pear: {
        label: 'Pear',
        description: 'Hips are a bit wider than the bust, with a defined waist.',
        guidance: 'Structured or detailed tops balance nicely with relaxed bottoms.',
        fitPreference: {top: ['structured', 'fitted'], bottom: ['relaxed']},
    },
    invertedTriangle: {
        label: 'Inverted Triangle',
        description: 'Shoulders and bust are a bit wider than the hips.',
        guidance: 'Softer, relaxed tops balance beautifully with structured bottoms.',
        fitPreference: {top: ['relaxed'], bottom: ['structured', 'fitted']},
    },
    apple: {
        label: 'Apple',
        description: 'The waist is the widest point, with a softer waistline.',
        guidance: 'Relaxed, flowy tops paired with straighter or fitted bottoms create a great line.',
        fitPreference: {top: ['relaxed'], bottom: ['fitted', 'structured']},
    },
    diamond: {
        label: 'Diamond',
        description: 'Shoulders and hips are narrower than the waist, which is the fullest point.',
        guidance: 'Flowing or empire-waist tops skim over the midsection nicely, paired with fitted or straight bottoms.',
        fitPreference: {top: ['relaxed'], bottom: ['fitted', 'structured']},
    },
    rectangle: {
        label: 'Rectangle',
        description: 'Bust, waist and hips are close in width, with a straighter line overall.',
        guidance: 'Belts, structured pieces and peplum styles are great for adding definition.',
        fitPreference: {top: ['structured', 'fitted'], bottom: ['structured', 'fitted']},
    },
};
export const FIT_ORDER = ['fitted', 'structured', 'relaxed'];
export const FIT = {
    fitted: 'Fitted',
    structured: 'Structured',
    relaxed: 'Relaxed',
};
export const SHOULDER_VS_HIPS_ORDER = ['narrower', 'similar', 'wider'];
export const SHOULDER_VS_HIPS = {
    narrower: 'Narrower than my hips',
    similar: 'About the same as my hips',
    wider: 'Wider than my hips',
};
export function computeBodyShape({bust, waist, hip, shoulderVsHips = null, unit = 'cm'}) {
    if (!bust || !waist || !hip) return null;
    const toInches = (v) => (unit === 'cm' ? v / 2.54 : v);
    const B = toInches(bust), W = toInches(waist), H = toInches(hip);
    const bustHipDiff = H - B;
    const waistBustDiff = B - W;
    const waistHipDiff = H - W;
    if (Math.abs(bustHipDiff) <= 1 && (waistBustDiff >= 9 || waistHipDiff >= 9)) return 'hourglass';
    if (bustHipDiff >= 3.5 && waistHipDiff >= 7) return 'pear';
    if (-bustHipDiff >= 3.5 && waistBustDiff >= 7) return 'invertedTriangle';
    if (W >= B && W >= H) {
        if (shoulderVsHips === 'similar' || shoulderVsHips === 'narrower') return 'diamond';
        return 'apple';
    }
    return 'rectangle';
}
