import { useState } from "react";

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState("");

  return (
    <div className="search-section">
      <h2>Compare prices instantly</h2>
      <div className="search-box">
        <input
          type="text"
          placeholder="Enter product name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={() => onSearch(query)}>Compare</button>
      </div>
    </div>
  );
}