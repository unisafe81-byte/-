export interface BenchmarkChannel {
  id: string;
  name: string;
  subscribers: string;
  conceptType: string;
  niche: string;
  whyPeopleLove: string;
  pattern: {
    hook: string;
    body: string;
    outro: string;
  };
  contentExpansion: string[];
  thumbnailAndTitle: {
    structure: string;
    trick: string;
  };
  durationAndPace: string;
  first30Seconds: string;
  seoKeywords: string[];
  visualAesthetic: string;
  editingEfficiency: string;
  audioDesign: string;
  pinnedComment: string;
  communityTab: string;
  realVideos?: Array<{
    title: string;
    views: string;
    duration: string;
    analysis: string;
  }>;
}

export interface UserDraft {
  channelName: string;
  conceptType: string;
  coreTarget: string;
  viewerMotivation: string;
  videoFormat: string;
  hookStrategy: string;
  thumbnailApproach: string;
  visualAesthetic: string;
  sfxBgmTone: string;
  commentInteractive: string;
  communityPlan: string;
}

export interface AnalysisResponse {
  score: {
    substance: number;
    algorithm: number;
    visual: number;
    fandom: number;
  };
  overallFeedback: string;
  conceptFeedback: {
    strengths: string[];
    improvements: string[];
  };
  hookSuggestion30s: string;
  thumbnailTitleCombination: Array<{
    thumbnailText: string;
    videoTitle: string;
    psychologicalTrigger: string;
  }>;
  expansionIdeas: string[];
  visualAestheticAdvice: string;
  communityEnrichment: string;
}

export interface FusionAnalysisResponse {
  quotaExceededFallback?: boolean;
  fusedGenreVision: string;
  antiDerivativeFormula: string;
  mergedStoryboardHook: string;
  seriesPlaylist: Array<{
    title: string;
    description: string;
    visualDirection: string;
    pacingDirection: string;
  }>;
  productionPipeline: string;
  seoThumbnailCombination: {
    thumbnailCopy: string;
    videoTitle: string;
    recommendedKeywords: string[];
  };
  copyableKoreanPromptTemplate: string; // 타 AI(ChatGPT 등)에 즉각 활용 가능한 한글로 설명된 결합 기획 프롬프트 템플릿
  fusedDemoScriptEnKrDetail: string;   // 영문 대사 + 한글 번역 + 연출 지시가 포함된 씬 바이 씬 완성형 데모 스크립트
  globalPromotionStrategy: string;     // 영어를 모르는 한국인을 위한 마켓 진입 가이드와 대안
  psych2goPrompt?: string;
  psych2goScript?: string;
  schoolOfLifePrompt?: string;
  schoolOfLifeScript?: string;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnail: string;
  viewCount: string;
  likeCount: string;
  subscriberCount: string;
  viewToSubRatio: string;
  duration: string;
  publishedAt: string;
  analysis: {
    psy2goShell: string;
    schoolOfLifeCore: string;
    cynicalWitPoint: string;
    trojanRemakeTip: string;
  };
}

export interface YouTubeSearchResponse {
  isRealData: boolean;
  quotaExceededFallback?: boolean;
  searchSummary: string;
  opportunityFormula: string;
  videos: YouTubeVideo[];
  youtubeError?: string | null;
  effectiveQuery?: string;
  wasTranslated?: boolean;
  translationNote?: string | null;
  requestedCount?: number;
}

export interface ABPlanResponse {
  quotaExceededFallback?: boolean;
  titleA: { title: string; enTitle?: string; trigger: string; style: string };
  titleB: { title: string; enTitle?: string; trigger: string; style: string };
  titleC: { title: string; enTitle?: string; trigger: string; style: string };
  titleD: { title: string; enTitle?: string; trigger: string; style: string };
  thumbnailA: { concept: string; midjourneyPrompt: string; style: string };
  thumbnailB: { concept: string; midjourneyPrompt: string; style: string };
  thumbnailC: { concept: string; midjourneyPrompt: string; style: string };
  thumbnailD: { concept: string; midjourneyPrompt: string; style: string };
  strategyAnalysis: string;
}

export interface MasterScriptResponse {
  quotaExceededFallback?: boolean;
  sourceCoveragePlan: string;
  psych2goScript: string;
  schoolOfLifeScript: string;
}

export interface ChannelAnalyticsItem {
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  country: string;
  category: string;
  grade: string;
  gradeScore: number;
  estimatedGrowthRate: string;
  geminiInsight: string;
  channelUrl: string;
  publishedAt: string;
  lastUploadDate?: string;
  uploadFrequency?: string;
  isMonetizable?: boolean;
}

export interface ChannelAnalyticsResponse {
  isRealData: boolean;
  totalAnalyzed: number;
  channels: ChannelAnalyticsItem[];
  searchSummary: string;
}

export interface VideoSearchItem {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  durationSeconds: number;
  durationLabel: string;
  publishedAt: string;
  isShort: boolean;
}

export interface VideoSearchResponse {
  isRealData: boolean;
  totalAnalyzed: number;
  videos: VideoSearchItem[];
  searchSummary: string;
}
