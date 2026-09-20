'use client';

/**
 * Compact pager shared by the paginated listings (the teams directory and the
 * admin review table). It only renders the window of page buttons, so callers
 * keep ownership of the data: they filter/search across the WHOLE collection
 * first and then slice the current page, which is what makes a search term
 * match rows sitting on any page.
 *
 * Renders nothing when everything fits on a single page.
 */
interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  ariaLabel?: string;
}

/** Compact pager window — e.g. 1 … 4 [5] 6 … 12 */
export function pageWindow(current: number, total: number): (number | 'gap')[] {
  const wanted = new Set<number>([1, total, current - 1, current, current + 1]);
  const pages = [...wanted].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  let prev = 0;
  for (const p of pages) {
    if (prev !== 0 && p - prev > 1) out.push('gap');
    out.push(p);
    prev = p;
  }
  return out;
}

export default function Pagination({
  page,
  totalPages,
  onChange,
  ariaLabel = 'Pagination',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const goToPage = (next: number) => onChange(Math.min(Math.max(1, next), totalPages));

  return (
    <nav className="pagination" aria-label={ariaLabel}>
      <button
        type="button"
        className="page-btn page-btn-wide"
        onClick={() => goToPage(page - 1)}
        disabled={page === 1}
      >
        ← Prev
      </button>

      <div className="page-numbers">
        {pageWindow(page, totalPages).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="page-gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={p === page ? 'page-btn active' : 'page-btn'}
              onClick={() => goToPage(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}
      </div>

      <button
        type="button"
        className="page-btn page-btn-wide"
        onClick={() => goToPage(page + 1)}
        disabled={page === totalPages}
      >
        Next →
      </button>
    </nav>
  );
}
