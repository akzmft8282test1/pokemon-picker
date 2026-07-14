const express = require('express');
const axios = require('axios');
const path = require('path');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// HTTP & Socket.io 서버 구성 (17번: 실시간 자랑방 알림용)
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const MAX_POKEMON = 1025;

// Socket.io 연결 관리
io.on('connection', (socket) => {
    console.log('클라이언트 소켓 연결 성공:', socket.id);
});

// 한국어 타입 매핑 딕셔너리
const typeKoNames = {
    'normal': '노말', 'fire': '불꽃', 'water': '물', 'electric': '전기',
    'grass': '풀', 'ice': '얼음', 'fighting': '격투', 'poison': '독',
    'ground': '땅', 'flying': '비행', 'psychic': '에스퍼', 'bug': '벌레',
    'rock': '바위', 'ghost': '고스트', 'dragon': '드래곤', 'steel': '강철',
    'fairy': '페어리', 'dark': '악'
};

// PokeAPI 상세 데이터를 캐싱 및 가공하는 헬퍼 함수
async function fetchPokemonFromAPI(id, isShiny = false) {
    try {
        // 1. 한국어 이름 및 한 줄 도감 설명(Flavor Text) 로드 (13번 구현)
        const speciesResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
        const speciesData = speciesResponse.data;
        const koreanNameObj = speciesData.names.find(n => n.language.name === 'ko');
        const name = koreanNameObj ? koreanNameObj.name : speciesData.name;
        const number = `No. ${String(id).padStart(4, '0')}`;
        const url = `https://pokemonkorea.co.kr/pokedex/view/${id}`;

        // 한국어 한 줄 도감 설명 추출 (줄바꿈 제거)
        const koFlavorObj = speciesData.flavor_text_entries.find(e => e.language.name === 'ko');
        const flavorText = koFlavorObj ? koFlavorObj.flavor_text.replace(/\r?\n|\r/g, ' ') : '정보가 없는 포켓몬입니다.';

        // 2. 기본 pokemon API 호출 (이미지, 타입, 능력치 획득 - 10, 12번 구현)
        let image = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
        let artworkImage = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
        let types = [];
        let stats = { hp: 50, attack: 50, defense: 50, spAtk: 50, spDef: 50, speed: 50 }; // 기본값

        try {
            const pokemonResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`);
            const pokemonData = pokemonResponse.data;
            
            // 이로치 여부에 따른 이미지 주소 매핑 (8번 구현)
            if (isShiny) {
                const animatedShiny = pokemonData.sprites.versions['generation-v']['black-white'].animated.front_shiny;
                image = animatedShiny || pokemonData.sprites.front_shiny || image;
                artworkImage = pokemonData.sprites.other['official-artwork'].front_shiny || artworkImage;
            } else {
                const animatedImg = pokemonData.sprites.versions['generation-v']['black-white'].animated.front_default;
                image = animatedImg || pokemonData.sprites.front_default || image;
                artworkImage = pokemonData.sprites.other['official-artwork'].front_default || artworkImage;
            }

            types = pokemonData.types.map(t => t.type.name);

            // 레이더 차트용 세부 능력치 데이터 파싱 (12번 구현)
            pokemonData.stats.forEach(s => {
                const statName = s.stat.name;
                if (statName === 'hp') stats.hp = s.base_stat;
                else if (statName === 'attack') stats.attack = s.base_stat;
                else if (statName === 'defense') stats.defense = s.base_stat;
                else if (statName === 'special-attack') stats.spAtk = s.base_stat;
                else if (statName === 'special-defense') stats.spDef = s.base_stat;
                else if (statName === 'speed') stats.speed = s.base_stat;
            });

        } catch (detailError) {
            console.error(`포켓몬 상세 상세 조회 실패 (ID: ${id}):`, detailError.message);
        }

        // 전설/환상 판정 (포획률 4번 및 천장 7번에 활용)
        const isLegendary = speciesData.is_legendary || speciesData.is_mythical || id >= 1000;

        return { id, number, name, url, image, artworkImage, types, stats, flavorText, isLegendary, isShiny };
    } catch (error) {
        console.error(`포켓몬 정보 로드 에러 (ID: ${id}):`, error.message);
        return { 
            id, 
            number: `No. ${String(id).padStart(4, '0')}`, 
            name: '데이터 미확인', 
            url: '#', 
            image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png',
            artworkImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png',
            types: [],
            stats: { hp: 10, attack: 10, defense: 10, spAtk: 10, spDef: 10, speed: 10 },
            flavorText: '미상의 생명체입니다.',
            isLegendary: false,
            isShiny: false
        };
    }
}

// 회원가입[cite: 3]
app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: '아이디와 비밀번호를 입력해주세요.' });
    }
    
    const { data: existingUser, error: selectError } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .maybeSingle();

    if (selectError) return res.status(500).json({ success: false, message: `DB 조회 오류: ${selectError.message}` });
    if (existingUser) return res.status(400).json({ success: false, message: '이미 존재하는 계정입니다.' });

    // 신규 회원은 기본 보조 코인 1000포인트 증정 (6번 구현)
    const { error: insertError } = await supabase.from('users').insert([{ username, password, admin: false, coins: 1000, streak_days: 0 }]);
    if (insertError) return res.status(500).json({ success: false, message: `회원가입 실패: ${insertError.message}` });
    
    res.json({ success: true, message: '회원가입 완료! 1,000 코인이 무료 지급되었습니다!' });
});

// 로그인 및 출석체크 스탬프 시스템 연동 (5번 구현)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .maybeSingle();
    
    if (error || !user) {
        return res.status(400).json({ success: false, message: '정보가 일치하지 않습니다.' });
    }

    // 출석 체크 로직 가동
    const todayStr = new Date().toISOString().split('T')[0];
    let streak = user.streak_days || 0;
    let coinsEarned = 0;
    let rewardMessage = '';

    if (user.last_login !== todayStr) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (user.last_login === yesterdayStr) {
            streak += 1;
        } else {
            streak = 1; // 연속이 끊기면 1일부터 재시작
        }

        // 연속 일수별 보상 테이블
        coinsEarned = 150; // 기본 출석 보상 150 코인
        if (streak % 7 === 0) {
            coinsEarned += 1000; // 7일 연속 출석 시 1000 코인 보너스
            rewardMessage = '🎉 7일 연속 출석! 보너스 1,000 코인 획득!';
        } else if (streak % 3 === 0) {
            coinsEarned += 400;
            rewardMessage = '🔥 3일 연속 출석 보너스 400 코인!';
        } else {
            rewardMessage = `오늘의 출석 스탬프 완료! (${streak}일 연속)`;
        }

        // 유저 정보 갱신
        await supabase
            .from('users')
            .update({
                last_login: todayStr,
                streak_days: streak,
                coins: (user.coins || 0) + coinsEarned
            })
            .eq('username', username);
    }

    res.cookie('username', username, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ 
        success: true, 
        username, 
        isAdmin: !!user.admin,
        attendance: {
            streak,
            coinsEarned,
            message: rewardMessage || '다시 오신 것을 환영합니다!'
        }
    });
});

// 로그아웃[cite: 3]
app.post('/api/logout', (req, res) => {
    res.clearCookie('username');
    res.json({ success: true });
});

// 유저 인증 미들웨어[cite: 3]
async function auth(req, res, next) {
    const username = req.cookies.username;
    if (!username) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    
    const { data: user } = await supabase.from('users').select('*').eq('username', username).maybeSingle();
    if (!user) return res.status(401).json({ success: false, message: '인증 실패' });
    
    req.username = username;
    req.user = user;
    next();
}

// 회원 기본 정보 및 재화 조회 API
app.get('/api/user/status', auth, async (req, res) => {
    const { data: userData } = await supabase.from('users').select('coins, streak_days, pity_count, achievements').eq('username', req.username).single();
    const { data: historyData } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
    
    const pokemonList = historyData ? historyData.pokemon_list : [];
    const uniqueCollected = new Set(pokemonList.map(p => p.id)).size;

    res.json({
        success: true,
        coins: userData.coins,
        streak_days: userData.streak_days,
        pity_count: userData.pity_count,
        achievements: userData.achievements || [],
        uniqueCollected,
        totalNum: MAX_POKEMON
    });
});

// 포켓몬 뽑기 가동 (4번: 포획률, 6번: 코인 차감, 7번: 천장, 8번: 이로치 적용)
app.post('/api/pokemon/roll', auth, async (req, res) => {
    const { customId, ballType } = req.body; // 수퍼볼, 하이퍼볼 선택 가능
    let coins = req.user.coins || 0;
    let rollCost = 100; // 기본 몬스터볼 비용

    // 사용 몬스터볼 가치 산정
    let catchBonus = 1.0; // 기본 포획 보너스 배율
    if (ballType === 'great') {
        rollCost = 250;
        catchBonus = 1.5; // 수퍼볼: 포획률 1.5배 보너스
    } else if (ballType === 'ultra') {
        rollCost = 500;
        catchBonus = 2.5; // 하이퍼볼: 포획률 2.5배 보너스
    }

    if (coins < rollCost) {
        return res.status(400).json({ success: false, message: `코인이 부족합니다! (필요: ${rollCost}코인)` });
    }

    let targetId;
    let pityTriggered = false;
    let currentPity = req.user.pity_count || 0;

    // 치트 패널 및 일반 대상 난수 추출
    if (req.user.admin && customId) {
        targetId = parseInt(customId);
    } else {
        // 천장 메커니즘 (7번 구현): 50회 연속 전설 미조우 시 전설 확정
        if (currentPity >= 49) {
            // 전설 포켓몬 리스트 중 임의 추출 (예시: 1~151 사이 전설, 뮤츠 No.150, 뮤 No.151, 프리져/썬더/파이어 등)
            const legendaryIds = [144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 382, 383, 384, 483, 484, 487, 643, 644, 716, 717, 718, 785, 786, 787, 788, 789, 791, 792, 800, 888, 889, 1007, 1008];
            targetId = legendaryIds[Math.floor(Math.random() * legendaryIds.length)];
            pityTriggered = true;
            currentPity = 0; // 천장 리셋
        } else {
            targetId = Math.floor(Math.random() * MAX_POKEMON) + 1;
        }
    }

    // 0.1% 확률로 이로치(Shiny) 등장 여부 판정 (8번 구현)
    const shinyRoll = Math.random();
    const isShiny = shinyRoll <= 0.001; // 0.1% 확률

    const pokemonData = await fetchPokemonFromAPI(targetId, isShiny);

    // 천장 카운트 조정
    if (!pityTriggered) {
        if (pokemonData.isLegendary) {
            currentPity = 0; // 뽑은 경우 초기화
        } else {
            currentPity += 1;
        }
    }

    // 포획 확률 계산 (4번 구현)
    // 일반 90%, 전설 15% 기저 확률에 볼 등급에 따른 보너스를 적용해 난수 판정
    const baseRate = pokemonData.isLegendary ? 0.15 : 0.90;
    const finalCatchRate = Math.min(baseRate * catchBonus, 1.0);
    const catchRoll = Math.random();
    const isCaught = catchRoll <= finalCatchRate;

    // 잔여 코인 계산 및 유저 프로필 즉각 업데이트
    const nextCoins = coins - rollCost;
    await supabase.from('users').update({ coins: nextCoins, pity_count: currentPity }).eq('username', req.username);

    // 17번 구현: 전설 혹은 이로치 포켓몬 포획 시 전역에 Websocket 실시간 알림 피드 방출
    if (isCaught && (pokemonData.isLegendary || isShiny)) {
        io.emit('globalAlert', {
            username: req.username,
            pokeName: pokemonData.name,
            isShiny: isShiny,
            isLegendary: pokemonData.isLegendary
        });
    }

    res.json({ 
        success: true, 
        pokemon: pokemonData, 
        isCaught, 
        finalCatchRate: Math.round(finalCatchRate * 100),
        usedCoins: rollCost,
        remainingCoins: nextCoins,
        pityCount: currentPity,
        isShiny
    });
});

// 보관함 저장 & 업적 달성 검사 (2번: 업적, 6번: 코인/삭제 연계)
app.post('/api/pokemon/save', auth, async (req, res) => {
    const { pokemon } = req.body;
    if (!pokemon) return res.status(400).json({ success: false, message: '저장할 포켓몬 정보가 없습니다.' });

    let { data } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
    let list = data ? data.pokemon_list : [];

    // 고유 UID 생성하여 중복 보관 및 개별 소유가 가능하도록 지정 (진화 재료에 필수)
    const uniqueInstance = {
        ...pokemon,
        uid: `${pokemon.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        savedAt: new Date().toISOString()
    };

    list.push(uniqueInstance);

    // 업적 시스템 트리거 (2번 구현)
    const { data: userProfile } = await supabase.from('users').select('achievements, coins').eq('username', req.username).single();
    let currentAchievements = userProfile.achievements || [];
    let coinBonus = 0;
    let earnedBadges = [];

    const fireCount = list.filter(p => p.types.includes('fire')).length;
    const uniqueCount = new Set(list.map(p => p.id)).size;

    const checkAndAward = (badgeName, condition, bonusReward) => {
        if (condition && !currentAchievements.includes(badgeName)) {
            currentAchievements.push(badgeName);
            coinBonus += bonusReward;
            earnedBadges.push({ badgeName, bonusReward });
        }
    };

    checkAndAward('불꽃 트레이너', fireCount >= 10, 500);
    checkAndAward('도감 수집가', uniqueCount >= 50, 1000);

    // DB 업데이트
    await supabase.from('history').upsert({ username: req.username, pokemon_list: list });
    if (coinBonus > 0 || earnedBadges.length > 0) {
        await supabase.from('users').update({ 
            achievements: currentAchievements, 
            coins: (userProfile.coins || 0) + coinBonus 
        }).eq('username', req.username);
    }

    res.json({ 
        success: true, 
        message: '보관함에 보관 완료!', 
        earnedBadges, 
        coinBonus 
    });
});

// 보관함 다중 방생/삭제 및 코인 환급 처리 (6, 18번 구현)
app.post('/api/pokemon/release-multi', auth, async (req, res) => {
    const { uids } = req.body; // 방생할 고유 인스턴스 ID 목록
    if (!uids || !Array.isArray(uids)) return res.status(400).json({ success: false, message: '방생 대상을 지정하세요.' });

    let { data: hist } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
    let list = hist ? hist.pokemon_list : [];

    // 제외할 포켓몬 필터링 및 환급 코인 계산 (마리당 50코인 반환)
    const initialCount = list.length;
    const filteredList = list.filter(p => !uids.includes(p.uid));
    const releasedCount = initialCount - filteredList.length;
    const refundCoins = releasedCount * 50;

    await supabase.from('history').upsert({ username: req.username, pokemon_list: filteredList });
    
    // 유저 재화 갱신
    const { data: user } = await supabase.from('users').select('coins').eq('username', req.username).single();
    await supabase.from('users').update({ coins: (user.coins || 0) + refundCoins }).eq('username', req.username);

    res.json({ success: true, message: `${releasedCount}마리를 방생하여 ${refundCoins} 코인을 획득했습니다!`, refunded: refundCoins });
});

// 보관함 다중 즐겨찾기 일괄 등록/해제 기능 (18번 구현)
app.post('/api/pokemon/favorite-multi', auth, async (req, res) => {
    const { uids, action } = req.body; // action: 'add' or 'remove'
    if (!uids || !Array.isArray(uids)) return res.status(400).json({ success: false, message: '올바른 대상을 전달해 주세요.' });

    let { data: hist } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
    let list = hist ? hist.pokemon_list : [];

    let { data: favs } = await supabase.from('favorites').select('pokemon_list').eq('username', req.username).maybeSingle();
    let favList = favs ? favs.pokemon_list : [];

    if (action === 'add') {
        // 보관함에서 uids에 부합하는 대상을 즐겨찾기 리스트로 병합
        uids.forEach(uid => {
            const target = list.find(p => p.uid === uid);
            if (target && !favList.some(f => f.uid === uid)) {
                favList.push(target);
            }
        });
        // 2번: '첫 즐겨찾기' 업적 달성 검사
        const { data: userProfile } = await supabase.from('users').select('achievements, coins').eq('username', req.username).single();
        let currentAchievements = userProfile.achievements || [];
        if (!currentAchievements.includes('첫 즐겨찾기')) {
            currentAchievements.push('첫 즐겨찾기');
            await supabase.from('users').update({ 
                achievements: currentAchievements, 
                coins: (userProfile.coins || 0) + 150 
            }).eq('username', req.username);
        }
    } else {
        favList = favList.filter(f => !uids.includes(f.uid));
    }

    await supabase.from('favorites').upsert({ username: req.username, pokemon_list: favList });
    res.json({ success: true, message: action === 'add' ? '즐겨찾기 대량 등록 완료' : '즐겨찾기 대량 해제 완료' });
});

// 포켓몬 진화 교환 시스템 (3번 구현)
// 동일한 도감 번호(id)를 가진 포켓몬 3마리를 진화형 포켓몬 1마리로 교환
app.post('/api/pokemon/evolve', auth, async (req, res) => {
    const { pokemonId } = req.body;
    if (!pokemonId) return res.status(400).json({ success: false, message: '진화 대상 번호가 누락되었습니다.' });

    let { data: hist } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
    let list = hist ? hist.pokemon_list : [];

    // 재료가 되는 포켓몬 인스턴스 필터링 및 3개 확보 여부 체크
    const ingredientInstances = list.filter(p => p.id === parseInt(pokemonId));
    if (ingredientInstances.length < 3) {
        return res.status(400).json({ success: false, message: `진화하려면 최소 3마리의 동일한 포켓몬이 필요합니다.` });
    }

    // 다음 진화형 도감 번호 연산 (기본적으로 ID + 1 구조, 최대 도감 범위 제한)
    const nextFormId = parseInt(pokemonId) + 1;
    if (nextFormId > MAX_POKEMON) {
        return res.status(400).json({ success: false, message: '이 포켓몬은 최종 진화형입니다.' });
    }

    // 재료 3마리 제거
    const ingredientUids = ingredientInstances.slice(0, 3).map(p => p.uid);
    let updatedList = list.filter(p => !ingredientUids.includes(p.uid));

    // 진화된 포켓몬 정보 획득
    const evolvedPokemon = await fetchPokemonFromAPI(nextFormId, false);
    const newUid = `${evolvedPokemon.id}_${Date.now()}_evolved`;
    const finalInstance = { ...evolvedPokemon, uid: newUid, savedAt: new Date().toISOString() };

    updatedList.push(finalInstance);

    await supabase.from('history').upsert({ username: req.username, pokemon_list: updatedList });

    res.json({ success: true, message: `진화 성공! ${evolvedPokemon.name}을(를) 획득했습니다! 🎉`, evolved: finalInstance });
});

// 유저 간 1:1 포켓몬 거래 장터 시스템 (15번 구현)
// 장터 등록 API
app.post('/api/trade/register', auth, async (req, res) => {
    const { pokemonUid, wantedType } = req.body;
    if (!pokemonUid || !wantedType) return res.status(400).json({ success: false, message: '인수 조건이 불충분합니다.' });

    let { data: hist } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
    let list = hist ? hist.pokemon_list : [];

    const itemToSell = list.find(p => p.uid === pokemonUid);
    if (!itemToSell) return res.status(400).json({ success: false, message: '해당 포켓몬을 보관함에서 찾을 수 없습니다.' });

    // 보관함에서 매각 대상으로 등록된 대상을 먼저 배제(에스크로)
    const filteredList = list.filter(p => p.uid !== pokemonUid);
    await supabase.from('history').upsert({ username: req.username, pokemon_list: filteredList });

    const { error } = await supabase.from('trade_market').insert([{
        seller: req.username,
        pokemon: itemToSell,
        wanted_type: wantedType,
        status: 'OPEN'
    }]);

    if (error) {
        // 복구 롤백
        list.push(itemToSell);
        await supabase.from('history').upsert({ username: req.username, pokemon_list: list });
        return res.status(500).json({ success: false, message: '장터 등록에 실패했습니다.' });
    }

    res.json({ success: true, message: '장터에 성공적으로 등록되었습니다!' });
});

// 장터 전체 리스트 가져오기
app.get('/api/trade/list', auth, async (req, res) => {
    const { data, error } = await supabase.from('trade_market').select('*').eq('status', 'OPEN').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, message: '목록 로드 실패' });
    res.json({ success: true, trades: data });
});

// 장터 1:1 양방향 교환 수락 및 트랜잭션 수행
app.post('/api/trade/accept', auth, async (req, res) => {
    const { tradeId, offerPokemonUid } = req.body;
    if (!tradeId || !offerPokemonUid) return res.status(400).json({ success: false, message: '필수 거래 인자가 유실되었습니다.' });

    // 1. 거래 게시물 가져오기
    const { data: trade, error: tradeErr } = await supabase.from('trade_market').select('*').eq('id', tradeId).maybeSingle();
    if (tradeErr || !trade || trade.status !== 'OPEN') {
        return res.status(400).json({ success: false, message: '종료되었거나 존재하지 않는 거래입니다.' });
    }

    if (trade.seller === req.username) {
        return res.status(400).json({ success: false, message: '자신의 매물과는 교환할 수 없습니다.' });
    }

    // 2. 구매자의 보관함에서 제시 포켓몬 확인
    let { data: buyerHist } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
    let buyerList = buyerHist ? buyerHist.pokemon_list : [];

    const offerItem = buyerList.find(p => p.uid === offerPokemonUid);
    if (!offerItem) return res.status(400).json({ success: false, message: '제시한 포켓몬을 가지고 있지 않습니다.' });

    // 원하는 타입과 일치하는지 타당성 검사
    const typeMatches = offerItem.types.includes(trade.wanted_type);
    if (!typeMatches) {
        return res.status(400).json({ success: false, message: `상대방이 희망하는 [${typeKoNames[trade.wanted_type]}] 타입 포켓몬이 아닙니다.` });
    }

    // 3. 교환 시뮬레이션 및 상호 데이터 이동 실행
    // 구매자: 제시품 제하고 + 판매자의 에스크로 포켓몬 등록
    buyerList = buyerList.filter(p => p.uid !== offerPokemonUid);
    buyerList.push({ ...trade.pokemon, savedAt: new Date().toISOString() });

    // 판매자: 판매자 보관함 데이터 로드 후 + 구매자의 제시 포켓몬 병합
    let { data: sellerHist } = await supabase.from('history').select('pokemon_list').eq('username', trade.seller).maybeSingle();
    let sellerList = sellerHist ? sellerHist.pokemon_list : [];
    sellerList.push({ ...offerItem, savedAt: new Date().toISOString() });

    // 4. 영속 레이어 데이터 반영
    await supabase.from('history').upsert({ username: req.username, pokemon_list: buyerList });
    await supabase.from('history').upsert({ username: trade.seller, pokemon_list: sellerList });
    await supabase.from('trade_market').update({ status: 'COMPLETED' }).eq('id', tradeId);

    res.json({ success: true, message: `성공적으로 교환이 성사되었습니다! ${trade.pokemon.name}을(를) 수령했습니다.` });
});

// 전역 수집 랭킹 보드 API (16번 구현)
app.get('/api/leaderboard', async (req, res) => {
    // 유저 목록 로드
    const { data: users, error: userErr } = await supabase.from('users').select('username');
    if (userErr) return res.status(500).json({ success: false });

    const { data: histories } = await supabase.from('history').select('username, pokemon_list');

    const leaderboard = users.map(user => {
        const userHistory = histories.find(h => h.username === user.username);
        const list = userHistory ? userHistory.pokemon_list : [];
        const uniqueIds = new Set(list.map(p => p.id));
        const shinyCount = list.filter(p => p.isShiny === true).length;

        return {
            username: user.username,
            uniqueCount: uniqueIds.size,
            shinyCount: shinyCount
        };
    });

    // 고유 도감 종류 순 정렬 (동률일 경우 이로치 보유수 순 정렬)
    leaderboard.sort((a, b) => {
        if (b.uniqueCount === a.uniqueCount) {
            return b.shinyCount - a.shinyCount;
        }
        return b.uniqueCount - a.uniqueCount;
    });

    res.json({ success: true, leaderboard: leaderboard.slice(0, 10) }); // Top 10 반환
});

// 보관함 기본 정보 조회[cite: 3]
app.get('/api/pokemon/history', auth, async (req, res) => {
    const { data } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
    res.json({ success: true, history: data ? data.pokemon_list : [] });
});

// 즐겨찾기 기본 목록 조회[cite: 3]
app.get('/api/pokemon/favorites', auth, async (req, res) => {
    const { data } = await supabase.from('favorites').select('pokemon_list').eq('username', req.username).maybeSingle();
    res.json({ success: true, favorites: data ? data.pokemon_list : [] });
});

server.listen(PORT, () => console.log(`통합 고도화 서버 구동 중: http://localhost:${PORT}`));
