export const categories = [
  { value: 'cattle', label: 'Cow' },
  { value: 'swine', label: 'Pig' },
  { value: 'goat', label: 'Goat' },
  { value: 'poultry', label: 'Chicken' },
] as const;

export type Category = typeof categories[number]['value'];
export type Province = 'Davao del Norte';
export type Purpose = 'general' | 'breeding' | 'fattening' | 'slaughter' | 'dairy';
export type Condition = 'C' | 'B' | 'A';

export type ReferenceRates = readonly [number, number];

const conditionFactors: Record<Condition, number> = { C: 0.9, B: 1, A: 1.08 };
const purposeFactors: Record<Purpose, number> = { general: 1, breeding: 1.05, fattening: 1, slaughter: 0.98, dairy: 1.04 };

export function estimatePrice(input: {
  category: Category;
  province: Province;
  weight: number;
  age: number;
  condition: Condition;
  purpose: Purpose;
}, rates?: ReferenceRates | null) {
  if (!rates || input.province !== 'Davao del Norte' || !categories.some((item) => item.value === input.category)
    || !Number.isFinite(input.weight) || input.weight < 1 || input.weight > 2000
    || !Number.isFinite(input.age) || input.age < 1 || input.age > 240
    || !Number.isFinite(rates[0]) || !Number.isFinite(rates[1]) || rates[0] <= 0 || rates[1] < rates[0]
    || !conditionFactors[input.condition] || !purposeFactors[input.purpose]) return null;
  const [lowRate, highRate] = rates;
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
