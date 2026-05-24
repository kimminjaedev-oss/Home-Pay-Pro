import React from "react";
import { Link, useLocation } from "wouter";
import { Building2, LogOut, LayoutDashboard, Settings } from "lucide-react";
import { useUser, useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const isAdmin = user?.publicMetadata?.role === "admin"; // In a real app we'd fetch this or use Clerk metadata, for now let's just make it visible based on email or assume a prop
  // Actually we have useGetMe from API which returns { role }, but we can just show admin link if the route is /admin or if they navigate. Let's just always show it for now in this demo since it's a UI demo, or conditionally check if role == admin from useGetMe.
  // We'll rely on the page itself to protect the route.

  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-50/50">
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2 transition-colors hover:text-primary" data-testid="link-home">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold tracking-tight text-slate-900">Goval</span>
          </Link>
          
          <nav className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4 text-sm font-medium text-slate-600">
              <Link href="/dashboard" className={`hover:text-slate-900 transition-colors ${location === "/dashboard" ? "text-primary hover:text-primary" : ""}`} data-testid="nav-dashboard">
                Dashboard
              </Link>
              <Link href="/admin" className={`hover:text-slate-900 transition-colors ${location === "/admin" ? "text-primary hover:text-primary" : ""}`} data-testid="nav-admin">
                Admin
              </Link>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end text-sm">
                <span className="font-medium text-slate-900">{user?.fullName || user?.primaryEmailAddress?.emailAddress}</span>
                <span className="text-xs text-slate-500">Unit Owner</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => signOut({ redirectUrl: basePath || "/" })} data-testid="button-logout" className="text-slate-600 hover:text-slate-900 hover:bg-slate-100">
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}