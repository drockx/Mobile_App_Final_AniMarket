export type PublicProfile = {
  id: string;
  fullName: string;
  city: string;
  purok: string;
  barangay: string;
  phone: string;
  email: string;
  memberSince: string;
  verified: boolean;
  photoUrl: string | null;
  rating: { average: number | null; count: number };
  myRating: number | null;
  canRate: boolean;
};
