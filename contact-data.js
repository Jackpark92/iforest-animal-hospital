const IFOREST_LOCATION = {
  name: "아이숲동물병원",
  address: "경기 광명시 시청로 33-1, 1층",
  lat: 37.4799175,
  lng: 126.8637915
};

const IFOREST_KAKAO_DIRECTIONS_URL =
  `https://map.kakao.com/link/to/${encodeURIComponent(IFOREST_LOCATION.name)},${IFOREST_LOCATION.lat},${IFOREST_LOCATION.lng}`;

window.IFOREST_CONTACT = {
  hospitalName: IFOREST_LOCATION.name,
  address: IFOREST_LOCATION.address,
  phone: "02.6951.5100",
  tel: "0269515100",
  hours: "월-토 10:00 - 20:00 · 일요일 휴진",
  parking: "병원 앞 전면 주차 2대 가능",
  publicTransit: "7호선 철산역 또는 광명시청 정류장 이용",
  naverMapUrl: "https://map.naver.com/p/entry/place/1806958154?lng=126.8637915&lat=37.4799175&placePath=%2Fhome&searchType=place&c=15.00,0,0,0,dh",
  kakaoMapUrl: IFOREST_KAKAO_DIRECTIONS_URL,
  directionsUrl: "https://map.naver.com/p/entry/place/1806958154?lng=126.8637915&lat=37.4799175&placePath=%2Fhome&searchType=place&c=15.00,0,0,0,dh",
  naverMapClientId: "skkskc426z",
  location: {
    ...IFOREST_LOCATION,
    zoom: 16,
    mobileZoom: 15
  },
  instagramUrl: "https://www.instagram.com/iforest_ah/",
  instagramHandle: "@iforest_ah",
  kakaoChannelUrl: "https://pf.kakao.com/_qxoxnun",
  kakaoChannelName: IFOREST_LOCATION.name
};
