import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TrackerClient } from "./tracker-client";

export default async function TrackerPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");
  return <TrackerClient />;
}
