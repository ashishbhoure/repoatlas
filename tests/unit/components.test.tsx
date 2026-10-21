import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SPEC } from "@/lib/validation/search";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => "/explore",
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { SaveRepositoryButton } = await import("@/components/repository/save-button");
const { Filters } = await import("@/components/filters/filter-panel");
const { toast } = await import("sonner");

beforeEach(() => {
  push.mockReset();
  vi.stubGlobal("fetch", vi.fn());
  // Radix and jsdom: matchMedia is used for the responsive filter sheet.
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});
afterEach(() => vi.unstubAllGlobals());

describe("SaveRepositoryButton", () => {
  const repo = { providerId: "1", fullName: "acme/widget" };

  it("links to sign-in when signed out", () => {
    render(<SaveRepositoryButton repo={repo} initiallySaved={false} signedIn={false} />);
    expect(screen.getByRole("link", { name: /sign in to save acme\/widget/i })).toHaveAttribute("href", "/sign-in");
  });

  it("saves optimistically", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ item: {} }), { status: 201 }));
    render(<SaveRepositoryButton repo={repo} initiallySaved={false} signedIn />);
    await userEvent.click(screen.getByRole("button", { name: /save acme\/widget/i }));
    expect(screen.getByRole("button", { name: /unsave acme\/widget/i })).toHaveAttribute("aria-pressed", "true");
    expect(fetch).toHaveBeenCalledWith("/api/saved", expect.objectContaining({ method: "POST" }));
  });

  it("rolls back and reports the server's message when saving fails", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "CONFLICT", message: "You can save up to 2000 repositories." } }), { status: 409 }),
    );
    render(<SaveRepositoryButton repo={repo} initiallySaved={false} signedIn />);
    await userEvent.click(screen.getByRole("button", { name: /save acme\/widget/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^save acme\/widget/i })).toHaveAttribute("aria-pressed", "false"));
    expect(toast.error).toHaveBeenCalledWith("You can save up to 2000 repositories.");
  });
});

describe("Filter panel", () => {
  it("applies filters to the URL and resets the page", async () => {
    render(<Filters spec={{ ...DEFAULT_SPEC, q: "cli", page: 3 }} basePath="/explore" />);
    const [panel] = screen.getAllByTestId("filter-panel");
    const min = panel.querySelector<HTMLInputElement>('input[placeholder="Min"]')!;
    await userEvent.type(min, "500");
    await userEvent.click(screen.getAllByTestId("apply-filters")[0]);
    expect(push).toHaveBeenCalledWith("/explore?q=cli&minStars=500");
  });

  it("explains invalid ranges instead of applying them", async () => {
    render(<Filters spec={DEFAULT_SPEC} basePath="/explore" />);
    const [panel] = screen.getAllByTestId("filter-panel");
    const [min, max] = panel.querySelectorAll<HTMLInputElement>('input[placeholder="Min"], input[placeholder="Max"]');
    await userEvent.type(min, "900");
    await userEvent.type(max, "10");
    await userEvent.click(screen.getAllByTestId("apply-filters")[0]);
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/maxStars must not be lower than minStars/);
  });

  it("hides locked filters", () => {
    render(<Filters spec={DEFAULT_SPEC} basePath="/most-starred" locked={["language", "minStars"]} />);
    const [panel] = screen.getAllByTestId("filter-panel");
    expect(panel.textContent).not.toContain("Language");
    expect(panel.textContent).toContain("License");
  });
});
