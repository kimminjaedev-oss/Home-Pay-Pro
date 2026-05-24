import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';

export default function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
      <SignedOut>
        <SignInButton />
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </main>
  );
}
