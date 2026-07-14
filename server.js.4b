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

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const MAX_POKEMON = 1025;

// 특수 포켓몬 분류 데이터 베이스 매핑 정보
const POKEMON_CLASSIFICATION = {
    LEGENDARY: [144, 145, 146, 150, 243, 244, 245, 249, 250, 382, 383, 384, 483, 484, 487, 643, 644, 716, 717, 718, 791, 792, 800, 888, 889],
    MYTHICAL: [151, 251, 385, 386, 489, 490, 491, 492, 493, 494, 647, 648, 649, 719, 720, 721, 801, 802, 807, 808, 809, 893],
    ULTRA_BEAST: [793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806],
    MEGA: [10033, 10034, 10035, 10036, 10037, 10038, 10039, 10040, 10041, 10042, 10043, 10044, 10045] // 메가진화 계열 ID
};

// 가중치 확률 총합 100% 매커니즘 (0.60 + 0.25 + 0.10 + 0.04 + 0.01 = 1.0)
const GRADE_RULES = {
    NORMAL: 0.60,      // 노말 60%
    HERO: 0.25,        // 영웅 25%
    LEGENDARY: 0.10,   // 전설 10%
    OVERLORD: 0.04,    // 초월 4%
    MYTH: 0.01         // 신화 1%
};

io.on('connection', (socket) => {
    console.log('클라이언트 소켓 연결 성공:', socket.id);
});

const typeKoNames = {
    'normal': '노말', 'fire': '불꽃', 'water': '물', 'electric': '전기', 'grass': '풀',
    'ice': '얼음', 'fighting': '격투', 'poison': '독', 'ground': '땅', 'flying': '비행',
    'psychic': '에스퍼', 'bug': '벌레', 'rock': '바위', 'ghost': '고스트', 'dragon': '드래곤',
    'steel': '강철', 'fairy': '페어리', 'dark': '악'
};

function getClassification(id) {
    if (POKEMON_CLASSIFICATION.MYTHICAL.includes(id)) return '환상';
    if (POKEMON_CLASSIFICATION.LEGENDARY.includes(id)) return '전설';
    if (POKEMON_CLASSIFICATION.ULTRA_BEAST.includes(id)) return '울트라비스트';
    if (POKEMON_CLASSIFICATION.MEGA.includes(id)) return '메가진화';
    return '일반';
}

async function fetchPokemonFromAPI(id, isShiny = false, customStats = null) {
    try {
        const isMega = id >= 10000;
        let speciesData = { is_legendary: false, is_mythical: false, names: [], flavor_text_entries: [] };
        
        if (!isMega) {
            try {
                const speciesResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
                speciesData = speciesResponse.data;
            } catch (e) { console.log("Species 로드 생략 (특수 대역)"); }
        }

        const koreanNameObj = speciesData.names.find(n => n.language.name === 'ko');
        let name = koreanNameObj ? koreanNameObj.name : `포켓몬(#${id})`;
        const number = `No. ${String(id).padStart(4, '0')}`;
        const url = `https://pokemonkorea.co.kr/pokedex/view/${id}`;

        const koFlavorObj = speciesData.flavor_text_entries.find(e => e.language.name === 'ko');
        const flavorText = koFlavorObj ? koFlavorObj.flavor_text.replace(/\r?\n|\r/g, ' ') : '신비로운 베일에 싸인 포켓몬입니다.';

        let image = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
        let artworkImage = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
        let types = ['normal'];
        let stats = customStats || { hp: 60, attack: 60, defense: 60, spAtk: 60, spDef: 60, speed: 60 };

        try {
            const pokemonResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`);
            const pokemonData = pokemonResponse.data;
            
            if(!koreanNameObj) name = pokemonData.name.toUpperCase();

            if (isShiny) {
                image = pokemonData.sprites.front_shiny || image;
                artworkImage = pokemonData.sprites.other['official-artwork'].front_shiny || artworkImage;
            } else {
                image = pokemonData.sprites.front_default || image;
                artworkImage = pokemonData.sprites.other['official-artwork'].front_default || artworkImage;
            }
            types = pokemonData.types.map(t => t.type.name);

            if (!customStats) {
                pokemonData.stats.forEach(s => {
                    const statName = s.stat.name;
                    if (statName === 'hp') stats.hp = s.base_stat;
                    else if (statName === 'attack') stats.attack = s.base_stat;
                    else if (statName === 'defense') stats.defense = s.base_stat;
                    else if (statName === 'special-attack') stats.spAtk = s.base_stat;
                    else if (statName === 'special-defense') stats.spDef = s.base_stat;
                    else if (statName === 'speed') stats.speed = s.base_stat;
                });
            }
        } catch (de) { console.error("상세 로드 실패:", de.message); }

        const classification = getClassification(id);
        const isLegendary = classification === '전설' || classification === '환상' || classification === '울트라비스트' || speciesData.is_legendary || speciesData.is_mythical;

        return { id, number, name, url, image, artworkImage, types, stats, flavorText, isLegendary, isShiny, classification };
    } catch (error) {
        return { id, number: `No. ${id}`, name: '미확인 포켓몬', url: '#', image: '', artworkImage: '', types: ['normal'], stats: { hp: 50, attack: 50, defense: 50, spAtk: 50, spDef: 50, speed: 50 }, flavorText: '데이터 로드 에러', isLegendary: false, isShiny: false, classification: '일반' };
    }
}

// 회원가입 (유저 아이디 지정 가능)
app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: '아이디와 비밀번호를 입력해주세요.' });
    
    const { data: existingUser } = await supabase.from('users').select('username').eq('username', username).maybeSingle();
    if (existingUser) return res.status(400).json({ success: false, message: '이미 존재하는 계정입니다.' });

    // admin 아이디 입력 시 어드민 자격 자동 부여 처리
    const isAdmin = username.toLowerCase().includes('admin');
    const { error: insertError } = await supabase.from('users').insert([{ username, password, admin: isAdmin, coins: 1000, streak_days: 0 }]);
    if (insertError) return res.status(500).json({ success: false, message: `회원가입 실패: ${insertError.message}` });
    
    await supabase.from('history').insert([{ username, pokemon_list: [] }]);
    res.json({ success: true, message: `[${username}] 가입 완료! 1,000 코인이 지급되었습니다!` });
});

// 로그인
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const { data: user } = await supabase.from('users').select('*').eq('username', username).eq('password', password).maybeSingle();
    
    if (!user) return res.status(400).json({ success: false, message: '정보가 일치하지 않습니다.' });

    const todayStr = new Date().toISOString().split('T')[0];
    let streak = user.streak_days || 0;
    let coinsEarned = 0;
    let rewardMessage = '';

    if (user.last_login !== todayStr) {
        const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        streak = (user.last_login === yesterdayStr) ? streak + 1 : 1;
        coinsEarned = 150;
        if (streak % 7 === 0) { coinsEarned += 1000; rewardMessage = '🎉 7일 연속 출석 보너스 1,000 코인!'; }
        else if (streak % 3 === 0) { coinsEarned += 400; rewardMessage = '🔥 3일 연속 보너스 400 코인!'; }
        else { rewardMessage = `오늘의 출석 스탬프 완료! (${streak}일 연속)`; }

        await supabase.from('users').update({ last_login: todayStr, streak_days: streak, coins: (user.coins || 0) + coinsEarned }).eq('username', username);
    }

    res.cookie('username', username, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ success: true, username, isAdmin: !!user.admin, attendance: { streak, coinsEarned, message: rewardMessage || '환영합니다!' } });
});

app.post('/api/logout', (req, res) => { res.clearCookie('username'); res.json({ success: true }); });

async function auth(req, res, next) {
    const username = req.cookies.username;
    if (!username) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    const { data: user } = await supabase.from('users').select('*').eq('username', username).maybeSingle();
    if (!user) return res.status(401).json({ success: false, message: '인증 실패' });
    req.username = username; req.user = user; next();
}

app.get('/api/user/status', auth, async (req, res) => {
    const { data: userData } = await supabase.from('users').select('coins, streak_days, pity_count, achievements').eq('username', req.username).single();
    const { data: historyData } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
    const pokemonList = historyData ? historyData.pokemon_list : [];
    res.json({ success: true, coins: userData.coins, streak_days: userData.streak_days, pity_count: userData.pity_count, achievements: userData.achievements || [], uniqueCollected: new Set(pokemonList.map(p => p.id)).size, totalNum: MAX_POKEMON });
});

// ==========================================
// 🎲 100% 가중치 기반 등급 및 특수 필터 뽑기 API
// ==========================================
app.post('/api/pokemon/roll', auth, async (req, res) => {
    const { mode, ballType } = req.body; // mode: 'normal' | 'filter'
    let coins = req.user.coins || 0;
    
    let rollCost = (mode === 'filter') ? 1000 : 100;
    let catchBonus = 1.0;

    if (mode !== 'filter') {
        if (ballType === 'great') { rollCost = 250; catchBonus = 1.5; } 
        else if (ballType === 'ultra') { rollCost = 500; catchBonus = 2.5; }
    }

    if (coins < rollCost) return res.status(400).json({ success: false, message: `코인이 부족합니다! (필요: ${rollCost}코인)` });

    let targetId = 1;
    let pityTriggered = false;
    let currentPity = req.user.pity_count || 0;
    let forceShiny = false;

    if (mode === 'filter') {
        // 메가진화, 전설, 환상, 울트라비스트, 이로치만 전용 추출 필터링 (1000코인)
        const filterRoll = Math.random();
        if (filterRoll < 0.20) {
            targetId = POKEMON_CLASSIFICATION.MEGA[Math.floor(Math.random() * POKEMON_CLASSIFICATION.MEGA.length)];
        } else if (filterRoll < 0.45) {
            targetId = POKEMON_CLASSIFICATION.LEGENDARY[Math.floor(Math.random() * POKEMON_CLASSIFICATION.LEGENDARY.length)];
        } else if (filterRoll < 0.65) {
            targetId = POKEMON_CLASSIFICATION.MYTHICAL[Math.floor(Math.random() * POKEMON_CLASSIFICATION.MYTHICAL.length)];
        } else if (filterRoll < 0.85) {
            targetId = POKEMON_CLASSIFICATION.ULTRA_BEAST[Math.floor(Math.random() * POKEMON_CLASSIFICATION.ULTRA_BEAST.length)];
        } else {
            targetId = Math.floor(Math.random() * MAX_POKEMON) + 1;
            forceShiny = true;
        }
    } else {
        // 일반 전체 100% 확률 누적 구조 작동
        if (currentPity >= 49) {
            const allSpecials = [...POKEMON_CLASSIFICATION.LEGENDARY, ...POKEMON_CLASSIFICATION.MYTHICAL];
            targetId = allSpecials[Math.floor(Math.random() * allSpecials.length)];
            pityTriggered = true;
            currentPity = 0;
        } else {
            const dice = Math.random();
            if (dice < GRADE_RULES.MYTH) { // 1%
                targetId = POKEMON_CLASSIFICATION.MYTHICAL[Math.floor(Math.random() * POKEMON_CLASSIFICATION.MYTHICAL.length)];
            } else if (dice < GRADE_RULES.MYTH + GRADE_RULES.OVERLORD) { // 4%
                targetId = POKEMON_CLASSIFICATION.MEGA[Math.floor(Math.random() * POKEMON_CLASSIFICATION.MEGA.length)];
            } else if (dice < GRADE_RULES.MYTH + GRADE_RULES.OVERLORD + GRADE_RULES.LEGENDARY) { // 10%
                targetId = POKEMON_CLASSIFICATION.LEGENDARY[Math.floor(Math.random() * POKEMON_CLASSIFICATION.LEGENDARY.length)];
            } else if (dice < GRADE_RULES.MYTH + GRADE_RULES.OVERLORD + GRADE_RULES.LEGENDARY + GRADE_RULES.HERO) { // 25%
                const heroCandidates = [3, 6, 9, 25, 133, 143, 248, 373, 445];
                targetId = heroCandidates[Math.floor(Math.random() * heroCandidates.length)];
            } else { // 60% 노말
                targetId = Math.floor(Math.random() * 140) + 1;
            }
        }
    }

    const isShiny = forceShiny || (Math.random() <= (mode === 'filter' ? 0.3 : 0.01));
    const pokemonData = await fetchPokemonFromAPI(targetId, isShiny);

    if (!pityTriggered && mode !== 'filter') {
        currentPity = (pokemonData.isLegendary) ? 0 : currentPity + 1;
    }

    // 포획 연산 알고리즘
    let baseRate = 0.90;
    if (['전설','환상','울트라비스트','메가진화'].includes(pokemonData.classification)) baseRate = 0.20;
    
    const finalCatchRate = (mode === 'filter') ? 1.0 : Math.min(baseRate * catchBonus, 1.0);
    const isCaught = Math.random() <= finalCatchRate;
    const nextCoins = coins - rollCost;

    await supabase.from('users').update({ coins: nextCoins, pity_count: currentPity }).eq('username', req.username);

    if (isCaught && (pokemonData.isLegendary || isShiny)) {
        io.emit('globalAlert', { username: req.username, pokeName: pokemonData.name, isShiny, isLegendary: pokemonData.isLegendary });
    }

    res.json({ success: true, pokemon: pokemonData, isCaught, finalCatchRate: Math.round(finalCatchRate * 100), usedCoins: rollCost, remainingCoins: nextCoins, pityCount: currentPity, isShiny });
});

// ==========================================
// 💾 [버그 수정 완료] 보관함 실시간 저장 트랜잭션 보장 API
// ==========================================
app.post('/api/pokemon/save', auth, async (req, res) => {
    const { pokemon } = req.body;
    if (!pokemon) return res.status(400).json({ success: false, message: '저장 정보 부족' });

    try {
        const { data: currentRecord } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
        let list = currentRecord && currentRecord.pokemon_list ? [...currentRecord.pokemon_list] : [];

        const uniqueInstance = {
            ...pokemon,
            uid: `pk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            savedAt: new Date().toISOString()
        };
        list.push(uniqueInstance);

        const { error: upsertError } = await supabase.from('history').upsert({ username: req.username, pokemon_list: list });
        if (upsertError) throw upsertError;

        // 업적 연동 처리
        const { data: userProfile } = await supabase.from('users').select('achievements, coins').eq('username', req.username).single();
        let currentAchievements = userProfile.achievements || [];
        let coinBonus = 0;
        let earnedBadges = [];

        const checkAndAward = (badgeName, condition, bonusReward) => {
            if (condition && !currentAchievements.includes(badgeName)) {
                currentAchievements.push(badgeName); coinBonus += bonusReward;
                earnedBadges.push({ badgeName, bonusReward });
            }
        };
        checkAndAward('도감Collector', new Set(list.map(p => p.id)).size >= 5, 500);

        if (coinBonus > 0) {
            await supabase.from('users').update({ achievements: currentAchievements, coins: (userProfile.coins || 0) + coinBonus }).eq('username', req.username);
        }

        res.json({ success: true, message: '보관함 저장 성공!', earnedBadges, coinBonus });
    } catch (e) {
        res.status(500).json({ success: false, message: `보관함 치명적 오류: ${e.message}` });
    }
});

// ==========================================
// 👑 ADMIN(관리자) 치트 통제 컨트롤러 API
// ==========================================
app.post('/api/admin/cheat', auth, async (req, res) => {
    if (!req.user.admin) return res.status(403).json({ success: false, message: "관리자가 아닙니다." });
    
    const { action, targetId, isShiny, coins, stats } = req.body;

    if (action === 'adjust_coins') {
        await supabase.from('users').update({ coins: parseInt(coins) }).eq('username', req.username);
        return res.json({ success: true, message: `재화를 ${coins} 코인으로 강제 조정했습니다.` });
    }

    if (action === 'spawn_pokemon') {
        try {
            const parsedId = parseInt(targetId);
            const injectedPokemon = await fetchPokemonFromAPI(parsedId, isShiny, stats);
            
            const { data: currentRecord } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
            let list = currentRecord && currentRecord.pokemon_list ? [...currentRecord.pokemon_list] : [];
            
            injectedPokemon.uid = `cheat_${Date.now()}`;
            injectedPokemon.savedAt = new Date().toISOString();
            list.push(injectedPokemon);

            await supabase.from('history').upsert({ username: req.username, pokemon_list: list });
            return res.json({ success: true, message: `개체치 커스텀 포켓몬 [${injectedPokemon.name}]을(를) 보관함에 즉시 소환했습니다!` });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }
});

app.post('/api/pokemon/release-multi', auth, async (req, res) => {
    const { uids } = req.body;
    let { data: hist } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
    let list = hist ? hist.pokemon_list : [];
    const filteredList = list.filter(p => !uids.includes(p.uid));
    const refundCoins = (list.length - filteredList.length) * 50;

    await supabase.from('history').upsert({ username: req.username, pokemon_list: filteredList });
    await supabase.from('users').update({ coins: (req.user.coins || 0) + refundCoins }).eq('username', req.username);
    res.json({ success: true, message: `${refundCoins}코인이 반환되었습니다.` });
});

app.post('/api/pokemon/favorite-multi', auth, async (req, res) => {
    const { uids } = req.body;
    let { data: hist } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
    let { data: favs } = await supabase.from('favorites').select('pokemon_list').eq('username', req.username).maybeSingle();
    let favList = favs ? favs.pokemon_list : [];

    if(hist) {
        hist.pokemon_list.forEach(p => {
            if(uids.includes(p.uid) && !favList.some(f => f.uid === p.uid)) favList.push(p);
        });
    }
    await supabase.from('favorites').upsert({ username: req.username, pokemon_list: favList });
    res.json({ success: true, message: '선택 항목 즐겨찾기 완료' });
});

app.post('/api/pokemon/evolve', auth, async (req, res) => {
    const { pokemonId } = req.body;
    let { data: hist } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
    let list = hist ? hist.pokemon_list : [];
    const matches = list.filter(p => p.id === parseInt(pokemonId));
    if (matches.length < 3) return res.status(400).json({ success: false, message: '3마리가 필요합니다.' });

    const nextFormId = parseInt(pokemonId) + 1;
    const targetsToRemove = matches.slice(0,3).map(p => p.uid);
    let updatedList = list.filter(p => !targetsToRemove.includes(p.uid));

    const evolved = await fetchPokemonFromAPI(nextFormId, false);
    evolved.uid = `ev_${Date.now()}`;
    evolved.savedAt = new Date().toISOString();
    updatedList.push(evolved);

    await supabase.from('history').upsert({ username: req.username, pokemon_list: updatedList });
    res.json({ success: true, message: `진화 성공: ${evolved.name}`, evolved });
});

app.post('/api/trade/register', auth, async (req, res) => {
    const { pokemonUid, wantedType } = req.body;
    let { data: hist } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
    let list = hist ? hist.pokemon_list : [];
    const item = list.find(p => p.uid === pokemonUid);
    if(!item) return res.status(400).json({ success: false, message: '매물을 찾지 못했습니다.' });

    await supabase.from('history').upsert({ username: req.username, pokemon_list: list.filter(p => p.uid !== pokemonUid) });
    await supabase.from('trade_market').insert([{ seller: req.username, pokemon: item, wanted_type: wantedType, status: 'OPEN' }]);
    res.json({ success: true, message: '장터 등록 완료' });
});

app.get('/api/trade/list', auth, async (req, res) => {
    const { data } = await supabase.from('trade_market').select('*').eq('status', 'OPEN');
    res.json({ success: true, trades: data || [] });
});

app.post('/api/trade/accept', auth, async (req, res) => {
    const { tradeId, offerPokemonUid } = req.body;
    const { data: trade } = await supabase.from('trade_market').select('*').eq('id', tradeId).single();
    let { data: bHist } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
    let bList = bHist ? bHist.pokemon_list : [];
    const offer = bList.find(p => p.uid === offerPokemonUid);

    if(!offer || !offer.types.includes(trade.wanted_type)) return res.status(400).json({ success: false, message: '조건 불일치' });

    bList = bList.filter(p => p.uid !== offerPokemonUid);
    bList.push(trade.pokemon);
    let { data: sHist } = await supabase.from('history').select('pokemon_list').eq('username', trade.seller).maybeSingle();
    let sList = sHist ? sHist.pokemon_list : [];
    sList.push(offer);

    await supabase.from('history').upsert({ username: req.username, pokemon_list: bList });
    await supabase.from('history').upsert({ username: trade.seller, pokemon_list: sList });
    await supabase.from('trade_market').update({ status: 'COMPLETED' }).eq('id', tradeId);
    res.json({ success: true, message: '교환 성공' });
});

app.get('/api/leaderboard', async (req, res) => {
    const { data: histories } = await supabase.from('history').select('username, pokemon_list');
    const board = (histories || []).map(h => ({ username: h.username, uniqueCount: new Set((h.pokemon_list||[]).map(p=>p.id)).size, shinyCount: (h.pokemon_list||[]).filter(p=>p.isShiny).length }));
    res.json({ success: true, leaderboard: board.sort((a,b)=> b.uniqueCount - a.uniqueCount).slice(0, 10) });
});

app.get('/api/pokemon/history', auth, async (req, res) => {
    const { data } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
    res.json({ success: true, history: data ? data.pokemon_list : [] });
});

server.listen(PORT, () => console.log(`통합 고도화 서버 작동 중: Port ${PORT}`));
