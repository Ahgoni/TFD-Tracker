import type { Metadata } from "next";
import { TierListPage } from "@/components/tier-list-page";

export const metadata: Metadata = {
  title: "Community Tier List",
  description: "Community-voted tier list for The First Descendant descendants and weapons.",
};

export default function TierListRoute() {
  return <TierListPage />;
}
