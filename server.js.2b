const express = require('express');
const axios = require('axios');
const path = require('path');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const MAX_POKEMON = 1025;

// 한국어 타입 매핑 딕셔너리 (서버 내 가공용)
const typeKoNames = {
    'normal': '노말', 'fire': '불꽃', 'water': '물', 'electric': '전기',
    'grass': '풀', 'ice': '얼음', 'fighting': '격투', 'poison': '독',
    'ground': '땅', 'flying': '비행', 'psychic': '에스퍼', 'bug': '벌레',
    'rock': '바위', 'ghost': '고스트', 'dragon': '드래곤', 'steel': '강철',
    'fairy': '페어리', 'dark': '악'
};

async function fetchPokemonFromAPI(id) {
    try {
        // 1. species API 호출 (한글 이름용)
        const speciesResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
        const speciesData = speciesResponse.data;
        const koreanNameObj = speciesData.names.find(n => n.language.name === 'ko');
        const name = koreanNameObj ? koreanNameObj.name : speciesData.name;
        const number = `No. ${String(id).padStart(4, '0')}`;
        const url = `https://pokemonkorea.co.kr/pokedex/view/${id}`;

        // 2. 기본 pokemon API 호출 (이미지 및 타입 획득)
        let image = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
        let types = [];
        try {
            const pokemonResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`);
            const pokemonData = pokemonResponse.data;
            
            // 애니메이션 GIF 우선 -> 공식 일러스트 -> 기본 스프라이트 순서
            const animatedImg = pokemonData.sprites.versions['generation-v']['black-white'].animated.front_default;
            const officialArtwork = pokemonData.sprites.other['official-artwork'].front_default;
            image = animatedImg || officialArtwork || pokemonData.sprites.front_default || image;

            // 타입 데이터 가공
            types = pokemonData.types.map(t => t.type.name);
        } catch (detailError) {
            console.error(`포켓몬 상세정보 로드 실패 (ID: ${id}):`, detailError.message);
        }

        return { id, number, name, url, image, types };
    } catch (error) {
        console.error(`포켓몬 정보 로드 에러 (ID: ${id}):`, error.message);
        return { 
            id, 
            number: `No. ${String(id).padStart(4, '0')}`, 
            name: '오류 또는 없는 번호', 
            url: '#', 
            image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png',
            types: [] 
        };
    }
}

// 회원가입
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

    if (selectError) {
        console.error('회원가입 조회 에러:', selectError);
        return res.status(500).json({ success: false, message: `DB 조회 오류: ${selectError.message}` });
    }
    if (existingUser) return res.status(400).json({ success: false, message: '이미 존재하는 계정입니다.' });

    const { error: insertError } = await supabase.from('users').insert([{ username, password, admin: false }]);
    if (insertError) {
        console.error('회원가입 등록 에러:', insertError);
        return res.status(500).json({ success: false, message: `회원가입 실패: ${insertError.message}` });
    }
    res.json({ success: true, message: '회원가입 완료!' });
});

// 로그인
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .maybeSingle();
    
    if (error || !user) {
        if(error) console.error('로그인 조회 에러:', error);
        return res.status(400).json({ success: false, message: '정보가 일치하지 않습니다.' });
    }

    res.cookie('username', username, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }); // 1일 유지
    res.json({ success: true, username, isAdmin: !!user.admin });
});

// 로그아웃
app.post('/api/logout', (req, res) => {
    res.clearCookie('username');
    res.json({ success: true });
});

// 인증 미들웨어
async function auth(req, res, next) {
    const username = req.cookies.username;
    if (!username) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    
    const { data: user } = await supabase.from('users').select('*').eq('username', username).maybeSingle();
    if (!user) return res.status(401).json({ success: false, message: '인증 실패' });
    
    req.username = username;
    req.user = user;
    next();
}

// 포켓몬 뽑기
app.post('/api/pokemon/roll', auth, async (req, res) => {
    let targetId;
    const { customId } = req.body;

    if (req.user.admin && customId) {
        targetId = parseInt(customId);
        if (isNaN(targetId) || targetId < 1 || targetId > MAX_POKEMON) {
            return res.status(400).json({ success: false, message: `1~${MAX_POKEMON} 사이의 숫자를 입력하세요.` });
        }
    } else {
        targetId = Math.floor(Math.random() * MAX_POKEMON) + 1;
    }

    const pokemonData = await fetchPokemonFromAPI(targetId);
    res.json({ success: true, pokemon: pokemonData });
});

// 보관함 저장
app.post('/api/pokemon/save', auth, async (req, res) => {
    const { pokemon } = req.body;
    if (!pokemon) return res.status(400).json({ success: false, message: '저장할 포켓몬 정보가 없습니다.' });

    let { data } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
    let list = data ? data.pokemon_list : [];

    // 중복 체크 (배열 내 객체 ID 비교)
    if (list.some(p => p.id === pokemon.id)) {
        return res.json({ success: true, message: '이미 보관함에 있습니다.' });
    }

    list.push({ ...pokemon, savedAt: new Date().toISOString() });

    const { error } = await supabase.from('history').upsert({ username: req.username, pokemon_list: list });
    if (error) {
        console.error('보관함 저장 에러:', error);
        return res.status(500).json({ success: false, message: '보관함 저장 실패' });
    }
    
    res.json({ success: true, message: '보관함에 저장되었습니다!' });
});

// 보관함 조회
app.get('/api/pokemon/history', auth, async (req, res) => {
    const { data } = await supabase.from('history').select('pokemon_list').eq('username', req.username).maybeSingle();
    res.json({ success: true, history: data ? data.pokemon_list : [] });
});

// 즐겨찾기 토글
app.post('/api/pokemon/toggle-favorite', auth, async (req, res) => {
    const { pokemon } = req.body;
    if (!pokemon) return res.status(400).json({ success: false, message: '대상 포켓몬 정보가 없습니다.' });

    let { data } = await supabase.from('favorites').select('pokemon_list').eq('username', req.username).maybeSingle();
    let list = data ? data.pokemon_list : [];

    const index = list.findIndex(p => p.id === pokemon.id);
    let isAdded = false;

    if (index > -1) { 
        list.splice(index, 1); 
    } else { 
        list.push(pokemon); 
        isAdded = true; 
    }

    const { error } = await supabase.from('favorites').upsert({ username: req.username, pokemon_list: list });
    if (error) {
        console.error('즐겨찾기 토글 에러:', error);
        return res.status(500).json({ success: false, message: '즐겨찾기 변경 실패' });
    }
    
    res.json({ success: true, isAdded, message: isAdded ? '즐겨찾기 추가! ★' : '즐겨찾기 제거! ☆' });
});

// 즐겨찾기 목록 조회
app.get('/api/pokemon/favorites', auth, async (req, res) => {
    const { data } = await supabase.from('favorites').select('pokemon_list').eq('username', req.username).maybeSingle();
    res.json({ success: true, favorites: data ? data.pokemon_list : [] });
});

app.listen(PORT, () => console.log(`서버 구동 중: http://localhost:${PORT}`));
