const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const HISTORY_FILE = path.join(__dirname, 'data', 'history.json');
const FAVORITES_FILE = path.join(__dirname, 'data', 'favorites.json');

// 데이터 폴더 및 파일 초기화
function initStorage() {
    if (!fs.existsSync(path.join(__dirname, 'data'))) {
        fs.mkdirSync(path.join(__dirname, 'data'));
    }
    if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
    if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, JSON.stringify({}));
    if (!fs.existsSync(FAVORITES_FILE)) fs.writeFileSync(FAVORITES_FILE, JSON.stringify({}));
}
initStorage();

const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// 🌟 PokeAPI를 이용한 포켓몬 데이터 조회 함수
async function fetchPokemonFromAPI(id) {
    try {
        // 한국어 이름을 찾기 위해 pokemon-species 엔드포인트 호출
        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
        const data = response.data;

        // 한국어(ko) 이름 필터링
        const koreanNameObj = data.names.find(nameInfo => nameInfo.language.name === 'ko');
        const name = koreanNameObj ? koreanNameObj.name : data.name; // 한국어 이름 없으면 기본 영어 이름
        
        // 도감 번호 포맷팅 (예: 6 -> No. 0006)
        const number = `No. ${String(id).padStart(4, '0')}`;
        // 한국 포켓몬 공식 도감 URL 연결 유지
        const url = `https://pokemonkorea.co.kr/pokedex/view/${id}`;

        return { id, number, name, url };
    } catch (error) {
        console.error(error);
        return { id, number: 'Unknown', name: '존재하지 않는 번호이거나 API 오류입니다.', url: '#' };
    }
}

// 회원가입
app.post('/api/signup', (req, res) => {
    const { username, password } = req.body;
    const users = readJSON(USERS_FILE);
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ success: false, message: '이미 존재하는 계정입니다.' });
    }
    users.push({ username, password, admin: false });
    writeJSON(USERS_FILE, users);
    res.json({ success: true, message: '회원가입 완료!' });
});

// 로그인
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return res.status(400).json({ success: false, message: '정보가 일치하지 않습니다.' });
    
    res.cookie('username', username, { httpOnly: true });
    res.json({ success: true, username, isAdmin: !!user.admin });
});

// 로그아웃
app.post('/api/logout', (req, res) => {
    res.clearCookie('username');
    res.json({ success: true });
});

// 인증 미들웨어
function auth(req, res, next) {
    const username = req.cookies.username;
    if (!username) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    req.username = username;
    const users = readJSON(USERS_FILE);
    req.user = users.find(u => u.username === username);
    next();
}

// 포켓몬 뽑기 (PokeAPI 버전)
app.post('/api/pokemon/roll', auth, async (req, res) => {
    let targetId;
    const { customId } = req.body;
    
    // PokeAPI 전국도감 기준 (최신 세대 안정권인 1~1025번 권장)
    const MAX_POKEMON = 1025; 

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
app.post('/api/pokemon/save', auth, (req, res) => {
    const { pokemon } = req.body;
    const history = readJSON(HISTORY_FILE);
    if (!history[req.username]) history[req.username] = [];
    
    if (history[req.username].some(p => p.id === pokemon.id)) {
        return res.json({ success: true, message: '이미 보관함에 있습니다.' });
    }
    
    history[req.username].push({ ...pokemon, savedAt: new Date().toISOString() });
    writeJSON(HISTORY_FILE, history);
    res.json({ success: true, message: '보관함에 저장되었습니다!' });
});

app.get('/api/pokemon/history', auth, (req, res) => {
    const history = readJSON(HISTORY_FILE);
    res.json({ success: true, history: history[req.username] || [] });
});

// 즐겨찾기 토글
app.post('/api/pokemon/toggle-favorite', auth, (req, res) => {
    const { pokemon } = req.body;
    const favorites = readJSON(FAVORITES_FILE);
    if (!favorites[req.username]) favorites[req.username] = [];

    const index = favorites[req.username].findIndex(p => p.id === pokemon.id);
    let isAdded = false;

    if (index > -1) {
        favorites[req.username].splice(index, 1);
    } else {
        favorites[req.username].push(pokemon);
        isAdded = true;
    }

    writeJSON(FAVORITES_FILE, favorites);
    res.json({ 
        success: true, 
        isAdded, 
        message: isAdded ? '즐겨찾기에 추가되었습니다 ★' : '즐겨찾기에서 제거되었습니다 ☆' 
    });
});

// 즐겨찾기 목록 조회
app.get('/api/pokemon/favorites', auth, (req, res) => {
    const favorites = readJSON(FAVORITES_FILE);
    res.json({ success: true, favorites: favorites[req.username] || [] });
});

app.listen(PORT, () => console.log(`PokeAPI 서버 오픈: http://localhost:${PORT}`));
