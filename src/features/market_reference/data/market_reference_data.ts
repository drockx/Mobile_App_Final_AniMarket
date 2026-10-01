import type { LocalMarket } from '../domain/market_reference';

export const davaoDelNorteMarkets: readonly LocalMarket[] = [
  {
    id: 'tagum', name: 'Tagum Livestock Market', location: 'Tagum City, Davao del Norte', sample: true,
    prices: [
      { id: 'tagum-cow', category: 'cow', name: 'Cow', unit: 'Per kg live weight', min: 95, max: 105, median: 100, change: 2.5, observations: 18, history: [96, 97, 98, 99, 99, 100, 100] },
      { id: 'tagum-goat', category: 'goat', name: 'Goat', unit: 'Per kg live weight', min: 225, max: 260, median: 245, change: 4.1, observations: 12, history: [231, 235, 237, 240, 242, 244, 245] },
      { id: 'tagum-pig', category: 'pig', name: 'Fattened Hog', unit: 'Per kg live weight', min: 170, max: 188, median: 180, change: -1.2, observations: 25, history: [184, 183, 183, 182, 181, 180, 180] },
      { id: 'tagum-poultry', category: 'poultry', name: 'Native Chicken', unit: 'Per head • approx. 1.2 kg', min: 205, max: 235, median: 220, change: 1.8, observations: 20, history: [214, 216, 216, 217, 218, 219, 220] },
    ],
  },
  {
    id: 'panabo', name: 'Panabo Livestock Trading Area', location: 'Panabo City, Davao del Norte', sample: true,
    prices: [
      { id: 'panabo-cow', category: 'cow', name: 'Cow', unit: 'Per kg live weight', min: 94, max: 106, median: 100, change: 1, observations: 14, history: [97, 98, 98, 99, 99, 100, 100] },
      { id: 'panabo-goat', category: 'goat', name: 'Goat', unit: 'Per kg live weight', min: 228, max: 258, median: 243, change: 0, observations: 11, history: [242, 243, 243, 244, 243, 243, 243] },
      { id: 'panabo-pig', category: 'pig', name: 'Fattened Hog', unit: 'Per kg live weight', min: 172, max: 190, median: 181, change: -1.1, observations: 27, history: [185, 184, 184, 183, 182, 182, 181] },
      { id: 'panabo-poultry', category: 'poultry', name: 'Native Chicken', unit: 'Per head • approx. 1.2 kg', min: 200, max: 226, median: 213, change: 0.5, observations: 17, history: [210, 211, 211, 212, 212, 213, 213] },
    ],
  },
];
