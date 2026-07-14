const express = require('express');
const axios = require('axios');
const path = require('path');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase 연동
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// PokeAPI 전국도감 기준 (한국어 번역이 깔끔한 1~1025번 세팅)
const MAX_POKEMON = 1025;

async function fetchPokemonFromAPI(id) {
    try {
        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
        const data = response.data;
        const koreanNameObj = data.names.find(n => n.language.name === 'ko');
        const name = koreanNameObj ? koreanNameObj.name : data.name;
        const number = `No. ${String(id).padStart(4, '0')}`;
        const url = `https://pokemonkorea.co.kr/pokedex/view/${id}`;

        return { id, number, name, url };
    } catch (error) {
        return { id, number: 'Unknown', name: '오류 또는 없는 번호', url: '#' };
    }
}

// 회원가입
app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    const { data: existingUser } = await supabase.from('users').select('username').eq('username', username).single();
    if (existingUser) return res.status(400).json({ success: false, message: '이미 존재하는 계정입니다.' });

    const { error } = await supabase.from('users').insert([{ username, password, admin: false }]);
    if (error) return res.status(500).json({ success: false, message: '회원가입 실패' });
    res.json({ success: true, message: '회원가입 완료!' });
});

// 로그인
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const { data: user, error } = await supabase.from('users').select('*').eq('username', username).eq('password', password).single();
    if (error || !user) return res.status(400).json({ success: false, message: '정보가 일치하지 않습니다.' });

    res.cookie('username', username, { httpOnly: true });
    res.json({ success: true, username, isAdmin: !!user.admin });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('username');
    res.json({ success: true });
});

// 인증 미들웨어
async function auth(req, res, next) {
    const username = req.cookies.username;
    if (!username) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    const { data: user } = await supabase.from('users').select('*').eq('username', username).single();
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
    let { data } = await supabase.from('history').select('pokemon_list').eq('username', req.username).single();
    let list = data ? data.pokemon_list : [];

    if (list.some(p => p.id === pokemon.id)) return res.json({ success: true, message: '이미 보관함에 있습니다.' });
    list.push({ ...pokemon, savedAt: new Date().toISOString() });

    await supabase.from('history').upsert({ username: req.username, pokemon_list: list });
    res.json({ success: true, message: '보관함에 저장되었습니다!' });
});

app.get('/api/pokemon/history', auth, async (req, res) => {
    const { data } = await supabase.from('history').select('pokemon_list').eq('username', req.username).single();
    res.json({ success: true, history: data ? data.pokemon_list : [] });
});

// 즐겨찾기 토글
app.post('/api/pokemon/toggle-favorite', auth, async (req, res) => {
    const { pokemon } = req.body;
    let { data } = await supabase.from('favorites').select('pokemon_list').eq('username', req.username).single();
    let list = data ? data.pokemon_list : [];

    const index = list.findIndex(p => p.id === pokemon.id);
    let isAdded = false;

    if (index > -1) { list.splice(index, 1); } 
    else { list.push(pokemon); isAdded = true; }

    await supabase.from('favorites').upsert({ username: req.username, pokemon_list: list });
    res.json({ success: true, isAdded, message: isAdded ? '즐겨찾기 추가! ★' : '즐겨찾기 제거! ☆' });
});

app.get('/api/pokemon/favorites', auth, async (req, res) => {
    const { data } = await supabase.from('favorites').select('pokemon_list').eq('username', req.username).single();
    res.json({ success: true, favorites: data ? data.pokemon_list : [] });
});

app.listen(PORT, () => console.log(`서버 구동 중: http://localhost:${PORT}`));
