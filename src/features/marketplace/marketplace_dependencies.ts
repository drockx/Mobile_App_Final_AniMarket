import { createMarketplaceService } from './application/marketplace_service';
import { mockListingRepository } from './data/mock_listing_repository';

/** The app's current catalog wiring. Replace the repository when a real API is available. */
export const marketplaceService = createMarketplaceService(mockListingRepository);
