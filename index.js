const KEYWORDS = [
	'식품유형',
	"소비기한",
	"제조연월일",
	'제공고시',
	'영양정보',
	'원재료명',
	'제조원',
	'원재료',
	'원산지',
	'제품정보',
	'상품정보',
	'원료',
	'함량',
	"표시대상",
	"알레르기",
];
const express = require('express');
const fs = require('fs');
const Tesseract = require('tesseract.js');
const app = express();
const PORT = 1818;



//####################################################################

// JSON 파일 읽기 함수
const readJsonFile = (filePath) => {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

// 특정 문구를 찾는 함수
const extractTextFromImage = async (imageUrl) => {
  try {
    const { data } = await Tesseract.recognize(imageUrl, 'kor');
    
		return data.text.trim(); // 추출된 텍스트 반환

  } catch (error) {
    return ''; // 오류 발생 시 빈 문자열 반환
  }
};

// 이미지 URL 유효성 검사 함수
const isValidImageUrl = async (imageUrl) => {
  try {
    const response = await fetch(imageUrl, { method: 'HEAD' }); // 헤더만 요청
    return response.ok; // 상태 코드가 200-299 범위인지 확인
  } catch {
    return false; // 네트워크 오류 등으로 요청 실패 시 false 반환
  }
};

// 여러 이미지 링크를 처리하고, 특정 키워드 중 하나라도 포함된 이미지 링크만 필터링하는 함수
const filterImagesByKeywords = async (originLinkArray, keywords) => {
  const filteredArr = [];

  try {
    // 여러 이미지를 병렬로 처리
    const imageProcessingPromises = originLinkArray.map(async (imageUrl) => {
      try {
        // 이미지 URL 유효성 검사
        if (!(await isValidImageUrl(imageUrl))) {
          console.warn(`유효하지 않은 이미지 URL: ${imageUrl}`);
          return null; // 유효하지 않으면 null 반환
        }
				

        // 이미지에서 텍스트 추출
        const extractedText = await extractTextFromImage(imageUrl);
				console.log('=================================================================================================');
				console.log("=== 이미지 링크 추출 시작 : ",imageUrl);
				console.log('=================================================================================================');

				console.log(extractedText)

				console.log('-------------------------------------------------------------------------------------------------');

        
				// 키워드 중 하나라도 포함된 경우 해당 링크를 filteredArr에 추가
        if (keywords.some((keyword) => extractedText.includes(keyword))) {
          return imageUrl;
        }
				return null;
      } catch (error) {
        console.error(`이미지 처리 중 오류 발생: ${imageUrl} - ${error.message}`);
      }
    });

    // 모든 이미지 처리 결과를 병렬로 실행하고 결과를 기다림
    const results = await Promise.all(imageProcessingPromises);

    // null이 아닌 유효한 이미지 링크만 필터링
    filteredArr.push(...results.filter((result) => result));
  } catch (error) {
    console.error(`이미지 필터링 중 오류 발생: ${error.message}`);
  }

  return filteredArr;
};

//신규 데이터 확인
const isNewData = (crawlData, dbData) => {
	return crawlData.filter(v => !dbData.find(i =>  i.CLCT_SNO === v.CLCT_SNO ) );
}

//테서렉트 OCR
const tesseractOCR = async (data) => {	
	var keywords = KEYWORDS;
	return await filterImagesByKeywords(data, keywords);
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 데이터 변환 함수
const convertData = async (crawlData, dbData) => {
  const newData = isNewData(crawlData, dbData);

  if (!newData || newData.length === 0) {
    return [];
  }

  const result = [];

  for (const v of newData) {
    try {
      let images = v.IMG_URL;

      // 이미지 URL이 문자열일 경우 배열로 변환
      if (images && typeof images === "string") {
        const imageArray = images.split("§").map((url) => url.trim()).map(url => url.replace(/\?type=w860$/, ''));
				console.log("########## 상품명 : ",v.PRDT_NM);
				console.log('대상 이미지 목록 :',imageArray);
        // Tesseract OCR 호출
        images = await tesseractOCR(imageArray);
        console.log("테서렉트 추출 이미지:", images);
				console.log("----------------------------------------------------------");
      } else {
        images = [];
      }

			const obj = {
				상품명:v.PRDT_NM,
				상품링크:v.LNK_URL,
				원산지예상이미지:images
			}

			result.push(obj);
      
			
			// 요청 간 딜레이 추가
      await delay(1000); // 100ms 대기

    } catch (error) {
      console.error("에러발생:", v, error);
    }
  }

  return result;
};

// 비동기 실행
(async () => {
	// 서버 시작
	app.listen(PORT, () => {
		console.log(`서버실행 http://localhost:${PORT}`);
	});

  const newData = readJsonFile("testData.json"); //새로운 데이터
	const dbData = readJsonFile("ocrDB.json");			 //검수완료된 데이터
  const result = await convertData(newData, dbData);

	console.log('최종결과 :',result);
})();

