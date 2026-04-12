export default function HistoryTimeline({ history, onReuse, onClear, onRemove }) {
  const inrFormatter = new Intl.NumberFormat("en-IN");

  return (
    <section className="panel timeline">
      <div className="timeline-header">
        <h3>Recent Searches</h3>
        {history.length > 0 && (
          <button type="button" className="timeline-clear" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <p className="timeline-empty">No searches yet. Your recent comparisons will appear here.</p>
      ) : (
        history.map((item, index) => (
          <div key={item.key || index} className="timeline-item google-like">
            <div className="timeline-row history-top">
              <span className="timeline-url">{item.lastUrl || "No link saved"}</span>
              <button
                type="button"
                className="history-remove"
                aria-label="Remove history item"
                onClick={() => onRemove?.(item)}
              >
                x
              </button>
            </div>
            <p className="timeline-title">{item.product}</p>
            <div className="timeline-row">
              <span>{item.sourceStore || "Store unknown"} • {new Date(item.lastSearchedAt || item.date).toLocaleString()}</span>
              <span className="timeline-price">
                {Number.isFinite(item.lastBestPrice)
                  ? `Lowest Rs ${inrFormatter.format(item.lastBestPrice)}`
                  : "Lowest N/A"}
              </span>
            </div>
            {item.lastUrl && (
              <button type="button" className="timeline-reuse" onClick={() => onReuse?.(item)}>
                Use This Link
              </button>
            )}
          </div>
        ))
      )}
    </section>
  );
}
