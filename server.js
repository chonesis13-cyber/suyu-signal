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

// 잔여시간표시기 위치 데이터 (수유역 근처)
const SIGNAL_LOCATIONS = [
  {"id":"25-0000011090","dir":"291","lat":37.65809,"lng":127.033117},
  {"id":"25-0000011102","dir":"285","lat":37.647907,"lng":127.024555},
  {"id":"25-0000011107","dir":"236","lat":37.651053,"lng":127.031305},
  {"id":"25-0000009598","dir":"119","lat":37.651236,"lng":127.036005},
  {"id":"25-0000011161","dir":"132","lat":37.65126,"lng":127.037747},
  {"id":"25-0000011162","dir":"300","lat":37.65131,"lng":127.037606},
  {"id":"25-0000009612","dir":"355","lat":37.631716,"lng":127.024189},
  {"id":"25-0000009608","dir":"343","lat":37.630645,"lng":127.024385},
  {"id":"25-0000009606","dir":"253","lat":37.63072,"lng":127.024496},
  {"id":"25-0000009611","dir":"146","lat":37.631774,"lng":127.023851},
  {"id":"25-0000009610","dir":"75","lat":37.630673,"lng":127.024293},
  {"id":"25-0000009609","dir":"50","lat":37.630628,"lng":127.02441},
  {"id":"25-0000009600","dir":"77","lat":37.651545,"lng":127.036218},
  {"id":"25-0000009596","dir":"348","lat":37.651176,"lng":127.036415},
  {"id":"25-0000009594","dir":"198","lat":37.651454,"lng":127.036594},
  {"id":"25-0000000196","dir":"38","lat":37.651544,"lng":127.036627},
  {"id":"25-0000009593","dir":"61","lat":37.651453,"lng":127.036709},
  {"id":"25-0000011088","dir":"324","lat":37.658077,"lng":127.032815},
  {"id":"25-0000009599","dir":"256","lat":37.651443,"lng":127.03615},
  {"id":"25-0000008892","dir":"70","lat":37.636257,"lng":127.023715},
  {"id":"25-0000008891","dir":"257","lat":37.636187,"lng":127.023598},
  {"id":"25-0000008890","dir":"162","lat":37.636121,"lng":127.023749},
  {"id":"25-0000008889","dir":"349","lat":37.636191,"lng":127.023891},
  {"id":"25-0000011091","dir":"109","lat":37.658163,"lng":127.033403},
  {"id":"25-0000011089","dir":"37","lat":37.657993,"lng":127.032925},
  {"id":"25-0000011160","dir":"22","lat":37.651188,"lng":127.037836},
  {"id":"25-0000009597","dir":"29","lat":37.651144,"lng":127.036115},
  {"id":"25-0000011163","dir":"53","lat":37.651363,"lng":127.037473},
  {"id":"25-0000009595","dir":"107","lat":37.651356,"lng":127.036498},
  {"id":"25-0000011164","dir":"234","lat":37.651415,"lng":127.037338}
];

// 거리 계산 (미터)
function distance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2)
    + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180)
    * Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// T-Data 신호 파싱
function parseTData(items) {
  const bssgFields = ["ntBssgRmdrCs","stBssgRmdrCs","etBssgRmdrCs","wtBssgRmdrCs","seBssgRmdrCs","swBssgRmdrCs","neBssgRmdrCs","nwBssgRmdrCs"];
  const stsgFields = ["ntStsgRmdrCs","stStsgRmdrCs","etStsgRmdrCs","wtStsgRmdrCs","seStsgRmdrCs","swStsgRmdrCs","neStsgRmdrCs","nwStsgRmdrCs"];

  return items.map(item => {
    let greenTime = null, redTime = null;
    for (const f of bssgFields) { if (item[f] > 0) { greenTime = item[f]; break; } }
    for (const f of stsgFields) { if (item[f] > 0) { redTime = item[f]; break; } }
    const isGreen = greenTime !== null && greenTime > 0;
    return {
      isGreen,
      var residTime = isGreen ? Math.min(Math.round(greenTime / 10), 180) : Math.min((redTime ? Math.round(redTime / 10) : 30), 180);
  });
}

// 방향 숫자를 한글로
function dirToName(dir) {
  const d = parseInt(dir);
  if (d >= 338 || d < 23)  return "북";
  if (d >= 23  && d < 68)  return "북동";
  if (d >= 68  && d < 113) return "동";
  if (d >= 113 && d < 158) return "남동";
  if (d >= 158 && d < 203) return "남";
  if (d >= 203 && d < 248) return "남서";
  if (d >= 248 && d < 293) return "서";
  if (d >= 293 && d < 338) return "북서";
  return "북";
}

app.use(cors({ origin: "*" }));

// 신호등 API
app.get("/api/signal", async (req, res) => {
  if (!fetch) return res.status(503).json({ error: "서버 초기화 중" });

  const lat = parseFloat(req.query.lat) || 37.648900;
  const lng = parseFloat(req.query.lng) || 127.027700;

  // 반경 500m 안 신호등 필터링
  const nearby = SIGNAL_LOCATIONS.filter(s => distance(lat, lng, s.lat, s.lng) < 500);

  try {
    const url = `http://t-data.seoul.go.kr/apig/apiman-gateway/tapi/v2xSignalPhaseTimingInformation/1.0?apiKey=${TDATA_KEY}`;
    const r   = await fetch(url, { timeout: 5000 });
    const d   = await r.json();

    if (Array.isArray(d) && d.length > 0) {
      const signals = parseTData(d);
      const rows = nearby.slice(0, 10).map((loc, i) => {
        const sig = signals[i % signals.length];
        return {
          ITRSC_NM:    dirToName(loc.dir) + "측 횡단보도",
          LGHT_COL_CD: sig.isGreen ? "1" : "2",
          RESID_TIME:  sig.residTime,
          LAT:         String(loc.lat),
          LNG:         String(loc.lng),
          SIMULATED:   false
        };
      });
      return res.json({
        SptTrafficLghtResidTime: { list_total_count: rows.length, RESULT: { CODE: "INFO-000" }, row: rows }
      });
    }
  } catch (e) {
    console.log("T-Data 오류:", e.message);
  }

  // 시뮬레이션 폴백
  const CYCLE = 90, GREEN = 30;
  const now = Math.floor(Date.now() / 1000);
  const rows = nearby.slice(0, 10).map((loc, i) => {
    const elapsed  = (now + i * 18) % CYCLE;
    const isGreen  = elapsed < GREEN;
    const residTime = isGreen ? GREEN - elapsed : CYCLE - elapsed;
    return {
      ITRSC_NM:    dirToName(loc.dir) + "측 횡단보도",
      LGHT_COL_CD: isGreen ? "1" : "2",
      RESID_TIME:  residTime,
      LAT:         String(loc.lat),
      LNG:         String(loc.lng),
      SIMULATED:   true
    };
  });

  res.json({
    SptTrafficLghtResidTime: { list_total_count: rows.length, RESULT: { CODE: "INFO-000" }, row: rows }
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
  } catch (e) { res.status(502).json({ error: e.message }); }
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
  } catch (e) { res.status(502).json({ error: e.message }); }
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
  } catch (e) { res.status(502).json({ error: e.message }); }
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
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.use(express.static(path.join(__dirname, "public")));
app.listen(PORT, () => console.log(`✅ 서버 실행 중: http://localhost:${PORT}`));
