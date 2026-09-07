export const SEASON_ORDER = [
    'light-spring', 'true-spring', 'bright-spring',
    'light-summer', 'true-summer', 'soft-summer',
    'soft-autumn', 'true-autumn', 'deep-autumn',
    'bright-winter', 'true-winter', 'deep-winter',
];
export const SEASON = {
    'light-spring': {
        label: 'Light Spring', group: 'Spring', undertone: 'warm',
        lightnessRange: [55, 85], saturationRange: [35, 70],
        swatches: ['#FFB6A3', '#FFD97D', '#B5E5CF', '#8ED1E0', '#F49AC2'],
    },
    'true-spring': {
        label: 'True Spring', group: 'Spring', undertone: 'warm',
        lightnessRange: [45, 70], saturationRange: [55, 90],
        swatches: ['#FF7F50', '#FFC72C', '#8DC63F', '#2DD4BF', '#FF6347'],
    },
    'bright-spring': {
        label: 'Bright Spring', group: 'Spring', undertone: 'neutral',
        lightnessRange: [45, 70], saturationRange: [65, 100],
        swatches: ['#FF2D78', '#FF8C00', '#00A86B', '#0047AB', '#FFF44F'],
    },
    'light-summer': {
        label: 'Light Summer', group: 'Summer', undertone: 'cool',
        lightnessRange: [55, 85], saturationRange: [20, 50],
        swatches: ['#A8C5DA', '#C9B8E0', '#D8A0A8', '#A8D5C0', '#C0C5CC'],
    },
    'true-summer': {
        label: 'True Summer', group: 'Summer', undertone: 'cool',
        lightnessRange: [40, 65], saturationRange: [20, 50],
        swatches: ['#B565A7', '#8C9EDE', '#4F86C6', '#C2417A', '#8FA88A'],
    },
    'soft-summer': {
        label: 'Soft Summer', group: 'Summer', undertone: 'neutral',
        lightnessRange: [40, 65], saturationRange: [10, 35],
        swatches: ['#5C8A89', '#B3A395', '#8B6F8C', '#6E8CA0', '#997C7C'],
    },
    'soft-autumn': {
        label: 'Soft Autumn', group: 'Autumn', undertone: 'neutral',
        lightnessRange: [35, 60], saturationRange: [15, 45],
        swatches: ['#7A7343', '#C19A6B', '#C1652F', '#6B7A4C', '#5F8575'],
    },
    'true-autumn': {
        label: 'True Autumn', group: 'Autumn', undertone: 'warm',
        lightnessRange: [30, 55], saturationRange: [40, 70],
        swatches: ['#D2691E', '#D4A017', '#355E3B', '#9E3320', '#4A3018'],
    },
    'deep-autumn': {
        label: 'Deep Autumn', group: 'Autumn', undertone: 'warm',
        lightnessRange: [15, 40], saturationRange: [35, 65],
        swatches: ['#A0421A', '#4B4A20', '#3B2B20', '#6B1F2A', '#8A6D1B'],
    },
    'bright-winter': {
        label: 'Bright Winter', group: 'Winter', undertone: 'neutral',
        lightnessRange: [30, 55], saturationRange: [65, 100],
        swatches: ['#E4007C', '#3B3EFF', '#00A86B', '#FFFFFF', '#0A0A0A'],
    },
    'true-winter': {
        label: 'True Winter', group: 'Winter', undertone: 'cool',
        lightnessRange: [20, 45], saturationRange: [55, 95],
        swatches: ['#C8102E', '#0F52BA', '#F1C6D9', '#000000', '#FFFFFF'],
    },
    'deep-winter': {
        label: 'Deep Winter', group: 'Winter', undertone: 'neutral',
        lightnessRange: [10, 35], saturationRange: [40, 80],
        swatches: ['#5B1A2E', '#191970', '#046307', '#0A0A0A', '#8C92AC'],
    },
};
