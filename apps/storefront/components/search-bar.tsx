'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';

export function SearchBar(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (q.trim()) {
      params.set('q', q.trim());
    } else {
      params.delete('q');
    }
    router.push(`/search?${params.toString()}`);
  };

  return (
    <form onSubmit={submit} className="flex w-full max-w-2xl gap-2">
      <Input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the catalog…"
        leadingIcon={<Search className="h-4 w-4" />}
        aria-label="Search products"
      />
      <Button type="submit" variant="brand">
        Search
      </Button>
    </form>
  );
}
