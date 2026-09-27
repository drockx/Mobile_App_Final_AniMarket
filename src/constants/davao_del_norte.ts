export const DAVAO_DEL_NORTE = 'Davao del Norte';

// Philippine Statistics Authority PSGC as of 30 June 2026:
// https://psa.gov.ph/classification/psgc/citimuni/1102300000
export const DAVAO_DEL_NORTE_LOCALITIES = [
  'Asuncion',
  'Braulio E. Dujali',
  'Carmen',
  'Kapalong',
  'New Corella',
  'Panabo City',
  'Island Garden City of Samal',
  'Sawata',
  'Santo Tomas',
  'Tagum City',
  'Talaingod',
] as const;

export type DavaoDelNorteLocality = typeof DAVAO_DEL_NORTE_LOCALITIES[number];

export function davaoDelNorteLocalityLabel(locality: DavaoDelNorteLocality): string {
  return locality === 'Sawata' ? 'Sawata (formerly San Isidro)' : locality;
}

export function isDavaoDelNorteLocality(value: string): value is DavaoDelNorteLocality {
  return DAVAO_DEL_NORTE_LOCALITIES.some((locality) => locality === value);
}

export function davaoDelNorteLocation(locality: DavaoDelNorteLocality): string {
  return `${locality}, ${DAVAO_DEL_NORTE}`;
}

export function isDavaoDelNorteLocation(value: string): boolean {
  return DAVAO_DEL_NORTE_LOCALITIES.some((locality) => davaoDelNorteLocation(locality) === value);
}
