import type { Metadata } from "next";
import { DISCOVERY_VIEWS } from "@/config/discovery";
import { DiscoveryPage } from "@/features/repository-search/discovery-page";

export const metadata: Metadata = {
  title: "Recently Created",
  description: DISCOVERY_VIEWS["recently-created"].method,
};

export default function Page({ searchParams }: PageProps<"/recently-created">) {
  return <DiscoveryPage slug="recently-created" searchParams={searchParams} />;
}
