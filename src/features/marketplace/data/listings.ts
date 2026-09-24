import type { Listing } from '../domain/listing';

export const listings: Listing[] = [
  {
    id: 'brahman-bull',
    title: 'Brahman Bull',
    subtitle: '(Pure Breed)',
    category: 'Cow',
    details: '450 kg · 2 yrs old',
    price: 45000,
    verified: true,
    location: 'Tagum City, Davao del Norte',
    weight: '450 kg',
    age: '2 Yrs',
    health: 'Vaccinated',
    description: 'Healthy, grass-fed Pure Brahman Bull. Fully dewormed and complete with updated vaccination records. Ideal for breeding stock. Raised in open pasture conditions with good temperament.',
    seller: { name: 'Juan Dela Cruz', memberSince: '2024' },
  },
  {
    id: 'holstein-heifer',
    title: 'Holstein Friesian Heifer',
    category: 'Cow',
    details: '450 kg · 2 yrs old',
    price: 45000,
    verified: true,
  },
  {
    id: 'native-goat',
    title: 'Philippine Native Goat',
    category: 'Goat',
    details: '35 kg · 1 yr old',
    price: 12500,
    verified: true,
  },
  {
    id: 'native-chickens',
    title: 'Native Chickens (Pair)',
    category: 'Chicken',
    details: '2 Hens · Breeding Stock',
    price: 1500,
    verified: true,
  },
  {
    id: 'landrace-piglets',
    title: 'Landrace Piglets',
    category: 'Pig',
    details: '2 months old · Vaccinated',
    price: 4500,
    verified: true,
  },
  {
    id: 'holstein-cow',
    title: 'Holstein Friesian Cow',
    category: 'Cow',
    details: 'Healthy · Ready for farm',
    price: 38000,
    verified: false,
  },
  {
    id: 'saanen-goat',
    title: 'Saanen Goat',
    category: 'Goat',
    details: 'Female · Farm raised',
    price: 8500,
    verified: false,
  },
  {
    id: 'native-chicken-flock',
    title: 'Native Chicken Flock',
    category: 'Chicken',
    details: 'Mixed flock · Healthy',
    price: 2200,
    verified: false,
  },
  {
    id: 'large-white-piglets',
    title: 'Large White Piglets',
    category: 'Pig',
    details: 'Farm raised · Healthy',
    price: 3900,
    verified: false,
  },
];

export function getListingById(id: string): Listing | undefined {
  return listings.find((listing) => listing.id === id);
}
