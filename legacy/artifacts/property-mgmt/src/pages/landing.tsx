import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Building2, CreditCard, LockKeyhole, ArrowRight } from "lucide-react";
import { useUser, useClerk } from "@clerk/react";

export default function LandingPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  
  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold tracking-tight text-foreground">Goval</span>
          </div>
          
          <div className="flex items-center gap-4">
            {isLoaded && !isSignedIn && (
              <>
                <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="link-signin">
                  Sign In
                </Link>
                <Link href="/sign-up" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" data-testid="link-signup">
                  Sign Up
                </Link>
              </>
            )}
            {isLoaded && isSignedIn && (
              <Link href="/dashboard" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" data-testid="link-dashboard">
                Dashboard
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="w-full py-24 md:py-32 lg:py-40 bg-slate-50/50">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <div className="grid gap-12 lg:grid-cols-[1fr_500px] lg:gap-16 xl:grid-cols-[1fr_550px]">
              <div className="flex flex-col justify-center space-y-8">
                <div className="space-y-6">
                  <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                    <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
                    Modern Property Management
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight sm:text-5xl xl:text-6xl/none text-slate-900">
                    Pay your maintenance fees without the friction.
                  </h1>
                  <p className="max-w-[600px] text-lg text-slate-600 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    A precise, trustworthy portal for apartment owners. View your household balance, review past payments, and settle your dues online in seconds.
                  </p>
                </div>
                <div className="flex flex-col gap-3 min-[400px]:flex-row">
                  {isLoaded && !isSignedIn ? (
                    <>
                      <Link href="/sign-up" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" data-testid="button-hero-signup">
                        Get Started <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                      <Link href="/sign-in" className="inline-flex h-12 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" data-testid="button-hero-signin">
                        Owner Login
                      </Link>
                    </>
                  ) : (
                    <Link href="/dashboard" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" data-testid="button-hero-dashboard">
                      Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <div className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-primary" /> Secure Stripe processing</div>
                  <div className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-primary" /> Instant receipt</div>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative w-full max-w-[500px] aspect-square lg:aspect-auto lg:h-[600px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  {/* Decorative mockup UI inside */}
                  <div className="absolute inset-0 flex flex-col p-6 bg-slate-50/50">
                    <div className="h-8 w-1/3 bg-slate-200 rounded-md mb-8 animate-pulse"></div>
                    <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm mb-4">
                      <div className="h-4 w-1/4 bg-slate-200 rounded mb-2"></div>
                      <div className="h-10 w-1/2 bg-slate-300 rounded mb-6"></div>
                      <div className="h-12 w-full bg-primary/20 rounded-md"></div>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm flex-1">
                      <div className="h-4 w-1/4 bg-slate-200 rounded mb-6"></div>
                      <div className="space-y-4">
                        <div className="h-12 w-full bg-slate-50 rounded border border-slate-100"></div>
                        <div className="h-12 w-full bg-slate-50 rounded border border-slate-100"></div>
                        <div className="h-12 w-full bg-slate-50 rounded border border-slate-100"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-24 border-t border-slate-100 bg-white">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Everything you need, nothing you don't</h2>
              <p className="max-w-[700px] text-slate-500 md:text-lg">
                We've built a streamlined portal designed entirely around respect for your time.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center text-center p-6 bg-slate-50 rounded-2xl">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  <CreditCard className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Fast Payments</h3>
                <p className="text-slate-600">Pay your balance in seconds with Stripe integration. Support for cards, Apple Pay, and Google Pay.</p>
              </div>
              <div className="flex flex-col items-center text-center p-6 bg-slate-50 rounded-2xl">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  <LockKeyhole className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Secure & Private</h3>
                <p className="text-slate-600">Bank-level security for all transactions. Your data and payment methods are never stored on our servers.</p>
              </div>
              <div className="flex flex-col items-center text-center p-6 bg-slate-50 rounded-2xl">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  <Building2 className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Clear History</h3>
                <p className="text-slate-600">Always know where you stand. Access a complete record of your past payments and current obligations.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-slate-200 py-12 bg-white">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-400" />
            <span className="text-sm font-medium text-slate-500">Goval Property Management</span>
          </div>
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} Goval. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}