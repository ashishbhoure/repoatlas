import "server-only";
import { cache } from "react";

/**
 * One timestamp per request, shared by every server component that renders relative
 * times ("3 days ago"), so a page never mixes slightly different "now"s.
 */
export const requestNow = cache((): number => Date.now());
