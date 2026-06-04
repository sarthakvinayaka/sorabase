"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Inner() {
  const params   = useSearchParams();
  const port     = params.get("port");
  const [status, setStatus] = useState<"working" | "done" | "error">("working");
  const [msg,    setMsg]    = useState("");

  useEffect(() => {
    if (!port) {
      setMsg("Missing port parameter — please sign in again from the desktop app.");
      setStatus("error");
      return;
    }

    (async () => {
      // 1. Get the session cookie value from the server.
      //    The browser sends the httpOnly cookie automatically (same origin).
      let cookieName: string, cookieValue: string;
      try {
        const res = await fetch("/api/auth/desktop-code", { credentials: "include" });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error: string };
          setMsg(error || "Could not retrieve session — are you signed in?");
          setStatus("error");
          return;
        }
        ({ cookie_name: cookieName, cookie_value: cookieValue } = await res.json() as {
          cookie_name: string;
          cookie_value: string;
        });
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Network error fetching session.");
        setStatus("error");
        return;
      }

      // 2. POST the cookie directly to Electron's local callback server.
      //    Chrome allows HTTPS → http://127.0.0.1 with the Private-Network-Access
      //    header. Safari allows it too (no PNA restrictions, standard CORS).
      try {
        const r = await fetch(`http://127.0.0.1:${port}/auth-callback`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ cookie_name: cookieName, cookie_value: cookieValue }),
        });
        if (!r.ok) throw new Error(`Local server responded ${r.status}`);
        setStatus("done");
      } catch (e) {
        setMsg(
          `Could not reach the desktop app (http://127.0.0.1:${port}). ` +
          "Make sure Sorabase Desktop is running and try signing in again.\n" +
          (e instanceof Error ? e.message : ""),
        );
        setStatus("error");
      }
    })();
  }, [port]);

  const box: React.CSSProperties = {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", minHeight: "100vh",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    gap: 12, padding: 32, textAlign: "center",
    color: "#1c1a17", background: "#fafaf9",
  };

  return (
    <div style={box}>
      {status === "working" && (
        <>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            border: "3px solid #e7e5e1", borderTopColor: "#3a1828",
            animation: "spin .7s linear infinite",
          }} />
          <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
            Signing you in to Sorabase Desktop…
          </p>
          <p style={{ fontSize: 13, color: "#78716c", margin: 0 }}>
            This tab will close automatically.
          </p>
        </>
      )}

      {status === "done" && (
        <>
          <p style={{ fontSize: 28, margin: 0 }}>✓</p>
          <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Signed in</p>
          <p style={{ fontSize: 13, color: "#78716c", margin: 0 }}>
            You can close this tab. The Sorabase Desktop app is now signed in.
          </p>
        </>
      )}

      {status === "error" && (
        <>
          <p style={{ fontSize: 28, margin: 0 }}>⚠️</p>
          <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Sign-in failed</p>
          <p style={{ fontSize: 13, color: "#78716c", margin: 0, maxWidth: 380, whiteSpace: "pre-wrap" }}>
            {msg || "Please close this tab and try again from the desktop app."}
          </p>
        </>
      )}
    </div>
  );
}

export default function DesktopCompletePage() {
  return <Suspense><Inner /></Suspense>;
}
