const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// API 키 (보안을 위해 환경변수 권장)
const KEYS = {
    SEOUL: "58456c6f4d61737435384d664d5943",
    KAKAO: "b9430d7f52d1000a6038b7eb6402cccc",
    WEATHER: "af228254ffa0eb85c2d1ffced047cb05"
};

app.use(cors({ origin: "*" }));
app.use(express.static(path.join(__dirname, "public")));

// [시뮬레이션] 신호등 데이터 (A와 B는 서로 반대 신호)
function getSignalData() {
    const CYCLE = 90;
    const GREEN_SEC = 30;
    const RED_SEC = CYCLE - GREEN_SEC; // 60초
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now % CYCLE;

    // A: 0~30초 녹색, 30~90초 적색
    const aIsGreen = elapsed < GREEN_SEC;
    const aResid = aIsGreen ? GREEN_SEC - elapsed : CYCLE - elapsed;

    // B: A와 정반대로 동작
    const bElapsed = (elapsed + RED_SEC) % CYCLE;
    const bIsGreen = bElapsed < GREEN_SEC;
    const bResid = bIsGreen ? GREEN_SEC - bElapsed : CYCLE - bElapsed;

    return [
        { ITRSC_NM: "오현로20길 교차로 A", LGHT_COL_CD: aIsGreen ? "1" : "2", RESID_TIME: aResid, LAT: "37.625428", LNG: "127.037069" },
        { ITRSC_NM: "오현로20길 교차로 B", LGHT_COL_CD: bIsGreen ? "1" : "2", RESID_TIME: bResid, LAT: "37.625226", LNG: "127.037151" }
    ];
}

// 1. 신호등 API
app.get("/api/signal", async (req, res) => {
    try {
        const response = await fetch(`http://openAPI.seoul.go.kr:8088/${KEYS.SEOUL}/json/SptTrafficLghtResidTime/1/5/`);
        const data = await response.json();
        if (data.SptTrafficLghtResidTime) return res.json(data);
    } catch (e) { }
    res.json({ SptTrafficLghtResidTime: { row: getSignalData() } });
});

// 2. 카카오 버스정류장 API
app.get("/api/stations", async (req, res) => {
    const { lat, lng } = req.query;
    try {
        const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=버스정류장&x=${lng}&y=${lat}&radius=500&size=15`;
        const r = await fetch(url, { headers: { Authorization: `KakaoAK ${KEYS.KAKAO}` } });
        res.json(await r.json());
    } catch (e) { res.status(502).json({ error: e.message }); }
});

// 3. 날씨 API
app.get("/api/weather", async (req, res) => {
    const { lat, lng } = req.query;
    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${KEYS.WEATHER}&units=metric&lang=kr`;
        const r = await fetch(url);
        res.json(await r.json());
    } catch (e) { res.status(502).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`✅ 서버 오픈: http://localhost:${PORT}`));
