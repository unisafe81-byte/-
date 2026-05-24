import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

app.use(express.json());

// Lazy-initialized Gemini Client helper with support for client-supplied keys
function getGeminiClient(customKey?: string): GoogleGenAI {
  const key = (customKey && customKey.trim() !== "") ? customKey : process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY environment variable is missing and no custom key was provided. Please configure it in Settings > Secrets or enter one in the Gemini API Key input field.");
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

function getYouTubeKey(customKey?: string): string | undefined {
  return customKey && customKey.trim() !== "" ? customKey.trim() : process.env.YOUTUBE_API_KEY;
}

function parseGeminiJson(text?: string): any {
  const raw = text || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
}

function formatCompactNumber(value: string | number | undefined): string {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0";
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}

function parseIsoDuration(duration = "PT0S"): string {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "0:00";
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const parts = hours > 0
    ? [hours, String(minutes).padStart(2, "0"), String(seconds).padStart(2, "0")]
    : [minutes, String(seconds).padStart(2, "0")];
  return parts.join(":");
}

function normalizeResultLimit(value: any): number {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 5;
  return Math.min(parsed, 50);
}

function buildFallbackVideos(query: string, count = 5): any[] {
  const baseTitle = query || "psychology content strategy";
  const templates = [
    {
      title: `Why ${baseTitle} quietly changes how people see themselves`,
      channelTitle: "Psychology Strategy Model",
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      viewCount: "820K",
      likeCount: "31K",
      subscriberCount: "1.2M",
      viewToSubRatio: "68%",
      duration: "6:40",
      publishedAt: new Date().toISOString(),
      analysis: {
        psy2goShell: "Soft everyday empathy hook with a simple emotional symptom list.",
        schoolOfLifeCore: "Reframes private discomfort as a universal human contradiction.",
        cynicalWitPoint: "Gentle irony about pretending to be fine while optimizing every tiny interaction.",
        trojanRemakeTip: "Open with a harmless daily scene, then reveal the deeper identity wound underneath."
      }
    },
    {
      title: `The hidden pattern behind ${baseTitle}`,
      channelTitle: "Human Behavior Lab",
      thumbnail: "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg",
      viewCount: "410K",
      likeCount: "18K",
      subscriberCount: "640K",
      viewToSubRatio: "64%",
      duration: "8:12",
      publishedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      analysis: {
        psy2goShell: "Accessible sign-based framing that feels immediately recognizable.",
        schoolOfLifeCore: "Turns the topic into a broader meditation on belonging and self-protection.",
        cynicalWitPoint: "A dry observation about how modern confidence is often just better packaging.",
        trojanRemakeTip: "Use a listicle surface, but make each point resolve into a poetic self-recognition beat."
      }
    }
  ];

  return Array.from({ length: normalizeResultLimit(count) }, (_, index) => {
    const template = templates[index % templates.length];
    return {
      ...template,
      id: `fallback-${index + 1}`,
      channelId: `fallback-channel-${(index % templates.length) + 1}`,
      title: index < templates.length ? template.title : `${template.title} - angle ${index + 1}`,
      publishedAt: new Date(Date.now() - 86400000 * index).toISOString()
    };
  });
}

function extractYouTubeVideoId(input: string): string | null {
  try {
    const value = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

    const url = new URL(value);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    const watchId = url.searchParams.get("v");
    if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) return watchId;

    const parts = url.pathname.split("/").filter(Boolean);
    const markerIndex = parts.findIndex((part) => ["embed", "shorts", "live"].includes(part));
    const pathId = markerIndex >= 0 ? parts[markerIndex + 1] : null;
    return pathId && /^[a-zA-Z0-9_-]{11}$/.test(pathId) ? pathId : null;
  } catch {
    return null;
  }
}

function hasKoreanText(value: string): boolean {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(value);
}

function fallbackTranslateSearchQuery(query: string): string {
  const normalized = query.trim();
  const dictionary: Record<string, string> = {
    "착한 아이 증후군": "people pleasing syndrome",
    "관계 피로": "relationship burnout",
    "무기력증": "emotional numbness and burnout",
    "외로움": "loneliness psychology",
    "불안": "anxiety psychology",
    "자존감": "self esteem psychology",
    "가스라이팅": "gaslighting psychology",
    "회피형": "avoidant attachment",
    "애착": "attachment theory",
    "우울": "depression psychology",
    "번아웃": "burnout psychology"
  };

  for (const [ko, en] of Object.entries(dictionary)) {
    if (normalized.includes(ko)) return en;
  }

  return `${normalized} psychology self improvement`;
}

async function getEffectiveSearchQuery(query: string, market: string, customGeminiApiKey?: string): Promise<{ query: string; translated: boolean; translationNote?: string }> {
  const cleanQuery = query.trim();
  if (market !== "US" || !hasKoreanText(cleanQuery)) {
    return { query: cleanQuery, translated: false };
  }

  const hasGeminiKey = (customGeminiApiKey && customGeminiApiKey.trim() !== "") || (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "");
  if (!hasGeminiKey) {
    return {
      query: fallbackTranslateSearchQuery(cleanQuery),
      translated: true,
      translationNote: "Used local fallback translation because Gemini API key is not configured."
    };
  }

  try {
    const ai = getGeminiClient(customGeminiApiKey);
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Translate this Korean YouTube psychology trend search query into a natural English query for the US/global YouTube market.
Return only the search query, no quotes and no explanation.
Korean query: ${cleanQuery}`
    });
    const translated = (response.text || "").replace(/^["']|["']$/g, "").trim();
    return {
      query: translated || fallbackTranslateSearchQuery(cleanQuery),
      translated: true,
      translationNote: translated ? "Translated by Gemini for US/global YouTube search." : "Used local fallback translation after empty Gemini response."
    };
  } catch (error: any) {
    return {
      query: fallbackTranslateSearchQuery(cleanQuery),
      translated: true,
      translationNote: `Used local fallback translation because Gemini translation failed: ${error?.message || "unknown error"}`
    };
  }
}

// Graceful Offline Fallback Generator for the Trojan Horse Planning & Script Engine in case of Gemini Quota limits (429)
function generateFusionFallback(body: any): any {
  const { 
    painPoint,
    accessibilityTopic,
    innocentShellVisual,
    intellectualDepth,
    voiceTone,
    cynicalWitLevel,
    customStorySourcing,
    targetNiche,
    videoLength,
    soundMusicStyle
  } = body;

  const topic = accessibilityTopic || painPoint || "나만 느끼는 예민하고 소외된 고독";

  return {
    quotaExceededFallback: true,
    fusedGenreVision: `[⚠️ 제미나이 AI 일일 한도(429 Quota Exceeded) 및 트래픽 폭주로 가동된 로컬 백업 지능 모형]\n\n귀하가 기획한 대중성 결핍 주제인 "${painPoint}"과(와) 인생학교식 사색 테마 "${intellectualDepth}"이 결합한 고품격 퓨전 심리 콘텐츠입니다. 겉면(Shell)은 '${innocentShellVisual || "귀엽고 무해한 2D 애니메이션"}' 스타일로 가볍고 상냥하게 다가가 클릭율을 극단적으로 높이고, 알갱이(Core)는 '${voiceTone || "차가운 런던 에세이 도슨트 성우"}' 톤의 시리도록 차가운 블랙 위트와 인문학 성찰 장치(${cynicalWitLevel || "중간 단계"})를 얹어 시청 지속시간을 사로잡는 제3세대 독보적인 에세이 장르입니다.`,
    
    antiDerivativeFormula: `1. 말랑말랑한 캐릭터들의 행동선 이면에 다크 블루/그레이의 고독한 명조 타이포그래피를 가볍게 교차 매칭하십시오.
2. 단순히 "우울 극복 팁 3가지" 나열을 엄격히 배제하고, "우리가 왜 타인의 기대에 평생 노예처럼 살 수밖에 없는지"라는 철학적 원류(프로이트, 아들러 등)를 도마 위에 올립니다.
3. 클릭률 폭격을 겨냥해 자극적이고 원초적인 썸네일 전면 문구와, 클릭 후에는 오히려 품위 넘치고 차가운 클래식 BGM(${soundMusicStyle || "쓸쓸한 첼로 반주"}) 반전 음향을 기획하십시오.`,
    
    mergedStoryboardHook: `[초반 45초 트로이 오프닝 장치]\n
- 0초~15초 (어린 양 가두리): "혹시 오늘도 사소한 일에 가슴이 쿵쾅거리고, 내 탓만 하며 뒤돌아 후회하진 않았나요?" 라며 문학적인 ${innocentShellVisual} 풍 캐릭터들의 슬픈 표정 교차.\n
- 15초~45초 (지적 오물투척 전환): "하지만 우리는 애초에 도달 불가능한 완전무결의 거울 연극을 해왔는지 모릅니다." 라며 고차원 묵직한 영국식 신사 톤 성우 리딩(${voiceTone})으로 화면 일러스트 채도 급다운 및 웅장한 클래식 오디오 연출.`,
    
    seriesPlaylist: [
      {
        title: `1화: "${topic}"의 늪에서 허우적대는 당신을 위한 자해 방지 가이드`,
        description: `착하게 굴면서 정작 스스로의 오리지널 영혼을 갈아먹는 대중적 슬픔의 역진을 성찰하는 런닝타임 ${videoLength || "7분"} 분량의 대본.`,
        visualDirection: `${innocentShellVisual || "파스텔 톤 2D 가이드"} 캐릭터 소스가 차분하게 울고 있으나, 비주얼 카메라가 거칠게 사각 필터로 줌아웃.`,
        pacingDirection: `고독한 피아노 타건 소리가 가만히 흐르는 가운데, 1.2배속 가량 빠른 템포의 상냥한 나레이션이 진행된 후 갑각적 정적.`
      },
      {
        title: `2화: 내가 늘 "${painPoint}"의 지옥을 자초해 걸어 들어갔던 무의식 설계도`,
        description: `어린 시절의 정서적 애착 결핍과 타인의 과잉 인정을 갈망하는 욕구의 비극적인 인과관계를 철학적으로 추적.`,
        visualDirection: `거친 연필 선화와 화이트보드 잉크 터치감이 번지는 미니멀하면서 쓸쓸한 화풍 채용.`,
        pacingDirection: `어조를 차분히 내린 중저음 음향 딜리버리와 정적인 명상 첼로가 잔잔하게 깔림.`
      },
      {
        title: `3화: 가스라이터에게 미움받을 수 있는 최고의 지적 방어수단`,
        description: `${targetNiche || "2030 영혼들"}에게 헌정하는 씁쓸한 블랙 위트 성격의 자존감 가변 전술 리포트.`,
        visualDirection: `눈이 극도로 편안한 단색 딥블루 바탕화면에 미드센추리 모던 컬러의 단출한 아이콘 배치.`,
        pacingDirection: `마치 알랭 드 보통의 실시간 런던 강연을 듣는 듯 지적이면서 시시콜콜하고, 냉소적인 성우의 유머러스한 리드미컬 조절.`
      }
    ],
    
    productionPipeline: `[단 72시간 만에 생산하는 초속성 1인 크리에이터 파이프라인]\n
1. 아래 기획안 하단의 [Claude / ChatGPT 만능 프롬프트 코드]를 복사합니다.\n
2. DeepL을 가동하여 영문 오디오 뉘앙스 검수 후, 가성비 최상인 ElevenLabs 영국 성우(성숙하고 시니컬한 어조)로 Voiceover MP3를 생성합니다.\n
3. Canva 및 CapCut의 미니멀 선화 애니메이션 비디오 템플릿에 맞추어 생성한 오디오 및 한국어 자막 번역을 병렬 결합하면 72시간 내 전 세계 자동 수출이 완료됩니다.`,
    
    seoThumbnailCombination: {
      thumbnailCopy: `착하게 굴면 버림받는다`,
      videoTitle: `${topic} 때문에 끊임없이 눈치 보고 상처받는 사람들을 관통하는 3가지 차가운 현실 심리학`,
      recommendedKeywords: ["인생학교 융합", "싸이투고", "예민함치유", "자존감", "불안"]
    },
    
    psych2goPrompt: `/*************************************************************************\n * [Psych2Go 감성 리스티클 스타일] 대본 제작 만능 자동화 프롬프트\n *************************************************************************/\n\n당신은 구독자 1200만 명의 심리학 애니메이션 채널 'Psych2Go'의 수석 대본 작가입니다. 다음 조건들을 참고하여, 시청자들의 마음을 따뜻하고 친근하게 위로하는 감성 리스티클 구조의 영한(English-Korean) 대본을 작성해 주세요.\n\n[기본 소재 및 조건]\n- 핵심 일상고민(결핍): \${painPoint}\n- 클릭 유도 한글 키워드: \${accessibilityTopic || "비밀스런 마음의 상처"}\n- 나의 고유 경험 및 이야기: \${customStorySourcing}\n- 시각 가이드라인: \Double 2D Pastel animation style\n\n[작성 구조 가이드라인]\n1. 공감 훅 (Empathy Hook): "Have you ever...?" 로 개별 시청자(You)의 마음을 파고들며 포근히 시작.\n2. 심리학적 권위: 심리학 연구 및 데이터(예: "Psychologists suggest", "Research on attachment theory")를 가미해 신뢰성 확보.\n3. 감성 리스티클: 번호 예고 미니 훅과 함께 일상의 징조들을 따스하고 조근조근 전개.\n4. 면죄부 장치 (Normalization): "You are not to blame" 메시지를 강력히 선언하여 치유 유도.\n5. 포근한 엔딩 및 소프트 CTA: 부담되지 않는 소박한 소통형 댓글 유인.\n\n[출력 포맷]\n각 씬 마다 [SCENE X: 비주얼 연출 (한글)], [SFX], [Voiceover (En)], [나레이터 (Korean)]의 정밀 4중 그리드 대칭형으로 작성.`,

    psych2goScript: `[SCENE 1: 공감의 따스한 문을 열며]\n*화면 묘사*: 동글둥글하고 따끈한 흰색 파스텔 캐릭터가 빗개인 밤, 작은 머그컵을 감싸 안고 소파에 가만히 웅크려 앉아 있는 서정적 손그림 일러스트.\n*SFX*: 보드라운 차 끓이는 수증기 김소리와 은은한 빗소리 폴리음.\n*Voiceover (En)*: "Have you ever found yourself staying up late at 3 AM, overthinking every single conversation you had today, wondering if you said something wrong?"\n*나레이터 (Korean)*: "혹시 오늘 밤도 새벽 3시에 홀로 깨어, 오늘 나눈 모든 대화들을 끝없이 되짚으며 '내가 무언가 잘못 말하진 않았을까' 스스로를 괴롭히고 계셨나요?"`,

    schoolOfLifePrompt: `/*************************************************************************\n * [The School of Life 철학 에세이 스타일] 대본 제작 만능 자동화 프롬프트\n *************************************************************************/\n\n당신은 구독자 900만 명의 지적·사색적 채널 'The School of Life(인생학교)'의 수석 도슨트이자 최고 작가입니다. 알랭 드 보통 특유의 한없이 지적이며, 우아하고, 씁쓸한 영국식 문학에세이 구조의 대본을 영한(English-Korean) 병렬 스타일로 집필해 주세요.\n\n[기본 소재 및 설계 지침]\n- 핵심 관전 포인트: 개별 시청자가 아닌 인류 역사 보편의 실존적 본성(We, Our, Us)을 주어로 고전.\n- 철학적 근거 명기: 쇼펜하우어, 세네카, 니체 등 명망 있는 사상가들의 현실 번역 및 인용 가미.\n- 냉소적 위트(Cynical Wit): "우리는 완벽할 수 없으며 본성이 나약하고 모순적"이라는 씁쓸한 관점의 전복(Reframe).\n- 평온 수용 엔딩: 얄팍한 즉각적 소통 처세술을 경멸하고, 결함과 외로움을 삶과 인류의 디폴트 값으로 수긍하도록 유도.\n\n[출력 포맷]\n씬 마다 [SCENE X: 기하학적 미니멀 연출 지시문 (한글)], [SFX], [Voiceover (En)], [나레이터 (Korean)]의 고밀도 대조 테이블 포맷 적용.`,

    schoolOfLifeScript: `[SCENE 1: 지적인 침묵의 역설]\n*화면 묘사*: 끝없는 무채색의 격자 눈금선 바탕 위에, 정면에 완벽한 원형의 단풍나무 나뭇잎이 하나 놓여 있는 런던 스타일의 미니멀 기하학 일러스트.\n*SFX*: 정적을 깨뜨리는 고결하고 차가운 단일 피아노 목조 타건 음향.\n*Voiceover (En)*: "We spend modern lives building immaculate facades of compliance, desperately hoping to be selected for affection, while carrying the devastating paradox of our internal exile."\n*나레이터 (Korean)*: "우리 현생의 인류는 사회적 인정이라는 이름의 매끄럽고 흠집 없는 위선적 껍데기들을 세우느라 평생의 에너지를 소진하지만, 그 이면에 정작 영혼의 지리멸렬한 고독과 고립이라는 참혹한 실존적 역설을 떠안고 살아갑니다."`
  };
}

// REST-API: Combine elements into the Trojan Horse Scriptwriting / Planning Methodology
app.post("/api/analyze-fusion", async (req, res) => {
  try {
    const { 
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
    } = req.body;

    if (!painPoint || !intellectualDepth || !customStorySourcing) {
      res.status(400).json({ 
        error: "트로이 목마 대본 기획을 위해 대중적 결핍(외갑), 인문학적 깊이(내장), 그리고 나만의 고유 소재 기입이 꼭 필요합니다." 
      });
      return;
    }

    const hasGeminiKey = (customGeminiApiKey && customGeminiApiKey.trim() !== "") || (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "");
    if (!hasGeminiKey) {
      console.warn("[Gemini API Info]: Live API key is not configured for fusion analysis. Automatically employing high-fidelity local AI fallback simulation.");
      const fallback = generateFusionFallback(req.body);
      res.json(fallback);
      return;
    }

    const ai = getGeminiClient(customGeminiApiKey);

    const prompt = `
      당신은 글로벌 1,200만 구독자 유튜브 매체의 수석 크리에이티브 디랙터이자 유튜브 알고리즘 트래픽 메카니즘을 관통하는 최고의 수석 에디터입니다.
      사용자는 기존 유명 유튜브 채널인 'Psych2Go(싸이투고)'와 'The School of Life(인생학교)'의 정수를 극적으로 학습 및 벤치마킹하여 완벽한 대본을 작성하고자 합니다.
      
      특히 영어를 공용어로 사용하는 글로벌 시청자를 핵심 타겟으로 삼아야 하므로, 대본의 기저 정서는 한국식 로컬 정서를 탈피하고 인류 전반이 공감 가능한 보편적이고 우아한 글로벌 정서를 유지해야 합니다.
      
      귀하는 사용자의 입력값들을 기초로 하여 다음의 3개 대본과 2개 프롬프트 세트를 생산해 주셔야 합니다:
      1. Psych2Go 스타일 정조 대본 (psych2goScript) 및 이를 제작하는 완벽한 고기능 프롬프트 (psych2goPrompt)
      2. The School of Life 스타일 정조 대본 (schoolOfLifeScript) 및 이를 제작하는 완벽한 고기능 프롬프트 (schoolOfLifePrompt)
      3. 두 채널의 장점을 융합하고 사용자의 이야기(\${customStorySourcing})를 주입한 최종 결정본 트로이 목마 대본 (fusedDemoScriptEnKrDetail)

      아래 상세 가이드를 각 항목별로 "한 치의 타협도 없이 완벽하게 준수"하여 채워 넣어 주십시오.

      --------------------------------------------------
      ■ 주제 및 기획 매개변수
      - 핵심 고충/대중적 결핍: \${painPoint}
      - 직관적 클릭 헤드라인: \${accessibilityTopic || "나만 몰랐던 은밀한 마음의 상처"}
      - 무해한 비주얼 껍데기: \${innocentShellVisual || "동글둥글 귀여운 파스텔 2D 캐릭터"}
      - 학술적/인문학적 사색의 깊이: \${intellectualDepth}
      - 냉소 성찰 및 씁쓸한 위트 수준: \${cynicalWitLevel || "중간 단계 (알랭 드 보통의 씁쓸하고 우아한 런던 감각)"}
      - 나레이터 성우의 성조: \${voiceTone || "성숙하고 깊은 잔향의 매력적인 영국/글로벌 영어 악센트"}
      - 사운드 및 음악 가이드: \${soundMusicStyle || "사각거리는 일상 SFX 폴리음 + 정적인 첼로/피아노 독주곡"}
      - 사용자 본인의 극복 구심 서사: \${customStorySourcing}
      - 핵심 유저 층: \${targetNiche || "관계에 치여 새벽마다 뒤늦게 후회하는 예민한 영혼들"}
      - 영상 예상 길이: \${videoLength || "7분 분량 내외"}
      --------------------------------------------------

      [1단계] 'Psych2Go' 스타일 기획 및 대본 설계 (감성 리스티클 구조)
      - psych2goPrompt 작성 기준:
        귀하가 분석한 Psych2Go 스타일의 대본 생성 만능 프롬프트를 텍스트로 완성하십시오. 이 프롬프트는 타 AI(Claude, GPT)에 넣자마자 Psych2Go 식 대본을 뽑을 수 있는 마스터 템플릿이어야 합니다.
        포함되어야 할 핵심 디테일:
        - 훅 방식: 첫 시작을 강한 공감 자극 질문("Have you ever...?")으로 개시할 것.
        - 1인칭 주어: 타겟 시청자를 "You(당신)"로 설정하고 친근하게 개별적으로 말을 건넬 것.
        - 구조: 5~8개 슬픈 증상 리스트 구조로 작성할 것.
        - 권위 근거: 전문성을 뒷받침할 "심리학적 연구, 학술 데이터, DSM 진단 기준"을 영리하게 가미할 것.
        - 톤앤매너: 손을 잡아주듯 한없이 따뜻하고, 여리며, 친구의 속삭임처럼 격려적인 뉘앙스로 지탱할 것.
        - 감정적 종착지: "나만 그런 게 아니구나" 하는 안도감(위로) 및 은밀한 자기 성찰.
        - 리텐션 가속기: 각 호작 순서마다 앞뒤 연결을 긴밀하게 에워싸는 “번호 예고 미니 훅”(예: "하지만 세 번째 징조는 당신조차 모르게 매일 밤 벌어지고 있을지 모릅니다...")을 반드시 심을 것.
        - 면죄부 장치(Normalization): "이것은 절대 당신의 잘못이 아니며(You are not to blame), 당신이 유독 다정하고 여렸기 때문에 나타난 지극히 인간적이고 아름다운 반응입니다"를 설파하여 공동체 일원으로서 위무할 것.
        - 마무리 장치: 자연스럽고 위협적이지 않게 댓글 참여를 유발하는 포근한 소프 CTA("우리의 오늘 위로가 마음에 닿다면...") 포함.
      
      - psych2goScript 작성 기준:
        위 프롬프트에 입각하여 작성된 실제 극강 퀄리티의 Psych2Go 스타일 완결형 영어-한국어 대본을 씬바이씬 포맷으로 구현하십시오 (최소 5개 씬 이상).
        * 매 장면마다 [SCENE X: 비주얼 및 카메라 무해한 연출 지시 (한글)], [SFX: 오디오 이펙트 타이밍], [Voiceover (En): 성숙하고 다정한 영어 대사], [나레이터 (Korean): 1초의 오차도 없는 가슴 시린 한국어 번역 대사]를 모두 매칭해야 합니다.

      [2단계] 'The School of Life' 스타일 기획 및 대본 설계 (철학적 문학 에세이 구조)
      - schoolOfLifePrompt 작성 기준:
        The School of Life 스타일의 명품 대본 생성 프롬프트를 완성하십시오.
        포함되어야 할 핵심 디테일:
        - 훅 방식: "우리 인류는 대개 X를 간절히 바라며 안전을 신뢰하지만, 실은 이면에 Y라는 잔인한 모순을 안고 기어 다닌다"라는 반직관적이고 우아한 역설적 보편 선언으로 좌중을 숨죽이게 할 것.
        - 1인칭 주어: 개별 "You" 보단 보편의 인간인 "We(우리), Our, Us"를 주어로 고정하여 우아한 지적 해방감과 연대감을 이끌어낼 것.
        - 구조: 리스트 나열형을 일절 배제하고, 에세이적 시론 기승전결(보편 모순 제기 -> 철학 근거 제시 -> 현실 번역 -> 프레임 리프레이밍 -> 철학적 통찰 수용)로 전개할 것.
        - 권위 근거: 고매한 철학자(니체, 쇼펜하우어, 세네카, 마르쿠스 아우렐리우스) 혹은 시인, 극작가를 명확히 명기하고 영리하게 인용해 현실 고민을 격상할 것.
        - 톤앤매너: 깊이 있고 사색적인 런던 지식인의 어투, 냉철하되 자비로운 시선, 위트 있는 약간의 영국식 냉소(Cynical Wit).
        - 감정적 종착지: 통념을 완전히 정체적으로 때려 부수는 관점의 우아한 전복(Reframe) 및 진정한 지적 해방감.
        - 리텐션 가속기: 기계적 번호가 아니라, 문장 자체에 녹아 있는 논증적 긴장감과 뜻밖의 지적 인과관계 반전의 예고.
        - 마무리: 피상적인 "이렇게 해라" 식의 얄팍한 양산형 해결법을 철저히 배제하고, 인간적 결함과 외로움은 우아한 우리의 생래적인 조건임을 온전히 '수용'하고 '이해'하며 평온을 얻도록 수렴할 것.
      
      - schoolOfLifeScript 작성 기준:
        위 프롬프트에 입각해 실제 작성된 극강 퀄리티의 인생학교형 대본을 씬바이씬 포맷으로 서술해 주십시오. (최소 5개 씬 이상)
        * 포맷: [SCENE X: 고전적이고 기하학적인 미니멀 연출 (한국어)], [SFX: 오디오 사운드 및 피아노/첼로 클래식 악장 타이밍], [Voiceover (En): 런던 톤의 기품 넘치는 정통 영어 에세이], [나레이터 (Korean): 완벽하게 대칭되는 거룩하고 지적인 한국어 번역]

      [3단계] 최종 퓨전 결정본 트로이 목마 대본 (fusedDemoScriptEnKrDetail) 및 프롬프트 (copyableKoreanPromptTemplate)
      - copyableKoreanPromptTemplate 작성 기준:
        사용자가 나중에 직접 사용할 수 있는 융합형 트로이 목마 종합 프롬프트를 제공하십시오.
      - fusedDemoScriptEnKrDetail 작성 기준:
        Psych2Go 가 가진 친근하고 대중적인 오프닝 비주얼 쉘(무해한 아기 토끼 캐릭터, 따스한 "Have you ever" 도입부)로 들어와 시청자들의 방어 기제를 완전히 박살 낸 뒤, 
        중반부부터는 무서운 정예 요병들인 The School of Life 식의 우아하고 잔인하도록 차가운 철학적 원인 분석과 세네카/니체 식 지적 리프레이밍을 폭격하고,
        거기에 사용자 고유 가치 중심 극복 서사(\${customStorySourcing})가 결정적 구원의 통찰 장치로 작용하는 3분 내외 분량의 실제 완성형 융합 영한 대본을 씬바이씬으로 작성해 주십시오. (각 대사마다 영어 원문 En과 한국어 번역 Ko를 교차 매칭해야 함)

      반드시 JSON Schema 구조에 명확히 일치하는 올바른 순수 JSON 형식으로만 완벽하게 답변하십시오.
    `;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: "당신은 글로벌 1,200만 구독자 유튜브 매체의 수석 크리에이티브 디랙터이자 유튜브 알고리즘 트래픽 메카니즘을 관통하는 최고의 수석 에디터입니다. 한글 대본 번역은 문학적이고 절절한 가슴을 때리는 감정이며, 영어 나레이션은 실제 원어민이 들어도 감탄사가 튀어나올 수준의 우아하고 시적이며 유려한 수준의 어조를 유지해야 합니다. 지체하거나 변명하지 않고 각 JSON 프로퍼티를 최대 분량의 한계까지 꽉 채워서 풍부하게 리턴합니다.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fusedGenreVision: { type: Type.STRING },
            antiDerivativeFormula: { type: Type.STRING },
            mergedStoryboardHook: { type: Type.STRING },
            seriesPlaylist: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  visualDirection: { type: Type.STRING },
                  pacingDirection: { type: Type.STRING }
                },
                required: ["title", "description", "visualDirection", "pacingDirection"]
              }
            },
            productionPipeline: { type: Type.STRING },
            seoThumbnailCombination: {
              type: Type.OBJECT,
              properties: {
                thumbnailCopy: { type: Type.STRING },
                videoTitle: { type: Type.STRING },
                recommendedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["thumbnailCopy", "videoTitle", "recommendedKeywords"]
            },
            copyableKoreanPromptTemplate: { type: Type.STRING },
            fusedDemoScriptEnKrDetail: { type: Type.STRING },
            globalPromotionStrategy: { type: Type.STRING },
            psych2goPrompt: { type: Type.STRING },
            psych2goScript: { type: Type.STRING },
            schoolOfLifePrompt: { type: Type.STRING },
            schoolOfLifeScript: { type: Type.STRING }
          },
          required: [
            "fusedGenreVision",
            "antiDerivativeFormula",
            "mergedStoryboardHook",
            "seriesPlaylist",
            "productionPipeline",
            "seoThumbnailCombination",
            "copyableKoreanPromptTemplate",
            "fusedDemoScriptEnKrDetail",
            "globalPromotionStrategy",
            "psych2goPrompt",
            "psych2goScript",
            "schoolOfLifePrompt",
            "schoolOfLifeScript"
          ]
        }
      }
    });

    const textOutput = response.text || "{}";
    res.json(JSON.parse(textOutput));

  } catch (error: any) {
    const errorString = error?.message || "";
    const isQuotaError = errorString.includes("429") || 
                        errorString.includes("Quota") || 
                        errorString.includes("quota") || 
                        errorString.includes("exhausted") || 
                        errorString.includes("limit") || 
                        errorString.includes("RESOURCE_EXHAUSTED");
    if (isQuotaError) {
      console.warn("[Gemini API Warning]: Quota Exceeded (429) for analyze-fusion. Activating beautiful local AI offline fallback model.");
      try {
        const fallback = generateFusionFallback(req.body);
        res.json(fallback);
        return;
      } catch (fallbackErr) {
        console.error("Failed to compile local fallback model:", fallbackErr);
      }
    } else {
      console.error("Trojan synthesis API error:", error);
    }
    res.status(500).json({ 
      error: error.message || "트로이 목마 기획 연산 중 예기치 못한 실패가 발생했습니다.",
      needConfig: !process.env.GEMINI_API_KEY,
      isQuotaError: isQuotaError
    });
  }
});

app.post("/api/test-keys", async (req, res) => {
  const { customGeminiApiKey, customYouTubeApiKey } = req.body || {};
  const result = {
    gemini: { success: false, message: "Gemini API key is not configured." },
    youtube: { success: false, message: "YouTube API key is not configured." }
  };

  const geminiKey = (customGeminiApiKey && customGeminiApiKey.trim() !== "") ? customGeminiApiKey : process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const ai = getGeminiClient(geminiKey);
      await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: "Reply with only: ok"
      });
      result.gemini = { success: true, message: `Gemini API key is valid. Model: ${GEMINI_MODEL}` };
    } catch (error: any) {
      result.gemini = {
        success: false,
        message: error?.message || "Gemini API key validation failed."
      };
    }
  }

  const youtubeKey = getYouTubeKey(customYouTubeApiKey);
  if (youtubeKey) {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("type", "video");
      url.searchParams.set("q", "psychology");
      url.searchParams.set("maxResults", "1");
      url.searchParams.set("key", youtubeKey);

      const response = await fetch(url);
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error?.message || `YouTube API returned ${response.status}`);
      }
      result.youtube = { success: true, message: "YouTube Data API key is valid." };
    } catch (error: any) {
      result.youtube = {
        success: false,
        message: error?.message || "YouTube API key validation failed."
      };
    }
  }

  res.json(result);
});

app.post("/api/youtube-search", async (req, res) => {
  const {
    query,
    market = "KR",
    durationFilter = "all",
    dateFilter = "all",
    maxResults = 5,
    customApiKey,
    customGeminiApiKey
  } = req.body || {};

  if (!query || !String(query).trim()) {
    res.status(400).json({ error: "Search query is required." });
    return;
  }

  const resultLimit = normalizeResultLimit(maxResults);
  const effectiveSearch = await getEffectiveSearchQuery(String(query), String(market), customGeminiApiKey);
  const youtubeKey = getYouTubeKey(customApiKey);
  if (!youtubeKey) {
    res.json({
      isRealData: false,
      searchSummary: `No YouTube API key was configured, so simulated benchmark data is being shown. Search query used: "${effectiveSearch.query}".`,
      opportunityFormula: "Use the simulated result to shape the concept, then add a YouTube Data API key for live trend validation.",
      videos: buildFallbackVideos(effectiveSearch.query, resultLimit),
      youtubeError: "YOUTUBE_API_KEY is missing.",
      effectiveQuery: effectiveSearch.query,
      wasTranslated: effectiveSearch.translated,
      translationNote: effectiveSearch.translationNote || null,
      requestedCount: resultLimit
    });
    return;
  }

  try {
    const publishedAfter = (() => {
      const now = Date.now();
      if (dateFilter === "week") return new Date(now - 86400000 * 7).toISOString();
      if (dateFilter === "month") return new Date(now - 86400000 * 30).toISOString();
      if (dateFilter === "year") return new Date(now - 86400000 * 365).toISOString();
      return null;
    })();

    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("q", effectiveSearch.query);
    searchUrl.searchParams.set("regionCode", market === "US" ? "US" : "KR");
    searchUrl.searchParams.set("maxResults", String(resultLimit));
    searchUrl.searchParams.set("order", "relevance");
    searchUrl.searchParams.set("key", youtubeKey);
    if (durationFilter !== "all") searchUrl.searchParams.set("videoDuration", durationFilter);
    if (publishedAfter) searchUrl.searchParams.set("publishedAfter", publishedAfter);

    const searchResponse = await fetch(searchUrl);
    const searchData: any = await searchResponse.json().catch(() => ({}));
    if (!searchResponse.ok) {
      throw new Error(searchData?.error?.message || `YouTube search returned ${searchResponse.status}`);
    }

    const ids = (searchData.items || [])
      .map((item: any) => item?.id?.videoId)
      .filter(Boolean);

    if (ids.length === 0) {
      res.json({
        isRealData: true,
        searchSummary: `YouTube returned no videos for "${effectiveSearch.query}".`,
        opportunityFormula: "Try a broader keyword or change the market/date filter.",
        videos: [],
        youtubeError: null,
        effectiveQuery: effectiveSearch.query,
        wasTranslated: effectiveSearch.translated,
        translationNote: effectiveSearch.translationNote || null,
        requestedCount: resultLimit
      });
      return;
    }

    const detailUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailUrl.searchParams.set("part", "snippet,statistics,contentDetails");
    detailUrl.searchParams.set("id", ids.join(","));
    detailUrl.searchParams.set("key", youtubeKey);

    const detailResponse = await fetch(detailUrl);
    const detailData: any = await detailResponse.json().catch(() => ({}));
    if (!detailResponse.ok) {
      throw new Error(detailData?.error?.message || `YouTube video details returned ${detailResponse.status}`);
    }

    const channelIds = Array.from(new Set((detailData.items || []).map((item: any) => item?.snippet?.channelId).filter(Boolean)));
    const channelSubCounts = new Map<string, number>();
    if (channelIds.length > 0) {
      const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
      channelUrl.searchParams.set("part", "statistics");
      channelUrl.searchParams.set("id", channelIds.join(","));
      channelUrl.searchParams.set("key", youtubeKey);
      const channelResponse = await fetch(channelUrl);
      const channelData: any = await channelResponse.json().catch(() => ({}));
      if (channelResponse.ok) {
        for (const channel of channelData.items || []) {
          channelSubCounts.set(channel.id, Number(channel.statistics?.subscriberCount || 0));
        }
      }
    }

    const videos = (detailData.items || []).slice(0, resultLimit).map((item: any) => {
      const stats = item.statistics || {};
      const snippet = item.snippet || {};
      const views = Number(stats.viewCount || 0);
      const subs = channelSubCounts.get(snippet.channelId) || 0;
      const ratio = subs > 0 ? `${Math.round((views / subs) * 100)}%` : "N/A";
      return {
        id: item.id,
        title: snippet.title || "Untitled video",
        channelId: snippet.channelId || "",
        channelTitle: snippet.channelTitle || "Unknown channel",
        thumbnail: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || "",
        viewCount: formatCompactNumber(stats.viewCount),
        likeCount: formatCompactNumber(stats.likeCount),
        subscriberCount: subs ? formatCompactNumber(subs) : "Hidden",
        viewToSubRatio: ratio,
        duration: parseIsoDuration(item.contentDetails?.duration),
        publishedAt: snippet.publishedAt || "",
        analysis: {
          psy2goShell: "Use the visible title promise as a simple emotional entry point.",
          schoolOfLifeCore: "Lift the topic into a broader reflection on identity, longing, fear, or belonging.",
          cynicalWitPoint: "Add one dry line that exposes the social performance hiding under the surface.",
          trojanRemakeTip: "Keep the clickable topic, but make the payoff more personal and philosophically sharper."
        }
      };
    });

    res.json({
      isRealData: true,
      searchSummary: `Fetched ${videos.length} live YouTube videos for "${effectiveSearch.query}".`,
      opportunityFormula: "Prioritize videos where the title is emotionally specific and the view-to-subscriber ratio is unusually high.",
      videos,
      youtubeError: null,
      effectiveQuery: effectiveSearch.query,
      wasTranslated: effectiveSearch.translated,
      translationNote: effectiveSearch.translationNote || null,
      requestedCount: resultLimit
    });
  } catch (error: any) {
    res.json({
      isRealData: false,
      searchSummary: `YouTube API call failed, so simulated benchmark data is being shown. Search query used: "${effectiveSearch.query}".`,
      opportunityFormula: "Check that the API key is valid and that YouTube Data API v3 is enabled in Google Cloud.",
      videos: buildFallbackVideos(effectiveSearch.query, resultLimit),
      youtubeError: error?.message || "YouTube API request failed.",
      effectiveQuery: effectiveSearch.query,
      wasTranslated: effectiveSearch.translated,
      translationNote: effectiveSearch.translationNote || null,
      requestedCount: resultLimit
    });
  }
});

app.post("/api/youtube-video-from-url", async (req, res) => {
  const { url, customApiKey } = req.body || {};
  const videoId = extractYouTubeVideoId(String(url || ""));

  if (!videoId) {
    res.status(400).json({ error: "A valid YouTube video URL is required." });
    return;
  }

  const youtubeKey = getYouTubeKey(customApiKey);
  if (!youtubeKey) {
    res.json({
      video: {
        id: videoId,
        title: `External YouTube benchmark (${videoId})`,
        channelId: "",
        channelTitle: "External YouTube",
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        viewCount: "N/A",
        likeCount: "N/A",
        subscriberCount: "N/A",
        viewToSubRatio: "N/A",
        duration: "N/A",
        publishedAt: "",
        analysis: {
          psy2goShell: "Use this external video's topic as an accessible emotional hook.",
          schoolOfLifeCore: "Reframe the borrowed topic as a broader human contradiction.",
          cynicalWitPoint: "Add a dry, self-aware twist that makes the familiar topic feel newly uncomfortable.",
          trojanRemakeTip: "Keep the original video's click promise, but change the emotional angle and visual metaphor."
        }
      },
      warning: "YOUTUBE_API_KEY is missing, so only the video ID and thumbnail were loaded."
    });
    return;
  }

  try {
    const detailUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailUrl.searchParams.set("part", "snippet,statistics,contentDetails");
    detailUrl.searchParams.set("id", videoId);
    detailUrl.searchParams.set("key", youtubeKey);

    const detailResponse = await fetch(detailUrl);
    const detailData: any = await detailResponse.json().catch(() => ({}));
    if (!detailResponse.ok) {
      throw new Error(detailData?.error?.message || `YouTube video details returned ${detailResponse.status}`);
    }

    const item = detailData.items?.[0];
    if (!item) {
      res.status(404).json({ error: "The YouTube video could not be found or is not public." });
      return;
    }

    const stats = item.statistics || {};
    const snippet = item.snippet || {};
    let subscriberCount = 0;
    if (snippet.channelId) {
      const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
      channelUrl.searchParams.set("part", "statistics");
      channelUrl.searchParams.set("id", snippet.channelId);
      channelUrl.searchParams.set("key", youtubeKey);
      const channelResponse = await fetch(channelUrl);
      const channelData: any = await channelResponse.json().catch(() => ({}));
      if (channelResponse.ok) {
        subscriberCount = Number(channelData.items?.[0]?.statistics?.subscriberCount || 0);
      }
    }

    const views = Number(stats.viewCount || 0);
    const ratio = subscriberCount > 0 ? `${Math.round((views / subscriberCount) * 100)}%` : "N/A";

    res.json({
      video: {
        id: item.id,
        title: snippet.title || "Untitled video",
        channelId: snippet.channelId || "",
        channelTitle: snippet.channelTitle || "Unknown channel",
        thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        viewCount: formatCompactNumber(stats.viewCount),
        likeCount: formatCompactNumber(stats.likeCount),
        subscriberCount: subscriberCount ? formatCompactNumber(subscriberCount) : "Hidden",
        viewToSubRatio: ratio,
        duration: parseIsoDuration(item.contentDetails?.duration),
        publishedAt: snippet.publishedAt || "",
        analysis: {
          psy2goShell: `Benchmark the accessible hook behind "${snippet.title || "this video"}".`,
          schoolOfLifeCore: "Turn the topic into a deeper reflection on identity, longing, shame, belonging, or self-protection.",
          cynicalWitPoint: "Expose the small social performance hidden inside the original click promise.",
          trojanRemakeTip: "Borrow the market signal, not the execution: change the metaphor, emotional wound, and payoff."
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to load the external YouTube video." });
  }
});

app.post("/api/generate-ab-plan", async (req, res) => {
  const {
    videoTitle,
    psy2goShell,
    schoolOfLifeCore,
    cynicalWitPoint,
    trojanRemakeTip,
    customGeminiApiKey
  } = req.body || {};

  const fallback = {
    quotaExceededFallback: true,
    titleA: { title: `${videoTitle} - The Quiet Reason It Hurts`, enTitle: "이 감정이 조용히 아픈 진짜 이유", trigger: "공감 검증: 시청자가 이미 느끼던 불편함을 제목에서 즉시 인정받게 합니다.", style: "Psych2Go 대중 공감형" },
    titleB: { title: "Why We Keep Repeating This Pattern", enTitle: "왜 우리는 이 패턴을 계속 반복하는가", trigger: "자기인식 유도: 습관처럼 반복되는 관계/감정 패턴을 지적으로 재해석합니다.", style: "School of Life 사색 통찰형" },
    titleC: { title: "You Are Not Overreacting. This Is the Pattern.", enTitle: "당신이 예민한 게 아닙니다. 이것은 하나의 패턴입니다.", trigger: "검증과 안도: 죄책감을 낮추고 끝까지 보게 만드는 면죄부 구조입니다.", style: "트로이 융합형" },
    titleD: { title: "The Harmless Habit That Quietly Trains Your Loneliness", enTitle: "당신의 외로움을 조용히 훈련시키는 무해한 습관", trigger: "호기심 격차: 평범한 행동 뒤에 숨은 심리적 비용을 암시합니다.", style: "블랙위트 인지부조화형" },
    thumbnailA: { concept: "작은 인물이 거대한 생각 말풍선 아래 눌려 있는 구도. 귀엽지만 정서적 압박이 바로 보이게 설계합니다.", midjourneyPrompt: "soft 2D pastel psychology thumbnail, small lonely character under a large thought bubble, clean YouTube composition, emotional but gentle", style: "부드러운 애니메이션형" },
    thumbnailB: { concept: "거울 앞에 선 미니멀 인물과 금이 간 라벨. 자기 인식과 철학적 거리감을 동시에 줍니다.", midjourneyPrompt: "minimal philosophical illustration, person facing a cracked mirror, muted colors, elegant editorial YouTube thumbnail, cinematic composition", style: "철학 에세이형" },
    thumbnailC: { concept: "공적인 미소와 사적인 소진을 좌우 대비로 보여줍니다. 클릭 전부터 내면의 이중성을 읽게 합니다.", midjourneyPrompt: "split-face emotional YouTube thumbnail, public smile and private exhaustion, bold simple composition, high contrast, psychology channel style", style: "감정 대비형" },
    thumbnailD: { concept: "평범한 일상 오브젝트 뒤에 깊은 그림자가 드리워진 장면. 무해함과 상처의 반전을 만듭니다.", midjourneyPrompt: "trojan horse psychology thumbnail, ordinary daily object with hidden emotional shadow, cinematic clean composition, high retention visual metaphor", style: "호기심 유도형" },
    strategyAnalysis: `"${psy2goShell || videoTitle}"를 대중적인 입구로 사용하고, "${schoolOfLifeCore || "보편적인 인간 모순"}"을 깊이 있는 내면 주제로 확장합니다. 가장 강한 대안은 영어권 시청자가 즉시 이해할 수 있는 짧은 제목을 쓰되, 설명/검토 단계에서는 왜 클릭되는지 한글로 명확히 확인할 수 있어야 합니다. 이미지 생성 프롬프트는 제작 도구 호환성을 위해 영어로 유지합니다.`
  };

  const hasGeminiKey = (customGeminiApiKey && customGeminiApiKey.trim() !== "") || (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "");
  if (!hasGeminiKey) {
    res.json(fallback);
    return;
  }

  try {
    const ai = getGeminiClient(customGeminiApiKey);
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Create a concise YouTube A/B testing plan as JSON for this source video.
Title: ${videoTitle}
Psych2Go shell: ${psy2goShell}
School of Life core: ${schoolOfLifeCore}
Cynical wit point: ${cynicalWitPoint}
Trojan remake tip: ${trojanRemakeTip}

Language rules:
- The target channel is global, so every title field must be written in natural, clickable English.
- Use enTitle as the Korean translation of the English title, not as another English title.
- All non-prompt explanatory fields must be Korean: trigger, style, thumbnail concept, thumbnail style, and strategyAnalysis.
- Only midjourneyPrompt must remain English because it is meant for image-generation tools.
- Keep the Korean translation practical and easy for a Korean creator to review.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            titleA: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, enTitle: { type: Type.STRING }, trigger: { type: Type.STRING }, style: { type: Type.STRING } }, required: ["title", "trigger", "style"] },
            titleB: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, enTitle: { type: Type.STRING }, trigger: { type: Type.STRING }, style: { type: Type.STRING } }, required: ["title", "trigger", "style"] },
            titleC: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, enTitle: { type: Type.STRING }, trigger: { type: Type.STRING }, style: { type: Type.STRING } }, required: ["title", "trigger", "style"] },
            titleD: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, enTitle: { type: Type.STRING }, trigger: { type: Type.STRING }, style: { type: Type.STRING } }, required: ["title", "trigger", "style"] },
            thumbnailA: { type: Type.OBJECT, properties: { concept: { type: Type.STRING }, midjourneyPrompt: { type: Type.STRING }, style: { type: Type.STRING } }, required: ["concept", "midjourneyPrompt", "style"] },
            thumbnailB: { type: Type.OBJECT, properties: { concept: { type: Type.STRING }, midjourneyPrompt: { type: Type.STRING }, style: { type: Type.STRING } }, required: ["concept", "midjourneyPrompt", "style"] },
            thumbnailC: { type: Type.OBJECT, properties: { concept: { type: Type.STRING }, midjourneyPrompt: { type: Type.STRING }, style: { type: Type.STRING } }, required: ["concept", "midjourneyPrompt", "style"] },
            thumbnailD: { type: Type.OBJECT, properties: { concept: { type: Type.STRING }, midjourneyPrompt: { type: Type.STRING }, style: { type: Type.STRING } }, required: ["concept", "midjourneyPrompt", "style"] },
            strategyAnalysis: { type: Type.STRING }
          },
          required: ["titleA", "titleB", "titleC", "titleD", "thumbnailA", "thumbnailB", "thumbnailC", "thumbnailD", "strategyAnalysis"]
        }
      }
    });
    res.json(parseGeminiJson(response.text));
  } catch (error: any) {
    const message = error?.message || "";
    if (message.includes("429") || message.toLowerCase().includes("quota")) {
      res.json(fallback);
      return;
    }
    res.status(500).json({ error: message || "Failed to generate A/B plan." });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Psychology YouTube Planner Server active on http://localhost:${PORT}`);
  });
}

startServer();
