import { BarChart3 } from "lucide-react";

export default function Header() {
  return (
    <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <div className="bg-emerald-600 p-2 rounded-xl text-white shadow-lg shadow-emerald-500/20">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">
            YouTube <span className="text-emerald-400">채널 분석기</span>
          </h1>
          <p className="text-xs text-gray-400">YouTube Channel Analytics Dashboard</p>
        </div>
      </div>
    </header>
  );
}
