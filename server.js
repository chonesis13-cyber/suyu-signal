const express = require("express");
const cors = require("cors");
const path = require("path");

let fetch;
(async () => { fetch = (await import("node-fetch")).default; })();

const app  = express();
const PORT = process.env.PORT || 3000;

const SEOUL_KEY   = "58456c6f4d61737435384d664d5943";
const KAKAO_REST  = "b9430d7f52d1000a6038b7eb6402cccc";
const WEATHER_KEY = "af228254ffa0eb85c2d1ffced047cb05";

// 횡단보도 두 곳 설정
const CROSSINGS = [
  { name: "오현로20길 교차로 A", lat: "37.625428", lng: "127.037069" },
  { name: "오현로20길 교차로 B", lat: "37.625226", lng: "127.037151" }
];

// 신호 시뮬레이션 (A와 B는 반대 신호)
function getSignalData() {
  const CYCLE     = 90;
  const GREEN_SEC = 30;
  const now       = Math.floor(Date.now() / 1000);
  const elapsed   = now % CYCLE;

  const aIsGreen  = elapsed < GREEN_SEC;
  const aResid    = aIsGreen ? GREEN_SEC - elapsed : CYCLE - elapsed;
  const bIsGreen  = !aIsGreen;
const bResid    = Math.max(1, bIsGreen ? GREEN_SEC - (elapsed - GREEN_SEC) : GREEN_SEC + (CYCLE - elapsed));
  return [
    {
      ITRSC_NM: CROSSINGS[0].name,
      LGHT_COL_CD: aIsGreen ? "1" : "2",
      RESID_TIME: aResid,
      LAT: "", LNG: "",
      SIMULATED: true
    },
    {
      ITRSC_NM: CROSSINGS[1].name,
      LGHT_COL_CD: bIsGreen ? "1" : "2",
      RESID_TIME: bResid,
      LAT: "", LNG: "",
      SIMULATED: true
    }
  ];
}

app.use(cors({ origin: "*" }));

// 신호등 API
app.get("/api/signal", async (req, res) => {
  if (!fetch) return res.status(503).json({ error: "서버 초기화 중" });

  // 실시간 API 먼저 시도
  try {
    const r = await fetch(
      `http://openAPI.seoul.go.kr:8088/${SEOUL_KEY}/json/SptTrafficLghtResidTime/1/5/`,
      { timeout: 3000 }
    );
    const d = await r.json();
    if (!d.RESULT) return res.json(d);
  } catch (e) {}

  // 실패시 시뮬레이션
  res.json({
    SptTrafficLghtResidTime: {
      list_total_count: 2,
      RESULT: { CODE: "INFO-000", MESSAGE: "정상 처리되었습니다" },
      row: getSignalData()
    }
  });
});

// 카카오 근처 버스정류장 검색
app.get("/api/stations", async (req, res) => {
  if (!fetch) return res.status(503).json({ error: "서버 초기화 중" });
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "위치 정보 필요" });
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=버스정류장&x=${lng}&y=${lat}&radius=500&size=15`;
    const r = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST}` } });
    const d = await r.json();
    res.json(d);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// 날씨 API
app.get("/api/weather", async (req, res) => {
  if (!fetch) return res.status(503).json({ error: "서버 초기화 중" });
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "위치 정보 필요" });
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${WEATHER_KEY}&units=metric&lang=kr`;
    const r = await fetch(url);
    const d = await r.json();
    res.json(d);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// 정적 파일
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => console.log(`✅ 서버 실행 중: http://localhost:${PORT}`));
