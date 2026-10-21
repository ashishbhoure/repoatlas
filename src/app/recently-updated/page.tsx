import type { Metadata } from "next";
import { DISCOVERY_VIEWS } from "@/config/discovery";
import { DiscoveryPage } from "@/features/repository-search/discovery-page";

export const metadata: Metadata = {
  title: "Recently Updated",
  description: DISCOVERY_VIEWS["recently-updated"].method,
};

export default function Page({ searchParams }: PageProps<"/recently-updated">) {
  return <DiscoveryPage slug="recently-updated" searchParams={searchParams} />;
}
