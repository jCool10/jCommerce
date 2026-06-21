'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { OrderDetailView } from '@/components/order-detail-view';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function OrderDetailPage({ params }: PageProps): React.JSX.Element {
  const { id } = use(params);

  return (
    <div className="space-y-4">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>
      <Card>
        <CardContent className="p-6">
          <OrderDetailView orderId={id} variant="page" />
        </CardContent>
      </Card>
    </div>
  );
}
