const IFOREST_LOCATION = {
  name: "\uC544\uC774\uC232\uB3D9\uBB3C\uBCD1\uC6D0",
  address: "\uACBD\uAE30\uB3C4 \uAD11\uBA85\uC2DC \uC2DC\uCCAD\uB85C 33-1, 1\uCE35",
  lat: 37.4799175,
  lng: 126.8637915
};

const IFOREST_KAKAO_DIRECTIONS_URL =
  `https://map.kakao.com/link/to/${encodeURIComponent(IFOREST_LOCATION.name)},${IFOREST_LOCATION.lat},${IFOREST_LOCATION.lng}`;

const IFOREST_MOBILE_MAP_VIEWPORTS = {
  previous: {
    zoom: 15,
    center: { lat: 37.4794, lng: 126.8649 }
  },
  current: {
    zoom: 16,
    center: { lat: 37.4801, lng: 126.86445 }
  }
};

window.IFOREST_CONTACT = {
  hospitalName: IFOREST_LOCATION.name,
  address: IFOREST_LOCATION.address,
  phone: "02.6951.5100",
  tel: "0269515100",
  hours: "\uC6D4-\uD1A0 10:00 - 20:00 \u00B7 \uC77C\uC694\uC77C \uD734\uC9C4",
  parking: "\uBCD1\uC6D0 \uC55E \uC804\uBA74 \uC8FC\uCC28 2\uB300 \uAC00\uB2A5",
  publicTransit: "7\uD638\uC120 \uCCA0\uC0B0\uC5ED \uB610\uB294 \uAD11\uBA85\uC2DC\uCCAD \uC815\uB958\uC7A5 \uC774\uC6A9",
  naverMapUrl: "https://map.naver.com/p/entry/place/1806958154?lng=126.8637915&lat=37.4799175&placePath=%2Fhome&searchType=place&c=15.00,0,0,0,dh",
  kakaoMapUrl: IFOREST_KAKAO_DIRECTIONS_URL,
  directionsUrl: "https://map.naver.com/p/entry/place/1806958154?lng=126.8637915&lat=37.4799175&placePath=%2Fhome&searchType=place&c=15.00,0,0,0,dh",
  naverMapClientId: "skkskc426z",
  location: {
    ...IFOREST_LOCATION,
    zoom: 16,
    mobileZoom: IFOREST_MOBILE_MAP_VIEWPORTS.current.zoom,
    mobileCenter: IFOREST_MOBILE_MAP_VIEWPORTS.current.center,
    mobilePreviousViewport: IFOREST_MOBILE_MAP_VIEWPORTS.previous
  },
  instagramUrl: "https://www.instagram.com/iforest_ah/",
  instagramHandle: "@iforest_ah",
  kakaoChannelUrl: "https://pf.kakao.com/_qxoxnun",
  kakaoChannelName: IFOREST_LOCATION.name
};
