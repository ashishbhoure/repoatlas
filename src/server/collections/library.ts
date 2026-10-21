import "server-only";
import { randomBytes } from "node:crypto";
import { features } from "@/config/env";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { searchSpecSchema, type SearchSpec } from "@/lib/validation/search";
import { getProvider } from "@/server/providers";

/**
 * User library: saved repositories, collections and saved searches. Every function takes
 * the acting user's id and scopes queries to it, so ownership is enforced in the data
 * layer, not only in route handlers. Repositories are identified by GitHub's stable id,
 * resolved server-side from owner/name (clients cannot supply arbitrary ids).
 */

export const LIMITS = { savedRepositories: 2000, collections: 100, itemsPerCollection: 500, savedSearches: 100 };

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/** Canonical identity for a repository given "owner/name". Throws NOT_FOUND / INVALID_INPUT. */
export async function resolveRepository(fullName: string) {
  const [owner, name, ...rest] = fullName.split("/");
  if (!owner || !name || rest.length) throw new AppError("INVALID_INPUT", "Use the form owner/name.");
  const { data } = await getProvider("github").getRepository(owner, name);
  return { providerRepoId: data.providerId, fullName: data.fullName };
}

// --- Library state for list rendering --------------------------------------

export async function getLibraryState(providerIds: string[]) {
  const enabled = features.auth();
  if (!enabled) return { enabled, signedIn: false, savedIds: new Set<string>() };
  const user = await getCurrentUser();
  if (!user || providerIds.length === 0) return { enabled, signedIn: !!user, savedIds: new Set<string>() };
  const rows = await db().savedRepository.findMany({
    where: { userId: user.id, provider: "GITHUB", providerRepoId: { in: providerIds } },
    select: { providerRepoId: true },
  });
  return { enabled, signedIn: true, savedIds: new Set(rows.map((r) => r.providerRepoId)) };
}

// --- Saved repositories -----------------------------------------------------

export async function listSavedRepositories(userId: string) {
  return db().savedRepository.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: LIMITS.savedRepositories,
  });
}

export async function saveRepository(userId: string, fullName: string, note?: string) {
  const repo = await resolveRepository(fullName);
  const count = await db().savedRepository.count({ where: { userId } });
  if (count >= LIMITS.savedRepositories) {
    throw new AppError("CONFLICT", `You can save up to ${LIMITS.savedRepositories} repositories.`);
  }
  // Upsert makes double-clicks and concurrent saves idempotent.
  return db().savedRepository.upsert({
    where: { userId_provider_providerRepoId: { userId, provider: "GITHUB", providerRepoId: repo.providerRepoId } },
    create: { userId, provider: "GITHUB", providerRepoId: repo.providerRepoId, fullName: repo.fullName, note },
    update: { fullName: repo.fullName, ...(note !== undefined ? { note } : {}) },
  });
}

export async function unsaveRepository(userId: string, providerRepoId: string) {
  await db().savedRepository.deleteMany({ where: { userId, provider: "GITHUB", providerRepoId } });
}

export async function updateSavedNote(userId: string, providerRepoId: string, note: string | null) {
  const r = await db().savedRepository.updateMany({ where: { userId, provider: "GITHUB", providerRepoId }, data: { note } });
  if (r.count === 0) throw new AppError("NOT_FOUND", "That repository is not in your saved list.");
}

// --- Collections ------------------------------------------------------------

export async function listCollections(userId: string) {
  return db().collection.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
}

/** Loads a collection the user owns; throws NOT_FOUND for missing or foreign collections. */
export async function getOwnedCollection(userId: string, id: string) {
  const c = await db().collection.findFirst({
    where: { id, userId },
    include: { items: { orderBy: { addedAt: "desc" } } },
  });
  if (!c) throw new AppError("NOT_FOUND", "Collection not found.");
  return c;
}

export async function getSharedCollection(slug: string) {
  const c = await db().collection.findUnique({
    where: { shareSlug: slug },
    include: { items: { orderBy: { addedAt: "desc" } }, user: { select: { name: true } } },
  });
  if (!c) throw new AppError("NOT_FOUND", "This collection does not exist or is no longer shared.");
  return c;
}

export async function createCollection(userId: string, input: { name: string; description?: string | null }) {
  const count = await db().collection.count({ where: { userId } });
  if (count >= LIMITS.collections) throw new AppError("CONFLICT", `You can create up to ${LIMITS.collections} collections.`);
  try {
    return await db().collection.create({ data: { userId, name: input.name, description: input.description ?? null } });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("CONFLICT", "You already have a collection with that name.");
    throw e;
  }
}

export async function updateCollection(
  userId: string,
  id: string,
  input: { name?: string; description?: string | null; shared?: boolean },
) {
  const current = await getOwnedCollection(userId, id);
  const shareSlug =
    input.shared === undefined ? undefined : input.shared ? (current.shareSlug ?? randomBytes(9).toString("base64url")) : null;
  try {
    return await db().collection.update({
      where: { id: current.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(shareSlug !== undefined ? { shareSlug } : {}),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("CONFLICT", "You already have a collection with that name.");
    throw e;
  }
}

export async function deleteCollection(userId: string, id: string) {
  const r = await db().collection.deleteMany({ where: { id, userId } });
  if (r.count === 0) throw new AppError("NOT_FOUND", "Collection not found.");
}

export async function addToCollection(userId: string, collectionId: string, fullName: string, note?: string) {
  const collection = await getOwnedCollection(userId, collectionId);
  if (collection.items.length >= LIMITS.itemsPerCollection) {
    throw new AppError("CONFLICT", `A collection can hold up to ${LIMITS.itemsPerCollection} repositories.`);
  }
  const repo = await resolveRepository(fullName);
  const item = await db().collectionRepository.upsert({
    where: {
      collectionId_provider_providerRepoId: { collectionId, provider: "GITHUB", providerRepoId: repo.providerRepoId },
    },
    create: { collectionId, provider: "GITHUB", providerRepoId: repo.providerRepoId, fullName: repo.fullName, note },
    update: { fullName: repo.fullName, ...(note !== undefined ? { note } : {}) },
  });
  await db().collection.update({ where: { id: collectionId }, data: { updatedAt: new Date() } });
  return item;
}

export async function removeFromCollection(userId: string, collectionId: string, providerRepoId: string) {
  await getOwnedCollection(userId, collectionId);
  await db().collectionRepository.deleteMany({ where: { collectionId, provider: "GITHUB", providerRepoId } });
  await db().collection.update({ where: { id: collectionId }, data: { updatedAt: new Date() } });
}

export async function updateCollectionItemNote(userId: string, collectionId: string, providerRepoId: string, note: string | null) {
  await getOwnedCollection(userId, collectionId);
  const r = await db().collectionRepository.updateMany({ where: { collectionId, provider: "GITHUB", providerRepoId }, data: { note } });
  if (r.count === 0) throw new AppError("NOT_FOUND", "That repository is not in this collection.");
}

/** Collections of the user with a flag for whether each contains the repository. */
export async function collectionsForRepository(userId: string, providerRepoId: string) {
  const rows = await db().collection.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, items: { where: { providerRepoId }, select: { id: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, contains: r.items.length > 0 }));
}

// --- Saved searches ---------------------------------------------------------

export async function listSavedSearches(userId: string) {
  const rows = await db().savedSearch.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  // Specs are re-validated on read so a schema change can never feed bad data to search.
  return rows.map((r) => {
    const parsed = searchSpecSchema.safeParse(r.spec);
    return { ...r, spec: parsed.success ? parsed.data : null };
  });
}

export async function createSavedSearch(userId: string, name: string, spec: SearchSpec) {
  const count = await db().savedSearch.count({ where: { userId } });
  if (count >= LIMITS.savedSearches) throw new AppError("CONFLICT", `You can keep up to ${LIMITS.savedSearches} saved searches.`);
  const clean = searchSpecSchema.parse({ ...spec, page: 1 });
  return db().savedSearch.create({ data: { userId, name, spec: clean as unknown as Prisma.InputJsonValue } });
}

export async function deleteSavedSearch(userId: string, id: string) {
  const r = await db().savedSearch.deleteMany({ where: { id, userId } });
  if (r.count === 0) throw new AppError("NOT_FOUND", "Saved search not found.");
}
