import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string; // مثلاً: "+5% هذا الشهر"
}

export default function MetricCard({ title, value, icon: Icon, trend }: MetricCardProps) {
  return (
    <div className="bg-card text-card-foreground p-6 rounded-xl border border-border shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
        <div className="p-2 bg-primary/10 rounded-lg text-primary">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold">{value}</p>
        {trend && (
          <p className="text-xs text-green-600 mt-2 font-medium">{trend}</p>
        )}
      </div>
    </div>
  );
}