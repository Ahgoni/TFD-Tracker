/** Shared shapes for saved builds on profile / share pages */

export interface PublicPlacedModule {
  moduleId: string;
  level: number;
  name: string;
  image: string;
  capacity: number;
  socket: string;
  tier: string;
}

export interface PublicBuild {
  id: string;
  name: string;
  targetType: string;
  displayName: string;
  imageUrl: string;
  moduleSlots: string[];
  plannerSlots?: (PublicPlacedModule | null)[] | null;
  reactorNotes?: string;
  notes: string;
}
