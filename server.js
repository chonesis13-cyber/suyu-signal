const express = require("express");
const cors = require("cors");

let fetch;
(async () => { fetch = (await import("node-fetch")).default; })();

const app = express();
const PORT = process.env.PORT || 3000;

const SEOUL_API_KEY  = "58456c6f4d61737435384d664d5943";
const BUS_API_KEY = "f1786639cd3d3785e1866ee164273ef747d3f5e5a7f5a6b34177bb90c3d1af4f";
const SEOUL_API_URL  = `http://openAPI.seoul.go.kr:8088/${SEOUL_API_KEY}/json/SptTrafficLghtResidTime/1/5/`;

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
    const response = await fetch(SEOUL_API_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`서울시 API 오류: ${response.status}`);
    const data = await response.json();
    if (data.RESULT) return res.status(502).json({ error: data.RESULT.MESSAGE });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// 버스 도착 API
app.get("/api/bus", async (req, res) => {
  if (!fetch) return res.status(503).json({ error: "서버 초기화 중" });
  try {
    const results = await Promise.all(
      BUS_STATIONS.map(async (station) => {
        const url = `http://ws.bus.go.kr/api/rest/stationinfo/getStationByUid?arsId=${station.arsId}&serviceKey=${BUS_API_KEY}&resultType=json`;
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`버스 API 오류: ${response.status}`);
        const data = await response.json();
        return {
          stationName: station.name,
          arsId: station.arsId,
          buses: station.buses,
          data: data
        };
      })
    );
    res.json({ stations: results });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ 서버 실행 중: http://localhost:${PORT}`));
