import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const colorPalette = ["#8ff1bf", "#f6b93b", "#5e8bff", "#ff7f50", "#ff6f91", "#22c1c3", "#c77dff", "#ff9f1c"];

const hexToRgba = (hex, alpha = 1) => {
  if (typeof hex !== "string") return `rgba(255,255,255,${alpha})`;
  const cleaned = hex.replace("#", "");
  const normalized = cleaned.length === 3
    ? cleaned.split("").map((part) => part + part).join("")
    : cleaned;
  const parsed = Number.parseInt(normalized, 16);
  if (!Number.isFinite(parsed)) return `rgba(255,255,255,${alpha})`;
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const formatCurrency = (value) => {
  if (!Number.isFinite(value)) return "N/A";
  return `Rs ${new Intl.NumberFormat("en-IN").format(Math.round(value))}`;
};

export default function CombinedPriceGraph({ entries = [], maxPoints = 32 }) {
  const processed = useMemo(() => {
    if (!entries.length) return null;

    const normalized = entries
      .map((entry, index) => {
        const history = Array.isArray(entry.history)
          ? entry.history.filter(
              (point) => point && Number.isFinite(point.price) && Number.isFinite(point.timestamp)
            )
          : [];
        if (!history.length) return null;
        return {
          label: entry.label || entry.store || `Store ${index + 1}`,
          history,
          color: colorPalette[index % colorPalette.length]
        };
      })
      .filter(Boolean);

    if (!normalized.length) return null;

    const timestampSet = new Set();
    normalized.forEach((entry) =>
      entry.history.forEach((point) => timestampSet.add(point.timestamp))
    );
    const sortedTimestamps = Array.from(timestampSet).sort((a, b) => a - b).slice(-maxPoints);
    if (!sortedTimestamps.length) return null;

    const labels = sortedTimestamps.map((timestamp) =>
      new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );

    const datasets = normalized.map((entry) => {
      const historyMap = new Map(entry.history.map((point) => [point.timestamp, Number(point.price)]));
      const data = sortedTimestamps.map((timestamp) =>
        historyMap.has(timestamp) ? historyMap.get(timestamp) : null
      );
      return {
        label: entry.label,
        data,
        fill: true,
        backgroundColor: hexToRgba(entry.color, 0.18),
        borderColor: entry.color,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.35,
        spanGaps: true
      };
    });

    const latestValues = normalized
      .flatMap((entry) => entry.history.slice(-1).map((point) => Number(point.price)))
      .filter(Number.isFinite);
    const latestPrice = latestValues.length ? Math.min(...latestValues) : null;

    return { labels, datasets, latestPrice };
  }, [entries, maxPoints]);

  if (!processed?.datasets?.length) return null;

  const chartData = {
    labels: processed.labels,
    datasets: processed.datasets
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: {
          color: "#d6d6d6",
          maxRotation: 0,
          autoSkipPadding: 4
        },
        grid: {
          display: false
        }
      },
      y: {
        ticks: {
          color: "#d6d6d6",
          callback: (value) => formatCurrency(value)
        },
        grid: {
          color: "rgba(255, 255, 255, 0.08)"
        }
      }
    },
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "#f1f1f1",
          boxWidth: 12,
          padding: 12
        }
      },
      tooltip: {
        backgroundColor: "#1b1f34",
        titleColor: "#fefefe",
        bodyColor: "#fefefe",
        callbacks: {
          label: (context) => {
            const price = context.parsed.y;
            return `Price: ${formatCurrency(price)}`;
          }
        }
      }
    }
  };

  return (
    <div className="combined-price-graph">
      <div className="combined-price-graph-meta">
        <span className="graph-label">Price comparison</span>
        <span className="graph-current">
          Latest best: {processed.latestPrice ? formatCurrency(processed.latestPrice) : "N/A"}
        </span>
      </div>
      <div className="combined-price-graph-canvas">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
