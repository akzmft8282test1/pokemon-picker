import React, { useState, useEffect } from 'react';

export default function TradeTab({ currentUserId }) {
  const [historyList, setHistoryList] = useState([]);
  const [activeTab, setActiveTab] = useState('history');

  useEffect(() => {
    if (activeTab === 'history') {
      fetchTradeHistory();
    }
  }, [activeTab]);

  const fetchTradeHistory = async () => {
    const res = await fetch(`/api/trade/history/${currentUserId}`);
    const data = await res.json();
    if (data.success) {
      setHistoryList(data.history);
    }
  };

  return (
    <div style={{ background: '#1e1e24', padding: '15px', borderRadius: '12px', marginTop: '15px' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #333', marginBottom: '10px' }}>
        <button 
          onClick={() => setActiveTab('history')} 
          style={{ padding: '10px', background: 'none', color: activeTab === 'history' ? '#ffcb05' : '#aaa', border: 'none', borderBottom: activeTab === 'history' ? '2px solid #ffcb05' : 'none', cursor: 'pointer' }}
        >
          📜 교환 히스토리 내역
        </button>
      </div>

      {activeTab === 'history' && (
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {historyList.length === 0 ? (
            <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>완료된 교환 내역이 없습니다.</p>
          ) : (
            historyList.map((item) => {
              const isUserA = item.user_a_id === currentUserId;
              const sentPokemon = isUserA ? item.pokemon_a_name : item.pokemon_b_name;
              const receivedPokemon = isUserA ? item.pokemon_b_name : item.pokemon_a_name;

              return (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#2a2a35', padding: '10px', borderRadius: '8px', marginBottom: '8px', fontSize: '0.9rem' }}>
                  <div>
                    <span style={{ color: '#ff4d4d' }}>보낸 포켓몬: {sentPokemon}</span>
                    <span style={{ margin: '0 10px', color: '#aaa' }}>➡️</span>
                    <span style={{ color: '#00ff66' }}>받은 포켓몬: {receivedPokemon}</span>
                  </div>
                  <div style={{ color: '#888', fontSize: '0.8rem' }}>
                    {new Date(item.traded_at).toLocaleDateString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}