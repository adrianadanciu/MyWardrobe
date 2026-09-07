//design tokens used across every screen and component, so any card, pill, button or gap comes from one of these values
//corner radius scale, only 4 values on purpose, pick the closest one instead of a random number
export const radius = {
    sm: 8,     // small controls: chips, inputs, tiny buttons
    md: 12,    // default cards, rows, buttons
    lg: 16,    // large surfaces: hero cards, modals, sheets
    xl: 22,    // big modal sheets / bottom sheets
    pill: 999, // fully rounded pills and circular avatars/icons
};
//spacing scale, 4pt based, use these for padding/margin/gap instead of random numbers
export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
};
//elevation presets, react native needs both shadow* (ios) and elevation (android) to look right on both, "flat" means no elevation on purpose
export const shadow = {
    flat: {},
    card: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    raised: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 6},
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 6,
    },
    button: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 3},
        shadowOpacity: 0.14,
        shadowRadius: 6,
        elevation: 3,
    },
};
//dark surfaces need a lower shadow opacity or it just looks like a gray blob since the background is already dark
export const darkShadow = {
    flat: {},
    card: {...shadow.card, shadowOpacity: 0.35, shadowColor: '#000'},
    raised: {...shadow.raised, shadowOpacity: 0.45, shadowColor: '#000'},
    button: {...shadow.button, shadowOpacity: 0.4, shadowColor: '#000'},
};
export const getShadow = (scheme) => (scheme === 'dark' ? darkShadow : shadow);
//two font families on purpose, a serif for brand moments and a normal sans for everything else, set directly via fontFamily since RN/React 19 doesn't propagate Text.defaultProps reliably
export const fonts = {
    brand: 'PlayfairDisplay_800ExtraBold',      // Home masthead, in-app logotype
    brandBlack: 'PlayfairDisplay_900Black',     // launch screen wordmark, max impact
    display: 'Manrope_800ExtraBold',
    displaySemibold: 'Manrope_700Bold',
    text: 'Manrope_500Medium',
    textRegular: 'Manrope_400Regular',
    textSemibold: 'Manrope_600SemiBold',
};
export const type = {
    display: {fontFamily: fonts.display, fontSize: 26, letterSpacing: 0.3},
    title: {fontFamily: fonts.displaySemibold, fontSize: 17},
    section: {fontFamily: fonts.displaySemibold, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase'},
    body: {fontFamily: fonts.text, fontSize: 14},
    caption: {fontFamily: fonts.text, fontSize: 11.5},
};
