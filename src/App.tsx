import { useState, useMemo } from "react";
import {
  BarChart3,
  Users,
  Globe2,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Filter,
  Search,
  Loader2,
  AlertCircle,
  Flame,
  ArrowUpDown,
  Award,
  Key,
  Eye,
  EyeOff,
  DollarSign,
  Clock,
  Zap
} from "lucide-react";
import Header from "./components/Header";
import { ChannelAnalyticsItem, ChannelAnalyticsResponse } from "./types";

export default function App() {
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem("yt_api_key") || "");
  const [showKey, setShowKey] = useState<boolean>(false);

  const [analyticsQuery, setAnalyticsQuery] = useState<string>("심리학");
  const [analyticsRegion, setAnalyticsRegion] = useState<string>("KR");
  const [analyticsMaxResults, setAnalyticsMaxResults] = useState<number>(20);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState<boolean>(false);
  const [analyticsResult, setAnalyticsResult] = useState<ChannelAnalyticsResponse | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsSortField, setAnalyticsSortField] = useState<string>("gradeScore");
  const [analyticsSortDir, setAnalyticsSortDir] = useState<"asc" | "desc">("desc");
  const [analyticsGradeFilter, setAnalyticsGradeFilter] = useState<string>("all");
  const [analyticsSubRange, setAnalyticsSubRange] = useState<string>("all");
  const [analyticsHotOnly, setAnalyticsHotOnly] = useState<boolean>(false);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    if (key) localStorage.setItem("yt_api_key", key);
    else localStorage.removeItem("yt_api_key");
  };

  const assignGrade = (subs: number, views: number, videos: number): { grade: string; gradeScore: number } => {
    const avgViews = views / Math.max(videos, 1);
    const engagement = avgViews / Math.max(subs, 1);
    if (subs >= 1000000 && engagement > 0.5) return { grade: "A1", gradeScore: 9 };
    if (subs >= 500000) return { grade: "A2", gradeScore: 8 };
    if (subs >= 100000) return { grade: "A3", gradeScore: 7 };
    if (subs >= 50000 && engagement > 0.3) return { grade: "B1", gradeScore: 6 };
    if (subs >= 10000) return { grade: "B2", gradeScore: 5 };
    if (subs >= 5000) return { grade: "B3", gradeScore: 4 };
    if (subs >= 1000) return { grade: "C1", gradeScore: 3 };
    if (subs >= 100) return { grade: "C2", gradeScore: 2 };
    return { grade: "C3", gradeScore: 1 };
  };

  const estimateGrowth = (subs: number, views: number, videos: number): string => {
    const avgViews = views / Math.max(videos, 1);
    const ratio = avgViews / Math.max(subs, 1);
    if (ratio > 2) return "↑ 고성장";
    if (ratio > 0.5) return "→ 안정";
    return "↓ 정체";
  };

  const calcUploadFrequency = (lastUploadDate: string): string => {
    if (!lastUploadDate) return "정보 없음";
    const days = Math.floor((Date.now() - new Date(lastUploadDate).getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 7) return "매우 활발";
    if (days <= 30) return "활발";
    if (days <= 90) return "보통";
    if (days <= 180) return "비활발";
    return "휴면";
  };

  const relativeDate = (dateStr: string): string => {
    if (!dateStr) return "-";
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "오늘";
    if (days <= 7) return `${days}일 전`;
    if (days <= 30) return `${Math.floor(days / 7)}주 전`;
    if (days <= 365) return `${Math.floor(days / 30)}개월 전`;
    return `${Math.floor(days / 365)}년 전`;
  };

  const fetchRealChannels = async (key: string, query: string, region: string, maxResults: number): Promise<ChannelAnalyticsItem[]> => {
    const regionParam = region !== "ALL" ? `&regionCode=${region}` : "";
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=${maxResults}${regionParam}&key=${key}`
    );
    if (!searchRes.ok) {
      const err = await searchRes.json();
      throw new Error(err.error?.message || "YouTube API 오류");
    }
    const searchData = await searchRes.json();
    const items = searchData.items || [];
    if (items.length === 0) return [];

    const ids = items.map((i: any) => i.snippet.channelId).join(",");
    const detailRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,brandingSettings,contentDetails&id=${ids}&key=${key}`
    );
    const detailData = await detailRes.json();
    const channelItems: any[] = detailData.items || [];

    // Fetch latest upload date for each channel in parallel
    const uploadResults = await Promise.allSettled(
      channelItems.map(async (ch: any) => {
        const uploadsId = ch.contentDetails?.relatedPlaylists?.uploads;
        if (!uploadsId) return { channelId: ch.id, date: "" };
        try {
          const res = await fetch(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=1&key=${key}`
          );
          const data = await res.json();
          const date = data.items?.[0]?.snippet?.publishedAt || "";
          return { channelId: ch.id, date };
        } catch {
          return { channelId: ch.id, date: "" };
        }
      })
    );

    const uploadDateMap = new Map<string, string>();
    uploadResults.forEach(r => {
      if (r.status === "fulfilled") uploadDateMap.set(r.value.channelId, r.value.date);
    });

    return channelItems.map((ch: any): ChannelAnalyticsItem => {
      const subs = parseInt(ch.statistics?.subscriberCount || "0", 10);
      const views = parseInt(ch.statistics?.viewCount || "0", 10);
      const videos = parseInt(ch.statistics?.videoCount || "0", 10);
      const { grade, gradeScore } = assignGrade(subs, views, videos);
      const country = ch.snippet?.country || ch.brandingSettings?.channel?.country || "??";
      const lastUploadDate = uploadDateMap.get(ch.id) || "";
      return {
        channelId: ch.id,
        channelTitle: ch.snippet?.title || "",
        thumbnailUrl: ch.snippet?.thumbnails?.default?.url || "",
        subscriberCount: subs,
        viewCount: views,
        videoCount: videos,
        country,
        category: ch.snippet?.description?.slice(0, 30) || "",
        grade,
        gradeScore,
        estimatedGrowthRate: estimateGrowth(subs, views, videos),
        geminiInsight: `구독자 ${(subs / 10000).toFixed(1)}만명 · 총 영상 ${videos}개 · 평균 조회수 ${Math.floor(views / Math.max(videos, 1)).toLocaleString()}회`,
        channelUrl: `https://www.youtube.com/channel/${ch.id}`,
        publishedAt: ch.snippet?.publishedAt || "",
        lastUploadDate,
        uploadFrequency: calcUploadFrequency(lastUploadDate),
        isMonetizable: subs >= 1000,
      };
    });
  };

  const buildClientFallbackChannels = (query: string, count: number): ChannelAnalyticsItem[] => {
    const niches = ["심리학", "자기계발", "인문학", "재테크", "철학", "마케팅", "건강", "역사", "과학", "교육"];
    const names = ["인사이트", "지식채널", "브레인랩", "마인드셋", "성장TV", "탐구생활", "클래스룸", "아카데미", "스터디", "레코드"];
    const gradeList = [
      { grade: "A1", gradeScore: 9, subs: 1500000 },
      { grade: "A2", gradeScore: 8, subs: 720000 },
      { grade: "A3", gradeScore: 7, subs: 230000 },
      { grade: "B1", gradeScore: 6, subs: 87000 },
      { grade: "B2", gradeScore: 5, subs: 34000 },
      { grade: "B3", gradeScore: 4, subs: 11000 },
      { grade: "C1", gradeScore: 3, subs: 4200 },
      { grade: "C2", gradeScore: 2, subs: 680 },
      { grade: "C3", gradeScore: 1, subs: 90 },
    ];
    const growths = ["↑ 고성장", "→ 안정", "↓ 정체"];
    const countries = ["KR", "US", "JP", "GB", "KR", "KR"];
    const freqList = ["매우 활발", "활발", "보통", "비활발", "휴면"];
    const daysAgoList = [3, 15, 60, 120, 300];

    return Array.from({ length: count }, (_, i) => {
      const g = gradeList[i % gradeList.length];
      const niche = niches[i % niches.length];
      const subs = g.subs + Math.floor(Math.random() * g.subs * 0.3);
      const views = subs * (3 + Math.random() * 5);
      const vids = 50 + Math.floor(Math.random() * 300);
      const daysAgo = daysAgoList[i % daysAgoList.length];
      const lastUploadDate = new Date(Date.now() - daysAgo * 86400000).toISOString();
      return {
        channelId: `demo_${i}`,
        channelTitle: `${query} ${niche} ${names[i % names.length]}`,
        thumbnailUrl: "",
        subscriberCount: subs,
        viewCount: Math.floor(views),
        videoCount: vids,
        country: countries[i % countries.length],
        category: niche,
        grade: g.grade,
        gradeScore: g.gradeScore,
        estimatedGrowthRate: growths[i % growths.length],
        geminiInsight: `${niche} 분야의 ${g.grade}급 채널 — 구독자 ${(subs / 10000).toFixed(1)}만명`,
        channelUrl: "",
        publishedAt: new Date(Date.now() - i * 30 * 86400000).toISOString(),
        lastUploadDate,
        uploadFrequency: freqList[i % freqList.length],
        isMonetizable: subs >= 1000,
      };
    });
  };

  const handleChannelAnalytics = async () => {
    if (!analyticsQuery.trim()) return;
    setIsAnalyticsLoading(true);
    setAnalyticsError(null);

    if (apiKey.trim()) {
      try {
        const channels = await fetchRealChannels(apiKey.trim(), analyticsQuery, analyticsRegion, analyticsMaxResults);
        setAnalyticsResult({
          isRealData: true,
          totalAnalyzed: channels.length,
          channels,
          searchSummary: `"${analyticsQuery}" 실시간 YouTube 데이터 (${channels.length}개 채널)`
        });
      } catch (err: any) {
        setAnalyticsError(`YouTube API 오류: ${err.message}`);
      } finally {
        setIsAnalyticsLoading(false);
      }
    } else {
      const channels = buildClientFallbackChannels(analyticsQuery, analyticsMaxResults);
      setAnalyticsResult({
        isRealData: false,
        totalAnalyzed: channels.length,
        channels,
        searchSummary: `"${analyticsQuery}" 시뮬레이션 데이터 (API 키 입력 시 실데이터)`
      });
      setIsAnalyticsLoading(false);
    }
  };

  const handleAnalyticsSort = (field: string) => {
    if (analyticsSortField === field) {
      setAnalyticsSortDir(analyticsSortDir === "asc" ? "desc" : "asc");
    } else {
      setAnalyticsSortField(field);
      setAnalyticsSortDir("desc");
    }
  };

  const sortedChannels = useMemo(() => {
    if (!analyticsResult?.channels) return [];
    let list = [...analyticsResult.channels];
    if (analyticsGradeFilter !== "all") list = list.filter(c => c.grade.startsWith(analyticsGradeFilter));
    if (analyticsHotOnly) list = list.filter(c => c.estimatedGrowthRate === "↑ 고성장");
    if (analyticsSubRange !== "all") {
      list = list.filter(c => {
        const s = c.subscriberCount;
        if (analyticsSubRange === "under1k") return s < 1000;
        if (analyticsSubRange === "1k-10k") return s >= 1000 && s < 10000;
        if (analyticsSubRange === "10k-100k") return s >= 10000 && s < 100000;
        if (analyticsSubRange === "100k-1m") return s >= 100000 && s < 1000000;
        if (analyticsSubRange === "over1m") return s >= 1000000;
        return true;
      });
    }
    return list.sort((a, b) => {
      const valA = (a as any)[analyticsSortField];
      const valB = (b as any)[analyticsSortField];
      if (typeof valA === "number" && typeof valB === "number") {
        return analyticsSortDir === "asc" ? valA - valB : valB - valA;
      }
      return analyticsSortDir === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [analyticsResult, analyticsSortField, analyticsSortDir, analyticsGradeFilter, analyticsSubRange, analyticsHotOnly]);

  const gradeColor = (grade: string) => {
    if (grade === "A1") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (grade === "A2") return "text-green-400 bg-green-500/10 border-green-500/30";
    if (grade === "A3") return "text-teal-400 bg-teal-500/10 border-teal-500/30";
    if (grade === "B1") return "text-blue-400 bg-blue-500/10 border-blue-500/30";
    if (grade === "B2") return "text-indigo-400 bg-indigo-500/10 border-indigo-500/30";
    if (grade === "B3") return "text-purple-400 bg-purple-500/10 border-purple-500/30";
    if (grade === "C1") return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
    if (grade === "C2") return "text-orange-400 bg-orange-500/10 border-orange-500/30";
    return "text-red-400 bg-red-500/10 border-red-500/30";
  };

  const growthColor = (rate: string) => {
    if (rate === "↑ 고성장") return "text-emerald-400";
    if (rate === "→ 안정") return "text-blue-400";
    return "text-red-400";
  };

  const freqColor = (freq: string) => {
    if (freq === "매우 활발") return "text-emerald-400";
    if (freq === "활발") return "text-green-400";
    if (freq === "보통") return "text-blue-400";
    if (freq === "비활발") return "text-yellow-400";
    if (freq === "휴면") return "text-red-400";
    return "text-gray-500";
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000000) return `${(n / 1000000000).toFixed(1)}B`;
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  const subRanges = [
    { key: "all", label: "전체" },
    { key: "under1k", label: "1천 미만" },
    { key: "1k-10k", label: "1천~1만" },
    { key: "10k-100k", label: "1만~10만" },
    { key: "100k-1m", label: "10만~100만" },
    { key: "over1m", label: "100만+" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full space-y-6">

        {/* API Key */}
        <div className="bg-slate-900/60 border border-gray-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <Key className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-200 mb-0.5">YouTube API 키</p>
            <p className="text-[10px] text-gray-500">입력하면 실시간 채널 데이터를 조회합니다. 브라우저에만 저장되며 외부로 전송되지 않습니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={e => saveApiKey(e.target.value)}
                placeholder="YouTube Data API v3 키 입력"
                className="bg-slate-950 border border-gray-700 text-white text-xs rounded-xl px-3 py-2 pr-8 outline-none focus:border-emerald-500/50 w-64 placeholder:text-gray-600"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-2 text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded border ${
              apiKey ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-gray-800 text-gray-500 border-gray-700"
            }`}>
              {apiKey ? "● 연동됨" : "● 미연동"}
            </span>
          </div>
        </div>

        {/* Hero */}
        <div className="bg-gradient-to-r from-gray-950 to-emerald-950/20 border border-emerald-500/10 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-600/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          <div className="space-y-2 relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase">
              <BarChart3 className="w-3 h-3" /> 채널 분석 대시보드
            </span>
            <h2 className="text-2xl font-bold text-white leading-tight">
              YouTube <span className="text-emerald-400">채널 분析 스프레드시트</span>
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              키워드로 채널을 검색해 구독자 등급·성장률·활동성·수익 가능 여부를 한 눈에 분析합니다.
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-2">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border ${
              analyticsResult?.isRealData
                ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/25"
                : "bg-slate-900 text-gray-400 border-gray-700"
            }`}>
              <span className={`w-2 h-2 rounded-full ${analyticsResult?.isRealData ? "bg-emerald-400 animate-pulse" : "bg-gray-600"}`}></span>
              {analyticsResult?.isRealData ? "실시간 데이터" : "시뮬레이션 모드"}
            </div>
            {analyticsResult?.isRealData && (
              <p className="text-[10px] text-gray-500">업로드 날짜 조회 포함</p>
            )}
          </div>
        </div>

        {/* Search Form */}
        <div className="bg-slate-900/50 border border-gray-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-400" /> 채널 검색 & 분析
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">키워드</label>
              <input
                type="text"
                value={analyticsQuery}
                onChange={e => setAnalyticsQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleChannelAnalytics()}
                placeholder="예: 심리학, 재테크, 자기계발..."
                className="bg-slate-950 border border-gray-700 text-white text-xs rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500/50 transition-all placeholder:text-gray-600"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">지역</label>
              <select
                value={analyticsRegion}
                onChange={e => setAnalyticsRegion(e.target.value)}
                className="bg-slate-950 border border-gray-700 text-white text-xs rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500/50 cursor-pointer"
              >
                <option value="ALL">전체</option>
                <option value="KR">한국 (KR)</option>
                <option value="US">미국 (US)</option>
                <option value="JP">일본 (JP)</option>
                <option value="GB">영국 (GB)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">결과 수</label>
              <select
                value={analyticsMaxResults}
                onChange={e => setAnalyticsMaxResults(Number(e.target.value))}
                className="bg-slate-950 border border-gray-700 text-white text-xs rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500/50 cursor-pointer"
              >
                <option value={10}>10개</option>
                <option value={20}>20개</option>
                <option value={30}>30개</option>
                <option value={50}>50개</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleChannelAnalytics}
            disabled={isAnalyticsLoading || !analyticsQuery.trim()}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-gray-600 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
          >
            {isAnalyticsLoading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 분析 중{apiKey ? " (업로드 날짜 포함)..." : "..."}</>
            ) : (
              <><BarChart3 className="w-3.5 h-3.5" /> 채널 분析 시작</>
            )}
          </button>
        </div>

        {/* Error */}
        {analyticsError && (
          <div className="flex items-center gap-3 p-4 bg-red-950/30 border border-red-500/20 rounded-xl text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{analyticsError}</span>
          </div>
        )}

        {/* Results */}
        {analyticsResult && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span className="text-gray-400">
                <span className="font-bold text-white">{sortedChannels.length}</span>개 채널 표시 중
                {analyticsResult.totalAnalyzed !== sortedChannels.length && (
                  <span className="text-gray-500"> (전체 {analyticsResult.totalAnalyzed}개)</span>
                )}
                {" · "}
                <span className="text-gray-500 italic">{analyticsResult.searchSummary}</span>
              </span>
              {!analyticsResult.isRealData && (
                <span className="text-yellow-400 flex items-center gap-1 text-[10px]">
                  <AlertCircle className="w-3 h-3" /> API 키 미입력 — 시뮬레이션 데이터
                </span>
              )}
            </div>

            {/* Filter Rows */}
            <div className="space-y-2">
              {/* Grade Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-[10px] text-gray-400 font-semibold uppercase tracking-wider w-16 shrink-0">
                  <Filter className="w-3 h-3" /> 등급
                </span>
                {["all", "A", "B", "C"].map(g => (
                  <button key={g} onClick={() => setAnalyticsGradeFilter(g)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      analyticsGradeFilter === g
                        ? g === "all" ? "bg-gray-700 text-white border-gray-500"
                          : g === "A" ? "bg-emerald-600 text-white border-emerald-500"
                          : g === "B" ? "bg-blue-600 text-white border-blue-500"
                          : "bg-yellow-600 text-white border-yellow-500"
                        : "bg-slate-900 text-gray-400 border-gray-700 hover:border-gray-500"
                    }`}>
                    {g === "all" ? "전체" : `${g}급`}
                  </button>
                ))}
                <button onClick={() => setAnalyticsHotOnly(!analyticsHotOnly)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ml-1 ${
                    analyticsHotOnly ? "bg-orange-600 text-white border-orange-500" : "bg-slate-900 text-gray-400 border-gray-700 hover:border-gray-500"
                  }`}>
                  <Flame className="w-3 h-3" /> 떡상만
                </button>
              </div>

              {/* Subscriber Range Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-[10px] text-gray-400 font-semibold uppercase tracking-wider w-16 shrink-0">
                  <Users className="w-3 h-3" /> 구독자
                </span>
                {subRanges.map(r => (
                  <button key={r.key} onClick={() => setAnalyticsSubRange(r.key)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      analyticsSubRange === r.key
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-slate-900 text-gray-400 border-gray-700 hover:border-gray-500"
                    }`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            {sortedChannels.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">필터 조건에 맞는 채널이 없습니다.</div>
            ) : (
              <div className="rounded-xl border border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-900/80 border-b border-gray-800">
                        <th className="text-left px-3 py-3 text-gray-400 font-semibold uppercase tracking-wider whitespace-nowrap">#</th>
                        <th className="text-left px-3 py-3 text-gray-400 font-semibold uppercase tracking-wider whitespace-nowrap min-w-[160px]">채널</th>
                        {[
                          { key: "subscriberCount", label: "구독자" },
                          { key: "gradeScore", label: "등급" },
                          { key: "estimatedGrowthRate", label: "성장률" },
                          { key: "viewCount", label: "총 조회수" },
                          { key: "videoCount", label: "영상 수" },
                          { key: "country", label: "지역" },
                        ].map(col => (
                          <th key={col.key} onClick={() => handleAnalyticsSort(col.key)}
                            className="text-left px-3 py-3 text-gray-400 font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-white transition-colors select-none">
                            <span className="flex items-center gap-1">
                              {col.label}
                              {analyticsSortField === col.key ? (
                                analyticsSortDir === "desc" ? <ChevronDown className="w-3 h-3 text-emerald-400" /> : <ChevronUp className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-30" />
                              )}
                            </span>
                          </th>
                        ))}
                        <th className="text-left px-3 py-3 text-gray-400 font-semibold uppercase tracking-wider whitespace-nowrap">
                          <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> 활동성</span>
                        </th>
                        <th className="text-left px-3 py-3 text-gray-400 font-semibold uppercase tracking-wider whitespace-nowrap">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 최근 업로드</span>
                        </th>
                        <th className="text-left px-3 py-3 text-gray-400 font-semibold uppercase tracking-wider whitespace-nowrap">
                          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> 수익</span>
                        </th>
                        <th className="text-left px-3 py-3 text-gray-400 font-semibold uppercase tracking-wider">링크</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedChannels.map((ch, idx) => (
                        <tr key={ch.channelId}
                          className={`border-b border-gray-800/60 transition-colors hover:bg-slate-900/40 ${
                            ch.estimatedGrowthRate === "↑ 고성장" ? "border-l-2 border-l-emerald-500/50" : ""
                          }`}>
                          <td className="px-3 py-3 text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              {ch.thumbnailUrl ? (
                                <img src={ch.thumbnailUrl} alt="" className="w-7 h-7 rounded-full object-cover bg-slate-800 shrink-0" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                                  <Users className="w-3.5 h-3.5 text-gray-600" />
                                </div>
                              )}
                              <span className="font-semibold text-white leading-tight max-w-[140px] truncate" title={ch.channelTitle}>
                                {ch.channelTitle}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 font-bold text-white whitespace-nowrap">{formatNumber(ch.subscriberCount)}</td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-black border ${gradeColor(ch.grade)}`}>{ch.grade}</span>
                          </td>
                          <td className={`px-3 py-3 font-semibold whitespace-nowrap ${growthColor(ch.estimatedGrowthRate)}`}>
                            {ch.estimatedGrowthRate}
                          </td>
                          <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{formatNumber(ch.viewCount)}</td>
                          <td className="px-3 py-3 text-gray-300 whitespace-nowrap">{ch.videoCount.toLocaleString()}개</td>
                          <td className="px-3 py-3">
                            <span className="flex items-center gap-1 text-gray-400"><Globe2 className="w-3 h-3" />{ch.country}</span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className={`text-[11px] font-bold ${freqColor(ch.uploadFrequency || "")}`}>
                              {ch.uploadFrequency || "-"}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-gray-400 whitespace-nowrap text-[10px]">
                            {relativeDate(ch.lastUploadDate || "")}
                          </td>
                          <td className="px-3 py-3">
                            {ch.isMonetizable ? (
                              <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
                                <DollarSign className="w-3 h-3" /> 가능
                              </span>
                            ) : (
                              <span className="text-gray-600 text-[10px]">미달</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {ch.channelUrl ? (
                              <a href={ch.channelUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            ) : (
                              <span className="text-gray-700 text-[10px]">시뮬</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Grade Legend */}
            <div className="bg-slate-900/40 border border-gray-800 rounded-xl p-4">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                <Award className="w-3 h-3" /> 등급 기준표
              </h4>
              <div className="grid grid-cols-3 md:grid-cols-9 gap-2">
                {[
                  { g: "A1", desc: "100만+ 고성장" }, { g: "A2", desc: "50만+" }, { g: "A3", desc: "10만+" },
                  { g: "B1", desc: "5만+ 성장" }, { g: "B2", desc: "1만+" }, { g: "B3", desc: "5천+" },
                  { g: "C1", desc: "1천+" }, { g: "C2", desc: "1천 미만" }, { g: "C3", desc: "정체·신생" },
                ].map(({ g, desc }) => (
                  <div key={g} className="flex flex-col items-center gap-1 text-center">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${gradeColor(g)}`}>{g}</span>
                    <span className="text-[9px] text-gray-500">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!analyticsResult && !isAnalyticsLoading && !analyticsError && (
          <div className="text-center py-16 space-y-3">
            <div className="inline-flex p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <BarChart3 className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-gray-400 text-sm">키워드를 입력하고 <strong>채널 분析 시작</strong>을 눌러주세요.</p>
            <p className="text-gray-600 text-xs">API 키 없이도 시뮬레이션 데이터로 작동합니다.</p>
          </div>
        )}

      </main>

      <footer className="border-t border-gray-900 bg-gray-950/60 py-4 text-center mt-auto text-xs text-gray-500">
        <p>© 2026 YouTube 채널 분析기</p>
      </footer>
    </div>
  );
}
