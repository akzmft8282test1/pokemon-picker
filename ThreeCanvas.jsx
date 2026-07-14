import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';

// [1] 3D 포켓코인 오브젝트 컴포넌트
function PocketCoin() {
  const meshRef = useRef();
  
  // 회전 애니메이션 부여
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.02;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <cylinderGeometry args={[1.2, 1.2, 0.2, 32]} />
      <meshStandardMaterial color="#ffcb05" roughness={0.2} metalness={0.8} />
    </mesh>
  );
}

// [2] 3D 몬스터볼 시리즈 통합 컴포넌트
function Pokeball({ type }) {
  const groupRef = useRef();

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.01;
    }
  });

  // 볼 타입별 시그니처 상단 컬러 매핑
  const getBallColor = () => {
    switch(type) {
      case 'great': return '#3b4cca'; // 슈퍼볼 (청색)
      case 'ultra': return '#ffff00'; // 하이퍼볼 (황색)
      default: return '#ff0000';      // 몬스터볼 (적색)
    }
  };

  return (
    <group ref={groupRef}>
      {/* 상단 반구 */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[1.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={getBallColor()} roughness={0.3} />
      </mesh>
      {/* 하단 반구 */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[1.5, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      {/* 중앙 띠 및 버튼 체계 */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.51, 0.05, 16, 100]} />
        <meshStandardMaterial color="#1e1e24" />
      </mesh>
      <mesh position={[0, 0, 1.45]}>
        <cylinderGeometry args={[0.25, 0.25, 0.2, 32]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

// [3] 메인 메쉬 출력 캔버스 통제 뷰
export default function ThreeCanvas({ displayType, ballType }) {
  return (
    <div style={{ width: '100%', height: '400px', background: '#232329', borderRadius: '20px' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <directionalLight position={[-5, 5, -5]} intensity={0.5} />
        
        {displayType === 'coin' ? (
          <PocketCoin />
        ) : (
          <Pokeball type={ballType} />
        )}
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <OrbitControls enableZoom={false} />
      </Canvas>
    </div>
  );
}