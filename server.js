const express = require("express");
const cors = require("cors");
const path = require("path");

let fetch;
(async () => { fetch = (await import("node-fetch")).default; })();

const app  = express();
const PORT = process.env.PORT || 3000;

const TDATA_KEY   = "ed415d5d-ad1c-47dd-b699-f31ddf4dd45a";
const SUBWAY_KEY  = "507057584e6173743130355570556445";
const KAKAO_REST  = "b9430d7f52d1000a6038b7eb6402cccc";
const WEATHER_KEY = "af228254ffa0eb85c2d1ffced047cb05";

// 지도 중심 기준 오프셋 (미터 → 위경도 변환)
const OFFSETS = [
  { name: "북측 횡단보도",  dlat:  0.0009, dlng:  0.0000 },
  { name: "남측 횡단보도",  dlat: -0.0009, dlng:  0.0000 },
  { name: "동측 횡단보도",  dlat:  0.0000, dlng:  0.0013 },
  { name: "서측 횡단보도",  dlat:  0.0000, dlng: -0.0013 },
  { name: "북동측 횡단보도", dlat:  0.0007, dlng:  0.0010 }
];

// 시뮬레이션 신호
function getSimulatedSignal(lat, lng) {
  const CYCLE     = 90;
  const GREEN_SEC = 30;
  const RED_SEC   = CYCLE - GREEN_SEC;
  const now       = Math.floor(Date.now() / 1000);

  return OFFSETS.map(function(offset, i) {
    const elapsed  = (now + i * 15) % CYCLE;
    const isGreen  = elapsed < GREEN_SEC;
    const residTime = isGreen ? GREEN_SEC - elapsed : CYCLE - elapsed;
    const bElapsed  = (elapsed + RED_SEC) % CYCLE;
    return {
      ITRSC_NM:    offset.name,
      LGHT_COL_CD: isGreen ? "1" : "2",
      RESID_TIME:  residTime,
      LAT:         String(lat + offset.dlat),
      LNG:         String(lng + offset.dlng),
      SIMULATED:   true
    };
  });
}

// T-Data 파싱
function parseTDataSignal(items, lat, lng) {
  var bssgFields = ["ntBssgRmdrCs","stBssgRmdrCs","etBssgRmdrCs","wtBssgRmdrCs","seBssgRmdrCs","swBssgRmdrCs","neBssgRmdrCs","nwBssgRmdrCs"];
  var stsgFields = ["ntStsgRmdrCs","stStsgRmdrCs","etStsgRmdrCs","wtStsgRmdrCs","seStsgRmdrCs","swStsgRmdrCs","neStsgRmdrCs","nwStsgRmdrCs"];

  return items.slice(0, 5).map(function(item, i) {
    var greenTime = null, redTime = null;
    for (var a = 0; a < bssgFields.length; a++) {
      if (item[bssgFields[a]] !== null && item[bssgFields[a]] > 0) { greenTime = item[bssgFields[a]]; break; }
    }
    for (var b = 0; b < stsgFields.length; b++) {
      if (item[stsgFields[b]] !== null && item[stsgFields[b]] > 0) { redTime = item[stsgFields[b]]; break; }
    }
    var isGreen   = greenTime !== null && greenTime > 0;
    var residTime = isGreen ? Math.round(greenTime / 10) : (redTime ? Math.round(redTime / 10) : 30);
    var offset    = OFFSETS[i] || OFFSETS[0];

    return {
      ITRSC_NM:    offset.name,
      LGHT_COL_CD: isGreen ? "1" : "2",
      RESID_TIME:  residTime,
      LAT:         String(lat + offset.dlat),
      LNG:         String(lng + offset.dlng),
      SIMULATED:   false
    };
  });
}

app.use(cors({ origin: "*" }));

// 신호등 API
app.get("/api/signal", async (req, res) => {
  if (!fetch) return res.status(503).json({ error: "서버 초기화 중" });

  const lat = parseFloat(req.query.lat) || 37.625395;
  const lng = parseFloat(req.query.lng) || 127.037088;

  try {
    const url = `http://t-data.seoul.go.kr/apig/apiman-gateway/tapi/v2xSignalPhaseTimingInformation/1.0?apiKey=${TDATA_KEY}`;
    const r   = await fetch(url, { timeout: 5000 });
    const d   = await r.json();

    if (Array.isArray(d) && d.length > 0) {
      const rows = parseTDataSignal(d, lat, lng);
      if (rows.length > 0) {
        return res.json({
          SptTrafficLghtResidTime: {
            list_total_count: rows.length,
            RESULT: { CODE: "INFO-000", MESSAGE: "정상 처리되었습니다" },
            row: rows
          }
        });
      }
    }
  } catch (e) {
    console.log("T-Data 오류:", e.message);
  }

  // 실패시 시뮬레이션
  res.json({
    SptTrafficLghtResidTime: {
      list_total_count: 5,
      RESULT: { CODE: "INFO-000", MESSAGE: "정상 처리되었습니다" },
      row: getSimulatedSignal(lat, lng)
    }
  });
});

// 지하철 실시간 도착정보
app.get("/api/subway", async (req, res) => {
  if (!fetch) return res.status(503).json({ error: "서버 초기화 중" });
  const { station } = req.query;
  if (!station) return res.status(400).json({ error: "역 이름 필요" });
  try {
    const url = `http://swopenAPI.seoul.go.kr/api/subway/${SUBWAY_KEY}/json/realtimeStationArrival/0/10/${encodeURIComponent(station)}`;
    const r   = await fetch(url);
    const d   = await r.json();
    res.json(d);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// 카카오 근처 지하철역
app.get("/api/nearbySubway", async (req, res) => {
  if (!fetch) return res.status(503).json({ error: "서버 초기화 중" });
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "위치 정보 필요" });
  try {
    const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=SW8&x=${lng}&y=${lat}&radius=1000&size=5&sort=distance`;
    const r   = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST}` } });
    const d   = await r.json();
    res.json(d);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// 카카오 근처 버스정류장
app.get("/api/stations", async (req, res) => {
  if (!fetch) return res.status(503).json({ error: "서버 초기화 중" });
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "위치 정보 필요" });
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=버스정류장&x=${lng}&y=${lat}&radius=500&size=15`;
    const r   = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST}` } });
    const d   = await r.json();
    res.json(d);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// 날씨 API
app.get("/api/weather", async (req, res) => {
  if (!fetch) return res.status(503).json({ error: "서버 초기화 중" });
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "위치 정보 필요" });
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${WEATHER_KEY}&units=metric&lang=kr`;
    const r   = await fetch(url);
    const d   = await r.json();
    res.json(d);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => console.log(`✅ 서버 실행 중: http://localhost:${PORT}`));
