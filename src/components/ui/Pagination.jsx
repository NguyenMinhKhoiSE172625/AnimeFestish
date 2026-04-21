export function Pagination({ current, total, onChange }) {
  const maxVisible = 5;
  let start = Math.max(1, current - Math.floor(maxVisible / 2));
  let end = Math.min(total, start + maxVisible - 1);
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  const pages = [];
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <div className="pagination">
      <button
        className="page-btn"
        disabled={current === 1}
        onClick={() => onChange(current - 1)}
      >
        &#8249;
      </button>
      {pages.map((p) => (
        <button
          key={p}
          className={`page-btn ${p === current ? "active" : ""}`}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
      <button
        className="page-btn"
        disabled={current === total}
        onClick={() => onChange(current + 1)}
      >
        &#8250;
      </button>
    </div>
  );
}
