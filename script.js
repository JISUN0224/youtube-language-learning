// 전역 변수
let player;
let subtitles = [];
let currentSubtitleIndex = -1;
let subtitleUpdateInterval;
let difficulty = 2; // 1: 초급, 2: 중급, 3: 고급
let bracketPercentage = 30; // 괄호 처리 비율 (%)

// 난이도 레벨 이름
const difficultyNames = ['초급', '중급', '고급'];

// 중요 단어 목록 (난이도별)
const vocabularyLevels = {
    beginner: ["文化大革命", "学校", "农村", "英雄树", "山楂树", "抗日战争", "革命", "祖国", "人民", 
               "号召", "传统", "学生", "教育", "红花", "血", "鲜血", "开花", "牺牲", "枪杀"],
    
    intermediate: ["有名", "称为", "献身", "先烈", "如火如荼", "无数", "英勇", "响应", "前赴后继", 
                  "浇灌", "可歌可泣", "彻底", "地质勘探", "劳动改造", "走资派", "糊弄", "转正期"],
    
    advanced: ["之所以", "见证", "年代", "侵略者", "鬼子", "素材", "编写", "贫下中农", "革命教育", 
               "贫下中农", "难听", "摸摸捏捏", "原来", "人言可畏", "知识份子"]
};

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, setting up event listeners');
    
    // 단어 난이도 슬라이더 이벤트 리스너
    const difficultySlider = document.getElementById('difficultySlider');
    const difficultyValue = document.getElementById('difficultyValue');
    
    if (difficultySlider && difficultyValue) {
        difficultySlider.addEventListener('input', function() {
            difficulty = parseInt(this.value);
            difficultyValue.textContent = difficultyNames[difficulty - 1];
        });
    }
    
    // 괄호 처리 비율 슬라이더 이벤트 리스너
    const percentageSlider = document.getElementById('percentageSlider');
    const percentageValue = document.getElementById('percentageValue');
    
    if (percentageSlider && percentageValue) {
        percentageSlider.addEventListener('input', function() {
            bracketPercentage = parseInt(this.value);
            percentageValue.textContent = bracketPercentage + '%';
        });
    }
    
    // 로드 버튼 이벤트 리스너
    const loadButton = document.getElementById('loadButton');
    if (loadButton) {
        loadButton.addEventListener('click', loadVideoAndSubtitles);
    }
    
    // 자막 파일 입력 이벤트 리스너
    const subtitleFile = document.getElementById('subtitleFile');
    if (subtitleFile) {
        subtitleFile.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                // 파일 이름 표시
                const fileName = file.name;
                console.log(`자막 파일 선택됨: ${fileName}`);
            }
        });
    }
});

// 동영상 및 자막 로드
function loadVideoAndSubtitles() {
    // 동영상 ID 또는 URL 가져오기
    const videoInput = document.getElementById('videoInput').value.trim();
    if (!videoInput) {
        alert('YouTube 동영상 ID 또는 URL을 입력해주세요.');
        return;
    }
    
    // URL에서 ID 추출 또는 ID 그대로 사용
    let videoId = videoInput;
    if (videoInput.includes('youtube.com') || videoInput.includes('youtu.be')) {
        const urlObj = new URL(videoInput);
        if (videoInput.includes('youtube.com')) {
            videoId = urlObj.searchParams.get('v');
        } else if (videoInput.includes('youtu.be')) {
            videoId = urlObj.pathname.substring(1);
        }
    }
    
    if (!videoId) {
        alert('올바른 YouTube 동영상 ID 또는 URL을 입력해주세요.');
        return;
    }
    
    // 자막 파일 처리
    const subtitleFile = document.getElementById('subtitleFile').files[0];
    if (!subtitleFile) {
        alert('자막 파일을 업로드해주세요.');
        return;
    }
    
    // 파일 확장자 확인
    const fileExtension = subtitleFile.name.split('.').pop().toLowerCase();
    if (fileExtension !== 'smi') {
        alert('SMI 형식의 자막 파일만 지원합니다.');
        return;
    }
    
    // YouTube 플레이어 초기화
    if (player) {
        player.destroy();
    }
    
    player = new YT.Player('player', {
        height: '390',
        width: '640',
        videoId: videoId,
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
    
    // 자막 파일 읽기
    readSubtitleFile(subtitleFile);
}

// 플레이어 준비 완료
function onPlayerReady(event) {
    console.log('Player ready');
}

// 플레이어 오류 발생
function onPlayerError(event) {
    console.error('YouTube Player Error:', event.data);
    alert('비디오 로드 중 오류가 발생했습니다. 코드: ' + event.data);
}

// 플레이어 상태 변경
function onPlayerStateChange(event) {
    console.log('Player state changed:', event.data);
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

// 자막 파일 읽기
function readSubtitleFile(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const content = e.target.result;
        parseSMI(content);
    };
    
    reader.onerror = function() {
        alert('파일을 읽는 중 오류가 발생했습니다.');
    };
    
    reader.readAsText(file);
}

// SMI 파일 파싱
function parseSMI(content) {
    // 자막 배열 초기화
    subtitles = [];
    
    // 중국어 클래스 이름 확인 (일반적으로 CNCC)
    const chineseClassMatch = content.match(/Class=([A-Z]+)/i);
    const chineseClass = chineseClassMatch ? chineseClassMatch[1] : 'CNCC';
    
    // 자막 블록 추출
    const syncBlocks = content.match(/<SYNC[^>]*>[\s\S]*?(?=<SYNC|$)/gi);
    
    if (!syncBlocks || syncBlocks.length === 0) {
        alert('자막을 파싱할 수 없습니다.');
        return;
    }
    
    // 각 자막 블록 처리
    syncBlocks.forEach(block => {
        const startMatch = block.match(/<SYNC Start=(\d+)/i);
        if (!startMatch) return;
        
        const start = parseFloat(startMatch[1]) / 1000; // 밀리초를 초로 변환
        
        // 중국어 자막 텍스트 추출
        const classRegex = new RegExp(`<P Class=${chineseClass}>(.*?)<`, 'i');
        const textMatch = block.match(classRegex);
        
        if (textMatch && textMatch[1] && textMatch[1].trim() !== '&nbsp;') {
            const text = textMatch[1].trim()
                           .replace(/\*([^*]+)\*/g, '$1') // * 표시 제거
                           .replace(/<br>/gi, ' '); // <br> 태그를 공백으로 변환
            
            // 이전 자막의 끝 시간을 현재 자막의 시작 시간으로 설정
            if (subtitles.length > 0) {
                subtitles[subtitles.length - 1].end = start;
            }
            
            // 자막 추가
            subtitles.push({
                start: start,
                end: start + 5, // 임시로 5초 지정 (다음 자막에서 업데이트됨)
                text: text
            });
        }
    });
    
    // 마지막 자막의 끝 시간 설정
    if (subtitles.length > 0) {
        subtitles[subtitles.length - 1].end = subtitles[subtitles.length - 1].start + 5;
    }
    
    console.log(`파싱된 자막 수: ${subtitles.length}`);
    
    // 중요 단어 괄호 처리 및 표시
    processAndDisplaySubtitles();
}

// 난이도에 따라 괄호 처리할 단어 목록 생성
function getWordsToHide() {
    let wordsToHide = [];
    
    if (difficulty >= 1) {
        wordsToHide = wordsToHide.concat(vocabularyLevels.beginner);
    }
    
    if (difficulty >= 2) {
        wordsToHide = wordsToHide.concat(vocabularyLevels.intermediate);
    }
    
    if (difficulty >= 3) {
        wordsToHide = wordsToHide.concat(vocabularyLevels.advanced);
    }
    
    return wordsToHide;
}

// 자막 처리 및 표시
function processAndDisplaySubtitles() {
    if (subtitles.length === 0) {
        alert('처리할 자막이 없습니다.');
        return;
    }
    
    const wordsToHide = getWordsToHide();
    
    // 자막 처리
    subtitles.forEach(sub => {
        sub.processedText = processText(sub.text, wordsToHide);
    });
    
    // 자막 표시
    displaySubtitles();
}

// 텍스트에서 특정 단어를 괄호로 처리하는 함수
function processText(text, wordsToHide) {
    let processedText = text;
    
    // 단어 목록을 길이 기준으로 내림차순 정렬 (긴 단어부터 처리)
    const sortedWords = [...wordsToHide].sort((a, b) => b.length - a.length);
    
    // 이미 처리된 단어의 위치를 추적하기 위한 배열
    const processedPositions = [];
    
    // 각 단어에 대해 처리
    sortedWords.forEach(word => {
        // 현재 단어가 텍스트에 존재하는지 확인
        let index = processedText.indexOf(word);
        
        while (index !== -1) {
            // 이미 처리된 위치인지 확인
            let isAlreadyProcessed = false;
            for (const [start, end] of processedPositions) {
                if (index >= start && index < end) {
                    isAlreadyProcessed = true;
                    break;
                }
            }
            
            // 아직 처리되지 않았고, 랜덤 확률이 괄호 처리 비율 이하인 경우
            if (!isAlreadyProcessed && Math.random() * 100 <= bracketPercentage) {
                // 단어를 괄호로 처리
                const before = processedText.substring(0, index);
                const after = processedText.substring(index + word.length);
                processedText = before + `<span class="placeholder">(${word})</span>` + after;
                
                // 처리된 위치 추가 (HTML 태그 길이 고려)
                const placeholder = `<span class="placeholder">(${word})</span>`;
                processedPositions.push([index, index + placeholder.length]);
                
                // 다음 검색 위치 조정
                index = processedText.indexOf(word, index + placeholder.length);
            } else {
                // 다음 위치에서 계속 검색
                index = processedText.indexOf(word, index + 1);
            }
        }
    });
    
    return processedText;
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
        div.innerHTML = sub.processedText || sub.text;
        subtitlesContainer.appendChild(div);
    });
    
    // 괄호 클릭 이벤트 추가
    document.querySelectorAll('.placeholder').forEach(el => {
        el.addEventListener('click', function() {
            const word = this.textContent.substring(1, this.textContent.length - 1); // 괄호 제거
            this.textContent = word;
            this.classList.add('revealed');
        });
    });
}

// 현재 재생 시간에 맞는 자막 하이라이트
function updateSubtitleHighlight() {
    if (!player || subtitles.length === 0) return;
    
    try {
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
    } catch (error) {
        console.error('하이라이트 업데이트 오류:', error);
    }
}
