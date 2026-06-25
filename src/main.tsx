import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BookOpen, Clipboard, FileText, Gauge, Sparkles } from "lucide-react";
import "./styles.css";

type Level = "초급" | "중급" | "고급" | "TOPIK I" | "TOPIK II";
type MaterialType = "읽기 지문" | "대화문" | "문법 설명" | "어휘 활동" | "퀴즈" | "활동지";

type FormState = {
  title: string;
  level: Level;
  materialType: MaterialType;
  topic: string;
  targetGrammar: string;
  targetVocabulary: string;
  lessonDuration: string;
  exerciseCount: number;
  includeAnswers: boolean;
  includeExplanations: boolean;
  includeTeacherTips: boolean;
  outputLanguage: string;
};

type UsageLog = {
  id: string;
  model: string;
  promptTemplateId: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: "draft" | "success";
  createdAt: string;
};

const defaultForm: FormState = {
  title: "",
  level: "초급",
  materialType: "대화문",
  topic: "카페에서 주문하기",
  targetGrammar: "-고 싶어요",
  targetVocabulary: "커피, 주문하다, 계산하다",
  lessonDuration: "20분",
  exerciseCount: 5,
  includeAnswers: true,
  includeExplanations: true,
  includeTeacherTips: true,
  outputLanguage: "한국어",
};

const templateByType: Record<MaterialType, string> = {
  "읽기 지문": "reading-material",
  대화문: "dialogue-material",
  "문법 설명": "grammar-explanation",
  "어휘 활동": "vocabulary-activity",
  퀴즈: "quiz-material",
  활동지: "worksheet-conversion",
};

function createDraftMarkdown(form: FormState): string {
  const title = form.title.trim() || `${form.topic} ${form.materialType}`;
  const vocabulary = form.targetVocabulary
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);

  return `# ${title}

## 학습 목표
- ${form.level} 학습자가 ${form.topic} 상황에서 핵심 표현을 사용할 수 있다.
- 목표 문법 ${form.targetGrammar || "기본 문형"}을 자연스럽게 이해하고 말할 수 있다.

## 대상 수준
- ${form.level}

## 수업 전 질문
1. ${form.topic}와 관련된 경험이 있어요?
2. 이 상황에서 자주 쓰는 표현은 무엇일까요?
3. 오늘 배우고 싶은 표현이 있어요?

## 본문 또는 대화문
교사: 오늘은 "${form.topic}" 상황에서 사용할 수 있는 표현을 배워요.\n학생: 저는 ${vocabulary[0] ?? "새 표현"}을/를 배우고 싶어요.\n교사: 좋아요. "${form.targetGrammar || "-고 싶어요"}"를 사용해서 말해 봅시다.

## 핵심 어휘
| 어휘 | 뜻 | 예문 |
| --- | --- | --- |
${(vocabulary.length ? vocabulary : ["표현", "연습하다", "상황"]) 
  .map((word) => `| ${word} | 수업 주제와 관련된 말 | ${word}을/를 사용해서 문장을 만들어요. |`)
  .join("\n")}

## 문법 포인트
- ${form.targetGrammar || "목표 문법"}은/는 말하는 사람의 의도나 상황을 표현할 때 사용합니다.
- 예문: 저는 ${vocabulary[0] ?? "한국어"}을/를 배우고 싶어요.
- 예문: 친구와 함께 연습하고 싶어요.

## 연습문제
${Array.from({ length: form.exerciseCount }, (_, index) => `${index + 1}. ${form.topic} 상황에 맞는 문장을 하나 쓰세요.`).join("\n")}
${form.includeAnswers ? `
## 정답 및 해설
${Array.from({ length: form.exerciseCount }, (_, index) => `${index + 1}. 정답 예시: 저는 ${vocabulary[0] ?? "한국어"}을/를 배우고 싶어요. / 해설: 목표 문법을 자연스럽게 사용했습니다.`).join("\n")}` : ""}
${form.includeTeacherTips ? `
## 교사용 활용 팁
- ${form.lessonDuration} 수업에서는 짝 활동으로 짧은 역할극을 진행하세요.
- 학습자가 만든 문장을 칠판에 적고 함께 수정해 보세요.` : ""}`;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 2.7));
}

function App() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [result, setResult] = useState(() => createDraftMarkdown(defaultForm));
  const [copied, setCopied] = useState(false);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([
    {
      id: "demo-1",
      model: "LGAI-EXAONE/K-EXAONE-236B-A23B",
      promptTemplateId: "dialogue-material",
      inputTokens: 122,
      outputTokens: 800,
      latencyMs: 13710,
      status: "success",
      createdAt: "PoC smoke test",
    },
  ]);

  const todayCount = usageLogs.length;
  const totalTokens = usageLogs.reduce((sum, log) => sum + log.inputTokens + log.outputTokens, 0);
  const templateId = templateByType[form.materialType];

  const previewStats = useMemo(() => {
    const inputText = JSON.stringify(form);
    const outputText = result;
    return {
      inputTokens: estimateTokens(inputText),
      outputTokens: estimateTokens(outputText),
    };
  }, [form, result]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleGenerate() {
    const started = performance.now();
    const markdown = createDraftMarkdown(form);
    setResult(markdown);
    setUsageLogs((logs) => [
      {
        id: crypto.randomUUID(),
        model: "draft-local-template",
        promptTemplateId: templateId,
        inputTokens: estimateTokens(JSON.stringify(form)),
        outputTokens: estimateTokens(markdown),
        latencyMs: Math.round(performance.now() - started),
        status: "draft",
        createdAt: new Date().toLocaleString("ko-KR"),
      },
      ...logs,
    ]);
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Korean Teacher Material MVP</p>
          <h1>한국어 교사용 수업자료 제작 도구</h1>
          <p className="hero-copy">수준과 주제만 입력하면 읽기 지문, 대화문, 어휘, 문법, 문제, 정답 초안을 빠르게 준비합니다.</p>
        </div>
        <button className="primary-action" onClick={handleGenerate}><Sparkles size={18} /> 초안 생성</button>
      </section>

      <section className="metric-grid" aria-label="사용량 요약">
        <Metric icon={<FileText />} label="오늘 생성" value={`${todayCount}건`} />
        <Metric icon={<Gauge />} label="월간 토큰" value={totalTokens.toLocaleString()} />
        <Metric icon={<BookOpen />} label="템플릿" value={templateId} />
      </section>

      <div className="workspace-grid">
        <section className="panel">
          <div className="panel-heading"><h2>새 자료 만들기</h2><p>명세의 P0 입력 항목을 기준으로 구성한 생성 폼입니다.</p></div>
          <div className="form-grid">
            <Field label="자료 제목"><input value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="병원 예약하기 수업자료" /></Field>
            <Field label="학습자 수준"><select value={form.level} onChange={(event) => updateForm("level", event.target.value as Level)}>{["초급", "중급", "고급", "TOPIK I", "TOPIK II"].map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="자료 유형"><select value={form.materialType} onChange={(event) => updateForm("materialType", event.target.value as MaterialType)}>{["읽기 지문", "대화문", "문법 설명", "어휘 활동", "퀴즈", "활동지"].map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="주제"><input value={form.topic} onChange={(event) => updateForm("topic", event.target.value)} /></Field>
            <Field label="목표 문법"><input value={form.targetGrammar} onChange={(event) => updateForm("targetGrammar", event.target.value)} /></Field>
            <Field label="목표 어휘"><input value={form.targetVocabulary} onChange={(event) => updateForm("targetVocabulary", event.target.value)} /></Field>
            <Field label="수업 시간"><select value={form.lessonDuration} onChange={(event) => updateForm("lessonDuration", event.target.value)}>{["10분", "20분", "50분"].map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="문제 수"><input type="number" min={1} max={10} value={form.exerciseCount} onChange={(event) => updateForm("exerciseCount", Number(event.target.value))} /></Field>
            <Field label="출력 언어"><select value={form.outputLanguage} onChange={(event) => updateForm("outputLanguage", event.target.value)}>{["한국어", "한국어+영어 설명"].map((item) => <option key={item}>{item}</option>)}</select></Field>
          </div>
          <div className="checkbox-row">
            <label><input type="checkbox" checked={form.includeAnswers} onChange={(event) => updateForm("includeAnswers", event.target.checked)} /> 정답 포함</label>
            <label><input type="checkbox" checked={form.includeExplanations} onChange={(event) => updateForm("includeExplanations", event.target.checked)} /> 해설 포함</label>
            <label><input type="checkbox" checked={form.includeTeacherTips} onChange={(event) => updateForm("includeTeacherTips", event.target.checked)} /> 교사용 팁 포함</label>
          </div>
        </section>

        <section className="panel result-panel">
          <div className="panel-heading inline-heading"><div><h2>생성 결과 보기</h2><p>현재는 앱 1차 패치용 로컬 초안이며, 다음 패치에서 FriendliAI Adapter와 연결합니다.</p></div><button className="secondary-action" onClick={copyMarkdown}><Clipboard size={16} /> {copied ? "복사됨" : "Markdown 복사"}</button></div>
          <pre className="markdown-preview">{result}</pre>
        </section>
      </div>

      <section className="panel usage-panel">
        <div className="panel-heading"><h2>사용량 / 비용 현황</h2><p>요청별 모델, 템플릿, 토큰, 지연시간, 상태를 기록하는 P0 로그 UI입니다.</p></div>
        <div className="usage-summary">예상 입력 {previewStats.inputTokens} tokens · 예상 출력 {previewStats.outputTokens} tokens</div>
        <table><thead><tr><th>생성 시각</th><th>모델</th><th>템플릿</th><th>입력</th><th>출력</th><th>지연</th><th>상태</th></tr></thead><tbody>{usageLogs.map((log) => <tr key={log.id}><td>{log.createdAt}</td><td>{log.model}</td><td>{log.promptTemplateId}</td><td>{log.inputTokens}</td><td>{log.outputTokens}</td><td>{log.latencyMs}ms</td><td><span className={`status ${log.status}`}>{log.status}</span></td></tr>)}</tbody></table>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <article className="metric-card"><span className="metric-icon">{icon}</span><div><p>{label}</p><strong>{value}</strong></div></article>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

createRoot(document.getElementById("root")!).render(<App />);
