import { useState, useMemo } from "react";
import { 
  Zap,
  BookOpen,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Copy,
  CheckCircle,
  Loader2,
  AlertCircle,
  Play,
  X,
  RotateCcw,
  Volume2,
  Compass,
  FileText,
  Bookmark,
  Award,
  Lock,
  MessageSquare,
  Hash,
  Share2,
  Search,
  Flame,
  TrendingUp,
  Tv,
  ArrowUpRight,
  ArrowUpDown,
  Key
} from "lucide-react";
import Header from "./components/Header";
import { benchmarkChannels } from "./benchmarkData";
import { FusionAnalysisResponse, YouTubeSearchResponse, YouTubeVideo, ABPlanResponse } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("research");
  
  // Custom YouTube API Key client state
  const [customYouTubeApiKey, setCustomYouTubeApiKey] = useState<string>(() => {
    return localStorage.getItem("custom_youtube_api_key") || "";
  });

  const handleSaveApiKey = (key: string) => {
    setCustomYouTubeApiKey(key);
    localStorage.setItem("custom_youtube_api_key", key);
  };

  // Custom Gemini API Key client state
  const [customGeminiApiKey, setCustomGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem("custom_gemini_api_key") || "";
  });

  const handleSaveGeminiApiKey = (key: string) => {
    setCustomGeminiApiKey(key);
    localStorage.setItem("custom_gemini_api_key", key);
  };
  
  // YouTube trend search states
  const [searchQuery, setSearchQuery] = useState<string>("착한 아이 증후군");
  const [market, setMarket] = useState<string>("KR"); // KR (Korean Market), US (Global Market / English)
  const [durationFilter, setDurationFilter] = useState<string>("all"); // all, short, medium, long
  const [dateFilter, setDateFilter] = useState<string>("all"); // all, week, month, year
  const [maxResults, setMaxResults] = useState<number>(5); // Default list limit is 5
  const [isSearchLoading, setIsSearchLoading] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<YouTubeSearchResponse | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Sorting columns state
  const [sortField, setSortField] = useState<string>("publishedAt"); // Default sorting is by upload date
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Roller hover state metrics
  const [hoveredVideo, setHoveredVideo] = useState<YouTubeVideo | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // In-app Video Player state
  const [activePlayVideo, setActivePlayVideo] = useState<YouTubeVideo | null>(null);

  // YouTube Link copying robust helper to bypass iframe popups block
  const [linkCopiedId, setLinkCopiedId] = useState<string | null>(null);

  // API Key Connection test states
  const [isTestingKeys, setIsTestingKeys] = useState<{ gemini: boolean; youtube: boolean }>({ gemini: false, youtube: false });
  const [testResults, setTestResults] = useState<{ 
    gemini: { success: boolean; message: string; checked: boolean } | null;
    youtube: { success: boolean; message: string; checked: boolean } | null;
  }>({ gemini: null, youtube: null });

  const handleTestKeys = async (type: "gemini" | "youtube") => {
    setIsTestingKeys(prev => ({ ...prev, [type]: true }));
    try {
      const response = await fetch("/api/test-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customGeminiApiKey,
          customYouTubeApiKey
        })
      });
      if (response.ok) {
        const data = await response.json();
        setTestResults(prev => ({
          ...prev,
          [type]: {
            success: data[type].success,
            message: data[type].message,
            checked: true
          }
        }));
      } else {
        throw new Error("서버의 연결 응답이 정상적이지 않습니다.");
      }
    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [type]: {
          success: false,
          message: err.message || "연결 확인 중 예기치 못한 네트워크 오류가 발생했습니다.",
          checked: true
        }
      }));
    } finally {
      setIsTestingKeys(prev => ({ ...prev, [type]: false }));
    }
  };

  // Robust clipboard copy function designed specifically to work in sandboxed iframes
  const robustCopy = (text: string): boolean => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      // Ignore and proceed to fallback
    }

    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      
      // Invisible styling
      textArea.style.position = "fixed";
      textArea.style.top = "0px";
      textArea.style.left = "0px";
      textArea.style.width = "2em";
      textArea.style.height = "2em";
      textArea.style.padding = "0px";
      textArea.style.border = "none";
      textArea.style.outline = "none";
      textArea.style.boxShadow = "none";
      textArea.style.background = "transparent";
      
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return !!successful;
    } catch (err) {
      console.error("클립보드 복사 폴백 실행 실패", err);
      return false;
    }
  };

  const handleLinkClick = (url: string) => {
    const success = robustCopy(url);
    if (success) {
      setLinkCopiedId(url);
      setTimeout(() => setLinkCopiedId(null), 2000);
    } else {
      console.error("복사에 실패했습니다.");
    }
  };

  // YouTube list sorting parser helpers
  const parseCompactNumber = (val: any): number => {
    if (val === undefined || val === null) return 0;
    const valStr = String(val).trim();
    if (!valStr) return 0;
    
    // Check for Infinity / infinite ratios
    if (valStr.includes("∞") || valStr.toLowerCase().includes("infinity")) return Infinity;

    // Clean formatting commas
    const cleanStr = valStr.replace(/,/g, "");

    // Use regex to locate the first floating-point or integer number in the string
    const numMatch = cleanStr.match(/[\d.]+/);
    if (!numMatch) return 0;
    
    const numVal = parseFloat(numMatch[0]);
    if (isNaN(numVal)) return 0;

    // Detect unit based on original string contents
    const lower = valStr.toLowerCase();
    let multiplier = 1;
    if (lower.includes("억")) {
      multiplier = 100000000;
    } else if (lower.includes("만") || lower.includes("십만")) {
      multiplier = 10000;
    } else if (lower.includes("천")) {
      multiplier = 1000;
    } else if (lower.endsWith("b") || lower.includes("billion")) {
      multiplier = 1000000000;
    } else if (lower.endsWith("m") || lower.includes("million")) {
      multiplier = 1000000;
    } else if (lower.endsWith("k") || lower.includes("thousand")) {
      multiplier = 1000;
    }

    return numVal * multiplier;
  };

  const parseDurationToSeconds = (durationStr: string): number => {
    if (!durationStr) return 0;
    
    // Check if it's formatted as standard colon-separated "6:15" or "1:02:03"
    if (durationStr.includes(":")) {
      const parts = durationStr.split(":");
      let totalSec = 0;
      let multiplier = 1;
      for (let i = parts.length - 1; i >= 0; i--) {
        const value = parseInt(parts[i], 10) || 0;
        totalSec += value * multiplier;
        multiplier *= 60;
      }
      return totalSec;
    }

    let seconds = 0;
    const hourMatch = durationStr.match(/(\d+)\s*(?:시간|hour|hr|h)/i);
    const minMatch = durationStr.match(/(\d+)\s*(?:분|minute|min|m)/i);
    const secMatch = durationStr.match(/(\d+)\s*(?:초|second|sec|s)/i);
    
    if (hourMatch) seconds += parseInt(hourMatch[1], 10) * 3600;
    if (minMatch) seconds += parseInt(minMatch[1], 10) * 60;
    if (secMatch) seconds += parseInt(secMatch[1], 10);
    
    if (seconds === 0) {
      // ISO 8601 duration format helper (e.g. PT6M15S)
      const isoHours = durationStr.match(/(\d+)H/);
      const isoMins = durationStr.match(/(\d+)M/);
      const isoSecs = durationStr.match(/(\d+)S/);
      if (isoHours) seconds += parseInt(isoHours[1], 10) * 3600;
      if (isoMins) seconds += parseInt(isoMins[1], 10) * 60;
      if (isoSecs) seconds += parseInt(isoSecs[1], 10);
    }

    if (seconds === 0) {
      const numeric = parseFloat(durationStr.replace(/[^\d]/g, ""));
      return isNaN(numeric) ? 0 : numeric;
    }
    return seconds;
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc"); // Default to desc (descending) for intuitive top ranks
    }
  };

  // Memoized sorted videos array
  const sortedVideos = useMemo(() => {
    if (!searchResult || !searchResult.videos) return [];
    return [...searchResult.videos].sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortField === "title" || sortField === "channelTitle" || sortField === "publishedAt") {
        valA = a[sortField as keyof YouTubeVideo] || "";
        valB = b[sortField as keyof YouTubeVideo] || "";
        return sortDirection === "asc"
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      } else if (sortField === "duration") {
        valA = parseDurationToSeconds(a.duration);
        valB = parseDurationToSeconds(b.duration);
      } else {
        // numeric fields (viewCount, likeCount, subscriberCount, viewToSubRatio)
        valA = parseCompactNumber(a[sortField as keyof YouTubeVideo] as string);
        valB = parseCompactNumber(b[sortField as keyof YouTubeVideo] as string);
      }

      // Secure comparison of possible NaN or Infinity bounds
      const isA_NaN = typeof valA === "number" && isNaN(valA);
      const isB_NaN = typeof valB === "number" && isNaN(valB);
      if (isA_NaN && isB_NaN) return 0;
      if (isA_NaN) return 1; // Put NaN values at the very bottom
      if (isB_NaN) return -1;

      if (valA === valB) return 0;
      if (sortDirection === "asc") {
        return valA > valB ? 1 : -1;
      } else {
        return valA < valB ? 1 : -1;
      }
    });
  }, [searchResult, sortField, sortDirection]);

  // Refined Trojan Horse Form States
  const [painPoint, setPainPoint] = useState<string>("착한 아이 증후군 / 만성적 관계 피로 (People-pleasing Trap)");
  const [accessibilityTopic, setAccessibilityTopic] = useState<string>("늘 남들 눈치 보느라 혼자 상처받는 이들의 3가지 소름 돋는 비밀 (호구 탈출법)");
  const [innocentShellVisual, setInnocentShellVisual] = useState<string>("동글동글하며 따스하고 무해한 파스텔톤 드로잉 캐릭터 (Psych2Go 시그니처 감성)");
  const [intellectualDepth, setIntellectualDepth] = useState<string>("쇼펜하우어의 '고독을 친구 삼아 내 영혼의 고유한 품격을 사모하는 법'과 인간 고통의 실존적 본질");
  const [voiceTone, setVoiceTone] = useState<string>("낮고 단단하면서도 차분히 읊조리는 알랭 드 보통 스타일의 냉철한 영국식 도슨트 톤");
  const [cynicalWitLevel, setCynicalWitLevel] = useState<string>("70% (현대인들의 가식적인 자아를 향해 사정없이 던지는 우아한 블랙 코미디와 팩폭 한 스푼)");
  const [customStorySourcing, setCustomStorySourcing] = useState<string>("평생 타인의 환심과 양해를 얻기 위해 나 자신의 감정을 소멸시키며 지나치게 착하게 살아왔지만, 결국 남들에게 만만하고 유용한 소모품 취급을 당하는 사람들에게, 타인의 무리한 기대치를 칼같이 도려내는 기품 있는 침묵 정색술");
  const [targetNiche, setTargetNiche] = useState<string>("직장 및 일상 관계 눈치 싸움으로 감정이 만성 정서 방전된 2030대 소심하고 무해한 내향인");
  const [videoLength, setVideoLength] = useState<string>("미드폼 6~8분 내외 (시청지속유도 템포 전개)");
  const [soundMusicStyle, setSoundMusicStyle] = useState<string>("사춘기 깊은 새벽 빗소리 + 고독한 독주 첼로 앰비언트 + 투박하게 사각거리는 마른 연필 손그림 마찰 효과음(SFX)");

  // Selected video for the A/B testing step in Script Studio
  const [selectedVideoSource, setSelectedVideoSource] = useState<YouTubeVideo | null>(null);
  
  // A/B Plan generation states
  const [abPlanResult, setAbPlanResult] = useState<ABPlanResponse | null>(null);
  const [isAbPlanLoading, setIsAbPlanLoading] = useState<boolean>(false);
  const [abPlanError, setAbPlanError] = useState<string | null>(null);
  const [externalVideoUrl, setExternalVideoUrl] = useState<string>("");
  const [isExternalVideoLoading, setIsExternalVideoLoading] = useState<boolean>(false);
  const [externalVideoError, setExternalVideoError] = useState<string | null>(null);

  // States for prompt and title result workspace
  const [promptTab, setPromptTab] = useState<"ALL" | "A" | "B" | "C" | "D">("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyResultText = (text: string, id: string) => {
    const success = robustCopy(text);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };



  const handleGenerateABTestingPlan = async (videoItem?: YouTubeVideo) => {
    const targetVideo = videoItem || selectedVideoSource;
    if (!targetVideo) return;

    setIsAbPlanLoading(true);
    setAbPlanError(null);
    setAbPlanResult(null);

    try {
      const response = await fetch("/api/generate-ab-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoTitle: targetVideo.title,
          psy2goShell: targetVideo.analysis.psy2goShell,
          schoolOfLifeCore: targetVideo.analysis.schoolOfLifeCore,
          cynicalWitPoint: targetVideo.analysis.cynicalWitPoint,
          trojanRemakeTip: targetVideo.analysis.trojanRemakeTip,
          customGeminiApiKey
        })
      });

      if (!response.ok) {
        throw new Error("A/B 테스트 제목 및 썸네일 기획안 도출에 실패했습니다.");
      }

      const data = await response.json();
      setAbPlanResult(data);
    } catch (err: any) {
      console.error(err);
      setAbPlanError(err.message || "A/B 테스트 기획을 도출 중 서버 통신 에러가 발생했습니다.");
    } finally {
      setIsAbPlanLoading(false);
    }
  };

  const handleLoadExternalVideo = async () => {
    const cleanUrl = externalVideoUrl.trim();
    if (!cleanUrl) {
      setExternalVideoError("YouTube 영상 주소를 입력해 주세요.");
      return;
    }

    setIsExternalVideoLoading(true);
    setExternalVideoError(null);
    setAbPlanError(null);

    try {
      const response = await fetch("/api/youtube-video-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: cleanUrl,
          customApiKey: customYouTubeApiKey
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "외부 YouTube 영상을 불러오지 못했습니다.");
      }

      const video = data.video as YouTubeVideo;
      setSelectedVideoSource(video);
      setAbPlanResult(null);
      setPromptTab("ALL");
      await handleGenerateABTestingPlan(video);
    } catch (err: any) {
      console.error(err);
      setExternalVideoError(err.message || "외부 영상 분석 중 오류가 발생했습니다.");
    } finally {
      setIsExternalVideoLoading(false);
    }
  };

  // Output/UI states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [synthesisResult, setSynthesisResult] = useState<FusionAnalysisResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState<boolean>(false);
  const [activeTabResult, setActiveTabResult] = useState<"script" | "pipeline" | "seo" | "prompt">("script");

  // Load Preset directly from Benchmark Library to Trojan Horse Studio
  const handleLoadPreset = (preset: {
    painPoint: string;
    accessibilityTopic: string;
    innocentShellVisual: string;
    intellectualDepth: string;
    voiceTone: string;
    cynicalWitLevel: string;
    customStorySourcing: string;
    targetNiche: string;
    videoLength: string;
    soundMusicStyle: string;
  }) => {
    setPainPoint(preset.painPoint);
    setAccessibilityTopic(preset.accessibilityTopic);
    setInnocentShellVisual(preset.innocentShellVisual);
    setIntellectualDepth(preset.intellectualDepth);
    setVoiceTone(preset.voiceTone);
    setCynicalWitLevel(preset.cynicalWitLevel);
    setCustomStorySourcing(preset.customStorySourcing);
    setTargetNiche(preset.targetNiche);
    setVideoLength(preset.videoLength);
    setSoundMusicStyle(preset.soundMusicStyle);
    
    setActiveTab("trojan");
    
    // Smooth scroll to step guide
    setTimeout(() => {
      document.getElementById("trojan-steps")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleYouTubeSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchError("검색 키워드를 입력해 주십시오.");
      return;
    }
    setIsSearchLoading(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      const response = await fetch("/api/youtube-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          query: searchQuery,
          market,
          durationFilter,
          dateFilter,
          maxResults,
          customApiKey: customYouTubeApiKey,
          customGeminiApiKey
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "유튜브 영상 상세 분석 및 조사를 불러들이지 못했습니다.");
      }

      const data = await response.json();
      setSearchResult(data);
    } catch (err: any) {
      console.error(err);
      setSearchError(err.message || "서버 통신 실패 또는 타임아웃이 발생했습니다.");
    } finally {
      setIsSearchLoading(false);
    }
  };

  const handleInjectToTrojan = (video: YouTubeVideo) => {
    // Set targeted video source
    setSelectedVideoSource(video);
    setAbPlanResult(null);
    setAbPlanError(null);
    
    // Inject components automatically as high-tier inspiration
    setPainPoint(video.title);
    setAccessibilityTopic(video.title.length > 40 ? video.title.slice(0, 38) + "..." : video.title);
    setIntellectualDepth(video.analysis.schoolOfLifeCore);
    setCustomStorySourcing(`[유튜브 벤치마크 '${video.title}' 연계 기획]
- 이 비디오의 흥행 요소인 대중성 외갑('${video.analysis.psy2goShell}')을 기제로 삼는다.
- 여기에 나만의 고유 에피소드를 버무리고, 한 단계 격이 높은 트로이 목마식 개량 비법('${video.analysis.trojanRemakeTip.replace(/'/g, "")}')을 내면에 추가 삽입하여 조회수 지배력을 극대화한다.`);
    
    setActiveTab("trojan");

    // Automatically generate the A/B testing blueprint
    handleGenerateABTestingPlan(video);

    // Scroll smoothly to target form
    setTimeout(() => {
      document.getElementById("trojan-studio-view")?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  const handleCopyText = (text: string) => {
    const success = robustCopy(text);
    if (success) {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    }
  };

  const handleSynthesizeScript = async () => {
    setIsLoading(true);
    setApiError(null);
    setSynthesisResult(null);

    try {
      const response = await fetch("/api/analyze-fusion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          painPoint,
          accessibilityTopic,
          innocentShellVisual,
          intellectualDepth,
          voiceTone,
          cynicalWitLevel,
          customStorySourcing,
          targetNiche,
          videoLength,
          soundMusicStyle,
          customGeminiApiKey
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "대본 생성 중 알 수 없는 서비스 통신 문제 발생");
      }

      const data = await response.json();
      setSynthesisResult(data);
      setActiveTabResult("script");

      // Scroll smoothly to output
      setTimeout(() => {
        document.getElementById("trojan-studio-results")?.scrollIntoView({ behavior: "smooth" });
      }, 150);

    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "서버와 연결 수립 중 타임아웃 혹은 연결 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // Pre-cooked Combinations inside library Tab
  const presets = [
    {
      name: "우아한 기품의 내향인 침묵 처세술",
      subtitle: "Psych2Go(외형) + School of Life(내면)",
      painPoint: "만만하게 비치는 착한 성격과 거절 강박",
      accessibilityTopic: "남들에게 맨날 맞춰주다 결국 호구되는 착한 사람들의 3가지 서글픈 특징",
      innocentShellVisual: "동글동글한 흰둥이 드로잉 캐릭터가 비오는 하수구 옆에 쭈그려 우는 연출",
      intellectualDepth: "니체의 '주인 도덕' 개념과 알랭 드 보통의 지독히도 소심한 호의 속에 숨은 도피 욕구",
      voiceTone: "단호하지만 나긋나긋하게 귀를 적시는 영국의 시적인 남성 나레이션 어조",
      cynicalWitLevel: "60% (어차피 당신이 모두에게 친철해야 세상은 당신에게 원수 갚을 뿐이라는 냉소적 위트)",
      customStorySourcing: "평생 남의 비위만 맞추다 영혼이 방전된 사람들이, 징징대지 않고 미소를 보이며 단호하게 침묵 정색으로 주도권을 회복하여 내 인간 경계를 무자비하게 방어해내는 실전 처세비법",
      targetNiche: "관계에 매여 혼자 집에 돌아와 뒤늦은 이불킥을 반복하는 예민하고 순둥한 2030 직장인들",
      videoLength: "미드폼 에세이 6분 내외",
      soundMusicStyle: "쓸쓸한 고독의 첼로 선율 + 창밖의 장맛비 화이트 노이즈 빗소리 + 연필 마킹 폴리(SFX) 효과음"
    },
    {
      name: "새벽녘 극강의 도파민 전두엽 디톡스",
      subtitle: "BrainCraft(외형) + School of Life(내면)",
      painPoint: "스마트폰 짧은 동영상 중독과 지독한 뇌 산만함",
      accessibilityTopic: "새벽 2시에 무조건 폰 켜느라 당신 뇌세포에서 벌어지는 기괴한 파괴 증조 3가지",
      innocentShellVisual: "실사 종이 오려 붙이기 스톱모션 브레인 크레이 에셋으로 귀여운 장난감 아바타 연출",
      intellectualDepth: "파스칼의 '내 방에 혼자 가만히 앉아 고통받을 수 없는 고독 불감증'과 뇌 신경가소성 해부",
      voiceTone: "차분하면서 지적 탐구심이 넘치는 도슨트의 셰익스피어 독백 수준 연극 톤 어조",
      cynicalWitLevel: "40% (자기 전 60초 숏츠 쇼츠를 뒤적이며 뇌세포를 절이고 그것을 '휴식'이라 위안하는 영혼들에 대한 학술적 비소)",
      customStorySourcing: "스마트 소셜 미디어 플랫폼에 도파민 주권을 완전히 강탈당해 아침에 잠깨기 힘든 현대인들에게, 사색의 영역을 복원하고 전두엽을 72시간 만에 원상 복구시키는 뇌과학기반 침실 정화 테크닉과 5분 눈동자 정렬 명상법",
      targetNiche: "침대에서 숏폼 수만개를 내리며 잠자리에 드는 만성 불면과 산만함에 뇌가 녹고 있는 현대인들",
      videoLength: "숏츠 쇼츠 기획형",
      soundMusicStyle: "정적 브레인 싱크 주파수 소리"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col transition-all duration-300">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full space-y-8">
        
        {/* TAB 0: REALTIME YOUTUBE DEEP SEARCH & MARKET ANALYSIS */}
        {activeTab === "research" && (
          <div className="space-y-8 animate-fade-in" id="research-tab-view">
            
            {/* Header branding info */}
            <div className="bg-gradient-to-r from-gray-950 to-indigo-950/25 border border-indigo-500/10 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
              <div className="space-y-2 relative z-10 max-w-2xl text-left">
                <span className="inline-flex items-center gap-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase">
                  ⚡ AI TROJAN INTELLIGENCE SEEDER
                </span>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  조회수 제압을 위한 유튜브 심리학 시장 트렌드 기획기
                </h2>
                <p className="text-xs text-gray-400 leading-normal font-normal">
                  Psych2Go의 귀여운 대중용 외갑(Innocent Shell)과 School of Life의 고밀도 인문학 통찰(Intellectual Depth)을 퓨전하여, 무의식적으로 클릭하고 전두엽이 관통당하는 기획물을 생산합니다. 
                </p>
              </div>
            </div>

            {/* API Credentials Configuration Hub */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Gemini API Key configuration */}
              <div className="bg-slate-950/60 border border-indigo-500/15 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-gray-800/50 pb-2">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-indigo-400" />
                      Gemini API Key 설정 (일일 대본 기획 요청 한도 해결)
                    </h4>
                    <p className="text-[10px] text-gray-400 leading-normal">
                      공유 무료 요청 한도가 초과(429) 되었을 때, 나만의 무제한 대본 제작 및 깊은 조사를 실행하려면 개인 Gemini API Key를 등록하십시오. 브라우저에 안전히 보관됩니다.
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="password"
                        placeholder="Gemini API Key 입력"
                        value={customGeminiApiKey}
                        onChange={(e) => {
                          handleSaveGeminiApiKey(e.target.value);
                          setTestResults(prev => ({ ...prev, gemini: null }));
                        }}
                        className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-44 pr-8 h-9 font-mono"
                      />
                      {customGeminiApiKey && (
                        <button
                          onClick={() => {
                            handleSaveGeminiApiKey("");
                            setTestResults(prev => ({ ...prev, gemini: null }));
                          }}
                          className="absolute right-2.5 top-2.5 text-gray-500 hover:text-white text-[10px] cursor-pointer"
                          title="지우기"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    
                    <button
                      onClick={() => handleTestKeys("gemini")}
                      disabled={isTestingKeys.gemini}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border shrink-0 cursor-pointer ${
                        isTestingKeys.gemini
                          ? "bg-gray-800 text-gray-500 border-gray-750 pointer-events-none"
                          : "bg-indigo-600/30 text-indigo-300 border-indigo-500/30 hover:bg-indigo-650/40 active:scale-95"
                      }`}
                    >
                      {isTestingKeys.gemini ? "검사 중..." : "연동 테스트"}
                    </button>
                  </div>

                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border uppercase ${
                    customGeminiApiKey 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                      : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                  }`}>
                    {customGeminiApiKey ? "● 개별 연동" : "● 공유 한도"}
                  </span>
                </div>

                {/* Gemini Key Validation Result Status UI */}
                {testResults.gemini && (
                  <div className={`text-[10.5px] p-2.5 rounded-lg border leading-relaxed flex items-start gap-1.5 animate-fade-in ${
                    testResults.gemini.success
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-300 border-rose-500/20"
                  }`}>
                    <span className="shrink-0 mt-0.5">{testResults.gemini.success ? "✅" : "❌"}</span>
                    <div>
                      <strong className="block font-black mb-0.5">{testResults.gemini.success ? "연결 상태 정상" : "인증 실패 확인"}</strong>
                      {testResults.gemini.message}
                    </div>
                  </div>
                )}
              </div>
 
              {/* YouTube API Key configuration */}
              <div className="bg-slate-950/60 border border-indigo-500/15 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-gray-800/50 pb-2">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-rose-400" />
                      YouTube API Key 설정 (실시간 실제 데이터 연동)
                    </h4>
                    <p className="text-[10px] text-gray-400 leading-normal">
                      실제 유튜브 인기 영상의 무제한 조회, 채널 연결 및 주소 복사를 가동하려면 키가 필요합니다. 미등록 시 고도로 설계된 시뮬레이션 데이터가 동작합니다.
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="password"
                        placeholder="YouTube API Key 입력"
                        value={customYouTubeApiKey}
                        onChange={(e) => {
                          handleSaveApiKey(e.target.value);
                          setTestResults(prev => ({ ...prev, youtube: null }));
                        }}
                        className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-44 pr-8 h-9"
                      />
                      {customYouTubeApiKey && (
                        <button
                          onClick={() => {
                            handleSaveApiKey("");
                            setTestResults(prev => ({ ...prev, youtube: null }));
                          }}
                          className="absolute right-2.5 top-2.5 text-gray-500 hover:text-white text-[10px] cursor-pointer"
                          title="지우기"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    
                    <button
                      onClick={() => handleTestKeys("youtube")}
                      disabled={isTestingKeys.youtube}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border shrink-0 cursor-pointer ${
                        isTestingKeys.youtube
                          ? "bg-gray-800 text-gray-500 border-gray-750 pointer-events-none"
                          : "bg-indigo-600/30 text-indigo-300 border-indigo-500/30 hover:bg-indigo-650/40 active:scale-95"
                      }`}
                    >
                      {isTestingKeys.youtube ? "검사 중..." : "연동 테스트"}
                    </button>
                  </div>

                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border uppercase ${
                    customYouTubeApiKey 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"
                  }`}>
                    {customYouTubeApiKey ? "● 실시간 API 연동" : "● 시뮬레이션 가동"}
                  </span>
                </div>

                {/* YouTube Key Validation Result Status UI */}
                {testResults.youtube && (
                  <div className={`text-[10.5px] p-2.5 rounded-lg border leading-relaxed flex items-start gap-1.5 animate-fade-in ${
                    testResults.youtube.success
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-300 border-rose-500/20"
                  }`}>
                    <span className="shrink-0 mt-0.5">{testResults.youtube.success ? "✅" : "❌"}</span>
                    <div>
                      <strong className="block font-black mb-0.5">{testResults.youtube.success ? "연결 상태 정상" : "인증 실패 확인"}</strong>
                      {testResults.youtube.message}
                    </div>
                  </div>
                )}
              </div>
            </div>
              
              {/* Target Market Region Selector Choice */}
              <div className="flex flex-col md:flex-row items-start md:items-center gap-3 bg-slate-950/40 p-4 border border-gray-850 rounded-xl">
                <span className="text-xs font-bold text-gray-400 uppercase whitespace-nowrap flex items-center gap-1">
                  🎯 분석 타깃 시장 선택:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMarket("KR")}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                      market === "KR"
                        ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20"
                        : "bg-slate-900 text-gray-400 border-gray-800 hover:text-white hover:bg-slate-850"
                    }`}
                  >
                    <span>🇰🇷 국내 시장 (한국어)</span>
                  </button>
                  <button
                    onClick={() => setMarket("US")}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                      market === "US"
                        ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20"
                        : "bg-slate-900 text-gray-400 border-gray-800 hover:text-white hover:bg-slate-850"
                    }`}
                  >
                    <span>🇺🇸 글로벌 시장 (영어 번역 연동)</span>
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 leading-normal md:ml-4 max-w-xl">
                  {market === "US" 
                    ? "💡 글로벌 시장 선택 시, 한국어 검색어를 입력하셔도 AI가 영어(US) 유튜브 트렌드 검색어로 자동 번역 및 최적화하여 Psych2Go 등 영미권 1천만 채널의 정밀 데이터를 해킹합니다."
                    : "💡 국내 시장 선택 시, 한국어로 된 인기 심리학/고민해결 필드의 영상과 채널들을 온전히 벤치마킹 분석합니다."
                  }
                </p>
              </div>

              {/* Real Search Form Bar with Filters */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  
                  {/* Keyword Input (4 cols) */}
                  <div className="md:col-span-4 relative">
                    <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                    <input 
                      type="text"
                      id="youtube-keyword-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleYouTubeSearch();
                      }}
                      placeholder="조회수를 벤치마킹할 키워드를 입력해 주십시오 (예: 관계 피로, 무기력증, 쇼펜하우어, 착한 아이 증후군)"
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors h-11"
                    />
                  </div>

                  {/* Upload Date Range Filter (2 cols) */}
                  <div className="md:col-span-2">
                    <select
                      id="date-filter-select"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-indigo-500 h-11 cursor-pointer"
                    >
                      <option value="all">📅 업로드 날짜 (전체)</option>
                      <option value="week">📅 최근 1주일 이내</option>
                      <option value="month">📅 최근 1개월 이내</option>
                      <option value="month2">📅 최근 2개월 이내</option>
                      <option value="month3">📅 최근 3개월 이내</option>
                      <option value="month6">📅 최근 6개월 이내</option>
                      <option value="year">📅 최근 1년 이내</option>
                    </select>
                  </div>

                  {/* Video Length Filter (2 cols) */}
                  <div className="md:col-span-2">
                    <select
                      id="duration-filter-select"
                      value={durationFilter}
                      onChange={(e) => setDurationFilter(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-indigo-500 h-11 cursor-pointer"
                    >
                      <option value="all">⏳ 영상 길이 (전체)</option>
                      <option value="short">⏳ 4분 미만 (Short)</option>
                      <option value="medium">⏳ 4분 ~ 20분 (Medium)</option>
                      <option value="long">⏳ 20분 초과 (Long)</option>
                    </select>
                  </div>

                  {/* List Quantity Manual Input (2 cols) */}
                  <div className="md:col-span-2 relative">
                    <input 
                      type="number"
                      id="youtube-results-limit"
                      min={1}
                      max={50}
                      value={maxResults || ""}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setMaxResults(isNaN(val) ? 0 : val);
                      }}
                      onBlur={() => {
                        if (!maxResults || maxResults < 1) {
                          setMaxResults(5);
                        } else if (maxResults > 50) {
                          setMaxResults(50);
                        }
                      }}
                      placeholder="5"
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-3 pr-12 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors h-11 text-center font-bold"
                    />
                    <span className="absolute right-3 top-3.5 text-[10px] text-gray-400 pointer-events-none font-bold">
                      개 출력
                    </span>
                  </div>

                  {/* Submit Search Trigger Button (2 cols) */}
                  <div className="md:col-span-2">
                    <button
                      onClick={handleYouTubeSearch}
                      disabled={isSearchLoading}
                      className="w-full bg-indigo-600 hover:bg-indigo-550 disabled:bg-indigo-800 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-500/10 h-11 shrink-0"
                    >
                      {isSearchLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>연동 분석 중...</span>
                        </>
                      ) : (
                        <>
                          <Flame className="w-4 h-4 text-amber-300 fill-amber-300" />
                          <span>영상 검색 개시</span>
                        </>
                      )}
                    </button>
                  </div>

                </div>
              </div>

              {/* Recommend Quick Tags */}
              <div className="space-y-2">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">인기 추천 분석 키워드:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    "착한 아이 증후군",
                    "만성 무기력과 번아웃",
                    "내향인의 사회적 고독",
                    "가스라이팅 교묘한 대처",
                    "쇼펜하우어 고독의 지혜",
                    "가짜 위로에 서운할 때"
                  ].map((word) => (
                    <button
                      key={word}
                      onClick={() => {
                        setSearchQuery(word);
                        // Trigger search utilizing states with small offset delay
                        setTimeout(() => handleYouTubeSearch(), 100);
                      }}
                      className="bg-gray-950 hover:bg-slate-900 border border-gray-850 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white transition-all cursor-pointer font-medium"
                    >
                      #{word}
                    </button>
                  ))}
                </div>
              </div>

              {/* ERROR STATS */}
            {searchError && (
              <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-5 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">동작 수행 중 문제 발생</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed">{searchError}</p>
                </div>
              </div>
            )}

            {/* LOADING PLACEHOLDER */}
            {isSearchLoading && (
              <div className="bg-slate-900/10 border border-gray-850 rounded-2xl p-12 text-center space-y-4 animate-pulse">
                <div className="w-14 h-14 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto animate-spin">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-white">실시간 검색 및 가치 융합 성향 해킹 가동 중</h4>
                  <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                    유튜브 API 메타 통계에서 영상 목록을 긁어들여, Psych2Go의 귀여운 대중 가두리 기법과 College/School of life의 초격차 인문 지식을 기하학적으로 접목 분석하는 알고리즘을 수행 중입니다...
                  </p>
                </div>
              </div>
            )}

            {/* IF NO RESULT YET CONTAINER */}
            {!isSearchLoading && !searchResult && !searchError && (
              <div className="bg-gradient-to-b from-gray-900/30 to-gray-950 border border-gray-850/80 rounded-2xl p-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-indigo-950/40 text-indigo-400/80 border border-indigo-500/20 flex items-center justify-center mx-auto shadow-inner">
                  <Search className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">조회수를 털어먹을 시장 영역에 대한 검색을 기다리고 있습니다</h4>
                  <p className="text-xs text-gray-550 max-w-md mx-auto leading-relaxed">
                    위 추천 분석 키워드 칩이나 검색 상자에 원하시는 인간관계, 영혼, 고독, 불안 등의 심리학적 결핍 질문을 던지십시오.
                  </p>
                </div>
              </div>
            )}

            {/* REAL SEARCH RESULTS */}
            {searchResult && (
              <div className="space-y-8 animate-fade-in" id="youtube-search-results-section">

                {/* Gemini API Quota Fallback Alert */}
                {searchResult.quotaExceededFallback && (
                  <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-4 flex items-start justify-between gap-3 text-left animate-pulse">
                    <div className="flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0 mt-0.5 font-bold text-base">
                        🚨
                      </div>
                      <div>
                        <span className="text-xs font-bold text-rose-300 block">제미나이 AI 무료 한도 도달 안내: '로컬 비상 정밀 보고서 모형' 자동 가동 중</span>
                        <p className="text-[10px] text-gray-300 leading-normal mt-1">
                          현재 공유 트래픽 및 무료 사용량 급증으로 인해 <strong>Gemini API 무료 요청 한건/일일 한도</strong>가 소진(Resource Exhausted 429)되었습니다. 
                          사용자 경험이 중단되지 않도록 <strong>'초정밀 로컬 분석 엔진'</strong>이 긴급 기동하여, 입력하신 검색어 <strong>"{searchQuery}"</strong>에 최적화된 고품격 시뮬레이션 보고서를 정상 제공합니다!
                        </p>
                        <p className="text-[10px] text-gray-500 leading-normal mt-1.5 leading-relaxed">
                          💡 <strong>정상 조치 가이드:</strong> 잠시 후(약 1분 뒤) 다시 가동해 보시거나, 나만의 고유한 제미나이 API 키를 사용해 독점적인 무제한 실시간 분석을 돌려보고 싶으시다면 AI Studio 상단 메뉴 <strong>Settings &gt; Secrets</strong>에서 <code>GEMINI_API_KEY</code>를 등록해 주십시오. (YouTube 실시간 영상 조회의 경우 우측 비밀번호 입력란에 YouTube API Key를 연동해 보실 수 있습니다).
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                 {/* Youtube API Connection Alert */}
                 {!searchResult.isRealData && (
                   <div className="bg-amber-950/15 border border-amber-500/20 rounded-xl p-4 flex flex-col gap-3 text-left">
                     <div className="flex gap-2.5 items-start">
                       <HelpCircle className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
                       <div>
                         <span className="text-xs font-bold text-white block">제미나이 기반 심층 영상 트렌드 시뮬레이션 가동 중</span>
                         <p className="text-[10px] text-gray-450 leading-normal mt-0.5 font-normal">
                           현재 <strong>YOUTUBE_API_KEY</strong>가 설정되어 있지 않거나 외부 API 호출 장애가 발생하여, 제미나이 트래픽 엔지니어가 실시간 흥행에 적합하도록 정밀 설계한 시뮬레이션 영상 데이터 분석 보고서가 가동 중입니다. 실제 유튜브 실조 인기 영상 데이터를 연동하시려면 우측 상단 <strong>Settings/Secrets</strong>에 유튜브 API Key를 등록하시거나 개별 연동 수단을 가동하십시오.
                         </p>
                       </div>
                     </div>
                     {searchResult.youtubeError && (
                       <div className="p-3 bg-rose-950/30 border border-rose-500/20 rounded-lg text-[10px] leading-relaxed font-mono text-rose-300">
                         <div className="font-bold text-rose-450 mb-1">⚠️ 유튜브 API 연동 실패 로그/원인:</div>
                         <div className="break-all whitespace-pre-wrap">{searchResult.youtubeError}</div>
                         <div className="text-[9px] text-gray-400 mt-2 font-sans leading-normal">
                           * <strong>문제 해결 가이드:</strong><br />
                           1. 입력하신 API 키의 앞뒤 공백(복사할 때 자주 묻어나는 개행 등)이 없는지 정확히 다시 전개해 보십시오.<br />
                           2. Google Cloud Console의 API 라이브러리에서 해당 프로젝트의 <strong>'YouTube Data API v3'</strong>가 반드시 '사용 설정(사용 공고)'되어 있어야 합니다.
                         </div>
                       </div>
                     )}
                   </div>
                 )}
                  <div className="overflow-x-auto rounded-2xl border border-gray-850 bg-slate-950/60 shadow-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-850 bg-gray-900/40 text-[11px] text-gray-400 font-extrabold tracking-wider select-none">
                          <th 
                            onClick={() => handleSort("title")}
                            className="py-4 px-4 font-bold text-gray-300 cursor-pointer hover:bg-slate-900 transition-colors text-left"
                          >
                            <div className="flex items-center gap-1.5 justify-start">
                              <span>비디오 제목 / 채널</span>
                              <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortField === "title" ? "text-indigo-400" : "text-gray-550"}`} />
                              {sortField === "title" && (
                                <span className="text-[10px] text-indigo-400 font-bold">{sortDirection === "asc" ? "▲" : "▼"}</span>
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleSort("viewCount")}
                            className="py-4 px-4 text-center font-bold text-gray-300 w-24 cursor-pointer hover:bg-slate-900 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 justify-center">
                              <span>조회수</span>
                              <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortField === "viewCount" ? "text-indigo-400" : "text-gray-550"}`} />
                              {sortField === "viewCount" && (
                                <span className="text-[10px] text-indigo-400 font-bold">{sortDirection === "asc" ? "▲" : "▼"}</span>
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleSort("likeCount")}
                            className="py-4 px-4 text-center font-bold text-gray-300 w-24 cursor-pointer hover:bg-slate-900 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 justify-center">
                              <span>좋아요</span>
                              <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortField === "likeCount" ? "text-indigo-400" : "text-gray-550"}`} />
                              {sortField === "likeCount" && (
                                <span className="text-[10px] text-indigo-400 font-bold">{sortDirection === "asc" ? "▲" : "▼"}</span>
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleSort("subscriberCount")}
                            className="py-4 px-4 text-center font-bold text-gray-300 w-28 cursor-pointer hover:bg-slate-900 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 justify-center">
                              <span>채널 구독자</span>
                              <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortField === "subscriberCount" ? "text-indigo-400" : "text-gray-550"}`} />
                              {sortField === "subscriberCount" && (
                                <span className="text-[10px] text-indigo-400 font-bold">{sortDirection === "asc" ? "▲" : "▼"}</span>
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleSort("viewToSubRatio")}
                            className="py-4 px-4 text-center font-bold text-gray-300 w-28 cursor-pointer hover:bg-slate-900 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 justify-center">
                              <span>조회/구독율</span>
                              <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortField === "viewToSubRatio" ? "text-indigo-400" : "text-gray-555"}`} />
                              {sortField === "viewToSubRatio" && (
                                <span className="text-[10px] text-indigo-400 font-bold">{sortDirection === "asc" ? "▲" : "▼"}</span>
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleSort("publishedAt")}
                            className="py-4 px-4 text-center font-bold text-gray-300 w-28 cursor-pointer hover:bg-slate-900 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 justify-center">
                              <span>업로드 일자</span>
                              <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortField === "publishedAt" ? "text-indigo-400" : "text-gray-555"}`} />
                              {sortField === "publishedAt" && (
                                <span className="text-[10px] text-indigo-400 font-bold">{sortDirection === "asc" ? "▲" : "▼"}</span>
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleSort("duration")}
                            className="py-4 px-4 text-center font-bold text-gray-300 w-24 cursor-pointer hover:bg-slate-900 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 justify-center">
                              <span>영상 시간</span>
                              <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortField === "duration" ? "text-indigo-400" : "text-gray-555"}`} />
                              {sortField === "duration" && (
                                <span className="text-[10px] text-indigo-400 font-bold">{sortDirection === "asc" ? "▲" : "▼"}</span>
                              )}
                            </div>
                          </th>
                          <th className="py-4 px-4 text-center font-bold text-gray-300 w-32 select-none">기획 액션</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-850 text-xs">
                        {sortedVideos.map((video) => {
                          const ratioFloat = parseFloat(video.viewToSubRatio || "0");
                          const isHighlyViral = ratioFloat >= 100 || video.viewToSubRatio === "∞";
                          const isModeratelyViral = ratioFloat >= 30 && ratioFloat < 100;

                          const isReal = searchResult?.isRealData;
                          const resolvedVideoUrl = (isReal && video.id)
                            ? `https://www.youtube.com/watch?v=${video.id}`
                            : `https://www.youtube.com/results?search_query=${encodeURIComponent(video.title)}`;
                          
                          const resolvedChannelUrl = (isReal && video.channelId)
                            ? `https://www.youtube.com/channel/${video.channelId}`
                            : `https://www.youtube.com/results?search_query=${encodeURIComponent(video.channelTitle)}`;

                          return (
                            <tr 
                              key={video.id}
                              className="hover:bg-indigo-600/10 transition-colors group cursor-default"
                            >
                              {/* Title / Channel with Small Thumbnail */}
                              <td className="py-3 px-4 max-w-md">
                                <div className="flex gap-3 items-center">
                                  <button 
                                    onClick={() => setActivePlayVideo(video)}
                                    title="인앱 플레이어로 영상 재생"
                                    className="relative block w-16 h-10 rounded overflow-hidden border border-gray-800 shrink-0 hover:border-indigo-500 transition-all cursor-pointer group/thumb text-left"
                                  >
                                    <img 
                                      src={video.thumbnail || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100"} 
                                      alt={video.title} 
                                      className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-200"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100";
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                                      <Play className="w-4 h-4 text-white fill-white" />
                                    </div>
                                    <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[8px] px-1 rounded text-white font-mono scale-90">
                                      재생 📺
                                    </span>
                                  </button>
                                  <div className="min-w-0 flex-1 text-left">
                                    <div className="flex items-center gap-1.5 flex-wrap font-normal">
                                      <button 
                                        onClick={() => setActivePlayVideo(video)}
                                        className="font-bold text-gray-100 hover:text-indigo-400 text-xs text-left max-w-[200px] line-clamp-1 cursor-pointer"
                                      >
                                        {video.title}
                                      </button>
                                      <button
                                        onClick={() => handleLinkClick(resolvedVideoUrl)}
                                        title="유튜브 영상 주소 복사"
                                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold bg-indigo-950 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 rounded-md transition-all active:scale-95 cursor-pointer ml-auto"
                                      >
                                        {linkCopiedId === resolvedVideoUrl ? (
                                          <>
                                            <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
                                            <span className="text-emerald-400 text-[8px]">복사 완료</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-2.5 h-2.5" />
                                            <span className="text-[8px]">주소 복사 🔗</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-450">
                                      <a 
                                        href={resolvedChannelUrl}
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="hover:underline hover:text-white transition-colors flex items-center gap-0.5 text-gray-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]"
                                      >
                                        {video.channelTitle}
                                      </a>
                                      <span className="text-gray-700">|</span>
                                      <button
                                        onClick={() => handleLinkClick(resolvedChannelUrl)}
                                        title="유튜브 채널 주소 복사"
                                        className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[8px] bg-slate-900 hover:bg-slate-800 text-gray-450 rounded transition-all active:scale-95 cursor-pointer border border-gray-800 whitespace-nowrap"
                                      >
                                        {linkCopiedId === resolvedChannelUrl ? (
                                          <span className="text-emerald-400 text-[8px]">채널 복사됨</span>
                                        ) : (
                                          <span className="text-[8px]">채널 🔗</span>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Viewcount */}
                              <td className="py-3 px-4 text-center font-medium text-gray-200 whitespace-nowrap">
                                {video.viewCount}회
                              </td>

                              {/* Likecount */}
                              <td className="py-3 px-4 text-center text-gray-300 font-medium whitespace-nowrap">
                                {video.likeCount}
                              </td>

                              {/* Subscriber Count */}
                              <td className="py-3 px-4 text-center text-gray-300 font-medium whitespace-nowrap">
                                {video.subscriberCount}명
                              </td>

                              {/* View / Subscribers Ratio */}
                              <td className="py-3 px-4 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase select-none ${
                                  isHighlyViral 
                                    ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10" 
                                    : isModeratelyViral 
                                      ? "bg-amber-950/60 text-amber-400 border border-amber-500/30" 
                                      : "bg-slate-900 border border-gray-800 text-gray-400"
                                }`}>
                                  {video.viewToSubRatio}
                                </span>
                              </td>

                              {/* Published At Date */}
                              <td className="py-3 px-4 text-center text-gray-400 whitespace-nowrap font-mono scale-95">
                                {video.publishedAt}
                              </td>

                              {/* Video length duration */}
                              <td className="py-3 px-4 text-center text-gray-300 font-medium whitespace-nowrap">
                                {video.duration}
                              </td>

                              {/* Action button */}
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <button
                                  onClick={() => handleInjectToTrojan(video)}
                                  className="bg-indigo-600/90 hover:bg-indigo-600 active:scale-95 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-indigo-500/10 hover:shadow"
                                >
                                  대본 연동 ⚡
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
              </div>
            )}

          </div>
        )}

        {/* TAB 1: TROJAN HORSE SCRIPT STUDIO (PRO) */}
        {activeTab === "trojan" && (
          <div className="space-y-10 animate-fade-in" id="trojan-studio-view">
            
            {/* Phase 1: A/B Testing Title & Thumbnail Planning Studio */}
            <div className="bg-slate-900/40 rounded-2xl border border-gray-800 p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-800 pb-5 gap-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
                    <Sparkles className="w-6 h-6 text-indigo-400" />
                    [1단계] A/B 테스트용 제목 & 썸네일 기획실
                  </h2>
                  <p className="text-xs text-gray-400">
                    Psych2Go의 행동과학적 고민 가두리와 The School of Life의 지적 고요함을 병합해 클릭률과 시청시간을 동시에 폭격할 최상의 대조군을 설계합니다.
                  </p>
                </div>
                
                {selectedVideoSource && (
                  <div className="flex items-center gap-2 bg-indigo-950/40 border border-indigo-800/40 rounded-full px-4 py-1.5 self-start md:self-auto">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                    <span className="text-[11px] font-bold text-indigo-300">
                      벤치마크 연동: {selectedVideoSource.channelTitle} ({selectedVideoSource.viewCount})
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-gray-950/45 border border-gray-850 rounded-xl p-4 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] font-black text-gray-300 uppercase tracking-widest flex items-center gap-1.5">
                      <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
                      외부 YouTube 벤치마크 링크
                    </label>
                    <input
                      type="url"
                      value={externalVideoUrl}
                      onChange={(e) => {
                        setExternalVideoUrl(e.target.value);
                        setExternalVideoError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleLoadExternalVideo();
                      }}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full bg-black/60 border border-gray-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <button
                    onClick={handleLoadExternalVideo}
                    disabled={isExternalVideoLoading}
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black border transition-all shrink-0 ${
                      isExternalVideoLoading
                        ? "bg-gray-800 text-gray-500 border-gray-750 pointer-events-none"
                        : "bg-indigo-600/30 text-indigo-300 border-indigo-500/30 hover:bg-indigo-600/45 active:scale-95 cursor-pointer"
                    }`}
                  >
                    {isExternalVideoLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>불러오는 중</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>링크로 A/B 기획 생성</span>
                      </>
                    )}
                  </button>
                </div>
                {externalVideoError && (
                  <div className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                    {externalVideoError}
                  </div>
                )}
                {selectedVideoSource && (
                  <div className="flex items-center gap-3 bg-black/40 border border-gray-850 rounded-lg p-2.5">
                    {selectedVideoSource.thumbnail && (
                      <img
                        src={selectedVideoSource.thumbnail}
                        alt=""
                        className="w-20 h-12 object-cover rounded-md border border-gray-800 bg-gray-900 shrink-0"
                      />
                    )}
                    <div className="min-w-0 text-left">
                      <p className="text-xs font-bold text-white truncate">{selectedVideoSource.title}</p>
                      <p className="text-[10px] text-gray-500 truncate">
                        {selectedVideoSource.channelTitle} · {selectedVideoSource.viewCount} · {selectedVideoSource.duration}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Loader, Error, or Result */}
              {isAbPlanLoading ? (
                <div className="bg-gray-950/40 rounded-xl border border-gray-850 p-12 text-center space-y-4">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-300">A/B 테스트 기획대 조립 지능 구동 중...</p>
                    <p className="text-[11px] text-gray-500">Psych2Go의 무해한 외갑과 The School of Life의 실존적 영혼 통찰을 비틀어 타겟팅 변수 4종을 직조하고 있습니다.</p>
                  </div>
                </div>
              ) : abPlanError ? (
                <div className="bg-red-950/20 rounded-xl border border-red-900/30 p-8 text-center space-y-4">
                  <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-red-400">A/B 테스트 기획을 생성하는 과정에서 에러가 체크되었습니다.</p>
                    <p className="text-[11px] text-gray-500">{abPlanError}</p>
                  </div>
                  <button
                    onClick={() => handleGenerateABTestingPlan()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-750 text-xs font-bold text-white cursor-pointer"
                  >
                    수동 가동 시작 ⚡
                  </button>
                </div>
              ) : abPlanResult ? (
                <div className="space-y-6">
                  {/* Grid or Bento of 4 Options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    
                    {/* OPTION A: Psych2Go Style */}
                    <div className="bg-gray-950/70 rounded-xl border border-gray-850 p-5 flex flex-col justify-between space-y-4 shadow-xl">
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between border-b border-gray-900 pb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-green-400 bg-green-950/50 px-2 py-0.5 rounded-md border border-green-900/30">
                            {abPlanResult.titleA.style || "Option A - Psych2Go 대중 공감"}
                          </span>
                          <span className="text-[10px] text-gray-400">대안 A</span>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-1.5">
                            <h4 className="text-sm font-extrabold text-white leading-snug">
                              “{abPlanResult.titleA.title}”
                            </h4>
                            <button
                              onClick={() => {
                                robustCopy(abPlanResult.titleA.title);
                                alert("제목이 복사되었습니다: " + abPlanResult.titleA.title);
                              }}
                              className="text-gray-500 hover:text-white transition-colors cursor-pointer self-start p-1"
                              title="제목 복사"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-[11px] text-indigo-300">
                            <strong>심리 타격 기제:</strong> {abPlanResult.titleA.trigger}
                          </p>
                        </div>

                        <div className="bg-slate-900/30 rounded-lg p-3 border border-gray-900 space-y-2">
                          <p className="text-[11px] text-gray-400 leading-relaxed">
                            <strong>썸네일 비주얼 콘셉트:</strong> {abPlanResult.thumbnailA.concept}
                          </p>
                          <div className="flex items-center justify-between bg-black/60 rounded px-2.5 py-1.5 border border-gray-850 mt-1">
                            <span className="text-[10px] font-mono text-gray-500 truncate max-w-[85%]">
                              {abPlanResult.thumbnailA.midjourneyPrompt}
                            </span>
                            <button
                              onClick={() => {
                                robustCopy(abPlanResult.thumbnailA.midjourneyPrompt);
                                alert("미드저니 프롬프트가 대용량 클립보드에 복사되었습니다!");
                              }}
                              className="text-gray-400 hover:text-white p-1 cursor-pointer"
                              title="미드저니 프롬프트 복사"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* OPTION B: The School of Life Style */}
                    <div className="bg-gray-950/70 rounded-xl border border-gray-850 p-5 flex flex-col justify-between space-y-4 shadow-xl">
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between border-b border-gray-900 pb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-900/30">
                            {abPlanResult.titleB.style || "Option B - School of Life 지적사색"}
                          </span>
                          <span className="text-[10px] text-gray-400">대안 B</span>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-1.5">
                            <h4 className="text-sm font-extrabold text-white leading-snug">
                              “{abPlanResult.titleB.title}”
                            </h4>
                            <button
                              onClick={() => {
                                robustCopy(abPlanResult.titleB.title);
                                alert("제목이 복사되었습니다: " + abPlanResult.titleB.title);
                              }}
                              className="text-gray-500 hover:text-white transition-colors cursor-pointer self-start p-1"
                              title="제목 복사"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-[11px] text-indigo-300">
                            <strong>심리 타격 기제:</strong> {abPlanResult.titleB.trigger}
                          </p>
                        </div>

                        <div className="bg-slate-900/30 rounded-lg p-3 border border-gray-900 space-y-2">
                          <p className="text-[11px] text-gray-400 leading-relaxed">
                            <strong>썸네일 비주얼 콘셉트:</strong> {abPlanResult.thumbnailB.concept}
                          </p>
                          <div className="flex items-center justify-between bg-black/60 rounded px-2.5 py-1.5 border border-gray-850 mt-1">
                            <span className="text-[10px] font-mono text-gray-500 truncate max-w-[85%]">
                              {abPlanResult.thumbnailB.midjourneyPrompt}
                            </span>
                            <button
                              onClick={() => {
                                robustCopy(abPlanResult.thumbnailB.midjourneyPrompt);
                                alert("미드저니 프롬프트가 대용량 클립보드에 복사되었습니다!");
                              }}
                              className="text-gray-400 hover:text-white p-1 cursor-pointer"
                              title="미드저니 프롬프트 복사"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* OPTION C: Trojan Fusion Style 1 */}
                    <div className="bg-gray-950/70 border-purple-950/50 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-xl border">
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between border-b border-gray-900 pb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-950/50 px-2 py-0.5 rounded-md border border-purple-900/30 flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {abPlanResult.titleC.style || "Option C - 트로이 융합 1형"}
                          </span>
                          <span className="text-[10px] text-purple-300 font-bold">강력 추천 대안</span>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-1.5">
                            <h4 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-purple-300 leading-snug">
                              “{abPlanResult.titleC.title}”
                            </h4>
                            <button
                              onClick={() => {
                                robustCopy(abPlanResult.titleC.title);
                                alert("제목이 복사되었습니다: " + abPlanResult.titleC.title);
                              }}
                              className="text-gray-500 hover:text-white transition-colors cursor-pointer self-start p-1"
                              title="제목 복사"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-[11px] text-indigo-300">
                            <strong>심리 타격 기제:</strong> {abPlanResult.titleC.trigger}
                          </p>
                        </div>

                        <div className="bg-slate-900/30 rounded-lg p-3 border border-gray-900 space-y-2">
                          <p className="text-[11px] text-gray-400 leading-relaxed">
                            <strong>썸네일 비주얼 콘셉트:</strong> {abPlanResult.thumbnailC.concept}
                          </p>
                          <div className="flex items-center justify-between bg-black/60 rounded px-2.5 py-1.5 border border-gray-850 mt-1">
                            <span className="text-[10px] font-mono text-gray-500 truncate max-w-[85%]">
                              {abPlanResult.thumbnailC.midjourneyPrompt}
                            </span>
                            <button
                              onClick={() => {
                                robustCopy(abPlanResult.thumbnailC.midjourneyPrompt);
                                alert("미드저니 프롬프트가 대용량 클립보드에 복사되었습니다!");
                              }}
                              className="text-gray-400 hover:text-white p-1 cursor-pointer"
                              title="미드저니 프롬프트 복사"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* OPTION D: Trojan Fusion Style 2 */}
                    <div className="bg-gray-950/70 border-indigo-950/50 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-xl border">
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between border-b border-gray-900 pb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-900/30 flex items-center gap-1">
                            <Compass className="w-3 h-3" />
                            {abPlanResult.titleD.style || "Option D - 트로이 융합 2형"}
                          </span>
                          <span className="text-[10px] text-indigo-300 font-bold font-mono">인지부조화 극대화</span>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-1.5">
                            <h4 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-200 to-indigo-300 leading-snug">
                              “{abPlanResult.titleD.title}”
                            </h4>
                            <button
                              onClick={() => {
                                robustCopy(abPlanResult.titleD.title);
                                alert("제목이 복사되었습니다: " + abPlanResult.titleD.title);
                              }}
                              className="text-gray-500 hover:text-white transition-colors cursor-pointer self-start p-1"
                              title="제목 복사"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-[11px] text-indigo-300">
                            <strong>심리 타격 기제:</strong> {abPlanResult.titleD.trigger}
                          </p>
                        </div>

                        <div className="bg-slate-900/30 rounded-lg p-3 border border-gray-900 space-y-2">
                          <p className="text-[11px] text-gray-450 leading-relaxed">
                            <strong>썸네일 비주얼 콘셉트:</strong> {abPlanResult.thumbnailD.concept}
                          </p>
                          <div className="flex items-center justify-between bg-black/60 rounded px-2.5 py-1.5 border border-gray-850 mt-1">
                            <span className="text-[10px] font-mono text-gray-500 truncate max-w-[85%]">
                              {abPlanResult.thumbnailD.midjourneyPrompt}
                            </span>
                            <button
                              onClick={() => {
                                robustCopy(abPlanResult.thumbnailD.midjourneyPrompt);
                                alert("미드저니 프롬프트가 대용량 클립보드에 복사되었습니다!");
                              }}
                              className="text-gray-400 hover:text-white p-1 cursor-pointer"
                              title="미드저니 프롬프트 복사"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* TITLE & THUMBNAIL PORTAL & WORKSPACE */}
                  <div className="bg-gray-950/40 rounded-2xl border border-indigo-950/60 p-6 space-y-5 text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-850 pb-4 gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400 font-mono bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/30">
                          Workspace Clipboard Board
                        </span>
                        <h3 className="text-base font-black text-white flex items-center gap-2">
                          <Compass className="w-5 h-5 text-indigo-400" />
                          📋 타이틀 & 썸네일 이미지 생성 프롬프트 결과 보드
                        </h3>
                        <p className="text-[11px] text-gray-400">
                          인지해부학과 실전 대조군 분석을 결합하여 직조된 타이틀 및 미드저니 이미지 프롬프트를 한눈에 모아보며 활용할 수 있는 보드입니다.
                        </p>
                      </div>
                      
                      {/* Active Selector Tab */}
                      <div className="flex flex-wrap items-center gap-1 bg-gray-950 px-2 py-1.5 rounded-lg border border-gray-850 self-start sm:self-auto">
                        <button
                          onClick={() => setPromptTab("ALL")}
                          className={`px-2.5 py-1 rounded text-[10px] font-black cursor-pointer transition-all ${promptTab === "ALL" ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-extrabold" : "text-gray-400 hover:text-white"}`}
                        >
                          전체 보기
                        </button>
                        {(["A", "B", "C", "D"] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setPromptTab(opt)}
                            className={`px-2.5 py-1 rounded text-[10px] font-black cursor-pointer transition-all ${promptTab === opt ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-extrabold" : "text-gray-400 hover:text-white"}`}
                          >
                            대안 {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Rendering different sub-layouts based on promptTab */}
                    <div className="space-y-4">
                      {promptTab === "ALL" ? (
                        <div className="space-y-4">
                          {[
                            { id: "A", key: "A" as const, titleObj: abPlanResult.titleA, thumbObj: abPlanResult.thumbnailA, color: "text-green-400 bg-green-950/30 border-green-900/30", badge: "대중공감형" },
                            { id: "B", key: "B" as const, titleObj: abPlanResult.titleB, thumbObj: abPlanResult.thumbnailB, color: "text-blue-400 bg-blue-950/30 border-blue-900/30", badge: "사색통찰형" },
                            { id: "C", key: "C" as const, titleObj: abPlanResult.titleC, thumbObj: abPlanResult.thumbnailC, color: "text-purple-400 bg-purple-950/30 border-purple-900/30", badge: "융합추천형" },
                            { id: "D", key: "D" as const, titleObj: abPlanResult.titleD, thumbObj: abPlanResult.thumbnailD, color: "text-indigo-400 bg-indigo-950/30 border-indigo-900/30", badge: "인지과학형" }
                          ].map((item) => {
                            const enTitlePartText = item.titleObj.enTitle ? `\n- 영어 의역 제목: “${item.titleObj.enTitle}”` : "";
                            const fullText = `[대안 ${item.id} - ${item.badge}]\n- 스타일: ${item.titleObj.style}\n- 한글 제목: “${item.titleObj.title}”${enTitlePartText}\n- 비주얼 콘셉트: ${item.thumbObj.concept}\n- 이미지 생성 프롬프트:\n${item.thumbObj.midjourneyPrompt}`;
                            return (
                              <div key={item.id} className="bg-gray-900/35 rounded-xl border border-gray-850 p-4 space-y-3.5 hover:border-gray-800 transition-colors">
                                <div className="flex items-center justify-between border-b border-gray-900 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${item.color}`}>
                                      대안 {item.id} · {item.badge}
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-medium">{item.titleObj.style}</span>
                                  </div>
                                  <button
                                    onClick={() => handleCopyResultText(fullText, `all-${item.id}`)}
                                    className="inline-flex items-center gap-1 text-[9px] font-bold text-gray-400 hover:text-white bg-gray-950 border border-gray-850 px-2 py-1 rounded transition-colors cursor-pointer"
                                  >
                                    {copiedId === `all-${item.id}` ? (
                                      <>
                                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                                        <span className="text-emerald-300 font-extrabold">복사 완료!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5 text-indigo-400" />
                                        <span>정리 카드 전체 복사</span>
                                      </>
                                    )}
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
                                  <div className="md:col-span-5 space-y-1">
                                    <p className="text-[10px] font-mono text-gray-500 font-bold block">Proposed Video Title (권장 복사형 제목)</p>
                                    <div className="bg-black/35 rounded p-2.5 border border-gray-900/30 space-y-2">
                                      <div className="flex items-start gap-1.5 text-left">
                                        <span className="text-[8px] bg-indigo-950 text-indigo-400 border border-indigo-900/40 px-1 py-0.5 rounded font-mono shrink-0">KO</span>
                                        <span className="text-xs font-black text-white leading-relaxed">{item.titleObj.title}</span>
                                      </div>
                                      {item.titleObj.enTitle && (
                                        <div className="border-t border-gray-900/40 pt-1.5 mt-1.5 flex items-start gap-1.5 text-left">
                                          <span className="text-[8px] bg-amber-950 text-amber-400 border border-amber-900/40 px-1 py-0.5 rounded font-mono shrink-0 font-bold">EN</span>
                                          <span className="text-xs font-semibold text-gray-300 italic font-sans leading-relaxed">“{item.titleObj.enTitle}”</span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                      <button
                                        onClick={() => handleCopyResultText(item.titleObj.title, `title-${item.id}`)}
                                        className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 cursor-pointer"
                                      >
                                        {copiedId === `title-${item.id}` ? "제목 복사됨 ✓" : "한글만 복사 ⚡"}
                                      </button>
                                      {item.titleObj.enTitle && (
                                        <button
                                          onClick={() => handleCopyResultText(item.titleObj.enTitle || "", `entitle-${item.id}`)}
                                          className="text-[9px] font-bold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                                        >
                                          {copiedId === `entitle-${item.id}` ? "영어 복사됨 ✓" : "영어만 복사 ⚡"}
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <div className="md:col-span-7 space-y-1.5">
                                    <p className="text-[10px] font-mono text-gray-500 font-bold block">Midjourney/DALL-E Image Generation Prompt (이미지 생성 프롬프트)</p>
                                    <div className="relative bg-black/45 hover:bg-black/60 transition-colors rounded-lg p-2.5 border border-gray-850">
                                      <p className="text-[10px] text-gray-300 font-mono select-all break-all line-clamp-2 leading-relaxed">
                                        {item.thumbObj.midjourneyPrompt}
                                      </p>
                                      <div className="mt-1 flex items-center justify-between text-[8px] text-gray-500 font-mono">
                                        <span>글자 수: {item.thumbObj.midjourneyPrompt.length}자</span>
                                        <button
                                          onClick={() => handleCopyResultText(item.thumbObj.midjourneyPrompt, `prompt-${item.id}`)}
                                          className="text-[9px] text-indigo-400 hover:text-indigo-300 font-sans font-bold flex items-center gap-0.5 cursor-pointer pb-0.5"
                                        >
                                          {copiedId === `prompt-${item.id}` ? "프롬프트 복사됨 ✓" : "프롬프트만 복사 ⚡"}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Single Selected Tab view with detailed full text block */
                        (() => {
                          const opt = promptTab;
                          let title = "";
                          let enTitle = "";
                          let trigger = "";
                          let concept = "";
                          let prompt = "";
                          let styleName = "";
                          let badgeName = "";
                          let colorTheme = "";

                          if (opt === "A") {
                            title = abPlanResult.titleA.title;
                            enTitle = abPlanResult.titleA.enTitle || "";
                            trigger = abPlanResult.titleA.trigger;
                            concept = abPlanResult.thumbnailA.concept;
                            prompt = abPlanResult.thumbnailA.midjourneyPrompt;
                            styleName = abPlanResult.titleA.style || "Psych2Go 대중 공감 소심형";
                            badgeName = "대중공감형";
                            colorTheme = "border-green-500/20 focus-within:border-green-500/40 Accent-green";
                          } else if (opt === "B") {
                            title = abPlanResult.titleB.title;
                            enTitle = abPlanResult.titleB.enTitle || "";
                            trigger = abPlanResult.titleB.trigger;
                            concept = abPlanResult.thumbnailB.concept;
                            prompt = abPlanResult.thumbnailB.midjourneyPrompt;
                            styleName = abPlanResult.titleB.style || "The School of Life 지적통찰형";
                            badgeName = "사색통찰형";
                            colorTheme = "border-blue-500/20 focus-within:border-blue-500/40 Accent-blue";
                          } else if (opt === "C") {
                            title = abPlanResult.titleC.title;
                            enTitle = abPlanResult.titleC.enTitle || "";
                            trigger = abPlanResult.titleC.trigger;
                            concept = abPlanResult.thumbnailC.concept;
                            prompt = abPlanResult.thumbnailC.midjourneyPrompt;
                            styleName = abPlanResult.titleC.style || "트로이 융합 시네마틱형 (하이브리드)";
                            badgeName = "추천융합형";
                            colorTheme = "border-purple-500/20 focus-within:border-purple-500/40 Accent-purple";
                          } else {
                            title = abPlanResult.titleD.title;
                            enTitle = abPlanResult.titleD.enTitle || "";
                            trigger = abPlanResult.titleD.trigger;
                            concept = abPlanResult.thumbnailD.concept;
                            prompt = abPlanResult.thumbnailD.midjourneyPrompt;
                            styleName = abPlanResult.titleD.style || "블랙위트 인지부조화 극대화형";
                            badgeName = "인지과학형";
                            colorTheme = "border-indigo-500/20 focus-within:border-indigo-500/40 Accent-indigo";
                          }

                          const singleFullText = `[유튜브 기획 대안 ${opt} - ${badgeName}]\n\n■ 스타일 카테고리: ${styleName}\n■ 유튜브 비디오 권장 수식 제목 (한글):\n“${title}”\n${enTitle ? `\n■ 유튜브 비디오 권장 수식 제목 (영어 의역):\n“${enTitle}”\n` : ""}\n■ 타겟 심리 트리거:\n${trigger}\n\n■ 썸네일 비주얼 가이드라인 컨셉:\n${concept}\n\n■ 인공지능 이미지 생성기 추천 영문 프롬프트 (Midjourney Prompt):\n${prompt}`;

                          return (
                            <div className={`bg-gray-950/85 rounded-xl border p-5 space-y-4 transition-all duration-300 ${colorTheme}`}>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-900 pb-3 gap-2">
                                <div className="space-y-0.5">
                                  <span className="text-[10px] text-gray-500 font-mono tracking-wider">DETAILED CONFIGURATION VIEW</span>
                                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-indigo-400" />
                                    대안 {opt} : {styleName}
                                  </h4>
                                </div>
                                <button
                                  onClick={() => handleCopyResultText(singleFullText, `detailed-${opt}`)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black text-indigo-300 bg-indigo-950/50 border border-indigo-900/40 hover:bg-indigo-900 cursor-pointer transition-all shadow-md"
                                >
                                  {copiedId === `detailed-${opt}` ? (
                                    <>
                                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                      <span className="text-emerald-300">원클릭 전체 복사 완료!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>기획 카드 클립보드 원클릭 복사 ⚡</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                  {/* Title block */}
                                  <div className="bg-gray-900/40 rounded-lg p-3.5 border border-gray-900 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">1. Recommended YouTube Title</span>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleCopyResultText(title, `single-title-${opt}`)}
                                          className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold"
                                        >
                                          {copiedId === `single-title-${opt}` ? "한글 복사됨!" : "한글 복사"}
                                        </button>
                                        {enTitle && (
                                          <button
                                            onClick={() => handleCopyResultText(enTitle, `single-entitle-${opt}`)}
                                            className="text-[9px] text-amber-400 hover:text-amber-300 font-bold hover:underline"
                                          >
                                            {copiedId === `single-entitle-${opt}` ? "영어 복사됨!" : "영어 의역 복사"}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <div className="bg-black/60 rounded p-2.5 border border-gray-850 space-y-2">
                                      <div className="flex items-start gap-1.5 text-left">
                                        <span className="text-[8px] bg-indigo-950 text-indigo-400 border border-indigo-900/40 px-1 py-0.5 rounded font-mono shrink-0 font-bold">KO</span>
                                        <span className="text-xs font-black text-white leading-relaxed">“{title}”</span>
                                      </div>
                                      {enTitle && (
                                        <div className="border-t border-gray-900/40 pt-1.5 mt-1.5 flex items-start gap-1.5 text-left">
                                          <span className="text-[8px] bg-amber-950 text-amber-400 border border-amber-900/40 px-1 py-0.5 rounded font-mono shrink-0 font-bold">EN</span>
                                          <span className="text-xs font-semibold text-gray-300 italic font-sans leading-relaxed">“{enTitle}”</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Psych Trigger block */}
                                  <div className="bg-gray-900/40 rounded-lg p-3.5 border border-gray-900 space-y-1">
                                    <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">2. Psychological Trigger & Target</span>
                                    <p className="text-[11px] text-indigo-200 leading-relaxed font-semibold">
                                      {trigger}
                                    </p>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  {/* Concept block */}
                                  <div className="bg-gray-900/40 rounded-lg p-3.5 border border-gray-850 space-y-1">
                                    <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">3. Thumbnail Visual Concept</span>
                                    <p className="text-[11px] text-gray-400 leading-relaxed font-sans">
                                      {concept}
                                    </p>
                                  </div>

                                  {/* Prompt block */}
                                  <div className="bg-gray-900/40 rounded-lg p-3.5 border border-gray-900 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">4. Image Prompt (Midjourney / DALL-E)</span>
                                      <button
                                        onClick={() => handleCopyResultText(prompt, `single-prompt-${opt}`)}
                                        className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold"
                                      >
                                        {copiedId === `single-prompt-${opt}` ? "공식 복사됨!" : "프롬프트 복사"}
                                      </button>
                                    </div>
                                    <div className="bg-black/80 rounded-lg p-2.5 border border-gray-850">
                                      <p className="text-[9px] text-gray-300 font-mono select-all break-all leading-normal whitespace-pre-wrap">
                                        {prompt}
                                      </p>
                                      <div className="mt-1 flex items-center justify-between text-[8px] text-gray-500 font-mono">
                                        <span>{prompt.length} characters</span>
                                        <span className="text-[8px] text-amber-500/80">★ ready for Midjourney v6</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>

                  {/* Strategy Analysis Panel at Bottom */}
                  <div className="bg-gray-950/50 rounded-xl border border-gray-850 p-5 space-y-3 text-left">
                    <h4 className="text-xs font-black text-gray-300 uppercase tracking-widest flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      실전 대안 A/B 테스트 설정 가이드 & 전술 분석
                    </h4>
                    <div className="whitespace-pre-wrap text-xs text-gray-400 leading-relaxed font-sans">
                      {abPlanResult.strategyAnalysis}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-950/30 rounded-xl border border-gray-850 p-8 text-center space-y-3">
                  <p className="text-xs text-gray-400">
                    아직 로드된 벤치마크 비디오가 없습니다. [유튜브 오리지널 트렌드 수색대] 탭에서 원하는 영상을 검색하고 <strong>대본 연동 ⚡</strong> 버튼을 눌러주시거나 아래 버튼으로 임시 생성해보세요:
                  </p>
                  <button
                    onClick={() => {
                      const tempVideo: YouTubeVideo = {
                        title: "타인의 가스라이팅과 극도의 무기력에 시달리는 소심한 이들의 심리",
                        channelTitle: "Psychology Center",
                        channelId: "UCXYZ",
                        thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
                        viewCount: "35만회",
                        likeCount: "1.2만",
                        subscriberCount: "82만",
                        viewToSubRatio: "42.6%",
                        duration: "PT7M15S",
                        publishedAt: "2026-05-23",
                        analysis: {
                          psy2goShell: "귀여운 마카롱 토끼 캐릭터가 가스라이팅을 당하며 울고 있는 모습",
                          schoolOfLifeCore: "관계의 착취 구조를 알랭 드 보통 성찰로 해체",
                          cynicalWitPoint: "관계를 강요하는 멘토충들을 거침없는 유머로 폭격",
                          trojanRemakeTip: "실전 대화 카독 내역을 오프닝 2초 만에 배치"
                        }
                      };
                      setSelectedVideoSource(tempVideo);
                      handleGenerateABTestingPlan(tempVideo);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-[11px] font-bold text-indigo-300 cursor-pointer"
                  >
                    샘플 비디오로 가상 설계 시작 ⚡
                  </button>
                </div>
              )}
            </div>

            {/* Separator to step 2/3 */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-850"></div>
              <span className="flex-shrink mx-4 text-xs font-black text-gray-400 uppercase tracking-widest bg-gray-950 px-3 py-1 rounded-full border border-gray-850 flex items-center gap-1">
                <FileText className="w-4 h-4 text-indigo-400" />
                [2단계] 트로이 목마 레시피 미세 조정 & 시네마틱 대본 생성
              </span>
              <div className="flex-grow border-t border-gray-850"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* LEFT COLUMN: configurator steps Form (7 Cols) */}
              <div className="lg:col-span-7 bg-slate-900/30 rounded-2xl border border-gray-850 p-6 space-y-8" id="trojan-steps">
                
                {/* Section Introduction */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-400" />
                      트로이 목마 레시피 제조대
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      각 단계를 탭하며 목마의 결핍 외각, 무장한 소울 알맹이 심리, 연출 사운드를 배합하십시오.
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setPainPoint("번아웃 / 만성 피로와 감정 방전");
                      setAccessibilityTopic("요즘 들어 유독 쉽게 화나고 지치길 반복하는 사람들에게 전하는 슬픈 가두리");
                      setInnocentShellVisual("동글동글하고 귀여운 파스텔톤 드로잉 일러스트");
                      setIntellectualDepth("사르트르의 실존적 불안과 무력감");
                      setVoiceTone("낮고 시크하며 영국 귀족 풍의 수필 나레이터");
                      setCynicalWitLevel("50% (조금은 차갑지만 유머러스함)");
                      setCustomStorySourcing("남들의 기대에 부응하고자 나의 욕구를 소실시키며 착한 아이로 살아온 이들에게, 타인의 비정상적인 요구를 우아한 침묵 정색과 매혹적인 무대응으로 선 격파하는 심리 처세술");
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-750 text-gray-400 hover:text-white text-[10px] font-bold transition-all cursor-pointer"
                    title="초기화"
                  >
                    <RotateCcw className="w-3 h-3" />
                    기본값 복원
                  </button>
                </div>

                {/* Step Forms */}
                <div className="space-y-6">
                  
                  {/* STEP 1: Psych2Go Shell Design */}
                  <div className="bg-gray-950/60 p-5 rounded-xl border border-gray-850 space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-900 pb-2.5">
                      <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-950 text-indigo-300 text-[10px] font-black">1</span>
                        [외각 껍데기] Psych2Go 식의 대중적이고 무해한 가두리 설계
                      </h4>
                      <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-full font-bold">인기 가이드라인</span>
                    </div>

                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-300 mb-1">
                          📁 시청자가 밤에 고민하는 '일상적 결핍/불안 소재' *
                        </label>
                        <select 
                          value={painPoint} 
                          onChange={(e) => setPainPoint(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                        >
                          <option value="착한 아이 증후군 / 만성적 관계 피로 (People-pleasing Trap)">착한 아이 증후군 / 만성적 관계 피로 (People-pleasing Trap)</option>
                          <option value="지독한 무기력증과 전형적인 번아웃 (Chronic Burnout & Lethargy)">지독한 무기력증과 전형적인 번아웃 (Chronic Burnout & Lethargy)</option>
                          <option value="사회 초년생의 소외감과 뒤처지는 공포 (IMposter & FOMO Syndrome)">사회 초년생의 소외감과 뒤처지는 공포 (Imposter & FOMO Syndrome)</option>
                          <option value="완벽함에 대한 숨 막히는 집착과 자아 비난 (Severe Perfectionism)">완벽함에 대한 숨 막히는 집착과 자아 비난 (Severe Perfectionism)</option>
                          <option value="교묘한 관계 가스라이팅과 회사 은밀한 빌런 (Gaslighting & Relationship Vampires)">교묘한 관계 가스라이팅과 회사 은밀한 빌런 (Gaslighting & Relationship Vampires)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-300 mb-1">
                          🖼️ 썸네일 & 기획 제목의 '초밀착 소지 낚시 문구' (클릭률 20% 장치)
                        </label>
                        <input 
                          type="text"
                          value={accessibilityTopic}
                          onChange={(e) => setAccessibilityTopic(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                          placeholder="예: 착한 아이 증후군에서 즉각 탈출해 기갑 경계 치는 비기"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-400 mb-1">
                          🎨 눈을 사르장 무장해제할 '무해하고 친근감 넘치는 비주얼 묘사'
                        </label>
                        <input 
                          type="text"
                          value={innocentShellVisual}
                          onChange={(e) => setInnocentShellVisual(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* STEP 2: The School of Life Depth Engine */}
                  <div className="bg-gray-950/60 p-5 rounded-xl border border-gray-850 space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-900 pb-2.5">
                      <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-950/50 text-emerald-300 text-[10px] font-black">2</span>
                        [내면 정병] The School of Life 식의 깊은 철학적 성찰 + 블랙 유머
                      </h4>
                      <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full font-bold">인문학 뼈대</span>
                    </div>

                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-300 mb-1">
                          🧠 단순 체크리스트를 뛰어넘는 인문학/심리학적 학술 프레임워크 *
                        </label>
                        <select 
                          value={intellectualDepth} 
                          onChange={(e) => setIntellectualDepth(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                        >
                          <option value="쇼펜하우어의 '고독을 친구 삼아 내 영혼의 고유한 품격을 사모하는 법'과 인간 고통의 실존적 본질">쇼펜하우어의 '고독'과 허무주의의 지적 찬미</option>
                          <option value="니체의 '르상티망(Resentment)'과 타인의 환심 속에 기어들어가는 '노예 도덕' 비판">니체의 '르상티망'과 노예 도덕의 탈출 비법</option>
                          <option value="사르트르의 실존주의적 인간 불안과 무의식적인 가면(Bad Faith) 방어막 구조">사르트르의 실존적 가면(Bad Faith)과 주체성</option>
                          <option value="알랭 드 보통의 지독한 '불안(Status Anxiety)' 분석과 현대 소외 구조론">알랭 드 보통의 타인의 무례한 이면 분석</option>
                          <option value="지그문트 프로이트의 정서 억압론과 심리 방어기제를 관통하는 상실 극복">프로이트의 억압 메커니즘과 자아 마스크</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-300 mb-1">
                            🗣️ 어조 / 나레이터 보이스 톤앤매너
                          </label>
                          <input 
                            type="text"
                            value={voiceTone}
                            onChange={(e) => setVoiceTone(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-300 mb-1">
                            🎭 블랙 코미디와 냉소 성찰 강도 (0%~100%)
                          </label>
                          <input 
                            type="text"
                            value={cynicalWitLevel}
                            onChange={(e) => setCynicalWitLevel(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* STEP 3: My Private Ingredient */}
                  <div className="bg-gray-950/60 p-5 rounded-xl border border-gray-850 space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-900 pb-2.5">
                      <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-950/50 text-amber-300 text-[10px] font-black">3</span>
                        [나만의 소울] 누구도 훔칠 수 없는 나만의 차별적 지식 & 스토리
                      </h4>
                      <span className="text-[10px] bg-amber-950 text-amber-300 px-2 py-0.5 rounded-full font-bold">오리지널리티</span>
                    </div>

                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-350 mb-1">
                          ✍️ 이 대본에서 깊이 다뤄 해쳐나갈 나만의 독창적인 심리 해결 처세 / 경험 에피소드 *
                        </label>
                        <textarea
                          rows={4}
                          value={customStorySourcing}
                          onChange={(e) => setCustomStorySourcing(e.target.value)}
                          placeholder="예: 예민한 사람이 기싸움을 침묵으로 격퇴하고 침착하게 방어망 구축하기"
                          className="w-full bg-gray-950 border border-gray-850 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-300 mb-1">
                            🎯 공략할 집중 니치 시청 대상층 *
                          </label>
                          <input 
                            type="text"
                            value={targetNiche}
                            onChange={(e) => setTargetNiche(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-300 mb-1">
                            ⏱️ 영상의 최종 길이 및 전개 템포
                          </label>
                          <input 
                            type="text"
                            value={videoLength}
                            onChange={(e) => setVideoLength(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* STEP 4: Audio Styling */}
                  <div className="bg-gray-950/60 p-5 rounded-xl border border-gray-850 space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-900 pb-2.5">
                      <h4 className="text-xs font-black text-rose-450 uppercase tracking-widest flex items-center gap-1.5 text-pink-400">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-pink-950 text-pink-350 text-[10px] font-black">4</span>
                        [감정 사운드] 몰입도를 300% 올려줄 기밀 밤 효과음 & 배경음
                      </h4>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-300 mb-1">
                        🎵 빗소리, 연필소리, 정적인 악기 등의 사운드 연출 레이아웃
                      </label>
                      <input 
                        type="text"
                        value={soundMusicStyle}
                        onChange={(e) => setSoundMusicStyle(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                </div>

                {/* Synthesis Trigger Button */}
                <div className="pt-2">
                  <button
                    onClick={handleSynthesizeScript}
                    disabled={isLoading}
                    className={`w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg truncate ${
                      isLoading
                        ? "bg-indigo-950 text-indigo-450 cursor-not-allowed border border-indigo-500/20"
                        : "bg-indigo-600 hover:bg-indigo-550 text-white shadow-indigo-500/20 cursor-pointer transform hover:-translate-y-0.5"
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                        <span>트로이 목마 대본 엔진 가동 중 (약 5초 소요)...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 text-indigo-200 fill-indigo-200" />
                        <span>트로이 목마 시네마틱 기획 & 영한 대본 생성 ⚡</span>
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-gray-500 text-center mt-2 font-medium">
                    ※ 구글 제미나이 3.5 모델을 통해 Psych2Go의 파괴적 클릭 유도와 School of Life의 철학적 오리지널 대본이 실시간 자동 빌드됩니다.
                  </p>
                </div>

              </div>

              {/* RIGHT COLUMN: Studio Output (5 Cols) */}
              <div className="lg:col-span-12 xl:col-span-5 space-y-6" id="trojan-studio-results">
                
                {apiError && (
                  <div className="bg-rose-950/20 border border-rose-500/20 rounded-2xl p-6 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">대본 빌드 중 지연 오류가 있었습니다</h4>
                      <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">{apiError}</p>
                    </div>
                    {apiError.includes("GEMINI_API_KEY") && (
                      <div className="bg-gray-950 p-3 rounded-lg border border-gray-850 text-xs text-left max-w-xs mx-auto space-y-1">
                        <p className="font-bold text-amber-400">🔑 해결 방법</p>
                        <p className="text-gray-400 text-[11px] leading-relaxed">
                          우측 상단의 <strong>Settings / Secrets</strong> 탭으로 가셔서 <strong>GEMINI_API_KEY</strong> 변수에 나의 구글 제미나이 API 키를 올바르게 주입한 뒤 새로고침 후 시도해 주십시오.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {isLoading && (
                  <div className="bg-slate-900/10 border border-gray-850 rounded-2xl p-8 text-center space-y-6 animate-pulse">
                    <div className="w-16 h-16 rounded-full bg-indigo-950 text-indigo-450 border border-indigo-500/20 flex items-center justify-center mx-auto animate-spin">
                      <Zap className="w-8 h-8 text-amber-400 fill-amber-400" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-bold text-white">대중성 껍질 + 명저 깊이 융합 연산 중</h4>
                      <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
                        Psych2Go 썸네일 카피를 동기화하고, 철학 논평과 어우러진 씁쓸한 블랙 유머 스크립트를 정렬하는 중입니다...
                      </p>
                    </div>
                    <div className="h-1 bg-gray-800 rounded-full w-32 mx-auto"></div>
                  </div>
                )}

                {!isLoading && !synthesisResult && !apiError && (
                  <div className="bg-gradient-to-b from-gray-900/40 to-gray-950/40 border border-gray-850 rounded-2xl p-8 text-center space-y-5">
                    <div className="w-14 h-14 rounded-full bg-indigo-950 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/25 shadow-inner">
                      <Compass className="w-6 h-6" />
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="text-sm font-bold text-white">결과물 시네마틱 모드 활성화 대기 중</h4>
                      <p className="text-[11px] text-gray-400 max-w-xs mx-auto leading-relaxed">
                        왼쪽 레시피 제조대에서 각 배합 성분을 조율한 후 하단의 <strong className="text-indigo-400">대본 생성 시작⚡</strong> 단추를 클릭하세요. 최상위 0.1% 클릭률과 시청지속시간을 정벌하는 솔루션이 나옵니다.
                      </p>
                    </div>

                    <div className="bg-gray-950 p-4 rounded-xl border border-gray-850/80 text-left space-y-3">
                      <h5 className="text-[11px] font-bold text-gray-300">💡 미리 세팅된 대박 배합 프리셋으로 즉시 테스트:</h5>
                      <div className="space-y-2">
                        {presets.map((preset, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleLoadPreset(preset)}
                            className="w-full bg-slate-900/60 hover:bg-slate-900 text-gray-300 text-left p-3 rounded-lg border border-gray-850 cursor-pointer block text-xs hover:border-indigo-500 transition-all"
                          >
                            <span className="font-bold text-indigo-400 block mb-0.5">{preset.name}</span>
                            <span className="text-[10px] text-gray-500">{preset.subtitle}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* REAL TROJAN HOUSE RESULTS */}
                {synthesisResult && (
                  <div className="space-y-6 animate-fade-in">

                    {/* Gemini API Quota Fallback Alert */}
                    {synthesisResult.quotaExceededFallback && (
                      <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-4 flex items-start justify-between gap-3 text-left animate-pulse mb-2">
                        <div className="flex gap-3 items-start">
                          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0 mt-0.5 font-bold text-base">
                            🚨
                          </div>
                          <div>
                            <span className="text-xs font-bold text-rose-300 block">제미나이 429 무료 쿼터 장벽 안내: '로컬 비상 맞춤 기획기' 가동 중</span>
                            <p className="text-[10px] text-gray-300 leading-normal mt-1">
                              현재 Gemini API의 무료 일일 할당량(Quota Exceeded)이 모두 확보 소진 상태입니다. 
                              기획서 제작이 실패하지 않도록 <strong>'초정밀 로컬 구조 기획자'</strong>가 대체 투입되었습니다. 
                              귀하가 입력하신 대중성 결핍 주제(<strong>"{painPoint}"</strong>)와 영혼 스토리 소재(<strong>"{customStorySourcing ? (customStorySourcing.length > 50 ? customStorySourcing.slice(0, 48) + "..." : customStorySourcing) : ""}"</strong>)가 온전히 수려하게 융합 반영된 고품질 한영 데모 대본 및 글로벌 전술 가이드 세트가 안전하게 조각 생성되었습니다!
                            </p>
                            <p className="text-[10px] text-gray-500 leading-normal mt-1.5 leading-relaxed">
                              💡 <strong>추후 조치 방법:</strong> 보통 1분 뒤에 리셋되어 다시 정상 dynamic AI 조회가 가능해집니다. 또는 더 자유롭고 한도가 높은 나만의 API 키를 활용하고 싶다면 수 분 만에 설정 가능합니다. AI Studio 상단 메뉴 <strong>Settings &gt; Secrets</strong>에서 <code>GEMINI_API_KEY</code>를 추가 등록해 보십시오!
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Top Vision Banner */}
                    <div className="bg-gradient-to-r from-indigo-950/40 to-slate-900 border border-indigo-500/20 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center justify-between border-b border-indigo-900/40 pb-2">
                        <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">0.1% 트로이 목마 최종 장르 비전</span>
                        <span className="text-[10px] text-emerald-400 font-bold font-mono">성공 적합비율 99.9%</span>
                      </div>
                      <h4 className="text-sm font-extrabold text-white">
                        🚀 비대칭 융합 3세대 채널 비전
                      </h4>
                      <p className="text-xs text-gray-300 leading-relaxed font-normal">
                        {synthesisResult.fusedGenreVision}
                      </p>
                    </div>

                    {/* Tabs on output container */}
                    <div className="flex bg-gray-900 p-1 rounded-xl border border-gray-850">
                      <button
                        onClick={() => setActiveTabResult("script")}
                        className={`flex-1 py-2 text-center text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          activeTabResult === "script" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        완작 영한 대본 🎬
                      </button>
                      <button
                        onClick={() => setActiveTabResult("pipeline")}
                        className={`flex-1 py-2 text-center text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          activeTabResult === "pipeline" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        공정 & 시리즈 📦
                      </button>
                      <button
                        onClick={() => setActiveTabResult("seo")}
                        className={`flex-1 py-2 text-center text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          activeTabResult === "seo" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        제목 & 썸네일 🖼️
                      </button>
                      <button
                        onClick={() => setActiveTabResult("prompt")}
                        className={`flex-1 py-2 text-center text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          activeTabResult === "prompt" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        자동화 프롬프트 ⚡
                      </button>
                    </div>

                    {/* Output Screen Content */}
                    
                    {/* SubTab 1: Complete Dual-Lang Pilot Script */}
                    {activeTabResult === "script" && (
                      <div className="space-y-4">
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                          <div>
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                              <Play className="w-3.5 h-3.5 fill-emerald-400 animate-pulse" /> 씬 바이 씬 시네마틱 오 오리지널 극본
                            </span>
                            <h4 className="text-sm font-black text-white mt-1">
                              실제 녹음/편집용 Pilot 고품격 대본 전시장
                            </h4>
                          </div>

                          <div className="bg-slate-900/50 p-3 rounded-lg border border-gray-850 space-y-2">
                            <span className="text-[10px] text-gray-500 block">⏱️ [오프닝 45초 앵커링 연출]:</span>
                            <p className="text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed italic">
                              {synthesisResult.mergedStoryboardHook}
                            </p>
                          </div>

                          <div className="text-xs text-gray-300 leading-relaxed font-mono whitespace-pre-wrap bg-gray-950 p-4 rounded-xl border border-gray-850 overflow-y-auto max-h-[360px]">
                            {synthesisResult.fusedDemoScriptEnKrDetail}
                          </div>
                        </div>

                        {/* Global Promotion Strategy under Script Tab for immediate help */}
                        <div className="bg-gradient-to-br from-slate-950 to-indigo-950/20 border border-indigo-500/10 rounded-2xl p-5 space-y-3">
                          <h4 className="text-xs font-black text-emerald-400 flex items-center gap-1.5 leading-none">
                            <Volume2 className="w-4 h-4 text-emerald-400" />
                            영알못 한국 크리에이터의 글로벌 0원 침몰/침투 비전
                          </h4>
                          <p className="text-xs text-gray-300 whitespace-pre-line leading-relaxed font-normal">
                            {synthesisResult.globalPromotionStrategy}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* SubTab 2: Production Pipeline and playlist expansion */}
                    {activeTabResult === "pipeline" && (
                      <div className="space-y-4">
                        {/* 72 Hour Micro pipeline */}
                        <div className="bg-slate-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                          <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5 uppercase">
                            <Award className="w-4 h-4" /> 72시간 내에 글로벌 품질 1인 마스터 공정
                          </h4>
                          <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line font-normal">
                            {synthesisResult.productionPipeline}
                          </p>
                        </div>

                        {/* Series Playlist Grid */}
                        <div className="space-y-3">
                          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block pl-1">
                            연달아 촬영할 추천 3회분 차기 에피소드
                          </h4>
                          
                          {synthesisResult.seriesPlaylist?.map((item: any, idx: number) => (
                            <div key={idx} className="bg-slate-900/40 border border-gray-850 hover:border-indigo-500/20 transition-all rounded-xl p-4 space-y-3.5">
                              <div className="flex items-center justify-between border-b border-gray-900 pb-1.5">
                                <span className="text-[10px] font-mono text-indigo-400 font-bold bg-indigo-950 px-2 py-0.5 rounded border border-indigo-900/30">
                                  Track.{idx + 1}
                                </span>
                                <span className="text-[10px] text-gray-500">조회수 장기 축적형</span>
                              </div>

                              <div>
                                <h5 className="text-xs font-bold text-white mb-1">
                                  {item.title}
                                </h5>
                                <p className="text-[11px] text-gray-400 leading-relaxed font-normal">
                                  {item.description}
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[10px] pt-2 border-t border-gray-900/50">
                                <div className="bg-gray-950/40 p-2 rounded">
                                  <span className="text-indigo-400 block font-bold mb-0.5">🎨 시각 연출:</span>
                                  <span className="text-gray-400 leading-normal">{item.visualDirection}</span>
                                </div>
                                <div className="bg-gray-950/40 p-2 rounded">
                                  <span className="text-emerald-400 block font-bold mb-0.5">⏱️ 오디오 페이스:</span>
                                  <span className="text-gray-400 leading-normal">{item.pacingDirection}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Avoid Copycat Danger */}
                        <div className="bg-slate-950 border border-amber-500/10 p-4.5 rounded-xl space-y-2">
                          <h5 className="text-[10px] font-bold text-amber-300 uppercase tracking-widest flex items-center gap-1">
                            ⚠️ 짝퉁 아류작(Derivative copy) 탈출 생존율 백신 공식
                          </h5>
                          <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line font-normal">
                            {synthesisResult.antiDerivativeFormula}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* SubTab 3: Video Titles & Highly visual Mock Card */}
                    {activeTabResult === "seo" && (
                      <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/20 rounded-2xl p-5 space-y-4">
                        <span className="text-[10px] uppercase font-bold text-indigo-300 block tracking-widest border-b border-indigo-900 pb-1.5">
                          📺 AI 썸네일 처방전 및 노출 메타태그
                        </span>

                        {/* Youtube Thumbnail Mock Visual */}
                        <div className="bg-gray-950 aspect-video rounded-xl overflow-hidden border border-gray-850 relative group flex items-center justify-center p-4">
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20 z-10"></div>
                          
                          <div className="absolute inset-0 flex items-center justify-center text-center opacity-5">
                            <Compass className="w-24 h-24 text-indigo-500 animate-spin" style={{ animationDuration: '30s' }} />
                          </div>

                          <div className="z-20 text-center space-y-3 max-w-sm">
                            <span className="bg-red-650 bg-red-600 text-white text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded shadow">
                              초밀착 관계심리학 경고
                            </span>
                            <h5 className="text-lg md:text-xl font-black text-amber-300 leading-snug drop-shadow-md select-all text-center">
                              “{synthesisResult.seoThumbnailCombination?.thumbnailCopy}”
                            </h5>
                            <p className="text-[9px] text-gray-400 italic">
                              (파스텔톤 수묵 연필화 고선명 자막 썸네일 예제)
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3.5 text-xs">
                          <div className="bg-gray-950/60 p-3 rounded-lg border border-gray-850 space-y-1">
                            <span className="text-[10px] text-gray-500 block">🔔 유튜브 업로드 최종 최적 타이틀 제목:</span>
                            <p className="font-bold text-white leading-relaxed select-all">
                              {synthesisResult.seoThumbnailCombination?.videoTitle}
                            </p>
                          </div>

                          <div className="bg-gray-950/60 p-3 rounded-lg border border-gray-850 space-y-1">
                            <span className="text-[10px] text-gray-500 block">🔍 알고리즘 SEO 유효 검색 메타 해시태그:</span>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {synthesisResult.seoThumbnailCombination?.recommendedKeywords?.map((tag: string, idx: number) => (
                                <span key={idx} className="bg-indigo-950 text-indigo-300 text-[10px] px-2 py-0.5 rounded border border-indigo-900/40">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SubTab 4: Copyable ChatGPT API Prompt */}
                    {activeTabResult === "prompt" && (
                      <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between border-b border-indigo-900/30 pb-2.5">
                          <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />
                            영상을 100개 무한으로 뱉는 대본 생성기 프롬프트
                          </span>
                          
                          <button
                            onClick={() => handleCopyText(synthesisResult.copyableKoreanPromptTemplate)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                              promptCopied 
                                ? "bg-emerald-600 text-white" 
                                : "bg-indigo-600 hover:bg-indigo-550 text-white"
                            }`}
                          >
                            {promptCopied ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                <span>복사완료!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>복사하기</span>
                              </>
                            )}
                          </button>
                        </div>

                        <p className="text-xs text-gray-300 leading-normal">
                          아래의 세부 지시문 뼈대를 복사하여 ChatGPT(GPT-4o), Claude 3.5 Sonnet 등에 붙여넣고 내 고유 사연만 번갈아 넣으십시오! 본 융합 공식을 반영해 감수성과 냉소가 번갈아 뒤통수를 때리는 오리지널 영한 극 대본이 무한대로 출력됩니다.
                        </p>

                        <pre className="text-[10px] font-mono text-gray-400 bg-gray-950 p-3.5 rounded-lg border border-gray-850 whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed select-all">
                          {synthesisResult.copyableKoreanPromptTemplate}
                        </pre>
                      </div>
                    )}

                  </div>
                )}

              </div>

            </div>

          </div>
        )}

        {/* TAB 2: BENCHMARK CHANNEL MODEL REFERENCE LIST */}
        {activeTab === "library" && (
          <div className="space-y-6 animate-fade-in" id="library-reference-view">
            
            <div className="bg-slate-900/40 rounded-2xl border border-gray-850 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1 max-w-3xl">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">글로벌 무기 창고</span>
                <h3 className="text-xl font-bold text-white">성공 모델 채널 레퍼런스 및 극비 침례 병기 분석</h3>
                <p className="text-xs text-gray-400 leading-relaxed font-normal">
                  우리가 베껴야 할 대상은 겉보기 인트로 영상 소스가 아닙니다. 그들이 어떠한 인간 본능의 결핍에서 질문을 꺼내며(껍질), 어떻게 묵직하고 심오한 학문이나 사색으로 감정을 위로하는지(알맹이) 그 정수를 이해하십시오.
                </p>
              </div>
            </div>

            {/* Symmetrical Reference details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Category 1: Psych2Go (Innocent Shell) */}
              <div className="bg-slate-900/30 border border-indigo-500/20 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-gray-855 pb-3 border-gray-800">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-500/20 text-center inline-block">
                      1. 대중적 외각 껍데기
                    </span>
                    <h4 className="text-lg font-black text-white mt-1">Psych2Go (구독자 1,120만명)</h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">대중화율 100%</span>
                </div>

                <div className="space-y-4 text-xs leading-relaxed">
                  <div className="bg-gray-950/60 p-3.5 rounded-xl space-y-1 border border-gray-850">
                    <span className="text-indigo-300 font-bold block">🎯 극강의 대중적인 비주얼 & Hook</span>
                    <p className="text-gray-400 font-normal">
                      시청자들이 밤새 스마트폰을 뒤적이며 누워 있을 때 느끼는 '일상적인 고독, 연애의 조마조마함, 우울 증조, 번아웃' 등 지극히 내적인 고민에서 시나리오를 설계합니다. "이거 딱 나인데?" 하고 누르게 만드는 귀가 간지러운 대중 유인책이 핵심입니다.
                    </p>
                  </div>

                  <div className="bg-gray-950/60 p-3.5 rounded-xl space-y-1 border border-gray-850">
                    <span className="text-indigo-300 font-bold block">🎨 무해성 극상의 2D 애니메이션</span>
                    <p className="text-gray-400 font-normal">
                      둥글둥글하고 말랑말랑한 흰 캐릭터가 우물쭈물 눈물지으며 이불을 뒤집어쓰고 있는 비주얼을 배치해, 자칫 학술적이거나 위축될 수 있는 우울한 고뇌를 극강으로 부드럽고 다정하게 감싸 안는 마법의 무기입니다.
                    </p>
                  </div>

                  <div className="bg-gray-950/60 p-3.5 rounded-xl space-y-1.5 border border-gray-850">
                    <span className="text-indigo-300 font-bold block">⚙️ 템플릿화 에셋 효율 비결</span>
                    <p className="text-gray-400 font-normal">
                      캐릭터의 감정 표정별 바디 팩(Angry, Sad, Crying, Shy)을 수백 종 미리 구축해 두고 성우 나레이션에 따라 프레임 안에 순차 배열하여 수다 떨듯 흔들림만 줌으로써 1인 크리에이터 급의 초스피드 양산 공정을 지녔습니다.
                    </p>
                  </div>
                  
                  {/* Prefill matching configurations */}
                  <div className="pt-2">
                    <button
                      onClick={() => handleLoadPreset({
                        painPoint: "착한 아이 증후군 / 만성적 관계 피로 (People-pleasing Trap)",
                        accessibilityTopic: "남들 눈치 보느라 정작 자신을 조용히 소멸시키는 착한 사람들의 3가지 비밀",
                        innocentShellVisual: "동글동글하며 웅크린 캐릭터 일러스트 (Psych2Go 무해 감성)",
                        intellectualDepth: "니체의 '노예 도덕'과 타인을 굳이 사랑해야 한다는 현대인의 슬픈 구도",
                        voiceTone: "차분하고 다정하지만 시니컬이 섞인 알랭드보통 풍 나레이션",
                        cynicalWitLevel: "50% (조금 씁쓸한)",
                        customStorySourcing: "평생을 착하게 살았지만 결국 주변인들에게 가십거리로 소외당하는 이들의 지친 자존감을 즉각 자극해 구출하는 법",
                        targetNiche: "소심하고 다정한 내향인들",
                        videoLength: "미드폼 6분",
                        soundMusicStyle: "정적인 첼로음 + 빗소리 효과음"
                      })}
                      className="w-full bg-indigo-600 hover:bg-indigo-550 text-white font-bold py-2 px-4 rounded-xl text-center text-xs cursor-pointer block hover:-translate-y-0.5 transition-all shadow"
                    >
                      이 채널의 대중성 껍데기 세팅 주입하기 →
                    </button>
                  </div>
                </div>
              </div>

              {/* Category 2: The School of Life (Intellectual Depth) */}
              <div className="bg-slate-900/30 border border-emerald-500/25 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-gray-855 pb-3 border-gray-800">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/20 text-center inline-block">
                      2. 심오한 사색의 알맹이
                    </span>
                    <h4 className="text-lg font-black text-white mt-1">The School of Life (구독자 880만명)</h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-indigo-400">지적 깊이도 100%</span>
                </div>

                <div className="space-y-4 text-xs leading-relaxed font-normal">
                  <div className="bg-gray-950/60 p-3.5 rounded-xl space-y-1 border border-gray-850">
                    <span className="text-emerald-300 font-bold block">🧠 인문학 / 철학적 성찰 (Status Anxiety)</span>
                    <p className="text-gray-400 font-normal">
                      단순히 "이러면 우울증입니다"라는 1차원적인 체크리스트를 던지지 않습니다. 그 불안과 고단의 원류를 쇼펜하우어, 사르트르, 프로이트, 또는 낭만주의의 역사적 왜곡과 긴밀히 엮어 인간 고독 수용의 세련된 이론을 제창합니다.
                    </p>
                  </div>

                  <div className="bg-gray-950/60 p-3.5 rounded-xl space-y-1 border border-gray-850">
                    <span className="text-emerald-300 font-bold block">🎭 알랭 드 보통 식 냉소적 위트 (Black Humor)</span>
                    <p className="text-gray-400 font-normal">
                      성우의 정갈하고 차분한 영국 신사 발음을 토대로 차갑고 건조한(dry) 냉소를 읊조립니다. 현대인의 허영 가식, 집착을 비추는 촌철살인의 고독한 위로를 전달함으로써 극상의 시청 지속 잠금(Retention)이 벌어집니다.
                    </p>
                  </div>

                  <div className="bg-gray-950/60 p-3.5 rounded-xl space-y-1.5 border border-gray-850">
                    <span className="text-emerald-300 font-bold block">🎨 세련되고 투박한 라인아트 비주얼</span>
                    <p className="text-gray-400 font-normal">
                      유치한 대중 카툰 백터 소스가 아닌, 잉크 텍스처나 투박하고 빈티지한 손그림 선(Lineart), 미드센추리 컬러칩 사색으로 디자인 격을 수직 조절해 어른들을 위한 한 편의 우아한 에세이집 같은 무드를 연출합니다.
                    </p>
                  </div>
                  
                  {/* Prefill matching configurations */}
                  <div className="pt-2">
                    <button
                      onClick={() => handleLoadPreset({
                        painPoint: "지독한 무기력증과 전형적인 번아웃 (Chronic Burnout & Lethargy)",
                        accessibilityTopic: "번아웃이라 자책하는 산만한 영혼들의 굳어버린 뇌세포를 회복하는 뇌과학",
                        innocentShellVisual: "거친 연필 선과 잉크 텍스처를 얹은 우울한 어른의 고독 명상",
                        intellectualDepth: "쇼펜하우어의 '고독을 친구 삼아 내 영혼의 고유한 품격을 사모하는 법'과 인간 고통의 실존적 본질",
                        voiceTone: "차분하고 냉소적인 수필 도슨트 목소리",
                        cynicalWitLevel: "80% (강한 블랙 유머)",
                        customStorySourcing: "소셜 미디어와 무한 경쟁 기싸움에 뇌의 전두엽을 저격당해 정서 소진된 현대 이들에게 실존적 도파민 단식과 무사색을 복원하는 기품있는 도립 명상처세",
                        targetNiche: "현 사회의 가식을 관통하는 팩트 조언을 필요로 하는 전 연령층",
                        videoLength: "시네마틱 에세이 8분대",
                        soundMusicStyle: "슬픈 실내악 첼로 독주 고해상도 음감"
                      })}
                      className="w-full bg-indigo-600 hover:bg-indigo-550 text-white font-bold py-2 px-4 rounded-xl text-center text-xs cursor-pointer block hover:-translate-y-0.5 transition-all shadow"
                    >
                      이 채널의 명품 사색 핵심 주입하기 →
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* General Advice warning */}
            <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-950 border border-indigo-500/30 text-indigo-400 shrink-0">
                <Award className="w-5 h-5 text-indigo-400" />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                💡 <strong>최전문가 팁:</strong> 양 채널의 결합은 단순한 리포트 뽑기에서 종식되지 않습니다. 이 시스템을 통해 생성된 대본을 복사해 다국어 음성 AI 비디오(ElevenLabs)로 가공하고, 사릿한 연필 마킹 음향과 함께 미니멀 일러스트를 결합하여 업로드하면 영어와 한국어 채널 시장에 동시에 강력한 충격을 파생할 수 있습니다.
              </p>
            </div>

          </div>
        )}

      </main>

      {/* Dynamic YouTube In-App Video Player modal */}
      {activePlayVideo && (() => {
        const isReal = searchResult?.isRealData;
        const activeVideoUrl = `https://www.youtube.com/watch?v=${activePlayVideo.id}`;

        const getEmbedId = (video: any) => {
          if (!video || !video.id) return "vo4pMVb0R6M";
          const isRealIdFormat = /^[a-zA-Z0-9_-]{11}$/.test(video.id);
          if (isRealIdFormat && !video.id.toLowerCase().includes("mock") && !video.id.toLowerCase().includes("video")) {
            return video.id;
          }
          const fallbackIds = [
            "vo4pMVb0R6M",
            "n3Xv_g3g-gY",
            "3kbKguS7_C4",
            "c0KYU2j0TM4",
            "hFV71QPvX2I",
            "aircAruvnKk"
          ];
          let hash = 0;
          const str = video.title || video.id;
          for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
          }
          const index = Math.abs(hash) % fallbackIds.length;
          return fallbackIds[index];
        };

        const embedId = getEmbedId(activePlayVideo);
        const isEmbedIdReal = embedId === activePlayVideo.id;

        return (
          <div 
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in"
            id="video-player-modal-overlay"
            onClick={() => setActivePlayVideo(null)}
          >
            <div 
              className="bg-slate-900 border border-indigo-500/20 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl shadow-indigo-500/15 text-left relative flex flex-col max-h-[90vh]"
              id="video-player-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-slate-950/50 shrink-0">
                <div className="flex items-center gap-2 max-w-[85%]">
                  <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold ${
                    isReal && isEmbedIdReal
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                      : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-widest animate-pulse"
                  }`}>
                    {isReal && isEmbedIdReal ? "API LIVE REPLAY 📺" : "AI TREND REPLAY 📊"}
                  </span>
                  <span className="text-xs font-bold text-white truncate block select-none">
                    {activePlayVideo.title}
                  </span>
                </div>
                <button 
                  onClick={() => setActivePlayVideo(null)}
                  className="text-gray-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg transition-all active:scale-90 cursor-pointer"
                  title="닫기"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Container for Video + AI Analysis details */}
              <div className="overflow-y-auto flex-1 bg-slate-950">
                {/* Video Player Display: Always active now using real YouTube ID! */}
                <div className="aspect-video w-full bg-black relative">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${embedId}?autoplay=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                    title={activePlayVideo.title}
                    className="absolute inset-0 w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  ></iframe>
                </div>

                {/* Embed Safe Playback Tip Banner */}
                <div className="bg-slate-900 border-b border-gray-850 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-400">
                  <span className="flex items-start sm:items-center gap-2 leading-relaxed">
                    <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0 mt-1 sm:mt-0"></span>
                    <span>💡 <strong>임베디드 자동 보완 모드 활성화:</strong> 브라우저 보안 또는 특정 원본 동영상의 외부 퍼가기 금지 조치로 인해 화면이 회색으로 뜨거나 재생이 차단될 수 있습니다. 이 경우 아래의 <strong>[유튜브 시청 ↗]</strong>를 누르시면 원본 사이트로 이동해 해결됩니다.</span>
                  </span>
                  <span className="text-[10px] bg-slate-800 text-indigo-300 font-bold px-2 py-1.5 rounded select-none font-mono self-start sm:self-auto uppercase tracking-wide">
                    Embed Assist Active
                  </span>
                </div>

                {/* Trojan Horse Marketing Intelligence Section: Always displayed below the player for a seamless reading experience */}
                {activePlayVideo.analysis && (
                  <div className="p-5 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 space-y-4 text-left border-t border-gray-850">
                    {/* Top Header Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="inline-flex self-start items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-black tracking-widest uppercase">
                        ⚡ {isReal ? "REAL-TIME BENCHMARK INTELLIGENCE ANALYZER" : "AI SIMULATING HIGH-FI TREND MODEL"}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {isReal ? "데이터 출처: YouTube Live Data Stream" : "데이터 출처: High-Fidelity 벤치마크 모델링"}
                      </span>
                    </div>

                    {/* Body analysis stats in beautiful visual list */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-900/60 border border-gray-850 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-indigo-400 block flex items-center gap-1">
                            🥚 대중성 외갑 (Psych2Go 쉘)
                          </span>
                          <p className="text-[11px] text-gray-300 leading-relaxed font-normal">
                            {activePlayVideo.analysis.psy2goShell}
                          </p>
                        </div>

                        <div className="p-3 bg-slate-900/60 border border-gray-850 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-emerald-400 block flex items-center gap-1">
                            🧠 지적 깊이 (인생학교 알맹이)
                          </span>
                          <p className="text-[11px] text-gray-300 leading-relaxed font-normal">
                            {activePlayVideo.analysis.schoolOfLifeCore}
                          </p>
                        </div>

                        <div className="p-3 bg-slate-900/60 border border-gray-850 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-pink-400 block flex items-center gap-1">
                            🎭 냉소성찰 & 블랙위트
                          </span>
                          <p className="text-[11px] text-gray-300 leading-relaxed font-normal">
                            {activePlayVideo.analysis.cynicalWitPoint}
                          </p>
                        </div>

                        <div className="p-3 bg-indigo-900/15 border border-indigo-500/15 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-amber-300 block flex items-center gap-1">
                            🔥 초격차 리메이크 처방
                          </span>
                          <p className="text-[11px] text-gray-200 leading-relaxed font-medium">
                            {activePlayVideo.analysis.trojanRemakeTip}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Notification Guide */}
                    <div className="text-[10px] text-gray-500 font-normal border-t border-gray-900/50 pt-3">
                      💡 <strong>기획자 처방전 안내:</strong> 이 카드의 4가지 핵심 분석 요소들은 단순한 전시 텍스트가 아닙니다. <strong>[대본 연동 ⚡]</strong> 클릭 시, 이 분석 요소들이 인지과학에 맞춰 융합 가공되어 <strong>대본의 인트로 훅킹 장치와 실시간 A/B 테스트 기획대</strong>에 반영됩니다.
                    </div>
                  </div>
                )}
              </div>

              {/* Video Meta Stats Footer */}
              <div className="p-4 bg-slate-950 border-t border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-400 leading-normal shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-200">{activePlayVideo.channelTitle}</span>
                  <span className="text-gray-700">|</span>
                  <span>조회수 {activePlayVideo.viewCount}회</span>
                  <span className="text-gray-700">|</span>
                  <span>구독자 {activePlayVideo.subscriberCount}명</span>
                  <span className="text-gray-700">|</span>
                  <span>비디오 길이: {activePlayVideo.duration}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleLinkClick(`https://www.youtube.com/watch?v=${embedId}`)}
                    className="bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/30 text-indigo-300 font-bold px-3 py-1.5 rounded-lg transition-all text-[10px] active:scale-95 cursor-pointer flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>주소 복사</span>
                  </button>
                  <a
                    href={`https://www.youtube.com/watch?v=${embedId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-slate-850 hover:bg-gray-800 border border-gray-750 text-white font-bold px-3 py-1.5 rounded-lg transition-all text-[10px] active:scale-95 cursor-pointer flex items-center gap-1"
                  >
                    <span>유튜브 시청 ↗</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      
      {/* Absolute Minimal Footer in adherence spacing rule */}
      <footer className="border-t border-gray-900 bg-gray-950/60 py-4 text-center mt-auto text-xs text-gray-500">
        <p className="font-normal select-none">© 2026 Trojan Horse Scriptwriting Studio. Created with high-fidelity Gemini 3.5-Flash.</p>
      </footer>
    </div>
  );
}
