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

app.use(cors({ origin: "*" }));

// 신호등 API (실시간 우선, 실패시 시뮬레이션)
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

  // 실패시 시뮬레이션 데이터 반환
  // 수유역 교차로 기준: 전체주기 90초, 녹색 30초, 적색 60초
  const CYCLE     = 90;
  const GREEN_SEC = 30;
  const now       = Math.floor(Date.now() / 1000);
  const elapsed   = now % CYCLE;
  const isGreen   = elapsed < GREEN_SEC;
  const residTime = isGreen ? GREEN_SEC - elapsed : CYCLE - elapsed;

  res.json({
    SptTrafficLghtResidTime: {
      list_total_count: 1,
      RESULT: { CODE: "INFO-000", MESSAGE: "정상 처리되었습니다" },
      row: [{
        ITRSC_NM: "수유역 교차로",
        LGHT_COL_CD: isGreen ? "1" : "2",
        RESID_TIME: residTime,
        LAT: "37.6489",
        LNG: "127.0277",
        SIMULATED: true
      }]
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
