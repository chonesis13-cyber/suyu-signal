const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// API 키 설정
const KEYS = {
    SEOUL: "58456c6f4d61737435384d664d5943",
    KAKAO: "b9430d7f52d1000a6038b7eb6402cccc",
    WEATHER: "af228254ffa0eb85c2d1ffced047cb05"
};

app.use(cors({ origin: "*" }));
app.use(express.static(path.join(__dirname, "public")));

// 신호등 시뮬레이션 로직
function getSignalData() {
    const CYCLE = 90;
    const GREEN_SEC = 30;
    const RED_SEC = CYCLE - GREEN_SEC;
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now % CYCLE;
    const aIsGreen = elapsed < GREEN_SEC;
    const bIsGreen = ((elapsed + RED_SEC) % CYCLE) < GREEN_SEC;

    return [
        { ITRSC_NM: "오현로20길 교차로 A", LGHT_COL_CD: aIsGreen ? "1" : "2", RESID_TIME: aIsGreen ? GREEN_SEC - elapsed : CYCLE - elapsed, SIMULATED: true },
        { ITRSC_NM: "오현로20길 교차로 B", LGHT_COL_CD: bIsGreen ? "1" : "2", RESID_TIME: bIsGreen ? GREEN_SEC - ((elapsed + RED_SEC) % CYCLE) : CYCLE - ((elapsed + RED_SEC) % CYCLE), SIMULATED: true }
    ];
}

// [API] 신호등 정보
app.get("/api/signal", async (req, res) => {
    try {
        const response = await fetch(`http://openAPI.seoul.go.kr:8088/${KEYS.SEOUL}/json/SptTrafficLghtResidTime/1/5/`);
        const data = await response.json();
        if (data.SptTrafficLghtResidTime) return res.json(data);
    } catch (e) { console.log("⚠️ 서울시 API 연결 실패 -> 시뮬레이션 모드"); }
    res.json({ SptTrafficLghtResidTime: { RESULT: { CODE: "INFO-000", MESSAGE: "Simulation" }, row: getSignalData() } });
});

// [API] 카카오 정류장 검색
app.get("/api/stations", async (req, res) => {
    const { lat, lng } = req.query;
    try {
        const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=버스정류장&x=${lng}&y=${lat}&radius=500&size=15`;
        const response = await fetch(url, { headers: { Authorization: `KakaoAK ${KEYS.KAKAO}` } });
        res.json(await response.json());
    } catch (e) { res.status(502).json({ error: e.message }); }
});

// [API] 날씨 정보 (이 부분이 추가되었습니다!)
app.get("/api/weather", async (req, res) => {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: "위치 정보 필요" });
    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${KEYS.WEATHER}&units=metric&lang=kr`;
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (e) { res.status(502).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`✅ 서버 실행 중: http://localhost:${PORT}`));
