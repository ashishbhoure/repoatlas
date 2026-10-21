import type { Metadata } from "next";
import { DISCOVERY_VIEWS } from "@/config/discovery";
import { DiscoveryPage } from "@/features/repository-search/discovery-page";

export const metadata: Metadata = {
  title: "Most Forked",
  description: DISCOVERY_VIEWS["most-forked"].method,
};

export default function Page({ searchParams }: PageProps<"/most-forked">) {
  return <DiscoveryPage slug="most-forked" searchParams={searchParams} />;
}
