import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";

export const metadata = {
  title: "Sorabase Desktop — Bot-free meeting capture",
  description:
    "Record any meeting without a bot. Sorabase Desktop captures your system audio directly, transcribes with Whisper, and runs your extraction workflow automatically.",
};

const GITHUB_RELEASES = "https://github.com/sarthakvinayaka/sorabase/releases";
const LATEST_VERSION  = "0.1.0";

const MAC_ARM_URL  = `${GITHUB_RELEASES}/download/desktop-v${LATEST_VERSION}/Sorabase-${LATEST_VERSION}-arm64.dmg`;
const MAC_X64_URL  = `${GITHUB_RELEASES}/download/desktop-v${LATEST_VERSION}/Sorabase-${LATEST_VERSION}.dmg`;
const WIN_URL      = `${GITHUB_RELEASES}/download/desktop-v${LATEST_VERSION}/Sorabase.Setup.${LATEST_VERSION}.exe`;

export default function DesktopPage() {
  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950">

      {/* ── Hero ── */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-12 text-center">
        {/* App icon — matches the installed .icns */}
        <div className="w-20 h-20 rounded-[22px] mx-auto mb-8 shadow-lg overflow-hidden">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <rect width="100" height="100" rx="20" fill="#0C1221"/>
            <path d="M14 50 C19 50 19 39 24 39 C29 39 29 61 34 61 C39 61 43 32 47 27 C50 23 52 42 56 44"
              stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="56" y1="33" x2="86" y2="33" stroke="white" strokeWidth="6" strokeLinecap="round"/>
            <line x1="56" y1="44" x2="86" y2="44" stroke="white" strokeWidth="6" strokeLinecap="round"/>
            <line x1="56" y1="55" x2="86" y2="55" stroke="white" strokeWidth="6" strokeLinecap="round"/>
          </svg>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-aubergine-200 dark:border-aubergine-900 bg-aubergine-50 dark:bg-aubergine-950/30 px-4 py-1.5 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-aubergine-600 flex-shrink-0" />
          <span className="text-[12px] font-medium text-aubergine-800 dark:text-aubergine-400">
            No meeting bot · No browser tab required
          </span>
        </div>

        <h1
          className="font-display italic text-stone-900 dark:text-stone-100 leading-tight mb-5"
          style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}
        >
          Capture any meeting.<br />No bot joins the call.
        </h1>

        <p className="text-[16px] text-stone-500 dark:text-stone-400 leading-relaxed max-w-xl mx-auto mb-10">
          Sorabase Desktop records your computer&apos;s audio directly — the same way
          Granola does. Works with native Zoom, Teams, Google Meet, Webex, or any
          app that plays sound. After the meeting, Whisper transcribes it and your
          workflow runs automatically.
        </p>

        {/* Download buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href={MAC_ARM_URL}
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            <AppleIcon />
            Download for Mac <span className="opacity-60 font-normal text-sm">(Apple Silicon)</span>
          </a>
          <a
            href={WIN_URL}
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            <WindowsIcon />
            Download for Windows
          </a>
        </div>

        {/* Unsigned-app notice */}
        <div className="mt-6 max-w-xl mx-auto rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-left">
          <p className="text-[12px] font-semibold text-amber-800 dark:text-amber-400 mb-1">
            macOS first-launch fix
          </p>
          <p className="text-[12px] text-amber-700 dark:text-amber-500 leading-relaxed">
            If macOS says the app is &ldquo;damaged&rdquo;, open <strong>Terminal</strong> and run:<br/>
            <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded text-[11px]">
              xattr -cr /Applications/Sorabase.app
            </code>
            <br/>Then double-click to open. This is a one-time step for unsigned builds.
          </p>
        </div>

        <p className="mt-4 text-[12px] text-stone-400 dark:text-stone-500">
          macOS 13+ · Windows 10+ · Free with your Sorabase account ·{" "}
          <a href={MAC_X64_URL} className="underline underline-offset-2 hover:text-stone-600">
            Intel Mac
          </a>{" "}
          ·{" "}
          <a href={GITHUB_RELEASES} className="underline underline-offset-2 hover:text-stone-600">
            All releases
          </a>
        </p>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-3xl mx-auto px-6 py-12 border-t border-stone-200 dark:border-stone-800">
        <h2 className="text-[13px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-8 text-center">
          How it works
        </h2>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { n: "1", title: "Install & sign in",   body: "Drag Sorabase to Applications. Click the menu bar icon and sign in with your Sorabase account." },
            { n: "2", title: "Start capture",        body: "Pick a mode — General, Recruiter, or Study — and click Start before your meeting begins." },
            { n: "3", title: "Meet normally",        body: "Join Zoom, Meet, Teams, or any call as you normally would. No bot joins. No one else knows you&apos;re recording." },
            { n: "4", title: "Review in Sorabase",   body: "Click Stop when the meeting ends. Whisper transcribes the audio and your extraction workflow runs. Sorabase opens automatically." },
          ].map(({ n, title, body }) => (
            <div key={n} className="flex flex-col gap-2">
              <div className="w-8 h-8 rounded-full bg-aubergine-100 dark:bg-aubergine-950/50 border border-aubergine-200 dark:border-aubergine-900 flex items-center justify-center text-aubergine-800 dark:text-aubergine-400 font-bold text-sm flex-shrink-0">
                {n}
              </div>
              <p className="text-[13px] font-semibold text-stone-800 dark:text-stone-200">{title}</p>
              <p className="text-[12px] text-stone-500 dark:text-stone-400 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: body }} />
            </div>
          ))}
        </div>
      </section>

      {/* ── Install instructions (macOS) ── */}
      <section className="max-w-3xl mx-auto px-6 py-12 border-t border-stone-200 dark:border-stone-800">
        <h2 className="text-[13px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-8">
          macOS installation
        </h2>

        <ol className="space-y-5">
          {[
            {
              label: "Download and open the DMG",
              detail: "Choose the Apple Silicon (M1/M2/M3) or Intel version above. Open the downloaded .dmg file.",
            },
            {
              label: "Drag Sorabase to Applications",
              detail: "In the installer window, drag the Sorabase icon onto the Applications folder shortcut.",
            },
            {
              label: "Open the app",
              detail: "Because the app is unsigned, macOS will say it is \"damaged\" on first launch. Open Terminal and run: xattr -cr /Applications/Sorabase.app — then double-click to open. This is a one-time step caused by macOS quarantine.",
            },
            {
              label: "Grant Screen Recording permission",
              detail: "When you first click Start, macOS will ask for Screen Recording access. Click Open System Settings, find Sorabase in the list, and enable it. This is what allows the app to capture system audio — the same permission Granola, Loom, and other recording apps use.",
            },
            {
              label: "Sign in to Sorabase",
              detail: "Click the Sorabase icon in your menu bar → Sign in to Sorabase. A sign-in window opens. Log in with your account.",
            },
          ].map(({ label, detail }, i) => (
            <li key={i} className="flex gap-4">
              <span className="text-[12px] font-semibold text-stone-400 dark:text-stone-500 w-5 flex-shrink-0 pt-0.5">
                {i + 1}.
              </span>
              <div>
                <p className="text-[13px] font-semibold text-stone-800 dark:text-stone-200 mb-1">{label}</p>
                <p className="text-[12px] text-stone-500 dark:text-stone-400 leading-relaxed">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Windows ── */}
      <section className="max-w-3xl mx-auto px-6 py-12 border-t border-stone-200 dark:border-stone-800">
        <h2 className="text-[13px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-8">
          Windows installation
        </h2>
        <ol className="space-y-5">
          {[
            {
              label: "Run the installer",
              detail: "Download and run Sorabase-Setup.exe. If Windows SmartScreen warns you, click More info → Run anyway. Installs to your user profile — no admin required.",
            },
            {
              label: "Find Sorabase in your system tray",
              detail: "After installation, Sorabase appears in the system tray (bottom-right). Click the icon to open the capture panel.",
            },
            {
              label: "Sign in and capture",
              detail: "Click Sign in to Sorabase, log in, then click Start before your next meeting.",
            },
          ].map(({ label, detail }, i) => (
            <li key={i} className="flex gap-4">
              <span className="text-[12px] font-semibold text-stone-400 dark:text-stone-500 w-5 flex-shrink-0 pt-0.5">
                {i + 1}.
              </span>
              <div>
                <p className="text-[13px] font-semibold text-stone-800 dark:text-stone-200 mb-1">{label}</p>
                <p className="text-[12px] text-stone-500 dark:text-stone-400 leading-relaxed">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-6 py-12 border-t border-stone-200 dark:border-stone-800">
        <h2 className="text-[13px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-8">
          FAQ
        </h2>
        <div className="space-y-6">
          {[
            {
              q: "Does anyone on the call know I'm recording?",
              a: "No. The app captures audio from your own computer's output. Nothing joins the call as a participant and nothing shows up to other attendees.",
            },
            {
              q: "Does it work with native Zoom, not just Zoom in the browser?",
              a: "Yes — that's the main difference from the Chrome extension. The desktop app captures system audio so it works with the native Zoom app, Teams desktop, Webex, or any meeting platform.",
            },
            {
              q: "What is the Screen Recording permission for?",
              a: "On macOS, ScreenCaptureKit (the API that captures system audio) falls under the Screen Recording permission — even though the app doesn't record your screen. Granola, Loom, and most audio recording apps require the same permission.",
            },
            {
              q: "Where does my audio go?",
              a: "The recording is uploaded to your Sorabase account for Whisper transcription and then processed through your workflow. Audio files are only used for transcription and are not shared or stored long-term.",
            },
            {
              q: "Can I use a local / self-hosted Sorabase?",
              a: "Yes. Set the SORABASE_URL environment variable before launching the app, or edit it in the app settings. It defaults to https://www.sorabase.org.",
            },
          ].map(({ q, a }) => (
            <div key={q}>
              <p className="text-[13px] font-semibold text-stone-800 dark:text-stone-200 mb-1">{q}</p>
              <p className="text-[12px] text-stone-500 dark:text-stone-400 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-3xl mx-auto px-6 py-14 border-t border-stone-200 dark:border-stone-800 text-center">
        <p className="text-[14px] text-stone-500 dark:text-stone-400 mb-6">
          Don&apos;t have a Sorabase account yet?
        </p>
        <Link href="/signup" className={buttonVariants({ variant: "primary", size: "lg" })}>
          Get started free
        </Link>
      </section>

    </main>
  );
}

/* ── Icons ─────────────────────────────────────────────────────────────────── */

function AppleIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

function WindowsIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 12V6.75l6-1.32v6.57H3zM20 3v8.75h-9V5.25L20 3zM3 13h6v6.57l-6-1.32V13zm8 .25H20V21l-9-1.75V13.25z"/>
    </svg>
  );
}
