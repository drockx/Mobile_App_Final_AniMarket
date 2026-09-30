export const categories = [
  { value: 'cattle', label: 'Cattle' },
  { value: 'goat', label: 'Goat' },
  { value: 'swine', label: 'Swine' },
  { value: 'poultry', label: 'Poultry' },
] as const;

export type Category = typeof categories[number]['value'];
export type Province = keyof typeof references;
export type Purpose = 'general' | 'breeding' | 'fattening' | 'slaughter' | 'dairy';
export type Condition = 'C' | 'B' | 'A';

// Prototype ranges supplied with the screen design; replace with verified market data.
export const references = {
  'Davao del Norte': { cattle: [110, 125], goat: [180, 230], swine: [170, 200], poultry: [120, 180] },
  'Davao de Oro': { cattle: [108, 123], goat: [175, 225], swine: [168, 198], poultry: [118, 175] },
  'Davao del Sur': { cattle: [112, 128], goat: [185, 235], swine: [172, 205], poultry: [125, 185] },
  Bukidnon: { cattle: [105, 120], goat: [170, 220], swine: [165, 195], poultry: [115, 170] },
  Other: { cattle: [105, 125], goat: [170, 230], swine: [165, 200], poultry: [115, 180] },
} as const;

const conditionFactors: Record<Condition, number> = { C: 0.9, B: 1, A: 1.08 };
const purposeFactors: Record<Purpose, number> = { general: 1, breeding: 1.05, fattening: 1, slaughter: 0.98, dairy: 1.04 };

export function estimatePrice(input: {
  category: Category;
  province: Province;
  weight: number;
  age: number;
  condition: Condition;
  purpose: Purpose;
}) {
  const [lowRate, highRate] = references[input.province][input.category];
  const conditionFactor = conditionFactors[input.condition];
  const ageFactor = input.age < 6 ? 0.9 : input.age > 84 ? 0.92 : 1;
  const purposeFactor = purposeFactors[input.purpose];
  const multiplier = input.weight * conditionFactor * ageFactor * purposeFactor;
  const minimum = multiplier * lowRate;
  const maximum = multiplier * highRate;
  const midpoint = (minimum + maximum) / 2;
  return {
    minimum,
    maximum,
    suggested: midpoint < 500 ? Math.round(midpoint) : Math.round(midpoint / 500) * 500,
    conditionFactor,
    ageFactor,
    purposeFactor,
  };
}

export function peso(value: number) {
  return `₱${Math.round(value).toLocaleString('en-PH')}`;
}

export function adjustment(value: number) {
  const percent = Math.round((value - 1) * 100);
  return percent === 0 ? 'No adjustment' : `${percent > 0 ? '+' : ''}${percent}%`;
}
