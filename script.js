// 유튜브 비디오에서 자막 가져오기 (중국어)
async function fetchSubtitles(videoId) {
    try {
        // 로딩 메시지 표시
        const subtitlesContainer = document.getElementById('subtitles');
        subtitlesContainer.innerHTML = '<div class="loading">자막을 불러오는 중...</div>';
        
        // 먼저 사용 가능한 자막 목록 가져오기
        const proxyUrl = 'https://corsproxy.io/?';
        const trackListUrl = `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`;
        
        const trackListResponse = await fetch(proxyUrl + encodeURIComponent(trackListUrl));
        const trackListData = await trackListResponse.text();
        
        console.log("자막 목록 데이터:", trackListData);
        
        // XML 파싱
        const parser = new DOMParser();
        const trackListXml = parser.parseFromString(trackListData, "text/xml");
        const trackElements = trackListXml.getElementsByTagName('track');
        
        // 중국어 자막 찾기
        let chineseTrack = null;
        const chineseCodes = ['zh', 'zh-Hans', 'zh-Hant', 'zh-CN', 'zh-TW', 'zh-HK'];
        
        for (let i = 0; i < trackElements.length; i++) {
            const track = trackElements[i];
            const langCode = track.getAttribute('lang_code');
            const langName = track.getAttribute('name');
            
            console.log(`자막 발견: ${langCode} - ${langName}`);
            
            if (chineseCodes.includes(langCode)) {
                chineseTrack = track;
                break;
            }
        }
        
        if (!chineseTrack) {
            subtitlesContainer.innerHTML = '<div class="error">이 비디오에는 중국어 자막이 없습니다. 사용 가능한 자막 목록:</div>';
            
            // 사용 가능한 자막 목록 표시
            const trackList = document.createElement('ul');
            trackList.className = 'track-list';
            
            for (let i = 0; i < trackElements.length; i++) {
                const track = trackElements[i];
                const langCode = track.getAttribute('lang_code');
                const langName = track.getAttribute('name') || langCode;
                
                const listItem = document.createElement('li');
                listItem.textContent = `${langName} (${langCode})`;
                trackList.appendChild(listItem);
            }
            
            if (trackElements.length === 0) {
                trackList.innerHTML = '<li>사용 가능한 자막이 없습니다.</li>';
            }
            
            subtitlesContainer.appendChild(trackList);
            return;
        }
        
        // 중국어 자막 가져오기
        const langCode = chineseTrack.getAttribute('lang_code');
        const captionUrl = `https://www.youtube.com/api/timedtext?lang=${langCode}&v=${videoId}`;
        
        const captionResponse = await fetch(proxyUrl + encodeURIComponent(captionUrl));
        
        if (!captionResponse.ok) {
            throw new Error('자막을 가져올 수 없습니다.');
        }
        
        const captionData = await captionResponse.text();
        
        // XML 파싱
        const captionXml = parser.parseFromString(captionData, "text/xml");
        const textElements = captionXml.getElementsByTagName('text');
        
        // 자막 배열 생성
        subtitles = [];
        for (let i = 0; i < textElements.length; i++) {
            const textElement = textElements[i];
            const start = parseFloat(textElement.getAttribute('start'));
            const dur = parseFloat(textElement.getAttribute('dur') || '0');
            const text = textElement.textContent;
            
            subtitles.push({
                start: start,
                end: start + dur,
                text: text
            });
        }
        
        // 자막이 없는 경우
        if (subtitles.length === 0) {
            subtitlesContainer.innerHTML = '<div class="error">이 비디오의 중국어 자막을 파싱할 수 없습니다.</div>';
            return;
        }
        
        console.log("자막 데이터:", subtitles);
        
        // 자막 처리 및 표시
        processSubtitles();
        displaySubtitles();
        
    } catch (error) {
        console.error('자막 가져오기 오류:', error);
        document.getElementById('subtitles').innerHTML = 
            `<div class="error">자막을 가져오는 중 오류가 발생했습니다: ${error.message}</div>`;
    }
}
