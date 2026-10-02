export type PublicProfile = {
  id: string;
  fullName: string;
  city: string;
  memberSince: string;
  verified: boolean;
  photoUrl: string | null;
  rating: { average: number | null; count: number };
  myRating: number | null;
  canRate: boolean;
};
