'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

interface PdpGalleryProps {
  images: string[];
  productName: string;
}

// Embla-powered swipeable gallery with synced thumbnail strip.
// Falls back gracefully when there are 0 or 1 images.
export function PdpGallery({ images, productName }: PdpGalleryProps): JSX.Element {
  const [mainRef, mainApi] = useEmblaCarousel({ loop: false, align: 'start' });
  const [thumbRef, thumbApi] = useEmblaCarousel({
    containScroll: 'keepSnaps',
    dragFree: true,
  });
  const [selected, setSelected] = useState(0);

  const onMainSelect = useCallback(() => {
    if (!mainApi || !thumbApi) return;
    const i = mainApi.selectedScrollSnap();
    setSelected(i);
    thumbApi.scrollTo(i);
  }, [mainApi, thumbApi]);

  useEffect(() => {
    if (!mainApi) return;
    onMainSelect();
    mainApi.on('select', onMainSelect);
    mainApi.on('reInit', onMainSelect);
    return () => {
      mainApi.off('select', onMainSelect);
      mainApi.off('reInit', onMainSelect);
    };
  }, [mainApi, onMainSelect]);

  const goTo = useCallback((i: number) => mainApi?.scrollTo(i), [mainApi]);
  const goPrev = useCallback(() => mainApi?.scrollPrev(), [mainApi]);
  const goNext = useCallback(() => mainApi?.scrollNext(), [mainApi]);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed border-border bg-bg-elevated text-xs uppercase tracking-widest text-muted-fg">
        No image
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-md border border-border bg-muted">
        <div ref={mainRef} className="overflow-hidden">
          <div className="flex touch-pan-y">
            {images.map((src, i) => (
              <div
                key={src}
                className="relative aspect-square w-full shrink-0 grow-0 basis-full"
                aria-roledescription="slide"
                aria-label={`${productName} image ${i + 1} of ${images.length}`}
              >
                <Image
                  src={src}
                  alt={`${productName} — view ${i + 1}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="object-cover"
                  priority={i === 0}
                />
              </div>
            ))}
          </div>
        </div>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-bg/85 text-fg backdrop-blur transition-colors hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-bg/85 text-fg backdrop-blur transition-colors hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div
              className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5"
              aria-hidden="true"
            >
              {images.map((src, i) => (
                <span
                  key={`dot-${src}`}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-200',
                    i === selected ? 'w-6 bg-fg' : 'w-1.5 bg-fg/40',
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div ref={thumbRef} className="overflow-hidden">
          <div className="flex gap-2">
            {images.map((src, i) => (
              <button
                key={`thumb-${src}`}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show image ${i + 1}`}
                aria-pressed={i === selected}
                className={cn(
                  'relative aspect-square w-20 shrink-0 overflow-hidden rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg',
                  i === selected
                    ? 'border-fg ring-1 ring-fg'
                    : 'border-border hover:border-fg/60',
                )}
              >
                <Image src={src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
