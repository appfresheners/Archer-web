import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordForm from "./ForgotPasswordForm";

// --- Mocks -----------------------------------------------------------------

const resetPasswordForEmail = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { resetPasswordForEmail },
  }),
}));

/** The neutral confirmation copy the flow must show in every submit path. */
const CONFIRMATION = /if an account exists/i;

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls resetPasswordForEmail with an origin-derived redirectTo", async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(resetPasswordForEmail).toHaveBeenCalledWith("a@b.com", {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
    });
  });

  it("shows the neutral confirmation for a registered email (success path)", async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Email"), "known@b.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByText(CONFIRMATION)).toBeInTheDocument();
  });

  it("shows the SAME neutral confirmation for an unknown email (error swallowed, no enumeration)", async () => {
    resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: "User not found" },
    });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Email"), "unknown@b.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    // Same confirmation — and no hint the account does not exist.
    expect(await screen.findByText(CONFIRMATION)).toBeInTheDocument();
    expect(screen.queryByText(/not found|no account|doesn't exist|does not exist/i)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the same neutral confirmation even when the call throws", async () => {
    resetPasswordForEmail.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByText(CONFIRMATION)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("blocks an empty / whitespace-only email before calling Supabase", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Email"), "   ");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
    expect(screen.queryByText(CONFIRMATION)).toBeNull();
  });

  it("disables the submit button while the request is in flight", async () => {
    let resolveCall: (value: unknown) => void = () => {};
    resetPasswordForEmail.mockReturnValue(
      new Promise((resolve) => {
        resolveCall = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();

    resolveCall({ data: {}, error: null });
    expect(await screen.findByText(CONFIRMATION)).toBeInTheDocument();
  });

  it("links back to /sign-in", () => {
    render(<ForgotPasswordForm />);
    expect(
      screen.getByRole("link", { name: /back to sign in/i }),
    ).toHaveAttribute("href", "/sign-in");
  });
});
