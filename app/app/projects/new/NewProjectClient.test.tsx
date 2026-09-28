import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NewProjectClient from "./NewProjectClient";

// --- Mocks -----------------------------------------------------------------

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

// --- Helpers ---------------------------------------------------------------

function typeAndSubmit(value: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: /break it down/i }));
}

describe("NewProjectClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs the project + depth and navigates to the new project on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "project-99" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewProjectClient />);
    typeAndSubmit("Personal portfolio site");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/projects/project-99"));

    // The POST carried the discriminated project body with the default depth.
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          mode: "project",
          input: "Personal portfolio site",
          depth: "minimal",
        }),
      }),
    );
  });

  it("shows the server error and does NOT navigate when the request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "The request timed out after 30 seconds. Please try again." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewProjectClient />);
    typeAndSubmit("Build a website");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/timed out/i),
    );
    expect(push).not.toHaveBeenCalled();
    // Form is re-enabled so the user can retry.
    expect(screen.getByRole("textbox")).not.toBeDisabled();
  });

  it("surfaces a network error and does not navigate when fetch rejects", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    render(<NewProjectClient />);
    typeAndSubmit("Build a website");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/connection/i),
    );
    expect(push).not.toHaveBeenCalled();
  });
});
