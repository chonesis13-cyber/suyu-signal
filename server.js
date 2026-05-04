const express = require("express");
const cors = require("cors");

let fetch;
(async () => { fetch = (await import("node-fetch")).default; })();

const app  = express();
const PORT = process.env.PORT || 3000;

const SEOUL_KEY   = "58456c6f4d61737435384d664d5943";
const BUS_KEY     = "f1786639cd3d3785e1866ee164273ef747d3f5e5a7f5a6b34177bb90c3d1af4f";
const WEATHER_KEY = "af228254ffa0eb85c2d1ffced047cb05";

const BUS_STATIONS = [
  { name: "북부수도사업소",   arsId: "09154", buses: ["1124"] },
  { name: "번동해모로아파트", arsId: "09234", buses: ["강북05"] }
];

app.use(cors({ origin: "*" }));
app.use(express.static("public"));

// 신호등 API
app.get("/api/signal", async (req, res) => {
  if (!fetch) return res.status(503).json({ error: "서버 초기화 중" });
  try {
    const r = await fetch(`http://openAPI.seoul.go.kr:8088/${SEOUL_KEY}/json/SptTrafficLghtResidTime/1/5/`);
    const d = await r.json();
    if (d.RESULT) return res.status(502).json({ error: d.RESULT.MESSAGE });
    res.json(d);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// 버스 도착 API
app.get("/api/bus", async (req, res) => {
  if (!fetch) return res.status(503).json({ error: "서버 초기화 중" });
  try {
    const results = await Promise.all(
      BUS_STATIONS.map(async (station) => {
        const url = `http://ws.bus.go.kr/api/rest/stationinfo/getStationByUid?arsId=${station.arsId}&serviceKey=${BUS_KEY}&resultType=json`;
        const r = await fetch(url);
        const d = await r.json();
        return { stationName: station.name, arsId: station.arsId, buses: station.buses, data: d };
      })
    );
    res.json({ stations: results });
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
    const r = await fetch(url);
    const d = await r.json();
    res.json(d);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`✅ 서버 실행 중: http://localhost:${PORT}`));
