// Metro needs literal require paths for bundled images. Keep asset resolution out of the domain model.
const listingImages: Record<string, number> = {
  'brahman-bull': require('../../../../assets/images/marketplace/brahman-bull.png'),
  'holstein-heifer': require('../../../../assets/images/marketplace/cow1.jpg'),
  'native-goat': require('../../../../assets/images/marketplace/goat1.jpg'),
  'native-chickens': require('../../../../assets/images/marketplace/chicken1.jpg'),
  'landrace-piglets': require('../../../../assets/images/marketplace/pig1.jpg'),
  'holstein-cow': require('../../../../assets/images/marketplace/cow2.jpg'),
  'saanen-goat': require('../../../../assets/images/marketplace/goat2.jpg'),
  'native-chicken-flock': require('../../../../assets/images/marketplace/chicken2.jpg'),
  'large-white-piglets': require('../../../../assets/images/marketplace/pig2.jpg'),
};

export function getListingImage(id: string): number | undefined {
  return listingImages[id];
}
