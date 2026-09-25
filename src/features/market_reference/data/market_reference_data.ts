import type { RegionalMarket } from '../domain/market_reference';

export const regionalMarkets: readonly RegionalMarket[] = [
  {
    id: 'tagum', name: 'Tagum Livestock Market', location: 'Tagum City, Davao del Norte', sampleTime: '9:30 AM',
    prices: [
      { id: 'tagum-cow', category: 'cow', name: 'Cow', unit: 'Per kg live weight', min: 95, max: 105, median: 100, change: 2.5, observations: 18, history: [96, 97, 98, 99, 99, 100, 100] },
      { id: 'tagum-goat', category: 'goat', name: 'Goat', unit: 'Per kg live weight', min: 225, max: 260, median: 245, change: 4.1, observations: 12, history: [231, 235, 237, 240, 242, 244, 245] },
      { id: 'tagum-pig', category: 'pig', name: 'Fattened Hog', unit: 'Per kg live weight', min: 170, max: 188, median: 180, change: -1.2, observations: 25, history: [184, 183, 183, 182, 181, 180, 180] },
      { id: 'tagum-poultry', category: 'poultry', name: 'Native Chicken', unit: 'Per head • approx. 1.2 kg', min: 205, max: 235, median: 220, change: 1.8, observations: 20, history: [214, 216, 216, 217, 218, 219, 220] },
    ],
  },
  {
    id: 'davao', name: 'Davao City Central Market', location: 'Davao City, Davao Region', sampleTime: '9:15 AM',
    prices: [
      { id: 'davao-cow', category: 'cow', name: 'Cow', unit: 'Per kg live weight', min: 100, max: 112, median: 106, change: 1.5, observations: 23, history: [102, 103, 104, 104, 105, 106, 106] },
      { id: 'davao-goat', category: 'goat', name: 'Goat', unit: 'Per kg live weight', min: 240, max: 275, median: 260, change: 2, observations: 16, history: [252, 254, 255, 257, 258, 259, 260] },
      { id: 'davao-pig', category: 'pig', name: 'Fattened Hog', unit: 'Per kg live weight', min: 180, max: 198, median: 190, change: 3.1, observations: 31, history: [182, 184, 185, 187, 188, 189, 190] },
      { id: 'davao-poultry', category: 'poultry', name: 'Broiler Chicken', unit: 'Per kg live weight', min: 132, max: 148, median: 140, change: -0.8, observations: 28, history: [143, 142, 142, 141, 141, 140, 140] },
    ],
  },
  {
    id: 'panabo', name: 'Panabo Livestock Trading Area', location: 'Panabo City, Davao del Norte', sampleTime: '8:50 AM',
    prices: [
      { id: 'panabo-cow', category: 'cow', name: 'Cow', unit: 'Per kg live weight', min: 94, max: 106, median: 100, change: 1, observations: 14, history: [97, 98, 98, 99, 99, 100, 100] },
      { id: 'panabo-goat', category: 'goat', name: 'Goat', unit: 'Per kg live weight', min: 228, max: 258, median: 243, change: 0, observations: 11, history: [242, 243, 243, 244, 243, 243, 243] },
      { id: 'panabo-pig', category: 'pig', name: 'Fattened Hog', unit: 'Per kg live weight', min: 172, max: 190, median: 181, change: -1.1, observations: 27, history: [185, 184, 184, 183, 182, 182, 181] },
      { id: 'panabo-poultry', category: 'poultry', name: 'Native Chicken', unit: 'Per head • approx. 1.2 kg', min: 200, max: 226, median: 213, change: 0.5, observations: 17, history: [210, 211, 211, 212, 212, 213, 213] },
    ],
  },
  {
    id: 'digos', name: 'Digos Livestock Trading Area', location: 'Digos City, Davao del Sur', sampleTime: '8:45 AM',
    prices: [
      { id: 'digos-cow', category: 'cow', name: 'Cow', unit: 'Per kg live weight', min: 98, max: 110, median: 104, change: 2, observations: 19, history: [99, 100, 101, 102, 102, 103, 104] },
      { id: 'digos-goat', category: 'goat', name: 'Goat', unit: 'Per kg live weight', min: 235, max: 265, median: 250, change: 1.2, observations: 13, history: [245, 246, 247, 248, 248, 249, 250] },
      { id: 'digos-pig', category: 'pig', name: 'Fattened Hog', unit: 'Per kg live weight', min: 176, max: 194, median: 185, change: 2.4, observations: 24, history: [179, 180, 181, 182, 183, 184, 185] },
      { id: 'digos-poultry', category: 'poultry', name: 'Broiler Chicken', unit: 'Per kg live weight', min: 135, max: 151, median: 143, change: 0, observations: 22, history: [143, 143, 142, 143, 143, 143, 143] },
    ],
  },
  {
    id: 'mati', name: 'Mati Livestock Trading Area', location: 'Mati City, Davao Oriental', sampleTime: '4:20 PM (previous sample)',
    prices: [
      { id: 'mati-cow', category: 'cow', name: 'Cow', unit: 'Per kg live weight', min: 96, max: 108, median: 102, change: 1, observations: 12, history: [99, 99, 100, 100, 101, 101, 102] },
      { id: 'mati-goat', category: 'goat', name: 'Goat', unit: 'Per kg live weight', min: 230, max: 262, median: 246, change: 1.7, observations: 10, history: [239, 240, 242, 243, 244, 245, 246] },
      { id: 'mati-pig', category: 'pig', name: 'Fattened Hog', unit: 'Per kg live weight', min: 174, max: 192, median: 183, change: -0.5, observations: 18, history: [185, 185, 184, 184, 184, 183, 183] },
      { id: 'mati-poultry', category: 'poultry', name: 'Native Chicken', unit: 'Per head • approx. 1.2 kg', min: 208, max: 238, median: 223, change: 1.4, observations: 15, history: [217, 218, 219, 220, 221, 222, 223] },
    ],
  },
];
