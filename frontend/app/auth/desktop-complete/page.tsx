"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function DesktopCompleteInner() {
  const params = useSearchParams();
  const port = params.get("port");
  const [status, setStatus] = useState<"working" | "done" | "error">("working");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // 1. Get a one-time code from the server (session cookie is included automatically)
        const codeRes = await fetch("/api/auth/desktop-code", { credentials: "include" });
        if (!codeRes.ok) {
          setErrorMsg("Could not generate sign-in code. Are you signed in?");
          setStatus("error");
          return;
        }
        const { code } = await codeRes.json() as { code: string };

        // 2a. Primary path: POST the code to Electron's local HTTP server
        if (port) {
          try {
            await fetch(`http://127.0.0.1:${port}/auth-callback?code=${code}`, {
              method: "GET",
              mode: "cors",
            });
            setStatus("done");
            return;
          } catch {
            // Local server unreachable — fall through to deep link
          }
        }

        // 2b. Fallback: open sorabase:// deep link (requires protocol registered in Info.plist)
        window.location.href = `sorabase://auth-complete?code=${code}`;
        setStatus("done");
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Unexpected error");
        setStatus("error");
      }
    })();
  }, [port]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      gap: 12, padding: 32, textAlign: "center", color: "#1c1a17", background: "#fafaf9",
    }}>
      {status === "working" && (
        <>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "3px solid #e7e5e1", borderTopColor: "#3a1828",
            animation: "spin 0.7s linear infinite",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Signing you in to Sorabase Desktop…</p>
          <p style={{ fontSize: 13, color: "#78716c", margin: 0 }}>This tab will close automatically.</p>
        </>
      )}
      {status === "done" && (
        <>
          <p style={{ fontSize: 28, margin: 0 }}>✓</p>
          <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Signed in successfully</p>
          <p style={{ fontSize: 13, color: "#78716c", margin: 0 }}>
            You can close this tab and return to the Sorabase Desktop app.
          </p>
        </>
      )}
      {status === "error" && (
        <>
          <p style={{ fontSize: 28, margin: 0 }}>⚠️</p>
          <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Sign-in failed</p>
          <p style={{ fontSize: 13, color: "#78716c", margin: 0, maxWidth: 360 }}>
            {errorMsg || "Please close this tab and try signing in again from the desktop app."}
          </p>
        </>
      )}
    </div>
  );
}

export default function DesktopCompletePage() {
  return (
    <Suspense>
      <DesktopCompleteInner />
    </Suspense>
  );
}
