import React from "react";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/(marketing)/page";

jest.mock("next/link", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function MockLink({ href, children, ...rest }: any) {
    return <a href={href} {...rest}>{children}</a>;
  };
});

describe("HomePage (Sorabase marketing)", () => {
  it("renders the Sorabase wordmark in the hero", () => {
    render(<HomePage />);
    expect(screen.getByText(/Sorabase/i)).toBeInTheDocument();
  });

  it("renders the hero headline", () => {
    render(<HomePage />);
    expect(screen.getByText(/from any meeting/i)).toBeInTheDocument();
  });

  it("renders a Get started CTA linking to /signup", () => {
    render(<HomePage />);
    const ctas = screen.getAllByRole("link", { name: /get started free/i });
    expect(ctas[0]).toHaveAttribute("href", "/signup");
  });

  it("renders a How it works CTA", () => {
    render(<HomePage />);
    expect(screen.getByRole("link", { name: /how it works/i })).toBeInTheDocument();
  });

  it("renders the eyebrow label", () => {
    render(<HomePage />);
    expect(screen.getByText(/meeting workflow platform/i)).toBeInTheDocument();
  });

  it("renders the Recruiter Mode section", () => {
    render(<HomePage />);
    expect(screen.getByText(/Recruiter Mode/i)).toBeInTheDocument();
  });

  it("renders the General Mode section", () => {
    render(<HomePage />);
    expect(screen.getByText(/General Mode/i)).toBeInTheDocument();
  });
});
