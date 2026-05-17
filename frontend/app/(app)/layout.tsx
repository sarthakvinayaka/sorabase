// App shell layout — auth guard is applied per-page (entry, onboarding)
// so that the guard logic has access to client-side auth context.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
