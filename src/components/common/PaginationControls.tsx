import { Button } from '@/components/ui/Button';
import styles from './PaginationControls.module.scss';

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  infoLabel: string;
  labels: { first: string; prev: string; next: string; last: string };
}

export function PaginationControls({
  page,
  totalPages,
  onChange,
  infoLabel,
  labels,
}: PaginationControlsProps) {
  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  return (
    <div className={styles.pagination}>
      <div className={styles.buttons}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={atStart}
          onClick={() => onChange(1)}
        >
          {labels.first}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={atStart}
          onClick={() => onChange(page - 1)}
        >
          {labels.prev}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={atEnd}
          onClick={() => onChange(page + 1)}
        >
          {labels.next}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={atEnd}
          onClick={() => onChange(totalPages)}
        >
          {labels.last}
        </Button>
      </div>
      <span className={styles.info}>{infoLabel}</span>
    </div>
  );
}
