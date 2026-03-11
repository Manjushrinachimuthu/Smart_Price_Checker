import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";

export default function PriceChart({ stores }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={stores}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="store" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="price" stroke="#4f46e5" strokeWidth={3} />
      </LineChart>
    </ResponsiveContainer>
  );
}