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
    document.getElementById('loadVideoAndSubtitles').addEventListener('click', loadVideoAndSubtitles);
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

// 비디오 및 자막 로드
function loadVideoAndSubtitles() {
    const videoId = document.getElementById('videoId').value;
    const subtitleFile = document.getElementById('subtitleFile').files[0];
    
    if (!videoId) {
        alert('YouTube 비디오 ID를 입력해주세요.');
        return;
    }
    
    if (!subtitleFile) {
        alert('자막 파일을 업로드해주세요.');
        return;
    }
    
    // 비디오 로드
    currentVideoId = videoId;
    player.loadVideoById(videoId);
    
    // 자막 파일 처리
    processSubtitleFile(subtitleFile);
}

// 자막 파일 처리
function processSubtitleFile(file) {
    const subtitlesContainer = document.getElementById('subtitles');
    subtitlesContainer.innerHTML = '<div class="loading">자막 파일을 처리 중...</div>';
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const content = e.target.result;
        const extension = file.name.split('.').pop().toLowerCase();
        
        // 파일 형식에 따라 적절한 파서 호출
        if (extension === 'smi') {
            parseAndProcessSMI(content);
        } else if (extension === 'srt') {
            parseAndProcessSRT(content);
        } else if (extension === 'vtt') {
            parseAndProcessVTT(content);
        } else {
            subtitlesContainer.innerHTML = '<div class="error">지원되지 않는 자막 파일 형식입니다.</div>';
        }
    };
    
    reader.onerror = function() {
        subtitlesContainer.innerHTML = '<div class="error">파일을 읽는 중 오류가 발생했습니다.</div>';
    };
    
    reader.readAsText(file);
}

// SMI 파일 파싱 및 처리
function parseAndProcessSMI(content) {
    try {
        // 자막 배열 초기화
        subtitles = [];
        
        // 중국어 클래스 이름 확인 (일반적으로 CNCC)
        const chineseClassMatch = content.match(/Class=([A-Z]+)/i);
        const chineseClass = chineseClassMatch ? chineseClassMatch[1] : 'CNCC';
        
        // 자막 블록 추출
        const syncBlocks = content.match(/<SYNC[^>]*>[\s\S]*?(?=<SYNC|$)/gi);
        
        if (!syncBlocks || syncBlocks.length === 0) {
            throw new Error('자막 블록을 찾을 수 없습니다.');
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
        
        // 자막 처리 및 표시
        processSubtitles();
        displaySubtitles();
        
    } catch (error) {
        console.error('SMI 파싱 오류:', error);
        document.getElementById('subtitles').innerHTML = 
            `<div class="error">자막 파일 파싱 중 오류가 발생했습니다: ${error.message}</div>`;
    }
}

// SRT 파일 파싱 및 처리 (필요시 구현)
function parseAndProcessSRT(content) {
    try {
        // 자막 배열 초기화
        subtitles = [];
        
        // SRT 형식 파싱 (번호 --> 시간 --> 텍스트)
        const subtitleBlocks = content.split(/\r?\n\r?\n/);
        
        subtitleBlocks.forEach(block => {
            const lines = block.trim().split(/\r?\n/);
            if (lines.length < 3) return;
            
            // 시간 정보 추출 (00:00:00,000 --> 00:00:00,000 형식)
            const timeMatch = lines[1].match(/(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)/);
            if (!timeMatch) return;
            
            // 시작 시간 계산 (시:분:초,밀리초)
            const startHours = parseInt(timeMatch[1]);
            const startMinutes = parseInt(timeMatch[2]);
            const startSeconds = parseInt(timeMatch[3]);
            const startMilliseconds = parseInt(timeMatch[4]);
            const start = startHours * 3600 + startMinutes * 60 + startSeconds + startMilliseconds / 1000;
            
            // 종료 시간 계산
            const endHours = parseInt(timeMatch[5]);
            const endMinutes = parseInt(timeMatch[6]);
            const endSeconds = parseInt(timeMatch[7]);
            const endMilliseconds = parseInt(timeMatch[8]);
            const end = endHours * 3600 + endMinutes * 60 + endSeconds + endMilliseconds / 1000;
            
            // 자막 텍스트 (3번째 줄부터)
            const text = lines.slice(2).join(' ');
            
            // 자막 추가
            if (text.trim() !== '') {
                subtitles.push({
                    start: start,
                    end: end,
                    text: text
                });
            }
        });
        
        console.log(`파싱된 자막 수: ${subtitles.length}`);
        
        // 자막 처리 및 표시
        processSubtitles();
        displaySubtitles();
        
    } catch (error) {
        console.error('SRT 파싱 오류:', error);
        document.getElementById('subtitles').innerHTML = 
            `<div class="error">자막 파일 파싱 중 오류가 발생했습니다: ${error.message}</div>`;
    }
}

// VTT 파일 파싱 및 처리 (필요시 구현)
function parseAndProcessVTT(content) {
    try {
        // 자막 배열 초기화
        subtitles = [];
        
        // WEBVTT 헤더 제거
        const lines = content.replace(/^WEBVTT\r?\n/, '').split(/\r?\n/);
        let currentSubtitle = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 빈 줄 무시
            if (line === '') continue;
            
            // 시간 정보 확인 (00:00:00.000 --> 00:00:00.000 형식)
            const timeMatch = line.match(/(\d+):(\d+):(\d+)\.(\d+)\s*-->\s*(\d+):(\d+):(\d+)\.(\d+)/);
            if (timeMatch) {
                // 이전 자막 저장
                if (currentSubtitle) {
                    subtitles.push(currentSubtitle);
                }
                
                // 시작 시간 계산 (시:분:초.밀리초)
                const startHours = parseInt(timeMatch[1]);
                const startMinutes = parseInt(timeMatch[2]);
                const startSeconds = parseInt(timeMatch[3]);
                const startMilliseconds = parseInt(timeMatch[4]);
                const start = startHours * 3600 + startMinutes * 60 + startSeconds + startMilliseconds / 1000;
                
                // 종료 시간 계산
                const endHours = parseInt(timeMatch[5]);
                const endMinutes = parseInt(timeMatch[6]);
                const endSeconds = parseInt(timeMatch[7]);
                const endMilliseconds = parseInt(timeMatch[8]);
                const end = endHours * 3600 + endMinutes * 60 + endSeconds + endMilliseconds / 1000;
                
                // 새 자막 준비
                currentSubtitle = {
                    start: start,
                    end: end,
                    text: ''
                };
            } 
            // 자막 텍스트 처리
            else if (currentSubtitle) {
                if (currentSubtitle.text) {
                    currentSubtitle.text += ' ' + line;
                } else {
                    currentSubtitle.text = line;
                }
            }
        }
        
        // 마지막 자막 저장
        if (currentSubtitle && currentSubtitle.text.trim() !== '') {
            subtitles.push(currentSubtitle);
        }
        
        console.log(`파싱된 자막 수: ${subtitles.length}`);
        
        // 자막 처리 및 표시
        processSubtitles();
        displaySubtitles();
        
    } catch (error) {
        console.error('VTT 파싱 오류:', error);
        document.getElementById('subtitles').innerHTML = 
            `<div class="error">자막 파일 파싱 중 오류가 발생했습니다: ${error.message}</div>`;
    }
}

// 자막 처리 (단어 선택 및 괄호 처리)
function processSubtitles() {
    // 모든 자막 라인에 대해 처리
    subtitles.forEach(sub => {
        const text = sub.text.replace(/<[^>]*>/g, ''); // HTML 태그 제거
        
        // 중국어 단어 찾기 (2자 이상인 단어 찾기)
        let processedText = '';
        let inWord = false;
        let currentWord = '';
        let currentWordStart = 0;
        let positions = [];
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            // 한자 범위인지 확인
            const isChineseChar = /[\u4e00-\u9fa5\u3400-\u4dbf]/.test(char);
            
            if (isChineseChar) {
                if (!inWord) {
                    currentWordStart = i;
                    inWord = true;
                }
                currentWord += char;
            } else {
                if (inWord) {
                    if (currentWord.length >= 2) {
                        positions.push({
                            start: currentWordStart,
                            end: i,
                            word: currentWord
                        });
                    }
                    inWord = false;
                    currentWord = '';
                }
            }
        }
        
        // 마지막 단어 처리
        if (inWord && currentWord.length >= 2) {
            positions.push({
                start: currentWordStart,
                end: text.length,
                word: currentWord
            });
        }
        
        // 일정 비율의 단어만 괄호로 처리 (약 30%)
        const wordsToHide = Math.ceil(positions.length * 0.3);
        const selectedPositions = [];
        
        // 무작위로 단어 선택
        while (selectedPositions.length < wordsToHide && positions.length > 0) {
            const randomIndex = Math.floor(Math.random() * positions.length);
            selectedPositions.push(positions[randomIndex]);
            positions.splice(randomIndex, 1);
        }
        
        // 선택된 위치를 start 기준으로 정렬
        selectedPositions.sort((a, b) => a.start - b.start);
        
        // 텍스트에 괄호 처리 적용
        let lastIndex = 0;
        processedText = '';
        
        for (const pos of selectedPositions) {
            processedText += text.substring(lastIndex, pos.start);
            processedText += `<span class="placeholder" data-word="${pos.word}">(___)</span>`;
            lastIndex = pos.end;
        }
        
        // 나머지 텍스트 추가
        processedText += text.substring(lastIndex);
        
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
