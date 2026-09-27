import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignUpForm from "./SignUpForm";

// --- Mocks -----------------------------------------------------------------

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const signUp = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signUp },
  }),
}));

describe("SignUpForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an account, navigates to /app/engage and refreshes on success", async () => {
    signUp.mockResolvedValue({
      data: {
        session: { access_token: "t" },
        user: { id: "u1", identities: [{ id: "i1" }] },
      },
      error: null,
    });
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText("Email"), "new@b.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith({
        email: "new@b.com",
        password: "secret123",
      });
    });
    expect(push).toHaveBeenCalledWith("/app/engage");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows an inline error and stays on the page for a duplicate email", async () => {
    signUp.mockResolvedValue({
      error: { message: "User already registered" },
    });
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText("Email"), "dupe@b.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/already exists/i);
    expect(push).not.toHaveBeenCalled();
  });

  it("blocks empty submit before calling Supabase", async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("disables the submit button while the request is in flight", async () => {
    let resolveCall: (value: unknown) => void = () => { };
    signUp.mockReturnValue(
      new Promise((resolve) => {
        resolveCall = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText("Email"), "new@b.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    const button = screen.getByRole("button", { name: /creating account/i });
    expect(button).toBeDisabled();

    resolveCall({
      data: { session: { access_token: "t" }, user: { id: "u1", identities: [{ id: "i1" }] } },
      error: null,
    });
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it("treats an already-registered email (empty identities, no error) as a duplicate, not success", async () => {
    // Supabase anti-enumeration: existing email returns a user with no
    // identities and no error. Must not navigate as if it were a new account.
    signUp.mockResolvedValue({
      data: { session: null, user: { id: "u1", identities: [] } },
      error: null,
    });
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText("Email"), "existing@b.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/already exists/i);
    expect(push).not.toHaveBeenCalled();
  });

  it("shows an error and does not navigate when a network error is thrown", async () => {
    signUp.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText("Email"), "new@b.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/connection/i);
    expect(push).not.toHaveBeenCalled();
  });

  it("offers only email + password — no OAuth or magic-link controls", () => {
    render(<SignUpForm />);

    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "new-password");

    expect(screen.queryByText(/google|github|oauth|magic link|sso/i)).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("links back to /sign-in", () => {
    render(<SignUpForm />);

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });
});
