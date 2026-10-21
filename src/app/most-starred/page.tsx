import type { Metadata } from "next";
import { DISCOVERY_VIEWS } from "@/config/discovery";
import { DiscoveryPage } from "@/features/repository-search/discovery-page";

export const metadata: Metadata = {
  title: "Most Starred",
  description: DISCOVERY_VIEWS["most-starred"].method,
};

export default function Page({ searchParams }: PageProps<"/most-starred">) {
  return <DiscoveryPage slug="most-starred" searchParams={searchParams} />;
}
