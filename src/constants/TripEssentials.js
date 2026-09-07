export const TRIP_ESSENTIAL_GROUPS = [
    {
        key: 'toiletries',
        label: 'Toiletries & Health',
        items: [
            {key: 'toothbrush', label: 'Toothbrush', dentalCheck: 'toothbrush'},
            {key: 'toothpaste', label: 'Toothpaste', dentalCheck: 'toothpaste'},
            {key: 'medications', label: 'Any medications you take regularly'},
            {key: 'contacts', label: 'Glasses / contact lenses (+ solution)'},
        ],
    },
    {
        key: 'documents',
        label: 'Documents & Money',
        items: [
            {key: 'idPassport', label: 'ID / passport'},
            {key: 'cardsCash', label: 'Cards & some cash'},
            {key: 'tickets', label: 'Tickets, boarding pass, reservations'},
        ],
    },
    {
        key: 'tech',
        label: 'Tech',
        items: [
            {key: 'phoneCharger', label: 'Phone charger'},
            {key: 'adapter', label: 'Power adapter (if abroad)'},
            {key: 'powerBank', label: 'Power bank'},
            {key: 'headphones', label: 'Headphones'},
        ],
    },
    {
        key: 'extras',
        label: 'Extras',
        items: [
            {key: 'waterBottle', label: 'Reusable water bottle'},
            {key: 'umbrella', label: 'Umbrella or rain layer'},
            {key: 'sleepKit', label: 'Sleep mask & earplugs (overnight travel)'},
            {key: 'snacks', label: 'Snacks for the road'},
        ],
    },
];
