"use client";

import { CommunityTierList } from "@/components/community-tier-list";
import { SiteTopNav } from "@/components/site-top-nav";

export function TierListPage() {
  return (
    <div className="landing">
      <SiteTopNav />
      <CommunityTierList />
    </div>
  );
}
