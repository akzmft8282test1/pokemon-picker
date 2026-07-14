import React, { useState } from 'react';
import ThreeCanvas from './ThreeCanvas';

export default function App() {
  const [userId, setUserId] = useState('user-test-uuid-1234'); // 유저 아이디 지정 가능
  const [ballType, setBallType] = useState('poke');
  const [displayMode, setDisplayMode] = useState('ball'); // ball 또는 coin
  const [log, setLog] = useState('');

  const handleEncounter = async () => {
    setLog('포획 시도 중...');
    const response = await fetch('/api/pokemon/encounter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ballType })
    });
    const data = await response.json();
    if(data.isCaught) {
      setLog(`🎉 포획 성공! 등급: ${data.pokemon.grade} | [${data.pokemon.pokemon_name}] 개체값 HP IV: ${data.pokemon.hp_iv}`);
    } else {
      setLog('💨 포켓몬이 도망쳤습니다!');
    }
  };

  return (
    <div style={{ padding: '20px', color: '#fff', background: '#121214', minHeight: '100vh' }}>
      <h2>Poké 3D Canvas GUI Panel</h2>
      
      {/* 3D 뷰어 상단 제어바 */}
      <div style={{ margin: '10px 0' }}>
        <button onClick={() => setDisplayMode('ball')}>3D 볼 보기</button>
        <button onClick={() => setDisplayMode('coin')} style={{ marginLeft: '10px' }}>3D 포켓코인 보기</button>
      </div>

      {/* 3D 오브젝트 렌더링 캔버스 */}
      <ThreeCanvas displayType={displayMode} ballType={ballType} />

      {/* 인터랙션 폼 */}
      <div style={{ marginTop: '20px', background: '#1a1a1e', padding: '20px', borderRadius: '10px' }}>
        <label>유저 아이디 지정: </label>
        <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} style={{ margin: '5px', padding: '5px' }} />
        
        <div style={{ marginTop: '10px' }}>
          <label>사용할 볼 선택: </label>
          <select value={ballType} onChange={(e) => setBallType(e.target.value)} style={{ padding: '5px' }}>
            <option value="poke">일반 몬스터볼 (노말 확률↑)</option>
            <option value="great">슈퍼볼 (배율 1.5x)</option>
            <option value="ultra">하이퍼볼 (배율 2.5x)</option>
          </select>
        </div>

        <button onClick={handleEncounter} style={{ marginTop: '15px', padding: '10px 20px', background: '#ffcb05', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          확률 기반 포켓몬 잡기 수행
        </button>
      </div>

      {/* 로그 출력 피드 */}
      <div style={{ marginTop: '20px', padding: '10px', background: '#29292e', borderRadius: '5px', color: '#00ff66' }}>
        <strong>시스템 로그:</strong> {log}
      </div>
    </div>
  );
}