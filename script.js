let player, subtitles = [], currentSubtitleIndex = -1;
const fixedVideoId = "K9LGQu3QnpU"; // 여기에 고정할 유튜브 ID를 입력하세요
const DEFAULT_SYNC_OFFSET = 4.7; // 기본 싱크 오프셋 (초 단위)
let syncOffset = DEFAULT_SYNC_OFFSET;
let loopingInterval = null; // 반복 재생을 위한 인터벌 변수
let firstDictationIndex = -1;

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    // YouTube API 스크립트 로드
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    
    const dictationJumpBtn = document.getElementById('jump-to-dictation-btn');

    if (dictationJumpBtn) {
        dictationJumpBtn.addEventListener('click', () => {
            jumpToFirstDictation();
        });
    }

    // 단어 발음 버튼 이벤트 리스너
    document.body.addEventListener('click', function(e) {
        if (e.target.id === 'pronunciation-btn' || e.target.closest('#pronunciation-btn')) {
            const word = document.getElementById('vocab-title').textContent;
            if (word) {
                speakChinese(word);
            }
        }
    });
    
    // 예문 발음 버튼 이벤트 리스너
    document.body.addEventListener('click', function(e) {
        if (e.target.id === 'example-pronunciation-btn' || e.target.closest('#example-pronunciation-btn')) {
            const example = document.getElementById('vocab-example-cn').textContent;
            if (example) {
                speakChinese(example);
            }
        }
    });
    
    // 자막 싱크 조절 버튼 이벤트 리스너
    document.getElementById('sync-backward').addEventListener('click', function() {
        syncOffset -= 1;
        updateSyncStatus(syncOffset);
    });
    
    document.getElementById('sync-forward').addEventListener('click', function() {
        syncOffset += 1;
        updateSyncStatus(syncOffset);
    });
    
    // 자막 데이터 자동 로드
    fetchSubtitles();
    
    // 방문한 어휘 스타일 추가
    const style = document.createElement('style');
    style.textContent = `
        .vocab-study.visited {
            background-color: #d4f1f8;
            color: #006064;
            border: 1px solid #00838f;
        }
        
        .vocab-study.active.visited {
            background-color: #80deea;
            color: #004d56;
            border: 1px solid #006064;
        }

        .vocab-dictation.visited {
            background-color: #ffe6cc;
            color: #bf360c;
            border: 1px solid #ff9800;
        }

        .vocab-dictation.active.visited {
            background-color: #ffd699;
            color: #e65100;
            border: 1px solid #f57c00;
        }
    `;
    document.head.appendChild(style);
});

// 싱크 상태 업데이트
function updateSyncStatus(offset) {
    document.getElementById('sync-status').textContent = `자막 싱크: ${offset}초`;
}

// 중국어 발음 재생 (Web Speech API 사용)
function speakChinese(text) {
    if ('speechSynthesis' in window) {
        // 음성 합성 객체 생성
        const utterance = new SpeechSynthesisUtterance(text);
        
        // 중국어(표준어)로 설정
        utterance.lang = 'zh-CN';
        
        // 음성 재생
        window.speechSynthesis.speak(utterance);
    } else {
        console.warn('이 브라우저는 음성 합성을 지원하지 않습니다.');
        alert('이 브라우저는 음성 합성을 지원하지 않습니다. 최신 Chrome, Firefox, Safari, Edge 등의 브라우저를 사용해주세요.');
    }
}

// 시간 문자열을 초 단위로 변환
function timeStringToSeconds(timeStr) {
    const [hms, ms] = timeStr.split(',');
    const [h, m, s] = hms.split(':').map(Number);
    return h * 3600 + m * 60 + s + (parseInt(ms) || 0) / 1000;
}

// YouTube API 준비 완료 시 호출
function onYouTubeIframeAPIReady() {
    console.log("YouTube API 로드됨");
    player = new YT.Player('player', {
        height: '390',
        width: '640',
        videoId: fixedVideoId, // 고정 비디오 ID 사용
        playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            modestbranding: 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

// 플레이어 준비 완료
function onPlayerReady(event) {
    console.log('YouTube 플레이어 준비됨, 고정 비디오 ID:', fixedVideoId);
}

// 플레이어 상태 변경
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        // 재생 시 자막 하이라이트 업데이트 시작
        clearInterval(window.subtitleInterval);
        window.subtitleInterval = setInterval(updateSubtitleHighlight, 100);
    } else if (event.data === YT.PlayerState.ENDED) {
        // 반복 재생 중이라면, 다시 재생
        if (loopingInterval !== null && currentSubtitleIndex >= 0) {
            playSubtitleSegment(currentSubtitleIndex);
        }
    } else {
        // 일시 정지 시 자막 하이라이트 업데이트 중지
        clearInterval(window.subtitleInterval);
    }
}

// 자막 데이터 가져오기
async function fetchSubtitles() {
    try {
        // 여기에 자막 파일의 경로를 지정하세요
        const res = await fetch('shanzhashuzhilian_cnkr_converted.json');
        const raw = await res.json();
        subtitles = raw.map(item => ({
            start: timeStringToSeconds(item.start_time),
            end: timeStringToSeconds(item.end_time),
            text_cn: item.text_cn || "",
            text_kr: item.text_kr || "",
            vocabulary: (item.vocabulary || []).map(v => {
                const {
                    word = "",
                    meaning = "",
                    pinyin = "",
                    example = "",
                    quiz = undefined,
                    type = "study"
                } = v;
                return { word, meaning, pinyin, example, quiz, type };
            })
        }));
        displaySubtitles();
    } catch (err) {
        console.error("자막 로드 오류:", err);
        document.getElementById('subtitles').innerHTML =
            "<div class='error'>자막 데이터를 불러오는 데 실패했습니다. 오류: " + err.message + "</div>";
    }
}

// 자막 화면에 표시
function displaySubtitles() {
    const container = document.getElementById('subtitles');
    container.innerHTML = '';
    
    firstDictationIndex = -1;
    clearDictationFocus();

    subtitles.forEach((sub, index) => {
        const div = document.createElement('div');
        div.className = 'subtitle-line';
        div.dataset.index = index;
        
        let cn = sub.text_cn;
        const hasDictation = sub.vocabulary && sub.vocabulary.some(v => (v.type || 'study') === 'dictation');
        div.dataset.dictation = hasDictation ? 'true' : 'false';
        if (hasDictation && firstDictationIndex === -1) {
            firstDictationIndex = index;
        }
        
        // 어휘가 있을 경우 블랭크 처리
        if (sub.vocabulary && sub.vocabulary.length) {
            sub.vocabulary.forEach(v => {
                // 단어를 정규식으로 찾아 블랭크로 대체
                const wordPattern = new RegExp(v.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                // 퀴즈 데이터도 함께 저장
                const quizData = v.quiz ? JSON.stringify(v.quiz).replace(/"/g, '&quot;') : '';
                const type = v.type || 'study';
                const typeClass = type === 'dictation' ? 'vocab-dictation' : 'vocab-study';
                const safeWord = (v.word || '').replace(/'/g, '&#39;');
                const safeMeaning = (v.meaning || '').replace(/'/g, '&#39;');
                const safePinyin = (v.pinyin || '').replace(/'/g, '&#39;');
                const safeExample = (v.example || '').replace(/'/g, '&#39;');
                cn = cn.replace(
                    wordPattern,
                    `<span class='vocab ${typeClass}' data-type='${type}' data-word='${safeWord}' data-pinyin='${safePinyin}' data-meaning='${safeMeaning}' data-example='${safeExample}' data-quiz='${quizData}'>____</span>`
                );
            });
        }
        
        // 반복 청취 버튼 추가
        const repeatBtnClass = hasDictation ? 'repeat-btn dictation' : 'repeat-btn study';
        div.innerHTML = `
            <div class="cn-text">${cn}</div>
            <div class="kr-text">${sub.text_kr}</div>
            <button class="${repeatBtnClass}" data-index="${index}">반복</button>
        `;
        
        container.appendChild(div);
    });
    
    updateDictationShortcutState();

    // 블랭크 클릭 이벤트 추가
    document.querySelectorAll('.vocab').forEach(el => {
        el.addEventListener('click', (e) => {
            // 클릭한 어휘 하이라이트
            document.querySelectorAll('.vocab').forEach(v => v.classList.remove('active'));
            e.target.classList.add('active');
            
            // 어휘 정보 표시
            const decode = (value) => (value || '').replace(/&#39;/g, "'");
            const word = decode(e.target.dataset.word);
            const meaning = decode(e.target.dataset.meaning);
            const pinyin = decode(e.target.dataset.pinyin);
            const example = decode(e.target.dataset.example);
            const quizData = e.target.dataset.quiz;
            const type = e.target.dataset.type || 'study';
            
            displayVocabDetail(word, pinyin, meaning, example, quizData, type);
            
            // 퀴즈 데이터가 있으면 바로 퀴즈 시작 (3번 요구사항)
            if (quizData && quizData !== 'undefined') {
                startQuiz(word);
            }
            
            // 클릭한 어휘 색상 변경 (4번 요구사항)
            e.target.classList.add('visited');
        });
    });
    
    // 반복 재생 버튼 이벤트 추가 - 토글 기능 (2번 요구사항)
    document.querySelectorAll('.repeat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            
            // 이미 활성화된 버튼이면 반복 중지
            if (btn.classList.contains('active')) {
                stopRepeatPlayback();
                btn.textContent = '반복'; // 버튼 텍스트 원래대로
            } else {
                // 반복 시작
                startRepeatPlayback(index);
                
                // 다른 모든 버튼의 텍스트는 '반복'으로
                document.querySelectorAll('.repeat-btn').forEach(otherBtn => {
                    if (otherBtn !== btn) {
                        otherBtn.textContent = '반복';
                    }
                });
            }
        });
    });
}

function updateDictationShortcutState() {
    const btn = document.getElementById('jump-to-dictation-btn');
    if (!btn) return;
    
    if (firstDictationIndex >= 0) {
        btn.disabled = false;
        btn.title = '첫 번째 받아쓰기 구간으로 이동합니다.';
    } else {
        btn.disabled = true;
        btn.title = '받아쓰기 블랭크가 있는 구간이 없습니다.';
    }
}

function clearDictationFocus() {
    document.querySelectorAll('.subtitle-line.dictation-focus').forEach(el => {
        el.classList.remove('dictation-focus');
    });
}

function jumpToFirstDictation() {
    if (firstDictationIndex < 0) return;
    
    const target = document.querySelector(`.subtitle-line[data-index='${firstDictationIndex}']`);
    if (!target) return;
    
    clearDictationFocus();
    target.classList.add('dictation-focus');
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
}

// 어휘 정보 표시
function displayVocabDetail(word, pinyin, meaning, example, quizData, type = 'study') {
    document.getElementById('no-vocab-message').style.display = 'none';
    document.getElementById('vocab-content').style.display = 'block';
    
    document.getElementById('vocab-title').textContent = word;
    
    const detailEl = document.getElementById('vocab-detail');
    if (detailEl) {
        detailEl.dataset.type = type;
    }

    const pinyinEl = document.getElementById('vocab-pinyin');
    const meaningEl = document.getElementById('vocab-meaning');
    const typeBadgeEl = document.getElementById('vocab-type-badge');
    
    pinyinEl.textContent = pinyin;
    pinyinEl.style.display = pinyin ? 'block' : 'none';
    
    const meaningText = meaning || (type === 'dictation' ? '받아쓰기용 블랭크 (설명 없음)' : '');
    meaningEl.textContent = meaningText;
    meaningEl.style.display = meaningText ? 'block' : 'none';
    
    if (typeBadgeEl) {
        typeBadgeEl.textContent = type === 'dictation' ? '받아쓰기' : '학습';
        typeBadgeEl.classList.remove('dictation', 'study');
        typeBadgeEl.classList.add(type === 'dictation' ? 'dictation' : 'study');
        typeBadgeEl.style.display = 'inline-block';
    }
    
    // 예문 분리 (중국어/한국어)
    const exampleContainer = document.querySelector('#vocab-content .example');
    if (example && example.trim().length) {
        const exampleParts = example.split('(');
        if (exampleParts.length > 1) {
            document.getElementById('vocab-example-cn').textContent = exampleParts[0].trim();
            document.getElementById('vocab-example-kr').textContent = '(' + exampleParts[1];
        } else {
            document.getElementById('vocab-example-cn').textContent = example;
            document.getElementById('vocab-example-kr').textContent = '';
        }
        exampleContainer.style.display = 'block';
    } else if (exampleContainer) {
        exampleContainer.style.display = 'none';
        document.getElementById('vocab-example-cn').textContent = '';
        document.getElementById('vocab-example-kr').textContent = '';
    }
    
    // 퀴즈 정보 처리 - 퀴즈 버튼 숨기기 (자동 시작으로 변경)
    document.getElementById('vocab-quiz-container').style.display = 'none';
}

// 현재 자막 하이라이트 업데이트
function updateSubtitleHighlight() {
    if (!player || !subtitles.length) return;
    
    // 현재 재생 시간에 싱크 오프셋 적용
    const currentTime = player.getCurrentTime() + syncOffset;
    
    let activeSubtitleFound = false;
    
    subtitles.forEach((sub, index) => {
        const el = document.querySelector(`.subtitle-line[data-index='${index}']`);
        if (!el) return;
        
        // 현재 자막의 시작과 끝 시간 확인
        if (currentTime >= sub.start && currentTime <= sub.end) {
            // 현재 재생 중인 자막 하이라이트
            if (!el.classList.contains('highlight')) {
                el.classList.add('highlight');
                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                currentSubtitleIndex = index;
            }
            activeSubtitleFound = true;
        } else if (index !== currentSubtitleIndex) {
            // 현재 활성화된 자막이 아니면 하이라이트 제거
            el.classList.remove('highlight');
        }
    });
    
    // 만약 활성화된 자막이 없고, 현재 시간이 다음 자막의 시작 시간보다 작으면
    // 현재 활성화된 자막의 하이라이트 유지
    if (!activeSubtitleFound && currentSubtitleIndex >= 0) {
        const nextSubIndex = currentSubtitleIndex + 1;
        
        // 다음 자막이 있고, 현재 시간이 다음 자막의 시작 시간보다 작으면 하이라이트 유지
        if (nextSubIndex < subtitles.length && currentTime < subtitles[nextSubIndex].start) {
            // 하이라이트 유지 (아무 작업 안 함)
        } else {
            // 그렇지 않으면 하이라이트 제거
            const currentEl = document.querySelector(`.subtitle-line[data-index='${currentSubtitleIndex}']`);
            if (currentEl) {
                currentEl.classList.remove('highlight');
            }
            currentSubtitleIndex = -1;
        }
    }
}

// 어휘 배열 퀴즈 시작
function startQuiz(word) {
    // 클릭한 어휘의 퀴즈 데이터 가져오기
    const vocabElement = document.querySelector(`.vocab.active`);
    if (!vocabElement) return;
    
    const quizDataStr = vocabElement.dataset.quiz;
    if (!quizDataStr) {
        console.error('퀴즈 데이터가 없습니다.');
        return;
    }
    
    try {
        const quizData = JSON.parse(quizDataStr.replace(/&quot;/g, '"'));
        
        // 퀴즈 UI 생성 - 전체 문장은 표시하지 않음
        const quizContainer = document.getElementById('vocab-quiz-container');
        quizContainer.innerHTML = `
            <div class="quiz-content">
                <h3>어휘 배열 퀴즈</h3>
                <p>다음 단어들을 올바른 순서로 배열하세요:</p>
                <div class="tokens-container"></div>
                <div class="answer-container"></div>
                <div class="quiz-buttons">
                    <button id="check-answer-btn">정답 확인</button>
                    <button id="reset-quiz-btn">다시 시작</button>
                </div>
                <div class="quiz-result"></div>
            </div>
        `;
        quizContainer.style.display = 'block';
        
        // 토큰(단어) 버튼 생성
        const tokensContainer = quizContainer.querySelector('.tokens-container');
        const shuffledTokens = [...quizData.tokens].sort(() => Math.random() - 0.5);
        
        shuffledTokens.forEach(token => {
            const tokenBtn = document.createElement('button');
            tokenBtn.className = 'token-btn';
            tokenBtn.textContent = token;
            tokenBtn.addEventListener('click', () => {
                // 이미 선택된 토큰은 다시 선택 불가
                if (tokenBtn.classList.contains('selected')) return;
                
                // 토큰 선택 처리
                tokenBtn.classList.add('selected');
                
                // 답변 영역에 토큰 추가
                const answerContainer = quizContainer.querySelector('.answer-container');
                const answerToken = document.createElement('span');
                answerToken.className = 'answer-token';
                answerToken.textContent = token;
                answerToken.dataset.original = token;
                
                // 토큰 클릭 시 제거 기능
                answerToken.addEventListener('click', () => {
                    // 답변에서 토큰 제거
                    answerToken.remove();
                    
                    // 토큰 버튼 다시 활성화
                    const tokenBtns = tokensContainer.querySelectorAll('.token-btn');
                    for (let btn of tokenBtns) {
                        if (btn.textContent === token && btn.classList.contains('selected')) {
                            btn.classList.remove('selected');
                            break;
                        }
                    }
                });
                
                answerContainer.appendChild(answerToken);
            });
            tokensContainer.appendChild(tokenBtn);
        });
        
        // 정답 확인 버튼 이벤트
        quizContainer.querySelector('#check-answer-btn').addEventListener('click', () => {
            const answerTokens = quizContainer.querySelectorAll('.answer-token');
            const userAnswer = Array.from(answerTokens).map(token => token.dataset.original);
            
            const resultElement = quizContainer.querySelector('.quiz-result');
            
            // 정답 비교
            let isCorrect = true;
            if (userAnswer.length !== quizData.tokens.length) {
                isCorrect = false;
            } else {
                for (let i = 0; i < userAnswer.length; i++) {
                    if (userAnswer[i] !== quizData.tokens[i]) {
                        isCorrect = false;
                        break;
                    }
                }
            }
            
            if (isCorrect) {
                resultElement.innerHTML = `
                    <div class="correct">정답입니다! 👏</div>
                    <div class="correct-sentence">${quizData.text_cn}</div>
                `;
                // 문장 발음 버튼 추가
                const pronunciationBtn = document.createElement('button');
                pronunciationBtn.className = 'pronunciation-btn';
                pronunciationBtn.textContent = '문장 발음 듣기';
                pronunciationBtn.addEventListener('click', () => {
                    speakChinese(quizData.text_cn);
                });
                resultElement.appendChild(pronunciationBtn);
            } else {
                resultElement.innerHTML = `
                    <div class="incorrect">틀렸습니다. 다시 시도해보세요.</div>
                `;
            }
        });
        
        // 퀴즈 리셋 버튼 이벤트
        quizContainer.querySelector('#reset-quiz-btn').addEventListener('click', () => {
            // 토큰 버튼 초기화
            const tokenBtns = tokensContainer.querySelectorAll('.token-btn');
            tokenBtns.forEach(btn => btn.classList.remove('selected'));
            
            // 답변 영역 초기화
            quizContainer.querySelector('.answer-container').innerHTML = '';
            
            // 결과 초기화
            quizContainer.querySelector('.quiz-result').innerHTML = '';
        });
        
    } catch (e) {
        console.error('퀴즈 시작 오류:', e);
        alert('퀴즈를 시작하는 중 오류가 발생했습니다.');
    }
}

// 특정 자막 세그먼트 재생
function playSubtitleSegment(index) {
    if (!player || index < 0 || index >= subtitles.length) return;
    
    const subtitle = subtitles[index];
    // 싱크 오프셋 적용하여 시작 시간 계산
    const startTime = Math.max(0, subtitle.start - syncOffset);
    
    // 비디오 해당 위치로 이동하고 재생
    player.seekTo(startTime, true);
    player.playVideo();
}

// 반복 재생 시작
function startRepeatPlayback(index) {
    // 기존 반복 재생 중지
    stopRepeatPlayback();
    
    if (!player || index < 0 || index >= subtitles.length) return;
    
    const subtitle = subtitles[index];
    
    // 싱크 오프셋 적용하여 시작/종료 시간 계산
    const startTime = Math.max(0, subtitle.start - syncOffset);
    const endTime = subtitle.end - syncOffset;
    
    // 구간이 너무 짧으면 최소 재생 시간 보장 (최소 3초)
    const minDuration = 3;
    const actualEndTime = (endTime - startTime < minDuration) ? startTime + minDuration : endTime;
    
    console.log(`반복 재생 설정: 시작=${startTime.toFixed(2)}초, 종료=${actualEndTime.toFixed(2)}초, 구간=${(actualEndTime-startTime).toFixed(2)}초`);
    
    // 해당 세그먼트 재생 시작
    player.seekTo(startTime, true);
    player.playVideo();
    
    // 반복 재생을 위한 인터벌 설정
    loopingInterval = setInterval(() => {
        const currentTime = player.getCurrentTime();
        // 현재 시간이 종료 시간을 지났거나 가까우면 다시 시작 지점으로 이동
        if (currentTime >= actualEndTime - 0.3) {
            player.seekTo(startTime, true);
        }
    }, 200); // 더 자주 체크 (200ms마다)
    
    // 반복 버튼 활성화 표시
    document.querySelectorAll('.repeat-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.repeat-btn[data-index="${index}"]`);
    activeBtn.classList.add('active');
    activeBtn.textContent = '중지'; // 버튼 텍스트 변경
    
    // 현재 반복 중인 인덱스 저장
    currentSubtitleIndex = index;
}

// 반복 재생 중지
function stopRepeatPlayback() {
    if (loopingInterval !== null) {
        clearInterval(loopingInterval);
        loopingInterval = null;
        
        // 반복 버튼 비활성화 및 텍스트 원래대로
        document.querySelectorAll('.repeat-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.textContent = '반복';
        });
    }
}
