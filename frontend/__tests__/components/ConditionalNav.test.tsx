import React from "react";
import { render, screen } from "@testing-library/react";
import ConditionalNav from "@/components/ConditionalNav";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

jest.mock("next/link", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function MockLink({ href, children, ...rest }: any) {
    return <a href={href} {...rest}>{children}</a>;
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { usePathname } = require("next/navigation") as { usePathname: jest.Mock };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ConditionalNav", () => {
  afterEach(() => jest.clearAllMocks());

  it("renders nothing on /workflow (workflow has its own header)", () => {
    usePathname.mockReturnValue("/workflow");
    const { container } = render(<ConditionalNav />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing on any /workflow/* sub-path", () => {
    usePathname.mockReturnValue("/workflow/some-sub-page");
    const { container } = render(<ConditionalNav />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the Pilot wordmark on /candidates", () => {
    usePathname.mockReturnValue("/candidates");
    render(<ConditionalNav />);
    expect(screen.getByText(/Pilot/)).toBeInTheDocument();
  });

  // ── Recruiting mode nav ──────────────────────────────────────────────────

  it("shows Dashboard and Queue links on /candidates (recruiting mode)", () => {
    usePathname.mockReturnValue("/candidates");
    render(<ConditionalNav />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Queue" })).toBeInTheDocument();
  });

  it("shows the Workflow CTA button on recruiting pages", () => {
    usePathname.mockReturnValue("/dashboard");
    render(<ConditionalNav />);
    expect(screen.getByRole("link", { name: "Workflow" })).toBeInTheDocument();
  });

  // ── General mode nav ─────────────────────────────────────────────────────

  it("shows 'New transcript' link on /general", () => {
    usePathname.mockReturnValue("/general");
    render(<ConditionalNav />);
    expect(screen.getByRole("link", { name: "New transcript" })).toBeInTheDocument();
  });

  it("does not show Dashboard or Queue links on /general", () => {
    usePathname.mockReturnValue("/general");
    render(<ConditionalNav />);
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Queue" })).toBeNull();
  });

  // ── Mode switcher ─────────────────────────────────────────────────────────

  it("highlights Recruiting in the mode switcher on /candidates", () => {
    usePathname.mockReturnValue("/candidates");
    render(<ConditionalNav />);
    const recruitingLink = screen.getByRole("link", { name: "Recruiting" });
    expect(recruitingLink).toHaveClass("font-semibold");
  });

  it("highlights General in the mode switcher on /general", () => {
    usePathname.mockReturnValue("/general");
    render(<ConditionalNav />);
    const generalLink = screen.getByRole("link", { name: "General" });
    expect(generalLink).toHaveClass("font-semibold");
  });

  it("mode switcher Recruiting link points to /workflow", () => {
    usePathname.mockReturnValue("/candidates");
    render(<ConditionalNav />);
    const link = screen.getByRole("link", { name: "Recruiting" });
    expect(link).toHaveAttribute("href", "/workflow");
  });

  it("mode switcher General link points to /general", () => {
    usePathname.mockReturnValue("/candidates");
    render(<ConditionalNav />);
    const link = screen.getByRole("link", { name: "General" });
    expect(link).toHaveAttribute("href", "/general");
  });
});
