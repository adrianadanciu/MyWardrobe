//split top/pants into specific garment types instead of one flat bucket, so a t-shirt and a sweater aren't treated the same
export const TOP_CATEGORIES = ['tshirt', 'shirt', 'blouse', 'sweater', 'hoodie', 'tank', 'bodysuit'];
export const PANTS_CATEGORIES = ['jeans', 'trousers', 'leggings'];
export const BOTTOM_CATEGORIES = [...PANTS_CATEGORIES, 'skirt'];
export const CATEGORY = {
    tshirt: {label: 'T-Shirts', short: 'T-Shirt'},
    shirt: {label: 'Shirts', short: 'Shirt'},
    blouse: {label: 'Blouses', short: 'Blouse'},
    sweater: {label: 'Sweaters', short: 'Sweater'},
    hoodie: {label: 'Hoodies', short: 'Hoodie'},
    tank: {label: 'Tank Tops', short: 'Tank Top'},
    bodysuit: {label: 'Bodysuits', short: 'Bodysuit'},
    dress: {label: 'Dresses', short: 'Dress'},
    jeans: {label: 'Jeans', short: 'Jeans'},
    trousers: {label: 'Dress Pants', short: 'Dress Pants'},
    leggings: {label: 'Leggings', short: 'Leggings'},
    skirt: {label: 'Skirts', short: 'Skirt'},
    outerwear: {label: 'Outerwear', short: 'Outerwear'},
    shoes: {label: 'Shoes', short: 'Shoes'},
    accessory: {label: 'Accessories', short: 'Accessory'},
    jewelry: {label: 'Jewelry', short: 'Jewelry'},
    bag: {label: 'Bags & Purses', short: 'Bag'},
};
export const CATEGORY_ORDER = [...TOP_CATEGORIES, 'dress', ...PANTS_CATEGORIES, 'skirt', 'outerwear', 'shoes', 'accessory', 'jewelry', 'bag'];
//categories that get warmth/fit/style/measurements fields on add and edit
export const CLOTHING_CATEGORIES = [...TOP_CATEGORIES, 'dress', ...PANTS_CATEGORIES, 'skirt', 'outerwear'];
export const WASHABLE_CATEGORIES = CLOTHING_CATEGORIES;
//typical number of wears before something needs a wash per category
export const WASH_THRESHOLD = {
    ...Object.fromEntries(TOP_CATEGORIES.map((c) => [c, 1])),
    dress: 1,
    ...Object.fromEntries(PANTS_CATEGORIES.map((c) => [c, 4])),
    skirt: 4,
    outerwear: 6,
};
//2 extra levels between light/medium/heavy so a piece can lean toward spring (lightMedium) or fall (mediumHeavy)
export const WARMTH = {light: 'Light', lightMedium: 'Light-Medium (Spring)', medium: 'Medium', mediumHeavy: 'Medium-Heavy (Fall)', heavy: 'Heavy'};
export const WARMTH_ORDER = ['light', 'lightMedium', 'medium', 'mediumHeavy', 'heavy'];
//expands a rules object written once per group into one entry per actual category, so every type shares the same rules
function expandCategoryRules({top, pants, ...rest}) {
    return {
        ...Object.fromEntries(TOP_CATEGORIES.map((c) => [c, top])),
        ...Object.fromEntries(PANTS_CATEGORIES.map((c) => [c, pants])),
        ...rest,
    };
}
export const WARMTH_RULES = {
    hot: expandCategoryRules({top: ['light'], dress: ['light'], pants: ['light'], skirt: ['light'], outerwear: []}),
    warm: expandCategoryRules({top: ['light', 'lightMedium', 'medium'], dress: ['light', 'lightMedium', 'medium'], pants: ['light', 'lightMedium', 'medium'], skirt: ['light', 'lightMedium', 'medium'], outerwear: ['light', 'lightMedium']}),
    cool: expandCategoryRules({top: ['lightMedium', 'medium', 'mediumHeavy', 'heavy'], dress: ['lightMedium', 'medium', 'mediumHeavy', 'heavy'], pants: ['lightMedium', 'medium', 'mediumHeavy', 'heavy'], skirt: ['lightMedium', 'medium', 'mediumHeavy', 'heavy'], outerwear: ['light', 'lightMedium', 'medium']}),
    cold: expandCategoryRules({top: ['heavy', 'mediumHeavy', 'medium'], dress: ['heavy', 'mediumHeavy', 'medium'], pants: ['heavy', 'mediumHeavy', 'medium'], skirt: ['heavy', 'mediumHeavy', 'medium'], outerwear: ['medium', 'mediumHeavy', 'heavy']}),
};
export const BRACKET_LABEL = {hot: 'Hot', warm: 'Mild', cool: 'Cool', cold: 'Cold'};
export const CONDITION = {
    fresh: {label: 'Like new', max: 20, color: '#3cab0d'},
    good: {label: 'Good', max: 45, color: '#274e08'},
    worn: {label: 'Worn', max: 70, color: '#bf8716'},
    tired: {label: 'Very worn', max: 100, color: '#892a0d'},
};
export const CONDITION_ORDER = ['fresh', 'good', 'worn', 'tired'];
export function conditionFromScore(score) {
    if (score == null) return null;
    if (score <= CONDITION.fresh.max) return 'fresh';
    if (score <= CONDITION.good.max) return 'good';
    if (score <= CONDITION.worn.max) return 'worn';
    return 'tired';
}
