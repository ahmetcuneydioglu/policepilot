import { redirect } from "next/navigation";

export default async function AgencyLandingPage({
  params,
}: {
  params: Promise<{ agencySlug: string }>;
}) {
  const { agencySlug } = await params;
  redirect(`/a/${agencySlug}/teklif-al`);
}
