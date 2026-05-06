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

function distance(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2)
    + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180)
    * Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function dirToName(dir) {
  var d = parseInt(dir);
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

function parseTData(items) {
  var bssgFields = ["ntBssgRmdrCs","stBssgRmdrCs","etBssgRmdrCs","wtBssgRmdrCs","seBssgRmdrCs","swBssgRmdrCs","neBssgRmdrCs","nwBssgRmdrCs"];
  var stsgFields = ["ntStsgRmdrCs","stStsgRmdrCs","etStsgRmdrCs","wtStsgRmdrCs","seStsgRmdrCs","swStsgRmdrCs","neStsgRmdrCs","nwStsgRmdrCs"];

  return items.map(function(item) {
    var greenTime = null, redTime = null;
    for (var a = 0; a < bssgFields.length; a++) {
      if (item[bssgFields[a]] !== null && item[bssgFields[a]] > 0) { greenTime = item[bssgFields[a]]; break; }
    }
    for (var b = 0; b < stsgFields.length; b++) {
      if (item[stsgFields[b]] !== null && item[stsgFields[b]] > 0) { redTime = item[stsgFields[b]]; break; }
    }
    var isGreen = greenTime !== null && greenTime > 0;
    var residTime = isGreen
      ? Math.min(Math.round(greenTime / 10), 180)
      : Math.min(redTime ? Math.round(redTime / 10) : 30, 180);
    return { isGreen: isGreen, residTime: residTime };
  });
}

app.use(cors({ origin: "*" }));

app.get("/api/signal", async (req, res) => {
  if (!fetch) return res.status(503).json({ error: "서버 초기화 중" });

  var lat = parseFloat(req.query.lat) || 37.648900;
  var lng = parseFloat(req.query.lng) || 127.027700;

  var nearby = SIGNAL_LOCATIONS.filter(function(s) {
    return distance(lat, lng, s.lat, s.lng) < 500;
  });

  if (!nearby.length) {
    nearby = SIGNAL_LOCATIONS.slice(0, 5);
  }

  try {
    var url = "http://t-data.seoul.go.kr/apig/apiman-gateway/tapi/v2xSignalPhaseTimingInformation/1.0?apiKey=" + TDATA_KEY;
    var r   = await fetch(url, { timeout: 5000 });
    var d   = await r.json();

    if (Array.isArray(d) && d.length > 0) {
      var signals = parseTData(d);
      var rows = nearby.slice(0, 10).map(function(loc, i) {
        var sig = signals[i % signals.length];
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
  } catch(e) {
    console.log("T-Data 오류:", e.message);
  }

  var CYCLE = 90, GREEN = 30;
  var now = Math.floor(Date.now() / 1000);
  var rows = nearby.slice(0, 10).map(function(loc, i) {
    var elapsed  = (now + i * 18) % CYCLE;
    var isGreen  = elapsed < GREEN;
    var residTime = isGreen ? GREEN - elapsed : CYCLE - elapsed;
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

app.get("/api/subway", async (req, res) => {
  if (!fetch) return res.status(503).json({ error: "서버 초기화 중" });
  var station = req.query.station;
  if (!station) return res.status(400).json({ error: "역 이름 필요" });
  try {
    var url = "http://swopenAPI.seoul.go.kr/api/subway/" + SUBWAY_KEY + "/json/realtimeStationArrival/0/10/" + encodeURIComponent(station);
    var r   = await fetch(url);
    var d   = await r.json();
    res.json(d);
  } catch(e) { res.status(502).json({ error: e.message }); }
});

app.get("/api/nearbySubway", async (req, res) => {
  if (!fetch) return res.status(503).json({ error: "서버 초기화 중" });
  var lat = req.query.lat, lng = req.query.lng;
  if (!lat || !lng) return res.status(400).json({ error: "위치 정보 필요" });
  try {
    var url = "https://dapi.kakao.com/v2/local/search/category.json?category_group_code=SW8&x=" + lng + "&y=" + lat + "&radius=1000&size=5&sort=distance";
    var r   = await fetch(url, { headers: { Authorization: "KakaoAK " + KAKAO_REST } });
    var d   = await r.json();
    res.json(d);
  } catch(e) { res.status(502).json({ error: e.message }); }
});

app.get("/api/stations", async (req, res) => {
  if (!fetch) return res.status(503).json({ error: "서버 초기화 중" });
  var lat = req.query.lat, lng = req.query.lng;
  if (!lat || !lng) return res.status(400).json({ error: "위치 정보 필요" });
  try {
    var url = "https://dapi.kakao.com/v2/local/search/keyword.json?query=%EB%B2%84%EC%8A%A4%EC%A0%95%EB%A5%98%EC%9E%A5&x=" + lng + "&y=" + lat + "&radius=500&size=15";
    var r   = await fetch(url, { headers: { Authorization: "KakaoAK " + KAKAO_REST } });
    var d   = await r.json();
    res.json(d);
  } catch(e) { res.status(502).json({ error: e.message }); }
});

app.get("/api/weather", async (req, res) => {
  if (!fetch) return res.status(503).json({ error: "서버 초기화 중" });
  var lat = req.query.lat, lng = req.query.lng;
  if (!lat || !lng) return res.status(400).json({ error: "위치 정보 필요" });
  try {
    var url = "https://api.openweathermap.org/data/2.5/weather?lat=" + lat + "&lon=" + lng + "&appid=" + WEATHER_KEY + "&units=metric&lang=kr";
    var r   = await fetch(url);
    var d   = await r.json();
    res.json(d);
  } catch(e) { res.status(502).json({ error: e.message }); }
});

app.use(express.static(path.join(__dirname, "public")));
app.listen(PORT, () => console.log("서버 실행 중: http://localhost:" + PORT));
