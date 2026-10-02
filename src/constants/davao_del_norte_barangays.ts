import { isDavaoDelNorteLocality, type DavaoDelNorteLocality } from './davao_del_norte';

// PSA Philippine Standard Geographic Code, retrieved 3 October 2026.
// Province: https://psa.gov.ph/classification/psgc/citimuni/1102300000
// Barangays: https://psa.gov.ph/classification/psgc/barangays/{municipalityCode}
// The municipality codes below identify the source table for each list.
export const DAVAO_DEL_NORTE_BARANGAYS: Record<DavaoDelNorteLocality, readonly string[]> = {
  // 1102301000
  Asuncion: ['Binancian', 'Buan', 'Buclad', 'Cabaywa', 'Camansa', 'Cambanogoy', 'Camoning', 'Canatan', 'Concepcion', 'Doña Andrea', 'Magatos', 'Napungas', 'New Bantayan', 'New Loon', 'New Santiago', 'Pamacaun', 'Sagayen', 'San Vicente', 'Santa Filomena', 'Sonlon'],
  // 1102323000
  'Braulio E. Dujali': ['Cabayangan', 'Dujali', 'Magupising', 'New Casay', 'Tanglaw'],
  // 1102303000
  Carmen: ['Alejal', 'Anibongan', 'Asuncion', 'Cebulano', 'Guadalupe', 'Ising', 'La Paz', 'Mabaus', 'Mabuhay', 'Magsaysay', 'Mangalcal', 'Minda', 'New Camiling', 'Salvacion', 'San Isidro', 'Sto. Niño', 'Taba', 'Tibulao', 'Tubod', 'Tuganay'],
  // 1102305000
  Kapalong: ['Capungagan', 'Florida', 'Gabuyan', 'Gupitan', 'Katipunan', 'Luna', 'Mabantao', 'Mamacao', 'Maniki', 'Pag-asa', 'Sampao', 'Semong', 'Sua-on', 'Tiburcia'],
  // 1102314000
  'New Corella': ['Cabidianan', 'Carcor', 'Del Monte', 'Del Pilar', 'El Salvador', 'Limba-an', 'Macgum', 'Mambing', 'Mesaoy', 'New Bohol', 'New Cortez', 'New Sambog', 'Patrocenio', 'Poblacion', 'San Jose', 'San Roque', 'Sta. Cruz', 'Sta. Fe', 'Sto. Niño', 'Suawon'],
  // 1102315000
  'Panabo City': ['A. O. Floirendo', 'Buenavista', 'Cacao', 'Cagangohan', 'Consolacion', 'Dapco', 'Datu Abdul Dadia', 'Gredu', 'J.P. Laurel', 'Kasilak', 'Katipunan', 'Katualan', 'Kauswagan', 'Kiotoy', 'Little Panay', 'Lower Panaga', 'Mabunao', 'Maduao', 'Malativas', 'Manay', 'Nanyo', 'New Malaga', 'New Malitbog', 'New Pandan', 'New Visayas', 'Quezon', 'Salvacion', 'San Francisco', 'San Nicolas', 'San Pedro', 'San Roque', 'San Vicente', 'Santa Cruz', 'Santo Niño', 'Sindaton', 'Southern Davao', 'Tagpore', 'Tibungol', 'Upper Licanan', 'Waterfall'],
  // 1102317000 — retain district qualifiers where barangay names repeat.
  'Island Garden City of Samal': ['Adecor', 'Anonang', 'Aumbay', 'Aundanao', 'Balet', 'Bandera', 'Caliclic', 'Camudmud', 'Catagman', 'Cawag', 'Cogon', 'Cogon (Talicod)', 'Dadatan', 'Del Monte', 'Guilon', 'Kanaan', 'Kinawitnon', 'Libertad', 'Libuak', 'Licup', 'Limao', 'Linosutan', 'Mambago-A', 'Mambago-B', 'Miranda', 'Moncado', 'Pangubatan', 'Peñaplata', 'Poblacion', 'San Agustin', 'San Antonio', 'San Isidro (Babak)', 'San Isidro (Kaputian)', 'San Jose', 'San Miguel', 'San Remigio', 'Santa Cruz', 'Santo Niño', 'Sion', 'Tagbaobo', 'Tagbay', 'Tagbitan-ag', 'Tagdaliao', 'Tagpopongan', 'Tambo', 'Toril'],
  // 1102324000 — Sawata was formerly named San Isidro.
  Sawata: ['Dacudao', 'Datu Balong', 'Igangon', 'Kipalili', 'Libuton', 'Linao', 'Mamangan', 'Monte Dujali', 'Pinamuno', 'Poblacion', 'Sabangan', 'San Miguel', 'Santo Niño'],
  // 1102318000
  'Santo Tomas': ['Balagunan', 'Bobongon', 'Casig-Ang', 'Esperanza', 'Kimamon', 'Kinamayan', 'La Libertad', 'Lungaog', 'Magwawa', 'New Katipunan', 'New Visayas', 'Pantaron', 'Salvacion', 'San Jose', 'San Miguel', 'San Vicente', 'Talomo', 'Tibal-og', 'Tulalian'],
  // 1102319000
  'Tagum City': ['Apokon', 'Bincungan', 'Busaon', 'Canocotan', 'Cuambogan', 'La Filipina', 'Liboganon', 'Madaum', 'Magdum', 'Magugpo East', 'Magugpo North', 'Magugpo Poblacion', 'Magugpo South', 'Magugpo West', 'Mankilam', 'New Balamban', 'Nueva Fuerza', 'Pagsabangan', 'Pandapan', 'San Agustin', 'San Isidro', 'San Miguel', 'Visayan Village'],
  // 1102322000
  Talaingod: ['Dagohoy', 'Palma Gil', 'Santo Niño'],
};

export function barangaysForLocality(city: string): readonly string[] {
  return isDavaoDelNorteLocality(city) ? DAVAO_DEL_NORTE_BARANGAYS[city] : [];
}

export function isBarangayInLocality(city: string, barangay: string): boolean {
  return barangaysForLocality(city).includes(barangay);
}

// Match only a unique, known barangay from map results or older saved addresses.
// Ambiguous results such as "Magugpo" or Samal's "San Isidro" require selection.
export function canonicalBarangay(city: string, value?: string): string {
  if (!value) return '';
  const key = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/^(barangay|brgy\.?)\s+/, '').replace(/\s*\((pob\.?|poblacion)\)\s*$/, '')
    .replace(/\bsto\.?\s+/g, 'santo ').replace(/\bsta\.?\s+/g, 'santa ').replace(/[^a-z0-9]/g, '');
  const matches = barangaysForLocality(city).filter((name) => key(name) === key(value));
  return matches.length === 1 ? matches[0] : '';
}
