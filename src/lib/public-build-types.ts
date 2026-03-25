/** Shared shapes for saved builds on profile / share pages */

/** Matches `PlacedModule` fields persisted on `BuildEntry`. */
export interface PublicPlacedModule {
  moduleId: string;
  level: number;
  name: string;
  image: string;
  capacity: number;
  socket: string;
  tier: string;
  customPreview?: string;
  ancestorStats?: {
    positives: { stat: string; value: number }[];
    negative?: { stat: string; value: number };
  };
}

/** Inline reactor on a build (same shape as tracker `BuildReactor`). */
export interface PublicBuildReactor {
  id?: string;
  name: string;
  element: string;
  skillType: string;
  level: number;
  enhancement: string;
  substats: { stat: string; value: string; tier?: string }[];
}

export interface PublicExternalComponent {
  slot: string;
  baseStat: string;
  baseValue: number;
  substats: { stat: string; value: number }[];
  set?: string;
}

export interface PublicBuild {
  id: string;
  name: string;
  /** "descendant" | "weapon" — may be missing on very old saves */
  targetType?: string;
  /** Descendant name or weapon slug */
  targetKey?: string;
  displayName: string;
  imageUrl: string;
  moduleSlots: string[];
  plannerSlots?: (PublicPlacedModule | null)[] | null;
  /** Descendant builds: slot socket catalysts (same shape as `BuildEntry.plannerSlotCatalysts`). */
  plannerSlotCatalysts?: (string | null)[][] | null;
  reactor?: PublicBuildReactor | null;
  targetLevel?: number;
  archeLevel?: number;
  externalComponents?: PublicExternalComponent[];
  reactorNotes?: string;
  notes: string;
  updatedAt?: string;
}
