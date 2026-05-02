const express = require("express");
const cors = require("cors");

let fetch;
(async () => { fetch = (await import("node-fetch")).default; })();

const app = express();
const PORT = process.env.PORT || 3000;

const SEOUL_API_KEY = "58456c6f4d61737435384d664d5943";
const SEOUL_API_URL = `http://openAPI.seoul.go.kr:8088/${SEOUL_API_KEY}/json/SptTrafficLghtResidTime/1/5/`;

app.use(cors({ origin: "*" }));
app.use(express.static("public"));

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

app.listen(PORT, () => console.log(`✅ 서버 실행 중: http://localhost:${PORT}`));
