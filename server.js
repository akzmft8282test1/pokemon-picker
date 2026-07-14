const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 등급별 포켓몬 번호 풀 대략적 정의 (기존 MAX_POKEMON 기반 예시 분류)
const GRADES = {
    NORMAL: '노말',
    HERO: '영웅',
    LEGENDARY: '전설',
    TRANSCENDENT: '초월',
    MYTHICAL: '신화'
};

// 등급별 뽑기 기본 확률 (노말 -> 신화 순)
const PULL_RATES = { normal: 0.60, hero: 0.25, legendary: 0.11, transcendent: 0.035, mythical: 0.005 };

// 포획용 볼별 확률 보너스 배율
const BALL_MULTIPLIERS = { poke: 1.0, great: 1.5, ultra: 2.5 };
// 등급별 기본 포획 성공률
const BASE_CATCH_RATES = { '노말': 0.85, '영웅': 0.60, '전설': 0.30, '초월': 0.15, '신화': 0.05 };

// [1] 등급 및 포켓몬 랜덤 결정 헬퍼
function rollGradeAndId() {
    const roll = Math.random();
    if (roll < 0.005) return { grade: GRADES.MYTHICAL, id: Math.floor(Math.random() * 50) + 1000 }; // 1000번대 이후 신화 가정
    if (roll < 0.04) return { grade: GRADES.TRANSCENDENT, id: Math.floor(Math.random() * 100) + 900 };
    if (roll < 0.15) return { grade: GRADES.LEGENDARY, id: Math.floor(Math.random() * 150) + 750 };
    if (roll < 0.40) return { grade: GRADES.HERO, id: Math.floor(Math.random() * 300) + 450 };
    return { grade: GRADES.NORMAL, id: Math.floor(Math.random() * 450) + 1 };
}

// [2] 포켓몬 뽑기 및 포획 시도 API
app.post('/api/pokemon/encounter', async (req, res) => {
    const { userId, ballType } = req.body; // 유저 아이디 지정 가능
    
    // 1. 유저 재화 검증 (기존 차감 구조 유지)
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    const cost = ballType === 'ultra' ? 500 : ballType === 'great' ? 250 : 100;
    
    if (user.coins < cost) return res.status(400).json({ success: false, message: "재화가 부족합니다." });

    // 2. 포켓몬 스폰 및 등급 산정
    const { grade, id: targetId } = rollGradeAndId();
    const isShiny = Math.random() < 0.01; // 1% 확률 이로치
    
    // 3. 포획 확률 연산
    const baseRate = BASE_CATCH_RATES[grade];
    const multiplier = BALL_MULTIPLIERS[ballType] || 1.0;
    const finalCatchRate = Math.min(baseRate * multiplier, 1.0);
    const isCaught = Math.random() <= finalCatchRate;

    let caughtPokemonData = null;

    if (isCaught) {
        // 개체값(IV) 0~31 랜덤 생성
        const hp_iv = Math.floor(Math.random() * 32);
        const atk_iv = Math.floor(Math.random() * 32);
        const def_iv = Math.floor(Math.random() * 32);

        // API 이름 조회 생략 처리 파싱 예시 (실제 구현 시 fetchPokemonFromAPI 사용)
        const pokemonName = `포켓몬_${targetId}`; 

        // 통합 테이블에 뽑은 포켓몬 기록 및 유저 아이디 매핑
        const { data: newPokemon, error } = await supabase.from('caught_pokemons').insert([{
            user_id: userId,
            pokemon_id: targetId,
            pokemon_name: pokemonName,
            grade,
            hp_iv,
            atk_iv,
            def_iv,
            is_shiny: isShiny,
            caught_ball: ballType
        }]).select().single();

        if (!error) {
            caughtPokemonData = newPokemon;
            // 보관함 테이블에도 기록 저장
            await supabase.from('user_inventory').insert([{ user_id: userId, caught_pokemon_id: newPokemon.id }]);
        }
    }

    // 재화 차감
    await supabase.from('users').update({ coins: user.coins - cost }).eq('id', userId);

    res.json({ success: true, isCaught, pokemon: caughtPokemonData, remainingCoins: user.coins - cost });
});

// [3] ADMIN 전용 기능: 재화 조절 및 특정 포켓몬 강제 지급
app.post('/api/admin/modify', async (req, res) => {
    const { adminUserId, targetUserId, coinAmount, spawnPokemon } = req.body;

    // 관리자 권한 검증
    const { data: adminUser } = await supabase.from('users').select('is_admin').eq('id', adminUserId).single();
    if (!adminUser || !adminUser.is_admin) return res.status(403).json({ success: false, message: "권한이 없습니다." });

    // 1. 재화 조정 로직 수행
    if (coinAmount !== undefined) {
        await supabase.from('users').update({ coins: coinAmount }).eq('id', targetUserId);
    }

    // 2. 특정 포켓몬 사양 지정 지급 (개체값, 이로치 여부 직접 지정)
    if (spawnPokemon) {
        const { pokemonId, pokemonName, grade, hp_iv, atk_iv, def_iv, isShiny } = spawnPokemon;
        const { data: customPokemon } = await supabase.from('caught_pokemons').insert([{
            user_id: targetUserId,
            pokemon_id: pokemonId,
            pokemon_name: pokemonName,
            grade: grade || '전설',
            hp_iv: hp_iv || 31,
            atk_iv: atk_iv || 31,
            def_iv: def_iv || 31,
            is_shiny: isShiny || false,
            caught_ball: 'admin_gift'
        }]).select().single();

        await supabase.from('user_inventory').insert([{ user_id: targetUserId, caught_pokemon_id: customPokemon.id }]);
    }
    

    res.json({ success: true, message: "어드민 명령이 성공적으로 처리되었습니다." });
});

app.listen(3000, () => console.log('어드민 & 포획 강화 서버 가동 중 (Port 3000)'));
// [1] 특정 유저에게 포켓몬 교환 제안하기
app.post('/api/trade/offer', async (req, res) => {
    const { senderId, receiverId, senderPokemonUid, receiverPokemonUid } = req.body;

    // 1. 내가 소유한 포켓몬이 맞는지 검증
    const { data: senderPoke } = await supabase
        .from('caught_pokemons')
        .select('*')
        .eq('id', senderPokemonUid)
        .eq('user_id', senderId)
        .maybeSingle();

    if (!senderPoke) return res.status(400).json({ success: false, message: "내가 소유한 포켓몬이 아닙니다." });

    // 2. 상대방이 소유한 포켓몬이 맞는지 검증
    const { data: receiverPoke } = await supabase
        .from('caught_pokemons')
        .select('*')
        .eq('id', receiverPokemonUid)
        .eq('user_id', receiverId)
        .maybeSingle();

    if (!receiverPoke) return res.status(400).json({ success: false, message: "상대방이 소유한 포켓몬이 아닙니다." });

    // 3. 교환 제안 등록
    const { error } = await supabase.from('trade_offers').insert([{
        sender_id: senderId,
        receiver_id: receiverId,
        sender_pokemon_id: senderPokemonUid,
        receiver_pokemon_id: receiverPokemonUid,
        status: 'PENDING'
    }]);

    if (error) return res.status(500).json({ success: false, message: "교환 제안에 실패했습니다." });
    res.json({ success: true, message: "상대방에게 교환 제안을 보냈습니다!" });
});

// [2] 교환 제안 수락 및 데이터베이스 트랜잭션 처리
app.post('/api/trade/offer/accept', async (req, res) => {
    const { offerId, receiverId } = req.body;

    // 1. 교환 요청서 조회
    const { data: offer, error: offerErr } = await supabase
        .from('trade_offers')
        .select('*, sender_pokemon:sender_pokemon_id(*), receiver_pokemon:receiver_pokemon_id(*)')
        .eq('id', offerId)
        .maybeSingle();

    if (offerErr || !offer || offer.status !== 'PENDING') {
        return res.status(400).json({ success: false, message: "유효하지 않거나 이미 처리된 교환 요청입니다." });
    }

    if (offer.receiver_id !== receiverId) {
        return res.status(403).json({ success: false, message: "본인에게 온 교환 요청만 수락할 수 있습니다." });
    }

    const senderPoke = offer.sender_pokemon;
    const receiverPoke = offer.receiver_pokemon;

    // 2. 수락 시점에도 두 포켓몬이 원래 주인에게 있는지 최종 검증
    if (senderPoke.user_id !== offer.sender_id || receiverPoke.user_id !== offer.receiver_id) {
        return res.status(400).json({ success: false, message: "포켓몬의 소유 상태가 변경되어 교환할 수 없습니다." });
    }

    // 3. 소유권 이전 (caught_pokemons의 user_id를 상호 교체)
    // 유저 A(Sender)의 포켓몬 -> 유저 B(Receiver)에게로
    await supabase.from('caught_pokemons').update({ user_id: offer.receiver_id }).eq('id', senderPoke.id);
    // 유저 B(Receiver)의 포켓몬 -> 유저 A(Sender)에게로
    await supabase.from('caught_pokemons').update({ user_id: offer.sender_id }).eq('id', receiverPoke.id);

    // 보관함(인벤토리) 매핑 테이블도 함께 갱신
    await supabase.from('user_inventory').update({ user_id: offer.receiver_id }).eq('caught_pokemon_id', senderPoke.id);
    await supabase.from('user_inventory').update({ user_id: offer.sender_id }).eq('caught_pokemon_id', receiverPoke.id);

    // 4. 교환 요청 상태 완료 처리
    await supabase.from('trade_offers').update({ status: 'ACCEPTED' }).eq('id', offerId);

    // 5. 교환 내역 히스토리(trade_history)에 영구 기록 추가
    await supabase.from('trade_history').insert([{
        user_a_id: offer.sender_id,
        user_b_id: offer.receiver_id,
        pokemon_a_id: senderPoke.pokemon_id,
        pokemon_a_name: senderPoke.pokemon_name,
        pokemon_b_id: receiverPoke.pokemon_id,
        pokemon_b_name: receiverPoke.pokemon_name
    }]);

    res.json({ 
        success: true, 
        message: `교환 성사! [${senderPoke.pokemon_name}]와(과) [${receiverPoke.pokemon_name}]를 상호 교환했습니다.` 
    });
});

// [3] 내가 참여한 교환 내역 히스토리 불러오기
app.get('/api/trade/history/:userId', async (req, res) => {
    const { userId } = req.params;

    const { data, error } = await supabase
        .from('trade_history')
        .select('*')
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .order('traded_at', { ascending: false });

    if (error) return res.status(500).json({ success: false, message: "히스토리 로드 실패" });
    res.json({ success: true, history: data });
});