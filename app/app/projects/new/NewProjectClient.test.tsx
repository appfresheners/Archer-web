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
    vi.spyOn(console, "error").mockImplementation(() => { });
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

  it("surfaces the server's actionable 500 message and does NOT navigate", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: "GEMINI_API_KEY is not configured. Add GEMINI_API_KEY to your environment.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewProjectClient />);
    typeAndSubmit("Build a website");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/GEMINI_API_KEY/),
    );
    expect(push).not.toHaveBeenCalled();
    // Form is re-enabled so the user can retry.
    expect(screen.getByRole("textbox")).not.toBeDisabled();
  });

  it("shows a timeout message with a Try again action on a 504", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 504,
      json: async () => ({
        error: "The request timed out after 30 seconds. Please try again.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewProjectClient />);
    typeAndSubmit("Build a website");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/timed out/i),
    );
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("does NOT navigate on a 200 that lacks an id (no /app/projects/undefined)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewProjectClient />);
    typeAndSubmit("Build a website");

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });

  it("uses the timeout fallback copy on a 504 with no error body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 504,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewProjectClient />);
    typeAndSubmit("Build a website");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/timed out/i),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("uses the generic fallback copy on a non-504 error with no error body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewProjectClient />);
    typeAndSubmit("Build a website");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i),
    );
    expect(push).not.toHaveBeenCalled();
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

  it("Try again re-POSTs the same input + depth without re-typing", async () => {
    // First attempt fails (504), second attempt (via Try again) succeeds.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 504,
        json: async () => ({ error: "timed out" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "project-retry" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewProjectClient />);
    typeAndSubmit("Personal portfolio site");

    const retry = await screen.findByRole("button", { name: /try again/i });
    fireEvent.click(retry);

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/app/projects/project-retry"),
    );

    // Both POSTs carried the identical body — the retry reused the preserved
    // input + depth, no re-typing.
    const expectedBody = JSON.stringify({
      mode: "project",
      input: "Personal portfolio site",
      depth: "minimal",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ body: expectedBody });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ body: expectedBody });
  });
});
