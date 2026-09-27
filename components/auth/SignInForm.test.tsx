import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignInForm from "./SignInForm";

// --- Mocks -----------------------------------------------------------------

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const signInWithPassword = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword },
  }),
}));

describe("SignInForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigates to /app/engage and refreshes on successful sign-in", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "t" }, user: { id: "u1" } },
      error: null,
    });
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "a@b.com",
        password: "secret123",
      });
    });
    expect(push).toHaveBeenCalledWith("/app/engage");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows an inline error and stays on the page for bad credentials", async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "wrongpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/incorrect/i);
    expect(push).not.toHaveBeenCalled();

    // Error region is associated with the inputs via aria-describedby.
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-describedby",
      alert.id,
    );
  });

  it("blocks empty submit before calling Supabase", async () => {
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("disables the submit button while the request is in flight", async () => {
    let resolveCall: (value: unknown) => void = () => { };
    signInWithPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveCall = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const button = screen.getByRole("button", { name: /signing in/i });
    expect(button).toBeDisabled();

    resolveCall({ data: { session: { access_token: "t" } }, error: null });
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it("shows an error and does not navigate when a network error is thrown", async () => {
    signInWithPassword.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/connection/i);
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /sign in/i })).not.toBeDisabled();
  });

  it("blocks a whitespace-only email before calling Supabase", async () => {
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByLabelText("Email"), "   ");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("offers only email + password — no OAuth or magic-link controls", () => {
    render(<SignInForm />);

    // Exactly two inputs: email + password.
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");

    // No provider / magic-link affordances.
    expect(screen.queryByText(/google|github|oauth|magic link|sso/i)).toBeNull();

    // Only one submit button.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("links to /sign-up (Create account) and /forgot-password", () => {
    render(<SignInForm />);

    expect(
      screen.getByRole("link", { name: /create account/i }),
    ).toHaveAttribute("href", "/sign-up");
    expect(
      screen.getByRole("link", { name: /forgot password/i }),
    ).toHaveAttribute("href", "/forgot-password");
  });
});
