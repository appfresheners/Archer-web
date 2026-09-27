import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetPasswordForm from "./ResetPasswordForm";

// --- Mocks -----------------------------------------------------------------

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const updateUser = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { updateUser },
  }),
}));

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the password and navigates to /app/engage on success", async () => {
    updateUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText("New password"), "newsecret123");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ password: "newsecret123" });
    });
    expect(push).toHaveBeenCalledWith("/app/engage");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows an inline error and stays on the page when the update fails", async () => {
    updateUser.mockResolvedValue({
      data: {},
      error: { message: "Password should be at least 6 characters" },
    });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText("New password"), "x");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/stronger password/i);
    expect(push).not.toHaveBeenCalled();
  });

  it("surfaces a friendly error when there is no recovery session", async () => {
    updateUser.mockResolvedValue({
      data: {},
      error: { message: "Auth session missing!" },
    });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText("New password"), "newsecret123");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /expired or is invalid/i,
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("treats a missing user in the response as a failure (no navigation)", async () => {
    updateUser.mockResolvedValue({ data: { user: null }, error: null });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText("New password"), "newsecret123");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("blocks an empty password before calling Supabase", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("uses a new-password field with the right a11y attributes", () => {
    render(<ResetPasswordForm />);
    const field = screen.getByLabelText("New password");
    expect(field).toHaveAttribute("type", "password");
    expect(field).toHaveAttribute("autocomplete", "new-password");
  });

  it("disables the submit button while the request is in flight", async () => {
    let resolveCall: (value: unknown) => void = () => {};
    updateUser.mockReturnValue(
      new Promise((resolve) => {
        resolveCall = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText("New password"), "newsecret123");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(screen.getByRole("button", { name: /updating/i })).toBeDisabled();

    resolveCall({ data: { user: { id: "u1" } }, error: null });
    await waitFor(() => expect(push).toHaveBeenCalled());
  });
});
