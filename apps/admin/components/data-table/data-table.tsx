'use client';

import * as React from 'react';
import { Inbox } from 'lucide-react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: string;
  emptyTitle?: string;
  loading?: boolean;
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = 'No data yet.',
  emptyTitle = 'Nothing here',
  loading = false,
  onRowClick,
}: DataTableProps<TData, TValue>): React.JSX.Element {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                {columns.map((_col, j) => (
                  <TableCell key={j} className="px-3 py-3">
                    <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="px-3 py-12">
                <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-center">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Inbox className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
                  <p className="text-xs text-muted-foreground">{emptyMessage}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  'border-border/60 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-muted/40',
                )}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-3 py-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
