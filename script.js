// YouTube Player API 변수
let player;
let currentVideoId = '';
let subtitles = [];
let currentSubtitleIndex = -1;

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
        setInterval(updateSubtitleHighlight, 100);
    }
}

// 비디오 로드
function loadVideo() {
    const videoId = document.getElementById('videoId').value;
    if (videoId) {
        currentVideoId = videoId;
        player.loadVideoById(videoId);
        loadSubtitles(videoId);
    }
}

// 자막 로드 (임시 예시 데이터)
function loadSubtitles(videoId) {
    // 실제로는 여기서 자막 API를 호출해야 함
    // 지금은 예시 데이터로 테스트
    subtitles = [
        { start: 0, end: 5, text: "Hello and welcome to this video." },
        { start: 5, end: 10, text: "Today we will learn about language learning." },
        { start: 10, end: 15, text: "Learning a new language can be challenging but rewarding." },
        { start: 15, end: 20, text: "Let's start with some basic vocabulary." }
    ];
    
    processSubtitles();
    displaySubtitles();
}

// 자막 처리 (단어 선택 및 괄호 처리)
function processSubtitles() {
    // 나중에 API 호출을 통해 단어 선택 로직 개선 필요
    subtitles.forEach(sub => {
        const words = sub.text.split(' ');
        // 예시: 5글자 이상인 단어를 괄호 처리
        for(let i = 0; i < words.length; i++) {
            if (words[i].length >= 5) {
                const word = words[i];
                words[i] = `<span class="placeholder" data-word="${word}">(____)</span>`;
            }
        }
        sub.processedText = words.join(' ');
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
