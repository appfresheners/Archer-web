import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectDetailPage from "./page";

// --- Mocks -----------------------------------------------------------------

const maybeSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => maybeSingle(),
        }),
      }),
    }),
  }),
}));

// notFound throws a sentinel so we can assert the not-found branch was taken
// (mirrors Next's control-flow-throwing behavior).
class NotFoundError extends Error {}
const notFound = vi.fn(() => {
  throw new NotFoundError("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
}));

// Stub OutputPanel so we can assert it received the stored breakdown markdown
// without pulling in the full react-markdown render.
vi.mock("@/components/OutputPanel", () => ({
  default: ({ markdown }: { markdown: string }) => (
    <div data-testid="output-panel">{markdown}</div>
  ),
}));

// --- Helpers ---------------------------------------------------------------

async function renderPage(id: string) {
  const ui = await ProjectDetailPage({ params: Promise.resolve({ id }) });
  return render(ui);
}

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the project name and passes breakdown_md to OutputPanel", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: "project-1",
        name: "Portfolio site live",
        breakdown_md: "# Portfolio site live\n\n## Purpose\nWhy.",
      },
      error: null,
    });

    await renderPage("project-1");

    expect(
      screen.getByRole("heading", { name: "Portfolio site live" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("output-panel")).toHaveTextContent("## Purpose");
    expect(notFound).not.toHaveBeenCalled();
  });

  it("calls notFound() when the row is absent (nonexistent or unowned)", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(renderPage("missing")).rejects.toBeInstanceOf(NotFoundError);
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("calls notFound() when the query errors", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(renderPage("project-1")).rejects.toBeInstanceOf(NotFoundError);
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
