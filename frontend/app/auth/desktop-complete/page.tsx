"use client";

import { useEffect, useState } from "react";

export default function DesktopCompletePage() {
  const [status, setStatus] = useState<"authorizing" | "done" | "error">("authorizing");

  useEffect(() => {
    let didRedirect = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/desktop-code", { credentials: "include" });
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const { code } = await res.json() as { code: string };

        // Open the Sorabase deep link — Electron catches this via open-url / second-instance
        window.location.href = `sorabase://auth-complete?code=${code}`;
        didRedirect = true;
        setStatus("done");
      } catch {
        setStatus("error");
      }
    })();

    // Fallback: if deep link didn't fire in 2 s, show a manual link
    const t = setTimeout(() => {
      if (!didRedirect) setStatus("error");
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        gap: 12,
        padding: 24,
        textAlign: "center",
        color: "#1c1a17",
      }}
    >
      {status === "authorizing" && (
        <>
          <p style={{ fontSize: 16, fontWeight: 600 }}>Signing you in to Sorabase Desktop…</p>
          <p style={{ fontSize: 13, color: "#78716c" }}>
            This tab will close automatically.
          </p>
        </>
      )}
      {status === "done" && (
        <>
          <p style={{ fontSize: 16, fontWeight: 600 }}>✓ Signed in</p>
          <p style={{ fontSize: 13, color: "#78716c" }}>
            You can close this tab and return to the Sorabase Desktop app.
          </p>
        </>
      )}
      {status === "error" && (
        <>
          <p style={{ fontSize: 16, fontWeight: 600 }}>Something went wrong</p>
          <p style={{ fontSize: 13, color: "#78716c" }}>
            Please close this tab and try signing in again from the desktop app.
          </p>
        </>
      )}
    </div>
  );
}
