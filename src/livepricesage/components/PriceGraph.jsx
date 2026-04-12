import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const formatCurrency = (value) => {
  if (!Number.isFinite(value)) return "N/A";
  return `Rs ${new Intl.NumberFormat("en-IN").format(Math.round(value))}`;
};

export default function PriceGraph({ history = [], maxPoints = 30 }) {
  const processed = useMemo(() => {
    const limited = history.slice(-maxPoints);
    const labels = limited.map((entry) => {
      const time = entry?.timestamp ? new Date(entry.timestamp) : null;
      return time ? time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
    });
    const data = limited.map((entry) => Number(entry.price));
    return {
      labels,
      data,
      dataset: limited.length > 0 ? limited[limited.length - 1] : null
    };
  }, [history, maxPoints]);

  if (!processed.data.length) return null;

  const chartData = {
    labels: processed.labels,
    datasets: [
      {
        label: "Live price",
        data: processed.data,
        fill: true,
        backgroundColor: "rgba(143, 241, 191, 0.15)",
        borderColor: "rgba(143, 241, 191, 0.9)",
        pointBackgroundColor: "#0b4d32",
        pointBorderColor: "#8ff1bf",
        tension: 0.35,
        pointRadius: 3,
        borderWidth: 2
      }
    ]
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
        display: false
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
    <div className="price-graph">
      <div className="price-graph-meta">
        <span className="graph-label">Price over time</span>
        <span className="graph-current">
          Latest: {formatCurrency(processed.dataset?.price ?? processed.data[processed.data.length - 1])}
        </span>
      </div>
      <div className="price-graph-canvas">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
