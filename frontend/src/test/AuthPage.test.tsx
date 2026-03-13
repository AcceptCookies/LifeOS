import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthPage from "../AuthPage";

// Mock the api module
vi.mock("../api", () => ({
  api: {
    login: vi.fn(),
    register: vi.fn(),
  },
  token: {
    get: vi.fn(() => null),
    set: vi.fn(),
    clear: vi.fn(),
  },
}));

// Import the mocked module so we can configure mock implementations
import { api } from "../api";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("AuthPage", () => {
  describe("initial render (login mode)", () => {
    it("renders the LifeOS title", () => {
      render(<AuthPage onAuth={vi.fn()} />);
      expect(screen.getByText("LifeOS")).toBeInTheDocument();
    });

    it("renders an email input", () => {
      render(<AuthPage onAuth={vi.fn()} />);
      expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    });

    it("renders a password input", () => {
      render(<AuthPage onAuth={vi.fn()} />);
      expect(screen.getByPlaceholderText("Heslo")).toBeInTheDocument();
    });

    it("renders the login submit button", () => {
      render(<AuthPage onAuth={vi.fn()} />);
      expect(screen.getByRole("button", { name: "Prihlásiť" })).toBeInTheDocument();
    });

    it("renders the toggle button to switch to register", () => {
      render(<AuthPage onAuth={vi.fn()} />);
      expect(screen.getByText(/registruj sa/i)).toBeInTheDocument();
    });
  });

  describe("switching to register mode", () => {
    it("clicking the register toggle shows the register submit button", async () => {
      const user = userEvent.setup();
      render(<AuthPage onAuth={vi.fn()} />);

      await user.click(screen.getByText(/registruj sa/i));

      expect(screen.getByRole("button", { name: "Registrovať" })).toBeInTheDocument();
    });

    it("clicking toggle shows 'Registrovať sa' subtitle", async () => {
      const user = userEvent.setup();
      render(<AuthPage onAuth={vi.fn()} />);

      await user.click(screen.getByText(/registruj sa/i));

      expect(screen.getByText("Registrovať sa")).toBeInTheDocument();
    });

    it("clicking toggle hides login-only checkboxes", async () => {
      const user = userEvent.setup();
      render(<AuthPage onAuth={vi.fn()} />);

      await user.click(screen.getByText(/registruj sa/i));

      expect(screen.queryByText("Ostať prihlásený")).not.toBeInTheDocument();
    });

    it("can switch back to login mode", async () => {
      const user = userEvent.setup();
      render(<AuthPage onAuth={vi.fn()} />);

      await user.click(screen.getByText(/registruj sa/i));
      await user.click(screen.getByText(/prihlás sa/i));

      expect(screen.getByRole("button", { name: "Prihlásiť" })).toBeInTheDocument();
    });
  });

  describe("form submission — login", () => {
    it("calls api.login with email and password from form inputs", async () => {
      const user = userEvent.setup();
      const mockLogin = vi.mocked(api.login);
      mockLogin.mockResolvedValueOnce(undefined);

      render(<AuthPage onAuth={vi.fn()} />);

      await user.type(screen.getByPlaceholderText("Email"), "test@example.com");
      await user.type(screen.getByPlaceholderText("Heslo"), "mypassword");
      await user.click(screen.getByRole("button", { name: "Prihlásiť" }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith("test@example.com", "mypassword", true);
      });
    });

    it("calls onAuth callback after successful login", async () => {
      const user = userEvent.setup();
      const mockLogin = vi.mocked(api.login);
      mockLogin.mockResolvedValueOnce(undefined);
      const onAuth = vi.fn();

      render(<AuthPage onAuth={onAuth} />);

      await user.type(screen.getByPlaceholderText("Email"), "test@example.com");
      await user.type(screen.getByPlaceholderText("Heslo"), "mypassword");
      await user.click(screen.getByRole("button", { name: "Prihlásiť" }));

      await waitFor(() => {
        expect(onAuth).toHaveBeenCalledOnce();
      });
    });

    it("shows error message when api.login throws", async () => {
      const user = userEvent.setup();
      const mockLogin = vi.mocked(api.login);
      mockLogin.mockRejectedValueOnce(new Error("Invalid credentials"));

      render(<AuthPage onAuth={vi.fn()} />);

      await user.type(screen.getByPlaceholderText("Email"), "bad@example.com");
      await user.type(screen.getByPlaceholderText("Heslo"), "wrongpass");
      await user.click(screen.getByRole("button", { name: "Prihlásiť" }));

      await waitFor(() => {
        expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
      });
    });

    it("does not call onAuth when login fails", async () => {
      const user = userEvent.setup();
      vi.mocked(api.login).mockRejectedValueOnce(new Error("fail"));
      const onAuth = vi.fn();

      render(<AuthPage onAuth={onAuth} />);

      await user.type(screen.getByPlaceholderText("Email"), "x@x.com");
      await user.type(screen.getByPlaceholderText("Heslo"), "p");
      await user.click(screen.getByRole("button", { name: "Prihlásiť" }));

      await waitFor(() => {
        expect(onAuth).not.toHaveBeenCalled();
      });
    });
  });

  describe("form submission — register", () => {
    it("calls api.register with email and password", async () => {
      const user = userEvent.setup();
      vi.mocked(api.register).mockResolvedValueOnce(undefined);

      render(<AuthPage onAuth={vi.fn()} />);

      // Switch to register mode
      await user.click(screen.getByText(/registruj sa/i));

      await user.type(screen.getByPlaceholderText("Email"), "new@example.com");
      await user.type(screen.getByPlaceholderText("Heslo"), "newpassword");
      await user.click(screen.getByRole("button", { name: "Registrovať" }));

      await waitFor(() => {
        expect(vi.mocked(api.register)).toHaveBeenCalledWith("new@example.com", "newpassword");
      });
    });

    it("calls onAuth after successful registration", async () => {
      const user = userEvent.setup();
      vi.mocked(api.register).mockResolvedValueOnce(undefined);
      const onAuth = vi.fn();

      render(<AuthPage onAuth={onAuth} />);

      await user.click(screen.getByText(/registruj sa/i));
      await user.type(screen.getByPlaceholderText("Email"), "new@example.com");
      await user.type(screen.getByPlaceholderText("Heslo"), "newpassword");
      await user.click(screen.getByRole("button", { name: "Registrovať" }));

      await waitFor(() => {
        expect(onAuth).toHaveBeenCalledOnce();
      });
    });

    it("shows error when api.register throws", async () => {
      const user = userEvent.setup();
      vi.mocked(api.register).mockRejectedValueOnce(new Error("Email already taken"));

      render(<AuthPage onAuth={vi.fn()} />);

      await user.click(screen.getByText(/registruj sa/i));
      await user.type(screen.getByPlaceholderText("Email"), "taken@example.com");
      await user.type(screen.getByPlaceholderText("Heslo"), "somepassword");
      await user.click(screen.getByRole("button", { name: "Registrovať" }));

      await waitFor(() => {
        expect(screen.getByText("Email already taken")).toBeInTheDocument();
      });
    });
  });
});
