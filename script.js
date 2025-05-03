// YouTube Player API 변수
let player;
let currentVideoId = '';
let subtitles = [];
let currentSubtitleIndex = -1;
let subtitleUpdateInterval;

// YouTube API 콜백 함수
function onYouTubeIframeAPIReady() {
    // 페이지 로드 시 플레이어 초기화
    player = new YT.Player('player', {
        height: '390',
        width: '640',
        videoId: '',
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

// 플레이어 준비 완료
function onPlayerReady(event) {
    console.log('Player ready');
    document.getElementById('loadVideo').addEventListener('click', loadVideo);
}

// 플레이어 상태 변경
function onPlayerStateChange(event) {
    // 재생 중일 때만 자막 업데이트
    if (event.data === YT.PlayerState.PLAYING) {
        // 이전 인터벌이 있으면 제거
        clearInterval(subtitleUpdateInterval);
        // 새 인터벌 설정
        subtitleUpdateInterval = setInterval(updateSubtitleHighlight, 100);
    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        // 재생이 멈추면 인터벌 제거
        clearInterval(subtitleUpdateInterval);
    }
}

// 비디오 로드
function loadVideo() {
    const videoId = document.getElementById('videoId').value;
    if (videoId) {
        currentVideoId = videoId;
        player.loadVideoById(videoId);
        fetchSubtitles(videoId);
    }
}

// 유튜브 비디오에서 자막 가져오기 (중국어)
async function fetchSubtitles(videoId) {
    try {
        // 로딩 메시지 표시
        const subtitlesContainer = document.getElementById('subtitles');
        subtitlesContainer.innerHTML = '<div class="loading">자막을 불러오는 중...</div>';
        
        // 유튜브 중국어 자막 가져오기
        const proxyUrl = 'https://corsproxy.io/?';
        const targetUrl = `https://www.youtube.com/api/timedtext?lang=zh&v=${videoId}`;
        
        const response = await fetch(proxyUrl + encodeURIComponent(targetUrl));
        
        if (!response.ok) {
            throw new Error('자막을 가져올 수 없습니다.');
        }
        
        const data = await response.text();
        
        // XML 파싱
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(data, "text/xml");
        const textElements = xmlDoc.getElementsByTagName('text');
        
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
            subtitlesContainer.innerHTML = '<div class="error">이 비디오에는 중국어 자막이 없습니다.</div>';
            return;
        }
        
        // 자막 처리 및 표시
        processSubtitles();
        displaySubtitles();
        
    } catch (error) {
        console.error('자막 가져오기 오류:', error);
        document.getElementById('subtitles').innerHTML = 
            `<div class="error">자막을 가져오는 중 오류가 발생했습니다: ${error.message}</div>`;
    }
}

// 자막 처리 (단어 선택 및 괄호 처리)
function processSubtitles() {
    // 모든 자막 라인에 대해 처리
    subtitles.forEach(sub => {
        const text = sub.text.replace(/<[^>]*>/g, ''); // HTML 태그 제거
        
        // 중국어는 공백으로 분리되지 않으므로 문자별로 처리
        // 임시로 2자 이상인 단어를 랜덤하게 선택하여 괄호 처리
        let processedText = '';
        let inWord = false;
        let currentWord = '';
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            // 한자 또는 한글 범위인지 확인 (간단한 예시)
            const isChineseChar = /[\u4e00-\u9fa5\u3400-\u4dbf]/.test(char);
            
            if (isChineseChar) {
                currentWord += char;
                inWord = true;
            } else {
                if (inWord && currentWord.length >= 2) {
                    // 일정 확률로 괄호 처리 (약 25%)
                    if (Math.random() < 0.25) {
                        processedText += `<span class="placeholder" data-word="${currentWord}">(___)</span>`;
                    } else {
                        processedText += currentWord;
                    }
                } else if (inWord) {
                    processedText += currentWord;
                }
                
                processedText += char;
                currentWord = '';
                inWord = false;
            }
        }
        
        // 마지막 단어 처리
        if (inWord && currentWord.length >= 2) {
            if (Math.random() < 0.25) {
                processedText += `<span class="placeholder" data-word="${currentWord}">(___)</span>`;
            } else {
                processedText += currentWord;
            }
        }
        
        sub.processedText = processedText;
    });
}

// 자막 표시
function displaySubtitles() {
    const subtitlesContainer = document.getElementById('subtitles');
    subtitlesContainer.innerHTML = '';
    
    subtitles.forEach((sub, index) => {
        const div = document.createElement('div');
        div.className = 'subtitle-line';
        div.dataset.index = index;
        div.dataset.start = sub.start;
        div.dataset.end = sub.end;
        div.innerHTML = sub.processedText;
        subtitlesContainer.appendChild(div);
    });
    
    // 괄호 클릭 이벤트 추가
    document.querySelectorAll('.placeholder').forEach(el => {
        el.addEventListener('click', function() {
            this.innerHTML = this.dataset.word;
            this.classList.add('revealed');
        });
    });
}

// 현재 재생 시간에 맞는 자막 하이라이트
function updateSubtitleHighlight() {
    if (!player || subtitles.length === 0) return;
    
    const currentTime = player.getCurrentTime();
    let newIndex = -1;
    
    // 현재 시간에 맞는 자막 찾기
    for (let i = 0; i < subtitles.length; i++) {
        if (currentTime >= subtitles[i].start && currentTime <= subtitles[i].end) {
            newIndex = i;
            break;
        }
    }
    
    // 인덱스가 변경되었을 때만 업데이트
    if (newIndex !== currentSubtitleIndex) {
        document.querySelectorAll('.subtitle-line').forEach(el => {
            el.classList.remove('highlight');
        });
        
        if (newIndex !== -1) {
            const current = document.querySelector(`.subtitle-line[data-index="${newIndex}"]`);
            if (current) {
                current.classList.add('highlight');
                current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        
        currentSubtitleIndex = newIndex;
    }
}
