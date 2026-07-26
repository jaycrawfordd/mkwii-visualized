import Dashboard from "./Dashboard";
import dashboardData from "../public/dashboard-data.json";

export default function Home() {
  return <Dashboard data={dashboardData} />;
}
