import Link from 'next/link';
export default function Home() {
  return <main><h1>Home Pay Pro</h1><ul><li><Link href='/dashboard'>Dashboard</Link></li><li><Link href='/admin'>Admin</Link></li></ul></main>;
}
