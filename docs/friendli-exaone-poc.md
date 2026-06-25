# FriendliAI / EXAONE PoC 환경변수와 모델 테스트 계획

이 문서는 “한국어 교사용 수업자료 제작 도구” PoC에서 FriendliAI로 EXAONE 계열 모델을 테스트하기 위한 환경변수 수신 방식, 모델 선택 기준, 비교 실험 절차를 정의한다.

## 1. 환경변수는 이렇게 받는다

로컬 개발에서는 `.env.example`을 복사해서 `.env.local`을 만들고 실제 값을 채운다.

```bash
cp .env.example .env.local
```

실제 API 키는 절대 Git에 커밋하지 않는다. 배포 환경에서는 Vercel, Render, Railway, Fly.io, AWS, GCP 같은 호스팅 서비스의 secret/environment 설정 화면에 같은 키를 등록한다.

### 필수 환경변수

| 이름 | 예시 | 설명 |
|---|---|---|
| `FRIENDLI_API_KEY` | `flp_...` | FriendliAI에서 발급받은 API 키. 서버에서만 읽는다. |
| `FRIENDLI_BASE_URL` | `https://api.friendli.ai/serverless/v1` | FriendliAI OpenAI-compatible API base URL. 운영 전 FriendliAI 문서/대시보드에서 재확인한다. |
| `FRIENDLI_MODEL` | `LGAI-EXAONE/K-EXAONE-236B-A23B` | 기본 호출 모델. Dedicated Endpoint를 쓰면 Friendli 문서 안내처럼 endpoint ID를 `model` 값으로 넣는다. |

### 선택 환경변수

| 이름 | 기본값 제안 | 설명 |
|---|---:|---|
| `FRIENDLI_MODEL_CANDIDATES` | K-EXAONE, EXAONE 4.0 32B, EXAONE 4.0 1.2B 후보 | 같은 프롬프트를 여러 모델에 돌려 비교할 때 사용한다. 정확한 모델 ID는 계정/엔드포인트별로 달라질 수 있어 FriendliAI 대시보드에서 확인한다. |
| `FRIENDLI_TEMPERATURE` | `0.4` | 교육 자료는 일관성이 중요하므로 낮게 시작한다. |
| `FRIENDLI_TOP_P` | `0.9` | 과도한 다양성을 줄이기 위한 기본값. |
| `FRIENDLI_MAX_TOKENS` | `2500` | 긴 교안 생성을 막기 위한 초기 출력 제한. |
| `DAILY_GENERATION_LIMIT` | `20` | PoC 사용자별 일일 생성 제한. |
| `REQUEST_MAX_INPUT_TOKENS` | `2000` | 긴 입력으로 인한 비용 폭증 방지. |
| `REQUEST_MAX_OUTPUT_TOKENS` | `4000` | 출력 비용 상한 방지. |
| `MONTHLY_COST_SOFT_LIMIT_USD` | `3` | 내부 PoC 예산 경고 기준. |

## 2. 서버 코드에서 읽는 방식

프론트엔드에서 `FRIENDLI_API_KEY`를 직접 읽거나 노출하면 안 된다. API route/server action/backend service에서만 읽는다.

예상 코드 형태:

```ts
const apiKey = process.env.FRIENDLI_API_KEY;
const baseUrl = process.env.FRIENDLI_BASE_URL ?? "https://api.friendli.ai/serverless/v1";
const model = process.env.FRIENDLI_MODEL ?? "LGAI-EXAONE/K-EXAONE-236B-A23B";

if (!apiKey) {
  throw new Error("FRIENDLI_API_KEY is required");
}
```

OpenAI-compatible 클라이언트를 쓸 경우에는 base URL과 API key만 FriendliAI 값으로 바꾸고, `model`에는 FriendliAI 모델 페이지의 모델 ID 또는 Dedicated Endpoint의 endpoint ID를 넣는다.

## 3. 모델은 바로 결정하지 말고 비교한다

초기 결론은 “K-EXAONE을 기본 후보로 두되, EXAONE 4.0 계열과 같은 테스트 세트로 비교 후 결정”이다.

### 후보 모델

| 후보 | 우선 용도 | 테스트 이유 |
|---|---|---|
| `LGAI-EXAONE/K-EXAONE-236B-A23B` | 고품질 한국어 수업자료, 추론/검수, 긴 문맥 | 한국어·다국어·reasoning·긴 context에 강한 대형 MoE 모델로 소개되어 한국어 교육 콘텐츠 품질 기준선으로 적합하다. |
| `LGAI-EXAONE/EXAONE-4.0-32B` | 일반 생성, 비용/품질 균형 후보 | EXAONE 4.0의 중형 고성능 모델 후보로, K-EXAONE 대비 비용·속도·품질 균형을 확인한다. |
| `LGAI-EXAONE/EXAONE-4.0-1.2B` | 초안 생성, 간단 예문/어휘 생성 | 작은 모델이 간단한 작업에서 충분하면 비용 절감용으로 분리할 수 있다. |

> 주의: 위 모델 ID는 PoC 후보명이다. FriendliAI 계정에서 노출되는 정확한 ID, Serverless/Model APIs 지원 여부, Dedicated Endpoint ID는 대시보드에서 확인해 `.env.local`에 반영한다.

## 4. 추천 테스트 순서

1. `K-EXAONE`으로 기준 품질을 만든다.
2. 같은 입력을 `EXAONE 4.0 32B`에 돌려 품질 차이와 비용/속도를 비교한다.
3. 간단 생성 작업만 `EXAONE 4.0 1.2B`로 테스트한다.
4. 작업 유형별 라우팅을 결정한다.

### 작업 유형별 초기 라우팅 가설

| 작업 | 1차 후보 | 대체 후보 | 이유 |
|---|---|---|---|
| 수업자료 전체 생성 | K-EXAONE | EXAONE 4.0 32B | 구조화, 수준 조절, 해설 품질이 중요하다. |
| 짧은 예문 생성 | EXAONE 4.0 1.2B 또는 32B | K-EXAONE | 비용 절감 가능성이 크다. |
| TOPIK 스타일 문제 | K-EXAONE | EXAONE 4.0 32B | 오답 선택지와 해설 정확성이 중요하다. |
| 정답/해설 검수 | K-EXAONE | EXAONE 4.0 32B | 정답 오류는 제품 신뢰도에 직접 영향이 있다. |
| 초안 생성 후 사용자 편집 | EXAONE 4.0 32B | EXAONE 4.0 1.2B | 비용/속도 중심으로 검증한다. |

## 5. 모델 비교용 고정 테스트 세트

모델을 공정하게 비교하려면 동일한 프롬프트와 동일한 파라미터로 실행한다.

| ID | 입력 | 확인할 점 |
|---|---|---|
| `dialogue-beginner-cafe` | 초급, 카페에서 주문하기, `-고 싶어요`, 대화문+어휘+문제 | 초급 어휘 제한, 자연스러운 존댓말, 정답 명확성 |
| `reading-intermediate-delivery` | 중급, 한국의 배달 문화, 읽기 지문+내용 확인 문제 | 중급 수준 어휘, 문화 설명 균형, 문제 근거 명확성 |
| `grammar-beginner-should` | 초급, `-아/어야 하다`, 문법 설명+예문+연습 | 설명의 단순성, 오류 없는 활용 |
| `topik-i-reading` | TOPIK I 스타일 읽기 문제 3개 | 정답 하나만 존재하는지, 오답 매력도 |
| `revise-easier` | 기존 중급 지문을 초급으로 낮추기 | 의미 보존, 문장 길이, 어휘 난이도 |

## 6. 평가표

각 모델 결과를 1~5점으로 평가하고, 출력 토큰·응답 시간·예상 비용을 함께 기록한다.

| 평가 항목 | 설명 |
|---|---|
| 한국어 자연스러움 | 교사가 바로 읽어도 어색하지 않은가 |
| 수준 적합성 | 초급/중급/고급 또는 TOPIK 수준에 맞는가 |
| 교육적 가치 | 학습 목표와 활동이 실제 수업에 도움이 되는가 |
| 문제 정확성 | 정답이 하나로 명확하고 해설과 일치하는가 |
| 포맷 준수 | 앱에서 파싱/표시하기 쉬운 Markdown 또는 JSON 구조를 지키는가 |
| 수정 필요 정도 | 교사가 사용 전 얼마나 고쳐야 하는가 |
| 비용 | 같은 작업 대비 토큰 비용이 합리적인가 |
| 속도 | 교사가 기다릴 수 있는 응답 시간인가 |

## 7. 1차 의사결정 기준

PoC 1차 모델 선택은 다음 기준으로 한다.

- 전체 수업자료 생성 평균 품질이 4점 이상이면 기본 모델 후보로 유지한다.
- 정답/해설 오류가 반복되는 모델은 문제 생성/검수 라우팅에서 제외한다.
- 작은 모델이 예문·어휘 생성에서 4점 이상이면 해당 작업은 작은 모델로 분리한다.
- 비용 차이가 크지 않으면 MVP 초기에는 품질이 더 높은 모델을 선택한다.
- 비용 차이가 크면 “저비용 초안 모드”와 “고품질 검수 모드”를 분리한다.

## 8. 참고한 최신 확인 사항

- FriendliAI 문서는 EXAONE 4.0 사용 시 Friendli SDK 또는 OpenAI-compatible SDK를 사용할 수 있고, Dedicated Endpoint에서는 endpoint overview의 endpoint ID를 `model` 필드에 넣는다고 안내한다.
- FriendliAI의 OpenAI compatibility 문서는 Model APIs, Dedicated Endpoints, Container가 OpenAI-compatible이며 base URL과 API key 변경으로 기존 SDK를 쓸 수 있다고 안내한다.
- FriendliAI K-EXAONE 모델 페이지는 `LGAI-EXAONE/K-EXAONE-236B-A23B`를 reasoning, agentic tool use, multilingual Korean, 256K context에 강한 모델로 소개한다.
- LG AI Research의 EXAONE 4.0 GitHub 문서는 EXAONE 4.0 계열이 32B와 1.2B 두 크기로 구성된다고 설명한다.

## 9. Codex 웹 프로젝트 환경 변수 주입 후 바로 할 검증

Codex 웹 브라우저 환경에서 레포/프로젝트별 환경 설정 화면의 **환경 변수** 항목에 `FRIENDLI_API_KEY`를 키 이름과 값으로 저장한 뒤에는, 새 작업 세션에서 저장소의 스모크 테스트로 FriendliAI OpenAI-compatible chat completions 호출이 실제로 성공하는지 확인한다. 여기서 말하는 위치는 Secret 항목이 아니라, 사용자가 키 제목과 값을 직접 입력한 환경 변수 항목이다. 이미 실행 중이던 세션에는 새 환경 변수가 자동으로 반영되지 않을 수 있으므로, 키를 방금 추가했다면 새 Codex 작업을 시작하거나 세션 환경을 갱신한 뒤 테스트한다.

```bash
python3 scripts/friendli_smoke_test.py
```

이 스크립트는 다음을 확인한다.

- `FRIENDLI_API_KEY`가 현재 프로세스 환경에서 읽히는지 확인한다.
- `FRIENDLI_BASE_URL`, `FRIENDLI_MODEL`, `FRIENDLI_TEMPERATURE`, `FRIENDLI_TOP_P`, `FRIENDLI_MAX_TOKENS`를 사용해 작은 한국어 수업자료 샘플을 생성한다.
- API 키는 앞/뒤 일부만 마스킹해 출력하고, 전체 키는 출력하지 않는다.
- 응답 시간, usage 정보가 있으면 usage, 모델 출력 샘플을 기록해 PoC 품질 비교의 첫 기준값으로 삼는다.

실패 시 우선 확인할 항목은 다음과 같다.

1. Codex 웹 프로젝트 설정의 환경 변수 항목에서 키 이름이 정확히 `FRIENDLI_API_KEY`인지 확인한다. Secret 항목에 넣었다는 뜻이 아니다.
2. 환경 변수를 추가한 뒤 새 작업 세션을 시작했는지 확인한다. 현재 셸에서 `FRIENDLI_API_KEY`가 비어 있으면 스크립트는 API를 호출하지 않는다.
3. `FRIENDLI_BASE_URL`이 현재 FriendliAI 대시보드/문서의 OpenAI-compatible base URL과 일치하는지 확인한다.
4. `FRIENDLI_MODEL` 값이 해당 계정에서 사용 가능한 모델 ID 또는 Dedicated Endpoint ID인지 확인한다.
5. HTTP 401/403이면 키 권한 또는 과금/프로젝트 설정을 확인하고, HTTP 404/400이면 모델 ID와 endpoint 유형을 확인한다.
